# 대한종합상사 관리시스템 (daehan-platform)
> 상위 폴더 CLAUDE.md의 공통 규칙이 자동 적용됩니다.

## 프로젝트 정보
- 사이트: https://daehantool.dev
- GitHub: choidy2199/daehan-platform
- 작업 폴더: ~/1.클로드/웹개발/daehan-platform
- 기술 스택: Next.js App Router + TypeScript + Tailwind + Supabase + Vercel
- Vercel: Pro 플랜, maxDuration 60초
- 로그인: admin / admin1234
- 사용자 3명: admin(Mac), hwon(Windows), jyoung(Windows) — 같은 데이터 공유

## 프로젝트 구조
- 기존 HTML: public/manager/ (index.html, style.css, app.js ~27,000줄)
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
- ~/.claude/skills/toollab-design-system/SKILL.md (디자인 시스템 단일 진리의 원천)
- public/manager/style.css의 :root 블록은 src/app/globals.css :root와 동일하게 유지 (한쪽 수정 시 양쪽 동시)

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

## ⚠️ 서버 런타임 — 절대 규칙 (2026-04-26 확정)

- 모든 API 라우트: `runtime: 'nodejs'` (기본값 포함)
- **Edge runtime 사용 금지**
- 이유: Supabase가 `ap-southeast-2`(Sydney) 리전이라 Vercel Edge 분산 네트워크에서 4배 악화 (Stage 4-3 실측: 1,990ms → 8,063ms)
- 새 API 작성 시 명시 권장:
  ```ts
  export const runtime = 'nodejs';
  export const dynamic = 'force-dynamic';
  ```
- 참고: `~/.claude/projects/-Users-choi-1---------daehan-platform/memory/supabase_edge_region_lesson.md`

## 인보이스V2 시스템 (Stage 4-5 확정 — 2026-04-26)

### 데이터 로딩 (Stage 4-2)

- **진입 전용 통합 API**: `GET /api/import-invoices/[id]/full-detail`
  - Promise.all 2 phase 병렬 (5쿼리)
  - Phase 1: invoice + items + po_headers + payments + customs
  - Phase 2: po_headers 결과로 po_items 추가 쿼리
  - 응답: `{ success, data: { invoice, items, po: {header, items}, customs, payments } }`
- 이 API는 **인보이스V2 진입 전용**. 다른 곳에서 호출 금지
- 기존 4개 API는 그대로 유지 (CRUD/재조회/수입건V2 사용 중):
  - `GET /api/import-invoices/[id]`
  - `GET/POST/PUT/DELETE /api/import-invoices/[id]/items`
  - `GET /api/import-po/by-invoice/[invoiceId]/items`
  - `GET/POST/PUT/DELETE /api/import-batches/[id]/customs-costs`

### 클라 계산 (Stage 4 B-2)

- 서버 cost-calculation API는 **인보이스V2에서 호출 금지** (deprecated)
  - 파일은 여전히 존재 (수입건V2 `_ipbat2*`에서 사용 중이라 삭제 X)
- 클라 계산 함수: `_ipinv2CalcCostLocal(input)`
  - 서버 route.ts 1:1 포팅 (확인됨)
  - 입력: `{ items, customs, payments, invoice }`
  - 출력 변수: `_ipinv2CostCalcLocal` (전역)
  - 구조: `{ totals: {...}, items: [...], can_calculate, warnings }`
  - totals: `{ supply_price, cost_alloc, vat_alloc, fob_krw, ... }`
- FOB 편집 시: **로컬 재계산만** (200ms debounce), API 호출 없음
- 배분 정합성 (Stage 5-4 Phase A 검증됨):
  - cost_alloc overflow_absorber 적용 ✓
  - vat_alloc overflow_absorber 적용 ✓
  - cost items 합 = customs cost (오차 0)
  - vat items 합 = customs vat (오차 0)

### 검증 공식 (Stage 5-3 — 절대 규칙)

**올바른 공식:**
```js
leftSide  = paymentsTotal + customsTotal;
rightSide = cost.totals.supply_price + cost.totals.vat_alloc;
diff      = leftSide - rightSide;
```

