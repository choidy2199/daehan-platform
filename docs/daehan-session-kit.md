# 대한종합상사 세션 키트
> 마지막 업데이트: 2026-04-05

## app.js 함수 맵 — 발주 탭 (Step B-1 ~ B-3)

### 발주 탭 메인
| 함수 | 설명 |
|------|------|
| renderPOTab() | 발주 탭 전체 렌더링 (KPI 카드 + 서브탭 + 콘텐츠) |
| switchPOSubTab(tabName) | 서브탭 전환 (normal/kit/promo-t5/promo-t6/package/list/foc) |
| calcPOSalesData() | mw_po_history 기반 매출 집계 (파워툴/수공구/팩아웃/누적프로모션/합계) |
| _buildPoSubTabs() | tList 기반 서브탭 동적 생성 (T5/T6 하드코딩 제거) |

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
| renderPOCartTable() | 장바구니 테이블 + 합계 렌더링 (3행: 공급가/부가세/총합계) |
| updateCartQty(idx, val) | 장바구니 수량 변경 |
| removeCartItem(idx) | 장바구니 항목 삭제 |
| clearPOCart() | 장바구니 전체 비우기 (confirm) |
| submitPOOrder() | TTI 발주하기 → openAutoOrderModal() 호출 |

### T5/T6 프로모션 탭 (tList 기반 동적)
| 함수 | 설명 |
|------|------|
| _buildPromoTabContent(subtab, title, discountPct) | T 프로모션 탭 빌드 (좌: 제품목록, 우: 주문목록) |
| _buildPromoLeftPanel(subtab, title, discountPct, items) | 프로모션 제품 목록 패널 (할인가+재고+수량제한) |
| _buildPromoRow(item, i, subtab, discountPct) | 프로모션 제품 1행 (SVG재고아이콘, 5개제한, 발주완료 표시) |
| _buildPromoRightPanel(subtab) | 프로모션 주문 목록 패널 (합계 3행) |
| _filterPromoTab(subtab, discountPct) | 프로모션 제품 실시간 검색 |
| _addPromoToCart(subtab, discountPct, ...) | 프로모션 장바구니 추가 (5개 제한 체크) |
| _removePromoCart(subtab, cartIndex) | 프로모션 장바구니 삭제 |
| _refreshPromoRightPanel(subtab) | 주문 목록 패널만 재렌더링 |
| _getPromoOrdered(subtab, productCode) | history+cart에서 발주 수량 합산 |
| _getPromoLimits() | mw_settings.promoLimits 로드 (tList.maxOrders 기본값) |
| _setPromoLimit(subtab, newLimit) | 제한 수량 저장 (save) |
| _changePromoLimit(subtab) | prompt()로 제한 수량 변경 |

### 패키지/키트 프로모션 탭
| 함수 | 설명 |
|------|------|
| _buildPackageTabContent() | 패키지 프로모션 탭 빌드 (eList 기반) |
| _buildPackageLeftPanel(items) | 패키지 제품 목록 (M코드+프로모션명+가능수량) |
| _buildPackageRow(item, i) | 패키지 1행 (프로모션가, max=available) |
| _filterPackageTab() | 패키지 실시간 검색 |
| _addPackageToCart(...) | 패키지 장바구니 추가 (가능수량 초과 체크) |
| _buildKitTabContent() | 키트 탭 빌드 (dList, 0건시 빈상태) |

