# 대한종합상사 원가계산 로직 조사 보고서

> 대상 파일: `public/manager/app.js` (메인 로직) + `mw_settings` / `mw_po_history` (localStorage)
> 작성 목적: 원가계산 관련 함수, 데이터 구조, 매출 집계 로직, 프로모션 데이터 3종의 차이, 그리고 현재 존재하는 구조적 이슈(Phase 2 `costPrice=0`, `mw_commercial_promos` 미반영)를 정리.

---

## 1. 원가계산 함수 위치 · 로직 · 공식

### 1.1 `calcCost(supplyPrice, category)` — 단가표용 (line 1217)

**용도:** 밀워키/일반제품 단가표의 "원가(cost)" 필드를 계산. `recalcAll()`에서 모든 제품에 대해 호출되어 `p.cost`에 저장.

```js
function calcCost(supplyPrice, category) {
  if (!supplyPrice) return 0;
  const s = DB.settings;
  const sp = supplyPrice;
  // AR차감: 분기 + 년간 + AR커머셜들
  let arTotal = sp * s.quarterDC + sp * s.yearDC;
  (s.arPromos || []).forEach(ap => { if (ap.rate > 0) arTotal += sp * (ap.rate / 100); });
  // 물량지원: 각 항목을 공급가 기준으로 개별 계산
  var volTotal = 0;
  (s.volPromos || []).forEach(function(vp) {
    if (vp.rate > 0) { volTotal += sp - (sp / (1 + vp.rate / 100)); }
  });
  // 제품 추가 DC (카테고리 기반) — 개별 계산
  (s.productDCRules || []).forEach(function(rule) {
    if (rule.rate > 0 && rule.categories && rule.categories.indexOf(category) !== -1) {
      volTotal += sp - (sp / (1 + rule.rate / 100));
    }
  });
  // 최종: 공급가 - AR할인합계 - 물량할인합계
  return sp - arTotal - volTotal;
}
```

### 1.2 `calcOrderCost(price, category)` — 발주용 (line 8329)

**용도:** 발주 탭에서 "매입원가" 계산. `onlinesales` 탭의 `costP` 역산에도 사용.

```js
function calcOrderCost(price, category) {
  if (!price) return 0;
  const s = DB.settings;
  // 분기+년간 리베이트 (단가표 설정에서)
  let arTotal = price * (s.quarterDC || 0) + price * (s.yearDC || 0);
  // 커머셜 AR (설정에서 통합 관리)
  (s.arPromos || []).forEach(ap => { if (ap.rate > 0) arTotal += price * (ap.rate / 100); });
  // 물량지원: 각 항목을 공급가 기준으로 개별 계산
  var volTotal = 0;
  (s.volPromos || []).forEach(function(vp) {
    if (vp.rate > 0) { volTotal += price - (price / (1 + vp.rate / 100)); }
  });
  (s.productDCRules || []).forEach(function(rule) {
    if (rule.rate > 0 && rule.categories && rule.categories.indexOf(category) !== -1) {
      volTotal += price - (price / (1 + rule.rate / 100));
    }
  });
  return price - arTotal - volTotal;
}
```

### 1.3 두 함수의 관계 — **사실상 동일 공식**

- `calcCost`와 `calcOrderCost`는 로직이 100% 동일. (파라미터 이름만 `supplyPrice` ↔ `price` 차이)
- 다만 호출 맥락이 다름: `calcCost`는 단가표 재계산(`recalcAll`), `calcOrderCost`는 발주 개별 계산.
- 이중 정의는 리팩토링 여지가 있음. 하나로 통합 가능.

---

## 2. `mw_settings` 구조

### 2.1 기본값 (line 8127 — 초기화 시)

