# daehan-platform 세션 시작 키트
> 새 claude.ai 채팅 시작할 때 이 파일을 업로드할 것
> 마지막 업데이트: 2026-03-31

---

## 1. 프로젝트 기본 정보

- **사이트**: https://daehantool.dev
- **GitHub**: choidy2199/daehan-platform
- **작업 폴더**: ~/1.클로드/앱\ ,웹개발/0.daehan-platform
- **기술 스택**: Next.js App Router + TypeScript + Tailwind + Supabase + Vercel
- **Vercel**: Pro 플랜, maxDuration 60초
- **로그인**: admin / admin1234
- **사용자 3명**: admin, hwon, jyoung (같은 데이터 공유)

---

## 2. 워크플로우

```
claude.ai(PM/설계) → 프롬프트 작성 → 사용자가 Claude Code에 복붙
→ Claude Code가 CLAUDE.md 읽고 코드 수정 → build → git push → Vercel 배포
→ 사용자가 daehantool.dev에서 확인 → PASS/FAIL
```

### 프롬프트 구조 (반드시 이 순서)
1. 현재 상태 (정확한 파일 위치, 라인 번호 포함)
2. 수정 전 확인 (Claude Code가 먼저 파악할 것)
3. 변경 요청
4. 상세 요구사항 (정확한 element ID, 함수명 명시)
5. 수정 파일 목록
6. 건드리지 않을 것
7. 빌드 & 배포
8. 검증 체크리스트

---

## 3. CLAUDE.md 규칙 요약

### 수정 전
- 이해 안 되면 무조건 질문
- 수정 범위 먼저 확인

### 수정 중
- 요청한 부분만 수정, 다른 로직/함수/스타일 절대 변경 금지
- 이미 동작하는 기능 건들지 말 것
- 중복 코드 발견해도 먼저 물어볼 것

### 수정 후
- 변경사항 체크리스트 + "변경하지 않은 것" 목록 표시
- npm run build → git push → Vercel 배포

### 디자인 규칙
- 버튼: btn-primary 기본, 어두운 배경 안 버튼은 배경색 명시
- btn-secondary/btn-ghost는 어두운 배경에서 사용 금지
- 테이블: 헤더-본문 셀 정렬 동일, 헤더 컬럼 너비 조절 가능

---

## 4. 파일 구조

```
0.daehan-platform/
├── public/manager/
│   ├── index.html          ← 메인 HTML (정적 input, 레이아웃)
│   ├── style.css           ← 스타일
│   ├── app.js              ← 핵심 로직 (~7,000줄)
│   └── daehanrogo.png
├── src/app/
│   ├── login/page.tsx
│   ├── api/auth/(login|check|logout|users)
│   ├── api/erp/(stock|customers|order-out|test-wsdl)
│   ├── api/sync/(upload|download|save)
│   └── api/products/(route|bulk)
├── src/lib/
│   ├── erp.ts              ← 경영박사 API (SOAP)
│   ├── naver.ts            ← 네이버 커머스 API
│   ├── supabase.ts         ← Supabase 클라이언트
│   ├── db.ts
│   └── calc.ts
├── CLAUDE.md               ← Claude Code 작업 규칙
└── AGENTS.md
```

---

## 5. app.js 핵심 함수 맵

### 동기화 관련 (라인 71~374)
| 함수 | 라인 | 역할 |
|------|------|------|
| autoSyncToSupabase(key) | 71 | 5초 debounce 자동 업로드 |
| updateSyncStatus(text) | 91 | 동기화 상태 표시 업데이트 |
| forceUploadAll() | 138 | 헤더 동기화 버튼 클릭 시 강제 업로드 |
| uploadAllToSupabase() | 181 | 설정 탭 업로드 버튼 클릭 시 업로드 |
| loadFromSupabase() | 235 | Supabase에서 다운로드 |
| initSupabaseRealtime() | 282 | Realtime WebSocket 구독 |
| realtimeDownloadAndRefresh() | 329 | 다른 사용자 변경 시 자동 다운로드 |
| refreshActiveTab() | 374 | 현재 탭 UI 새로고침 |

### 핵심 기능 (라인 424~)
| 함수 | 라인 | 역할 |
|------|------|------|
| saveAll() | 424 | 전체 localStorage 저장 |
| renderCatalog() | 1047 | 밀워키 단가표 렌더링 |
| switchTab(tab) | 708 | 탭 전환 |
| init() | 6774 | 페이지 초기화 (최초 로드) |
| searchProducts(query) | 613 | 제품 검색 |
| showAC(inputEl, callback) | 621 | 자동완성 드롭다운 |