### 커머셜 프로모션 모달
| 함수 | 설명 |
|------|------|
| openCommercialPromoModal() | 커머셜 프로모션 관리 모달 열기 |
| _buildCommPromoAccordion(promo, idx, history) | 프로모션 아코디언 1개 빌드 |
| _toggleCommAccordion(idx) | 아코디언 접기/펼치기 |
| _addNewCommercialPromo() | 새 프로모션 추가 |
| _deleteCommPromo(idx) | 프로모션 삭제 |
| _addCommTier(promoIdx) | 구간 추가 (입력값 먼저 수집) |
| _deleteCommTier(promoIdx, tierIdx) | 구간 삭제 (입력값 먼저 수집) |
| _collectCommModalInputs() | 모달 입력값 수집 공통 함수 |
| _saveCommercialPromoModal() | 모달 저장 → mw_commercial_promos |
| _getCommercialPromos() | mw_commercial_promos 로드 |
| _saveCommercialPromos(arr) | mw_commercial_promos 저장 (save) |
| _getActiveCommercialPromo() | 현재 진행중 프로모션 찾기 |
| _calcCommercialSales(promo) | 기간 내 매출 합산 |
| _findCommercialTier(promo, sales) | 현재/다음 구간 찾기 |
| _commPeriodLabel(promo) | 기간 라벨 (3~4월) |

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

### 발주 리스트 탭
| 함수 | 설명 |
|------|------|
| buildPOListPanel() | 발주 리스트 패널 (요약카드 + 날짜필터 + 테이블, 14컬럼 — TTI상태/액션/주문번호 포함) |
| changePOListFilter(val) | 날짜 필터 변경 (today/week/month) |
| togglePOListAll(el) | 체크박스 전체 선택/해제 |
| registerErpFromList() | 경영박사 매입전표 등록 (선택 항목) |
| syncTtiOrderHistory(ttiOrders) | TTI 주문내역 → mw_po_history 동기화 (ttiOrderNo/날짜+금액 매칭) |
| ttiCancelOrder(orderNo) | TTI 주문취소 요청 (postMessage → 크롬 확장) |
| ttiReorder(item) | TTI 재주문 요청 (postMessage → 크롬 확장) |

### FOC 발주 탭
| 함수 | 설명 |
|------|------|
| buildPOFocLeftPanel() | FOC 대상 제품 패널 |
| buildPOFocRightPanel() | FOC 주문 목록 패널 |
| clearFOCCart() | FOC 장바구니 비우기 |
| addFOCCartItem() | FOC 제품등록 |
| submitFOCOrder() | FOC 발주하기 |

### 자동발주 모달 (Phase 4-1)
| 함수 | 설명 |
|------|------|
| openAutoOrderModal() | 자동발주 진행 모달 (dry-run 토글, 프로그레스 바, 주문 테이블) |
| _toggleDryRun(checked) | dry-run 토글 ON/OFF + localStorage 저장 |
| _closeAutoOrderModal() | 모달 닫기 (진행 중이면 confirm) |
| _startAutoOrder() | 발주 시작 (확장 감지 → _executeOrderGroups) |
| _executeOrderGroups() | 그룹 순차 실행 → 결과 저장 |
| _sendOrderToExtension(items, orderType, dryRun) | 크롬 확장에 주문 전달 (TTI_AUTO_ORDER_COMPLETE 대기) |
| _saveAutoOrderHistory(isDryRun) | mw_po_history에 저장 (category, orderNumber, dryRun 필드) |
| _removeSuccessFromCart() | 성공 건 장바구니 제거 |
| _groupCartByOrderType(cart) | subtab별 그룹핑 (normal→promo→package 순) |
| _aoSubtabBadge(subtab) | 주문유형 뱃지 HTML |
| _aoUpdateRow/Progress/SetStatus | 모달 UI 업데이트 유틸 |

### TTI 스크래핑
| 함수 | 설명 |
|------|------|
| startTtiProductScrape() | 제품 스크래핑 요청 (DAEHAN_SCRAPE_PRODUCTS) |
| startTtiPromoScrape() | 프로모션 스크래핑 요청 (DAEHAN_SCRAPE_PROMOTIONS) |
| handleTtiScrapeResult(data) | 제품 스크래핑 결과 처리 |
| handleTtiPromoResult(data) | 프로모션 결과 처리 → save + renderPOTab + 타임스탬프 |
| _getPromoData() | mw_tti_promotions.data 로드 |