```js
DB.settings = {
  quarterDC:   0.04,   // 분기 리베이트 4%
  yearDC:      0.018,  // 년간 리베이트 1.8%
  vat:         0.1,    // VAT 10%
  naverFee:    0.059,  // 네이버 수수료 5.9%
  openElecFee: 0.13,   // 오픈마켓 전동 13%
  openHandFee: 0.176,  // 오픈마켓 수공구 17.6%
  ssgElecFee:  0.13,   // SSG 전동 13%
  ssgHandFee:  0.13,   // SSG 수공구 13%
  domaeFee:    0.01,   // 도매 수수료 1%
  mkDomae:     1,      // 도매 마크업
  mkRetail:    15,     // 소매 마크업
  mkNaver:     17,     // 네이버 마크업
  mkOpen:      27,     // 오픈마켓 마크업
  promoFee1:   5.8,    // 구버전 필드 (미사용)
  promoFee2:   3.6,    // 구버전 필드 (미사용)
  arPromos:    [{name:'',rate:0}, ...4],  // AR 커머셜 프로모션 (단순 곱셈)
  volPromos:   [{name:'',rate:0}, ...4]   // 물량지원 프로모션 (DC 역산)
};
```

### 2.2 추가 필드 (`applySettings` — line 8351)

| 필드 | 역할 | 계산 방식 |
|---|---|---|
| `quarterDC` | 분기 리베이트 | `sp × rate` (단순 곱셈) |
| `yearDC` | 년간 리베이트 | `sp × rate` (단순 곱셈) |
| `arPromos[]` | AR 커머셜 (최대 4개) | `sp × (rate/100)` (단순 곱셈) |
| `volPromos[]` | 물량지원 (최대 4개) | `sp − sp / (1 + rate/100)` (DC 역산) |
| `productDCRules[]` | 제품 추가 DC (카테고리별 12%, 13%) | `sp − sp / (1 + rate/100)` (DC 역산) |
| `mkDomae`, `mkRetail`, `mkNaver`, `mkOpenElec`, `mkOpenHand`, `mkSsgElec`, `mkSsgHand` | 마켓별 마크업 | 판매가 역산에 사용 |
| `promoLimits` | T5/T6 제품당 발주 제한 수량 | 발주 탭 |

---

## 3. AR차감 vs 물량지원 — **계산 공식의 근본 차이**

### 3.1 AR차감 (단순 곱셈)

- **대상:** `quarterDC`, `yearDC`, `arPromos`
- **공식:** `할인액 = 공급가 × 비율`
- **의미:** "공급가의 X% 만큼 직접 차감"
- **예:** 공급가 100,000원, 분기 4%, 년간 1.8% → AR 차감액 = 100,000 × 0.058 = 5,800원

### 3.2 물량지원 (DC 역산 = 물량지원/DC 방식)

- **대상:** `volPromos`, `productDCRules`
- **공식:** `할인액 = 공급가 − 공급가 / (1 + 비율/100)`
- **의미:** "공급가에 DC%가 이미 포함되어 있다고 보고 역산"
- **예:** 공급가 100,000원, 물량지원 12% → 원가(DC 제외) = 100,000 / 1.12 = 89,286원, 할인액 = 10,714원
- **주의:** 단순 곱셈(`100,000 × 0.12 = 12,000`)과 다름. 반드시 이 공식을 사용해야 함 (프로젝트 CLAUDE.md 명시).

### 3.3 최종 원가 공식

```
원가 = 공급가 − (AR차감 합계) − (물량지원 합계)
     = sp − (sp × quarterDC + sp × yearDC + Σ arPromos) − Σ (sp − sp/(1+vp/100))
```

---

## 4. 원가 (`cost`) vs 원가P — 서로 다른 개념

### 4.1 원가 (`p.cost`)

- **저장 필드:** `DB.products[].cost` (mw_products)
- **계산 시점:** `recalcAll()` 호출 시 `calcCost(supplyPrice, category)`로 재계산되어 저장.
- **용도:** 단가표의 "원가" 컬럼, 판매가 역산 기준.

### 4.2 원가P (_costP)

- **저장 필드:** **없음** (동적 조회만 함)
- **계산 위치:** `buildRow` 내부 IIFE (line 1811~1833)
- **로직:**
  1. 최근 1주일 내 `orderHistory` + `poHistory` 순회
  2. 해당 제품 코드의 마지막 실제 발주 단가(`it.cost`)를 가져옴
  3. 결과 없으면 `_costP = 0`
- **용도:**
  - 단가표의 "원가P" 컬럼에 빨간 P 뱃지로 표시 (line 1862~1866)
  - A(도매) 마진 계산 시 `_costP || p.cost` 우선 (line 1871)
  - 공급가 대비 마진율(%) + 차이금액(+/-) 함께 표시
