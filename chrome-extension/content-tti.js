// ======================== 대한종합상사 자동발주 — TTI 사이트 Content Script ========================

(async function() {
  const url = window.location.href;
  console.log('[자동발주-TTI] 페이지 로드:', url);

  // 로그인 페이지
  if (url.includes('/login/login.html') || url.includes('/login/')) {
    await waitForDOM();
    await handleLogin();
  }

  // 주문 페이지
  if (url.includes('/order/')) {
    await waitForDOM();
    await handleOrder();
  }

  // 메인 페이지 (로그인 성공 후 리다이렉트)
  if (url.includes('/main/') || url === 'https://www.ttimilwaukeetool.co.kr/') {
    const data = await chrome.storage.local.get('pendingOrder');
    if (data.pendingOrder) {
      console.log('[자동발주-TTI] 로그인 성공, 주문 페이지로 이동');
      chrome.runtime.sendMessage({ action: 'loginComplete' });
    }
  }
})();

// DOM 준비 대기
function waitForDOM() {
  return new Promise(resolve => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(resolve, 500);
    } else {
      document.addEventListener('DOMContentLoaded', () => setTimeout(resolve, 500));
    }
  });
}

// 요소 대기 유틸리티
function waitForElement(selector, timeout) {
  timeout = timeout || 5000;
  return new Promise((resolve, reject) => {
    var el = document.querySelector(selector);
    if (el) return resolve(el);

    var observer = new MutationObserver(function() {
      el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function() {
      observer.disconnect();
      reject(new Error('요소를 찾을 수 없음: ' + selector));
    }, timeout);
  });
}

// 로그인 처리
async function handleLogin() {
  console.log('[자동발주-TTI] 로그인 시작');

  // 1. chrome.storage.local에서 ttiId, ttiPw 가져오기
  var creds = await chrome.storage.local.get(['ttiId', 'ttiPw']);
  if (!creds.ttiId || !creds.ttiPw) {
    console.error('[자동발주-TTI] 로그인 정보 없음');
    chrome.runtime.sendMessage({ action: 'orderError', error: 'TTI 로그인 정보가 없습니다' });
    return;
  }

  // 2. 로그인 페이지의 ID/PW input 찾기
  var idInput, pwInput, loginBtn;
  try {
    idInput = await waitForElement('input[name="userId"], #userId, input[type="text"]', 5000);
  } catch(e) {
    console.error('[자동발주-TTI] ID 입력란을 찾을 수 없음');
    chrome.runtime.sendMessage({ action: 'orderError', error: '로그인 ID 입력란을 찾을 수 없습니다' });
    return;
  }

  pwInput = document.querySelector('input[name="userPw"]')
    || document.querySelector('#userPw')
    || document.querySelector('input[type="password"]');

  if (!pwInput) {
    console.error('[자동발주-TTI] PW 입력란을 찾을 수 없음');
    chrome.runtime.sendMessage({ action: 'orderError', error: '로그인 PW 입력란을 찾을 수 없습니다' });
    return;
  }

  // 3. 값 입력 (기존 값 클리어 후 입력 + change 이벤트도 발생)
  idInput.focus();
  idInput.value = '';
  idInput.value = creds.ttiId;
  idInput.dispatchEvent(new Event('input', { bubbles: true }));
  idInput.dispatchEvent(new Event('change', { bubbles: true }));

  await sleep(300);

  pwInput.focus();
  pwInput.value = '';
  pwInput.value = creds.ttiPw;
  pwInput.dispatchEvent(new Event('input', { bubbles: true }));
  pwInput.dispatchEvent(new Event('change', { bubbles: true }));

  // 4. LOGIN 버튼 클릭
  loginBtn = document.querySelector('.login-btn')
    || document.querySelector('button[type="submit"]')
    || document.querySelector('.btn-login')
    || document.querySelector('input[type="submit"]')
    || document.querySelector('a.btn_login');

  await sleep(500);

  if (loginBtn) {
    console.log('[자동발주-TTI] 로그인 버튼 클릭');
    loginBtn.click();
  } else {
    // 폼 서브밋 fallback
    var form = idInput.closest('form');
    if (form) {
      console.log('[자동발주-TTI] 폼 서브밋');
      form.submit();
    } else {
      console.error('[자동발주-TTI] 로그인 버튼/폼을 찾을 수 없음');
      chrome.runtime.sendMessage({ action: 'orderError', error: '로그인 버튼을 찾을 수 없습니다' });
    }
  }

  // 5. 로그인 성공 여부는 메인 페이지 리다이렉트에서 처리 (IIFE 상단의 /main/ 분기)
}

// sleep 유틸리티
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// input에 값 입력 (네이티브 이벤트 시뮬레이션)
function setInputValue(el, value) {
  el.focus();
  el.value = '';
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('keyup', { bubbles: true }));
}

