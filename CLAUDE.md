# 대한종합상사 관리시스템 (daehan-platform)

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

### localStorage 동기화 규칙
- 새로운 mw_ 접두사 localStorage 키를 추가할 때, 반드시 save() 함수를 사용할 것 (localStorage.setItem 직접 사용 금지)
- save() 사용 시 autoSyncToSupabase가 자동 호출되어 Supabase에 동기화됨
- 새 키 추가 시 동기화 대상 목록에 포함되었는지 반드시 확인
- 모든 사용자(admin/hwon/jyoung)와 모든 브라우저/기기에서 항상 동일한 데이터가 유지되어야 함
- 코드는 JavaScript로 작성 (app.js)
- public/manager/ 파일 수정 시 기존 UI/기능 깨뜨리지 않을 것
- curl 테스트 시 반드시 더미 키(test_xxx) 사용 — 실제 키 사용 금지
- 브라우저 열지 마, 이미지 분석하지 마, 코드만 수정해
- Milwaukee 카테고리 수수료: 파워툴 13%, 수공구/액세서리/팩아웃 17.6%
- Naver Npay 주문관리 수수료: 3.63%
- 가격 반올림: 소매가 1,000원 단위, 기타 채널 100원 단위 올림

### 공통 UI 규칙 (모든 작업에 적용)
1. 숫자 표시: 모든 금액/숫자는 K/M/B 축약 금지, 항상 전체 숫자 + 콤마 (예: 12,800,000원). input에 숫자 입력 시에도 콤마 자동 적용.
2. 검색창: 검색 input 생성 시 항상 실시간 검색(keyup/input 이벤트) 적용. 검색 결과는 목록 형태로 즉시 표시. autocomplete="off" 적용.
3. 삭제 기능: 리스트에서 항목 삭제 시 해당 항목 1개만 삭제. 절대 전체 삭제하지 않음. splice(index, 1) 정확히 사용.
4. 줄바꿈 방지: 뱃지, 상태표시, 버튼 텍스트에는 white-space: nowrap 적용.
5. 폰트: 모든 UI 요소 font-family: 'Pretendard', -apple-system, sans-serif. input/button/select도 동일.
6. 동기화: 새로운 mw_ localStorage 키 추가 시 반드시 save() 함수 사용, 동기화 대상 확인.
7. 디자인: 모든 UI 작업 시 디자인 스킬(SKILL.md) 먼저 참조할 것.

### 기존 UI 규칙 (호환 유지)
- 숫자 표시: 모든 금액/숫자에 콤마 포맷 필수 (fmtPO 함수 사용)
- 검색 자동완성: 모든 검색 input에 자동완성 드롭다운 적용 (initPOAutocomplete 함수)
  - 2글자 이상 입력 시 매칭 목록 표시 (최대 10건)
  - 키보드 ↑↓ + Enter, 마우스 클릭 선택
  - ESC 또는 외부 클릭으로 닫힘
- 누적프로모션 할인 = 물량지원(DC) 방식: 원가 = 공급가 ÷ (1 + DC%), DC% = 혜택금액 / 기준금액 × 100
  - 절대 AR차감 방식(공급가 × (1 - %)) 사용 금지
- 텍스트 크기 통일: 모든 테이블 th 12px, td 13px
  - 좌측 패널과 우측 패널의 테이블 텍스트 크기 반드시 동일
  - 메뉴, 목록, 패널 간 이질감 없도록 통일
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

## 시작 루틴 (사용자가 "시작"이라고 입력하면 실행)
1. 현재 프로젝트 폴더 확인 및 출력
2. git remote -v 로 원격 저장소 연결 상태 확인
3. git status 로 커밋 안 된 변경사항 확인
4. git log --oneline -3 으로 최근 커밋 3개 출력
5. 위 결과를 요약해서 현재 상태 브리핑

## 마무리 루틴 (사용자가 "마무리"라고 입력하면 실행)
1. node -c 로 수정된 .js 파일 문법 검사
2. git add -A && git commit -m "변경 요약"
3. git remote -v 로 원격 저장소 확인
   - origin이 없으면 → 사용자에게 알리고 중단 (절대 스킵 금지)
   - origin이 있으면 → git push origin main
4. push 실패 시 에러 메시지 그대로 출력하고 중단 (무시하지 않음)
5. 변경 체크리스트 출력 (파일명, 함수명, 변경내용)
6. 체크리스트 마지막 항목으로 push 성공 여부 명시 (✅ 또는 ❌)

⚠️ push 성공 없이는 작업 완료로 간주하지 않음
⚠️ remote가 없는 로컬 전용 git인 경우 반드시 사용자에게 알릴 것