### 주문/견적/판매 (라인 975~)
| 함수 | 라인 | 역할 |
|------|------|------|
| renderOrderSheet() | 975 | 발주서 렌더링 |
| confirmOrder() | 1567 | 발주 확정 |
| renderPoOrder() | 2003 | 프로모션 발주 렌더링 |
| registerOrderOut() | 5822 | 전표 등록 (경영박사 API) |
| handlePurchaseInvoice() | 6257 | 매입전표 처리 |

### 설정/초기화 (라인 6774~)
| 함수 | 라인 | 역할 |
|------|------|------|
| init() | 6774 | 페이지 초기화 |
| 업로드 버튼 생성 | 6855 | id: btn-supabase-upload |
| importErpCustomers() | 7094 | 경영박사 거래처 가져오기 |

---

## 6. 핵심 Element ID 목록

### 헤더
| ID | 용도 |
|---|---|
| header-sync-btn | 헤더 동기화 상태 버튼 |
| header-sync-icon | 동기화 아이콘 (SVG) |
| header-sync-text | 동기화 텍스트 ("동기화 완료 · HH:MM") |
| current-user-name | 로그인 사용자명 |
| sync-status | 설정 탭 동기화 상태 |

### 검색 Input
| ID | 위치 | HTML 라인 |
|---|---|---|
| catalog-search | 밀워키 단가표 검색 | index.html:85 |
| gen-search | 일반제품 검색 | index.html:739 |
| est-search | 견적 검색 | index.html:758 |
| est-client | 견적 거래처 검색 | index.html:810 |
| client-search | 거래처 검색 | index.html:947 |
| picker-search | 제품 선택 팝업 검색 | index.html:1783 |

### 버튼
| ID | 위치 | 용도 |
|---|---|---|
| btn-supabase-upload | 설정 탭 서브탭 | Supabase 업로드 |
| btn-sync-inventory | 헤더 | 재고가져오기 |

---

## 7. localStorage 키 (16개+)

mw_products(815건), mw_gen_products(234건), mw_customers(2465건),
mw_inventory, mw_promotions, mw_settings, mw_rebate,
mw_orders, mw_po_orders, mw_spot_orders, mw_sales_items,
mw_action_history, mw_invoice_today, mw_auto_order_today,
mw_purchase_invoice_today, session_token, current_user

---

## 8. 기술 결정사항

- 경영박사 API: SOAP POST만 가능, SOAPAction 헤더 필수
- CORS: 브라우저→ERP 직접 호출 불가, 서버사이드 API Routes 필수
- HashMap: Array.find() → O(1) 변환 완료
- 가상 스크롤: 초기 50행, 스크롤 시 100행씩 추가
- Supabase Realtime: app_data 테이블, WebSocket 실시간 동기화
- 동기화 정책: last write wins, 페이지 로드 시 서버 기준 다운로드
- 폰트 6단계: XS(10px), S(11px), M(12px), Base(13px), L(15px), XL(18px+)

---

## 9. 환경변수 (10개 — 전부 등록 완료)

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET,
ERP_USER_KEY, ERP_URL, TTI_LOGIN_ID, TTI_LOGIN_PW, TTI_LOGIN_URL
```

---

## 10. 현재 상태 / 남은 작업

### 완료 ✅
- Next.js + Supabase + Vercel 전체 세팅
- 로그인, 설정, 거래처, 재고연동, 견적서, 판매, 발주
- Supabase Realtime 실시간 동기화
- 헤더 동기화 상태 버튼 (● 동기화 완료 · HH:MM)
- 페이지 로드 시 서버 기준 자동 다운로드
- Vercel 환경변수 10개 전부 등록

### 미해결 버그 🔴
- 설정 탭 업로드 버튼 disabled 고정 (클릭 불가)
- 검색 input Chrome 패스워드 매니저 드롭다운 (autocomplete="off" 무시)

### 남은 작업 📋
- 크롬 확장 3단계 (daehantool.dev ↔ TTI 연동)
- 검색 input debounce 300ms
- URL → `/` 만 표시 (rewrite)
- PDF 사용가이드 한글 깨짐
- 매입매출 엑셀 업로드
- 거래명세서 PDF
- 네이버 커머스 연동
- 카카오톡 자동화

---

## 11. 이 파일 업데이트 방법

매 작업 세션 종료 시:
1. 완료된 작업을 "완료 ✅"로 이동
2. 새로운 버그를 "미해결 버그 🔴"에 추가
3. app.js 함수가 추가/변경되면 "함수 맵" 업데이트
4. Claude Code에 아래 명령 실행:
```
grep -n "function " public/manager/app.js | head -100 > app-functions.txt
```