// 주문 처리
async function handleOrder() {
  var data = await chrome.storage.local.get('pendingOrder');
  if (!data.pendingOrder) {
    console.log('[자동발주-TTI] 대기 중인 주문 없음');
    return;
  }

  var order = data.pendingOrder;
  var items = order.items;
  console.log('[자동발주-TTI] 주문 처리 시작:', items.length + '건');

  var successCount = 0;
  var failedItems = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    console.log('[자동발주-TTI] 품목 ' + (i + 1) + '/' + items.length + ':', item.code, '수량:', item.qty);

    try {
      // 1. 순번(품번) input 찾기
      var codeInput = document.querySelector('input[name="prdNo"]')
        || document.querySelector('input[name="searchPrdNo"]')
        || document.querySelector('.search-input input')
        || document.querySelector('input[placeholder*="순번"]')
        || document.querySelector('input[placeholder*="품번"]');

      if (!codeInput) {
        throw new Error('순번 입력란을 찾을 수 없음');
      }

      // 순번 입력
      setInputValue(codeInput, item.code);
      await sleep(300);

      // 2. 등록/검색 버튼 클릭
      var searchBtn = document.querySelector('.btn-search')
        || document.querySelector('button[onclick*="search"]')
        || document.querySelector('button[onclick*="add"]')
        || document.querySelector('input[type="button"][value*="등록"]')
        || document.querySelector('input[type="button"][value*="검색"]')
        || document.querySelector('a[onclick*="search"]');

      if (searchBtn) {
        searchBtn.click();
        await sleep(1000); // 검색 결과 대기
      } else {
        // Enter 키로 검색 시도
        codeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        await sleep(1000);
      }

      // 3. 수량 입력
      var qtyInput = document.querySelector('input[name="orderQty"]')
        || document.querySelector('input[name="qty"]')
        || document.querySelector('input[type="number"]')
        || document.querySelector('input[placeholder*="수량"]');

      if (qtyInput) {
        setInputValue(qtyInput, String(item.qty));
        await sleep(300);
      } else {
        console.warn('[자동발주-TTI] 수량 입력란 못 찾음, 기본값 사용');
      }

      successCount++;
      console.log('[자동발주-TTI] 품목 등록 완료:', item.code);

    } catch (err) {
      console.error('[자동발주-TTI] 품목 등록 실패:', item.code, err.message);
      failedItems.push({ code: item.code, error: err.message });
    }

    // 다음 품목 전 대기
    await sleep(500);
  }

  // 4. 바로주문 클릭 전 confirm 팝업 (실수 방지)
  if (successCount > 0) {
    var msg = '[자동발주] 총 ' + items.length + '건 중 ' + successCount + '건 입력 완료.\n';
    if (failedItems.length > 0) {
      msg += '실패: ' + failedItems.map(function(f) { return f.code; }).join(', ') + '\n';
    }
    msg += '\n바로주문을 진행하시겠습니까?';

    if (confirm(msg)) {
      var orderBtn = document.querySelector('button[onclick*="order"]')
        || document.querySelector('.btn-order')
        || document.querySelector('input[type="button"][value*="바로주문"]')
        || document.querySelector('a[onclick*="order"]');

      if (orderBtn) {
        console.log('[자동발주-TTI] 바로주문 클릭');
        orderBtn.click();
      } else {
        console.warn('[자동발주-TTI] 바로주문 버튼을 찾을 수 없음');
      }
    } else {
      console.log('[자동발주-TTI] 사용자가 바로주문 취소');
    }
  }

  // 주문 결과 전송
  chrome.runtime.sendMessage({
    action: 'orderComplete',
    result: {
      itemCount: items.length,
      successCount: successCount,
      failedItems: failedItems,
      orderType: order.orderType
    }
  });
}

// ========================================
// Phase 1-1: TTI 제품검색 스크래핑
// background 조율 방식: 페이지 로드 시 자동 스크래핑
// ========================================

