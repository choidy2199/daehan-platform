/**
 * import-pricing 메뉴 전용 마진 계산 라이브러리
 *
 * 정책 (2026-05-13 형 결정):
 *  - 모든 채널 VAT 포함 처리 (×1.1 곱하기 안 함)
 *  - 부가세 = 판매가 ÷ 11
 *  - 수수료 = 판매가 × 율 (호출자가 수수료율 주입)
 *  - 실수령 = 판매가 - 수수료 - 부가세
 *  - 이익 = 실수령 - 원가
 *  - 률 = 이익 ÷ 원가 × 100  (원가 대비)
 *
 * 수수료율은 호출자(page.tsx)가 mw_channel_fees에서 fetch해서 주입.
 * 이 파일은 수수료율 값을 모름. 설정 변경 시 자동 반영.
 */

export type Channel = 'naver' | 'coupang_mp' | 'gmarket' | 'ssg';
export type FeeCategory = 'powertool' | 'handtool';

/** 채널 수수료율 (mw_channel_fees에서 호출자가 매핑해서 주입) */
export interface ChannelFeeRates {
  naver: number;                                          // 합계율 (예: 0.0663)
  coupang_mp: { powertool: number; handtool: number };   // 카테고리별 율
  gmarket: { powertool: number; handtool: number };
  ssg: number;                                            // 카테고리 무관 (예: 0.13)
}

export interface WholesaleMargin {
  vat: number;
  profit: number;
  rate: number;
}

export interface ChannelMargin {
  vat: number;
  fee: number;
  net: number;
  profit: number;
  rate: number;
}

// ============================================================
// 1. 도매 마진 (A/B/C 셀)
//    수수료 없음. 률은 원가 대비.
// ============================================================

export function calcWholesaleMargin(price: number, cost: number): WholesaleMargin | null {
  if (!price || price <= 0 || !cost || cost <= 0) return null;
  const vat = price / 11;
  const profit = price - vat - cost;
  const rate = (profit / cost) * 100;
  return {
    vat: Math.round(vat),
    profit: Math.round(profit),
    rate: Math.round(rate * 10) / 10,
  };
}

// ============================================================
// 2. 채널 마진 (스토어팜/쿠팡/오픈마켓/SSG)
//    모든 채널 VAT 포함. 률은 원가 대비.
// ============================================================

export function calcChannelMargin(
  price: number,
  cost: number,
  channel: Channel,
  category: FeeCategory,
  rates: ChannelFeeRates,
): ChannelMargin | null {
  if (!price || price <= 0 || !cost || cost <= 0) return null;

  const feeRate = resolveFeeRate(channel, category, rates);
  if (feeRate === null || isNaN(feeRate)) return null;

  const vat = price / 11;
  const fee = price * feeRate;
  const net = price - vat - fee;
  const profit = net - cost;
  const rate = (profit / cost) * 100;

  return {
    vat: Math.round(vat),
    fee: Math.round(fee),
    net: Math.round(net),
    profit: Math.round(profit),
    rate: Math.round(rate * 10) / 10,
  };
}

function resolveFeeRate(
  channel: Channel,
  category: FeeCategory,
  rates: ChannelFeeRates,
): number | null {
  switch (channel) {
    case 'naver': return rates.naver;
    case 'coupang_mp': return rates.coupang_mp[category];
    case 'gmarket': return rates.gmarket[category];
    case 'ssg': return rates.ssg;
    default: return null;
  }
}

// ============================================================
// 3. 카테고리 자동 분기 (B+C 조합)
//    1순위: override (수동)
//    2순위: 키워드 매칭 (자동)
//    3순위: handtool (보수적 기본값)
// ============================================================

const POWERTOOL_KEYWORDS = /전동|파워|충전|배터리|드릴|임팩트|그라인더|powertool/i;
const HANDTOOL_KEYWORDS = /수공|핸드|비트|날|디스크|팁|악세|소모|handtool/i;

export function detectCategory(
  rawCategory: string | null | undefined,
  override?: string | null,
): FeeCategory {
  if (override === 'powertool' || override === 'handtool') return override;
  if (rawCategory) {
    if (POWERTOOL_KEYWORDS.test(rawCategory)) return 'powertool';
    if (HANDTOOL_KEYWORDS.test(rawCategory)) return 'handtool';
  }
  return 'handtool';
}

// ============================================================
// 4. 기준 원가 결정 (채널 셀 4종 비교용)
//    원가/A/B/C 중 어느 것을 기준으로 마진을 계산할지 선택
// ============================================================

export type CostBase = 'cost' | 'priceA' | 'priceB' | 'priceC';

export function pickCostBase(
  base: CostBase,
  prices: { cost: number; priceA: number; priceB: number; priceC: number },
): number {
  switch (base) {
    case 'cost': return prices.cost;
    case 'priceA': return prices.priceA;
    case 'priceB': return prices.priceB;
    case 'priceC': return prices.priceC;
    default: return prices.cost;
  }
}
