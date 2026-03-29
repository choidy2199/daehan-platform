export default function GeneralPage() {
  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span>일반제품 단가표</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>0건</span>
            <button className="btn-action-sub">📥 양식 다운로드</button>
            <button className="btn-action-sub">📤 업로드</button>
            <button className="btn-action">+ 제품 추가</button>
          </div>
        </div>
        <div className="section-body" style={{ padding: 12 }}>
          <input
            className="input"
            placeholder="코드, 모델명, 제품설명 검색..."
            style={{ maxWidth: 400, marginBottom: 12 }}
          />
          <div className="table-scroll" style={{ maxHeight: 500, overflowY: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="center" style={{ width: 40 }}></th>
                  <th>코드</th>
                  <th>관리코드</th>
                  <th>대분류</th>
                  <th>모델 및 규격</th>
                  <th>제품설명 및 품명</th>
                  <th className="num">원가</th>
                  <th className="num">도매(A)</th>
                  <th className="num">스토어팜</th>
                  <th className="num">오픈마켓</th>
                  <th className="center" style={{ width: 70, background: "#E6F1FB", color: "#0C447C" }}>IN</th>
                  <th className="center" style={{ width: 70, background: "#E6F1FB", color: "#0C447C" }}>OUT</th>
                  <th className="center" style={{ width: 70, background: "#E6F1FB", color: "#0C447C" }}>파레트</th>
                  <th>비고</th>
                  <th style={{ minWidth: 120 }}>입고날짜</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={15}>
                    <div className="empty-state">
                      <p>📑 데이터 연동 준비 중</p>
                      <p style={{ fontSize: 12 }}>Supabase 연동 후 일반제품 데이터가 표시됩니다.</p>
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
