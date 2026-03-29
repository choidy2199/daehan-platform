"use client";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { calcCost } from "@/lib/calc";
import { DB, KEYS, save } from "@/lib/db";
import { useToast } from "@/components/common/Toast";

interface ImportModalProps {
  show: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportModal({ show, onClose, onImportComplete }: ImportModalProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);

  function downloadTemplate() {
    const headers = [
      "코드", "관리코드", "대분류", "중분류", "소분류", "순번", "TTI#",
      "모델명", "공급가", "제품설명", "제품DC", "단종여부", "입고날짜메모",
    ];
    const sampleRow = [
      "48-11-2460", "", "전동", "배터리", "M18", "", "",
      "M18 배터리 6.0Ah", 85000, "M18 REDLITHIUM HIGH OUTPUT XC6.0 Battery Pack", 0, "N", "",
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "제품목록");
    XLSX.writeFile(wb, "밀워키_제품_양식.xlsx");
    toast("양식이 다운로드되었습니다");
  }

  function importExcel() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast("파일을 선택하세요"); return; }

    setImporting(true);
    setStatus("파일 읽는 중...");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const results: string[] = [];
        let totalImported = 0;

        // Auto-detect sheets
        const sheetMap: Record<string, string> = {};
        for (const name of wb.SheetNames) {
          const lower = name.toLowerCase();
          if (lower.includes("재고")) sheetMap["inventory"] = name;
          else if (lower.includes("전체가격표") || lower.includes("가격")) sheetMap["products"] = name;
          else if (lower.includes("프로모션") || lower.includes("promo")) sheetMap["promotions"] = name;
          else if (lower === "r" || lower.includes("리베이트") || lower.includes("rebate")) sheetMap["rebate"] = name;
          else if (!sheetMap["products"]) sheetMap["products"] = name; // fallback first sheet
        }

        results.push(`시트 매칭: ${JSON.stringify(sheetMap)}`);

        // Process products sheet
        const prodSheetName = sheetMap["products"];
        if (prodSheetName) {
          const ws = wb.Sheets[prodSheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

          // Find header row (row with '코드' and '모델명')
          let headerIdx = -1;
          let headerMap: Record<string, number> = {};
          for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if (!row) continue;
            const cells = row.map((c: any) => String(c || "").trim());
            const codeIdx = cells.indexOf("코드");
            const modelIdx = cells.indexOf("모델명");
            if (codeIdx >= 0 && modelIdx >= 0) {
              headerIdx = i;
              cells.forEach((cell: string, idx: number) => {
                if (cell) headerMap[cell] = idx;
              });
              break;
            }
          }

          if (headerIdx < 0) {
            results.push("제품 시트에서 헤더(코드/모델명)를 찾을 수 없습니다");
          } else {
            // Read discount rates from row above header
            let sheetDC: Record<string, number> = {};
            if (headerIdx > 0) {
              const dcRow = rows[headerIdx - 1];
              if (dcRow) {
                for (const [key, colIdx] of Object.entries(headerMap)) {
                  const val = dcRow[colIdx];
                  if (val && !isNaN(Number(val))) {
                    sheetDC[key] = Number(val);
                  }
                }
              }
              if (Object.keys(sheetDC).length > 0) {
                results.push(`할인율 감지: ${JSON.stringify(sheetDC)}`);
              }
            }

            const imported: any[] = [];
            for (let i = headerIdx + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row) continue;
              const codeVal = String(row[headerMap["코드"]] || "").trim();
              const modelVal = String(row[headerMap["모델명"]] || "").trim();
              if (!codeVal || !modelVal) continue;

              const sp = Number(row[headerMap["공급가"]] || 0);
              const dc = Number(row[headerMap["제품DC"]] || 0);
              const cost = calcCost(sp, dc);
              const s = DB.settings;

              imported.push({
                code: codeVal,
                manageCode: String(row[headerMap["관리코드"]] || "").trim(),
                catL: String(row[headerMap["대분류"]] || "").trim(),
                catM: String(row[headerMap["중분류"]] || "").trim(),
                catS: String(row[headerMap["소분류"]] || "").trim(),
                sortOrder: String(row[headerMap["순번"]] || "").trim(),
                tti: String(row[headerMap["TTI#"]] || "").trim(),
                model: modelVal,
                supplyPrice: sp,
                desc: String(row[headerMap["제품설명"]] || "").trim(),
                productDC: dc,
                discontinued: String(row[headerMap["단종여부"]] || "N").trim(),
                stockMemo: String(row[headerMap["입고날짜메모"]] || "").trim(),
                cost,
                priceA: Math.round(cost / (1 - (s.marginA || 0) / 100)),
                priceRetail: Math.round(cost / (1 - (s.marginRetail || 0) / 100)),
                priceNaver: Math.round(cost / (1 - (s.marginNaver || 0) / 100)),
                priceOpen: Math.round(cost / (1 - (s.marginOpen || 0) / 100)),
              });
            }

            if (mode === "replace") {
              DB.products = imported;
              results.push(`전체교체: ${imported.length}개 제품 가져옴`);
            } else {
              let updated = 0, added = 0;
              for (const item of imported) {
                const idx = DB.products.findIndex((p: any) => p.code === item.code);
                if (idx >= 0) {
                  DB.products[idx] = { ...DB.products[idx], ...item };
                  updated++;
                } else {
                  DB.products.push(item);
                  added++;
                }
              }
              results.push(`코드매칭: ${updated}개 업데이트, ${added}개 신규 추가`);
            }
            totalImported += imported.length;
            save(KEYS.products, DB.products);
          }
        }

        // Process inventory sheet
        if (sheetMap["inventory"]) {
          const ws = wb.Sheets[sheetMap["inventory"]];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          let headerIdx = -1;
          let headerMap: Record<string, number> = {};
          for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if (!row) continue;
            const cells = row.map((c: any) => String(c || "").trim());
            const codeIdx = cells.indexOf("코드");
            if (codeIdx >= 0) {
              headerIdx = i;
              cells.forEach((cell: string, idx: number) => { if (cell) headerMap[cell] = idx; });
              break;
            }
          }
          if (headerIdx >= 0) {
            let matched = 0;
            for (let i = headerIdx + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row) continue;
              const codeVal = String(row[headerMap["코드"]] || "").trim();
              if (!codeVal) continue;
              const product = DB.products.find((p: any) => p.code === codeVal);
              if (product) {
                product.stock = Number(row[headerMap["재고"]] || row[headerMap["수량"]] || 0);
                matched++;
              }
            }
            results.push(`재고: ${matched}개 제품 매칭`);
            save(KEYS.products, DB.products);
          }
        }

        // Process promotions sheet
        if (sheetMap["promotions"]) {
          const ws = wb.Sheets[sheetMap["promotions"]];
          const promoData: any[] = XLSX.utils.sheet_to_json(ws);
          if (promoData.length > 0) {
            DB.promotions = promoData;
            save(KEYS.promotions, DB.promotions);
            results.push(`프로모션: ${promoData.length}개 항목 가져옴`);
          }
        }

        setStatus(results.join("\n"));
        setImporting(false);
        toast(`가져오기 완료 (${totalImported}개 제품)`);
        onImportComplete();
      } catch (err: any) {
        setStatus(`오류: ${err.message}`);
        setImporting(false);
        toast("가져오기 실패");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className={`modal-bg ${show ? "show" : ""}`} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>엑셀 가져오기</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="import-step">
            <h4>Step 1: 양식 다운로드</h4>
            <p>아래 양식을 다운로드하여 데이터를 입력하세요.</p>
            <button className="btn-secondary" onClick={downloadTemplate}>양식 다운로드</button>
          </div>

          <div className="import-step">
            <h4>Step 2: 파일 업로드</h4>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="input"
            />
          </div>

          <div className="import-step">
            <h4>업로드 모드</h4>
            <label className="radio-label">
              <input
                type="radio"
                name="importMode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              전체교체 - 기존 데이터를 모두 교체합니다
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="importMode"
                value="merge"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />
              코드매칭업데이트 - 동일 코드는 업데이트, 새 코드는 추가
            </label>
          </div>

          {status && (
            <div className="import-status">
              <pre>{status}</pre>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={importExcel} disabled={importing}>
            {importing ? "가져오는 중..." : "가져오기"}
          </button>
        </div>
      </div>
    </div>
  );
}