### 티어/집계 유틸리티
| 함수 | 설명 |
|------|------|
| getCurrentTier(amount, tiers) | 현재 도달 티어 반환 |
| getNextTier(amount, tiers) | 다음 티어 반환 (null=최고 달성) |
| getQuarterRange(date) | 분기 범위 (start, end) |
| getMonthRange(date) | 월 범위 (start, end) |
| fmtPO(n) | 숫자 콤마 포맷 (0도 표시) |
| normalizeTtiCode(code) | TTI 코드 앞자리 0 제거 |
| initPOAutocomplete(inputId, onSelect) | 검색 자동완성 초기화 |

### 티어 상수
```javascript
HANDTOOL_TIERS = [100만 8%, 400만 10%, 1200만 12%]  // 분기
PACKOUT_TIERS = [100만 5%, 300만 8%, 600만 10%, 1200만 13%]  // 월
PO_PROMO_LIMIT = _getPromoLimits()  // mw_settings.promoLimits 기반 동적
```

## localStorage 키 — 발주 탭

| 키 | 용도 | 형식 |
|----|------|------|
| mw_po_cart | 장바구니 (탭전환/새로고침 복원) | [{code, ttiNum, model, supplyPrice, qty, subtab, promoName, ...}] |
| mw_po_history | 발주 이력 (매출집계+발주리스트) | [{id, date, type, subtab, model, qty, supplyPrice, costPrice, amount, erpStatus, dryRun, category, orderNumber, ttiOrderNo, ttiOrderDate, ttiOrderStatus, ttiManagerConfirm, ttiOrderAmount, ttiVat, ttiTotalAmount, ...}] |
| mw_cumulative_promos | 누적프로모션 설정 | [{name, targetAmount, benefitAmount, products[], periodStart, periodEnd, ...}] |
| mw_commercial_promos | 커머셜 프로모션 설정 | [{id, name, startDate, endDate, condition, targetAmount, tiers[{minAmount, maxAmount, benefit, rate}]}] |
| mw_po_active_subtab | 현재 선택 서브탭 | 'normal' / 'kit' / 'promo-t5' / ... |
| mw_po_list_filter | 발주 리스트 날짜 필터 | 'today' / 'week' / 'month' |
| mw_tti_promotions | TTI 프로모션 스크래핑 데이터 | {data: {tList, tOrders, dList, eList}, scrapedAt} |
| mw_promo_scrape_time | 프로모션 스크래핑 완료 시간 | ISO 8601 문자열 |
| mw_settings | 설정 (promoLimits 포함) | {promoLimits: {promo-t5: 5, promo-t6: 5, ...}, ...} |
| mw_auto_order_dryrun | 자동발주 dry-run 토글 상태 | 'true' / 'false' |

## 현재 상태 (2026-04-05)

### 완료
- Step B-1a: 기본 구조 (7개 서브탭 + 일반주문 50:50 + 매출카드)
- Step B-1b: 발주 리스트 + FOC + 누적프로모션 모달
- Step B-2a: 장바구니 + TTI 발주하기 + 발주 리스트 실데이터
- Step B-2b: 매출 카드 실데이터 + 티어 할인 + 누적프로모션 자동 집계
- Step B-3: T5/T6/패키지/키트 서브탭 콘텐츠 + 커머셜 프로모션 모달
- Phase 4-1: TTI 자동발주 (모달 + 크롬 확장 통신 + Debugger API confirm/alert)
- Phase 4-2: TTI 주문내역 스크래핑 + 발주리스트 동기화 (14컬럼) + 취소/재주문
- 스크래핑 분리 (제품/프로모션 별도) + 프로모션 새로고침 버튼
- UI 전면 개선 (합계 디자인, 카드 정렬, 뱃지 통일, 아이콘 통일)
- localStorage 동기화 대상 추가 (6개 키)

### 남은 작업
- B-4: 원가 계산 연결 (물량지원 DC 기반)
- B-5: 경영박사 매입전표 API 연결
- B-6: TTI 크롬 확장 자동발주 연결
- B-7: FOC 실제 기능 (달성 프로모션 → 혜택 제품)
