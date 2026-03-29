"use client";
import { useState, useEffect } from "react";
import { calcCost } from "@/lib/calc";
import { DB, KEYS, save } from "@/lib/db";
import { useToast } from "@/components/common/Toast";

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onApply: () => void;
}

const DATA_KEYS = [
  { key: "products", label: "밀워키 제품 (products)" },
  { key: "inventory", label: "재고 (inventory)" },
  { key: "promotions", label: "프로모션 (promotions)" },
  { key: "orders", label: "발주 (orders)" },
  { key: "orderHistory", label: "발주이력 (orderHistory)" },
  { key: "general", label: "일반제품 (general)" },
  { key: "sales", label: "판매기록 (sales)" },
  { key: "estimates", label: "견적 (estimates)" },
  { key: "setbun", label: "세트번들 (setbun)" },
  { key: "settings", label: "설정 (settings)" },
  { key: "ui", label: "UI 설정 (ui)" },
];

export default function SettingsModal({ show, onClose, onApply }: SettingsModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"settings" | "data">("settings");

  // Settings tab
  const [rebateQ, setRebateQ] = useState("");
  const [rebateY, setRebateY] = useState("");
  const [marginA, setMarginA] = useState("");
  const [marginRetail, setMarginRetail] = useState("");
  const [marginNaver, setMarginNaver] = useState("");
  const [marginOpenPower, setMarginOpenPower] = useState("");
  const [marginOpenHand, setMarginOpenHand] = useState("");

  // Data tab
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!show) return;
    const s = DB.settings || {};
    setRebateQ(s.rebateQ != null ? String(s.rebateQ) : "");
    setRebateY(s.rebateY != null ? String(s.rebateY) : "");
    setMarginA(s.marginA != null ? String(s.marginA) : "");
    setMarginRetail(s.marginRetail != null ? String(s.marginRetail) : "");
    setMarginNaver(s.marginNaver != null ? String(s.marginNaver) : "");
    setMarginOpenPower(s.marginOpenPower != null ? String(s.marginOpenPower) : "");
    setMarginOpenHand(s.marginOpenHand != null ? String(s.marginOpenHand) : "");
    setChecked({});
    setTab("settings");
  }, [show]);

  function toggleCheck(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function recalcAll() {
    const s = DB.settings;
    for (const p of DB.products) {
      p.cost = calcCost(p.supplyPrice || 0, p.productDC || 0);
      p.priceA = Math.round(p.cost / (1 - (s.marginA || 0) / 100));
      p.priceRetail = Math.round(p.cost / (1 - (s.marginRetail || 0) / 100));
      p.priceNaver = Math.round(p.cost / (1 - (s.marginNaver || 0) / 100));
      p.priceOpen = Math.round(p.cost / (1 - (s.marginOpen || 0) / 100));
    }
    save(KEYS.products, DB.products);
  }

  function applySettings() {
    DB.settings.rebateQ = Number(rebateQ) || 0;
    DB.settings.rebateY = Number(rebateY) || 0;
    DB.settings.marginA = Number(marginA) || 0;
    DB.settings.marginRetail = Number(marginRetail) || 0;
    DB.settings.marginNaver = Number(marginNaver) || 0;
    DB.settings.marginOpenPower = Number(marginOpenPower) || 0;
    DB.settings.marginOpenHand = Number(marginOpenHand) || 0;
    save(KEYS.settings, DB.settings);

    recalcAll();
    toast("설정이 적용되었습니다 (전체 재계산 완료)");
    onApply();
    onClose();
  }

  function resetSelected() {
    const selected = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    if (selected.length === 0) { toast("초기화할 항목을 선택하세요"); return; }
    if (!confirm(`선택한 ${selected.length}개 항목을 초기화하시겠습니까?`)) return;

    for (const key of selected) {
      const storageKey = (KEYS as any)[key];
      if (storageKey) {
        localStorage.removeItem(storageKey);
        if (key === "products") DB.products = [];
        else if (key === "settings") DB.settings = {} as any;
        else if ((DB as any)[key] !== undefined) (DB as any)[key] = Array.isArray((DB as any)[key]) ? [] : {};
      }
    }
    toast(`${selected.length}개 항목이 초기화되었습니다`);
    setChecked({});
  }

  function resetAll() {
    if (!confirm("정말 전체 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    for (const key of Object.values(KEYS)) {
      localStorage.removeItem(key);
    }
    toast("전체 데이터가 초기화되었습니다. 새로고침됩니다.");
    setTimeout(() => location.reload(), 1000);
  }

  return (
    <div className={`modal-bg ${show ? "show" : ""}`} onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>설정</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {/* Tabs */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${tab === "settings" ? "active" : ""}`}
              onClick={() => setTab("settings")}
            >
              설정
            </button>
            <button
              className={`tab-btn ${tab === "data" ? "active" : ""}`}
              onClick={() => setTab("data")}
            >
              데이터관리
            </button>
          </div>

          {/* Tab 1: 설정 */}
          {tab === "settings" && (
            <div className="settings-content">
              <h4>① 밀워키 리베이트</h4>
              <div className="form-grid cols-2">
                <div className="form-field">
                  <label className="label">분기 리베이트 (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={rebateQ}
                    onChange={(e) => setRebateQ(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="label">연간 리베이트 (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={rebateY}
                    onChange={(e) => setRebateY(e.target.value)}
                  />
                </div>
              </div>

              <h4>② 채널별 목표 이익률</h4>
              <div className="form-grid cols-2">
                <div className="form-field">
                  <label className="label">A (도매) (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={marginA}
                    onChange={(e) => setMarginA(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="label">소매 (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={marginRetail}
                    onChange={(e) => setMarginRetail(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="label">스토어팜 (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={marginNaver}
                    onChange={(e) => setMarginNaver(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="label">오픈마켓 전동 (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={marginOpenPower}
                    onChange={(e) => setMarginOpenPower(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="label">오픈마켓 수공구 (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={marginOpenHand}
                    onChange={(e) => setMarginOpenHand(e.target.value)}
                  />
                </div>
              </div>
              <p className="form-info">
                채널별 판매가 = 원가 / (1 - 이익률/100). 스토어팜/오픈마켓은 수수료가 포함된 이익률을 설정하세요.
              </p>
            </div>
          )}

          {/* Tab 2: 데이터관리 */}
          {tab === "data" && (
            <div className="data-content">
              <div className="warning-banner">
                ⚠️ 데이터 초기화는 되돌릴 수 없습니다. 신중하게 선택하세요.
              </div>

              <div className="checkbox-list">
                {DATA_KEYS.map(({ key, label }) => (
                  <label key={key} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!checked[key]}
                      onChange={() => toggleCheck(key)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="data-actions">
                <button className="btn-secondary" onClick={resetSelected}>
                  선택 항목 초기화
                </button>
                <button className="btn-danger" onClick={resetAll}>
                  전체 초기화
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          {tab === "settings" && (
            <button className="btn-primary" onClick={applySettings}>적용 (전체 재계산)</button>
          )}
        </div>
      </div>
    </div>
  );
}
