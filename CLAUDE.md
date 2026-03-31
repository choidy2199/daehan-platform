# 대한종합상사 관리시스템 (daehan-platform)

## 프로젝트 구조
- 기존 HTML: public/manager/ (index.html, style.css, app.js)
- Next.js: src/app/ (API Routes, React 페이지)
- DB: Supabase (PostgreSQL)
- 배포: Vercel (git push → 자동 배포)
- 사이트 URL: https://daehantool.dev
- 작업 완료 후 사이트 열 때: open "https://daehantool.dev/manager/index.html"

## 핵심 규칙
1. 수정 요청한 것만 수정. 다른 파일/로직 절대 변경 금지.
2. 기존 데이터 절대 삭제/초기화/변경 금지.
3. 이해가 안 되거나 확실하지 않은 건 무조건 먼저 질문할 것. 추측으로 수정 금지.
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

## API 문서 위치
- 경영박사 ERP API: docs/경영박사_API.md
- 네이버 커머스 API: docs/네이버_커머스_API.md
- ERP/네이버 관련 작업 시 반드시 해당 문서를 읽고 참고할 것.

## ⚠️ 절대 규칙 (모든 작업 시 필수 준수)
1. 수정 요청한 것만 수정 — 다른 코드 1줄도 변경 금지
2. localStorage 절대 초기화 금지 (16개+ 키 보존)
3. 기존 로직(수수료 계산, ERP 연동, 재고 동기화 등) 건드리지 않음
4. 작업 후 npm run build 성공 확인 필수
5. 빌드 성공 후 git push → Vercel 자동 배포
6. 폰트 6단계: XS(10px), S(11px), M(12px), Base(13px), L(15px), XL(18px+)
7. 브라우저 열지 마, 이미지 분석하지 마, 코드만 수정해
8. 작업 완료 후 변경 사항 체크리스트 보고 필수
9. 작업이 여러 단계면 하나씩 완료될 때마다 중간 체크리스트 보고 (누락 방지)

## 수정 후 검증 (매 작업마다 필수)
1. 수정한 기능이 요청대로 동작하는지 브라우저에서 직접 확인
2. 수정한 함수를 사용하는 다른 곳이 깨지지 않았는지 확인 (grep으로 호출처 파악 → 해당 화면 확인)
3. 검증 결과를 체크리스트로 보고

## 작업 완료 후 루틴 (매 작업마다 반드시 수행)
1. npm run build — 에러 없으면 다음 단계, 에러 있으면 수정
2. git add -A
3. git commit -m "적절한 커밋 메시지"
4. git push
5. "배포 완료" 메시지 출력
6. 배포 후 반드시 https://daehantool.dev 열어서 실제 동작 확인

이 루틴은 어떤 작업이든 마지막에 반드시 실행할 것. 빌드 실패 시 push 하지 말 것.
