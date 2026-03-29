export default function SettingsPage() {
  return (
    <div>
      <div className="sub-tabs" style={{ marginBottom: 8 }}>
        <button className="sub-tab active">온라인 판매채널 수수료</button>
        <button className="sub-tab">거래처 등록</button>
      </div>

      {/* 수수료 설정 */}
      <div className="section">
        <div className="section-header">
          <span>온라인 판매채널 수수료 설정</span>
          <button className="btn-action">저장</button>
        </div>
        <div className="section-body" style={{ padding: 20 }}>
          <div style={{ background: "#E6F1FB", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#0C447C", marginBottom: 20 }}>
            여기서 설정한 수수료율은 밀워키 단가표, 일반제품 단가표, 온라인판매 관리, 검색및견적 등 모든 메뉴에서 공통 적용됩니다.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* 네이버 스토어팜 */}
            <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C73C", display: "inline-block" }} />
                네이버 스토어팜
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#5A6070", display: "block", marginBottom: 3 }}>판매수수료 (%)</label>
                  <input className="input" type="number" step="0.01" defaultValue="3.0" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#5A6070", display: "block", marginBottom: 3 }}>결제수수료 (%)</label>
                  <input className="input" type="number" step="0.01" defaultValue="3.63" />
                </div>
              </div>
            </div>

            {/* 쿠팡 마켓플레이스 */}
            <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E62341", display: "inline-block" }} />
                쿠팡 마켓플레이스
                <span style={{ fontSize: 11, fontWeight: 400, color: "#5A6070" }}>직접배송 · 결제수수료 포함</span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#5A6070", display: "block", marginBottom: 3 }}>판매수수료 (%)</label>
                  <input className="input" type="number" step="0.1" defaultValue="10.8" />
                </div>
              </div>
            </div>

            {/* 쿠팡 로켓그로스 */}
            <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E62341", display: "inline-block" }} />
                쿠팡 로켓그로스
                <span style={{ fontSize: 11, fontWeight: 400, color: "#5A6070" }}>풀필먼트 · 물류비 별도</span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#5A6070", display: "block", marginBottom: 3 }}>판매수수료 (%)</label>
                  <input className="input" type="number" step="0.1" defaultValue="10.8" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#5A6070", display: "block", marginBottom: 3 }}>물류비 (원)</label>
                  <input className="input" type="number" step="100" defaultValue="2800" />
                </div>
              </div>
            </div>

            {/* 오픈마켓 */}
            <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#185FA5", display: "inline-block" }} />
                오픈마켓
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#5A6070", display: "block", marginBottom: 3 }}>전동공구 (%)</label>
                  <input className="input" type="number" step="0.1" defaultValue="13.0" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#5A6070", display: "block", marginBottom: 3 }}>수공구 (%)</label>
                  <input className="input" type="number" step="0.1" defaultValue="17.6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
