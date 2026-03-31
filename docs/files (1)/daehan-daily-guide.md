# daehan-platform 운영 가이드
> 3가지 상황별 체크리스트
> 이 파일은 0.daehan-platform 폴더에 보관

---

## A. claude.ai 새 채팅 시작할 때

### 해야 할 것
1. **daehan-session-kit.md 파일 업로드**
2. "이어서 작업합니다" 입력
3. 오늘 할 작업 설명

### 그러면 claude.ai가
- 프로젝트 구조, 함수 맵, element ID를 파악한 상태로
- 정확한 라인 번호와 함수명이 포함된 Claude Code용 프롬프트를 작성

### 주의
- daehan-session-kit.md가 최신 상태인지 확인 (하루 마무리 때 업데이트했는지)
- 새로운 버그나 변경사항이 있으면 채팅에서 직접 설명

---

## B. Claude Code 새 채팅 시작할 때

### 1단계: 프로젝트 폴더 열기
- Claude Code 새 채팅 → 하단 폴더 선택
- `~/1.클로드/앱 ,웹개발/0.daehan-platform` 선택 → "열기"

### 2단계: 첫 메시지
```
CLAUDE.md를 읽고 규칙을 숙지해줘.
```
→ Claude Code가 프로젝트 안 CLAUDE.md + 상위 웹개발/CLAUDE.md 둘 다 읽음

### 3단계: 작업 프롬프트 입력
- claude.ai가 만들어준 프롬프트를 복붙

### 주의
- 폴더 위치: 반드시 `0.daehan-platform` (0. 접두사 주의)
- 모드: Local
- 편집 자동 승인: ON 권장
- 모델: Opus 4.6

---

## C. 하루 마무리할 때

### Claude Code에 아래 프롬프트 입력:

```
오늘 작업 마무리. 아래 2가지를 해줘:

### 1. daehan-session-kit.md 업데이트
파일 위치: ~/1.클로드/앱\ ,웹개발/0.daehan-platform/daehan-session-kit.md

아래 항목을 현재 상태에 맞게 업데이트:
- "현재 상태 / 남은 작업" 섹션: 오늘 완료한 작업을 "완료 ✅"로 이동, 새 버그는 "미해결 버그 🔴"에 추가
- "app.js 핵심 함수 맵" 섹션: 오늘 추가/변경된 함수가 있으면 반영
- "핵심 Element ID" 섹션: 오늘 추가/변경된 ID가 있으면 반영
- "마지막 업데이트" 날짜를 오늘로 변경

### 2. app-structure.md 갱신
아래 명령을 실행해서 app-structure.md를 최신으로 갱신:

grep -n "function " public/manager/app.js | head -120 > /tmp/funcs.txt
grep -n "getElementById\|querySelector" public/manager/app.js | head -60 > /tmp/elements.txt
grep -n "disabled" public/manager/app.js > /tmp/disabled.txt
grep -n "autocomplete" public/manager/app.js public/manager/index.html > /tmp/autocomplete.txt
grep -n "localStorage" public/manager/app.js | head -40 > /tmp/storage.txt

위 결과를 종합하여 app-structure.md 파일을 갱신해줘.

### git push
git add daehan-session-kit.md app-structure.md
git commit -m "docs: 세션 키트 + 구조 문서 업데이트"
git push
```

### 하루 마무리 후 확인
- [ ] daehan-session-kit.md가 최신 상태
- [ ] app-structure.md가 최신 상태  
- [ ] git push 완료
- [ ] 내일 새 claude.ai 채팅 시작 시 최신 파일 업로드 가능

---

## 요약 (한눈에)

| 상황 | 할 일 |
|------|-------|
| **claude.ai 새 채팅** | daehan-session-kit.md 업로드 + "이어서 작업합니다" |
| **Claude Code 새 채팅** | 0.daehan-platform 폴더 열기 + "CLAUDE.md 읽어줘" + 프롬프트 복붙 |
| **하루 마무리** | Claude Code에 마무리 프롬프트 입력 → session-kit + structure 자동 갱신 |
