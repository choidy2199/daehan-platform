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
- 코드는 JavaScript로 작성 (app.js)
- public/manager/ 파일 수정 시 기존 UI/기능 깨뜨리지 않을 것
- curl 테스트 시 반드시 더미 키(test_xxx) 사용 — 실제 키 사용 금지
- 브라우저 열지 마, 이미지 분석하지 마, 코드만 수정해
- Milwaukee 카테고리 수수료: 파워툴 13%, 수공구/액세서리/팩아웃 17.6%
- Naver Npay 주문관리 수수료: 3.63%
- 가격 반올림: 소매가 1,000원 단위, 기타 채널 100원 단위 올림

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
