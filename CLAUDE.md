# 대한종합상사 관리시스템 (daehan-platform)
> 상위 폴더 CLAUDE.md의 공통 규칙이 자동 적용됩니다.

## 프로젝트 정보
- 사이트: https://daehantool.dev
- GitHub: choidy2199/daehan-platform
- 작업 폴더: ~/1.클로드/웹개발/0.daehan-platform
- 기술 스택: Next.js App Router + TypeScript + Tailwind + Supabase + Vercel
- Vercel: Pro 플랜, maxDuration 60초
- 로그인: admin / admin1234
- 사용자 3명: admin(Mac), hwon(Windows), jyoung(Windows) — 같은 데이터 공유

## 프로젝트 구조
- 기존 HTML: public/manager/ (index.html, style.css, app.js ~7,100줄)
- Next.js: src/app/ (API Routes, React 페이지)
- DB: Supabase (PostgreSQL)
- 배포: git push → Vercel 자동 배포
- 배포 확인: curl -s -o /dev/null -w "%{http_code}" https://daehantool.dev/ 로 200 확인
- 결과 확인: open https://daehantool.dev/
- 빌드: `npm run build`
- 로컬: `npm run dev` → http://localhost:3000
- 사이트 열기: `open "https://daehantool.dev/manager/index.html"`

## 작업 전 반드시 읽을 파일
- ~/.claude/skills/web-ui-patterns/SKILL.md

