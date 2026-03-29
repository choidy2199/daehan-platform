# daehan-platform 작업 규칙

## 필수 준수 사항
- 수정 요청한 것만 수정. 다른 파일, 다른 로직 절대 변경 금지
- 하나씩 체크리스트로 확인 후 작업
- 기존 데이터 (DB, 상태) 절대 삭제/초기화/변경 금지
- 이해 안 되는 부분이나 더 나은 방향이 있으면 항상 질문하고 방향성 제시
- 대화 시 반복 확인 질문 없이 자연스럽게 적용

## 파일 수정 규칙
- 수정 대상 파일만 읽고 수정할 것
- 관련 없는 컴포넌트, 페이지, API 라우트 절대 건드리지 말 것
- import 추가/변경은 해당 파일에 필요한 경우만

## 디자인 시스템
- 폰트: Pretendard (필수)
- 네비 배경: #185FA5 (파란색)
- 섹션 헤더: #1A1D23 (다크)
- 컬러: --tl-primary (#185FA5), --tl-danger (#CC2222), --tl-success (#1D9E75), --tl-warning (#EF9F27)
- 버튼: btn-primary 기본, btn-danger 파괴적 액션만
- 다크 배경에 btn-secondary/btn-ghost 금지

## 실행 및 배포
- 개발: npm run dev
- 수정 완료 후 GitHub push
- Vercel 자동 배포 (push 시 자동)
- ⚠️ 로컬 한글 경로 이슈: Turbopack이 한글 경로에서 크래시함. 빌드 확인은 영문 경로(/tmp)에 복사 후 실행. Vercel 배포는 정상.

## 라우트 구조
- / → 대시보드 (메뉴 카드)
- /catalog → 밀워키 단가표
- /orders → 발주
- /setbun → 세트및분해
- /general → 일반제품 단가표
- /estimate → 검색 및 견적
- /sales → 온라인판매 관리
- /settings → 설정
