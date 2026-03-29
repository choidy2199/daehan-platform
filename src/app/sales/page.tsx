export default function SalesPage() {
  return (
    <div>
      <div className="sub-tabs" style={{ marginBottom: 8 }}>
        <button className="sub-tab active">온라인판매관리</button>
        <button className="sub-tab">수수료계산기</button>
      </div>

      {/* 온라인판매관리 */}
      <div className="section">
        <div className="section-header">
          <span>온라인판매관리</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-action" style={{ padding: "5px 12px", fontSize: 12 }}>밀워키 누적P 불러오기</button>
            <button className="btn-action" style={{ padding: "5px 12px", fontSize: 12 }}>+ 행 추가</button>
            <button className="btn-action-sub" style={{ padding: "5px 12px", fontSize: 12 }}>엑셀 내보내기</button>
            <button className="btn-action" style={{ padding: "5px 12px", fontSize: 12, background: "#1D9E75" }}>월 마감</button>
          </div>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #F0F2F7", display: "flex", alignItems: "center", gap: 10 }}>
            <select className="input" style={{ width: 180, height: 30, fontSize: 12, fontWeight: 600 }}>
              <option>2026년 3월</option>
            </select>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>날짜</th>
                  <th style={{ width: 60 }}>코드</th>
                  <th style={{ minWidth: 160 }}>모델</th>
                  <th style={{ width: 60 }} className="center">재고</th>
                  <th style={{ width: 80 }}>업체명</th>
                  <th style={{ width: 90 }} className="num">판매가</th>
                  <th style={{ width: 90 }} className="num">원가P</th>
                  <th style={{ width: 90, background: "rgba(29,158,117,0.08)", color: "#0F6E56" }} className="num">스토어팜</th>
                  <th style={{ width: 80, background: "rgba(29,158,117,0.08)", color: "#0F6E56" }} className="center">이익</th>
                  <th style={{ width: 90, background: "rgba(24,95,165,0.08)", color: "#0C447C" }} className="num">오픈마켓</th>
                  <th style={{ width: 80, background: "rgba(24,95,165,0.08)", color: "#0C447C" }} className="center">이익</th>
                  <th style={{ minWidth: 140 }}>프로모션</th>
                  <th style={{ width: 60 }} className="center"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={13}>
                    <div className="empty-state">
                      <p>💰 데이터 연동 준비 중</p>
                      <p style={{ fontSize: 12 }}>Supabase 연동 후 판매 데이터가 표시됩니다.</p>
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
