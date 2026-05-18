import { calcMargin } from './calcMargin';

/**
 * 손익분기 ROAS 계산
 * "광고비 X원 쓰면 매출이 (X * roas/100)원 나야 본전" 의 roas 값(%).
 *
 * 공식: (price / 순이익) * 100
 *
 * @param price 판매가 (VAT 포함)
 * @param cost 원가
 * @param feeRate 채널 수수료율
 * @returns 손익분기 ROAS(%). 입력 falsy 또는 순이익 ≤ 0이면 null.
 */
export function breakEvenRoas(
  price: number,
  cost: number,
  feeRate: number
): number | null {
  const margin = calcMargin(price, cost, feeRate);
  if (!margin) return null;
  if (margin.profit <= 0) return null;
  return (price / margin.profit) * 100;
}
