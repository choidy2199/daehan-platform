// ======================== 대한종합상사 자동발주 — Background Service Worker ========================

// daehantool.dev에서 메시지 수신
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('[자동발주] 외부 메시지 수신:', request);

    if (request.action === 'autoOrder') {
      handleAutoOrder(request.items, request.orderType)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 비동기 응답
    }

    if (request.action === 'checkStatus') {
      sendResponse({ installed: true, version: '1.0.0' });
    }
  }
);

// content script에서 메시지 수신
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    console.log('[자동발주] 내부 메시지 수신:', request);

    if (request.action === 'orderComplete') {
      // 주문 완료 처리
      chrome.storage.local.remove('pendingOrder');
      console.log('[자동발주] 주문 완료:', request.result);
      sendResponse({ success: true });
    }

    if (request.action === 'orderError') {
      console.error('[자동발주] 주문 실패:', request.error);
      sendResponse({ success: false, error: request.error });
    }

    if (request.action === 'loginComplete') {
      // 로그인 완료 → 주문 페이지로 이동
      console.log('[자동발주] 로그인 완료, 주문 페이지로 이동');
      chrome.storage.local.get('pendingOrder', (data) => {
        if (data.pendingOrder) {
          // TODO: 2단계에서 주문 유형에 따라 적절한 페이지로 이동
          chrome.tabs.update(sender.tab.id, {
            url: 'https://www.ttimilwaukeetool.co.kr/order/order.html'
          });
        }
      });
      sendResponse({ success: true });
    }

    return true;
  }
);

// 자동 주문 처리
async function handleAutoOrder(items, orderType) {
  if (!items || !items.length) {
    return { success: false, error: '주문 품목이 없습니다' };
  }

  // 로그인 정보 확인
  const creds = await chrome.storage.local.get(['ttiId', 'ttiPw']);
  if (!creds.ttiId || !creds.ttiPw) {
    return { success: false, error: 'TTI 로그인 정보가 설정되지 않았습니다. 확장 프로그램 팝업에서 설정해주세요.' };
  }

  // 1. TTI 사이트 탭 열기
  const tab = await chrome.tabs.create({
    url: 'https://www.ttimilwaukeetool.co.kr/login/login.html',
    active: true
  });

  // 2. 주문 데이터 저장 (content-tti.js가 읽어서 처리)
  await chrome.storage.local.set({
    pendingOrder: {
      items: items,
      orderType: orderType || 'normal',
      tabId: tab.id,
      createdAt: new Date().toISOString()
    }
  });

  return { success: true, message: '자동 발주 시작됨', tabId: tab.id };
}

// ========================================
// Phase 1-1: 스크래핑 조율 (background 주도)
// 페이지 리로드에도 상태 유지 (chrome.storage.local)
// ========================================

var daehanTabId = null;

// content-daehan.js에서 스크래핑 시작 요청
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === 'startScrapeProducts') {
      console.log('[BG] 스크래핑 시작 요청 (from tab ' + sender.tab.id + ')');
      handleStartScrape(sender.tab.id)
        .then(function() { sendResponse({ success: true }); })
        .catch(function(err) { sendResponse({ success: false, error: err.message }); });
      return true;
    }

    // content-tti.js에서 한 페이지 완료
    if (request.type === 'scrapePageDone') {
      handleScrapePageDone(request);
      sendResponse({ ok: true });
    }

    // content-tti.js에서 에러
    if (request.type === 'scrapeError') {
      console.error('[BG] 스크래핑 에러:', request.error);
      notifyDaehan({ type: 'DAEHAN_SCRAPE_RESULT', success: false, error: request.error });
      // 작업 비활성화
      chrome.storage.local.get('scrapeJob', function(data) {
        if (data.scrapeJob) {
          data.scrapeJob.active = false;
          chrome.storage.local.set({ scrapeJob: data.scrapeJob });
        }
      });
      sendResponse({ ok: true });
    }
  }
);

// 스크래핑 작업 시작
async function handleStartScrape(senderTabId) {
  daehanTabId = senderTabId;
  console.log('[BG] 스크래핑 작업 시작');

  // scrapeJob 초기화
  await chrome.storage.local.set({
    scrapeJob: {
      active: true,
      currentPage: 1,
      totalPages: 0,
      results: [],
      startTime: Date.now()
    }
  });

  // TTI 사이트 탭 찾기/열기
  var tabs = await chrome.tabs.query({ url: '*://www.ttimilwaukeetool.co.kr/*' });
  var ttiTabId;

  if (tabs.length > 0) {
    ttiTabId = tabs[0].id;
    await chrome.tabs.update(ttiTabId, {
      url: 'https://www.ttimilwaukeetool.co.kr/product/product_search.html?num_per_page=5000'
    });
    console.log('[BG] 기존 TTI 탭 이동:', ttiTabId);
  } else {
    var tab = await chrome.tabs.create({
      url: 'https://www.ttimilwaukeetool.co.kr/product/product_search.html?num_per_page=5000'
    });
    ttiTabId = tab.id;
    console.log('[BG] 새 TTI 탭 생성:', ttiTabId);
  }

  await chrome.storage.local.set({ ttiTabId: ttiTabId });
  notifyDaehan({ type: 'DAEHAN_SCRAPE_PROGRESS', current: 0, total: 0, count: 0, status: '제품검색 페이지 로딩 중...' });
}

