// ======================== 대한종합상사 자동발주 — daehantool.dev Content Script ========================

// daehantool.dev 페이지에서 확장 프로그램과 통신

// 확장 프로그램 설치 확인 신호
window.postMessage({ type: 'DAEHAN_EXTENSION_READY', version: '1.0.0' }, '*');

// daehantool.dev에서 메시지 수신
window.addEventListener('message', function(event) {
  if (event.source !== window) return;

  // 자동 발주 요청
  if (event.data.type === 'DAEHAN_AUTO_ORDER') {
    console.log('[자동발주-대한] 주문 요청 수신:', event.data);

    chrome.runtime.sendMessage({
      action: 'autoOrder',
      items: event.data.items,
      orderType: event.data.orderType
    }, function(response) {
      window.postMessage({
        type: 'DAEHAN_ORDER_RESULT',
        success: response ? response.success : false,
        message: response ? response.message : '확장 프로그램 응답 없음',
        error: response ? response.error : null
      }, '*');
    });
  }

  // 확장 프로그램 상태 확인
  if (event.data.type === 'DAEHAN_CHECK_EXTENSION') {
    chrome.runtime.sendMessage({ action: 'checkStatus' }, function(response) {
      window.postMessage({
        type: 'DAEHAN_EXTENSION_STATUS',
        installed: response ? response.installed : false,
        version: response ? response.version : null
      }, '*');
    });
  }
});

// ========================================
// Phase 1-1: 스크래핑 요청/수신
// ========================================

// daehantool.dev에서 스크래핑 요청 수신
window.addEventListener('message', function(event) {
  if (event.source !== window) return;

  if (event.data && event.data.type === 'DAEHAN_SCRAPE_PRODUCTS') {
    console.log('[스크래핑-대한] 스크래핑 요청 수신');
    chrome.runtime.sendMessage({
      action: 'startScrapeProducts'
    }, function(response) {
      if (response && response.success) {
        console.log('[스크래핑-대한] 스크래핑 시작됨');
      } else {
        window.postMessage({
          type: 'DAEHAN_SCRAPE_RESULT',
          success: false,
          error: response ? response.error : '확장 프로그램 응답 없음'
        }, '*');
      }
    });
  }
});

// background.js에서 진행 상황/결과 수신
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'DAEHAN_SCRAPE_PROGRESS') {
    window.postMessage(message, '*');
    sendResponse({ ok: true });
  }
  if (message.type === 'DAEHAN_SCRAPE_RESULT') {
    window.postMessage(message, '*');
    sendResponse({ ok: true });
  }
  // Phase 1-2: 프로모션 결과
  if (message.type === 'DAEHAN_SCRAPE_PROMO_RESULT') {
    window.postMessage(message, '*');
    sendResponse({ ok: true });
  }
});

// Phase 1-2: 프로모션 스크래핑 요청
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'DAEHAN_SCRAPE_PROMOTIONS') {
    console.log('[content-daehan] 프로모션 스크래핑 요청');
    chrome.runtime.sendMessage({ action: 'startScrapePromotions' });
  }
});

console.log('[자동발주-대한] Content script 로드 완료 (v1.1 + 스크래핑)');
