'use client';

import { useMemo } from 'react';

interface UseAdSimulatorInput {
  sellingPrice: number;
  marginRate: number;   // 0~1 소수
  adCostRatio: number;  // 0~1 소수
  targetRoas: number;   // 백분율 정수 (예: 500)
}

interface UseAdSimulatorResult {
  marginAmount: number;
  adCostPerSale: number;
  recommendedBid: number;
  dailyBudget: number;
  expectedDailyRevenue: number;
  expectedDailyAdCost: number;
}

export function useAdSimulator(input: UseAdSimulatorInput): UseAdSimulatorResult {
  const { sellingPrice, marginRate, adCostRatio, targetRoas } = input;
  return useMemo(() => {
    const marginAmount = sellingPrice * marginRate;
    const adCostPerSale = marginAmount * adCostRatio;
    const recommendedBid = adCostPerSale;
    const dailyBudget = recommendedBid * 50;
    const expectedDailyRevenue = dailyBudget * (targetRoas / 100);
    const expectedDailyAdCost = dailyBudget;
    return {
      marginAmount: Math.round(marginAmount),
      adCostPerSale: Math.round(adCostPerSale),
      recommendedBid: Math.round(recommendedBid),
      dailyBudget: Math.round(dailyBudget),
      expectedDailyRevenue: Math.round(expectedDailyRevenue),
      expectedDailyAdCost: Math.round(expectedDailyAdCost),
    };
  }, [sellingPrice, marginRate, adCostRatio, targetRoas]);
}