// 스크래핑 완료 처리 (num_per_page=5000 → 한 번에 전체 로드)
async function handleScrapePageDone(data) {
  var stored = await chrome.storage.local.get('scrapeJob');
  var job = stored.scrapeJob;
  if (!job || !job.active) return;

  // 결과 저장 + 완료
  job.results = data.products;
  job.active = false;
  job.endTime = Date.now();
  await chrome.storage.local.set({ scrapeJob: job });

  await chrome.storage.local.set({
    tti_products: { data: job.results, count: job.results.length, scrapedAt: new Date().toISOString() }
  });

  var elapsed = ((job.endTime - job.startTime) / 1000).toFixed(1);
  console.log('[BG] 스크래핑 완료: ' + job.results.length + '건 (' + elapsed + '초)' + (data.hasMorePages ? ' ⚠ 추가 페이지 있음' : ''));

  notifyDaehan({
    type: 'DAEHAN_SCRAPE_RESULT',
    success: true,
    data: job.results,
    totalCount: job.results.length,
    elapsed: elapsed
  });
}

// ========================================
// Phase 1-2: 프로모션 4종 스크래핑
// ========================================

var TTI_PROMO_URLS = [
  { type: 'normalOrder', url: 'https://www.ttimilwaukeetool.co.kr/promotion/promotion_normal_order.html', name: '일반주문' },
  { type: 'kitPackage', url: 'https://www.ttimilwaukeetool.co.kr/promotion/promotion_D_list.html', name: '키트구성패키지' },
  { type: 'specialDeal', url: 'https://www.ttimilwaukeetool.co.kr/promotion/promotion_T_list.html', name: '이달의 특가' },
  { type: 'package', url: 'https://www.ttimilwaukeetool.co.kr/promotion/promotion_E_list.html', name: '패키지 프로모션' }
];

// 프로모션 메시지 처리 (기존 리스너에 통합)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startScrapePromotions' || request.type === 'startScrapePromotions') {
    if (sender && sender.tab) daehanTabId = sender.tab.id;
    (async function() {
      console.log('[BG] 프로모션 스크래핑 시작');
      await chrome.storage.local.set({
        scrapeJob: { active: true, mode: 'promotions', currentIndex: 0, results: {}, startTime: Date.now() }
      });
      var tabs = await chrome.tabs.query({ url: '*://www.ttimilwaukeetool.co.kr/*' });
      var ttiTabId;
      if (tabs.length > 0) {
        ttiTabId = tabs[0].id;
        await chrome.tabs.update(ttiTabId, { url: TTI_PROMO_URLS[0].url });
      } else {
        var tab = await chrome.tabs.create({ url: TTI_PROMO_URLS[0].url });
        ttiTabId = tab.id;
      }
      await chrome.storage.local.set({ ttiTabId: ttiTabId });
      notifyDaehan({ type: 'DAEHAN_SCRAPE_PROGRESS', current: 0, total: TTI_PROMO_URLS.length, count: 0, status: TTI_PROMO_URLS[0].name + ' 로딩 중...' });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.type === 'scrapePromoDone') {
    (async function() {
      var stored = await chrome.storage.local.get('scrapeJob');
      var job = stored.scrapeJob;
      if (!job || !job.active || job.mode !== 'promotions') return;

      job.results[request.promoType] = request.data;
      var nextIndex = job.currentIndex + 1;

      console.log('[BG] 프로모션 ' + request.promoType + ': ' + request.data.length + '건');

      if (nextIndex < TTI_PROMO_URLS.length) {
        job.currentIndex = nextIndex;
        await chrome.storage.local.set({ scrapeJob: job });
        var ttiData = await chrome.storage.local.get('ttiTabId');
        if (ttiData.ttiTabId) await chrome.tabs.update(ttiData.ttiTabId, { url: TTI_PROMO_URLS[nextIndex].url });
        notifyDaehan({ type: 'DAEHAN_SCRAPE_PROGRESS', current: nextIndex, total: TTI_PROMO_URLS.length, count: Object.keys(job.results).length, status: TTI_PROMO_URLS[nextIndex].name + ' 스크래핑 중...' });
      } else {
        job.active = false;
        job.endTime = Date.now();
        await chrome.storage.local.set({ scrapeJob: job });
        await chrome.storage.local.set({ tti_promotions: { data: job.results, scrapedAt: new Date().toISOString() } });
        var elapsed = ((job.endTime - job.startTime) / 1000).toFixed(1);
        console.log('[BG] 프로모션 완료 (' + elapsed + '초):', Object.keys(job.results).map(function(k) { return k + ':' + job.results[k].length; }).join(', '));
        notifyDaehan({ type: 'DAEHAN_SCRAPE_PROMO_RESULT', data: job.results, elapsed: elapsed });
      }
    })();
    sendResponse({ ok: true });
    return true;
  }
});

// daehantool.dev 탭에 메시지 전달
function notifyDaehan(message) {
  if (daehanTabId) {
    chrome.tabs.sendMessage(daehanTabId, message).catch(function(e) {
      console.log('[BG] daehantool.dev 통신 실패:', e.message);
    });
  }
}