- **의미:** "최근 실제 발주가 반영된 실원가" (프로모션/이벤트 포함된 실제 매입가)
- **중요:** `_costP`는 저장 필드가 아니므로 `p.costP` 같은 속성 참조는 존재하지 않음. 항상 렌더링 시점에 `orderHistory`/`poHistory`에서 찾아옴.

---

## 5. `mw_po_history` 필드 목록

### 5.1 Phase 1 — `_saveAutoOrderHistory` (자동 발주, line 5067)

TTI 자동발주 성공 시 저장.

| 필드 | 예시 | 비고 |
|---|---|---|
| `id` | `1712345678_0` | 고유 ID |
| `date` | ISO 문자열 | 주문 시각 |
| `type` | `normal` / `promoName` | 구분 |
| `subtab` | `normal` / `promo-t6` / `promo-package` 등 | 서브탭 분류 |
| `promoName` | `T6` / `PACKAGE` / `` | 프로모션명 |
| `manageCode` | `TC-1234` | DB.products의 code |
| `ttiNum` | `1234` | TTI 제품번호 |
| `model` | `TEST 일반제품` | 모델명 |
| `category` | `파워툴` | 카테고리 |
| `qty` | `5` | 수량 |
| `supplyPrice` | `10000` | 공급가 |
| `costPrice` | `8000` | 매입원가 (장바구니 c.costPrice 그대로) |
| `amount` | `50000` | supplyPrice × qty |
| `orderNumber` | TTI 주문번호 | 자동발주 결과 |
| `dryRun` | `true` / `false` | 테스트 모드 |
| `erpStatus` | `pending` / `dry-run` | 경영박사 연동 상태 |

### 5.2 Phase 1 — `syncTtiOrderHistory` (TTI 주문내역 스크래핑, line 3450)

TTI `order_list.html` 15컬럼 파싱 결과로 미매칭 주문 신규 생성.

추가 필드:
- `remark` — TTI Remark (분류 근거)
- `ttiOrderNo`, `ttiOrderDate`, `ttiOrderStatus`, `ttiManagerConfirm`, `ttiOrderAmount`, `ttiVat`, `ttiTotalAmount`
- `source: 'tti-scrape'`
- `costPrice: 0` (이하 §9 참조)

### 5.3 Phase 2 — `syncOrderItems` (아이템별 스크래핑, line 11135)

TTI `order_list_sub_new.html` 아이템별 행 저장. 중복 체크 키 = `ttiOrderItemKey = orderNo + '|' + 정규화코드`.

Phase 1 + 아래 필드:
- `ttiOrderItemKey` — 중복 체크 키
- `ttiUnitPrice` — 단가
- `ttiSupplyPrice` — 공급가
- `ttiPromotion` — `일반` / `T6` / `PACKAGE` / 기타 (→ `ttiPromotion` 기반 구분 뱃지에 사용)
- `ttiItemType` — 아이템 타입
- `ttiBrand`, `ttiMonth`
- `ttiDealerNo`, `ttiDealerName`, `ttiConsolidatedDealer`, `ttiSalesRep`
- `source: 'tti-scrape-items'`
- **`costPrice: 0`** — 스크래핑 데이터에는 매입원가가 없어서 0으로 고정 (§9 참조)

---

## 6. `calcPOSalesData` 매출 집계 로직 (line 2535)

### 6.1 일반 매출 3카드

```js
var isNormal = item.subtab ? item.subtab === 'normal' : item.type === 'normal';
if (isNormal && cat === '파워툴' && 이번달)       powerTool += amt;
if (isNormal && cat === '수공구/악세사리' && 분기) handTool  += amt;
if (isNormal && cat === '팩아웃' && 이번달)       packout   += amt;
```

- **일반주문만** 집계 (subtab==='normal'). `subtab` 없으면 `type==='normal'` 폴백 (레거시).
- 파워툴/팩아웃 = 이번 달 범위, 수공구+액세서리 = 분기 범위.
- `dryRun: true` 건은 무조건 제외 (line 2551).

### 6.2 전체 매출 (합계 카드)

