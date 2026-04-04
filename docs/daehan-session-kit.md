# 대한종합상사 세션 키트
> 마지막 업데이트: 2026-04-04

## app.js 함수 맵 — 발주 탭 (Step B-1 ~ B-2b)

### 발주 탭 메인
| 함수 | 설명 |
|------|------|
| renderPOTab() | 발주 탭 전체 렌더링 (KPI 카드 + 서브탭 + 콘텐츠) |
| switchPOSubTab(tabName) | 서브탭 전환 (normal/kit/t5/t6/package/list/foc) |
| calcPOSalesData() | mw_po_history 기반 매출 집계 (파워툴/수공구/팩아웃/누적프로모션/합계) |

### 제품 목록 (일반주문 좌측)
| 함수 | 설명 |
|------|------|
| buildPOProductPanel() | 제품 목록 패널 HTML 빌드 (필터 + 테이블 헤더) |
| buildPOProductRow(p, rowIndex) | 제품 1행 HTML 빌드 (누적뱃지/소진비활성화 포함) |
| renderPOProductRows() | 제품 목록 초기 50행 렌더링 |
| onPOProductScroll() | 스크롤 시 100행 추가 (가상 스크롤) |
| filterPOProducts() | 제품 목록 필터 (검색/카테고리/본사재고) |

### 주문 목록 (일반주문 우측)
| 함수 | 설명 |
|------|------|
| buildPOOrderPanel() | 주문 목록 패널 HTML 빌드 |
| addToCart(productCode) | 🛒 버튼 클릭 → 장바구니 추가 |
| addToCartDirect(product) | 자동완성에서 선택 → 수량1로 추가 |
| renderPOCartTable() | 장바구니 테이블 + 합계 렌더링 |
| updateCartQty(idx, val) | 장바구니 수량 변경 |
| removeCartItem(idx) | 장바구니 항목 삭제 |
| clearPOCart() | 장바구니 전체 비우기 (confirm) |
| submitPOOrder() | TTI 발주하기 → mw_po_history 저장 |

### 발주 리스트 탭
| 함수 | 설명 |
|------|------|
| buildPOListPanel() | 발주 리스트 패널 (요약카드 + 날짜필터 + 테이블) |
| changePOListFilter(val) | 날짜 필터 변경 (today/week/month) |
| togglePOListAll(el) | 체크박스 전체 선택/해제 |
| registerErpFromList() | 경영박사 매입전표 등록 (선택 항목) |

### FOC 발주 탭
| 함수 | 설명 |
|------|------|
| buildPOFocLeftPanel() | FOC 대상 제품 패널 |
| buildPOFocRightPanel() | FOC 주문 목록 패널 |
| clearFOCCart() | FOC 장바구니 비우기 |
| addFOCCartItem() | FOC 제품등록 |
| submitFOCOrder() | FOC 발주하기 |

### 누적프로모션 모달
| 함수 | 설명 |
|------|------|
| openCumulativePromoModal(index) | 누적프로모션 모달 열기 |
| saveCumulativePromo(index) | 모달 저장 → mw_cumulative_promos |
| addCumulativePromo() | +추가 버튼 → 새 프로모션 + 모달 열기 |
| addPromoProduct(promoIndex, product) | 대상 제품 추가 |
| removePromoProduct(promoIndex, productIndex) | 대상 제품 삭제 |
| updatePromoProductDiscount(pi, idx, val) | 제품별 할인율 변경 |
| updateCumulInfo() | 상단 정보 실시간 업데이트 |
| updateCumulDC() | 자동 할인율(DC%) 계산 |
| _getCumulPromos() | mw_cumulative_promos 로드 (기본값 포함) |
| _saveCurrentCumulInputs(promoIndex) | 모달 입력값 중간 저장 |

### 티어/집계 유틸리티
| 함수 | 설명 |
|------|------|
| getCurrentTier(amount, tiers) | 현재 도달 티어 반환 |
| getNextTier(amount, tiers) | 다음 티어 반환 (null=최고 달성) |
| getQuarterRange(date) | 분기 범위 (start, end) |
| getMonthRange(date) | 월 범위 (start, end) |
| fmtPO(n) | 숫자 콤마 포맷 (0도 표시) |
| fmtCommaInput(el) | input 실시간 콤마 포맷 |
| normalizeTtiCode(code) | TTI 코드 앞자리 0 제거 |
| initPOAutocomplete(inputId, onSelect) | 검색 자동완성 초기화 |

### 티어 상수
```javascript
HANDTOOL_TIERS = [100만 8%, 400만 10%, 1200만 12%]  // 분기
PACKOUT_TIERS = [100만 5%, 300만 8%, 600만 10%, 1200만 13%]  // 월
```

## localStorage 키 — 발주 탭

| 키 | 용도 | 형식 |
|----|------|------|
| mw_po_cart | 장바구니 (탭전환/새로고침 복원) | [{code, ttiNum, orderNum, model, supplyPrice, qty, promoName, ...}] |
| mw_po_history | 발주 이력 (발주 리스트 표시) | [{id, date, type, model, qty, supplyPrice, amount, erpStatus, ...}] |
| mw_cumulative_promos | 누적프로모션 설정 | [{name, targetAmount, benefitAmount, autoDiscountRate, products[], ...}] |
| mw_po_active_subtab | 현재 선택 서브탭 | 'normal' / 'kit' / 't5' / ... |
| mw_po_list_filter | 발주 리스트 날짜 필터 | 'today' / 'week' / 'month' |

## 현재 상태 (2026-04-04)

### 완료
- Step B-1a: 기본 구조 (7개 서브탭 + 일반주문 50:50 + 매출카드)
- Step B-1b: 발주 리스트 + FOC + 누적프로모션 모달
- Step B-2a: 장바구니 + TTI 발주하기 + 발주 리스트 실데이터
- Step B-2b: 매출 카드 실데이터 + 티어 할인 + 누적프로모션 자동 집계

### 남은 작업
- B-3: 키트구성(kit)/T5/T6/패키지(package) 서브탭 콘텐츠
- B-4: 원가 계산 연결 (물량지원 DC 기반)
- B-5: 경영박사 매입전표 API 연결
- B-6: TTI 크롬 확장 자동발주 연결
- B-7: FOC 실제 기능 (달성 프로모션 → 혜택 제품)