**절대 쓰지 말 것 (부가세 이중 계산 버그):**
```js
rightSide = supply_price * 1.1;  // ❌
```

이유: `supply_price`는 이미 `fob_krw + cost_alloc` 합산 상태. × 1.1 하면 VAT가 두 번 포함됨. 실제 VAT는 `vat_alloc`에 별도 배분.

좌변/우변 차이의 본질:
- `leftSide - rightSide = paymentsTotal - totalFobKrw`
- 즉 차이는 "실제 송금 KRW" - "환율 변환 KRW" = 환차 (Stage 5-4 미해결)

### 검증 뱃지 4상태 (Stage 5-2)

판정 순서 (상위 우선):
1. `!can_calculate` → `pending_payment` (회색 `#6B7280`, '— 송금 대기')
2. `customs.length > 0 && customsTotal === 0` → `pending_customs` (주황 `#F59E0B`, '🟡 통관 대기')
3. `Math.abs(diff) >= 10` → `error` (빨강 `#DC2626`, '⚠ ±N원')
4. else → `ok` (녹색 `#10B981`, '✓ 이상없음')

- CSS `data-status` 속성으로 분기
- 호버 툴팁: HTML `title` 속성 사용 (`\n` 자동 줄바꿈), `cursor: help`
- 10원 허용 오차는 Stage 5-4 결과에 따라 조정 가능
- 실제로는 USD 정수 결제 vs 인보이스 소수점 정밀 차이로 수백원 환차 발생

### 관리코드(CODE2) 처리 규약

**DB:**
- `import_invoice_items.management_code TEXT` (Stage 1 추가)
- `import_invoices.factory_name/factory_code` nullable
- 인덱스: `idx_import_invoice_items_management_code`

**API 수용:**
- `POST /api/import-invoices`: `factory_name` 필수 체크 없음 (`invoice_no + invoice_date`만 필수)
- `POST/PUT /api/import-invoices/[id]/items`: `management_code` 수용
- `POST /api/import-invoices/[id]/items/bulk`: `management_code` 수용

**PO → 인보이스 자동 생성** (`_poOpenInvoiceLink`):
- 7단계: PO GET → INV 자동증번 → invoice POST → payments → 콜라보 팔렛 → items bulk → PO linked
- 재실행 guard: `po.status === 'linked' || po.linked_invoice_id`

**UI:**
- 관리코드 없는 제품: `<span class="po-mc-empty">—</span>` 회색 대시
- 폰트: `ui-monospace, "SF Mono", Menlo, monospace`; 11~12px
- R4 "파란 동그라미" 규약 예외 (모노스페이스 식별자 컬럼)

## 컬럼 리사이즈 공통 함수

- 모든 리사이즈 가능한 테이블: `initColumnResize(tableId)` 호출
- 저장 키: `mw_colwidths_<tableId>` (자동)
- 테이블 구조: `<table id="..."><colgroup><col>...</colgroup>...</table>`
- 더블클릭 → auto-fit (내장)
- 구분바 CSS (다크 헤더):
  - `thead th + th::before` 가상요소로 세로선 (`rgba(255,255,255,0.18)`)
  - hover 시 파란색 (`rgba(130,180,255,0.7)`) 2px
  - `pointer-events: none` (드래그 핸들 z-index 우선)
- 컬럼 초기화: `localStorage.removeItem('mw_colwidths_<id>')` → 재렌더

## 외부 시스템 호출 금지 규칙

### 경영박사 ERP
- **실호출 금지** (실 데이터 훼손 위험)
- 문서: `docs/경영박사_API_매뉴얼.md`, `docs/경영박사_자동화_가이드.md`
- 라이브러리: `src/lib/erp.ts`
- ENV: `ERP_USER_KEY`, `ERP_URL` (drws20.softcity.co.kr:1448)
- 전표조회 API 없음 → 조회는 엑셀 업로드 대안

### 네이버 커머스
- NAS 프록시 경유: `115.136.19.83:3080`
- API Key: `daehan-proxy-secret-2026`

