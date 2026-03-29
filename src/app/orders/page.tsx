export default function OrdersPage() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div className="sub-tabs" style={{ marginBottom: 0 }}>
          <button className="sub-tab active">일반주문</button>
          <button className="sub-tab">프로모션</button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#1A1D23", borderRadius: 6, padding: "8px 20px" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>전동공구</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#FFF" }}>0</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#F4F6FA", borderRadius: 6, padding: "8px 20px", border: "1px solid #DDE1EB" }}>
            <span style={{ fontSize: 12, color: "#5A6070" }}>수공구</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1A1D23" }}>-</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#CC2222", borderRadius: 6, padding: "8px 20px" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>발주 합계</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#FFF" }}>0</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "4px 0", marginBottom: 12 }}>
        <button className="btn-action">전동공구</button>
        <button className="btn-action" style={{ background: "var(--tl-text-hint)" }}>수공구</button>
        <button className="btn-action" style={{ background: "var(--tl-text-hint)" }}>팩아웃</button>
        <button className="btn-action" style={{ background: "var(--tl-warning)", color: "var(--tl-text)", fontWeight: 700 }}>★ 발주서 ★</button>
      </div>

      <div className="section">
        <div className="section-header">
          <span>전동공구 발주</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-action-sub">📋 제품 불러오기</button>
            <button className="btn-action">+ 추가</button>
            <button className="btn-warning">수량 초기화</button>
          </div>
        </div>
        <div className="section-body" style={{ padding: 8 }}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}></th>
                  <th>코드</th>
                  <th>모델명</th>
                  <th>제품설명</th>
                  <th>재고</th>
                  <th>입고날짜</th>
                  <th>발주수량</th>
                  <th>공급가</th>
                  <th>공급합계</th>
                  <th>원가</th>
                  <th>원가합계</th>
                  <th>적요</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state">
                      <p>📦 데이터 연동 준비 중</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