// 현재 페이지의 제품 테이블 스크래핑
function scrapeProductSearchPage() {
  var table = document.querySelector('table.table_1');
  if (!table) {
    console.log('[스크래핑-TTI] table.table_1을 찾을 수 없음');
    console.log('[스크래핑-TTI] 페이지 테이블:', document.querySelectorAll('table').length + '개');
    return [];
  }

  var rows = table.querySelectorAll('tr');
  var products = [];

  // rows[0]은 헤더, rows[1]부터 데이터
  for (var i = 1; i < rows.length; i++) {
    var cells = rows[i].querySelectorAll('td');
    if (cells.length < 8) continue;

    try {
      var product = {
        promoNo: cells[0].textContent.trim(),
        category: cells[1].textContent.trim(),
        subCategory: cells[2].textContent.trim(),
        imageUrl: '',
        productCode: '',
        modelName: '',
        supplyPrice: 0,
        available: false
      };

      // td[3] 제품사진
      var img = cells[3].querySelector('img');
      if (img) product.imageUrl = img.src || '';

      // td[4] 제품번호 (strong 태그)
      var codeStrong = cells[4].querySelector('strong');
      product.productCode = codeStrong ? codeStrong.textContent.trim() : cells[4].textContent.trim();

      // td[5] 모델명 (strong 태그)
      var nameStrong = cells[5].querySelector('strong');
      product.modelName = nameStrong ? nameStrong.textContent.trim() : cells[5].textContent.trim();

      // td[6] 공급가 (콤마 제거 → 숫자)
      var priceStrong = cells[6].querySelector('strong');
      var priceText = priceStrong ? priceStrong.textContent.trim() : cells[6].textContent.trim();
      product.supplyPrice = parseInt(priceText.replace(/,/g, ''), 10) || 0;

      // td[7] 가용수량 (stock_a = 재고있음, stock_c = 소진)
      var stockSpan = cells[7].querySelector('span');
      if (stockSpan) {
        product.available = stockSpan.classList.contains('stock_a');
      }

      // 빈 제품번호 스킵
      if (product.productCode) {
        products.push(product);
      }
    } catch (e) {
      console.log('[스크래핑-TTI] 행 ' + i + ' 파싱 에러:', e.message);
    }
  }

  console.log('[스크래핑-TTI] 현재 페이지: ' + products.length + '건 추출');
  return products;
}

// ========================================
// Phase 1-2: TTI 프로모션 스크래핑
// ========================================

// 프로모션 페이지 범용 테이블 스크래핑 (헤더 기반)
function scrapePromoPage() {
  var table = document.querySelector('table.table_1');
  if (!table || table.rows.length < 2) {
    table = document.querySelector('table.table_2');
  }
  if (!table || table.rows.length < 2) {
    var tables = document.querySelectorAll('table');
    var maxRows = 0;
    tables.forEach(function(t) { if (t.rows.length > maxRows) { maxRows = t.rows.length; table = t; } });
  }
  if (!table || table.rows.length < 2) {
    console.log('[스크래핑-TTI] 프로모션 테이블을 찾을 수 없음');
    return [];
  }

  var headers = [];
  var headerCells = table.rows[0].querySelectorAll('th, td');
  headerCells.forEach(function(cell) { headers.push(cell.textContent.trim()); });
  console.log('[스크래핑-TTI] 프로모션 헤더:', headers.join(', '));

  var items = [];
  for (var i = 1; i < table.rows.length; i++) {
    var cells = table.rows[i].querySelectorAll('td');
    if (cells.length < 3) continue;
    try {
      var item = {};
      for (var j = 0; j < cells.length && j < headers.length; j++) {
        var key = headers[j] || ('col' + j);
        var strong = cells[j].querySelector('strong');
        item[key] = (strong ? strong.textContent : cells[j].textContent).trim();
      }
      var img = table.rows[i].querySelector('img');
      if (img && img.src) item._imageUrl = img.src;
      var link = table.rows[i].querySelector('a[href*="promotion"], a[href*="order"]');
      if (link) item._linkUrl = link.href;
      var stockSpan = table.rows[i].querySelector('span.stock_a, span.stock_c');
      if (stockSpan) item._available = stockSpan.classList.contains('stock_a');
      items.push(item);
    } catch (e) {
      console.log('[스크래핑-TTI] 프로모션 행 ' + i + ' 에러:', e.message);
    }
  }
  console.log('[스크래핑-TTI] 프로모션 ' + items.length + '건 추출');
  return items;
}