### TTI B2B
- 프레임셋 구조, ENV `TTI_LOGIN_*`

### SSG
- `eapi.ssgadm.com`, Authorization 헤더 직접

## 작업 워크플로우 원칙 (2026-04-26 재확인)

- 프롬프트는 **파일로** 전달 (채팅에 안 풀어놓기)
- 메뉴/필드는 **한글로** 지칭, 영어 식별자는 코드블록 한정
- Phase A 조사 + Phase B 실행 **분리** (백엔드/외부 시스템 시)
- 자동 검증 Claude Code 수행 (curl + grep)
- V-4 사용자 브라우저 검증만 수동
- **수입건V2(`_ipbat2*`) 별도 Stage까지 건드리지 말 것**
- UI 수정은 app.js 유지 (Next.js 재작성 금지)
- 회계 숫자 1원 오차도 안 됨 → 서버/클라 병행 비교 검증

### Dead-code 검증 교훈

함수 정의만 보고 "작동 중"이라 가정 금지. **호출 경로 + DOM 존재 확인 필수**.
- 예: `_ipinv2RenderValidationBadge()` 함수는 정의되어 있었으나 `#ipinv2-summary-bar` DOM이 어디에도 생성되지 않아 화면 미표시 (실제 렌더는 `_ipinv2RenderCombinedSummary` fallback)
- grep으로 호출 위치 + DOM ID **둘 다** 조회

## 🆕 새 메뉴 개발 원칙 (2026-04-22 확정)

### 기본 원칙

> **새 메뉴 = 무조건 Next.js / 기존 메뉴 수정 = app.js 유지**

app.js는 약 27,000줄로 이미 포화 상태. 앞으로 app.js에 새 메뉴 로직 추가 금지.
모든 신규 메뉴는 Next.js로 만들어 **한 메뉴 = 한 폴더** 구조로 독립 관리.

### 판단 기준

| 요청 유형 | 처리 방식 |
|----------|----------|
| 🆕 새 메뉴 추가 | ✅ Next.js (무조건) |
| 🆕 새 대시보드 / 리포트 | ✅ Next.js (무조건) |
| 🆕 새 외부 API 연동 메뉴 | ✅ Next.js (무조건) |
| 🔧 기존 메뉴 버그 수정 | app.js 유지 |
| 🔧 기존 메뉴 소소한 기능 추가 | app.js 유지 |
| 🔧 기존 메뉴 UI 개선 | app.js 유지 |
| 🔄 기존 메뉴 대폭 개편 | ⚠️ 협의 — Next.js 마이그레이션 검토 |

### ⚠️ "새 메뉴"와 "기존 메뉴" 판단 기준 (명확화)

모호함 방지를 위해 다음 정의 준수:

**새 메뉴 = 다음 중 하나 이상 해당**
- 사이드바/바탕화면에 신규 아이콘 추가가 필요
- 기존 `_tabIdMap`에 없는 탭 ID
- 기존 `_windowConfig`에 없는 창 이름
- 새로운 Supabase 테이블 필요 (기존 테이블 확장은 해당 없음)

**기존 메뉴 = 다음 중 하나 이상 해당**
- 이미 `_tabIdMap`에 등록된 탭
- 이미 `_windowConfig`에 등록된 창
- 기존 API 라우트(`/api/*`)에 이미 존재
- 기존 DB 테이블 사용 중

### 판단 우선순위 (충돌 시)

1. "기존 메뉴" 정의에 하나라도 해당하면 → 기존 메뉴. app.js 수정
2. 기존 메뉴의 전체 재구축이 필요한 경우 → 협의 후 Next.js 마이그레이션 결정
3. 순수 신규 기능이면 → Next.js

### 사례 (참고)