## 라우트 구조
- / → /manager/index.html로 리다이렉트
- /manager/index.html → 기존 HTML 관리시스템 (메인)
- /catalog → 밀워키 단가표 (React 버전)
- /orders → 발주
- /setbun → 세트및분해
- /general → 일반제품 단가표
- /estimate → 검색 및 견적
- /sales → 온라인판매 관리
- /settings → 설정
- /api/erp/* → 경영박사 API (서버사이드)
- /api/naver/* → 네이버 API (서버사이드)

## 경영박사 ERP API
- 호출 방식: 반드시 SOAP POST (GET 불가)
- LB URL: https://drws20.softcity.co.kr:1448/WS_shop.asmx
- 환경변수: ERP_USER_KEY, ERP_URL
- 응답 파싱: diffgram → DocumentElement → Table
- 주요 메소드:
  - SelectItemUrlEnc: 품목 재고/단가 조회
  - SelectGuraeUrlEnc: 거래처 조회
  - SqlExcute: 품목/거래처 등록·수정·삭제 (Base64 SQL)
  - NewOrderOut: 매출 전표
  - NewOrderIn: 매입 전표
  - NewOrderOutPayment: 매출전표 + 입금 동시
  - NewOrderInPayment: 매입전표 + 출금 동시
- API 문서: docs/경영박사_API.md (작업 시 반드시 참고)

## 네이버 커머스 API
- 인증: OAuth 2.0 (HMAC-SHA256 서명)
- 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
- Rate limit: 초당 2회
- 스토어명: 툴팩토리
- API 문서: docs/네이버_커머스_API.md (작업 시 반드시 참고)

## Supabase
- URL: 환경변수 NEXT_PUBLIC_SUPABASE_URL
- Realtime: app_data 테이블, WebSocket, 키별 타임스탬프 필터링
- 동기화 정책: last write wins, pending sync 보호, 백그라운드 동기화
- 테이블 12개: products, customers, orders, order_items, price_history, promotions, promotion_products, channel_fees, users, naver_settlements, naver_inquiries, erp_sync_log

## 환경변수 (10개 — Vercel + .env.local 등록 완료)
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET,
ERP_USER_KEY, ERP_URL, TTI_LOGIN_ID, TTI_LOGIN_PW, TTI_LOGIN_URL
```

## 이 프로젝트 고유 규칙
- localStorage 16개+ 키 보존 필수 (절대 초기화 금지)
- save() 사용 시 autoSyncToSupabase가 자동 호출되어 Supabase에 동기화됨
- 코드는 JavaScript로 작성 (app.js)
- public/manager/ 파일 수정 시 기존 UI/기능 깨뜨리지 않을 것
- curl 테스트 시 반드시 더미 키(test_xxx) 사용 — 실제 키 사용 금지
- 브라우저 열지 마, 이미지 분석하지 마, 코드만 수정해
- Milwaukee 카테고리 수수료: 파워툴 13%, 수공구/액세서리/팩아웃 17.6%
- Naver Npay 주문관리 수수료: 3.63%
- 가격 반올림: 소매가 1,000원 단위, 기타 채널 100원 단위 올림

### CSS 우선순위 (IMPORTANT)
- inline style(app.js) > CSS class(style.css) > tag selector
- CSS만 수정하고 "완료"라고 하지 말 것 — app.js inline style이 덮어쓰면 CSS 수정은 무의미
- 스타일 변경 시 반드시 양쪽(app.js + style.css) grep 확인
- 같은 스타일 수정 2번째 요청 → inline style 덮어쓰기가 원인인지 먼저 확인

### 동기화 필수 확인
- save() 사용 확인 + Supabase 동기화 대상 목록 포함 확인
- 동기화 방식: per-key upsert 필수, full-replace 금지
- 동기화 누락 → 3명 사용자 데이터 불일치. 절대 빠뜨리지 말 것

### 프로젝트 UI 규칙
- 숫자 포맷: fmtPO 함수 사용
- 검색 자동완성: initPOAutocomplete 함수 사용
  - 2글자 이상 입력 시 매칭 목록 표시 (최대 10건)
  - 키보드 ↑↓ + Enter, 마우스 클릭 선택
  - ESC 또는 외부 클릭으로 닫힘
- 누적프로모션 할인 = 물량지원(DC) 방식: 원가 = 공급가 ÷ (1 + DC%), DC% = 혜택금액 / 기준금액 × 100
  - 절대 AR차감 방식(공급가 × (1 - %)) 사용 금지
- 텍스트 크기 통일: 모든 테이블 th 12px, td 13px
  - 좌측 패널과 우측 패널의 테이블 텍스트 크기 반드시 동일
  - 새로운 탭/기능 추가 시에도 po-table 기본 스타일 적용
  - 인라인 font-size로 개별 축소/확대 금지 (디자인 토큰 우선)

## 로컬 개발 주의
- 한글 경로 이슈: Turbopack이 한글 폴더명에서 크래시
- 빌드 테스트: /tmp에 복사 후 next build
- Vercel 배포는 영문 경로이므로 문제없음

## 참고 문서
- 프로젝트 구조 상세: app-structure.md
- 세션 키트 (함수맵, element ID): docs/daehan-session-kit.md
- 에이전트 설정: AGENTS.md

## 최근 변경사항
(작업 마무리 시 아래에 추가)
- [2026-03-31] Supabase Realtime WebSocket 동기화, per-key upsert, 헤더 동기화 버튼
- [2026-04-04] 발주 탭 리디자인 (Step B-1 ~ B-2b): 7개 서브탭, 매출카드(티어할인), 장바구니, 누적프로모션 모달, 발주리스트, FOC, calcPOSalesData 실데이터 연동
- [2026-04-04] 발주 탭 완성 + 커머셜 프로모션 + UI 전면 개선
  - tab-order-old 레거시 HTML 삭제 (366줄)
  - 커머셜 프로모션 모달 (다중프로모션 아코디언, 구간추가삭제수정, 목표금액 구간클릭 자동설정)
  - 합계 카드 커머셜P 힌트 + 매출집계 규칙 (일반주문만/전체합산)
  - T5/T6 프로모션 탭 동적 생성 (tList 기반) + T5/T6/패키지/키트 콘텐츠 구현
  - T5/T6 발주수량 제한 (설정가능) + 패키지 가능수량 초과 제한
  - 수량 Enter키 장바구니 추가 + 합계 디자인 통일 (3행) + 카드 하단정렬
  - 수공구/팩아웃 최고구간만 표시 + 기간뱃지 통일 + 발주리스트 컬럼추가
  - 스크래핑 분리 (제품/프로모션) + 프로모션 새로고침 버튼 + 타임스탬프
  - localStorage 동기화 대상 추가 (6개 키) + 공통 CLAUDE.md 생성

- [2026-04-05] Phase 4-1: TTI 자동발주 모달 + 크롬 확장 통신
  - submitPOOrder() → openAutoOrderModal() (dry-run 토글, 프로그레스 바, 주문유형별 뱃지)
  - 장바구니 subtab별 그룹핑 → postMessage → content-daehan.js → background.js 순차 발주
  - calcPOSalesData()에 dryRun 필터 추가 (dry-run 건 매출 집계 제외)
  - background.js: autoOrder/loginComplete/orderComplete 메시지 라우팅
  - content-tti.js: handleOrder() 좌측 테이블 행 매칭 → 수량 입력(td[7]) → 🛒 클릭
  - all_frames:true + 프레임 판별(_currentFrame) + _waitForTableData(15초 폴링)
  - inject-main.js (MAIN world, document_start) 플래그 관리
  - Chrome Debugger API로 confirm/alert 자동처리 (ATTACH_DEBUGGER/DETACH_DEBUGGER)
  - dry-run 토글 localStorage 저장 (mw_auto_order_dryrun)
- [2026-04-05] Phase 4-2: TTI 주문내역 스크래핑 + 발주리스트 동기화
  - scrapeOrderHistory(): order_list.html 15컬럼 파싱
  - NAVIGATE_AND_SCRAPE_ORDERS: 탭이동→로드대기→스크래핑→daehan 전달
  - syncTtiOrderHistory(): ttiOrderNo 직접매칭 + 날짜/금액 2차매칭
  - buildPOListPanel: TTI상태/액션/주문번호 3컬럼 추가 (14컬럼)
  - 취소행: 빨간배경 + 취소선, 금액: ttiOrderAmount 우선
  - ttiCancelOrder/ttiReorder: postMessage → 크롬 확장 실행 + debugger
  - TTI_ACTION_RESULT 수신 → 발주리스트 자동 새로고침

- [2026-04-08] 온라인 판매채널 수수료 5카드 UI 리디자인 + SSG 추가
  - 설정 → 수수료: 기존 4칸 flat → 5개 카드 레이아웃 (네이버/쿠팡MP/쿠팡로켓/G마켓옥션/SSG)
  - 카드별 수정/저장 독립 토글, 항목 추가/삭제, SSG 제휴연동 토글
  - 데이터 마이그레이션: 기존 flat → mw_channel_fees channels 구조
  - 수수료 호환 레이어: getChannelFeeRate(channel, category), getCoupangLogistics(size)
  - SSG flat 키: ssgElecFee/ssgHandFee (카테고리별 분리, 기본 13%)
  - syncChannelFeesToSettings() — 기존 함수(buildRow, calcCost 등) 영향 없음
- [2026-04-08] 밀워키/일반제품/검색및견적 SSG 컬럼 + 마켓 가격 뱃지
  - 3개 단가표 테이블에 SSG 컬럼 추가 (오픈마켓 오른쪽)
  - recalcAll: SSG 판매가 역산 (ssgElecFee/ssgHandFee + mkSsgElec/mkSsgHand 마크업)
  - 설정 모달: SSG 마크업 입력칸 추가 (전동/수공구 별도)
  - 스토어팜/오픈마켓/SSG 셀 → marketBadge 채널별 컬러 뱃지 (클릭 가능)
  - openPriceDetail 팝업: 수수료 분해 (판매가-VAT-수수료=정산) + 가격 변동 이력
  - mw_price_history: recalcAll 시 가격 변동 자동 감지/저장 (1년/10,000건 제한)
  - Supabase 동기화: mw_channel_fees, mw_price_history

- [2026-04-09] 발주 대시보드 매출카드 전면 리디자인
  - 매출카드 레이아웃: 좌/우 Grid → 1행 섹션박스 (일반매출 3카드 + 누적프로모션 N카드)
  - 섹션 헤더 다크 배경 (#1A1D23), 금액 22px, 정보 11px
  - 카드 row1~row5 고정 높이 구조 → 7카드 가로 라인 정렬
  - 합계 가로 바 → 합계+탭/뱃지 가로 통합 (po-top-row)
  - 서브탭 7개 → 2개로 축소 (일반주문 + 발주 리스트)
  - 요약바 제거 → 탭 옆 요약뱃지 5개로 통합
  - 발주리스트 헤더: ↻ 밀워키 주문내역 동기화(빨간) + ↻ 경영박사 매입전표 등록(파란) 버튼

- [2026-04-09] TTI 주문내역 Remark 기반 자동분류 + 프로모션 크롤링 제거
  - 크롬 확장: 프로모션 스크래핑 4함수 + background.js 프로모션 블록 160줄 제거
  - content-tti.js: _setOrderDateRange() 날짜 범위 설정 함수 추가
  - content-daehan.js: DAEHAN_SCRAPE_ORDER_HISTORY 핸들러 추가
  - syncTtiOrderHistory(): 미매칭 TTI 주문 → 새 mw_po_history 엔트리 자동 생성
  - Remark 분류: normal→일반주문, M코드→프로모션, 0원→FOC
  - startTtiOrderSync(): 이번달 1일~오늘 범위 동기화
  - 동기화 타임스탬프: mw_order_sync_time

- [2026-04-09] 네이버 커머스 API 상품 조회/가격 수정 연동
  - src/lib/naver.ts: getNaverProducts(), updateNaverPrice(), findNaverProductByCode()
  - src/app/api/naver/products/route.ts: GET(상품 조회, ?code= 판매자코드 단건), PUT(가격 수정)
  - updateNaverPrice: 채널상품 전체 조회→salePrice/discountedPrice 변경→PUT 전체 전송
  - findNaverProductByCode: 전체 상품 캐시(Map) + sellerManagementCode 정확 매칭 (API 부분매칭 문제 해결)
  - channelProductNo 직접 전달 방식으로 재검색 오매칭 방지

- [2026-04-09] 밀워키 단가표 편집 모드 전면 리디자인
  - 헤더 버튼: [제품등록및수정] | [⚙ 설정] [✎ 수정/저장] 3개로 통합
  - 제품등록및수정 팝업: 탭 3개 (가져오기/내보내기/+제품등록), 기존 모달 통합
  - 편집 모드: No. 컬럼 ↔ 체크박스 in-place 교체 (컬럼 수 불변, 헤더 정렬 유지)
  - 액션바: 검색바 우측 인라인 (선택수정/선택삭제/단종처리/가격전송)
  - 전체 행 렌더링: active.slice(0,500) 제한 해제, 편집 모드 시 전체 DOM 렌더링
  - 선택수정: 제품별 탭 팝업 (9필드 3열 그리드), _mwBulkTabReady 플래그로 첫 탭 빈값 방지
  - 선택삭제: confirm → DB.products filter → recalcAll → save
  - 단종처리: confirm → discontinued='단종' → 테이블 하단 이동
  - 가격전송: 마켓 선택 팝업 → 프로그레스 바 → 네이버 API 순차 전송 (2초 RPS) → 결과 화면
  - 제품 식별: code→DB.products 인덱스(data-idx) 기반으로 전환

- [2026-04-09] UI 개선
  - 필터탭(전체제품/재고있음 등)을 다크 헤더 바 안으로 이동 (.mw-filter-tab)
  - 테이블 레이아웃: table-layout:fixed + 컬럼 너비 고정 (모델명만 가변)
  - 테이블 확장: .content flex column + .tab-content flex:1 + .section-body overflow 수정
  - 테이블 헤더 sticky: JS translateY 제거 → 순수 CSS position:sticky 통일
  - 모달 드래그: _makeDraggable 범용 헬퍼 (제품수정/설정/가격전송 팝업 적용)
  - 제품 저장 후 input 필드 자동 초기화

- [2026-04-09] 가격 상세 팝업 리디자인 + 가격수정/가격전송 역할 분리
  - openPriceDetail: 헤더에 ▲가격전송/판매관리/가격수정 버튼 3개 추가 (3개 마켓 공통)
  - 가격수정 모드: 변경가 입력 → 실시간 VAT/수수료/정산/마진/마크업 재계산 (_pdCalcLive)
  - _pdApplyPrice: 로컬만 저장 (DB.products + mw_price_history + renderCatalog + _pdCancelEdit)
  - _pdPriceSync: 네이버 API 단건 전송 (전송중/전송완료✓/전송실패 3초 UI + 마켓명 매핑)
  - 가격수정 모드 중 ▲가격전송/판매관리 비활성화 → _pdCancelEdit 시 복원
  - 팝업 드래그(_makeDraggable) + max-height calc(100vh-100px) 반응형
  - 하단 "확인" 버튼 3개 마켓 통일
  - 가격 적용 후 편집모드+체크박스 인덱스 저장/복원 (renderCatalog 후 toggleMwEditMode 재진입)

- [2026-04-09] 네이버 API 속도 개선 + 측정 로그
  - getAccessToken: 토큰 3시간(90%) 캐싱 (_cachedToken/_cachedTokenExpiresAt)
  - naverApi: skipRateLimit 옵션 추가 → 단건 경로에서 550ms 대기 제거
  - updateNaverPrice: fast 옵션으로 GET/PUT 모두 rateLimit 스킵
  - _ensureNaverCodeMap: 중복 rateLimit 제거 (naverApi 내부에만 유지) → 캐시 로드 시간 절반
  - updateNaverPrice: 검증용 재조회 GET 제거 (PUT 후 불필요한 2차 조회)
  - PUT /api/naver/products: {code, newPrice} 단건 최적화 경로 추가 (findByCode→update 일괄 처리)
  - [PERF] 측정 로그: token cache HIT/MISS, codeMap 상태, naverApi 단계별 latency (Vercel 로그)

- [2026-04-09] 마켓 뱃지/헤더 색상 통일 + 데이터 레이아웃
  - _marketBadgeStyles: priceColor + border 필드 추가 (naver/gmarket/ssg)
  - marketBadge: 마켓명 텍스트 제거 + 금액 15px 진한색 + 마진 11px + 1px border
  - SSG 색상: #FEF3C7 → #FDF6E3 + #D4A843 border + #7A5C00 진한 골드
  - index.html: 밀워키/일반제품/검색및견적 3개 테이블 헤더 th 배경 통일
    - 스토어팜 #1D9E75, 오픈마켓 #185FA5, SSG #B8860B (텍스트 #fff)
  - buildRow: _costP 계산 상단 리팩터링 → 원가P/A(도매) 셀에서 재사용
  - 원가P 컬럼: 공급가 대비 마진%/차이금액 표시 (음수 빨강)
  - A(도매) 컬럼: 원가P 대비 마진%/차이금액 (원가P 없으면 원가 대비)

- [2026-04-09] 발주탭 제품/주문목록 테이블 스타일 통일
  - .po-table 공통 CSS: th 12px/600 #EAECF2 + td 13px/400 #1A1D23 + hover #F4F6FA
  - th sticky top:0 z-index:10 + box-shadow로 border-bottom 대체
  - 주문목록 구조 변경: .po-panel overflow 제거 + .po-table-wrap → .po-panel-body 교체
  - .po-panel-header/.po-register-row/.po-summary flex-shrink:0 (스크롤 바깥 고정)

- [2026-04-10] 발주탭 서브탭 3개 + 상단바 리디자인
  - 서브탭 3개로 변경: 일반주문 / 발주리스트(placeholder) / 밀워키 발주확정
  - _poSubTabs 재정의 + legacy 'list'→'confirmed' 마이그레이션
  - po-content-list → po-content-confirmed 5곳 rename
  - 상단바 1줄 통합: 빨간 합계카드(#C0392B) + 서브탭 + spacer + stats 뱃지 5개
  - 합계 카드 3섹션 (총매출/반월별/커머셜P) + 노란 #FFD93D 강조
  - .po-action-compact 제거 + .po-top-spacer(flex:1)로 우측 정렬
  - 섹션 헤더 다크바 신규 추가/삭제 (1차 추가 → 2차 정리)

- [2026-04-10] 메인 메뉴 전면 리디자인 + 디버그 로그 정리
  - .nav-tabs → .main-nav 전면 교체 (4그룹 + 솔로 + spacer + 설정)
  - 그룹 라벨: 밀워키 #A32D2D / 일반 #B8860B / 판매관리 #534AB7 / 수입제품 #0F6E56
  - _tabIdMap (신규 id → contentId/render) + _legacyTabIdMap 호환
  - placeholder 탭 6개 신규 (.tab-placeholder)
  - savedTab 복원 로직 + switchTab 전면 재작성
  - [DEBUG updateNaverPrice] 6개 + [DEBUG PUT] 2개 삭제 ([PERF] 30개 유지)
  - 우측 상단: 동기화 배지 삭제, 재고가져오기 → 📦 경박 + 빨간 #A32D2D
  - 관리자님/로그아웃 삭제 (doLogout 함수는 보존)

- [2026-04-10] 메뉴 사이즈업 + 검색/공지사항/택배/카톡 컬러 뱃지
  - .main-nav padding 6x16, gap 6px, 그룹 라벨 13/700 padding 8x14
  - .nav-sub 13px padding 8x10, .nav-sep height 24 margin 0 6
  - .nav-setting 강조 (bg rgba(255,255,255,0.12), 13/600, padding 8x16)
  - 검색/공지사항: .nav-solo → .nav-group-label + .nav-search(#185FA5)/.nav-notice(#854F0B)
  - 택배 신규 (.nav-delivery #5F5E5A, placeholder)
  - 💬 카톡 신규 (.nav-kakao #F7E600/#3B1E1E, placeholder)
  - 공지사항 위치 이동 (좌측 → 우측 spacer 직후)
  - 📦 경박 .header-inv-sync → .main-nav 내부 .nav-kb (right end)
  - .nav-group-label에 line-height:1+inline-flex+align-items:center (이모지 높이 통일)
  - switchTab/savedTab 셀렉터 .main-nav [data-tab] 통일

- [2026-04-10] Phase 1: TTI 아이템별 주문내역 스크래핑 엔진 (크롬 확장)
  - content-tti.js: scrapeOrderListSub() 15컬럼 파싱 함수
  - order_list_sub_new.html URL 감지 + SCRAPE_ORDER_LIST_SUB 리스너
  - background.js: NAVIGATE_AND_SCRAPE_ORDER_ITEMS 핸들러
    · TTI 탭 query → 없으면 chrome.tabs.create (daehan 탭 절대 이동 금지)
    · order_list_sub_new.html?...&num_per_page=300 URL 조합
  - content-daehan.js: DAEHAN_SCRAPE_ORDER_ITEMS 릴레이 + TTI_ORDER_ITEMS_DATA 수신
  - 데이터 흐름: app.js → daehan → bg → tti → scrape → bg → daehan → app.js

- [2026-04-10] Phase 2: app.js TTI 아이템별 주문내역 수신/저장/표시
  - buildPOListPanel 헤더에 날짜 input 2개 (mw_po_items_date_from/to)
  - startTtiOrderItemsSync() 신규 (DAEHAN_SCRAPE_ORDER_ITEMS postMessage)
  - syncOrderItems() 신규: ttiOrderItemKey(orderNo+|+정규화코드)로 중복 체크
    · 18개 tti* 필드 (Promotion/ItemType/Brand/Month/UnitPrice/SupplyPrice/Dealer/SalesRep)
    · type/subtab 분류: 일반→normal, T6→promo-t6, PACKAGE→promo-package
    · DB.products 매칭 → manageCode/code/model/category 보정
  - 구분 컬럼 ttiPromotion 기반 4색 뱃지 (일반/T6/PACKAGE/기타)
  - changePOListFilter 드롭다운 → 날짜 input 자동 연동 (today/week/month)

- [2026-04-10] 발주확정 테이블 폴리싱 + 컬럼 표시 설정
  - panel-body inline padding:0 (다크 헤더와 테이블 헤더 밀착 + 풀폭)
  - 테이블 id="po-list-table" + initColumnResize 6곳 호출 추가
  - #po-list-table 전용 .col-resize 핸들 CSS (z-index 11)
  - 구분 뱃지 사이즈업 (12px/4x10/600/radius4)
  - 대분류 컬럼 신규 (구분 옆) + mw_products 매칭 + 4색 카테고리 뱃지
    · 파워툴/수공구/팩아웃/드릴비트 (밀워키 단가표 getCategoryColor 동일)
  - ⚙ 컬럼 표시 설정 드롭다운 (저장 버튼 우측)
    · 14컬럼 체크박스 + po_confirm_visible_cols localStorage
    · 동적 <style id="po-col-vis-style"> 갱신 + display:none !important
    · 외부 클릭 닫힘 + 페이지 로드 시 자동 복원
  - 💾 저장 버튼 신규 (savePoConfirmed placeholder, Phase 3 대기)

## 시작 루틴 (사용자가 "시작"이라고 입력하면 실행)
1. 현재 프로젝트 폴더 확인 및 출력
2. git remote -v 로 원격 저장소 연결 상태 확인
3. git status 로 커밋 안 된 변경사항 확인
4. git log --oneline -3 으로 최근 커밋 3개 출력
5. 위 결과를 요약해서 현재 상태 브리핑

원가계산 로직 전체 조사: docs/cost-calculation-report.md 참조
