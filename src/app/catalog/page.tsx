export default function CatalogPage() {
  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span>밀워키 전체 가격표</span>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>0건</span>
            <button className="btn-setting">⚙ 설정</button>
            <button className="btn-action">+ 제품 추가</button>
            <button className="btn-action-sub">📥 가져오기</button>
            <button className="btn-export">📤 내보내기</button>
          </div>
        </div>
        <div className="section-body">
          <div className="search-bar">
            <input
              className="input"
              placeholder="코드, 모델명, 제품설명 검색..."
              style={{ maxWidth: 300 }}
            />
            <select className="select" style={{ maxWidth: 180 }}>
              <option value="">전체 대분류</option>
            </select>
            <select className="select" style={{ maxWidth: 180 }}>
              <option value="">전체 중분류</option>
            </select>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>코드</th>
                  <th>관리코드</th>
                  <th>대분류</th>
                  <th>중분류</th>
                  <th>소분류</th>
                  <th className="center">순번</th>
                  <th>TTI#</th>
                  <th>모델명</th>
                  <th>제품설명</th>
                  <th className="num">공급가</th>
                  <th className="center">제품DC</th>
                  <th className="num">원가</th>
                  <th className="num">A(도매)</th>
                  <th className="num">소매</th>
                  <th className="num">스토어팜</th>
                  <th className="num">오픈마켓</th>
                  <th className="center">재고</th>
                  <th className="center">본사</th>
                  <th className="center">입고날짜</th>
                  <th className="center" style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={20}>
                    <div className="empty-state">
                      <p>📋 데이터 연동 준비 중</p>
                      <p style={{ fontSize: 12 }}>Supabase 연동 후 제품 데이터가 표시됩니다.</p>
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