| 요청 | 판단 | 근거 |
|------|------|------|
| 백오더 등록 팝업 UI 개선 | 🔧 app.js | backorder는 `_tabIdMap`에 등록된 기존 메뉴 |
| 공지사항 관리 신규 메뉴 | 🆕 Next.js | 신규 사이드바 아이콘, 새 관리 화면 |
| 거래명세서에 새 컬럼 추가 | 🔧 app.js | transactions는 기존 메뉴 |
| 매입매출 엑셀 업로드 기능 | 🔧 app.js | 매입매출은 기존 메뉴 (신규 기능이라도 소속 메뉴가 기존이면 app.js) |
| 새로운 리포트 대시보드 | 🆕 Next.js | 완전 신규 화면 |

### 착수 전 필수 확인

Claude는 새 작업 시작 전 다음을 순서대로 확인:

1. grep으로 app.js에서 관련 메뉴 ID/함수 존재 여부 검색
2. 기존 `_tabIdMap` / `_windowConfig` 에 해당 이름 있는지 확인
3. 기존 API 라우트 존재 확인
4. 이상 3가지 중 하나라도 있으면 → 기존 메뉴, app.js 작업
5. 전부 없을 때만 → 신규 메뉴, Next.js 작업

### Next.js 신규 메뉴 표준 폴더 구조
```
src/app/manager/[메뉴이름]/
├── page.tsx              ← 메인 페이지 UI
├── components/           ← 이 메뉴 전용 컴포넌트
│   ├── Table.tsx
│   ├── Popup.tsx
│   └── ...
├── lib/                  ← 이 메뉴 전용 유틸
│   └── utils.ts
└── types.ts              ← 이 메뉴 전용 타입
```

**필요 시 추가:**
- `src/app/api/[메뉴이름]/route.ts` — 이 메뉴 전용 API

**원칙:** 한 메뉴 = 한 폴더 = 완전히 독립. 다른 메뉴 폴더 건드리지 않음.

### app.js ↔ Next.js 연결 방식 (iframe)

기존 사이드바에서 새 메뉴 클릭 시 해당 탭 영역에 iframe 삽입:
```
사이드바 메뉴 클릭
↓
app.js가 해당 탭 영역에 iframe 삽입
↓
iframe src = "/manager/[메뉴이름]"
↓
Next.js 페이지 로드
```

**장점:**
- 기존 app.js 구조 안 건드림 (사이드바 메뉴 1개 + iframe 삽입 로직만 추가)
- Next.js 페이지는 독립적으로 동작
- 로그인 세션 공유 (같은 도메인)
- 데이터 공유 (Supabase, localStorage, API 엔드포인트 전부 동일하게 접근 가능)

### 데이터 공유 (Next.js ↔ app.js)

같은 도메인(daehantool.dev)이므로 둘 다 동일하게 접근 가능:

| 자원 | 공유 방식 |
|------|----------|
| Supabase DB | `src/lib/supabase.ts` 동일 사용 |
| 로그인 세션 | 쿠키 자동 공유 |
| API 엔드포인트 | `/api/...` 직접 fetch |
| localStorage | 같은 도메인이라 공유됨 |
| 환경변수 | `.env.local` 공유 |

### 신규 메뉴 생성 체크리스트

새 메뉴 만들 때 Claude Code는 반드시 이 순서로:

1. [ ] `src/app/manager/[메뉴이름]/` 폴더 생성
2. [ ] `page.tsx` — 메인 페이지 (React 컴포넌트)
3. [ ] `types.ts` — 타입 정의
4. [ ] 필요 시 `components/`, `lib/`, `api/` 하위 폴더 생성
5. [ ] app.js의 사이드바 메뉴 배열에 신규 항목 1줄 추가
6. [ ] 해당 탭 클릭 시 iframe 삽입 로직 1곳 추가
7. [ ] `npm run build` 성공 확인
8. [ ] git commit & push
9. [ ] `https://daehantool.dev/manager/[메뉴이름]` URL 직접 접속 테스트
10. [ ] 사이드바에서 iframe 로드 테스트
11. [ ] app.js 기존 메뉴 정상 동작 확인

### 디자인 시스템 (필수)