```js
// 이번 달 전체 — 모든 subtab 합산 (T6/PACKAGE 포함)
if (d >= monthRange.start && d <= monthRange.end) {
  totalMonth += amt;
  if (d.getDate() <= 15) first15 += amt; else last15 += amt;
}
```

- 상단 빨간 합계 카드는 **일반주문 + 모든 프로모션** 을 전부 합산.
- 1~15일 / 16~말일로 반월 분리.

### 6.3 누적프로모션 카드

- `mw_cumulative_promos` 로드
- 프로모션별 기간(`periodStart`~`periodEnd`) × 제품 코드 매칭(`ttiNum` 정규화 + `_model_` prefix)
- 달성 횟수 = `floor(sales / target)`, 잔여 부족액 = `target − (sales % target)`

---

## 7. 프로모션 데이터 3종 — 용도가 서로 다름

| 키 | 구조 | 용도 | 참조 함수 |
|---|---|---|---|
| **`mw_promotions`** | `KEYS.promotions` | 단가표 기반 제품별 프로모션 단가 (레거시) | `findPromo`, `getEffectiveCost` |
| **`mw_promos_v2`** | `{ newprod, package, monthly, cumul, quarter, spot, commercial }` (7카테고리) | 신제품/패키지/이달의특가/누적/분기/스팟/커머셜 프로모션 등록 UI | `loadObj('mw_promos_v2')`, `savePromosV2`, `renderPromoV2` |
| **`mw_tti_promotions`** | `{ data: { tOrders: { T5, T6, ... }, tList: [...] } }` | TTI 사이트 크롤링 결과 (T5/T6 리스트, 제한 수량) | `_getPromoData`, `_buildPromoTabContent` |

### 7.1 `mw_promotions` (레거시, line 51)

- 단가표용. `findPromo(code)`로 제품 코드로 조회, `getEffectiveCost`에서 원가 우선순위로 사용.

### 7.2 `mw_promos_v2` (현행 등록 UI, line 9232)

- 7개 카테고리로 분리: 신제품 / 패키지 / 이달의특가 / 누적 / 분기·월별 / 스팟 / 커머셜
- PDF 업로드 또는 수동 등록.
- `editPromoV2`, `deletePromoV2`, `savePromosV2`로 CRUD.

### 7.3 `mw_tti_promotions` (TTI 크롤링, line 3906)

- 크롬 확장이 TTI 사이트에서 수집한 T5/T6 주문 리스트(`tOrders`) + 프로모션 메타(`tList`)
- 발주 탭 T5/T6 서브탭의 좌측 테이블 데이터 원천.

---

## 8. `mw_commercial_promos` / `mw_rebate` — 원가계산 **미반영**

### 8.1 `mw_commercial_promos` (line 2486)

- 커머셜 프로모션 상세 설정(구간/다중프로모션/목표금액). `_getCommercialPromos()` / `_saveCommercialPromos()`.
- **원가계산 공식(`calcCost`/`calcOrderCost`)에는 포함되지 않음.** → 매출 합계 카드의 "커머셜P" 힌트 및 티어할인 계산에만 사용.
- 실제 원가에 반영하려면 `arPromos` 또는 `volPromos`(mw_settings)에 수동으로 옮겨 적어야 함.

### 8.2 `mw_rebate` (line 51, `KEYS.rebate`)

- 초기화 시 `DB.rebate = []`로 리셋되지만, 원가계산 함수에서는 **전혀 참조하지 않음.**
- `DB.rebate` 필드는 있지만 `calcCost`/`calcOrderCost`에서 사용처가 없어 **사실상 데드 데이터**.
- 과거 리베이트 관리 목적으로 설계되었을 가능성. 현재는 `mw_settings.arPromos` + `volPromos`로 통합 이관된 것으로 보임.

**결론:** 두 키 모두 원가 재계산에 자동 반영되지 않음. 원가에 영향을 주려면 반드시 설정 모달 → `arPromos`/`volPromos`/`productDCRules` 중 하나에 입력해야 함.

---

## 9. Phase 2 `syncOrderItems`의 `costPrice=0` 문제

### 9.1 증상

`syncOrderItems` 및 `syncTtiOrderHistory` 가 생성하는 `mw_po_history` 엔트리는 `costPrice: 0`으로 고정 (line 3460, 11223).

