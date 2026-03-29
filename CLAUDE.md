# 대한종합상사 관리시스템 (daehan-platform)

## 프로젝트 구조
- 기존 HTML: public/manager/ (index.html, style.css, app.js)
- Next.js: src/app/ (API Routes, React 페이지)
- DB: Supabase (PostgreSQL)
- 배포: Vercel (git push → 자동 배포)

## 핵심 규칙
1. 수정 요청한 것만 수정. 다른 파일/로직 절대 변경 금지.
2. 기존 데이터 절대 삭제/초기화/변경 금지.
3. public/manager/ 파일 수정 시 기존 UI/기능 깨뜨리지 않을 것.
4. 코드는 JavaScript로 작성.
5. API 키는 코드에 직접 입력 금지 → 환경변수 사용.
6. 에러 처리(try/catch + 로그) 반드시 포함.
7. 응답은 한국어로.
8. 완료 후 반드시 git push.

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

## 네이버 커머스 API
- 인증: OAuth 2.0 (HMAC-SHA256 서명)
- 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
- Rate limit: 초당 2회
- 스토어명: 툴팩토리

## Supabase DB
- URL: 환경변수 NEXT_PUBLIC_SUPABASE_URL
- 테이블 12개: products, customers, orders, order_items, price_history, promotions, promotion_products, channel_fees, users, naver_settlements, naver_inquiries, erp_sync_log

## 디자인 시스템
- 폰트: Pretendard
- 네비 배경: #185FA5
- 섹션 헤더: #1A1D23
- 컬러: --tl-primary #185FA5, --tl-danger #CC2222, --tl-success #1D9E75, --tl-warning #EF9F27

## 환경변수 (.env.local / Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NAVER_CLIENT_ID
- NAVER_CLIENT_SECRET
- ERP_USER_KEY
- ERP_URL

## 로컬 개발 주의
- 한글 경로 이슈: Turbopack이 한글 폴더명에서 크래시
- 빌드 테스트: /tmp에 복사 후 next build
- Vercel 배포는 영문 경로이므로 문제없음

## 라우트 구조
- / → 메인 대시보드
- /manager/index.html → 기존 HTML 관리시스템
- /catalog → 밀워키 단가표 (React 버전)
- /orders → 발주
- /setbun → 세트및분해
- /general → 일반제품 단가표
- /estimate → 검색 및 견적
- /sales → 온라인판매 관리
- /settings → 설정
- /api/erp/* → 경영박사 API (서버사이드)
- /api/naver/* → 네이버 API (서버사이드)

## API 문서 위치
- 경영박사 ERP API: docs/경영박사_API.md
- 네이버 커머스 API: docs/네이버_커머스_API.md
- ERP/네이버 관련 작업 시 반드시 해당 문서를 읽고 참고할 것.