신규 Next.js 메뉴도 기존 디자인 시스템 엄격 준수:
- `var(--tl-*)` 토큰 + shadcn alias만 사용 (하드코딩 금지)
- `src/components/ui/*.tsx` (shadcn) 최우선
- `~/.claude/skills/toollab-design-system/SKILL.md` 참조
- 세부 규칙은 "## 디자인 시스템 준수 규칙" 섹션 참조

### 금지 사항

- ❌ 새 메뉴 로직을 app.js에 추가 (예외 없음)
- ❌ 여러 메뉴가 컴포넌트/유틸을 공유 (처음엔 각 메뉴 폴더 내 독립, 반복 사용되면 그때 `src/components/shared/`로 추출)
- ❌ 기존 메뉴 iframe 연결 중 다른 메뉴 로직 수정
- ❌ Tailwind 외 CSS 프레임워크 혼용 (프로젝트 표준: Tailwind)

### 첫 Next.js 메뉴 계획 (2026-04-22 재확정)

**원칙 재확인**: 공지사항은 `_tabIdMap`에 이미 `'notice'` 탭으로 등록되어 있어
엄밀히는 "기존 메뉴"임. 그러나 현재 app.js의 공지사항 로직(약 1,000줄)은
Next.js 이전의 첫 사례로 채택됨 — 이는 **예외적 마이그레이션**으로 간주.

**첫 Next.js 마이그레이션 대상**: 공지사항 관리
- 이유: 독립적 CRUD 구조, 외부 API 연동 없음, 표준화 검증에 이상적
- 위치: `src/app/manager/notices/` (기존 `/api/notices` API는 그대로 활용)
- 선행 작업: 제품·발주 탭 커밋6 완료 후 진행
- 목적: 이 메뉴 이전 과정에서 발견한 패턴을 `~/.claude/skills/nextjs-new-menu/SKILL.md` 스킬로 정리

