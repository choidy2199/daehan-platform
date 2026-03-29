"use client";
import { useState, useEffect, useRef } from "react";
import { calcCost } from "@/lib/calc";
import { DB, KEYS, save } from "@/lib/db";
import { useToast } from "@/components/common/Toast";

interface ProductModalProps {
  show: boolean;
  onClose: () => void;
  editIdx: number | null;
  onSave: () => void;
}

export default function ProductModal({ show, onClose, editIdx, onSave }: ProductModalProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [code, setCode] = useState("");
  const [manageCode, setManageCode] = useState("");
  const [catL, setCatL] = useState("");
  const [catM, setCatM] = useState("");
  const [catS, setCatS] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [tti, setTti] = useState("");
  const [model, setModel] = useState("");
  const [supplyPrice, setSupplyPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [productDC, setProductDC] = useState("");
  const [discontinued, setDiscontinued] = useState("N");
  const [stockMemo, setStockMemo] = useState("");

  useEffect(() => {
    if (!show) return;
    if (editIdx !== null && editIdx >= 0 && DB.products[editIdx]) {
      const p = DB.products[editIdx];
      setCode(p.code || "");
      setManageCode(p.manageCode || "");
      setCatL(p.catL || "");
      setCatM(p.catM || "");
      setCatS(p.catS || "");
      setSortOrder(p.sortOrder || "");
      setTti(p.tti || "");
      setModel(p.model || "");
      setSupplyPrice(p.supplyPrice != null ? String(p.supplyPrice) : "");
      setDesc(p.desc || "");
      setProductDC(p.productDC != null ? String(p.productDC) : "");
      setDiscontinued(p.discontinued || "N");
      setStockMemo(p.stockMemo || "");
    } else {
      resetForm();
    }
  }, [show, editIdx]);

  function resetForm() {
    setCode("");
    setManageCode("");
    setCatL("");
    setCatM("");
    setCatS("");
    setSortOrder("");
    setTti("");
    setModel("");
    setSupplyPrice("");
    setDesc("");
    setProductDC("");
    setDiscontinued("N");
    setStockMemo("");
  }

  function handleSave() {
    if (!code.trim()) { toast("코드를 입력하세요"); return; }
    if (!model.trim()) { toast("모델명을 입력하세요"); return; }
    if (!supplyPrice.trim() || isNaN(Number(supplyPrice))) { toast("공급가를 입력하세요"); return; }

    const sp = Number(supplyPrice);
    const dc = productDC ? Number(productDC) : 0;
    const cost = calcCost(sp, dc);
    const s = DB.settings;

    const priceA = Math.round(cost / (1 - (s.marginA || 0) / 100));
    const priceRetail = Math.round(cost / (1 - (s.marginRetail || 0) / 100));
    const priceNaver = Math.round(cost / (1 - (s.marginNaver || 0) / 100));
    const priceOpen = Math.round(cost / (1 - (s.marginOpen || 0) / 100));

    const product: any = {
      code: code.trim(),
      manageCode: manageCode.trim(),
      catL: catL.trim(),
      catM: catM.trim(),
      catS: catS.trim(),
      sortOrder: sortOrder.trim(),
      tti: tti.trim(),
      model: model.trim(),
      supplyPrice: sp,
      desc: desc.trim(),
      productDC: dc,
      discontinued,
      stockMemo: stockMemo.trim(),
      cost,
      priceA,
      priceRetail,
      priceNaver,
      priceOpen,
    };

    if (editIdx !== null && editIdx >= 0) {
      DB.products[editIdx] = { ...DB.products[editIdx], ...product };
      toast("제품이 수정되었습니다");
    } else {
      const dup = DB.products.find((p: any) => p.code === product.code);
      if (dup) { toast("이미 동일한 코드가 존재합니다"); return; }
      DB.products.push(product);
      toast("제품이 추가되었습니다");
    }

    save(KEYS.products, DB.products);
    onSave();
    onClose();
  }

  return (
    <div className={`modal-bg ${show ? "show" : ""}`} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editIdx !== null && editIdx >= 0 ? "제품 수정" : "제품 추가"}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
            {/* 3-column grid */}
            <div className="form-grid cols-3">
              <div className="form-field">
                <label className="label">코드 *</label>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">관리코드</label>
                <input className="input" value={manageCode} onChange={(e) => setManageCode(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">대분류</label>
                <input className="input" value={catL} onChange={(e) => setCatL(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">중분류</label>
                <input className="input" value={catM} onChange={(e) => setCatM(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">소분류</label>
                <input className="input" value={catS} onChange={(e) => setCatS(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">순번</label>
                <input className="input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">TTI#</label>
                <input className="input" value={tti} onChange={(e) => setTti(e.target.value)} />
              </div>
            </div>

            {/* 2-column grid */}
            <div className="form-grid cols-2">
              <div className="form-field">
                <label className="label">모델명 *</label>
                <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">공급가 *</label>
                <input className="input" type="number" value={supplyPrice} onChange={(e) => setSupplyPrice(e.target.value)} />
              </div>
            </div>

            {/* 1-column */}
            <div className="form-grid cols-1">
              <div className="form-field">
                <label className="label">제품설명</label>
                <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
            </div>

            {/* 3-column */}
            <div className="form-grid cols-3">
              <div className="form-field">
                <label className="label">제품DC</label>
                <input className="input" type="number" value={productDC} onChange={(e) => setProductDC(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">단종여부</label>
                <select className="select" value={discontinued} onChange={(e) => setDiscontinued(e.target.value)}>
                  <option value="N">판매중</option>
                  <option value="Y">단종</option>
                </select>
              </div>
              <div className="form-field">
                <label className="label">입고날짜 메모</label>
                <input className="input" value={stockMemo} onChange={(e) => setStockMemo(e.target.value)} />
              </div>
            </div>
            <p className="form-info">* 원가 = 공급가 × (1 - 제품DC/100) × (1 - 분기리베이트/100) × (1 - 연간리베이트/100)</p>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
