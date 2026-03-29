export default function SetbunPage() {
  return (
    <div>
      {/* 배터리/충전기 시세 설정 */}
      <div className="section">
        <div className="section-header">
          <span>배터리 / 충전기 시세 설정</span>
          <button className="btn-action">시세 저장</button>
        </div>
        <div className="section-body" style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {/* 일반 시세 */}
            <div style={{ flex: 1, border: "1px solid var(--tl-border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ background: "#1A1D23", color: "white", padding: "0 12px", height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                <span>일반 시세</span>
                <span style={{ fontSize: 9, opacity: 0.7 }}>세트분해(일반)에 적용</span>
              </div>
              <div className="empty-state" style={{ padding: 20 }}>
                <p>데이터 연동 준비 중</p>
              </div>
            </div>
            {/* 프로모션 시세 */}
            <div style={{ flex: 1, border: "1px solid var(--tl-border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ background: "#185FA5", color: "white", padding: "0 12px", height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                <span>프로모션 시세</span>
                <span style={{ fontSize: 9, opacity: 0.8 }}>세트분해(프로모션)에 적용</span>
              </div>
              <div className="empty-state" style={{ padding: 20 }}>
                <p>데이터 연동 준비 중</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 세트 분해 분석 */}
      <div className="section">
        <div className="section-header">
          <span>세트 분해 분석</span>
          <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>0건</span>
        </div>
        <div className="section-body" style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, border: "1px solid var(--tl-border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ background: "#1A1D23", color: "white", padding: "0 12px", height: 32, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>일반</span>
                <button className="btn-action" style={{ padding: "3px 10px", fontSize: 10, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>+ 분석 추가</button>
              </div>
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>세트 코드</th><th>세트 모델명</th><th>세트 원가</th>
                    <th>베어툴 코드</th><th>베어툴 모델명</th><th>베어툴 원가</th>
                    <th>배터리+충전기</th><th>분해원가</th><th>차액</th><th>판정</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={10}><div className="empty-state"><p>분석 데이터 없음</p></div></td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ flex: 1, border: "1px solid var(--tl-border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ background: "#185FA5", color: "white", padding: "0 12px", height: 32, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>프로모션</span>
                <button className="btn-action" style={{ padding: "3px 10px", fontSize: 10, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>+ 분석 추가</button>
              </div>
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>세트 코드</th><th>세트 모델명</th><th>세트 원가</th>
                    <th>베어툴 코드</th><th>베어툴 모델명</th><th>베어툴 원가</th>
                    <th>배터리+충전기</th><th>분해원가</th><th>차액</th><th>판정</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={10}><div className="empty-state"><p>분석 데이터 없음</p></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