**향후 순수 신규 Next.js 메뉴 사례 (참고)**
- 진정한 신규 메뉴는 아직 없음
- 사이드바 신규 아이콘 + 새 테이블 조합이 나오면 그때 Next.js로 즉시 시작


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
- 콘텐츠 너비 기준 (필수)
  - 기준: 사이드바 접힌 상태(52px)에서 밀워키 단가표(#tab-catalog) 너비
  - 원칙: 모든 탭 콘텐츠는 .content의 padding: 16px 24px 8px만으로 좌우 여백 결정
  - 금지: 탭 내부에 추가 max-width, margin: 0 auto, 별도 width 제한 금지
  - 새 화면: 반드시 사이드바 접힌 상태에서 단가표와 동일한 너비인지 확인
  - 레이아웃: .app-layout(flex) → .sidebar(52/220px) + .main-area(flex:1) → .content(padding 24px) → #tab-XXX(추가 제한 없이 100%)

## 디자인 시스템 준수 규칙

### 1. 토큰만 사용
- 색상/여백/라디우스/섀도우: `var(--tl-*)` 또는 shadcn alias (`--primary`, `--destructive` 등)만 사용
- 하드코딩 금지: `#XXXXXX`, `rgb()`, px 고정값, rem 고정값
- 예외: `public/manager/*` (레거시 영역, 별도 이관 계획)
- SKILL.md 토큰 목록: `~/.claude/skills/toollab-design-system/SKILL.md` 참조

### 2. 컴포넌트 우선순위
- 신규 UI: `src/components/ui/*.tsx` (shadcn) 최우선
- shadcn에 없는 패턴: SKILL.md의 UI 패턴 섹션 참조 후 구현
- 기존 raw `<button>`, `<input>`, custom Modal: 명시적 요청 없으면 유지

### 3. SKILL.md는 단일 진리의 원천
- 우선순위: SKILL.md > globals.css > 기타
- globals.css와 SKILL.md 충돌 발견 시: **수정 전 사용자에게 보고**
- AI가 임의로 SKILL.md와 globals.css 중 한쪽을 "맞추는" 행위 금지

### 4. 작업 범위 엄수
- 요청받은 파일/섹션만 수정
- "김에 같이" 리팩터링 금지 (raw `<button>` 발견해도 건드리지 않음)
- 예상 밖 코드 발견 시 보고 후 대기

### 5. 빌드 검증
- 한글 경로 이슈 대응: `/tmp` 복사 후 `npm run build` (자세한 절차는 "## 로컬 개발 주의" 참조)
- 다음 파일 수정 시 빌드 검증 필수:
  - `src/app/globals.css` (`:root` / `@theme` / `.dark` 블록)
  - `src/components/ui/*.tsx`
  - `components.json`
  - Tailwind 관련 설정
- 빌드 실패 시: 원인 규명 전 commit/push 금지

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

- [2026-04-11] 누적 프로모션 삭제 기능
  - 카드 영역: + 버튼 아래 − 버튼 추가 (빈 프로모션만 삭제)
  - 모달 푸터: 좌측 삭제 버튼 추가 (confirm 후 개별 삭제)
  - removeCumulativePromo(): 마지막 빈 프로모션 삭제
  - deleteCumulativePromo(): confirm 후 해당 프로모션 완전 삭제 + UI 갱신

- [2026-04-11] 네이버 가격전송 품절 상품 감지 — OUT_OF_STOCK 분리 표시
  - naver.ts: PUT 400 + statusType NotValidEnum → OUT_OF_STOCK 반환 (throw 안 함)
  - API route: 품절 응답 200으로 전달 (fast path + legacy path)
  - 단건 전송(_pdPriceSync): 품절 시 주황 버튼 + 안내 알림
  - 일괄 전송: 품절 별도 카운트 (🚫 품절: N건) + 주황 사유 텍스트
  - 결과 화면 하단 품절 안내 메시지 추가

- [2026-04-11] 매출카드 월/분기 뱃지 사이즈업
  - .po-card-tag: font-size 9→12px, padding 2x6→2x8, border-radius 3→4

- [2026-04-11] 누적 할인 remark 기반 적용 — normal만 누적DC, PACKAGE/T6 등은 AR만
  - calcOrderCost: 4번째 파라미터 remark 추가, normal 아니면 누적DC 스킵
  - buildPOListPanel/savePoConfirmed/syncOrderItems: ttiPromotion 전달
  - _cumulBadgeHtml: remark가 normal 아니면 뱃지 표시 안 함
  - 매출카드 팝업: isCumul 판정에 remark 체크 추가

- [2026-04-11] 세트↔베어툴 자동 매칭 엔진 buildSetBearPairs()
  - 모델코드 마지막 하이픈 기준 세트/베어 판별 (0=베어, 그외=세트)
  - 베이스 모델명 그룹핑 → 쌍 매칭
  - pairCodes (배열): 복수 매칭 지원 (S재고/B재고 합산용)
  - productType: set/bare/unknown
  - 콘솔 리포트 (전체/매칭성공/세트만/베어만/스킵)

- [2026-04-12] 카톡 톡방관리 실제 기능 구현
  - mw_bot_rooms {rooms:[]} 객체 구조, save()+autoSyncToSupabase 적용
  - openBotRoomPopup: 추가/편집/삭제 팝업, 거래처 검색 드롭다운
  - renderBotRoomTable: 필터/검색, 담당자 뱃지, 봇 토글 즉시 반영
  - 미매핑 행 노란 배경, 행 클릭 편집, 한글 composing 처리

- [2026-04-12] 공지사항 게시판 전체 구현
  - Supabase notices 테이블 + RLS + Realtime
  - API: GET/POST/PUT/DELETE /api/notices + /api/notices/view (조회수)
  - 게시판: 목록(필터칩+검색+테이블) / 상세보기 / 작성수정 3화면
  - admin만 새글작성/수정/삭제, 📌상단고정, 새글 빨간● 표시
  - 바탕화면 우측 패널 실데이터, Realtime 자동갱신, 상단 뱃지

- [2026-04-12] 공지사항 개선 — 캐시/리디자인/댓글/알림
  - 목록 캐시: "← 목록" 즉시 표시 (fetch 제거)
  - 상세보기: 제목 22px, 본문 16px, 수정/삭제 본문 아래
  - 댓글: notice_comments 테이블 + API + 아바타/낙관적 업데이트
  - 패널 리디자인: 가로배치, NEW 깜빡임, 모두읽음
  - NEW 팝업: 최신 3건 슬라이드업, 확인/나중에
  - Realtime 자기변경 3초 무시 (_lastNoticeSyncTs/_lastCommentSyncTs)

- [2026-04-12] 공지사항 리치에디터 + 이미지 업로드
  - 작성/수정: textarea → contenteditable + B/I/U 툴바
  - Supabase Storage notices 버킷 + /api/notices/upload
  - 이미지: 파일선택/드래그앤드롭/Ctrl+V + ✕ 삭제 오버레이
  - 상세보기 img max-width/border-radius 적용

- [2026-04-12] 오류및개선 피드백 시스템
  - notices 테이블 status 컬럼 (waiting/progress/done/hold)
  - 카테고리 확장: 'improve' 추가, "오류및개선" 탭
  - 상태 필터 행 + 대기 건수 뱃지 + 상태순 정렬
  - 상태 변경 UI (admin) + 자동 댓글 로그
  - 권한 분리: admin 전체, hwon/jyoung 본인 bug/improve만
  - 상세보기 우측 사이드바 (카테고리별 필터, 다크 헤더)

- [2026-04-12] 백오더 관리 시스템
  - Supabase backorders 테이블 + API + Realtime
  - 상단 메뉴 "백오더" 추가, KPI 4카드, 필터칩(타입+상태)
  - 12컬럼 테이블: 상태/구분/모델/제품명/재고/거래처/요청/출고/비고 등
  - 입고 감지: 재고>0 + 대기/부분 → 초록배경 + "입고" 뱃지
  - 등록 팝업: 거래처/제품 자동완성, 출고 처리 (prompt 수량)

- [2026-04-21] 일반 단가표 수입가(USD) 컬럼 + 브랜드 추출 헬퍼
  - 커밋 98acf90: 일반 단가표에 수입가(USD) 컬럼 추가 (파레트 우측, 비고 좌측) + prompt 편집 + 엑셀 템플릿/업로드/내보내기 연동 (맨 끝 컬럼, 17컬럼 역호환)
  - 커밋 ebdde31: `getGenBrand(product)` 헬퍼 추가 — `mw_gen_products.category`의 "-" 앞부분 추출 (예: "HPT", "티롤릿", "콜라보", "비트맨", "다스트"). 별도 `brand` 필드 두지 않음. 미사용 `GEN_PRODUCT_BRANDS` 상수 제거

- [2026-04-21] 수입 제품 창고 UI + 수입계산기 dead code 정리 (인보이스V2/수입건V2 보존)
  - 커밋 4effa34: app.js 순감 1,887줄 (1,895 삭제 / 8 추가)
  - `_ipv2*` 블록 882줄 제거 (제품V2 전역변수 6개 + `_ipv2FetchList` + 주석 블록 2개)
  - `_po*` 정리: `_poLoadDetail`/`_poRenderDetailInfo`의 `_ipv2*` 참조 제거, `_poLoadProductsByBrand` 함수 제거. 브랜드 드롭다운은 `po.brand` 한 값만 보여주는 임시 상태 (P2-b에서 교체)
  - 수입계산기 DELETED 주석 블록 966줄 물리 제거 (3d0b6f9에서 `/* DELETED */`로 처리됐던 `_import*` / `mw_import_calcs` / `mw_import_items` 전체)
  - `_DEPRECATED_KEYS`에 `mw_cache_import_products_v2` 추가
  - `src/app/api/import-po/[id]/items/route.ts` payload에서 `product_v2_id` 필드 제거 (DB 컬럼은 유지)
  - DB 정리 (Supabase MCP 직접 실행, git 커밋 없음): `import_products_v2` 27건 + `import_po_headers` 2건 + `import_po_items` 48건 + `app_data['mw_import_calcs']` 1건 = **총 78건 삭제**. DROP/ALTER 일절 없음. 테이블 구조/FK/컬럼 전부 유지
  - **보존**: 인보이스V2 (`_ipinv2*`, ~1,810줄) + 수입건V2 (`_ipbat2*`, ~2,370줄) + `src/app/api/import-invoices/` + `src/app/api/import-batches/` + `src/app/api/import-products-v2/` (인보이스V2가 제품 검색/자동 등록에 호출 중) + `src/lib/import-v2.ts` + `src/lib/import-invoice-calc.ts`
  - 다음 단계 (P2-b): 제품·발주 탭 좌측 "제품 목록"을 `mw_gen_products` 기반으로 재설계. 브랜드 탭 필터는 `getGenBrand()` 기반

- [2026-04-22] 🆕 새 메뉴 개발 원칙 섹션 추가 — 신규 메뉴는 Next.js 원칙 확정
  - app.js 포화 상태 (27,000줄) 대응
  - Next.js 표준 폴더 구조: `src/app/manager/[메뉴이름]/`
  - app.js ↔ Next.js 연결: iframe 삽입 방식
  - 첫 테스트 메뉴: 공지사항 관리 (제품·발주 커밋6 완료 후 진행)
  - CLAUDE.md 오류 2곳 수정: 작업 폴더 경로(0. 제거), app.js 줄수(7,100→27,000)

- [2026-04-26] 인보이스V2 Stage 4-5 운영 규칙 CLAUDE.md 반영
  - **서버 런타임 절대 규칙**: Edge runtime 금지 (Supabase Sydney 리전, Stage 4-3 실측 4배 악화)
  - **데이터 로딩 (Stage 4-2)**: `GET /api/import-invoices/[id]/full-detail` 진입 전용 통합 API (Promise.all 5쿼리)
  - **클라 계산 (Stage 4 B-2)**: `_ipinv2CalcCostLocal` (서버 1:1 포팅), 서버 cost-calculation API 인보이스V2 호출 금지 (deprecated)
  - **검증 공식 (Stage 5-3)**: `paymentsTotal + customsTotal` vs `supply_price + vat_alloc` (× 1.1 절대 금지 — 부가세 이중 계산 버그)
  - **검증 뱃지 4상태 (Stage 5-2)**: pending_payment / pending_customs / error / ok (10원 허용 오차)
  - **관리코드(CODE2) 규약**: `import_invoice_items.management_code` + `factory_name` nullable + R4 모노스페이스 예외
  - 컬럼 리사이즈 공통 함수 / 외부 시스템 호출 금지 규칙 / 작업 워크플로우 원칙 / Dead-code 검증 교훈 추가
  - **미해결**: Stage 5-4 환차 처리 (사용자 결정 대기)

## 미해결 사항 (TODO)

### Stage 5-4: 환차 처리 미정 (사용자 결정 대기)

- 295원 환차 처리 미정
- 원인: USD 결제 정수 단위(72,177) vs 인보이스 소수점 정밀(72,177.20)
  - 0.2 USD × 1486 KRW ≈ 295원 환차
  - 환율 `toFixed(4)` 정밀도 기여는 약 3원
- 해결 후보:
  - (A) 우변 = `paymentsTotal + customsAll` (실 입금 기준, 자동 0원)
  - (B) 좌변 = `totalFobKrw + customsAll` (배분 기준)
  - (C) ⭐ 환차손익 별도 셀 + 검증 뱃지 USD 0.5 × 환율 이내 허용
  - (D) 기타
- claude.ai 새 채팅에서 사용자 결정 후 Phase B 프롬프트 받을 예정

## 시작 루틴 (사용자가 "시작"이라고 입력하면 실행)
1. 현재 프로젝트 폴더 확인 및 출력
2. git remote -v 로 원격 저장소 연결 상태 확인
3. git status 로 커밋 안 된 변경사항 확인
4. git log --oneline -3 으로 최근 커밋 3개 출력
5. 위 결과를 요약해서 현재 상태 브리핑

원가계산 로직 전체 조사: docs/cost-calculation-report.md 참조

## 검증 정보
- URL: https://daehantool.dev
- 로그인: admin / admin1234
- 검증 방법: 메인 CLAUDE.md의 "검증 단계" 참조