### 9.2 원인

- TTI 사이트 스크래핑 데이터에 "우리가 실제 지불한 매입원가" 정보가 없음.
- TTI가 보여주는 것은 `supplyPrice`(공급가), `unitPrice`(단가) 정도. 여기에 분기/년간/커머셜 할인이 적용된 실제 원가는 TTI 쪽에 없음.
- 자동발주(`_saveAutoOrderHistory`)의 경우 장바구니 `c.costPrice`를 그대로 사용하므로 값이 있지만, 스크래핑은 0으로 떨어짐.

### 9.3 영향

1. **발주확정 테이블의 "매입원가" 컬럼이 `-` 로 표시됨** (`item.costPrice ? fmtPO(item.costPrice) : '-'` line 3335)
2. **"금액" 컬럼은 `ttiOrderAmount` 우선**이므로 공급가 기준 금액은 정상 표시 (line 3302)
3. **원가P(`_costP`)는 단가표 전용**이라 발주확정 테이블과는 무관.
4. 매출 집계(`calcPOSalesData`)는 `amount`만 사용하므로 `costPrice=0`이 집계에 영향 없음.

### 9.4 해결 방안 (향후)

- 스크래핑 시점에 `calcOrderCost(supplyPrice, category)`를 호출해서 `costPrice`를 계산 후 저장하는 것이 간단한 개선안.
- 단, 스크래핑 시점의 `DB.settings` 값이 과거와 다를 수 있으므로 "표시용 추정 원가"라는 점은 감안 필요.

---

## 10. 카테고리 뱃지 색상 매핑

단가표(`getCategoryColor`, line 1785)와 발주확정 테이블(`_poCatColor`, line 3234)에서 동일한 4~5색 팔레트 사용.

```js
var map = {
  '파워툴':   { bg: '#DBEAFE', color: '#1E40AF' },  // 파랑
  '수공구':   { bg: '#D1FAE5', color: '#065F46' },  // 초록
  '악세사리': { bg: '#FEF3C7', color: '#92400E' },  // 노랑/주황
  '악세서리': { bg: '#FEF3C7', color: '#92400E' },  // 동의어
  '액세서리': { bg: '#FEF3C7', color: '#92400E' },  // 동의어
  '팩아웃':   { bg: '#FCE7F3', color: '#9D174D' },  // 분홍
  '드릴비트': { bg: '#E0E7FF', color: '#3730A3' }   // 보라
};
// fallback
return { bg: '#F3F4F6', color: '#374151' };         // 회색
```

- **동의어 처리:** "악세사리" / "악세서리" / "액세서리" 3종 모두 동일한 노란색.
- **단가표 버전:** inline style로 `padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500` (line 1839)
- **발주확정 버전 (2026-04-10 통일):** `padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600` — 다른 3개 뱃지(구분/TTI상태/경영박사)와 사이즈 통일.

---

## 요약 체크리스트

- [x] `calcCost`와 `calcOrderCost`는 동일 공식, 호출 맥락만 다름
- [x] `mw_settings`의 AR차감(단순 곱셈) vs 물량지원(DC 역산)은 공식 자체가 다름 — 혼용 금지
- [x] 원가P(`_costP`)는 저장 필드가 아니라 `orderHistory`/`poHistory` 1주 동적 조회
- [x] `mw_po_history`는 Phase 1(자동발주) + Phase 1(주문내역 스크래핑) + Phase 2(아이템별 스크래핑) 3경로로 생성
- [x] `calcPOSalesData`는 "일반주문만 카테고리 집계", "합계 카드는 전체 합산"의 2중 로직
- [x] 프로모션 데이터는 `mw_promotions`(레거시) / `mw_promos_v2`(현행 등록 UI) / `mw_tti_promotions`(TTI 크롤링) 3종 분리
- [x] `mw_commercial_promos`와 `mw_rebate`는 원가계산 함수에서 **참조하지 않음** — 수동 이관 필요
- [x] Phase 2 스크래핑은 `costPrice=0`으로 저장 — TTI 측에 원가 정보가 없어서 불가피
- [x] 카테고리 뱃지는 5카테고리 × 단가표(11px) / 발주확정(12px 통일) 2세트
