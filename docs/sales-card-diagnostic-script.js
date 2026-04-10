// ============================================================
// 매출카드 집계 정확도 진단 스크립트
// 사용법: daehantool.dev 에 로그인한 상태에서 브라우저 콘솔(F12)에 붙여넣기
// 결과: 콘솔에 JSON으로 출력 — 복사해서 Claude에 붙여주세요
// ============================================================
(function() {
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var products = JSON.parse(localStorage.getItem('mw_products') || '[]');

  // ===== 공통 유틸 =====
  function normalizeTtiCode(code) { return String(code || '').replace(/^0+/, ''); }
  function getMonthRange(date) {
    var y = date.getFullYear(), m = date.getMonth();
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
  }
  function getQuarterRange(date) {
    var y = date.getFullYear(), m = date.getMonth();
    var q = Math.floor(m / 3);
    return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0, 23, 59, 59) };
  }

  // ===== catMap 재구성 (calcPOSalesData line 2542) =====
  var catMap = {};
  var catMapNormalized = {};
  products.forEach(function(p) {
    if (p.ttiNum) {
      catMap[p.ttiNum] = p.category || '';
      catMapNormalized[normalizeTtiCode(p.ttiNum)] = p.category || '';
    }
    if (p.code) catMap[p.code] = p.category || '';
  });

  var now = new Date();
  var monthRange = getMonthRange(now);
  var quarterRange = getQuarterRange(now);

  // ============================================================
  // 1. 대분류 매칭 정확도
  // ============================================================
  var section1 = {
    total: history.length,
    // buildPOListPanel 스타일 매칭 (normalizeTtiCode 적용)
    display_matchedByNormalizedTtiNum: 0,
    display_matchedByCode: 0,
    display_noMatch: 0,
    display_categoryResolved: 0,
    display_categoryEmpty: 0,
    // calcPOSalesData catMap 매칭 (normalize 미적용)
    calc_matchedByTtiNum: 0,
    calc_matchedByManageCode: 0,
    calc_noMatch: 0,
    // 저장된 category 필드 vs 조회
    history_hasCategoryField: 0,
    history_emptyCategoryField: 0,
    history_categoryMismatch: 0, // 저장된 값과 조회된 값이 다른 경우
  };

  history.forEach(function(item) {
    // display 경로 (buildPOListPanel line 3287~3300)
    var _pCode = item.ttiNum || item.manageCode || '';
    var _normCode = normalizeTtiCode(_pCode);
    var _matched = products.find(function(pr) {
      return (pr.ttiNum && normalizeTtiCode(pr.ttiNum) === _normCode) || (pr.code && pr.code === _pCode);
    });
    if (_matched) {
      if (_matched.ttiNum && normalizeTtiCode(_matched.ttiNum) === _normCode) section1.display_matchedByNormalizedTtiNum++;
      else section1.display_matchedByCode++;
      if (_matched.category) section1.display_categoryResolved++;
      else section1.display_categoryEmpty++;
    } else {
      section1.display_noMatch++;
      section1.display_categoryEmpty++;
    }

    // calc 경로 (calcPOSalesData line 2554)
    var calcCat = catMap[item.ttiNum] || catMap[item.manageCode] || '';
    if (catMap[item.ttiNum]) section1.calc_matchedByTtiNum++;
    else if (catMap[item.manageCode]) section1.calc_matchedByManageCode++;
    else section1.calc_noMatch++;

    // history 자체 필드 vs 조회
    if (item.category) {
      section1.history_hasCategoryField++;
      if (_matched && _matched.category && item.category !== _matched.category) section1.history_categoryMismatch++;
    } else {
      section1.history_emptyCategoryField++;
    }
  });

  // ============================================================
  // 2. calcPOSalesData 매출카드 집계 검증
  // ============================================================
  var section2 = {
    monthRange: [monthRange.start.toISOString(), monthRange.end.toISOString()],
    quarterRange: [quarterRange.start.toISOString(), quarterRange.end.toISOString()],
    thisMonth_total: 0,
    thisMonth_count: 0,
    thisMonth_normal_count: 0,
    thisMonth_promo_count: 0,
    thisMonth_dryRun_count: 0,
    powerTool: { count: 0, amount: 0 },
    handTool: { count: 0, amount: 0 },
    packout: { count: 0, amount: 0 },
    first15: 0,
    last15: 0,
    // isNormal 판정 세부
    subtab_normal: 0,
    subtab_other: 0,
    subtab_missing_typeNormal: 0,
    subtab_missing_typeOther: 0,
    // 카테고리별 총집계 (월 기준, 필터 무관)
    catBuckets: {}
  };

  history.forEach(function(item) {
    if (item.dryRun) { section2.thisMonth_dryRun_count++; return; }
    var d = new Date(item.date);
    var amt = item.amount || 0;
    var cat = catMap[item.ttiNum] || catMap[item.manageCode] || '';
    var isNormal = item.subtab ? item.subtab === 'normal' : item.type === 'normal';

    // isNormal 판정 경로
    if (item.subtab) {
      if (item.subtab === 'normal') section2.subtab_normal++;
      else section2.subtab_other++;
    } else {
      if (item.type === 'normal') section2.subtab_missing_typeNormal++;
      else section2.subtab_missing_typeOther++;
    }

    // 카테고리 버킷
    var catKey = cat || '(빈값)';
    if (!section2.catBuckets[catKey]) section2.catBuckets[catKey] = { count: 0, amount: 0 };
    section2.catBuckets[catKey].count++;
    section2.catBuckets[catKey].amount += amt;

    // 이번달 집계
    if (d >= monthRange.start && d <= monthRange.end) {
      section2.thisMonth_count++;
      section2.thisMonth_total += amt;
      if (isNormal) section2.thisMonth_normal_count++;
      else section2.thisMonth_promo_count++;
      if (d.getDate() <= 15) section2.first15 += amt;
      else section2.last15 += amt;

      if (isNormal && cat === '파워툴') { section2.powerTool.count++; section2.powerTool.amount += amt; }
      if (isNormal && cat === '팩아웃') { section2.packout.count++; section2.packout.amount += amt; }
    }
    // 수공구+악세: 분기 범위
    if (isNormal && (cat === '수공구' || cat === '악세사리' || cat === '액세서리') && d >= quarterRange.start && d <= quarterRange.end) {
      section2.handTool.count++;
      section2.handTool.amount += amt;
    }
  });

  section2.sumCards = section2.powerTool.amount + section2.handTool.amount + section2.packout.amount;
  section2.gapVsTotal = section2.thisMonth_total - section2.sumCards;

  // ============================================================
  // 3. Phase 2 데이터 문제점
  // ============================================================
  var section3 = {
    tti_scrape_items_count: 0, // source === 'tti-scrape-items'
    tti_scrape_count: 0,        // source === 'tti-scrape'
    auto_order_count: 0,        // source 없음 or 다른 값
    category_empty_in_scrapeItems: 0,
    category_empty_in_scrape: 0,
    costPrice_zero_total: 0,
    costPrice_zero_scrapeItems: 0,
    costPrice_zero_scrape: 0,
    supplyPrice_present: 0,
    ttiSupplyPrice_present: 0,
    ttiUnitPrice_present: 0,
    supply_eq_ttiSupply: 0,
    supply_ne_ttiSupply: 0,
    sample_scrapeItem: null
  };

  history.forEach(function(item) {
    var src = item.source || 'autoOrder';
    if (src === 'tti-scrape-items') {
      section3.tti_scrape_items_count++;
      if (!item.category) section3.category_empty_in_scrapeItems++;
      if (!item.costPrice) section3.costPrice_zero_scrapeItems++;
      if (!section3.sample_scrapeItem) {
        section3.sample_scrapeItem = {
          supplyPrice: item.supplyPrice,
          ttiSupplyPrice: item.ttiSupplyPrice,
          ttiUnitPrice: item.ttiUnitPrice,
          costPrice: item.costPrice,
          category: item.category,
          ttiNum: item.ttiNum,
          manageCode: item.manageCode
        };
      }
    } else if (src === 'tti-scrape') {
      section3.tti_scrape_count++;
      if (!item.category) section3.category_empty_in_scrape++;
      if (!item.costPrice) section3.costPrice_zero_scrape++;
    } else {
      section3.auto_order_count++;
    }
    if (!item.costPrice) section3.costPrice_zero_total++;
    if (item.supplyPrice) section3.supplyPrice_present++;
    if (item.ttiSupplyPrice) section3.ttiSupplyPrice_present++;
    if (item.ttiUnitPrice) section3.ttiUnitPrice_present++;
    if (item.supplyPrice === item.ttiSupplyPrice) section3.supply_eq_ttiSupply++;
    else section3.supply_ne_ttiSupply++;
  });

  // ============================================================
  // 4. ttiPromotion 값 분포
  // ============================================================
  var promoDist = {};
  history.forEach(function(item) {
    var key = item.ttiPromotion || '(필드없음)';
    promoDist[key] = (promoDist[key] || 0) + 1;
  });

  var result = {
    generatedAt: new Date().toISOString(),
    historyTotal: history.length,
    productsTotal: products.length,
    section1_matchingAccuracy: section1,
    section2_salesCards: section2,
    section3_phase2Issues: section3,
    section4_ttiPromotionDist: promoDist
  };

  console.log('===== 진단 결과 (복사해서 Claude에 전달) =====');
  console.log(JSON.stringify(result, null, 2));
  console.log('===============================================');
  return result;
})();
