export default function EstimatePage() {
  return (
    <div>
      {/* 제품 검색 */}
      <div className="section">
        <div className="section-header">
          <span>제품검색</span>
        </div>
        <div className="section-body" style={{ padding: 12 }}>
          <input
            className="input"
            placeholder="코드, 모델명, 제품설명 검색..."
            style={{ maxWidth: 500, marginBottom: 12 }}
          />
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}></th>
                  <th>코드</th>
                  <th>제품설명</th>
                  <th>모델 및 품명</th>
                  <th>도매(A)</th>
                  <th>스토어팜</th>
                  <th>오픈마켓</th>
                  <th className="center">IN</th>
                  <th className="center">OUT</th>
                  <th className="center">파레트</th>
                  <th>매입원가</th>
                  <th>마진금액/마진율</th>
                  <th>비고</th>
                  <th style={{ minWidth: 120 }}>입고날짜</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={14}>
                    <div className="empty-state">
                      <p>🔍 검색어를 입력하세요</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 견적서 작성 */}
      <div className="section">
        <div className="section-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn-action">+ 새견적서</button>
            <span>견적서 작성 — <span style={{ color: "#EF9F27" }}>-</span></span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn-action-sub">📋 견적서목록 <span style={{ fontSize: 11 }}>0건</span></button>
            <button className="btn-action">저장</button>
            <button className="btn-export">📄 PDF 미리보기</button>
          </div>
        </div>
        <div className="section-body" style={{ padding: 12 }}>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
            <div className="form-field">
              <label className="label">공급받는자 (거래처)</label>
              <input className="input" placeholder="거래처명 또는 사업자번호 검색..." />
            </div>
            <div className="form-field">
              <label className="label">견적 날짜</label>
              <input className="input" type="date" />
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>코드</th>
                <th>모델 및 품명</th>
                <th>제품설명 및 규격</th>
                <th>수량</th>
                <th>단가</th>
                <th>합계금액</th>
                <th>부가세</th>
                <th>비고</th>
                <th>택배회사</th>
                <th>택배비</th>
                <th style={{ color: "#CC2222" }}>재고</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={12}>
                  <div className="empty-state">
                    <p>위 검색에서 제품을 추가하세요</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ textAlign: "right", padding: "12px 0", fontSize: 16, fontWeight: 700 }}>
            합계: <span style={{ color: "#185FA5" }}>0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