function detectPromoType() {
  var url = location.href;
  if (url.indexOf('promotion_normal_order') !== -1) return 'normalOrder';
  if (url.indexOf('promotion_D_list') !== -1) return 'kitPackage';
  if (url.indexOf('promotion_T_list') !== -1) return 'specialDeal';
  if (url.indexOf('promotion_E_list') !== -1) return 'package';
  return 'unknown';
}

function scrapeSpecialDealList() {
  var items = scrapePromoPage();
  var table = document.querySelector('table.table_1') || document.querySelector('table');
  if (table) {
    for (var i = 1; i < table.rows.length && (i - 1) < items.length; i++) {
      var links = table.rows[i].querySelectorAll('a');
      links.forEach(function(a) {
        if (a.href && (a.href.indexOf('order') !== -1 || a.href.indexOf('promotion') !== -1)) {
          items[i - 1]._orderUrl = a.href;
        }
      });
      var btns = table.rows[i].querySelectorAll('button, input[type="button"]');
      btns.forEach(function(btn) {
        var onclick = btn.getAttribute('onclick') || '';
        if (onclick) items[i - 1]._onclick = onclick;
      });
    }
  }
  return items;
}

// ========================================
// 페이지 로드 시 자동 스크래핑 (제품 + 프로모션)
// ========================================

async function checkAndScrape() {
  var jobData = await chrome.storage.local.get('scrapeJob');
  var job = jobData.scrapeJob;
  if (!job || !job.active) return;

  // ---- Phase 1-1: 제품 검색 페이지 ----
  if (location.href.indexOf('product_search') !== -1 && job.mode !== 'promotions') {
    try {
      console.log('[스크래핑-TTI] 전체 제품 스크래핑 시작 (num_per_page=5000)...');
      var retries = 0;
      while (!document.querySelector('table.table_1') && retries < 30) {
        await new Promise(function(r) { setTimeout(r, 500); });
        retries++;
      }
      if (!document.querySelector('table.table_1')) {
        chrome.runtime.sendMessage({ type: 'scrapeError', error: '테이블을 찾을 수 없음' });
        return;
      }
      await new Promise(function(r) { setTimeout(r, 2000); });

      var products = scrapeProductSearchPage();
      var maxPage = 1;
      document.querySelectorAll('a').forEach(function(a) {
        var num = parseInt(a.textContent.trim());
        if (!isNaN(num) && num > maxPage && a.href && a.href.indexOf('product_search') !== -1) maxPage = num;
      });
      if (maxPage > 1) console.warn('[스크래핑-TTI] 경고: ' + maxPage + '페이지 감지.');
      console.log('[스크래핑-TTI] 완료: ' + products.length + '건');

      chrome.runtime.sendMessage({ type: 'scrapePageDone', page: 1, totalPages: 1, products: products, hasMorePages: maxPage > 1 });
    } catch (e) {
      console.error('[스크래핑-TTI] 제품 스크래핑 에러:', e);
      chrome.runtime.sendMessage({ type: 'scrapeError', error: e.message });
    }
    return;
  }

  // ---- Phase 1-2: 프로모션 페이지 ----
  if (location.href.indexOf('/promotion/') !== -1 && job.mode === 'promotions') {
    try {
      console.log('[스크래핑-TTI] 프로모션 페이지 감지:', location.href);
      var retries = 0;
      while (!document.querySelector('table') && retries < 20) {
        await new Promise(function(r) { setTimeout(r, 500); });
        retries++;
      }
      await new Promise(function(r) { setTimeout(r, 1500); });

      var promoType = detectPromoType();
      var result = (promoType === 'specialDeal') ? scrapeSpecialDealList() : scrapePromoPage();
      console.log('[스크래핑-TTI] ' + promoType + ': ' + result.length + '건');

      chrome.runtime.sendMessage({ type: 'scrapePromoDone', promoType: promoType, data: result, url: location.href });
    } catch (e) {
      console.error('[스크래핑-TTI] 프로모션 에러:', e);
      chrome.runtime.sendMessage({ type: 'scrapeError', error: e.message });
    }
  }
}

// 페이지 로드 완료 후 1초 대기 후 실행
if (document.readyState === 'complete') {
  setTimeout(checkAndScrape, 1000);
} else {
  window.addEventListener('load', function() { setTimeout(checkAndScrape, 1000); });
}
