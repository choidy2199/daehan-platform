/**
 * 마진 계산
 * 출처: public/manager/app.js:991 그대로 이식
 *
 * @param price 판매가 (VAT 포함)
 * @param cost 원가
 * @param feeRate 채널 수수료율 (예: 네이버 0.0663)
 * @returns 순이익(원 단위 절삭) + 마진율(%, 소수점 유지). 입력 0/falsy면 null.
 */
export function calcMargin(
  price: number,
  cost: number,
  feeRate: number
): { profit: number; rate: number } | null {
  if (!price || !cost) return null;
  const vat = price / 11;
  const fee = price * feeRate;
  const profit = price - vat - fee - cost;
  const rate = (profit / price) * 100;
  return { profit: Math.round(profit), rate };
}
