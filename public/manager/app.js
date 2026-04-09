var _scriptStart = performance.now();
// ======================== PERF MONITORING ========================
if (window.PerformanceObserver) {
  try {
    new PerformanceObserver(function(list) {
      list.getEntries().forEach(function(e) {
        if (e.duration > 50) console.warn('[PERF] 🚨 Long Task: ' + e.duration.toFixed(0) + 'ms');
      });
    }).observe({ entryTypes: ['longtask'] });
  } catch(e) {}
}

// ======================== SESSION CHECK ========================
(function checkSession() {
  var token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
  if (!token) { window.location.href = '/login'; return; }

  // 토큰 형식: "uuid|expiresISO" — 클라이언트에서 만료 확인
  var parts = token.split('|');
  if (parts.length >= 2) {
    var expires = new Date(parts[1]);
    if (new Date() > expires) {
      localStorage.removeItem('session_token');
      sessionStorage.removeItem('session_token');
      window.location.href = '/login';
      return;
    }
  }

  // current_user에서 사용자 정보 복원
  try {
    var saved = JSON.parse(localStorage.getItem('current_user') || '{}');
    if (saved && saved.name) {
      window.currentUser = saved;
      var nameEl = document.getElementById('current-user-name');
      if (nameEl) nameEl.textContent = saved.name + '님';
    }
  } catch(e) {}
})();

function doLogout() {
  var token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
  fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) }).catch(function(){});
  localStorage.removeItem('session_token');
  sessionStorage.removeItem('session_token');
  localStorage.removeItem('current_user');
  window.location.href = '/login';
}

// ======================== DATA STORE ========================
const KEYS = { products: 'mw_products', inventory: 'mw_inventory', promotions: 'mw_promotions', orders: 'mw_orders', settings: 'mw_settings', rebate: 'mw_rebate' };

function load(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  updateStatus();
  // inventory 변경 시 stockMap 재생성
  if (key === KEYS.inventory) { _stockMap = null; }
  // products 변경 시 탭 캐시 무효화
  if (key === KEYS.products) {
    if (typeof _renderedTabs !== 'undefined') { _renderedTabs['catalog'] = false; _renderedTabs['estimate'] = false; }
  }
  // 자동 Supabase 동기화
  autoSyncToSupabase(key);
}
function loadObj(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; } }

// ======================== SUPABASE SYNC ========================
// 자동 동기화 (5초 디바운스)
var _syncTimers = {};
function autoSyncToSupabase(key) {
  if (_syncTimers[key]) clearTimeout(_syncTimers[key]);
  _syncTimers[key] = setTimeout(function() {
    var raw = localStorage.getItem(key);
    if (!raw) return;
    // 본인 저장 타임스탬프 기록 (키별 — Realtime 이벤트에서 본인 필터용)
    sessionStorage.setItem('_lastSyncTs_' + key, String(Date.now()));
    sessionStorage.setItem('_lastSyncTs', String(Date.now())); // forceUpload 호환
    fetch('/api/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, value: raw })
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.success) { updateSyncStatus('동기화 완료'); console.log('[Supabase] 자동 동기화:', key); }
    }).catch(function(e) {
      console.log('[Supabase] 동기화 실패:', key, e.message);
      updateSyncStatus('동기화 실패');
    });
  }, 5000);
}

function updateSyncStatus(text) {
  // 기존 설정 탭 #sync-status 업데이트
  var el = document.getElementById('sync-status');
  if (el) {
    var dot = text.includes('완료') || text.includes('연결') ? '#1D9E75' : text.includes('실패') || text.includes('끊김') ? '#CC2222' : '#EF9F27';
    var now = new Date();
    var timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    el.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:' + dot + ';display:inline-block"></span> ' + text + ' · ' + timeStr;
  }

  // 헤더 동기화 버튼 업데이트
  var btn = document.getElementById('header-sync-btn');
  var icon = document.getElementById('header-sync-icon');
  var txt = document.getElementById('header-sync-text');
  if (!btn || !icon || !txt) return;

  var now2 = new Date();
  var ts = now2.getHours() + ':' + String(now2.getMinutes()).padStart(2, '0');

  if (text.includes('완료') || text.includes('연결')) {
    // 상태 1: 동기화 완료 (녹색)
    btn.style.background = 'rgba(29,158,117,0.25)';
    btn.style.color = '#7DFFCC';
    btn.style.borderColor = 'rgba(29,158,117,0.5)';
    icon.style.animation = 'none';
    icon.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
    txt.textContent = '동기화 완료 · ' + ts;
  } else if (text.includes('실패') || text.includes('끊김')) {
    // 상태 3: 연결 끊김 (빨간색)
    btn.style.background = 'rgba(204,34,34,0.25)';
    btn.style.color = '#FF8080';
    btn.style.borderColor = 'rgba(204,34,34,0.5)';
    icon.style.animation = 'none';
    icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
    txt.textContent = '연결 끊김 · 재시도';
  } else {
    // 상태 2: 동기화 중 (주황색 + 회전)
    btn.style.background = 'rgba(239,159,39,0.25)';
    btn.style.color = '#FFD080';
    btn.style.borderColor = 'rgba(239,159,39,0.5)';
    icon.style.animation = 'spin 1s linear infinite';
    icon.innerHTML = '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>';
    txt.textContent = '동기화 중...';
  }
}

// 헤더 버튼 클릭: 즉시 강제 업로드
async function forceUploadAll() {
  var btn = document.getElementById('header-sync-btn');
  if (btn) btn.disabled = true;
  updateSyncStatus('동기화 중...');

  var keys = ['mw_products','mw_gen_products','mw_inventory','mw_promotions','mw_settings','mw_rebate','mw_customers','mw_clients','mw_orders','mw_action_history','mw_estimates','mw_sales_items','mw_setbun_items','mw_parts_prices'];

  try {
    var uploadData = [];
    for (var i = 0; i < keys.length; i++) {
      var raw = localStorage.getItem(keys[i]);
      if (raw) uploadData.push({ key: keys[i], value: raw });
    }

    if (!uploadData.length) {
      updateSyncStatus('동기화 완료');
      if (btn) btn.disabled = false;
      return;
    }

    // 본인 저장 타임스탬프 (Realtime 이벤트 무시용)
    sessionStorage.setItem('_lastSyncTs', String(Date.now()));

    var res = await fetch('/api/sync/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: uploadData })
    });
    if (!res.ok) throw new Error('업로드 실패: HTTP ' + res.status);
    var result = await res.json();

    console.log('[강제 업로드] 완료:', result.saved || uploadData.length, '개 키');
    updateSyncStatus('동기화 완료');
  } catch (err) {
    console.error('[강제 업로드 실패]', err);
    updateSyncStatus('동기화 실패');
    alert('저장 실패. 다시 시도해주세요.\n' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 전체 업로드 (최초 1회)
async function uploadAllToSupabase() {
  var btn = document.getElementById('btn-supabase-upload');
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = '업로드 중...';
  btn.style.background = '#888';
  btn.style.color = '#fff';

  var keys = ['mw_products','mw_gen_products','mw_inventory','mw_promotions','mw_settings','mw_rebate','mw_customers','mw_clients','mw_orders','mw_action_history','mw_estimates','mw_sales_items','mw_setbun_items','mw_parts_prices'];

  try {
    var uploadData = [];
    for (var i = 0; i < keys.length; i++) {
      var raw = localStorage.getItem(keys[i]);
      if (raw) {
        uploadData.push({ key: keys[i], value: raw });
        btn.textContent = '업로드 중... (' + keys[i] + ')';
      }
    }

    sessionStorage.setItem('_lastSyncTs', String(Date.now()));

    var res = await fetch('/api/sync/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: uploadData })
    });
    if (!res.ok) throw new Error('업로드 실패: ' + res.status);
    var result = await res.json();

    btn.textContent = '업로드 완료!';
    btn.style.background = '#1D9E75';
    updateSyncStatus('동기화 완료');

    // 2초 후 기본 상태 복귀
    setTimeout(function() {
      btn.textContent = '업로드';
      btn.style.background = '#185FA5';
      btn.style.color = '#fff';
      btn.style.cursor = 'pointer';
      btn.disabled = false;
    }, 2000);
  } catch (error) {
    alert('업로드 실패. 다시 시도해주세요.\n' + error.message);
    btn.textContent = '업로드';
    btn.style.background = '#185FA5';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.disabled = false;
  }
}

// Supabase에서 자동 다운로드 (localStorage 비어있을 때)
async function loadFromSupabase() {
  try {
    console.log('[Supabase] 데이터 로드 시작...');
    var res = await fetch('/api/sync/download');
    if (!res.ok) return false;
    var result = await res.json();
    var data = result.data || [];
    if (!data.length) { console.log('[Supabase] 서버에 데이터 없음'); return false; }

    var loaded = 0;
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (item.key && item.value) {
        localStorage.setItem(item.key, typeof item.value === 'string' ? item.value : JSON.stringify(item.value));
        loaded++;
      }
    }
    console.log('[Supabase] 데이터 로드 완료: ' + loaded + '개 키');
    updateSyncStatus('동기화 완료');
    return loaded > 0;
  } catch (error) {
    console.log('[Supabase] 로드 실패, localStorage 폴백:', error.message);
    return false;
  }
}

// 백그라운드 서버 동기화 — localStorage 캐시로 이미 렌더링된 후 변경분만 업데이트
function _bgSyncFromSupabase(activeTab) {
  var t0 = performance.now();
  fetch('/api/sync/download').then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function(result) {
    var data = result.data || [];
    if (!data.length) {
      // 서버에 데이터 없고 로컬에 있으면 업로드
      if (localStorage.getItem('mw_products') && localStorage.getItem('mw_products') !== '[]') {
        console.log('[BgSync] 서버 데이터 없음 — 로컬 데이터 업로드');
        sessionStorage.setItem('_lastSyncTs', String(Date.now()));
        forceUploadAll();
      }
      updateSyncStatus('동기화 완료');
      return;
    }

    var changedKeys = [];
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (!item.key || !item.value) continue;
      // pending sync가 있는 키는 스킵 (로컬 변경 보호)
      if (_syncTimers[item.key]) continue;
      var newVal = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
      var oldVal = localStorage.getItem(item.key);
      if (newVal !== oldVal) {
        localStorage.setItem(item.key, newVal);
        changedKeys.push(item.key);
      }
    }

    console.log('[BgSync] 완료: ' + (performance.now() - t0).toFixed(0) + 'ms, 변경 ' + changedKeys.length + '개 키');

    if (changedKeys.length > 0) {
      // DB 객체 재로드
      DB.products = load(KEYS.products);
      DB.inventory = load(KEYS.inventory);
      DB.promotions = load(KEYS.promotions);
      DB.orders = loadObj(KEYS.orders, { elec: [], hand: [], pack: [] });
      DB.settings = loadObj(KEYS.settings, DB.settings);
      DB.rebate = load(KEYS.rebate);
      _stockMap = null;
      if (typeof genProducts !== 'undefined') { genProducts.length = 0; var _gp = loadObj('mw_gen_products', []); for (var j = 0; j < _gp.length; j++) genProducts.push(_gp[j]); }
      if (typeof estimates !== 'undefined') { estimates.length = 0; var _es = loadObj('mw_estimates', []); for (var j = 0; j < _es.length; j++) estimates.push(_es[j]); }
      if (typeof clientData !== 'undefined') { clientData.length = 0; var _cl = loadObj('mw_clients', []); for (var j = 0; j < _cl.length; j++) clientData.push(_cl[j]); }

      // 변경된 키에 해당하는 탭만 리렌더링
      refreshActiveTab();
      console.log('[BgSync] 변경 키:', changedKeys.join(', '));
    }
    updateSyncStatus('동기화 완료');
  }).catch(function(e) {
    console.warn('[BgSync] 실패:', e.message);
    updateSyncStatus('동기화 실패');
  });
}

// 하위 호환
function syncProductsToSupabase() { autoSyncToSupabase(KEYS.products); }

// 업로드 버튼 초기 상태 설정
(function() {
  setTimeout(function() {
    var btn = document.getElementById('btn-supabase-upload');
    if (btn) {
      btn.textContent = '업로드';
      btn.style.background = '#185FA5';
      btn.style.color = '#fff';
      btn.style.cursor = 'pointer';
      btn.disabled = false;
    }
  }, 500);
})();

// ======================== SUPABASE REALTIME 구독 ========================
var _realtimeChannel = null;
var _realtimeRefreshTimer = null;

(function initSupabaseRealtime() {
  // CDN에서 로드된 supabase 객체 확인
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.log('[Realtime] Supabase CDN 미로드, 구독 건너뜀');
    return;
  }

  var SUPABASE_URL = 'https://vmbqutwrfzhruukerfkc.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtYnF1dHdyZnpocnV1a2VyZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzc5MjAsImV4cCI6MjA5MDIxMzkyMH0.-FI_3De1sRmAxLNQ8J45MT9hO9U9aSTchxBcq47_b-I';

  var sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  _realtimeChannel = sbClient.channel('app_data_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, function(payload) {
      var changedKey = payload.new ? payload.new.key : '';
      console.log('[Realtime] 변경 감지:', payload.eventType, changedKey);

      // 본인이 방금 저장한 키의 변경이면 무시 (키별 3초 필터)
      var keyTs = parseInt(sessionStorage.getItem('_lastSyncTs_' + changedKey) || '0');
      if (changedKey && Date.now() - keyTs < 3000) {
        console.log('[Realtime] 본인 저장 → 무시 (' + changedKey + ')');
        return;
      }
      // forceUpload 전체 업로드 시 글로벌 필터 (3초)
      var globalTs = parseInt(sessionStorage.getItem('_lastSyncTs') || '0');
      if (Date.now() - globalTs < 3000) {
        console.log('[Realtime] 전체 업로드 직후 → 무시');
        return;
      }

      // 다른 사용자의 변경 → 데이터 다운로드
      updateSyncStatus('동기화 중...');

      // 여러 키가 연속 변경될 수 있으므로 500ms debounce
      if (_realtimeRefreshTimer) clearTimeout(_realtimeRefreshTimer);
      _realtimeRefreshTimer = setTimeout(function() {
        realtimeDownloadAndRefresh();
      }, 500);
    })
    .subscribe(function(status) {
      console.log('[Realtime] 구독 상태:', status);
      if (status === 'SUBSCRIBED') {
        updateSyncStatus('동기화 완료');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        updateSyncStatus('연결 끊김');
      } else if (status === 'CLOSED') {
        updateSyncStatus('연결 끊김');
      }
    });

  console.log('[Realtime] Supabase Realtime 구독 시작');
})();

// 다른 사용자 변경 시 다운로드 + UI 갱신
async function realtimeDownloadAndRefresh() {
  try {
    var res = await fetch('/api/sync/download');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var result = await res.json();
    var data = result.data || [];
    if (!data.length) return;

    var updated = 0;
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (item.key && item.value) {
        // API 키는 localStorage에 저장 안 함 (서버에서만 관리)
        if (item.key === 'api_keys') continue;
        // 로컬에 아직 업로드 안 된 변경이 있으면 서버 데이터로 덮어쓰지 않음
        if (_syncTimers[item.key]) {
          console.log('[Realtime] 로컬 변경 대기 중, 스킵:', item.key);
          continue;
        }
        var newVal = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        var oldVal = localStorage.getItem(item.key);
        if (newVal !== oldVal) {
          localStorage.setItem(item.key, newVal);
          updated++;
        }
      }
    }

    if (updated > 0) {
      console.log('[Realtime] ' + updated + '개 키 갱신, UI 새로고침');

      // DB 객체 재로드 (화면 깜빡임 없이 데이터만 갱신)
      DB.products = load(KEYS.products);
      DB.inventory = load(KEYS.inventory);
      DB.promotions = load(KEYS.promotions);
      DB.orders = loadObj(KEYS.orders, { elec: [], hand: [], pack: [] });
      DB.settings = loadObj(KEYS.settings, DB.settings);
      DB.rebate = load(KEYS.rebate);
      _stockMap = null; // 재고 캐시 초기화

      // 추가 글로벌 변수 재로드
      if (typeof estimates !== 'undefined') { estimates.length = 0; var _estArr = loadObj('mw_estimates', []); for (var j = 0; j < _estArr.length; j++) estimates.push(_estArr[j]); }
      if (typeof genProducts !== 'undefined') { genProducts.length = 0; var _gpArr = loadObj('mw_gen_products', []); for (var j = 0; j < _gpArr.length; j++) genProducts.push(_gpArr[j]); }
      if (typeof clientData !== 'undefined') { clientData.length = 0; var _clArr = loadObj('mw_clients', []); for (var j = 0; j < _clArr.length; j++) clientData.push(_clArr[j]); }

      // 현재 활성 탭 UI만 갱신
      refreshActiveTab();
    }

    updateSyncStatus('동기화 완료');
  } catch (err) {
    console.error('[Realtime] 다운로드 실패:', err.message);
    updateSyncStatus('동기화 실패');
  }
}

// 현재 활성 탭의 UI만 새로고침 (깜빡임 없이)
function refreshActiveTab() {
  try {
    // 어떤 메인 탭이 활성인지 확인
    var activeTab = document.querySelector('.tab-content[style*="display: block"], .tab-content[style*="display:block"]');
    if (!activeTab) return;
    var tabId = activeTab.id;

    if (tabId === 'tab-catalog' && typeof renderCatalog === 'function') renderCatalog();
    if (tabId === 'tab-promo' && typeof renderPromo === 'function') renderPromo();
    if (tabId === 'tab-order') {
      if (typeof renderOrderTab === 'function') {
        ['elec', 'hand', 'pack'].forEach(function(t) { renderOrderTab(t); });
      }
      if (typeof renderOrderSheet === 'function') renderOrderSheet();
    }
    if (tabId === 'tab-sales' && typeof renderSales === 'function') renderSales();
    if (tabId === 'tab-manage') {
      if (typeof renderClients === 'function') renderClients();
    }
    if (tabId === 'tab-estimate' && typeof renderEstimateList === 'function') renderEstimateList();
    if (tabId === 'tab-general' && typeof renderGenProducts === 'function') renderGenProducts();

    console.log('[Realtime] UI 갱신 완료:', tabId);
  } catch (e) {
    console.warn('[Realtime] UI 갱신 중 오류:', e.message);
  }
}

var _dbStart = performance.now();
let DB = {
  products: load(KEYS.products),
  inventory: load(KEYS.inventory),
  promotions: load(KEYS.promotions),
  orders: loadObj(KEYS.orders, { elec: [], hand: [], pack: [] }),
  settings: loadObj(KEYS.settings, { quarterDC: 0.04, yearDC: 0.018, vat: 0.1, naverFee: 0.059, openElecFee: 0.13, openHandFee: 0.176, ssgElecFee: 0.13, ssgHandFee: 0.13, domaeFee: 0.01, mkDomae: 1, mkRetail: 15, mkNaver: 17, mkOpen: 27, promoFee1: 5.8, promoFee2: 3.6, arPromos: [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}], volPromos: [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}] }),
  rebate: load(KEYS.rebate)
};
console.log('[PERF] DB localStorage 파싱: ' + (performance.now() - _dbStart).toFixed(0) + 'ms (products:' + DB.products.length + ', inventory:' + DB.inventory.length + ', promos:' + DB.promotions.length + ')');

// Default rebate tiers
if (!DB.rebate.length) {
  DB.rebate = [
    { min: 6000000, rate: 0.02 }, { min: 15000000, rate: 0.023 }, { min: 30000000, rate: 0.025 },
    { min: 60000000, rate: 0.027 }, { min: 100000000, rate: 0.029 }, { min: 200000000, rate: 0.031 },
    { min: 300000000, rate: 0.034 }, { min: 500000000, rate: 0.037 }, { min: 700000000, rate: 0.038 },
    { min: 1000000000, rate: 0.04 }
  ];
  save(KEYS.rebate, DB.rebate);
}

function saveAll() {
  save(KEYS.products, DB.products);
  save(KEYS.inventory, DB.inventory);
  save(KEYS.promotions, DB.promotions);
  save(KEYS.orders, DB.orders);
  save(KEYS.settings, DB.settings);
}

// ======================== UTILITY ========================

// 범용 모달 드래그 헬퍼
function _makeDraggable(modalEl, handleEl) {
  if (!modalEl || !handleEl) return;
  handleEl.style.cursor = 'move';
  var ox = 0, oy = 0, mx = 0, my = 0;
  handleEl.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    mx = e.clientX; my = e.clientY;
    var rect = modalEl.getBoundingClientRect();
    // 첫 드래그 시 position을 고정좌표로 전환
    if (!modalEl._dragged) {
      modalEl.style.position = 'fixed';
      modalEl.style.left = rect.left + 'px';
      modalEl.style.top = rect.top + 'px';
      modalEl.style.margin = '0';
      modalEl._dragged = true;
    }
    function onMove(e2) {
      e2.preventDefault();
      e2.stopPropagation();
      ox = e2.clientX - mx; oy = e2.clientY - my;
      mx = e2.clientX; my = e2.clientY;
      modalEl.style.left = (modalEl.offsetLeft + ox) + 'px';
      modalEl.style.top = (modalEl.offsetTop + oy) + 'px';
    }
    function onUp() { document.removeEventListener('mousemove', onMove, true); document.removeEventListener('mouseup', onUp, true); }
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  });
}

const comma = n => { const s = String(Math.round(n)); return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
const fmt = n => n == null || isNaN(n) || n === 0 ? '-' : comma(n);
const fmtN = n => n == null || isNaN(n) || n === 0 ? '-' : comma(n);
const fmtPrice = n => n == null || isNaN(n) ? '-' : '' + comma(n);
const pct = n => n == null || isNaN(n) ? '-' : (n * 100).toFixed(1) + '%';

function calcMargin(price, cost, feeRate) {
  if (!price || !cost) return null;
  var vat = price / 11;
  var fee = price * feeRate;
  var profit = price - vat - fee - cost;
  var rate = (profit / price) * 100;
  return { profit: Math.round(profit), rate: rate };
}

function marginBadge(price, cost, feeRate) {
  var m = calcMargin(price, cost, feeRate);
  if (!m) return '';
  var color = m.profit >= 0 ? '#1D9E75' : '#CC2222';
  return '<div style="font-size:10px;color:' + color + ';line-height:1.2;margin-top:2px">' + m.rate.toFixed(1) + '% ' + (m.profit >= 0 ? '+' : '') + fmt(m.profit) + '원</div>';
}

// ======================== 마켓 가격 뱃지 ========================
var _marketBadgeStyles = {
  naver: { bg: '#E1F5EE', color: '#085041', dot: '#1D9E75', label: '스토어팜' },
  gmarket: { bg: '#E6F1FB', color: '#0C447C', dot: '#185FA5', label: '오픈마켓' },
  ssg: { bg: '#FEF3C7', color: '#92400E', dot: '#EF9F27', label: 'SSG' }
};
function marketBadge(p, channel) {
  var st = _marketBadgeStyles[channel];
  if (!st) return '';
  var price = channel === 'naver' ? p.priceNaver : channel === 'gmarket' ? p.priceOpen : (p.priceSsg || 0);
  if (!price) return '<div style="text-align:center;color:#DDE1EB;font-size:11px">-</div>';
  var feeRate = getMarketFeeRate(p, channel);
  var m = calcMargin(price, p.cost, feeRate);
  var mColor = m && m.profit >= 0 ? '#1D9E75' : '#CC2222';
  var mText = m ? (m.rate.toFixed(1) + '% ' + (m.profit >= 0 ? '+' : '') + fmt(m.profit)) : '';
  return '<div onclick="openPriceDetail(\'' + (p.code || '') + '\',\'' + channel + '\')" style="cursor:pointer;background:' + st.bg + ';border-radius:6px;padding:4px 6px;text-align:center;border:1px solid transparent;transition:border-color 0.15s" onmouseenter="this.style.borderColor=\'#B0B8CC\'" onmouseleave="this.style.borderColor=\'transparent\'">'
    + '<div style="font-size:9px;color:' + st.color + ';opacity:0.7;line-height:1;margin-bottom:1px">' + st.label + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:' + st.color + ';line-height:1.2">' + fmt(price) + '</div>'
    + (mText ? '<div style="font-size:9px;color:' + mColor + ';line-height:1;margin-top:1px">' + mText + '</div>' : '')
    + '</div>';
}
function getMarketFeeRate(p, channel) {
  var s = DB.settings;
  if (channel === 'naver') return s.naverFee || 0.0663;
  if (channel === 'gmarket') return p.category === '파워툴' ? (s.openElecFee || 0.13) : (s.openHandFee || 0.176);
  if (channel === 'ssg') return p.category === '파워툴' ? (s.ssgElecFee || 0.13) : (s.ssgHandFee || 0.13);
  return 0;
}

// ======================== 가격 상세 팝업 ========================
function openPriceDetail(code, channel) {
  var p = findProduct(code);
  if (!p) {
    // 일반제품에서 검색
    var genP = (typeof genProducts !== 'undefined') ? genProducts.find(function(g) { return String(g.code) === String(code); }) : null;
    if (genP) p = genP; else return;
  }
  var st = _marketBadgeStyles[channel];
  var price = channel === 'naver' ? p.priceNaver : channel === 'gmarket' ? p.priceOpen : (p.priceSsg || 0);
  var cost = p.cost || 0;
  var feeRate = getMarketFeeRate(p, channel);
  var vat = Math.round(price / 11);
  var fee = Math.round(price * feeRate);
  var settle = price - vat - fee;
  var profit = settle - cost;
  var profitRate = price > 0 ? (profit / price * 100) : 0;
  var profitColor = profit >= 0 ? '#1D9E75' : '#CC2222';
  // 수수료 상세
  var feeDetail = getFeeDetail(channel, p.category);
  // VAT 태그
  var vatTag = (channel === 'naver' || channel === 'gmarket' || channel === 'ssg')
    ? '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#E1F5EE;color:#085041;font-weight:500">VAT포함</span>' : '';
  // 마크업 정보
  var mkInfo = getMarkupInfo(channel, p.category);

  var html = '<div id="price-detail-overlay" onclick="closePriceDetail(event)" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000">'
    + '<div onclick="event.stopPropagation()" style="background:#fff;border-radius:12px;width:90%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)">'
    // 헤더
    + '<div style="display:flex;align-items:center;gap:6px;padding:14px 18px;border-bottom:1px solid #DDE1EB">'
    + '<span style="width:8px;height:8px;border-radius:50%;background:' + st.dot + ';display:inline-block"></span>'
    + '<span style="font-size:15px;font-weight:600;color:#1A1D23">' + st.label + ' 가격 상세</span>'
    + vatTag
    + '<span style="flex:1"></span>'
    + '<button onclick="closePriceDetail()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#9BA3B2;padding:4px">✕</button>'
    + '</div>'
    // 제품 정보
    + '<div style="padding:14px 18px 0">'
    + '<div style="font-size:12px;color:#5A6070">' + (p.model || p.code || '') + '</div>'
    + '<div style="font-size:11px;color:#9BA3B2;margin-top:2px">' + (p.description || '') + '</div>'
    + '</div>'
    // 수수료 분해
    + '<div style="margin:12px 18px;background:#F4F6FA;border-radius:8px;padding:14px 16px">'
    + '<div style="display:flex;align-items:flex-end;justify-content:center;gap:6px;flex-wrap:wrap">'
    + feeBreakdownItem(fmt(price), '판매가', '#1A1D23')
    + '<span style="font-size:14px;color:#9BA3B2;padding-bottom:8px">−</span>'
    + feeBreakdownItem(fmt(vat), 'VAT(÷11)', '#5A6070')
    + '<span style="font-size:14px;color:#9BA3B2;padding-bottom:8px">−</span>'
    + feeBreakdownItem(fmt(fee), feeDetail, '#CC2222')
    + '<span style="font-size:14px;color:#9BA3B2;padding-bottom:8px">=</span>'
    + feeBreakdownItem(fmt(settle), '정산금액', '#185FA5')
    + '</div>'
    + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #DDE1EB;display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#5A6070">'
    + '<span>매입원가: <b style="color:#1A1D23">' + fmt(cost) + '원</b></span>'
    + '<span>마진: <b style="color:' + profitColor + '">' + (profit >= 0 ? '+' : '') + fmt(profit) + '원 (' + profitRate.toFixed(1) + '%)</b></span>'
    + '<span>' + mkInfo + '</span>'
    + '</div>'
    + '</div>'
    // 가격 이력
    + '<div style="padding:0 18px 16px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    + '<span style="font-size:13px;font-weight:600;color:#1A1D23">가격 변동 이력</span>'
    + '<span style="font-size:11px;color:#9BA3B2">최근 1년</span>'
    + '</div>'
    + buildPriceHistoryTable(code, channel)
    + '</div>'
    + '</div></div>';

  var existing = document.getElementById('price-detail-overlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function feeBreakdownItem(value, label, color) {
  return '<div style="text-align:center;min-width:60px">'
    + '<div style="font-size:16px;font-weight:700;color:' + color + ';line-height:1.2">' + value + '</div>'
    + '<div style="font-size:9px;color:#9BA3B2;margin-top:2px">' + label + '</div>'
    + '</div>';
}

function getFeeDetail(channel, category) {
  if (channel === 'naver') {
    var s1 = DB.settings.naverSaleRate || 3;
    var s2 = DB.settings.naverPayRate || 3.63;
    return '수수료(' + s1 + '+' + s2 + '%)';
  }
  if (channel === 'gmarket') {
    var rate = (category === '파워툴') ? ((DB.settings.openElecFee || 0.13) * 100).toFixed(1) : ((DB.settings.openHandFee || 0.176) * 100).toFixed(1);
    return '이용료(' + rate + '%)';
  }
  if (channel === 'ssg') {
    var rate = (category === '파워툴') ? ((DB.settings.ssgElecFee || 0.13) * 100).toFixed(1) : ((DB.settings.ssgHandFee || 0.13) * 100).toFixed(1);
    return '수수료(' + rate + '%)';
  }
  return '수수료';
}

function getMarkupInfo(channel, category) {
  var s = DB.settings;
  if (channel === 'naver') return '마크업: ' + (s.mkNaver || 1) + '%';
  if (channel === 'gmarket') {
    var mk = (category === '파워툴') ? (s.mkOpenElec || 0.5) : (s.mkOpenHand || 0.5);
    return '마크업: ' + mk + '%';
  }
  if (channel === 'ssg') {
    var mk = (category === '파워툴') ? (s.mkSsgElec || 0.5) : (s.mkSsgHand || 0.5);
    return '마크업: ' + mk + '%';
  }
  return '';
}

function closePriceDetail(e) {
  if (e && e.target !== e.currentTarget) return;
  var el = document.getElementById('price-detail-overlay');
  if (el) el.remove();
}

// ======================== 가격 변동 이력 ========================
var _priceHistory = JSON.parse(localStorage.getItem('mw_price_history') || '[]');

function savePriceHistory() {
  // 1년 이상 된 이력 제거 + 최대 10,000건
  var cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  var cutoffStr = cutoff.toISOString();
  _priceHistory = _priceHistory.filter(function(h) { return h.timestamp >= cutoffStr; });
  if (_priceHistory.length > 10000) _priceHistory = _priceHistory.slice(_priceHistory.length - 10000);
  localStorage.setItem('mw_price_history', JSON.stringify(_priceHistory));
  autoSyncToSupabase('mw_price_history');
}

function recordPriceChange(code, channel, oldPrice, newPrice, reason) {
  if (!oldPrice && !newPrice) return;
  if (oldPrice === newPrice) return;
  _priceHistory.push({
    code: String(code),
    channel: channel,
    oldPrice: oldPrice || 0,
    newPrice: newPrice || 0,
    reason: reason || '가격 재계산',
    timestamp: new Date().toISOString(),
    user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'admin'
  });
}

function getPriceHistory(productCode, channel, months) {
  months = months || 12;
  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  var cutoffStr = cutoff.toISOString();
  return _priceHistory
    .filter(function(h) { return String(h.code) === String(productCode) && h.channel === channel && h.timestamp >= cutoffStr; })
    .sort(function(a, b) { return b.timestamp < a.timestamp ? -1 : 1; });
}

function buildPriceHistoryTable(code, channel) {
  var hist = getPriceHistory(code, channel);
  if (!hist.length) {
    return '<div style="text-align:center;padding:20px;color:#9BA3B2;font-size:12px">가격 변동 이력이 없습니다</div>';
  }
  var h = '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  h += '<thead><tr style="background:#F4F6FA">';
  h += '<th style="padding:6px 8px;text-align:left;font-weight:600;color:#5A6070;font-size:11px">날짜</th>';
  h += '<th style="padding:6px 8px;text-align:left;font-weight:600;color:#5A6070;font-size:11px">사유</th>';
  h += '<th style="padding:6px 8px;text-align:right;font-weight:600;color:#5A6070;font-size:11px">변경 전</th>';
  h += '<th style="padding:6px 8px;text-align:right;font-weight:600;color:#5A6070;font-size:11px">변경 후</th>';
  h += '<th style="padding:6px 8px;text-align:right;font-weight:600;color:#5A6070;font-size:11px">변동</th>';
  h += '</tr></thead><tbody>';
  hist.slice(0, 20).forEach(function(r) {
    var diff = r.newPrice - r.oldPrice;
    var diffColor = diff > 0 ? '#CC2222' : '#1D9E75';
    var arrow = diff > 0 ? '▲' : '▼';
    var d = new Date(r.timestamp);
    var dateStr = d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
    h += '<tr style="border-bottom:1px solid #F0F2F7">';
    h += '<td style="padding:5px 8px;color:#5A6070">' + dateStr + '</td>';
    h += '<td style="padding:5px 8px;color:#1A1D23">' + (r.reason || '-') + '</td>';
    h += '<td style="padding:5px 8px;text-align:right;color:#9BA3B2">' + fmt(r.oldPrice) + '</td>';
    h += '<td style="padding:5px 8px;text-align:right;font-weight:600;color:#1A1D23">' + fmt(r.newPrice) + '</td>';
    h += '<td style="padding:5px 8px;text-align:right;font-weight:600;color:' + diffColor + '">' + arrow + ' ' + fmt(Math.abs(diff)) + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table>';
  return h;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function updateStatus() {
  document.getElementById('status-products').textContent = `제품: ${DB.products.length}건 | 재고: ${DB.inventory.length}건 | 프로모션: ${DB.promotions.length}건`;
  document.getElementById('status-save').textContent = `마지막 저장: ${new Date().toLocaleTimeString('ko')}`;
}

function findProduct(code) { return DB.products.find(p => String(p.code) === String(code)); }

// findStock: HashMap으로 O(1) 조회 (기존 Array.find O(n) → 815건×4000회 = 먹통 원인)
var _stockMap = null;
function _buildStockMap() {
  _stockMap = {};
  DB.inventory.forEach(function(i) { _stockMap[String(i.code)] = i.stock; });
}
function findStock(code) {
  if (!_stockMap) _buildStockMap();
  var s = _stockMap[String(code)];
  return s !== undefined ? s : null;
}
function findPromo(code) { return DB.promotions.find(p => String(p.code) === String(code)); }

let currentPromoPop = null;

function showPromoPop(e, code) {
  e.stopPropagation();

  if (currentPromoPop) {
    currentPromoPop.remove();
    currentPromoPop = null;
  }

  var product = findProduct(code);
  if (!product) return;

  var now = Date.now();
  var weekMs = 7 * 24 * 60 * 60 * 1000;
  var results = [];

  (orderHistory || []).forEach(function(record) {
    if ((now - new Date(record.date).getTime()) < weekMs) {
      (record.items || []).forEach(function(it) {
        if (String(it.code) === String(code)) {
          results.push({
            type: '일반',
            date: new Date(record.date).toLocaleDateString('ko'),
            qty: it.qty,
            price: it.supplyPrice || product.supplyPrice,
            cost: it.cost,
            promoNo: '-'
          });
        }
      });
    }
  });

  (poHistory || []).forEach(function(record) {
    if ((now - new Date(record.date).getTime()) < weekMs) {
      (record.items || []).forEach(function(it) {
        if (String(it.code) === String(code)) {
          results.push({
            type: '프로모션',
            date: new Date(record.date).toLocaleDateString('ko'),
            qty: it.qty,
            price: it.promoPrice || 0,
            cost: it.cost,
            promoNo: it.promoNo || '-'
          });
        }
      });
    }
  });

  if (!results.length) return;

  var baseCost = product.cost || 0;
  var latest = results[results.length - 1];
  var diff = latest.cost - baseCost;
  var diffPct = baseCost > 0 ? Math.round((diff / baseCost) * 100) : 0;

  var pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;z-index:9999;width:450px;background:white;border:1px solid #DDE1EB;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);padding:14px 16px;font-size:12px;font-family:Pretendard,sans-serif';

  var rows = results.map(function(r) {
    var typeBadge = r.type === '프로모션'
      ? '<span style="background:#FCEBEB;color:#CC2222;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px">' + r.promoNo + '</span>'
      : '<span style="background:#E6F1FB;color:#185FA5;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px">일반발주</span>';
    return '<tr style="border-bottom:1px solid #F0F2F7">' +
      '<td style="padding:5px 8px;text-align:center">' + typeBadge + '</td>' +
      '<td style="padding:5px 8px;text-align:center;color:#5A6070">' + r.date + '</td>' +
      '<td style="padding:5px 8px;text-align:center;font-weight:500">' + r.qty + '개</td>' +
      '<td style="padding:5px 8px;text-align:right">' + fmt(r.price) + '</td>' +
      '<td style="padding:5px 8px;text-align:right;color:#CC2222;font-weight:700">' + fmt(r.cost) + '</td>' +
      '</tr>';
  }).join('');

  pop.innerHTML = '<div style="font-size:13px;font-weight:600;color:#1A1D23;margin-bottom:10px">' + code + ' · ' + (product.model || '') + ' 발주 이력</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr style="background:#F4F6FA">' +
    '<th style="padding:5px 8px;text-align:center;font-weight:600;color:#5A6070">구분</th>' +
    '<th style="padding:5px 8px;text-align:center;font-weight:600;color:#5A6070">발주일</th>' +
    '<th style="padding:5px 8px;text-align:center;font-weight:600;color:#5A6070">수량</th>' +
    '<th style="padding:5px 8px;text-align:right;font-weight:600;color:#5A6070">단가</th>' +
    '<th style="padding:5px 8px;text-align:right;font-weight:600;color:#CC2222">매입원가</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="margin-top:8px;padding-top:6px;border-top:1px solid #F0F2F7;display:flex;gap:16px;font-size:11px;color:#5A6070">' +
    '<span>기본 원가: <span style="color:#1D9E75;font-weight:600">' + fmt(baseCost) + '</span></span>' +
    '<span>최근 발주 원가: <span style="color:#CC2222;font-weight:600">' + fmt(latest.cost) + '</span></span>' +
    '<span>차이: <span style="color:#CC2222;font-weight:600">' + fmt(diff) + ' (' + diffPct + '%)</span></span>' +
    '</div>';

  document.body.appendChild(pop);
  currentPromoPop = pop;

  var rect = e.target.getBoundingClientRect();
  var top = rect.bottom + 8;
  var left = rect.right - pop.offsetWidth;
  if (left < 8) left = 8;
  if (top + pop.offsetHeight > window.innerHeight - 8) {
    top = rect.top - pop.offsetHeight - 8;
  }
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
}

document.addEventListener('click', function(e) {
  if (currentPromoPop && !currentPromoPop.contains(e.target)) {
    currentPromoPop.remove();
    currentPromoPop = null;
  }
});

// Calculate cost from supply price (엑셀 원가 공식)
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

// ======================== AUTOCOMPLETE ========================
let acActive = null; // { input, callback }
const acEl = document.createElement('div');
acEl.className = 'ac-list';
document.body.appendChild(acEl);

function searchProducts(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return DB.products.filter(p => {
    return String(p.code).includes(q) || String(p.model || '').toLowerCase().includes(q) || String(p.description || '').toLowerCase().includes(q);
  }).slice(0, 15);
}

function showAC(inputEl, callback) {
  const val = inputEl.value.trim();
  const results = searchProducts(val);
  if (!results.length) { hideAC(); return; }
  
  acActive = { input: inputEl, callback };
  acEl.innerHTML = results.map(p => {
    const stock = findStock(p.code);
    const stockTxt = stock != null ? `[${stock}]` : '';
    return `<div class="ac-item" data-code="${p.code}">
      <span class="ac-code">${p.code}</span>
      <span class="ac-model">${p.model || ''}</span>
      <span class="ac-desc">${(p.description || '').slice(0, 30)}</span>
      <span class="ac-price">${fmt(p.supplyPrice)} ${stockTxt}</span>
    </div>`;
  }).join('');
  
  const rect = inputEl.getBoundingClientRect();
  acEl.style.position = 'fixed';
  acEl.style.top = (rect.bottom + 2) + 'px';
  acEl.style.left = rect.left + 'px';
  acEl.classList.add('show');
}

function hideAC() { acEl.classList.remove('show'); acActive = null; }

acEl.addEventListener('mousedown', function(e) {
  const item = e.target.closest('.ac-item');
  if (item && acActive) {
    const code = item.dataset.code;
    acActive.input.value = code;
    acActive.callback(code);
    hideAC();
  }
});

document.addEventListener('click', function(e) {
  if (!acEl.contains(e.target) && e.target !== acActive?.input) hideAC();
});

// Helper: get effective cost considering promo
function getEffectiveCost(code) {
  const promo = findPromo(code);
  if (promo && promo.cost > 0) return { cost: promo.cost, isPromo: true, promoName: promo.promoName };
  const p = findProduct(code);
  if (p) return { cost: p.cost, isPromo: false, promoName: '' };
  return { cost: 0, isPromo: false, promoName: '' };
}

// ======================== DEBOUNCE ========================
function debounce(fn, delay) {
  var timer;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}
// 검색 input의 oninput을 debounce로 오버라이드 (index.html 수정 불가이므로)
(function() {
  var overrides = {
    'catalog-search': function() { renderCatalog(); },
    'gen-search': function() { renderGenProducts(); },
    'est-search': function() { searchEstProducts(document.getElementById('est-search').value); },
    'client-search': function() { renderClients(); }
  };
  function applyDebounce() {
    Object.keys(overrides).forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !el._debounced) {
        el._debounced = true;
        var debouncedFn = debounce(overrides[id], 300);
        el.oninput = debouncedFn;
      }
    });
  }
  // DOM 로드 후 적용
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDebounce);
  } else {
    setTimeout(applyDebounce, 0);
  }
})();

// ======================== TAB SWITCHING ========================
var _renderedTabs = {};
function switchTab(tab) {
  var t0 = performance.now();
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (event && event.target) event.target.classList.add('active');
  // 현재 탭 기억 (새로고침 시 복원용, 동기화 대상 아님)
  localStorage.setItem('mw_active_tab', tab);
  // 첫 방문 시만 렌더링, 이후는 CSS 전환만 (즉시)
  if (!_renderedTabs[tab]) {
    // 무거운 렌더링을 requestAnimationFrame으로 지연 → UI 먼저 전환
    requestAnimationFrame(function() {
      if (tab === 'catalog') renderCatalog();
      if (tab === 'order') renderPOTab();
      if (tab === 'sales') { renderSales(); renderOnlineSales(); }
      if (tab === 'promo') { renderPromo(); renderAllPromosV2(); }
      if (tab === 'setbun') renderSetbun();
      if (tab === 'estimate') { renderEstimateList(); if (!_estDateManuallySet) document.getElementById('est-date').value = getTodayStr(); }
      if (tab === 'general') renderGenProducts();
      if (tab === 'manage') { loadFeeSettings(); switchSettingsMain('fee'); }
      _renderedTabs[tab] = true;
      console.log('[PERF] switchTab(' + tab + ') 렌더링: ' + (performance.now() - t0).toFixed(0) + 'ms');
    });
  } else {
    // 견적 탭 재방문 시 날짜 갱신 (사용자가 직접 변경하지 않은 경우)
    if (tab === 'estimate' && !_estDateManuallySet) {
      document.getElementById('est-date').value = getTodayStr();
    }
    console.log('[PERF] switchTab(' + tab + ') 캐시 히트: ' + (performance.now() - t0).toFixed(0) + 'ms');
  }
}

function switchOrderMain(type) {
  document.querySelectorAll('.order-tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('#order-main-tabs .sub-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  const normalWrap = document.getElementById('order-normal-wrap');
  const promoWrap = document.getElementById('order-promo-wrap');

  var kpiBar = document.getElementById('order-kpi-bar');

  if (type === 'normal') {
    normalWrap.style.display = 'block';
    promoWrap.style.display = 'none';
    if (kpiBar) kpiBar.style.display = 'flex';
    switchOrderSub('elec');
  } else if (type === 'promo') {
    normalWrap.style.display = 'none';
    promoWrap.style.display = 'block';
    if (kpiBar) kpiBar.style.display = 'none';
    switchPromoSub('po');
  }
}

function switchPromoSub(type) {
  document.querySelectorAll('.order-tab-content').forEach(t => t.style.display = 'none');
  document.getElementById('order-' + type).style.display = 'block';

  ['po', 'spot'].forEach(t => {
    const btn = document.getElementById('order-sub-' + t);
    if (btn) { btn.className = t === type ? 'btn-action' : 'btn-sub-inactive'; }
  });
  const sheetBtn = document.getElementById('order-sub-po-sheet');
  if (sheetBtn) { sheetBtn.className = type === 'po-sheet' ? 'btn-header-accent' : 'btn-header-accent'; }

  if (type === 'po') renderPoOrder();
  if (type === 'spot') renderSpotOrder();
  if (type === 'po-sheet') renderPromoOrderSheet();
}

function switchOrderSub(type) {
  document.querySelectorAll('.order-tab-content').forEach(t => t.style.display = 'none');
  document.getElementById('order-' + type).style.display = 'block';

  ['elec', 'hand', 'pack'].forEach(t => {
    const btn = document.getElementById('order-sub-' + t);
    if (!btn) return;
    btn.className = t === type ? 'btn-action' : 'btn-sub-inactive';
  });
  const sheetBtn = document.getElementById('order-sub-sheet');
  if (sheetBtn) { sheetBtn.className = 'btn-header-accent'; }
  if (type === 'sheet') renderOrderSheet();
}

// ======================== 발주서 빠른 추가 ========================
function showSheetAC(input, type) {
  var val = input.value.trim();
  var acDiv = document.getElementById('sheet-ac-' + type);
  if (!val || val.length < 1) { acDiv.style.display = 'none'; return; }

  var q = val.toLowerCase();
  var results = DB.products.filter(function(p) {
    if (p.discontinued) return false;
    return String(p.orderNum || '').includes(q) ||
           String(p.code).includes(q) ||
           String(p.model || '').toLowerCase().includes(q);
  }).slice(0, 10);

  if (!results.length) { acDiv.style.display = 'none'; return; }

  acDiv.innerHTML = results.map(function(p) {
    var stock = findStock(p.code);
    var stockTxt = stock != null ? stock : '-';
    return '<div onclick="selectSheetAC(\'' + type + '\',' + p.code + ')" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid #F0F2F7;display:flex;gap:8px;align-items:center" onmouseover="this.style.background=\'#F4F6FA\'" onmouseout="this.style.background=\'white\'">' +
      '<span style="color:#5A6070;min-width:40px">' + (p.orderNum || '-') + '</span>' +
      '<span style="font-weight:500;min-width:50px">' + p.code + '</span>' +
      '<span style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + (p.model || '') + '</span>' +
      '<span style="color:#1D9E75;font-weight:500">' + fmt(p.supplyPrice) + '</span>' +
      '<span style="color:#5A6070;font-size:10px">[' + stockTxt + ']</span>' +
      '</div>';
  }).join('');
  acDiv.style.display = 'block';
}

function selectSheetAC(type, code) {
  var p = findProduct(code);
  if (!p) return;
  document.getElementById('sheet-add-' + type + '-ordernum').value = p.orderNum || p.code;
  document.getElementById('sheet-add-' + type + '-ordernum').dataset.code = code;
  document.getElementById('sheet-ac-' + type).style.display = 'none';
  document.getElementById('sheet-add-' + type + '-qty').focus();
}

function addSheetItem(type) {
  var input = document.getElementById('sheet-add-' + type + '-ordernum');
  var qtyInput = document.getElementById('sheet-add-' + type + '-qty');
  var code = input.dataset.code;

  if (!code) {
    var val = input.value.trim();
    if (!val) { toast('순번 또는 코드를 입력하세요'); return; }
    var found = DB.products.find(function(p) {
      return String(p.orderNum) === val || String(p.code) === val;
    });
    if (!found) { toast('제품을 찾을 수 없습니다: ' + val); return; }
    code = found.code;
  }

  var qty = parseInt(qtyInput.value) || 1;

  var existing = DB.orders[type].find(function(item) { return String(item.code) === String(code); });
  if (existing) {
    existing.qty = (existing.qty || 0) + qty;
  } else {
    DB.orders[type].push({ code: String(code), qty: qty, memo: '' });
  }

  save(KEYS.orders, DB.orders);
  renderOrderSheet();
  calcOrderTotals();

  input.value = '';
  input.dataset.code = '';
  qtyInput.value = '';
  input.focus();

  var p = findProduct(code);
  toast((p ? p.model : code) + ' ' + qty + '개 추가');
}

document.addEventListener('click', function(e) {
  ['elec', 'hand', 'pack'].forEach(function(type) {
    var ac = document.getElementById('sheet-ac-' + type);
    if (ac && !ac.contains(e.target) && e.target.id !== 'sheet-add-' + type + '-ordernum') {
      ac.style.display = 'none';
    }
    var oac = document.getElementById('order-ac-' + type);
    if (oac && !oac.contains(e.target) && e.target.id !== 'order-search-' + type) {
      oac.style.display = 'none';
    }
  });
});

// ======================== 발주 탭 인라인 검색 ========================
function showOrderSearchAC(input, type) {
  var val = input.value.trim();
  var acDiv = document.getElementById('order-ac-' + type);
  if (!val || val.length < 1) { acDiv.style.display = 'none'; return; }

  var q = val.toLowerCase();
  var results = DB.products.filter(function(p) {
    if (p.discontinued) return false;
    return String(p.code).includes(q) ||
           String(p.orderNum || '').includes(q) ||
           String(p.model || '').toLowerCase().includes(q) ||
           String(p.description || '').toLowerCase().includes(q);
  }).slice(0, 15);

  if (!results.length) {
    acDiv.innerHTML = '<div style="padding:10px;color:#9BA3B2;text-align:center">검색 결과 없음</div>';
    acDiv.style.display = 'block';
    return;
  }

  acDiv.innerHTML = results.map(function(p) {
    var stock = findStock(p.code);
    var stockTxt = stock != null ? stock : '-';
    var alreadyAdded = DB.orders[type].some(function(item) { return String(item.code) === String(p.code) && item.qty > 0; });
    var addedBadge = alreadyAdded ? '<span style="background:#E6F1FB;color:#185FA5;font-size:10px;padding:1px 4px;border-radius:3px;margin-left:4px">추가됨</span>' : '';
    return '<div onclick="selectOrderSearchAC(\'' + type + '\',\'' + p.code + '\')" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #F0F2F7;display:flex;gap:8px;align-items:center" onmouseover="this.style.background=\'#F4F6FA\'" onmouseout="this.style.background=\'white\'">' +
      '<span style="color:#5A6070;min-width:35px;font-size:11px">' + (p.orderNum || '-') + '</span>' +
      '<span style="font-weight:600;min-width:50px">' + p.code + '</span>' +
      '<span style="font-weight:500;min-width:120px">' + (p.model || '') + '</span>' +
      '<span style="flex:1;color:#5A6070;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px">' + (p.description || '') + '</span>' +
      '<span style="color:#1D9E75;font-weight:500;min-width:60px;text-align:right">' + fmt(p.supplyPrice) + '</span>' +
      '<span style="color:#5A6070;font-size:10px;min-width:30px;text-align:right">[' + stockTxt + ']</span>' +
      addedBadge +
      '</div>';
  }).join('');
  acDiv.style.display = 'block';
}

function selectOrderSearchAC(type, code) {
  var p = findProduct(code);
  if (!p) return;
  var input = document.getElementById('order-search-' + type);
  input.value = p.code + ' ' + (p.model || '');
  input.dataset.code = code;
  document.getElementById('order-ac-' + type).style.display = 'none';

  // 바로 수량 1로 추가
  var existing = DB.orders[type].find(function(item) { return String(item.code) === String(code); });
  if (existing) {
    existing.qty = (existing.qty || 0) + 1;
  } else {
    DB.orders[type].push({ code: String(code), qty: 1, memo: '' });
  }
  save(KEYS.orders, DB.orders);

  var renderFn = type === 'elec' || type === 'hand' || type === 'pack' ? 'renderOrderTab' : null;
  if (typeof renderOrderTab === 'function') renderOrderTab(type);
  calcOrderTotals();

  input.value = '';
  input.dataset.code = '';
  toast((p.model || code) + ' 1개 추가');
}

function addOrderSearchItem(type) {
  var input = document.getElementById('order-search-' + type);
  var code = input.dataset.code;

  if (!code) {
    var val = input.value.trim();
    if (!val) { toast('코드 또는 모델명을 입력하세요'); return; }
    var found = DB.products.find(function(p) {
      return String(p.orderNum) === val || String(p.code) === val;
    });
    if (!found) { toast('제품을 찾을 수 없습니다: ' + val); return; }
    code = found.code;
  }

  var existing = DB.orders[type].find(function(item) { return String(item.code) === String(code); });
  if (existing) {
    existing.qty = (existing.qty || 0) + 1;
  } else {
    DB.orders[type].push({ code: String(code), qty: 1, memo: '' });
  }
  save(KEYS.orders, DB.orders);
  if (typeof renderOrderTab === 'function') renderOrderTab(type);
  calcOrderTotals();

  var p = findProduct(code);
  input.value = '';
  input.dataset.code = '';
  document.getElementById('order-ac-' + type).style.display = 'none';
  toast((p ? p.model : code) + ' 1개 추가');
}

function renderOrderSheet() {
  const now = new Date();
  document.getElementById('order-sheet-date').textContent = now.toLocaleDateString('ko') + ' ' + now.toLocaleTimeString('ko', {hour:'2-digit',minute:'2-digit'});

  ['elec', 'hand', 'pack'].forEach(type => {
    const items = DB.orders[type].filter(item => item.code && item.qty > 0);
    const body = document.getElementById(`sheet-${type}-body`);
    let totalCost = 0;
    let totalSupply = 0;

    body.innerHTML = items.map(item => {
      const p = findProduct(item.code);
      const supply = p ? p.supplyPrice : 0;
      const cost = p ? Math.round(calcOrderCost(p.supplyPrice, p.category || '')) : 0;
      const amountSupply = supply * item.qty;
      const amountCost = cost * item.qty;
      totalSupply += amountSupply;
      totalCost += amountCost;
      return `<tr>
        <td>${item.code}</td>
        <td style="font-weight:500;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p ? p.model : '-'}</td>
        <td class="num">${item.qty}</td>
        <td class="num" style="font-weight:600">${fmtN(amountSupply)}</td>
        <td class="num" style="font-weight:600;color:#1D9E75">${fmtN(amountCost)}</td>
      </tr>`;
    }).join('');

    if (items.length) {
      body.innerHTML += '<tr style="background:#FAEEDA;border-top:2px solid var(--tl-border)"><td></td><td></td><td></td><td class="num" style="font-weight:700;font-size:13px;padding:8px 10px">' + fmt(totalSupply) + '</td><td class="num" style="font-weight:700;font-size:13px;padding:8px 10px;color:#1D9E75">' + fmt(totalCost) + '</td></tr>';
    }

    if (!items.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9BA3B2;padding:20px">발주없음</td></tr>';
    }

    document.getElementById(`sheet-${type}-count`).textContent = items.length ? `(${items.length}건)` : '';
    document.getElementById(`sheet-${type}-sum`).innerHTML = `${fmt(totalSupply)} <span style="color:#1D9E75;margin-left:4px">${fmt(totalCost)}</span>`;
    document.getElementById(`sheet-gt-${type}`).textContent = fmt(totalCost);
  });

  const grandTotal = ['elec', 'hand', 'pack'].reduce((sum, type) => {
    return sum + DB.orders[type].filter(i => i.code && i.qty > 0).reduce((s, item) => {
      const p = findProduct(item.code);
      return s + (p ? (p.cost || 0) * item.qty : 0);
    }, 0);
  }, 0);
  document.getElementById('sheet-gt-total').textContent = fmt(grandTotal);
}

function switchPromoTab(type) {
  const tabs = ['newprod', 'package', 'monthly', 'cumul', 'quarter', 'spot', 'commercial'];
  tabs.forEach(t => {
    const el = document.getElementById('promo-tab-' + t);
    if (el) el.style.display = t === type ? 'block' : 'none';
  });
  document.querySelectorAll('#tab-promo .sub-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
}

// ======================== TAB 1: CATALOG ========================
let catalogFilterMode = 'all';

function setCatalogFilter(mode) {
  catalogFilterMode = mode;
  document.querySelectorAll('#catalog-filter-tabs .mw-filter-tab').forEach(function(btn) {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  renderCatalog();
}

var _lastRenderCatalog = 0;
var _catalogRowNum = 0;
function renderCatalog() {
  var now = performance.now();
  if (now - _lastRenderCatalog < 200) return;
  _lastRenderCatalog = now;
  _catalogRowNum = 0;
  var _rc0 = now;
  const search = document.getElementById('catalog-search').value.toLowerCase();
  const cat = document.getElementById('catalog-cat').value;
  const sub = document.getElementById('catalog-sub').value;

  let filtered = DB.products.filter(p => {
    if (cat && p.category !== cat) return false;
    if (sub && p.subcategory !== sub) return false;
    if (search) {
      const s = `${p.code} ${p.manageCode || ''} ${p.category || ''} ${p.subcategory || ''} ${p.detail || ''} ${p.orderNum || ''} ${p.model} ${p.description} ${p.ttiNum}`.toLowerCase();
      return s.includes(search);
    }
    return true;
  });

  // 서브탭 필터 적용
  if (catalogFilterMode === 'instock') {
    filtered = filtered.filter(function(p) {
      var stock = findStock(p.code);
      return stock != null && stock > 0;
    });
  } else if (catalogFilterMode === 'outstock') {
    filtered = filtered.filter(function(p) {
      var stock = findStock(p.code);
      return stock != null && stock <= 0;
    });
  } else if (catalogFilterMode === 'discontinued') {
    filtered = filtered.filter(function(p) { return !!p.discontinued; });
  } else if (catalogFilterMode === 'nocode') {
    filtered = filtered.filter(function(p) { return !p.manageCode || p.manageCode.trim() === '' || p.manageCode === '-'; });
  } else if (catalogFilterMode === 'nosku') {
    filtered = filtered.filter(function(p) { return !p.code || p.code.trim() === '' || p.code === '-'; });
  }

  // Sort: active items first (by subcategory), discontinued at bottom
  const active = sortProducts(filtered.filter(p => !p.discontinued));
  const discontinued = sortProducts(filtered.filter(p => p.discontinued));

  function getCategoryColor(cat) {
    var map = { '파워툴': { bg:'#DBEAFE', color:'#1E40AF' }, '수공구': { bg:'#D1FAE5', color:'#065F46' }, '악세사리': { bg:'#FEF3C7', color:'#92400E' }, '팩아웃': { bg:'#FCE7F3', color:'#9D174D' }, '드릴비트': { bg:'#E0E7FF', color:'#3730A3' } };
    return map[cat] || { bg:'#F3F4F6', color:'#374151' };
  }
  // TTI 스크래핑 데이터 맵 (본사가용 컬럼용)
  var _ttiStockMap = {};
  try {
    var _ttiRaw = JSON.parse(localStorage.getItem('mw_tti_products') || '{}');
    var _ttiData = _ttiRaw.data || [];
    _ttiData.forEach(function(t) {
      _ttiStockMap[normalizeTtiCode(t.productCode)] = t.stockStatus || '';
    });
  } catch(e) {}

  function buildRow(p) {
    const idx = DB.products.indexOf(p);
    const stock = findStock(p.code);
    const stockBadge = stock == null ? '<span class="badge badge-gray">-</span>' :
      stock > 0 ? `<span class="badge badge-green">${stock}</span>` :
      stock === 0 ? '<span class="badge badge-amber">0</span>' :
      `<span class="badge badge-red">${stock}</span>`;
    // 제품DC 컬럼 제거됨 (카테고리 기반으로 변경)
    const isD = !!p.discontinued;
    const cc = getCategoryColor(p.category);
    _catalogRowNum = (_catalogRowNum || 0) + 1;
    return `<tr class="${isD ? 'row-discontinued' : ''}">
      <td class="mw-no-col center" style="width:40px;min-width:40px;font-size:11px;color:#9BA3B2" data-code="${p.code}">${_catalogRowNum}</td>
      <td style="font-weight:500">${p.code}</td>
      <td>${p.manageCode || '-'}</td>
      <td><span style="background:${cc.bg};color:${cc.color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">${p.category || '-'}</span></td>
      <td>${p.subcategory || '-'}</td>
      <td>${p.detail || '-'}</td>
      <td class="center">${p.orderNum || '-'}</td>
      <td>${p.ttiNum || '-'}</td>
      <td style="max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.model || ''}">${(function(){ var m=p.model||''; var si=m.indexOf(' / '); if(si<0) return '<span style="font-weight:500">'+m+'</span>'; return '<span style="font-weight:500">'+m.substring(0,si)+'</span> <span style="color:#888">'+m.substring(si)+'</span>'; })()}</td>
      <td class="num">${fmt(p.supplyPrice)}</td>
      <td class="num">${fmt(p.cost)}</td>
      ${(function() {
  const code = String(p.code);
  const results = [];
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  (orderHistory || []).forEach(function(record) {
    if ((now - new Date(record.date).getTime()) < weekMs) {
      (record.items || []).forEach(function(it) {
        if (String(it.code) === code) {
          results.push({ cost: it.cost });
        }
      });
    }
  });
  (poHistory || []).forEach(function(record) {
    if ((now - new Date(record.date).getTime()) < weekMs) {
      (record.items || []).forEach(function(it) {
        if (String(it.code) === code) {
          results.push({ cost: it.cost });
        }
      });
    }
  });
  if (!results.length) {
    return '<td class="num" style="background:#FEFAFA;color:#9BA3B2">-</td>';
  }
  var latest = results[results.length - 1];
  return '<td class="num" style="background:#FEFAFA"><span style="color:#CC2222;font-weight:700">' + fmt(latest.cost) + '</span> <span onclick="showPromoPop(event,\'' + code + '\')" style="display:inline-block;background:#CC2222;color:white;font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;cursor:pointer;vertical-align:middle">P</span></td>';
      })()}
      <td class="num">${fmt(p.priceA)}</td>
      <td class="num">${fmt(p.priceRetail)}</td>
      <td class="num" style="padding:4px 3px">${isD ? fmt(p.priceNaver) : marketBadge(p, 'naver')}</td>
      <td class="num" style="padding:4px 3px">${isD ? fmt(p.priceOpen) : marketBadge(p, 'gmarket')}</td>
      <td class="num" style="padding:4px 3px">${isD ? fmt(p.priceSsg || 0) : marketBadge(p, 'ssg')}</td>
      <td class="center">${stockBadge}</td>
      <td class="center">${(function(){
        // TTI 스크래핑 데이터 우선, 없으면 기존 ttiStock 폴백
        var ttiCode = normalizeTtiCode(p.ttiNum);
        var ttiStatus = ttiCode && _ttiStockMap[ttiCode] !== undefined ? _ttiStockMap[ttiCode] : null;
        if (ttiStatus !== null) {
          if (ttiStatus === 'a') return '<svg width="18" height="18" viewBox="0 0 18 18" title="적정"><circle cx="9" cy="9" r="6" fill="#4A90D9"/></svg>';
          if (ttiStatus === 'b') return '<svg width="18" height="18" viewBox="0 0 18 18" title="임박"><polygon points="9,3 15,14 3,14" fill="#F5A623"/></svg>';
          if (ttiStatus === 'c') return '<svg width="18" height="18" viewBox="0 0 18 18" title="소진"><line x1="4" y1="4" x2="14" y2="14" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round"/><line x1="14" y1="4" x2="4" y2="14" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round"/></svg>';
          return '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="4" y="8" width="10" height="2" rx="1" fill="#B4B2A9"/></svg>';
        }
        var s = p.ttiStock || '';
        if (!s || s === '-') return '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="4" y="8" width="10" height="2" rx="1" fill="#B4B2A9"/></svg>';
        s = s.trim();
        if (s === '적정' || s === 'O') return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="#4A90D9"/></svg>';
        if (s === '임박' || s === '세모') return '<svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,3 15,14 3,14" fill="#F5A623"/></svg>';
        if (s === '소진' || s === 'X') return '<svg width="18" height="18" viewBox="0 0 18 18"><line x1="4" y1="4" x2="14" y2="14" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round"/><line x1="14" y1="4" x2="4" y2="14" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round"/></svg>';
        return '<span style="font-size:11px;color:#5A6070">' + s + '</span>';
      })()}</td>
      <td style="text-align:left;font-size:12px;cursor:pointer;white-space:nowrap;padding-left:8px" onclick="editInDate(${idx})" title="클릭하여 입고날짜 메모 편집">${p.inDate ? '<span style="color:#CC2222;margin-right:4px">●</span>' + p.inDate : '-'}</td>
    </tr>`;
  }

  const body = document.getElementById('catalog-body');
  // 초기 50행만 렌더링, 나머지는 스크롤 시 점진 로드
  var INITIAL_ROWS = 50;
  var allRows = active;
  var _catalogDiscontinued = discontinued;
  var _catalogRenderedCount = 0;

  // 모듈 스코프로 노출 (편집 모드 전체 렌더링용)
  window._catalogAllRows = allRows;
  window._catalogDiscontinued = _catalogDiscontinued;
  window._catalogBuildRow = buildRow;

  function renderBatch(start, count) {
    var fragment = '';
    var end = Math.min(start + count, allRows.length);
    for (var i = start; i < end; i++) { fragment += buildRow(allRows[i]); }
    // 마지막 배치 후 단종 품목 추가
    if (end >= allRows.length && _catalogDiscontinued.length > 0 && start < allRows.length) {
      fragment += '<tr class="discontinued-divider"><td colspan="20">단종 품목 (' + _catalogDiscontinued.length + '건)</td></tr>';
      fragment += _catalogDiscontinued.slice(0, 200).map(buildRow).join('');
    }
    _catalogRenderedCount = end;
    return fragment;
  }

  body.innerHTML = renderBatch(0, INITIAL_ROWS);

  // 편집 모드 중이면 새로 렌더링된 행의 No. td를 체크박스로 교체
  if (_mwEditMode) {
    body.querySelectorAll('.mw-no-col').forEach(function(td) {
      if (td.querySelector('.mw-edit-cb')) return;
      td._origHTML = td.innerHTML;
      var code = td.dataset.code || '';
      td.innerHTML = '<input type="checkbox" class="mw-edit-cb" value="' + code + '" onchange="updateMwEditSelection()" style="width:15px;height:15px;accent-color:#185FA5">';
    });
    updateMwEditSelection();
  }

  // 스크롤 시 나머지 행 점진 로드 — 이전 리스너 제거 후 재등록
  var scrollContainer = body.closest('.table-scroll');
  if (scrollContainer) {
    if (scrollContainer._catalogScroll) {
      scrollContainer.removeEventListener('scroll', scrollContainer._catalogScroll);
      scrollContainer._catalogScroll = null;
    }
  }
  if (scrollContainer && allRows.length > INITIAL_ROWS) {
    var _loadingMore = false;
    scrollContainer._catalogScroll = function() {
      if (_loadingMore || _catalogRenderedCount >= allRows.length) return;
      if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 200) {
        _loadingMore = true;
        requestAnimationFrame(function() {
          var html = renderBatch(_catalogRenderedCount, 100);
          if (html) {
            body.insertAdjacentHTML('beforeend', html);
            // 편집 모드 중이면 새로 추가된 행의 No. td를 체크박스로 교체
            if (_mwEditMode) {
              body.querySelectorAll('.mw-no-col').forEach(function(td) {
                if (td.querySelector('.mw-edit-cb')) return;
                td._origHTML = td.innerHTML;
                var code = td.dataset.code || '';
                td.innerHTML = '<input type="checkbox" class="mw-edit-cb" value="' + code + '" onchange="updateMwEditSelection()" style="width:15px;height:15px;accent-color:#185FA5">';
              });
              updateMwEditSelection();
            }
          }
          _loadingMore = false;
          if (_catalogRenderedCount >= allRows.length && scrollContainer._catalogScroll) {
            scrollContainer.removeEventListener('scroll', scrollContainer._catalogScroll);
          }
        });
      }
    };
    scrollContainer.addEventListener('scroll', scrollContainer._catalogScroll);
  }

  const activeCount = active.length;
  const disconCount = discontinued.length;
  document.getElementById('catalog-count').textContent = `${filtered.length}건 (단종 ${disconCount}건)`;

  // KPI
  const totalProducts = DB.products.length;
  const totalDiscon = DB.products.filter(p => p.discontinued).length;
  const inStock = DB.inventory.filter(i => i.stock > 0).length;
  const outStock = DB.inventory.filter(i => i.stock <= 0).length;
  document.getElementById('catalog-kpi').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">전체 제품</div><div class="kpi-value">${totalProducts.toLocaleString()}건</div></div>
    <div class="kpi-card-light"><div class="kpi-label">재고 있음</div><div class="kpi-value">${inStock.toLocaleString()}건</div></div>
    <div class="kpi-card-light"><div class="kpi-label">재고없음</div><div class="kpi-value">${outStock.toLocaleString()}건</div></div>
    <div class="kpi-card-light"><div class="kpi-label">단종</div><div class="kpi-value" style="color:#CC2222">${totalDiscon.toLocaleString()}건</div></div>
    <div class="kpi-card-light"><div class="kpi-label">관리코드없음</div><div class="kpi-value" style="color:#EF9F27">${DB.products.filter(p => !p.manageCode || p.manageCode.trim() === '' || p.manageCode === '-').length.toLocaleString()}건</div></div>
  `;

  if (!filtered.length && !DB.products.length) {
    body.innerHTML = '<tr><td colspan="21"><div class="empty-state"><p>제품 데이터가 없습니다</p><button class="btn-primary" onclick="showImportModal()">📥 엑셀 가져오기</button> <button class="btn-primary" style="margin-left:8px" onclick="showProductModal()">+ 제품 추가</button></div></td></tr>';
  }

  var _rc1 = performance.now();
  console.log('[PERF] renderCatalog — buildRow+innerHTML: ' + (_rc1 - _rc0).toFixed(0) + 'ms');
  initColumnResize('catalog-table');
  initStickyHeader('catalog-table');

  // 서브탭 건수 업데이트
  (function updateFilterCounts() {
    var all = DB.products;
    var instock = all.filter(function(p) { var s = findStock(p.code); return s != null && s > 0; });
    var outstock = all.filter(function(p) { var s = findStock(p.code); return s != null && s <= 0; });
    var disc = all.filter(function(p) { return !!p.discontinued; });
    var nocode = all.filter(function(p) { return !p.manageCode || p.manageCode.trim() === '' || p.manageCode === '-'; });
    var nosku = all.filter(function(p) { return !p.code || p.code.trim() === '' || p.code === '-'; });

    var tabs = document.querySelectorAll('#catalog-filter-tabs .mw-filter-tab');
    if (tabs[0]) tabs[0].textContent = '전체제품(' + all.length + ')';
    if (tabs[1]) tabs[1].textContent = '재고있음(' + instock.length + ')';
    if (tabs[2]) tabs[2].textContent = '재고없음(' + outstock.length + ')';
    if (tabs[3]) tabs[3].textContent = '단종(' + disc.length + ')';
    if (tabs[4]) tabs[4].textContent = '관리코드없음(' + nocode.length + ')';
    if (tabs[5]) tabs[5].textContent = '코드없음(' + nosku.length + ')';
  })();
  console.log('[PERF] renderCatalog 전체: ' + (performance.now() - _rc0).toFixed(0) + 'ms');
}

function toggleDiscontinued(idx, checked) {
  DB.products[idx].discontinued = checked ? '단종' : '';
  save(KEYS.products, DB.products);
  renderCatalog();
}

function toggleAllDiscontinued(checked) {
  // Only affect currently filtered/visible items
  const search = document.getElementById('catalog-search').value.toLowerCase();
  const cat = document.getElementById('catalog-cat').value;
  const sub = document.getElementById('catalog-sub').value;

  DB.products.forEach(p => {
    let match = true;
    if (cat && p.category !== cat) match = false;
    if (sub && p.subcategory !== sub) match = false;
    if (search) {
      const s = `${p.code} ${p.manageCode || ''} ${p.category || ''} ${p.subcategory || ''} ${p.detail || ''} ${p.orderNum || ''} ${p.model} ${p.description} ${p.ttiNum}`.toLowerCase();
      if (!s.includes(search)) match = false;
    }
    if (match) p.discontinued = checked ? '단종' : '';
  });
  save(KEYS.products, DB.products);
  renderCatalog();
  toast(checked ? '필터된 제품 전체 단종 처리' : '필터된 제품 전체 단종 해제');
}

// Sort order: 대분류 first, then 중분류
// User's exact 16-step sort order (numbered 1-16)
const SUBCAT_ORDER = [
  '12V FUEL',         // 1
  '12V 브러쉬리스',    // 2
  '12V 브러쉬',       // 3
  '12V 기타',         // 4
  '18V FUEL',         // 5
  '18V 브러쉬리스',    // 6
  '18V 브러쉬',       // 7
  '18V 기타',         // 8
  'MX FUEL',          // 9 (also matches 'MX' via fuzzy)
  'MX',               // 9.5
  '측정공구',          // 10
  '작업공구',          // 11
  '안전장비',          // 11.5
  '비트',             // 12
  '드릴비트 SDS +',    // 13
  '드릴비트 SDS MAX',  // 13.5
  '블레이드',          // 14
  '소켓',             // 14.5
  '파워툴 전용 액세서리', // 14.6
  '엠파이어',          // 14.7
  '툴박스',           // 15 (팩아웃)
  '스토리지',          // 15.1
  '벽걸이',           // 15.2
  '소프트 백',         // 15.3
  'L4',              // 15.5
  '유선',             // 15.6
  'IR',              // 15.7
  '기타'              // 16
];

function getSubcatOrder(subcat) {
  if (!subcat) return 999;
  const idx = SUBCAT_ORDER.indexOf(subcat);
  if (idx >= 0) return idx;
  let best = -1, bestLen = 0;
  for (let i = 0; i < SUBCAT_ORDER.length; i++) {
    if (subcat.includes(SUBCAT_ORDER[i]) && SUBCAT_ORDER[i].length > bestLen) {
      best = i; bestLen = SUBCAT_ORDER[i].length;
    }
    if (SUBCAT_ORDER[i].includes(subcat) && subcat.length > bestLen) {
      best = i; bestLen = subcat.length;
    }
  }
  return best >= 0 ? best : 998;
}

function sortProducts(list) {
  return [...list].sort((a, b) => {
    const oa = getSubcatOrder(a.subcategory);
    const ob = getSubcatOrder(b.subcategory);
    if (oa !== ob) return oa - ob;
    return String(a.model || '').localeCompare(String(b.model || ''));
  });
}

function populateCatalogFilters() {
  const cats = [...new Set(DB.products.map(p => p.category).filter(Boolean))].sort();
  const subs = [...new Set(DB.products.map(p => p.subcategory).filter(Boolean))].sort();
  document.getElementById('catalog-cat').innerHTML = '<option value="">전체 대분류</option>' + cats.map(c => `<option>${c}</option>`).join('');
  document.getElementById('catalog-sub').innerHTML = '<option value="">전체 중분류</option>' + subs.map(s => `<option>${s}</option>`).join('');
}

// ======================== TAB 2: ORDER MANAGEMENT ========================
// ======================== PRODUCT PICKER FOR ORDERS ========================
let pickerOrderType = '';
let pickerSelected = new Set();

function showProductPicker(type) {
  pickerOrderType = type;
  pickerSelected = new Set();
  document.getElementById('product-picker-modal').classList.add('show');
  document.getElementById('picker-search').value = '';
  document.getElementById('picker-select-all').checked = false;

  // Populate filters
  const cats = [...new Set(DB.products.map(p => p.category).filter(Boolean))];
  const catSel = document.getElementById('picker-cat');
  catSel.innerHTML = '<option value="">전체 대분류</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('picker-sub').innerHTML = '<option value="">전체 중분류</option>';

  renderPickerList();
}

function closeProductPicker() {
  document.getElementById('product-picker-modal').classList.remove('show');
}

function renderPickerList() {
  const search = document.getElementById('picker-search').value.toLowerCase();
  const cat = document.getElementById('picker-cat').value;
  const sub = document.getElementById('picker-sub').value;

  // Update subcategory filter
  if (cat) {
    const subs = [...new Set(DB.products.filter(p => p.category === cat).map(p => p.subcategory).filter(Boolean))];
    const subSel = document.getElementById('picker-sub');
    const curSub = subSel.value;
    subSel.innerHTML = '<option value="">전체 중분류</option>' + subs.map(s => `<option value="${s}" ${s === curSub ? 'selected' : ''}>${s}</option>`).join('');
  }

  let filtered = DB.products.filter(p => !p.discontinued);
  if (cat) filtered = filtered.filter(p => p.category === cat);
  if (sub) filtered = filtered.filter(p => p.subcategory === sub);
  if (search) filtered = filtered.filter(p => {
    const s = `${p.code} ${p.model} ${p.description} ${p.subcategory}`.toLowerCase();
    return s.includes(search);
  });

  const body = document.getElementById('picker-body');
  body.innerHTML = filtered.slice(0, 200).map(p => {
    const idx = DB.products.indexOf(p);
    const stock = findStock(p.code);
    const stockTxt = stock == null ? '-' : stock;
    const checked = pickerSelected.has(idx);
    return `<tr style="${checked ? 'background:#E6F1FB' : ''}">
      <td class="center"><input type="checkbox" ${checked ? 'checked' : ''} onchange="togglePickerItem(${idx},this.checked)"></td>
      <td>${p.code}</td>
      <td><span class="badge badge-blue">${p.category || '-'}</span></td>
      <td>${p.subcategory || '-'}</td>
      <td style="font-weight:500">${p.model || '-'}</td>
      <td style="max-width:200px;overflow:hidden;white-space:nowrap" title="${p.description || ''}">${p.description || '-'}</td>
      <td class="num">${fmt(p.supplyPrice)}</td>
      <td class="num" style="color:#1D9E75;font-weight:600">${fmt(p.cost)}</td>
      <td class="center">${stockTxt}</td>
    </tr>`;
  }).join('');

  updatePickerCount();
}

function togglePickerItem(idx, checked) {
  if (checked) pickerSelected.add(idx);
  else pickerSelected.delete(idx);
  updatePickerCount();
}

function togglePickerAll(checked) {
  const search = document.getElementById('picker-search').value.toLowerCase();
  const cat = document.getElementById('picker-cat').value;
  const sub = document.getElementById('picker-sub').value;

  let filtered = DB.products.filter(p => !p.discontinued);
  if (cat) filtered = filtered.filter(p => p.category === cat);
  if (sub) filtered = filtered.filter(p => p.subcategory === sub);
  if (search) filtered = filtered.filter(p => `${p.code} ${p.model} ${p.description}`.toLowerCase().includes(search));

  if (checked) {
    filtered.slice(0, 200).forEach(p => pickerSelected.add(DB.products.indexOf(p)));
  } else {
    filtered.forEach(p => pickerSelected.delete(DB.products.indexOf(p)));
  }
  renderPickerList();
}

function updatePickerCount() {
  document.getElementById('picker-selected-count').textContent = `${pickerSelected.size}건 선택`;
}

function confirmProductPicker() {
  if (!pickerSelected.size) { toast('제품을 선택해주세요'); return; }

  const type = pickerOrderType;
  let addedCount = 0;

  pickerSelected.forEach(idx => {
    const p = DB.products[idx];
    if (!p) return;
    const codeStr = String(p.code);
    // Skip if already in order list
    if (DB.orders[type].some(o => String(o.code) === codeStr)) return;
    DB.orders[type].push({
      code: codeStr,
      qty: 0
    });
    addedCount++;
  });

  save(KEYS.orders, DB.orders);
  closeProductPicker();
  setTimeout(() => {
    renderOrderTab(type);
    calcOrderTotals();
    toast(`${addedCount}건 제품 추가 완료 (중복 ${pickerSelected.size - addedCount}건 제외)`);
  }, 100);
}

function addOrderRow(type) {
  DB.orders[type].push({ code: '', qty: 0 });
  save(KEYS.orders, DB.orders);
  renderOrderTab(type);
}

function removeOrderRow(type, idx) {
  DB.orders[type].splice(idx, 1);
  save(KEYS.orders, DB.orders);
  renderOrderTab(type);
  calcOrderTotals();
}

function clearOrderTab(type) {
  if (!confirm('이 카테고리의 발주 항목을 모두 삭제하시겠습니까?')) return;
  DB.orders[type] = [];
  save(KEYS.orders, DB.orders);
  renderOrderTab(type);
  calcOrderTotals();
}

function resetOrderQty(type) {
  if (!DB.orders[type].length) { toast('초기화할 항목이 없습니다'); return; }
  DB.orders[type].forEach(item => { item.qty = 0; });
  save(KEYS.orders, DB.orders);
  renderOrderTab(type);
  calcOrderTotals();
  toast('수량 초기화 완료');
}

function onOrderCodeChange(type, idx, val) {
  DB.orders[type][idx].code = val;
  save(KEYS.orders, DB.orders);
  renderOrderTab(type);
}

function onOrderQtyChange(type, idx, val) {
  DB.orders[type][idx].qty = parseInt(val) || 0;
  save(KEYS.orders, DB.orders);
  calcOrderTotals();
}

function onOrderMemoChange(type, idx, val) {
  DB.orders[type][idx].memo = val;
  save(KEYS.orders, DB.orders);
}

// 발주 정렬: 세트→베어툴 그룹핑
function _sortOrderItems(items) {
  // 각 항목에 모델명과 분류 정보 추가
  var entries = items.map(function(item, i) {
    var p = findProduct(item.code);
    var model = p ? String(p.model || '') : '';
    var barePattern = model.replace(/-\d+([A-Za-z]*)$/, '-0$1');
    var lastHyphen = model.lastIndexOf('-');
    var afterHyphen = lastHyphen >= 0 ? model.substring(lastHyphen + 1) : '';
    var numPart = parseInt(afterHyphen) || 0;
    var isSet = lastHyphen >= 0 && /^[1-9]\d*/.test(afterHyphen);
    var isBare = lastHyphen >= 0 && /^0[A-Za-z0]*$/.test(afterHyphen);
    var baseKey = model.replace(/-\S*$/, '');
    return { origIdx: i, model: model, baseKey: baseKey, barePattern: barePattern, isSet: isSet, isBare: isBare };
  });

  // 1. 세트와 베어툴 매칭
  var setItems = entries.filter(function(e) { return e.isSet; });
  var bareItems = entries.filter(function(e) { return e.isBare; });
  var otherItems = entries.filter(function(e) { return !e.isSet && !e.isBare; });

  // 세트를 모델명순 정렬
  setItems.sort(function(a, b) { return a.model.localeCompare(b.model); });

  var usedBare = {};
  var groups = [];

  // 세트 + 매칭 베어툴 그룹
  setItems.forEach(function(se) {
    groups.push(se);
    // 매칭 베어툴 찾기
    bareItems.forEach(function(be) {
      if (usedBare[be.origIdx]) return;
      if (be.baseKey === se.baseKey) {
        groups.push(be);
        usedBare[be.origIdx] = true;
      }
    });
  });

  // 매칭 안 된 베어툴 (모델명순)
  var unmatchedBare = bareItems.filter(function(be) { return !usedBare[be.origIdx]; });
  unmatchedBare.sort(function(a, b) { return a.model.localeCompare(b.model); });

  // 기타 제품 (모델명순)
  otherItems.sort(function(a, b) { return a.model.localeCompare(b.model); });

  return groups.concat(unmatchedBare).concat(otherItems);
}

function renderOrderTab(type) {
  const body = document.getElementById(`order-${type}-body`);

  // 세트→베어툴 그룹핑 정렬
  var items = DB.orders[type];
  var sorted = _sortOrderItems(items);

  body.innerHTML = sorted.map(si => {
    var i = si.origIdx;
    var item = items[i];
    const p = findProduct(item.code);
    const stock = findStock(item.code);
    const supplyPrice = p ? p.supplyPrice : 0;
    const cost = p ? Math.round(calcOrderCost(p.supplyPrice, p.category || '')) : 0;
    const qty = item.qty || 0;
    const stockBadge = stock == null ? '-' : stock > 0 ? `<span class="badge badge-green">${stock}</span>` : `<span class="badge badge-red">${stock}</span>`;
    return `<tr>
      <td><button class="btn-danger btn-sm" onclick="removeOrderRow('${type}',${i})" style="padding:2px 6px">✕</button></td>
      <td>${item.code || '-'}</td>
      <td style="font-weight:500;white-space:nowrap">${p ? p.model : '-'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p ? p.description : '-'}</td>
      <td class="center">${stockBadge}</td>
      <td style="text-align:left;font-size:12px;white-space:nowrap;padding-left:8px">${p && p.inDate ? '<span style="color:#CC2222;margin-right:4px">●</span>' + p.inDate : '-'}</td>
      <td><input type="number" value="${item.qty || ''}" onchange="onOrderQtyChange('${type}',${i},this.value)" min="0" style="width:70px"></td>
      <td class="num">${fmt(supplyPrice)}</td>
      <td class="num" style="font-weight:600">${qty > 0 ? fmt(supplyPrice * qty) : '-'}</td>
      <td class="num" style="color:#1D9E75">${fmt(cost)}</td>
      <td class="num" style="color:#1D9E75;font-weight:600">${qty > 0 ? fmt(cost * qty) : '-'}</td>
      <td><input value="${item.memo || ''}" onchange="onOrderMemoChange('${type}',${i},this.value)" placeholder="" style="width:100%;font-size:12px"></td>
    </tr>`;
  }).join('');
  if (!DB.orders[type].length) {
    body.innerHTML = '<tr><td colspan="12"><div class="empty-state"><p>발주 항목이 없습니다</p><button class="btn-action-sub" onclick="showProductPicker(\'' + type + '\')">📋 제품 불러오기</button></div></td></tr>';
  }
  const orderTableId = 'order-' + type + '-table';
  initColumnResize(orderTableId);
  initStickyHeader(orderTableId);
  calcOrderTotals();
}

function calcOrderTotals() {
  const calc = type => DB.orders[type].reduce((sum, item) => {
    const p = findProduct(item.code);
    return sum + (p ? (p.supplyPrice || 0) * (item.qty || 0) : 0);
  }, 0);
  const elec = calc('elec'), hand = calc('hand'), pack = calc('pack');
  const grand = elec + hand + pack;

  // 텍스트: 0이면 "-", 아니면 콤마 포맷
  document.getElementById('order-elec-total').textContent = elec > 0 ? comma(elec) : '-';
  document.getElementById('order-hand-total').textContent = hand > 0 ? comma(hand) : '-';
  document.getElementById('order-pack-total').textContent = pack > 0 ? comma(pack) : '-';
  document.getElementById('order-grand-total').textContent = grand > 0 ? comma(grand) : '-';

  // 배경색: 금액>0이면 검정, 아니면 흰색+테두리
  [['order-elec-total', elec], ['order-hand-total', hand], ['order-pack-total', pack]].forEach(function(pair) {
    var el = document.getElementById(pair[0]);
    var wrap = el ? el.parentElement : null;
    if (!wrap) return;
    if (pair[1] > 0) {
      wrap.style.background = '#1A1D23'; wrap.style.border = 'none';
      wrap.children[0].style.color = 'rgba(255,255,255,0.6)';
      el.style.color = '#FFF';
    } else {
      wrap.style.background = '#F4F6FA'; wrap.style.border = '1px solid #DDE1EB';
      wrap.children[0].style.color = '#5A6070';
      el.style.color = '#1A1D23';
    }
  });
  // 발주합계: 금액>0이면 빨강, 아니면 흰색+테두리
  var grandEl = document.getElementById('order-grand-total');
  var grandWrap = grandEl ? grandEl.parentElement : null;
  if (grandWrap) {
    if (grand > 0) {
      grandWrap.style.background = '#A32D2D'; grandWrap.style.border = 'none';
      grandWrap.children[0].style.color = 'rgba(255,255,255,0.7)';
      grandEl.style.color = '#FFF';
    } else {
      grandWrap.style.background = '#F4F6FA'; grandWrap.style.border = '1px solid #DDE1EB';
      grandWrap.children[0].style.color = '#5A6070';
      grandEl.style.color = '#1A1D23';
    }
  }
  // Auto-refresh 발주서 if visible
  if (document.getElementById('order-sheet').style.display !== 'none') renderOrderSheet();
}

// ========================================
// 발주 탭 — 공통 유틸리티
// ========================================

// 숫자 콤마 포맷 (발주 탭 전용, 0도 표시)
function fmtPO(n) {
  if (n == null || isNaN(n)) return '-';
  return Number(n).toLocaleString('ko-KR');
}

// input 실시간 콤마 포맷
function fmtCommaInput(el) {
  var raw = el.value.replace(/[^0-9]/g, '');
  el.value = raw ? parseInt(raw).toLocaleString('ko-KR') : '';
}

// 티어 상수
var HANDTOOL_TIERS = [
  { amount: 1000000, rate: 8 },
  { amount: 4000000, rate: 10 },
  { amount: 12000000, rate: 12 }
];
var PACKOUT_TIERS = [
  { amount: 1000000, rate: 5 },
  { amount: 3000000, rate: 8 },
  { amount: 6000000, rate: 10 },
  { amount: 12000000, rate: 13 }
];

function getCurrentTier(amount, tiers) {
  var current = { amount: 0, rate: 0 };
  for (var i = 0; i < tiers.length; i++) { if (amount >= tiers[i].amount) current = tiers[i]; }
  return current;
}
function getNextTier(amount, tiers) {
  for (var i = 0; i < tiers.length; i++) { if (amount < tiers[i].amount) return tiers[i]; }
  return null;
}

function getQuarterRange(date) {
  var y = date.getFullYear(), m = date.getMonth();
  var q = Math.floor(m / 3);
  return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0, 23, 59, 59) };
}
function getMonthRange(date) {
  var y = date.getFullYear(), m = date.getMonth();
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) };
}

// 발주 이력 집계
// ========================================
// 커머셜 프로모션 헬퍼
// ========================================
function _getCommercialPromos() {
  return JSON.parse(localStorage.getItem('mw_commercial_promos') || '[]');
}
function _saveCommercialPromos(arr) {
  save('mw_commercial_promos', arr);
}
function _getActiveCommercialPromo() {
  var promos = _getCommercialPromos();
  var today = new Date(); today.setHours(0,0,0,0);
  for (var i = 0; i < promos.length; i++) {
    var s = new Date(promos[i].startDate); s.setHours(0,0,0,0);
    var e = new Date(promos[i].endDate); e.setHours(23,59,59,999);
    if (today >= s && today <= e) return promos[i];
  }
  return null;
}
function _calcCommercialSales(promo) {
  if (!promo) return 0;
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var pStart = new Date(promo.startDate); pStart.setHours(0,0,0,0);
  var pEnd = new Date(promo.endDate); pEnd.setHours(23,59,59,999);
  var total = 0;
  history.forEach(function(item) {
    var d = new Date(item.date);
    if (d >= pStart && d <= pEnd) total += (item.amount || 0);
  });
  return total;
}
function _findCommercialTier(promo, sales) {
  if (!promo || !promo.tiers || promo.tiers.length === 0) return { current: null, currentIdx: -1, next: null };
  var currentIdx = -1;
  for (var i = 0; i < promo.tiers.length; i++) {
    var t = promo.tiers[i];
    if (sales >= t.minAmount && (t.maxAmount === null || sales < t.maxAmount)) { currentIdx = i; break; }
  }
  if (currentIdx === -1 && sales < promo.tiers[0].minAmount) {
    return { current: null, currentIdx: -1, next: promo.tiers[0], shortage: promo.tiers[0].minAmount - sales };
  }
  var current = currentIdx >= 0 ? promo.tiers[currentIdx] : null;
  var next = currentIdx >= 0 && currentIdx + 1 < promo.tiers.length ? promo.tiers[currentIdx + 1] : null;
  var shortage = next ? next.minAmount - sales : 0;
  return { current: current, currentIdx: currentIdx, next: next, shortage: shortage };
}
function _commPeriodLabel(promo) {
  if (!promo) return '';
  var sm = parseInt(promo.startDate.split('-')[1], 10);
  var em = parseInt(promo.endDate.split('-')[1], 10);
  return sm === em ? sm + '월' : sm + '~' + em + '월';
}

function calcPOSalesData() {
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var now = new Date();
  var monthRange = getMonthRange(now);
  var quarterRange = getQuarterRange(now);

  // 제품 → 카테고리 맵
  var catMap = {};
  (DB.products || []).forEach(function(p) {
    if (p.ttiNum) catMap[p.ttiNum] = p.category || '';
    if (p.code) catMap[p.code] = p.category || '';
  });

  var powerTool = 0, handTool = 0, packout = 0, totalMonth = 0, first15 = 0, last15 = 0;

  history.forEach(function(item) {
    if (item.dryRun) return;
    var d = new Date(item.date);
    var amt = item.amount || 0;
    var cat = catMap[item.ttiNum] || catMap[item.manageCode] || '';
    // 일반주문 여부: subtab 필드 있으면 사용, 없으면 type으로 판별 (레거시 호환)
    var isNormal = item.subtab ? item.subtab === 'normal' : item.type === 'normal';

    // 파워툴: 이번 달 (일반주문만)
    if (isNormal && cat === '파워툴' && d >= monthRange.start && d <= monthRange.end) powerTool += amt;
    // 수공구+액세서리: 분기 (일반주문만)
    if (isNormal && (cat === '수공구' || cat === '악세사리' || cat === '액세서리') && d >= quarterRange.start && d <= quarterRange.end) handTool += amt;
    // 팩아웃: 이번 달 (일반주문만)
    if (isNormal && cat === '팩아웃' && d >= monthRange.start && d <= monthRange.end) packout += amt;

    // 이번 달 전체 (합계용 — 모든 subtab 합산)
    if (d >= monthRange.start && d <= monthRange.end) {
      totalMonth += amt;
      if (d.getDate() <= 15) first15 += amt; else last15 += amt;
    }
  });

  // 누적프로모션 집계
  var promos = JSON.parse(localStorage.getItem('mw_cumulative_promos') || 'null') || [];
  var cumulData = promos.map(function(promo, idx) {
    if (!promo.products || promo.products.length === 0) return { idx: idx, amount: 0, achieveCount: 0, shortage: promo.targetAmount || 0 };
    // 정규화된 코드 맵 (ttiNum + model)
    var promoCodeMap = {};
    promo.products.forEach(function(pr) {
      if (pr.ttiNum) promoCodeMap[normalizeTtiCode(pr.ttiNum)] = true;
      if (pr.model) promoCodeMap['_model_' + pr.model.toLowerCase()] = true;
    });
    var pStart = promo.periodStart ? new Date(promo.periodStart) : monthRange.start;
    var pEnd = promo.periodEnd ? new Date(promo.periodEnd + 'T23:59:59') : monthRange.end;
    var sales = 0;
    history.forEach(function(item) {
      var d = new Date(item.date);
      if (d < pStart || d > pEnd) return;
      var matched = false;
      if (item.ttiNum && promoCodeMap[normalizeTtiCode(item.ttiNum)]) matched = true;
      if (!matched && item.manageCode && promoCodeMap[normalizeTtiCode(item.manageCode)]) matched = true;
      if (!matched && item.model && promoCodeMap['_model_' + item.model.toLowerCase()]) matched = true;
      if (matched) sales += (item.amount || 0);
    });
    var target = promo.targetAmount || 0;
    var achieve = target > 0 ? Math.floor(sales / target) : 0;
    var remainder = target > 0 ? sales % target : 0;
    var shortage = target > 0 ? target - remainder : target;
    return { idx: idx, amount: sales, achieveCount: achieve, shortage: shortage, remainder: remainder };
  });

  return {
    powerTool: powerTool,
    handTool: handTool,
    packout: packout,
    totalMonth: totalMonth,
    first15: first15,
    last15: last15,
    cumulative: cumulData
  };
}

// 검색 자동완성 초기화
function initPOAutocomplete(inputId, onSelect) {
  var input = document.getElementById(inputId);
  if (!input) return;
  // wrap with relative container
  var parent = input.parentElement;
  if (parent && !parent.classList.contains('po-ac-wrap')) parent.classList.add('po-ac-wrap');

  var dropdown = document.createElement('div');
  dropdown.className = 'po-autocomplete';
  dropdown.id = inputId + '-ac';
  input.parentElement.appendChild(dropdown);

  var selectedIdx = -1;
  var items = [];

  function render(matches) {
    items = matches;
    selectedIdx = -1;
    if (matches.length === 0) { dropdown.classList.remove('show'); return; }
    var h = '';
    matches.forEach(function(p, i) {
      h += '<div class="po-autocomplete-item" data-idx="' + i + '">';
      h += '<span class="ac-code">' + (p.orderNum ? p.orderNum + ' · ' : '') + (p.ttiNum || p.code || '') + '</span>';
      h += '<span class="ac-model">' + (p.model || '-') + '</span>';
      h += '<span class="ac-price">' + fmtPO(p.supplyPrice) + '</span>';
      h += '</div>';
    });
    dropdown.innerHTML = h;
    dropdown.classList.add('show');
  }

  function close() { dropdown.classList.remove('show'); selectedIdx = -1; }

  input.addEventListener('input', function() {
    var val = input.value.trim().toLowerCase();
    if (val.length < 2) { close(); return; }
    var keywords = val.split(/\s+/).filter(function(k) { return k.length > 0; });
    var products = DB.products || [];
    var matches = products.filter(function(p) {
      var text = ((p.model || '') + ' ' + (p.detail || '') + ' ' + (p.code || '') + ' ' + (p.ttiNum || '') + ' ' + (p.orderNum || '') + ' ' + (p.manageCode || '')).toLowerCase();
      return keywords.every(function(kw) { return text.indexOf(kw) !== -1; });
    });
    // 정렬: orderNum 정확일치 → model 시작일치 → 나머지
    var rawVal = val;
    matches.sort(function(a, b) {
      var aExact = (a.orderNum || '') === rawVal ? 0 : 1;
      var bExact = (b.orderNum || '') === rawVal ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      var aStart = (a.model || '').toLowerCase().indexOf(rawVal) === 0 ? 0 : 1;
      var bStart = (b.model || '').toLowerCase().indexOf(rawVal) === 0 ? 0 : 1;
      return aStart - bStart;
    });
    render(matches.slice(0, 10));
  });

  input.addEventListener('keydown', function(e) {
    if (!dropdown.classList.contains('show')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, items.length - 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); highlight(); }
    else if (e.key === 'Enter' && selectedIdx >= 0) { e.preventDefault(); onSelect(items[selectedIdx]); close(); input.value = ''; }
    else if (e.key === 'Escape') { close(); }
  });

  dropdown.addEventListener('click', function(e) {
    var item = e.target.closest('.po-autocomplete-item');
    if (item) {
      var idx = parseInt(item.getAttribute('data-idx'));
      if (items[idx]) { onSelect(items[idx]); close(); input.value = ''; }
    }
  });

  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) close();
  });

  function highlight() {
    dropdown.querySelectorAll('.po-autocomplete-item').forEach(function(el, i) {
      el.classList.toggle('selected', i === selectedIdx);
    });
    var sel = dropdown.querySelector('.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
}

// ========================================
// 발주 탭 리디자인 (Step B-1a)
// ========================================

function _buildPoSubTabs() {
  var tabs = [
    { id: 'normal', label: '일반주문', dot: '#4B9FE8', activeBg: '#185FA5' },
    { id: 'list', label: '발주 리스트', dot: '#B4B2A9', activeBg: '#444441' }
  ];
  return tabs;
}
var _poSubTabs = _buildPoSubTabs();

var _poPromoPalette = [
  { main: '#7F77DD', bg: '#EEEDFE', text: '#3C3489' },
  { main: '#D85A30', bg: '#FAECE7', text: '#712B13' },
  { main: '#1D9E75', bg: '#E1F5EE', text: '#085041' },
  { main: '#D4537E', bg: '#FBEAF0', text: '#72243E' },
  { main: '#378ADD', bg: '#E6F1FB', text: '#0C447C' }
];

function renderPOTab() {
  var container = document.getElementById('tab-order-new');
  if (!container) return;

  // T 프로모션 탭 + 제한수량 새로고침
  _poSubTabs = _buildPoSubTabs();
  PO_PROMO_LIMIT = _getPromoLimits();

  var activeSubTab = localStorage.getItem('mw_po_active_subtab') || 'normal';
  var now = new Date();
  var month = now.getMonth() + 1;

  // 집계 데이터
  var salesData = calcPOSalesData();

  // 상단 매출카드 — 1행 섹션박스 (row1~row5 통일)
  var html = '<div class="po-cards-area">';

  // ── 일반 매출 섹션 ──
  html += '<div class="po-section-box po-section-normal">';
  html += '<div class="po-section-title">일반 매출 <span class="po-section-sub">일반주문만 집계</span></div>';
  html += '<div class="po-section-cards">';

  // 파워툴
  html += '<div class="po-card-cell">';
  html += '<div class="po-card-row1"><span style="color:#185FA5">파워툴</span> <span class="po-card-tag" style="background:#E6F1FB;color:#0C447C">월</span></div>';
  html += '<div class="po-card-row2">' + fmtPO(salesData.powerTool) + '</div>';
  html += '<div class="po-card-row3">목표 - · 0%</div>';
  html += '<div class="po-card-row4" style="color:#9BA3B2">-</div>';
  html += '<div class="po-card-row5"><div class="po-card-row5-fill" style="width:0%;background:#185FA5"></div></div>';
  html += '</div>';

  // 수공구
  var _htCur = getCurrentTier(salesData.handTool, HANDTOOL_TIERS);
  var _htMax = HANDTOOL_TIERS[HANDTOOL_TIERS.length - 1];
  var _htPct = _htMax.amount > 0 ? Math.min(100, Math.round(salesData.handTool / _htMax.amount * 100)) : 0;
  var _htShortage = Math.max(0, _htMax.amount - salesData.handTool);
  var _htDone = salesData.handTool >= _htMax.amount;
  html += '<div class="po-card-cell">';
  html += '<div class="po-card-row1"><span style="color:#1D9E75">수공구</span> <span class="po-card-tag" style="background:#E1F5EE;color:#085041">분기</span></div>';
  html += '<div class="po-card-row2">' + fmtPO(salesData.handTool) + '</div>';
  html += '<div class="po-card-row3">목표 ' + _htMax.rate + '% (' + fmtPO(_htMax.amount) + '원)</div>';
  html += '<div class="po-card-row4" style="color:' + (_htDone ? '#1D9E75' : '#CC2222') + '">' + (_htDone ? '최고 달성' : '부족 ' + fmtPO(_htShortage) + '원') + '</div>';
  html += '<div class="po-card-row5"><div class="po-card-row5-fill" style="width:' + _htPct + '%;background:#1D9E75"></div></div>';
  html += '</div>';

  // 팩아웃
  var _pkCur = getCurrentTier(salesData.packout, PACKOUT_TIERS);
  var _pkMax = PACKOUT_TIERS[PACKOUT_TIERS.length - 1];
  var _pkPct = _pkMax.amount > 0 ? Math.min(100, Math.round(salesData.packout / _pkMax.amount * 100)) : 0;
  var _pkShortage = Math.max(0, _pkMax.amount - salesData.packout);
  var _pkDone = salesData.packout >= _pkMax.amount;
  html += '<div class="po-card-cell">';
  html += '<div class="po-card-row1"><span style="color:#D4537E">팩아웃</span> <span class="po-card-tag" style="background:#FCE7F3;color:#9D174D">월</span></div>';
  html += '<div class="po-card-row2">' + fmtPO(salesData.packout) + '</div>';
  html += '<div class="po-card-row3">목표 ' + _pkMax.rate + '% (' + fmtPO(_pkMax.amount) + '원)</div>';
  html += '<div class="po-card-row4" style="color:' + (_pkDone ? '#1D9E75' : '#CC2222') + '">' + (_pkDone ? '최고 달성' : '부족 ' + fmtPO(_pkShortage) + '원') + '</div>';
  html += '<div class="po-card-row5"><div class="po-card-row5-fill" style="width:' + _pkPct + '%;background:#D4537E"></div></div>';
  html += '</div>';

  html += '</div></div>'; // .po-section-cards, .po-section-box

  // ── 누적 프로모션 섹션 ──
  html += '<div class="po-section-box po-section-promo">';
  html += '<div class="po-section-title">누적 프로모션 <span class="po-section-sub">FOC 쿠폰 기반</span></div>';
  html += '<div class="po-section-cards">';

  var promos = _getCumulPromos();
  if (promos.length === 0) {
    html += '<div class="po-card-cell" style="color:#9BA3B2;font-size:11px;display:flex;align-items:center;justify-content:center">프로모션 없음</div>';
  }
  promos.forEach(function(p, i) {
    var pal = _poPromoPalette[p.paletteIdx || i] || _poPromoPalette[0];
    var cd = salesData.cumulative[i] || { amount: 0, achieveCount: 0, shortage: p.targetAmount || 0 };
    var _target = p.targetAmount || 0;
    var _cardPct = _target > 0 ? Math.min(100, Math.round((cd.remainder || 0) / _target * 100)) : 0;
    var _periodBadge = '';
    if (p.periodStart && p.periodEnd) {
      var _ps = new Date(p.periodStart), _pe = new Date(p.periodEnd);
      var _months = (_pe.getFullYear() - _ps.getFullYear()) * 12 + _pe.getMonth() - _ps.getMonth() + 1;
      if (_months <= 1) _periodBadge = '<span class="po-card-tag" style="background:' + pal.bg + ';color:' + pal.text + '">월</span>';
      else if (_months === 2) _periodBadge = '<span class="po-card-tag" style="background:' + pal.bg + ';color:' + pal.text + '">2월</span>';
      else if (_months === 3) _periodBadge = '<span class="po-card-tag" style="background:' + pal.bg + ';color:' + pal.text + '">분기</span>';
      else _periodBadge = '<span class="po-card-tag" style="background:' + pal.bg + ';color:' + pal.text + '">' + _months + '월</span>';
    }
    html += '<div class="po-card-cell" style="border-left:3px solid ' + pal.main + ';cursor:pointer" onclick="openCumulativePromoModal(' + i + ')">';
    html += '<div class="po-card-row1"><span class="po-card-dot" style="background:' + pal.main + '"></span> ' + p.name + ' ' + _periodBadge + '</div>';
    html += '<div class="po-card-row2" style="color:' + pal.text + '">' + fmtPO(cd.amount) + '</div>';
    html += '<div class="po-card-row3">' + (p.benefit || '-') + ' <span class="po-card-badge">' + cd.achieveCount + '매</span></div>';
    html += '<div class="po-card-row4" style="color:#CC2222">부족 ' + fmtPO(cd.shortage) + '원</div>';
    html += '<div class="po-card-row5"><div class="po-card-row5-fill" style="width:' + _cardPct + '%;background:' + pal.main + '"></div></div>';
    html += '</div>';
  });
  html += '<div class="po-promo-add" onclick="addCumulativePromo()">+</div>';

  html += '</div></div>'; // .po-section-cards, .po-section-box

  html += '</div>'; // .po-cards-area

  // ── 합계 + 탭/뱃지 통합 행 ──
  var _lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  var _poHistory = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var _todayStr = now.toISOString().slice(0, 10);
  var _todayOrders = _poHistory.filter(function(h) { return !h.dryRun && h.date && h.date.slice(0, 10) === _todayStr; });
  var _normalCount = _todayOrders.filter(function(h) { return h.subtab === 'normal' || h.type === 'normal'; }).length;
  var _promoCount = _todayOrders.filter(function(h) { return h.subtab && h.subtab !== 'normal' && h.subtab !== 'foc' && h.type !== 'normal'; }).length;
  var _focCount = _todayOrders.filter(function(h) { return h.subtab === 'foc' || h.type === 'foc'; }).length;
  var _erpTotal = _todayOrders.length;
  var _erpDone = _todayOrders.filter(function(h) { return h.erpRegistered; }).length;

  html += '<div class="po-top-row">';

  // 합계 박스 (파란)
  html += '<div class="po-total-compact">';
  html += '<div><div class="po-tc-label">합계 · ' + month + '월</div><div class="po-tc-value">' + fmtPO(salesData.totalMonth) + '</div></div>';
  html += '<div class="po-tc-split">';
  html += '<div class="po-tc-sp"><div class="po-tc-sp-l">1~15일</div>' + fmtPO(salesData.first15) + '</div>';
  html += '<div class="po-tc-sp"><div class="po-tc-sp-l">16~' + _lastDay + '일</div>' + fmtPO(salesData.last15) + '</div>';
  html += '</div>';
  var _commPromo = _getActiveCommercialPromo();
  if (_commPromo) {
    var _commSales = _calcCommercialSales(_commPromo);
    var _commTier = _findCommercialTier(_commPromo, _commSales);
    var _commRate = _commTier.current && _commTier.current.rate != null ? _commTier.current.rate + '%' : '미달';
    html += '<div class="po-tc-comm" onclick="openCommercialPromoModal()" style="cursor:pointer">';
    html += '커머셜P ' + _commRate;
    if (_commTier.next && _commTier.next.rate != null) {
      var _shortage = _commTier.shortage > 0 ? _commTier.shortage : 0;
      html += ' · 다음 ' + _commTier.next.rate + '%까지 <b style="color:#FFCC66">' + fmtPO(_shortage) + '원</b>';
    }
    html += ' ▶</div>';
  } else {
    html += '<div class="po-tc-comm" onclick="openCommercialPromoModal()" style="cursor:pointer;opacity:0.6">커머셜P 미등록 ▶</div>';
  }
  html += '</div>'; // .po-total-compact

  // 탭+뱃지 박스 (흰)
  html += '<div class="po-action-compact">';
  _poSubTabs.forEach(function(t) {
    var isActive = t.id === activeSubTab;
    html += '<button class="po-badge ' + (isActive ? 'po-tab-active' : 'po-tab-inactive') + '" data-tab="' + t.id + '" onclick="switchPOSubTab(\'' + t.id + '\')">';
    html += '<span class="po-badge-dot" style="background:' + t.dot + '"></span>' + t.label + '</button>';
  });
  html += '<div class="po-action-sep"></div>';
  html += '<span class="po-badge po-stat-blue"><span class="po-badge-dot" style="background:#185FA5"></span>오늘 <b id="po-stat-today">' + _todayOrders.length + '</b>건</span>';
  html += '<span class="po-badge po-stat-green"><span class="po-badge-dot" style="background:#1D9E75"></span>일반 <b id="po-stat-normal">' + _normalCount + '</b>건</span>';
  html += '<span class="po-badge po-stat-amber"><span class="po-badge-dot" style="background:#EF9F27"></span>프로모션 <b id="po-stat-promo">' + _promoCount + '</b>건</span>';
  html += '<span class="po-badge po-stat-teal"><span class="po-badge-dot" style="background:#0F6E56"></span>FOC <b id="po-stat-foc">' + _focCount + '</b>건</span>';
  html += '<span class="po-badge po-stat-red"><span class="po-badge-dot" style="background:#CC2222"></span>경영박사 <b id="po-stat-erp">' + _erpDone + '/' + _erpTotal + '</b></span>';
  html += '</div>'; // .po-action-compact

  html += '</div>'; // .po-top-row

  // 탭 콘텐츠 영역
  html += '<div id="po-tab-contents" style="padding:8px 12px">';

  // 일반주문 탭
  html += '<div id="po-content-normal" class="po-tab-content" style="display:' + (activeSubTab === 'normal' ? 'grid' : 'none') + ';grid-template-columns:1fr 1fr;gap:10px;">';
  html += buildPOProductPanel();
  html += buildPOOrderPanel();
  html += '</div>';

  // 발주 리스트 탭
  html += '<div id="po-content-list" class="po-tab-content" style="display:' + (activeSubTab === 'list' ? 'block' : 'none') + '">';
  html += buildPOListPanel();
  html += '</div>';

  // (FOC/T프로모션/패키지/키트 탭 제거됨 — 일반주문 + 발주리스트만 유지)

  html += '</div>'; // #po-tab-contents

  container.innerHTML = html;

  // 수량 input Enter → 같은 행의 🛒 버튼 클릭 (이벤트 위임)
  var _poContents = document.getElementById('po-tab-contents');
  if (_poContents) _poContents.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var inp = e.target;
    if (!inp || inp.tagName !== 'INPUT' || inp.type === 'search') return;
    if (inp.disabled) return;
    var row = inp.closest('tr');
    if (!row) return;
    var btn = row.querySelector('.po-cart-btn-dark');
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  });

  // 초기 제품 행 렌더링 + 스크롤 이벤트
  renderPOProductRows();
  var scrollEl = document.getElementById('po-prod-scroll');
  if (scrollEl) scrollEl.addEventListener('scroll', onPOProductScroll);

  // 자동완성 초기화
  initPOAutocomplete('po-cart-search', function(p) { addToCartDirect(p); });
  // 장바구니 복원 (localStorage에서)
  renderPOCartTable();
  initPOAutocomplete('po-foc-search', function(p) { console.log('[발주] FOC 검색 선택:', p.model); });
  initPOAutocomplete('po-foc-cart-search', function(p) { console.log('[발주] FOC 등록:', p.model); toast('FOC 기능은 다음 단계에서 구현됩니다'); });
}

// 왼쪽 패널 — 제품 목록 (가상 스크롤)
var _poFilteredProducts = [];
var _poRenderedCount = 0;
var _poTtiStockMap = {};

function buildPOProductPanel() {
  // TTI 재고 맵 (1회 빌드)
  _poTtiStockMap = {};
  try {
    var ttiRaw = JSON.parse(localStorage.getItem('mw_tti_products') || '{}');
    (ttiRaw.data || []).forEach(function(t) { _poTtiStockMap[normalizeTtiCode(t.productCode)] = t.stockStatus || ''; });
  } catch(e) {}

  // 전체 제품 (단종 제외) → 모델명 정렬
  _poFilteredProducts = (DB.products || []).filter(function(p) { return !p.discontinued; });
  var _catOrder = { '파워툴': 1, '수공구': 2, '팩아웃': 3, '악세사리': 4, '액세서리': 4, '드릴비트': 5 };
  _poFilteredProducts.sort(function(a, b) {
    var ca = _catOrder[a.category] || 6, cb = _catOrder[b.category] || 6;
    if (ca !== cb) return ca - cb;
    return (a.model || '').localeCompare(b.model || '', 'ko');
  });

  var html = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
  html += '<div class="po-panel-header"><span>제품 목록<span class="po-header-count" id="po-prod-count">' + _poFilteredProducts.length + '건</span></span></div>';

  // 필터 행
  html += '<div class="po-filter-row">';
  html += '<input type="search" placeholder="코드, 모델명 검색" id="po-prod-search" autocomplete="off" oninput="filterPOProducts()">';

  // 카테고리 select — 실제 카테고리에서 동적 생성
  var cats = {};
  (DB.products || []).forEach(function(p) { if (p.category) cats[p.category] = true; });
  html += '<select id="po-prod-cat" onchange="filterPOProducts()" style="min-width:80px"><option value="">전체</option>';
  Object.keys(cats).sort().forEach(function(c) { html += '<option value="' + c + '">' + c + '</option>'; });
  html += '</select>';

  html += '<select id="po-prod-stock" onchange="filterPOProducts()" style="min-width:80px"><option value="">본사전체</option><option value="a">적정</option><option value="b">임박</option><option value="c">소진</option></select>';
  html += '</div>';

  // 테이블
  html += '<div class="po-panel-body" id="po-prod-scroll">';
  html += '<table class="po-table po-table-lg"><thead><tr>';
  html += '<th class="center" style="width:36px">No</th><th class="center" style="width:36px">누적</th><th>프로모션번호</th><th>제품번호</th><th style="min-width:200px">모델명</th><th class="num">공급가</th><th class="center">가용수량</th><th class="center" style="width:50px">수량</th><th class="center" style="width:36px">주문</th>';
  html += '</tr></thead><tbody id="po-prod-body">';
  html += '</tbody></table></div></div>';
  return html;
}

// 누적프로모션 색상 팔레트 (행 배경 + 태그)
var _poCumulPromoRowStyles = [
  { bg: 'rgba(238,237,254,0.35)', tagBg: '#EEEDFE', tagColor: '#3C3489' },
  { bg: 'rgba(250,236,231,0.35)', tagBg: '#FAECE7', tagColor: '#712B13' },
  { bg: 'rgba(225,245,238,0.35)', tagBg: '#E1F5EE', tagColor: '#085041' },
  { bg: 'rgba(251,234,240,0.35)', tagBg: '#FBEAF0', tagColor: '#72243E' },
  { bg: 'rgba(230,241,251,0.35)', tagBg: '#E6F1FB', tagColor: '#0C447C' }
];

// 제품 행 빌드 (1행) — rowIndex는 표시 순번
function buildPOProductRow(p, rowIndex) {
  var code = normalizeTtiCode(p.ttiNum);
  var stockStatus = code && _poTtiStockMap[code] !== undefined ? _poTtiStockMap[code] : null;
  var stockIcon;
  if (stockStatus === 'a') stockIcon = '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="#4A90D9"/></svg>';
  else if (stockStatus === 'b') stockIcon = '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,2 12,11 2,11" fill="#F5A623"/></svg>';
  else if (stockStatus === 'c') stockIcon = '<svg width="14" height="14" viewBox="0 0 14 14"><line x1="3" y1="3" x2="11" y2="11" stroke="#E24B4A" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="3" x2="3" y2="11" stroke="#E24B4A" stroke-width="2" stroke-linecap="round"/></svg>';
  else stockIcon = '<span style="color:#B4B2A9">-</span>';

  // 누적프로모션 매칭 확인 (normalizeTtiCode로 앞자리0 해결)
  var promoBadge = '';
  var _pCode = normalizeTtiCode(p.ttiNum);
  var cumulPromos = JSON.parse(localStorage.getItem('mw_cumulative_promos') || 'null');
  if (cumulPromos && Array.isArray(cumulPromos)) {
    for (var pi = 0; pi < cumulPromos.length; pi++) {
      var cp = cumulPromos[pi];
      if (cp.products && Array.isArray(cp.products)) {
        var _matched = cp.products.some(function(pr) {
          return (_pCode && normalizeTtiCode(pr.ttiNum) === _pCode) || (p.code && pr.ttiNum === p.code);
        });
        if (_matched) {
          var rs = _poCumulPromoRowStyles[pi] || _poCumulPromoRowStyles[0];
          promoBadge = '<span style="background:' + rs.tagBg + ';color:' + rs.tagColor + ';font-size:9px;font-weight:700;padding:2px 4px;border-radius:3px">누적</span>';
          break;
        }
      }
    }
  }

  // 소진(stock_c) 제품 비활성화
  var _isSoldOut = stockStatus === 'c';
  var _qtyDisabled = _isSoldOut ? ' disabled style="width:44px;height:26px;border:1px solid #DDE1EB;border-radius:3px;text-align:center;font-size:13px;font-family:Pretendard,sans-serif;background:#EAECF2;color:#9BA3B2"' : ' style="width:44px;height:26px;border:1px solid #DDE1EB;border-radius:3px;text-align:center;font-size:13px;font-family:Pretendard,sans-serif"';
  var _btnDisabled = _isSoldOut ? ' disabled style="opacity:0.3;cursor:not-allowed"' : '';

  var tr = '<tr>';
  tr += '<td class="center" style="color:#9BA3B2">' + (rowIndex + 1) + '</td>';
  tr += '<td class="center">' + promoBadge + '</td>';
  tr += '<td>' + (p.orderNum || '-') + '</td>';
  tr += '<td style="font-family:monospace;font-size:12px">' + (p.ttiNum || p.code || '-') + '</td>';
  tr += '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="' + (p.model || '').replace(/"/g, '&quot;') + '">' + (p.model || '-') + '</td>';
  tr += '<td class="num">' + (p.supplyPrice ? parseInt(p.supplyPrice).toLocaleString() : '-') + '</td>';
  tr += '<td class="center">' + stockIcon + '</td>';
  tr += '<td class="center"><input type="number" min="1" placeholder=""' + _qtyDisabled + ' data-code="' + (p.ttiNum || '') + '"></td>';
  tr += '<td class="center"><button class="po-cart-btn-dark"' + _btnDisabled + ' onclick="addToCart(\'' + (p.ttiNum || '') + '\')"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1h1.5l1.2 6h7.6l1.2-4.5H4.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="12" r="1" fill="#fff"/><circle cx="10" cy="12" r="1" fill="#fff"/></svg></button></td>';
  tr += '</tr>';
  return tr;
}

// 제품 목록 초기 렌더링 (첫 50행)
function renderPOProductRows() {
  var body = document.getElementById('po-prod-body');
  if (!body) return;
  _poRenderedCount = Math.min(50, _poFilteredProducts.length);
  var html = '';
  for (var i = 0; i < _poRenderedCount; i++) { html += buildPOProductRow(_poFilteredProducts[i], i); }
  if (_poFilteredProducts.length === 0) {
    html = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#9BA3B2">검색 결과가 없습니다</td></tr>';
  }
  body.innerHTML = html;
  // 건수 업데이트
  var countEl = document.getElementById('po-prod-count');
  if (countEl) countEl.textContent = _poFilteredProducts.length + '건';
}

// 스크롤 시 추가 로드 (100행씩)
function onPOProductScroll() {
  var el = document.getElementById('po-prod-scroll');
  if (!el) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
    if (_poRenderedCount >= _poFilteredProducts.length) return;
    var body = document.getElementById('po-prod-body');
    if (!body) return;
    var end = Math.min(_poRenderedCount + 100, _poFilteredProducts.length);
    var html = '';
    for (var i = _poRenderedCount; i < end; i++) { html += buildPOProductRow(_poFilteredProducts[i], i); }
    body.insertAdjacentHTML('beforeend', html);
    _poRenderedCount = end;
  }
}

// 오른쪽 패널 — 주문 목록
function buildPOOrderPanel() {
  var html = '<div class="po-panel" style="max-height:calc(100vh - 260px);overflow-y:auto">';
  html += '<div class="po-panel-header" style="position:sticky;top:0;z-index:2"><span>주문 목록<span class="po-header-count">0건</span></span>';
  html += '<button style="background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer" onclick="clearPOCart()">비우기</button>';
  html += '</div>';

  // 제품등록 검색행
  html += '<div class="po-register-row" style="position:sticky;top:38px;z-index:2;background:#fff">';
  html += '<span style="font-size:12px;font-weight:600;color:#5A6070;white-space:nowrap">제품등록 :</span>';
  html += '<input type="search" placeholder="상품번호, 모델명, 제품명 검색 → Enter" id="po-cart-search" autocomplete="off" onkeydown="if(event.key===\'Enter\')addPOCartItem()">';
  html += '<button class="po-register-btn" onclick="addPOCartItem()">+ 등록</button>';
  html += '</div>';

  // 테이블
  html += '<div class="po-table-wrap" style="padding:8px">';
  html += '<table class="po-table"><thead><tr>';
  html += '<th class="center" style="width:36px">누적</th><th>프로모션번호</th><th style="min-width:150px">모델명</th><th class="num">공급가</th><th class="center" style="width:50px">수량</th><th class="num">금액</th><th class="center" style="width:30px">✕</th>';
  html += '</tr></thead><tbody id="po-cart-body">';
  html += '<tr><td colspan="7" style="text-align:center;padding:30px;color:#9BA3B2">왼쪽 제품에서 🛒 버튼으로 추가하세요</td></tr>';
  html += '</tbody></table></div>';

  // 합계
  html += '<div class="po-summary">';
  html += '<div class="po-summary-row"><span class="po-summary-label">공급가 합계 <span class="po-summary-count" id="po-cart-count-label"></span></span><span class="po-summary-value" id="po-cart-supply-total">0원</span></div>';
  html += '<div class="po-summary-row po-summary-tax"><span class="po-summary-label">부가세 (10%)</span><span class="po-summary-value" id="po-cart-vat">0원</span></div>';
  html += '<div class="po-summary-row po-summary-total"><span class="po-summary-label">총 합계</span><span class="po-summary-value" id="po-cart-grand-total">0원</span></div>';
  html += '<button class="po-order-btn" onclick="submitPOOrder()">TTI 발주하기</button>';
  html += '</div>';
  html += '</div>';
  return html;
}

// 서브탭 전환
function switchPOSubTab(tabName) {
  document.querySelectorAll('.po-tab-content').forEach(function(el) { el.style.display = 'none'; });
  var content = document.getElementById('po-content-' + tabName);
  // grid 표시 대상: normal, foc, package, kit + 동적 T 프로모션 탭 (promo-*)
  var isGridTab = tabName === 'normal' || tabName === 'foc' || tabName === 'package' || tabName === 'kit' || tabName.indexOf('promo-') === 0;
  if (content) content.style.display = isGridTab ? 'grid' : 'block';

  document.querySelectorAll('.po-action-bar .po-badge[data-tab]').forEach(function(btn) {
    var id = btn.getAttribute('data-tab');
    btn.className = 'po-badge ' + (id === tabName ? 'po-tab-active' : 'po-tab-inactive');
  });

  localStorage.setItem('mw_po_active_subtab', tabName);

  // 발주 리스트 탭 전환 시 재렌더링
  if (tabName === 'list') {
    var listContent = document.getElementById('po-content-list');
    if (listContent) listContent.innerHTML = buildPOListPanel();
  }
}

// ========================================
// 발주 리스트 탭 (6-A)
// ========================================
function buildPOListPanel() {
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var filterEl = localStorage.getItem('mw_po_list_filter') || 'today';

  // 날짜 필터
  var now = new Date();
  // KST 기준 날짜 (UTC+9)
  var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  var weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  var weekStartStr = weekStart.getFullYear() + '-' + String(weekStart.getMonth() + 1).padStart(2, '0') + '-' + String(weekStart.getDate()).padStart(2, '0');
  var monthStartStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';

  var filtered = history.filter(function(item) {
    // item.date를 KST 날짜로 변환
    var itemDate = new Date(item.date);
    var d = itemDate.getFullYear() + '-' + String(itemDate.getMonth() + 1).padStart(2, '0') + '-' + String(itemDate.getDate()).padStart(2, '0');
    if (filterEl === 'today') return d === todayStr;
    if (filterEl === 'week') return d >= weekStartStr;
    if (filterEl === 'month') return d >= monthStartStr;
    return true;
  });

  // 요약 카드 계산
  var todayCount = history.filter(function(i) { return (i.date || '').slice(0, 10) === todayStr; }).length;
  var normalCount = filtered.filter(function(i) { return i.type === 'normal'; }).length;
  var promoCount = filtered.filter(function(i) { return i.type !== 'normal' && i.type !== 'foc'; }).length;
  var focCount = filtered.filter(function(i) { return i.type === 'foc'; }).length;
  var erpDone = filtered.filter(function(i) { return i.erpStatus === 'done'; }).length;

  var h = '';

  h += '<div class="po-panel" style="max-height:calc(100vh - 320px)">';
  h += '<div class="po-panel-header"><span>발주 리스트</span><div style="display:flex;gap:6px;align-items:center">';
  h += '<button class="po-hdr-btn po-hdr-del" onclick="deleteSelectedPOHistory()">선택 삭제</button>';
  h += '<select id="po-list-filter" class="po-hdr-select" onchange="changePOListFilter(this.value)">';
  h += '<option value="today"' + (filterEl === 'today' ? ' selected' : '') + '>오늘</option>';
  h += '<option value="week"' + (filterEl === 'week' ? ' selected' : '') + '>이번 주</option>';
  h += '<option value="month"' + (filterEl === 'month' ? ' selected' : '') + '>이번 달</option>';
  h += '</select>';
  h += '<button class="po-hdr-btn po-hdr-sync" onclick="startTtiOrderSync()">↻ 밀워키 주문내역 동기화</button>';
  h += '<button class="po-hdr-btn po-hdr-erp" onclick="registerErpFromList()">↻ 경영박사 매입전표 등록</button>';
  h += '</div></div>';

  h += '<div class="po-panel-body"><table class="po-table"><thead><tr>';
  h += '<th class="center" style="width:30px"><input type="checkbox" onchange="togglePOListAll(this)"></th>';
  h += '<th>날짜</th><th>구분</th><th>관리코드</th><th>코드</th><th style="min-width:180px">모델명</th><th class="num">수량</th><th class="num">공급가</th><th class="num">매입원가</th><th class="num">금액</th><th class="center">TTI상태</th><th class="center">액션</th><th class="center">주문번호</th><th class="center">경영박사</th>';
  h += '</tr></thead><tbody id="po-list-body">';

  if (filtered.length === 0) {
    h += '<tr><td colspan="14" style="text-align:center;padding:40px;color:#9BA3B2;font-size:12px">발주 내역이 없습니다</td></tr>';
  } else {
    filtered.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    window._poListItems = [];
    filtered.forEach(function(item) {
      window._poListItems.push(item);
      var _poIdx = window._poListItems.length - 1;
      var d = new Date(item.date);
      var dateStr = String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      var typeBadge;
      if (item.type === 'normal') typeBadge = '<span style="background:#EAECF2;color:#5A6070;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500">일반</span>';
      else if (item.type === 'foc') typeBadge = '<span style="background:#FBEAF0;color:#72243E;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500">FOC</span>';
      else typeBadge = '<span style="background:#EEEDFE;color:#3C3489;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500">' + item.type + '</span>';
      var erpBadge = item.erpStatus === 'done' ? '<span style="background:#E1F5EE;color:#085041;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500">등록완료</span>' : '<span style="background:#FAEEDA;color:#633806;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500">미등록</span>';

      // mw_products에서 코드/관리코드 매칭 (ttiNum 기준)
      var _pCode = item.ttiNum || item.manageCode || '';
      var _normCode = normalizeTtiCode(_pCode);
      var _matched = (DB.products || []).find(function(pr) {
        return (pr.ttiNum && normalizeTtiCode(pr.ttiNum) === _normCode) || (pr.code && pr.code === _pCode);
      });
      var _dispManage = _matched ? (_matched.manageCode || '-') : '-';
      var _dispCode = _matched ? (_matched.code || '-') : '-';
      // 금액 = ttiOrderAmount 우선, 없으면 매입원가 × 수량
      var _displayAmt = item.ttiOrderAmount || (item.costPrice && item.costPrice > 0 ? item.costPrice * (item.qty || 0) : 0);

      // TTI 상태
      var ttiStatus = item.ttiOrderStatus || '';
      var ttiStatusBadge = '';
      if (ttiStatus === '주문접수') ttiStatusBadge = '<span style="font-size:10px;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:4px;font-weight:500">주문접수</span>';
      else if (ttiStatus === '주문취소') ttiStatusBadge = '<span style="font-size:10px;padding:2px 8px;background:#fecaca;color:#991b1b;border-radius:4px;font-weight:500">주문취소</span>';
      else ttiStatusBadge = '<span style="font-size:10px;padding:2px 8px;background:#fef3c7;color:#92400e;border-radius:4px;font-weight:500">미동기화</span>';

      // TTI 액션
      var ttiActionBtn = '';
      if (ttiStatus === '주문접수') ttiActionBtn = '<button onclick="ttiCancelOrder(\'' + (item.ttiOrderNo || '') + '\')" style="font-size:10px;padding:2px 8px;background:#fef2f2;color:#991b1b;border:0.5px solid #fecaca;border-radius:4px;cursor:pointer">주문취소</button>';
      else if (ttiStatus === '주문취소') ttiActionBtn = '<button onclick="ttiReorder(window._poListItems[' + _poIdx + '])" style="font-size:10px;padding:2px 8px;background:#dbeafe;color:#1e40af;border:0.5px solid #93c5fd;border-radius:4px;cursor:pointer">재주문</button>';
      else ttiActionBtn = '<span style="color:#9BA3B2;font-size:11px">-</span>';

      // 주문번호
      var orderNoDisp = item.ttiOrderNo ? '<span title="' + item.ttiOrderNo + '" style="font-size:11px;color:#5A6070;cursor:help">' + item.ttiOrderNo.substring(0, 5) + '..' + item.ttiOrderNo.slice(-4) + '</span>' : '<span style="font-size:11px;color:#9BA3B2">-</span>';

      // 취소 행 스타일
      var rowStyle = ttiStatus === '주문취소' ? 'background:#fef2f2;' : '';
      var textDeco = ttiStatus === '주문취소' ? 'text-decoration:line-through;color:#9BA3B2;' : '';

      var _tdS = 'font-size:13px;padding:10px 6px;';
      h += '<tr style="' + rowStyle + '">';
      h += '<td class="center" style="padding:10px 6px"><input type="checkbox" class="po-history-checkbox" data-id="' + item.id + '" onchange="this.closest(\'tr\').style.background=this.checked?\'#E6F1FB\':\'\'"></td>';
      h += '<td style="' + _tdS + 'white-space:nowrap;' + textDeco + '">' + dateStr + '</td>';
      h += '<td style="' + _tdS + '">' + typeBadge + '</td>';
      h += '<td style="' + _tdS + 'color:#5A6070;' + textDeco + '">' + _dispManage + '</td>';
      h += '<td style="' + _tdS + 'color:#5A6070;' + textDeco + '">' + _dispCode + '</td>';
      h += '<td style="' + _tdS + 'max-width:180px;overflow:hidden;text-overflow:ellipsis;' + textDeco + '" title="' + (item.model || '').replace(/"/g, '&quot;') + '">' + (item.model || '-') + '</td>';
      h += '<td class="num" style="' + _tdS + textDeco + '">' + (item.qty || 0) + '</td>';
      h += '<td class="num" style="' + _tdS + textDeco + '">' + fmtPO(item.supplyPrice) + '</td>';
      h += '<td class="num" style="' + _tdS + textDeco + '">' + (item.costPrice ? fmtPO(item.costPrice) : '-') + '</td>';
      h += '<td class="num" style="' + _tdS + 'font-weight:600;' + textDeco + '">' + (_displayAmt > 0 ? fmtPO(_displayAmt) : '-') + '</td>';
      h += '<td class="center" style="padding:10px 6px">' + ttiStatusBadge + '</td>';
      h += '<td class="center" style="padding:10px 6px">' + ttiActionBtn + '</td>';
      h += '<td class="center" style="padding:10px 6px">' + orderNoDisp + '</td>';
      h += '<td class="center" style="padding:10px 6px">' + erpBadge + '</td>';
      h += '</tr>';
    });
  }

  h += '</tbody></table></div></div>';
  return h;
}

// TTI 주문내역 동기화
function syncTtiOrderHistory(ttiOrders) {
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var updated = 0;
  var created = 0;

  // 제품 → 카테고리 맵 (productName 기반 매칭용)
  var _prodByModel = {};
  var _prodByCode = {};
  (DB.products || []).forEach(function(p) {
    if (p.model) _prodByModel[p.model.toLowerCase()] = p;
    if (p.ttiNum) _prodByCode[normalizeTtiCode(p.ttiNum)] = p;
    if (p.code) _prodByCode[p.code] = p;
  });

  // 기존 ttiOrderNo 셋 (중복 방지)
  var existingOrderNos = {};
  history.forEach(function(h) { if (h.ttiOrderNo) existingOrderNos[h.ttiOrderNo] = true; });

  for (var oi = 0; oi < ttiOrders.length; oi++) {
    var ttiOrder = ttiOrders[oi];
    // 취소된 주문 스킵 (상태가 '주문취소'인 경우)
    if (ttiOrder.orderStatus && ttiOrder.orderStatus.indexOf('취소') >= 0) continue;

    // 1차 매칭: ttiOrderNo로 직접 매칭
    var match = null;
    for (var hi = 0; hi < history.length; hi++) {
      if (history[hi].ttiOrderNo === ttiOrder.orderNo) { match = history[hi]; break; }
    }
    if (match) {
      if (match.ttiOrderStatus !== ttiOrder.orderStatus) {
        match.ttiOrderStatus = ttiOrder.orderStatus;
        match.ttiManagerConfirm = ttiOrder.managerConfirm;
        updated++;
      }
      continue;
    }
    // 2차 매칭: 아직 ttiOrderNo 없는 항목 중 날짜+금액
    for (var hi2 = 0; hi2 < history.length; hi2++) {
      if (history[hi2].ttiOrderNo) continue;
      var hDate = (history[hi2].date || '').substring(0, 10);
      var oDate = (ttiOrder.orderDate || '').substring(0, 10);
      if (hDate !== oDate) continue;
      var hAmount = (history[hi2].supplyPrice || 0) * (history[hi2].qty || 0);
      if (Math.abs(hAmount - ttiOrder.orderAmount) > 100) continue;
      match = history[hi2];
      break;
    }
    if (match) {
      match.ttiOrderNo = ttiOrder.orderNo;
      match.ttiOrderDate = ttiOrder.orderDate;
      match.ttiOrderStatus = ttiOrder.orderStatus;
      match.ttiManagerConfirm = ttiOrder.managerConfirm;
      match.ttiOrderAmount = ttiOrder.orderAmount;
      match.ttiVat = ttiOrder.vat;
      match.ttiTotalAmount = ttiOrder.totalAmount;
      match.remark = ttiOrder.remark || '';
      updated++;
      continue;
    }

    // 3차: 미매칭 → 새 엔트리 생성 (TTI 직접 발주)
    if (existingOrderNos[ttiOrder.orderNo]) continue; // 이미 처리됨

    // Remark 기반 분류
    var remark = (ttiOrder.remark || '').trim();
    var subtab = 'normal';
    var type = 'normal';
    var promoName = '';
    if (remark && remark !== 'normal' && remark !== '') {
      // M코드 (M101, M202, M301 등) 또는 기타 프로모션 코드
      if (/^[A-Z]\d+/i.test(remark)) {
        subtab = 'promo-' + remark.toLowerCase();
        type = remark;
        promoName = remark;
      }
    }
    // FOC: 금액 0원
    if (ttiOrder.orderAmount === 0) {
      subtab = 'foc';
      type = 'foc';
    }

    // 제품 매칭으로 카테고리 결정
    var category = '';
    var matchedProd = null;
    var pName = (ttiOrder.productName || '').toLowerCase();
    // productName에서 모델명 추출 시도
    Object.keys(_prodByModel).forEach(function(model) {
      if (!matchedProd && pName.indexOf(model) >= 0) matchedProd = _prodByModel[model];
    });
    if (matchedProd) category = matchedProd.category || '';

    // orderDate를 ISO 형식으로 변환 (YYYY-MM-DD → YYYY-MM-DDTHH:MM:SS)
    var isoDate = ttiOrder.orderDate || '';
    if (isoDate && isoDate.length === 10) isoDate += 'T00:00:00';
    // YYYY.MM.DD 형식 → YYYY-MM-DD
    isoDate = isoDate.replace(/\./g, '-');

    history.push({
      id: 'tti_' + ttiOrder.orderNo + '_' + Date.now(),
      date: isoDate,
      type: type,
      subtab: subtab,
      promoName: promoName,
      manageCode: matchedProd ? (matchedProd.code || '') : '',
      ttiNum: matchedProd ? (matchedProd.ttiNum || '') : '',
      model: matchedProd ? (matchedProd.model || '') : ttiOrder.productName,
      category: category,
      qty: ttiOrder.orderQty || 0,
      supplyPrice: ttiOrder.orderQty > 0 ? Math.round(ttiOrder.orderAmount / ttiOrder.orderQty) : 0,
      costPrice: 0,
      amount: ttiOrder.orderAmount || 0,
      orderNumber: '',
      dryRun: false,
      erpStatus: 'external',
      remark: remark,
      ttiOrderNo: ttiOrder.orderNo,
      ttiOrderDate: ttiOrder.orderDate,
      ttiOrderStatus: ttiOrder.orderStatus,
      ttiManagerConfirm: ttiOrder.managerConfirm,
      ttiOrderAmount: ttiOrder.orderAmount,
      ttiVat: ttiOrder.vat,
      ttiTotalAmount: ttiOrder.totalAmount,
      source: 'tti-scrape'
    });
    existingOrderNos[ttiOrder.orderNo] = true;
    created++;
  }

  save('mw_po_history', history);
  console.log('[app] TTI 주문내역 동기화:', updated, '건 업데이트,', created, '건 신규 생성');

  // 매출카드 + 발주리스트 새로고침
  var kpiRow = document.querySelector('.po-kpi-row');
  if (kpiRow) renderPOTab();
  else {
    var listContent = document.getElementById('po-content-list');
    if (listContent) listContent.innerHTML = buildPOListPanel();
  }
}

function ttiCancelOrder(orderNo) {
  if (!confirm('TTI 주문을 취소하시겠습니까?\n주문번호: ' + orderNo)) return;
  var btn = event && event.target;
  if (btn) { btn.textContent = '처리중...'; btn.disabled = true; btn.style.opacity = '0.5'; }
  window.postMessage({ type: 'TTI_CANCEL_ORDER', orderNo: orderNo }, '*');
}

function ttiReorder(item) {
  if (typeof item === 'string') item = JSON.parse(decodeURIComponent(item));
  if (!confirm('이 제품을 재주문하시겠습니까?\n' + (item.model || item.productName || ''))) return;
  var btn = event && event.target;
  if (btn) { btn.textContent = '처리중...'; btn.disabled = true; btn.style.opacity = '0.5'; }
  window.postMessage({ type: 'TTI_REORDER', orderNo: item.ttiOrderNo }, '*');
}

function changePOListFilter(val) {
  localStorage.setItem('mw_po_list_filter', val);
  // 발주 리스트 영역만 재렌더링
  var listContent = document.getElementById('po-content-list');
  if (listContent) listContent.innerHTML = buildPOListPanel();
}

function registerErpFromList() {
  var checked = document.querySelectorAll('#po-list-body input[type="checkbox"]:checked');
  if (checked.length === 0) { toast('등록할 항목을 선택하세요'); return; }
  var ids = [];
  checked.forEach(function(cb) { ids.push(cb.getAttribute('data-id')); });
  console.log('[발주] 경영박사 매입전표 등록 — 선택 항목:', ids);
  toast('경영박사 API 연결은 추후 구현됩니다 (' + ids.length + '건)');
}

function togglePOListAll(el) {
  document.querySelectorAll('#po-list-body input[type="checkbox"]').forEach(function(cb) {
    cb.checked = el.checked;
    var tr = cb.closest('tr');
    if (tr) tr.style.background = el.checked ? '#E6F1FB' : '';
  });
}

function deleteSelectedPOHistory() {
  var checkboxes = document.querySelectorAll('.po-history-checkbox:checked');
  if (checkboxes.length === 0) { toast('삭제할 항목을 선택해주세요'); return; }
  if (!confirm('선택한 ' + checkboxes.length + '건을 삭제하시겠습니까?\n삭제하면 매출 집계에서도 제외됩니다.')) return;
  var idsToDelete = {};
  checkboxes.forEach(function(cb) { idsToDelete[cb.getAttribute('data-id')] = true; });
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  history = history.filter(function(entry) { return !idsToDelete[entry.id]; });
  save('mw_po_history', history);
  renderPOTab();
  toast(checkboxes.length + '건 삭제 완료');
}

// ========================================
// FOC 발주 탭 (6-B)
// ========================================
function buildPOFocLeftPanel() {
  var h = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
  h += '<div class="po-panel-header"><span>FOC 대상 제품</span></div>';
  h += '<div class="po-filter-row"><input type="search" placeholder="FOC 제품 검색..." id="po-foc-search" autocomplete="off"></div>';
  h += '<div class="po-panel-body"><table class="po-table"><thead><tr>';
  h += '<th>프로모션</th><th style="min-width:180px">모델명</th><th class="center" style="width:50px">수량</th><th class="center" style="width:36px">주문</th>';
  h += '</tr></thead><tbody id="po-foc-prod-body">';
  h += '<tr><td colspan="4" style="text-align:center;padding:40px;color:#9BA3B2;font-size:12px">달성된 프로모션이 없습니다</td></tr>';
  h += '</tbody></table></div></div>';
  return h;
}

function buildPOFocRightPanel() {
  var h = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
  h += '<div class="po-panel-header"><span>FOC 주문 목록 <span class="po-header-count">0건</span></span>';
  h += '<button style="background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer" onclick="clearFOCCart()">비우기</button></div>';
  h += '<div class="po-register-row"><span style="font-size:12px;font-weight:600;color:#5A6070;white-space:nowrap">FOC 등록 :</span>';
  h += '<input type="search" placeholder="FOC 제품 검색 → Enter" id="po-foc-cart-search" autocomplete="off" onkeydown="if(event.key===\'Enter\')addFOCCartItem()">';
  h += '<button class="po-register-btn" onclick="addFOCCartItem()">+ 등록</button></div>';
  h += '<div class="po-panel-body"><table class="po-table"><thead><tr>';
  h += '<th>프로모션</th><th style="min-width:150px">모델명</th><th class="center" style="width:50px">수량</th><th class="num">금액</th><th class="center" style="width:30px">✕</th>';
  h += '</tr></thead><tbody id="po-foc-cart-body">';
  h += '<tr><td colspan="5" style="text-align:center;padding:30px;color:#9BA3B2;font-size:12px">왼쪽에서 FOC 제품을 추가하세요</td></tr>';
  h += '</tbody></table></div>';
  h += '<div class="po-summary">';
  h += '<div class="po-summary-row"><span class="po-summary-label">FOC 합계 <span class="po-summary-count">(0건, 0개)</span></span><span class="po-summary-value">0원</span></div>';
  h += '<div class="po-summary-row po-summary-total"><span class="po-summary-label">총 합계</span><span class="po-summary-value" style="color:#72243E">0원 (무상 증정)</span></div>';
  h += '<button class="po-order-btn" onclick="submitFOCOrder()">FOC 발주하기</button>';
  h += '</div></div>';
  return h;
}

function clearFOCCart() { console.log('[발주] FOC 장바구니 비우기'); }
function addFOCCartItem() { console.log('[발주] FOC 제품등록'); toast('FOC 기능은 다음 단계에서 구현됩니다'); }
function submitFOCOrder() { console.log('[발주] FOC 발주하기'); toast('FOC 발주 기능은 다음 단계에서 구현됩니다'); }

// ========================================
// 누적프로모션 모달 (6-C)
// ========================================
function _getCumulPromos() {
  return JSON.parse(localStorage.getItem('mw_cumulative_promos') || 'null') || [
    { name: 'GEN4+FQID2', amount: '0', benefit: 'FOC 쿠폰 24만', achieved: 0, next: '0', paletteIdx: 0, targetAmount: 3000000, period: '', unlimited: true, currentSales: 0, products: [] },
    { name: 'CBL2', amount: '0', benefit: 'FOC 쿠폰 10만', achieved: 0, next: '0', paletteIdx: 1, targetAmount: 1000000, period: '', unlimited: true, currentSales: 0, products: [] }
  ];
}

function openCumulativePromoModal(index) {
  var promos = _getCumulPromos();
  var promo = promos[index];
  if (!promo) return;
  var pal = _poPromoPalette[promo.paletteIdx || index] || _poPromoPalette[0];
  // 기간 기본값: 이번 달 1일~말일
  var _now = new Date();
  var _y = _now.getFullYear(), _m = _now.getMonth();
  var _defStart = promo.periodStart || (_y + '-' + String(_m + 1).padStart(2, '0') + '-01');
  var _lastDay = new Date(_y, _m + 1, 0).getDate();
  var _defEnd = promo.periodEnd || (_y + '-' + String(_m + 1).padStart(2, '0') + '-' + String(_lastDay).padStart(2, '0'));
  var products = promo.products || [];
  var pct = promo.targetAmount > 0 ? Math.min(100, Math.round((promo.currentSales || 0) / promo.targetAmount * 100)) : 0;
  // 달성 자동 계산
  var _autoAchieve = promo.targetAmount > 0 ? Math.floor((promo.currentSales || 0) / promo.targetAmount) : 0;
  var _remainder = promo.targetAmount > 0 ? (promo.currentSales || 0) % promo.targetAmount : 0;
  var _nextShortage = promo.targetAmount > 0 ? promo.targetAmount - _remainder : promo.targetAmount || 0;

  var existing = document.getElementById('po-cumul-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'po-cumul-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';

  // 헤더 텍스트: 새 프로모션이면 "누적 프로모션 설정", 기존이면 "이름 누적 프로모션"
  var _headerTitle = (promo.name && promo.name !== '새 프로모션') ? promo.name + ' 누적 프로모션' : '누적 프로모션 설정';
  var h = '<div style="background:#fff;border-radius:10px;width:680px;max-width:95vw;max-height:80vh;overflow:hidden;border:1px solid #DDE1EB;display:flex;flex-direction:column">';
  // 헤더
  h += '<div style="background:#1A1D23;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">';
  h += '<div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:' + pal.main + '"></span><span style="font-size:14px;font-weight:600">' + _headerTitle + '</span></div>';
  h += '<button onclick="document.getElementById(\'po-cumul-modal\').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button></div>';

  // 바디
  h += '<div style="padding:16px;overflow-y:auto;flex:1">';
  // 자동 할인율 계산
  var _benefitAmt = promo.benefitAmount || 0;
  var _autoDC = promo.targetAmount > 0 && _benefitAmt > 0 ? (_benefitAmt / promo.targetAmount * 100) : 0;

  // 정보 3칸 (실시간 업데이트 대상)
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
  h += '<div style="background:#F4F6FA;border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:#5A6070">기준금액</div><div id="cumul-info-target" style="font-size:15px;font-weight:700;color:#CC2222">' + (promo.targetAmount ? fmtPO(promo.targetAmount) + '원 당' : '-') + '</div></div>';
  h += '<div style="background:#F4F6FA;border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:#5A6070">현재 누적매출</div><div style="font-size:15px;font-weight:700;color:' + pal.text + '">' + fmtPO(promo.currentSales || 0) + '원</div></div>';
  h += '<div style="background:#F4F6FA;border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:#5A6070">혜택 / 달성</div><div style="display:flex;align-items:center;gap:4px"><span id="cumul-info-benefit" style="font-size:13px;font-weight:600">' + (promo.benefit || '-') + '</span><span style="background:' + pal.bg + ';color:' + pal.text + ';padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600">' + _autoAchieve + '회 달성</span></div></div>';
  h += '</div>';

  // 프로그레스
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div style="flex:1;height:5px;background:#EAECF2;border-radius:3px;overflow:hidden"><div id="cumul-progress-bar" style="width:' + pct + '%;height:100%;background:' + pal.main + ';border-radius:3px"></div></div><span id="cumul-progress-pct" style="font-size:11px;font-weight:600;color:' + pal.text + '">' + pct + '%</span></div>';
  var _periodDisplay = _defStart && _defEnd ? _defStart.replace(/-/g, '.') + '~' + _defEnd.replace(/-/g, '.') : '기간 미설정';
  h += '<div style="font-size:10px;color:#9BA3B2;margin-bottom:16px">' + _autoAchieve + '회 달성 · 잔여 ' + fmtPO(_remainder) + '원 · 다음까지 <span style="color:#CC2222;font-weight:600">' + fmtPO(_nextShortage) + '원 부족</span> · ' + _periodDisplay + '</div>';

  // 설정 필드 (3칸 → 2행)
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">프로모션명</label><input id="cumul-name" value="' + (promo.name || '').replace(/"/g, '&quot;') + '" oninput="updateCumulInfo()" style="width:100%;height:30px;border:1px solid #DDE1EB;border-radius:4px;padding:0 8px;font-size:12px;font-family:Pretendard,sans-serif"></div>';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">혜택 설명</label><input id="cumul-benefit" value="' + (promo.benefit || '').replace(/"/g, '&quot;') + '" oninput="updateCumulInfo()" style="width:100%;height:30px;border:1px solid #DDE1EB;border-radius:4px;padding:0 8px;font-size:12px;font-family:Pretendard,sans-serif"></div>';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">혜택금액 (원)</label><input id="cumul-benefit-amount" type="text" value="' + fmtPO(_benefitAmt) + '" oninput="fmtCommaInput(this);updateCumulDC()" style="width:100%;height:30px;border:1px solid #DDE1EB;border-radius:4px;padding:0 8px;font-size:12px;font-family:Pretendard,sans-serif;text-align:right"></div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">기준금액 (원)</label><input id="cumul-target" type="text" value="' + fmtPO(promo.targetAmount || 0) + '" oninput="fmtCommaInput(this);updateCumulInfo();updateCumulDC()" style="width:100%;height:30px;border:1px solid #DDE1EB;border-radius:4px;padding:0 8px;font-size:12px;font-family:Pretendard,sans-serif;text-align:right"></div>';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">기간</label><div style="display:flex;align-items:center;gap:4px"><input id="cumul-period-start" type="date" value="' + _defStart + '" style="flex:1;height:30px;border:1px solid #DDE1EB;border-radius:4px;padding:0 6px;font-size:11px;font-family:Pretendard,sans-serif"><span style="color:#9BA3B2;font-size:11px">~</span><input id="cumul-period-end" type="date" value="' + _defEnd + '" style="flex:1;height:30px;border:1px solid #DDE1EB;border-radius:4px;padding:0 6px;font-size:11px;font-family:Pretendard,sans-serif"></div></div>';
  h += '</div>';

  // 자동 할인율 표시 (물량지원 방식: 원가 = 공급가 ÷ (1 + DC%))
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 10px;background:#F8F9FB;border-radius:5px;border:1px solid #EAECF2">';
  h += '<span style="font-size:11px;color:#5A6070">자동 할인율 (물량지원 DC)</span>';
  h += '<span id="cumul-auto-dc" style="font-size:14px;font-weight:700;color:#185FA5">' + (_autoDC > 0 ? _autoDC.toFixed(2) + '%' : '-') + '</span>';
  h += '<span style="font-size:10px;color:#9BA3B2">원가 = 공급가 ÷ (1 + DC%)</span>';
  h += '</div>';

  // 대상 제품 리스트
  h += '<div style="font-size:13px;font-weight:600;margin-bottom:6px">대상 제품 리스트 (' + products.length + '건)</div>';
  h += '<div style="display:flex;gap:6px;margin-bottom:8px"><input id="cumul-prod-search" autocomplete="off" placeholder="TTI#, 모델명으로 제품 검색 후 추가..." style="flex:1;height:30px;border:1px solid #DDE1EB;border-radius:6px;padding:0 10px;font-size:12px;font-family:Pretendard,sans-serif"><button onclick="addPromoProduct(' + index + ')" style="height:30px;padding:0 14px;background:#185FA5;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif">+ 추가</button></div>';

  h += '<div style="border:1px solid #DDE1EB;border-radius:6px;overflow:hidden;max-height:200px;overflow-y:auto">';
  h += '<table class="po-table" style="margin:0"><thead><tr><th>TTI#</th><th>순번</th><th style="min-width:150px">모델명</th><th class="num">공급가</th><th class="center" style="width:50px">할인율</th><th class="center" style="width:30px">✕</th></tr></thead>';
  h += '<tbody id="cumul-prod-body">';
  if (products.length === 0) {
    h += '<tr><td colspan="6" style="text-align:center;padding:20px;color:#9BA3B2;font-size:11px">제품을 검색하여 추가하세요</td></tr>';
  } else {
    products.forEach(function(pr, pi) {
      // 빈 할인율이면 자동 DC 적용
      var _rate = pr.discountRate || '';
      var _isAuto = false;
      if (!_rate && _autoDC > 0) { _rate = _autoDC.toFixed(2); _isAuto = true; }
      var _rateStyle = _isAuto ? 'width:50px;height:24px;border:1px solid #B8D4F0;border-radius:3px;text-align:center;font-size:11px;font-family:Pretendard,sans-serif;background:#E6F1FB;color:#185FA5;font-weight:600' : 'width:50px;height:24px;border:1px solid #DDE1EB;border-radius:3px;text-align:center;font-size:11px;font-family:Pretendard,sans-serif';
      h += '<tr>';
      h += '<td style="font-size:10px;color:#5A6070">' + (pr.ttiNum || '-') + '</td>';
      h += '<td>' + (pr.orderNum || '-') + '</td>';
      h += '<td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis" title="' + (pr.model || '').replace(/"/g, '&quot;') + '">' + (pr.model || '-') + '</td>';
      h += '<td class="num">' + (pr.supplyPrice ? parseInt(pr.supplyPrice).toLocaleString() : '-') + '</td>';
      h += '<td class="center"><input type="text" value="' + _rate + '" placeholder="%" style="' + _rateStyle + '" data-pidx="' + pi + '" onchange="updatePromoProductDiscount(' + index + ',' + pi + ',this.value)"></td>';
      h += '<td class="center"><button onclick="removePromoProduct(' + index + ',' + pi + ')" style="width:22px;height:22px;border-radius:4px;border:none;background:#FCEBEB;color:#CC2222;font-size:12px;cursor:pointer">✕</button></td>';
      h += '</tr>';
    });
  }
  h += '</tbody></table></div>';

  h += '</div>'; // 바디 끝

  // 푸터
  h += '<div style="border-top:1px solid #DDE1EB;padding:12px 16px;display:flex;justify-content:flex-end;gap:8px">';
  h += '<button onclick="document.getElementById(\'po-cumul-modal\').remove()" style="background:#fff;color:#5A6070;border:1px solid #DDE1EB;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer;font-family:Pretendard,sans-serif">닫기</button>';
  h += '<button onclick="saveCumulativePromo(' + index + ')" style="background:#185FA5;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif">저장</button>';
  h += '</div>';

  h += '</div>';
  modal.innerHTML = h;
  document.body.appendChild(modal);
  // 오버레이 mousedown으로만 닫기 (모달 내부 클릭/드래그 시 닫힘 방지)
  var modalContainer = modal.querySelector(':scope > div');
  if (modalContainer) {
    modalContainer.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    modalContainer.addEventListener('click', function(e) { e.stopPropagation(); });
  }
  modal.addEventListener('mousedown', function(e) { if (e.target === modal) modal.remove(); });

  // 자동완성 바인딩 (모달 DOM 삽입 후)
  initPOAutocomplete('cumul-prod-search', function(product) {
    addPromoProduct(index, product);
  });
}

// 상단 정보 실시간 업데이트
function updateCumulInfo() {
  var name = (document.getElementById('cumul-name') || {}).value || '';
  var benefit = (document.getElementById('cumul-benefit') || {}).value || '';
  var targetRaw = ((document.getElementById('cumul-target') || {}).value || '0').replace(/,/g, '');
  var target = parseInt(targetRaw) || 0;
  var infoTarget = document.getElementById('cumul-info-target');
  if (infoTarget) infoTarget.textContent = target > 0 ? fmtPO(target) + '원 당' : '-';
  var infoBenefit = document.getElementById('cumul-info-benefit');
  if (infoBenefit) infoBenefit.textContent = benefit || '-';
}

// 자동 할인율 계산 (물량지원 DC: 혜택금액 / 기준금액 × 100)
function updateCumulDC() {
  var targetRaw = ((document.getElementById('cumul-target') || {}).value || '0').replace(/,/g, '');
  var benefitRaw = ((document.getElementById('cumul-benefit-amount') || {}).value || '0').replace(/,/g, '');
  var target = parseInt(targetRaw) || 0;
  var benefitAmt = parseInt(benefitRaw) || 0;
  var dc = target > 0 && benefitAmt > 0 ? (benefitAmt / target * 100) : 0;
  var el = document.getElementById('cumul-auto-dc');
  if (el) el.textContent = dc > 0 ? dc.toFixed(2) + '%' : '-';
}

function saveCumulativePromo(index) {
  var promos = _getCumulPromos();
  var promo = promos[index];
  if (!promo) return;
  promo.name = (document.getElementById('cumul-name') || {}).value || promo.name;
  promo.benefit = (document.getElementById('cumul-benefit') || {}).value || promo.benefit;
  promo.benefitAmount = parseInt(((document.getElementById('cumul-benefit-amount') || {}).value || '0').replace(/,/g, '')) || 0;
  promo.targetAmount = parseInt(((document.getElementById('cumul-target') || {}).value || '0').replace(/,/g, '')) || 0;
  promo.achieveCount = promo.targetAmount > 0 ? Math.floor((promo.currentSales || 0) / promo.targetAmount) : 0;
  promo.achieved = promo.achieveCount;
  promo.autoDiscountRate = promo.targetAmount > 0 && promo.benefitAmount > 0 ? (promo.benefitAmount / promo.targetAmount * 100) : 0;
  promo.periodStart = (document.getElementById('cumul-period-start') || {}).value || '';
  promo.periodEnd = (document.getElementById('cumul-period-end') || {}).value || '';
  promo.period = promo.periodStart && promo.periodEnd ? promo.periodStart.replace(/-/g, '.') + '~' + promo.periodEnd.replace(/-/g, '.') : '';
  save('mw_cumulative_promos', promos);
  document.getElementById('po-cumul-modal').remove();
  renderPOTab();
  toast('프로모션 설정이 저장되었습니다');
}

// 모달 입력값을 localStorage에 중간 저장 (모달 재오픈 시 값 보존)
function _saveCurrentCumulInputs(promoIndex) {
  var promos = _getCumulPromos();
  var promo = promos[promoIndex];
  if (!promo) return promos;
  var el = function(id) { return (document.getElementById(id) || {}); };
  promo.name = el('cumul-name').value || promo.name;
  promo.benefit = el('cumul-benefit').value || promo.benefit;
  promo.benefitAmount = parseInt((el('cumul-benefit-amount').value || '0').replace(/,/g, '')) || 0;
  promo.targetAmount = parseInt((el('cumul-target').value || '0').replace(/,/g, '')) || 0;
  promo.autoDiscountRate = promo.targetAmount > 0 && promo.benefitAmount > 0 ? (promo.benefitAmount / promo.targetAmount * 100) : 0;
  promo.periodStart = el('cumul-period-start').value || promo.periodStart || '';
  promo.periodEnd = el('cumul-period-end').value || promo.periodEnd || '';
  promo.period = promo.periodStart && promo.periodEnd ? promo.periodStart.replace(/-/g, '.') + '~' + promo.periodEnd.replace(/-/g, '.') : promo.period || '';
  save('mw_cumulative_promos', promos);
  return promos;
}

function addPromoProduct(promoIndex, product) {
  var found = product;
  if (!found) {
    var searchVal = (document.getElementById('cumul-prod-search') || {}).value.trim();
    if (!searchVal) return;
    var products = DB.products || [];
    found = products.find(function(p) {
      return (p.ttiNum && p.ttiNum.indexOf(searchVal) !== -1) || (p.model && p.model.toLowerCase().indexOf(searchVal.toLowerCase()) !== -1) || (p.orderNum && p.orderNum === searchVal);
    });
    if (!found) { toast('제품을 찾을 수 없습니다: ' + searchVal); return; }
  }
  // 먼저 현재 입력값 저장
  var promos = _saveCurrentCumulInputs(promoIndex);
  var promo = promos[promoIndex];
  if (!promo.products) promo.products = [];
  if (promo.products.some(function(pr) { return pr.ttiNum === found.ttiNum; })) { toast('이미 추가된 제품입니다'); return; }
  // 자동 할인율 (물량지원 DC)
  var _autoRate = '';
  if (promo.targetAmount > 0 && promo.benefitAmount > 0) {
    _autoRate = (promo.benefitAmount / promo.targetAmount * 100).toFixed(2);
  }
  promo.products.push({ ttiNum: found.ttiNum || '', orderNum: found.orderNum || '', model: found.model || '', supplyPrice: found.supplyPrice || 0, discountRate: _autoRate });
  save('mw_cumulative_promos', promos);
  document.getElementById('po-cumul-modal').remove();
  openCumulativePromoModal(promoIndex);
}

function removePromoProduct(promoIndex, productIndex) {
  // 먼저 현재 입력값 저장
  var promos = _saveCurrentCumulInputs(promoIndex);
  var promo = promos[promoIndex];
  if (!promo || !promo.products) return;
  promo.products.splice(productIndex, 1);
  save('mw_cumulative_promos', promos);
  document.getElementById('po-cumul-modal').remove();
  openCumulativePromoModal(promoIndex);
}

function updatePromoProductDiscount(promoIndex, productIndex, value) {
  var promos = _getCumulPromos();
  var promo = promos[promoIndex];
  if (!promo || !promo.products || !promo.products[productIndex]) return;
  promo.products[productIndex].discountRate = value;
  save('mw_cumulative_promos', promos);
}

// ========================================
// T5/T6 프로모션 탭 빌드 (공통)
// ========================================
function _getPromoData() {
  try { return JSON.parse(localStorage.getItem('mw_tti_promotions') || '{}').data || {}; } catch(e) { return {}; }
}
function _buildPromoTabContent(subtab, title, discountPct) {
  var promo = _getPromoData();
  // subtab: "promo-t5" → key: "T5"
  var key = subtab.replace('promo-', '').toUpperCase();
  var tOrders = (promo.tOrders || {})[key] || [];
  var left = _buildPromoLeftPanel(subtab, title, discountPct, tOrders);
  var right = _buildPromoRightPanel(subtab);
  return left + right;
}
function _buildPromoLeftPanel(subtab, title, discountPct, items) {
  var h = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
  var _lim = PO_PROMO_LIMIT[subtab] || 99;
  h += '<div class="po-panel-header"><span>' + title + ' · ' + discountPct + '% 할인 · <span id="po-' + subtab + '-count">' + items.length + '</span>건 · <span class="po-limit-btn" onclick="_changePromoLimit(\'' + subtab + '\')" title="클릭하여 수정">제한: ' + _lim + '개</span></span></div>';
  h += '<div class="po-filter-row"><input type="search" placeholder="코드, 모델명 검색" id="po-' + subtab + '-search" autocomplete="off" oninput="_filterPromoTab(\'' + subtab + '\',' + discountPct + ')"></div>';
  h += '<div class="po-table-wrap"><table class="po-table"><thead><tr><th>No</th><th>제품번호</th><th>모델명</th><th style="text-align:right">공급가</th><th style="text-align:right">할인가</th><th>재고</th><th style="width:50px">수량</th><th></th></tr></thead>';
  h += '<tbody id="po-' + subtab + '-tbody">';
  items.forEach(function(item, i) {
    h += _buildPromoRow(item, i, subtab, discountPct);
  });
  h += '</tbody></table></div></div>';
  return h;
}
function _getPromoLimits() {
  var settings = JSON.parse(localStorage.getItem('mw_settings') || '{}');
  var saved = settings.promoLimits || {};
  // tList maxOrders 기본값 적용
  var promo = _getPromoData();
  (promo.tList || []).forEach(function(t) {
    var key = 'promo-' + (t.promoNo || '').toLowerCase();
    if (!saved[key]) saved[key] = t.maxOrders || 5;
  });
  return saved;
}
function _setPromoLimit(subtab, newLimit) {
  var settings = JSON.parse(localStorage.getItem('mw_settings') || '{}');
  if (!settings.promoLimits) settings.promoLimits = { t5: 5, t6: 5 };
  settings.promoLimits[subtab] = newLimit;
  save('mw_settings', settings);
}
var PO_PROMO_LIMIT = _getPromoLimits();
function _changePromoLimit(subtab) {
  var current = PO_PROMO_LIMIT[subtab] || 5;
  var label = subtab.replace('promo-', '').toUpperCase();
  var val = prompt(label + ' 제품당 발주 제한 수량 (현재: ' + current + '개)', current);
  if (val === null) return;
  var num = parseInt(val, 10);
  if (isNaN(num) || num < 1) { toast('1 이상의 숫자를 입력하세요'); return; }
  _setPromoLimit(subtab, num);
  PO_PROMO_LIMIT[subtab] = num;
  renderPOTab();
  toast(subtab.toUpperCase() + ' 제한 수량: ' + num + '개로 변경');
}
function _getPromoOrdered(subtab, productCode) {
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var total = 0;
  history.forEach(function(h) { if (h.subtab === subtab && (h.ttiNum === productCode || h.manageCode === productCode)) total += (h.qty || 0); });
  // 장바구니에 담긴 수량도 합산
  poCart.forEach(function(c) { if (c.subtab === subtab && c.ttiNum === productCode) total += (c.qty || 0); });
  return total;
}
function _buildPromoRow(item, i, subtab, discountPct) {
  var discounted = Math.round(item.supplyPrice * (1 - discountPct / 100));
  // 재고 아이콘 — T5/T6 자체 stockStatus 또는 mw_tti_products에서 매칭
  var stockIcon = '';
  var ss = item.stockStatus || '';
  if (!ss && item.productCode) {
    var _code = normalizeTtiCode(item.productCode);
    if (_poTtiStockMap[_code] !== undefined) ss = _poTtiStockMap[_code];
  }
  if (ss === 'a') stockIcon = '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="#4A90D9"/></svg>';
  else if (ss === 'b') stockIcon = '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,2 12,11 2,11" fill="#F5A623"/></svg>';
  else if (ss === 'c') stockIcon = '<svg width="14" height="14" viewBox="0 0 14 14"><line x1="3" y1="3" x2="11" y2="11" stroke="#E24B4A" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="3" x2="3" y2="11" stroke="#E24B4A" stroke-width="2" stroke-linecap="round"/></svg>';
  else stockIcon = '<span style="color:#B4B2A9">-</span>';
  // 5개 제한 계산
  var limit = PO_PROMO_LIMIT[subtab] || 99;
  var ordered = _getPromoOrdered(subtab, item.productCode);
  var remaining = Math.max(0, limit - ordered);
  var isSoldOut = ss === 'c';
  var isLimitReached = remaining <= 0;
  var rowDisabled = isSoldOut || isLimitReached;
  var disabledAttr = rowDisabled ? ' disabled' : '';
  var rowStyle = rowDisabled ? 'opacity:0.4;' : '';
  var maxQty = isSoldOut ? 0 : remaining;
  var statusText = '';
  if (isLimitReached && !isSoldOut) statusText = '<span style="font-size:9px;color:#9BA3B2;font-weight:600">발주완료</span>';
  var h = '<tr style="' + rowStyle + '">';
  h += '<td>' + (i + 1) + '</td>';
  h += '<td style="font-size:11px">' + (item.productCode || '') + '</td>';
  h += '<td>' + (item.modelName || '') + '</td>';
  h += '<td style="text-align:right;text-decoration:line-through;color:#9BA3B2;font-size:11px">' + fmtPO(item.supplyPrice) + '</td>';
  h += '<td style="text-align:right;font-weight:700;color:#CC2222">' + fmtPO(discounted) + '</td>';
  h += '<td class="center">' + stockIcon + '</td>';
  h += '<td>' + (statusText || '<input type="number" min="1" max="' + maxQty + '" placeholder="" class="po-qty-input" data-code="' + item.productCode + '" style="width:45px;text-align:center;font-size:12px;padding:2px;border:1px solid #DDE1EB;border-radius:3px"' + disabledAttr + '>') + '</td>';
  h += '<td class="center">' + (rowDisabled ? '' : '<button class="po-cart-btn-dark" onclick="_addPromoToCart(\'' + subtab + '\',' + discountPct + ',\'' + (item.productCode || '').replace(/'/g, "\\'") + '\',\'' + (item.modelName || '').replace(/'/g, "\\'") + '\',' + item.supplyPrice + ',\'' + ss + '\')"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1h1.5l1.2 6h7.6l1.2-4.5H4.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="12" r="1" fill="#fff"/><circle cx="10" cy="12" r="1" fill="#fff"/></svg></button>') + '</td>';
  h += '</tr>';
  return h;
}
function _buildPromoRightPanel(subtab) {
  var cartItems = poCart.filter(function(c) { return c.subtab === subtab; });
  var h = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
  h += '<div class="po-panel-header"><span>주문 목록 · <span id="po-' + subtab + '-cart-count">' + cartItems.length + '</span>건</span></div>';
  h += '<div class="po-table-wrap"><table class="po-table"><thead><tr><th>No</th><th>모델명</th><th style="text-align:right">할인가</th><th style="width:50px">수량</th><th style="text-align:right">소계</th><th></th></tr></thead>';
  h += '<tbody id="po-' + subtab + '-cart-tbody">';
  var totalAmt = 0;
  cartItems.forEach(function(c, i) {
    var subtotal = (c.supplyPrice || 0) * (c.qty || 0);
    totalAmt += subtotal;
    h += '<tr><td>' + (i + 1) + '</td><td>' + (c.model || '') + '</td>';
    h += '<td style="text-align:right;font-weight:600">' + fmtPO(c.supplyPrice) + '</td>';
    h += '<td style="text-align:center">' + c.qty + '</td>';
    h += '<td style="text-align:right">' + fmtPO(subtotal) + '</td>';
    h += '<td><button onclick="_removePromoCart(\'' + subtab + '\',' + i + ')" style="background:none;border:none;color:#CC2222;cursor:pointer">✕</button></td></tr>';
  });
  h += '</tbody></table></div>';
  var _totalQty = cartItems.reduce(function(s, c) { return s + (c.qty || 0); }, 0);
  var _vat = Math.round(totalAmt * 0.1);
  h += '<div class="po-summary">';
  h += '<div class="po-summary-row"><span class="po-summary-label">공급가 합계 <span class="po-summary-count">(' + cartItems.length + '건, ' + _totalQty + '개)</span></span><span class="po-summary-value">' + fmtPO(totalAmt) + '원</span></div>';
  h += '<div class="po-summary-row po-summary-tax"><span class="po-summary-label">부가세 (10%)</span><span class="po-summary-value">' + fmtPO(_vat) + '원</span></div>';
  h += '<div class="po-summary-row po-summary-total"><span class="po-summary-label">총 합계</span><span class="po-summary-value">' + fmtPO(totalAmt + _vat) + '원</span></div>';
  h += '<button class="po-order-btn" onclick="submitPOOrder()">TTI 발주하기</button>';
  h += '</div></div>';
  return h;
}
function _filterPromoTab(subtab, discountPct) {
  var promo = _getPromoData();
  var key = subtab.replace('promo-', '').toUpperCase();
  var items = (promo.tOrders || {})[key] || [];
  var q = (document.getElementById('po-' + subtab + '-search') || {}).value || '';
  q = q.toLowerCase();
  var filtered = q ? items.filter(function(it) { return (it.productCode || '').toLowerCase().indexOf(q) >= 0 || (it.modelName || '').toLowerCase().indexOf(q) >= 0; }) : items;
  var tbody = document.getElementById('po-' + subtab + '-tbody');
  if (tbody) { var h = ''; filtered.forEach(function(item, i) { h += _buildPromoRow(item, i, subtab, discountPct); }); tbody.innerHTML = h; }
  var cnt = document.getElementById('po-' + subtab + '-count');
  if (cnt) cnt.textContent = filtered.length;
}
function _addPromoToCart(subtab, discountPct, productCode, modelName, supplyPrice, stockStatus) {
  if (stockStatus === 'c') { toast('소진 제품은 주문할 수 없습니다'); return; }
  var qtyInput = document.querySelector('#po-content-' + subtab + ' input[data-code="' + productCode + '"]');
  var qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
  // 5개 제한 체크 (T5/T6)
  var limit = PO_PROMO_LIMIT[subtab] || 99;
  if (limit < 99) {
    var historyOrdered = 0;
    JSON.parse(localStorage.getItem('mw_po_history') || '[]').forEach(function(h) { if (h.subtab === subtab && (h.ttiNum === productCode || h.manageCode === productCode)) historyOrdered += (h.qty || 0); });
    var cartOrdered = 0;
    poCart.forEach(function(c) { if (c.subtab === subtab && c.ttiNum === productCode) cartOrdered += (c.qty || 0); });
    if (historyOrdered + cartOrdered + qty > limit) {
      toast('발주 제한 수량(' + limit + '개)을 초과합니다. 잔여: ' + Math.max(0, limit - historyOrdered - cartOrdered) + '개');
      return;
    }
  }
  var discounted = Math.round(supplyPrice * (1 - discountPct / 100));
  var existing = poCart.find(function(c) { return c.ttiNum === productCode && c.subtab === subtab; });
  if (existing) { existing.qty += qty; } else {
    var _pName = subtab === 'package' ? '패키지 프로모션' : subtab.indexOf('promo-') === 0 ? subtab.replace('promo-', '').toUpperCase() + ' 프로모션' : '';
    poCart.push({ code: productCode, ttiNum: productCode, model: modelName, supplyPrice: discounted, costPrice: supplyPrice, qty: qty, subtab: subtab, promoName: _pName });
  }
  _savePoCart();
  _refreshPromoRightPanel(subtab);
  toast(modelName + ' ' + qty + '개 추가');
}
function _removePromoCart(subtab, cartIndex) {
  var cartItems = poCart.filter(function(c) { return c.subtab === subtab; });
  if (!cartItems[cartIndex]) return;
  var target = cartItems[cartIndex];
  var realIdx = poCart.indexOf(target);
  if (realIdx >= 0) poCart.splice(realIdx, 1);
  _savePoCart();
  _refreshPromoRightPanel(subtab);
}
function _refreshPromoRightPanel(subtab) {
  var container = document.getElementById('po-content-' + subtab);
  if (!container) return;
  var panels = container.querySelectorAll(':scope > .po-panel');
  if (panels.length >= 2) {
    var tmp = document.createElement('div');
    tmp.innerHTML = _buildPromoRightPanel(subtab);
    var newPanel = tmp.firstElementChild;
    if (newPanel) panels[1].replaceWith(newPanel);
  }
}

// ========================================
// 패키지 프로모션 탭
// ========================================
function _buildPackageTabContent() {
  var promo = _getPromoData();
  var items = promo.eList || [];
  var left = _buildPackageLeftPanel(items);
  var right = _buildPromoRightPanel('package');
  return left + right;
}
function _buildPackageLeftPanel(items) {
  var h = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
  h += '<div class="po-panel-header"><span>패키지 프로모션 · <span id="po-package-count">' + items.length + '</span>건</span></div>';
  h += '<div class="po-filter-row"><input type="search" placeholder="M코드, 모델명 검색" id="po-package-search" autocomplete="off" oninput="_filterPackageTab()"></div>';
  h += '<div class="po-table-wrap"><table class="po-table"><thead><tr><th>No</th><th>M코드</th><th>프로모션명</th><th>모델명</th><th style="text-align:right">공급가</th><th style="text-align:right">프로모션가</th><th>가능</th><th style="width:50px">수량</th><th></th></tr></thead>';
  h += '<tbody id="po-package-tbody">';
  items.forEach(function(item, i) { h += _buildPackageRow(item, i); });
  h += '</tbody></table></div></div>';
  return h;
}
function _buildPackageRow(item, i) {
  var hasPromo = item.promoPrice && item.promoPrice > 0 && item.promoPrice !== item.supplyPrice;
  var rowDisabled = item.available <= 0;
  var disabledAttr = rowDisabled ? ' disabled' : '';
  var disabledStyle = rowDisabled ? 'opacity:0.4;' : '';
  var h = '<tr style="' + disabledStyle + '">';
  h += '<td>' + (i + 1) + '</td>';
  h += '<td style="font-size:11px;font-weight:600">' + (item.mCode || '') + '</td>';
  h += '<td style="font-size:11px">' + (item.promoName || '') + '</td>';
  h += '<td>' + (item.modelName || '') + '</td>';
  if (hasPromo) {
    h += '<td style="text-align:right;text-decoration:line-through;color:#9BA3B2;font-size:11px">' + fmtPO(item.supplyPrice) + '</td>';
    h += '<td style="text-align:right;font-weight:700;color:#CC2222">' + fmtPO(item.promoPrice) + '</td>';
  } else {
    h += '<td style="text-align:right">' + fmtPO(item.supplyPrice) + '</td>';
    h += '<td style="text-align:right">-</td>';
  }
  h += '<td style="text-align:center">' + (item.available > 0 ? '<span style="color:#1D9E75;font-weight:600">' + item.available + '</span>' : '<span style="color:#CC2222">불가</span>') + '</td>';
  h += '<td><input type="number" min="1" max="' + Math.max(1, item.available || 0) + '" placeholder="" class="po-qty-input" data-code="' + item.productCode + '" style="width:45px;text-align:center;font-size:12px;padding:2px;border:1px solid #DDE1EB;border-radius:3px"' + disabledAttr + '></td>';
  h += '<td class="center">' + (rowDisabled ? '' : '<button class="po-cart-btn-dark" onclick="_addPackageToCart(\'' + (item.productCode || '').replace(/'/g, "\\'") + '\',\'' + (item.modelName || '').replace(/'/g, "\\'") + '\',' + (hasPromo ? item.promoPrice : item.supplyPrice) + ',' + item.supplyPrice + ',' + item.available + ',\'' + (item.mCode || '') + '\',\'' + (item.promoName || '').replace(/'/g, "\\'") + '\')"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1h1.5l1.2 6h7.6l1.2-4.5H4.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="12" r="1" fill="#fff"/><circle cx="10" cy="12" r="1" fill="#fff"/></svg></button>') + '</td>';
  h += '</tr>';
  return h;
}
function _filterPackageTab() {
  var promo = _getPromoData();
  var items = promo.eList || [];
  var q = (document.getElementById('po-package-search') || {}).value || '';
  q = q.toLowerCase();
  var filtered = q ? items.filter(function(it) { return (it.mCode || '').toLowerCase().indexOf(q) >= 0 || (it.modelName || '').toLowerCase().indexOf(q) >= 0 || (it.promoName || '').toLowerCase().indexOf(q) >= 0; }) : items;
  var tbody = document.getElementById('po-package-tbody');
  if (tbody) { var h = ''; filtered.forEach(function(item, i) { h += _buildPackageRow(item, i); }); tbody.innerHTML = h; }
  var cnt = document.getElementById('po-package-count');
  if (cnt) cnt.textContent = filtered.length;
}
function _addPackageToCart(productCode, modelName, price, costPrice, available, mCode, promoName) {
  if (available <= 0) { toast('구매 불가 제품입니다'); return; }
  var qtyInput = document.querySelector('#po-content-package input[data-code="' + productCode + '"]');
  var qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
  if (qty > available) { toast('구매 가능 수량(' + available + '개)을 초과할 수 없습니다'); return; }
  var existing = poCart.find(function(c) { return c.ttiNum === productCode && c.subtab === 'package'; });
  if (existing) {
    if (existing.qty + qty > available) { toast('구매 가능 수량(' + available + '개)을 초과할 수 없습니다. 장바구니: ' + existing.qty + '개'); return; }
    existing.qty += qty;
  } else {
    poCart.push({ code: productCode, ttiNum: productCode, model: modelName, supplyPrice: price, costPrice: costPrice, qty: qty, subtab: 'package', promoName: promoName || '패키지 프로모션' });
  }
  _savePoCart();
  _refreshPromoRightPanel('package');
  toast(modelName + ' ' + qty + '개 추가');
}

// ========================================
// 키트구성 패키지 탭
// ========================================
function _buildKitTabContent() {
  var promo = _getPromoData();
  var items = promo.dList || [];
  if (items.length === 0) {
    var h = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
    h += '<div class="po-panel-header"><span>키트구성 패키지</span></div>';
    h += '<div style="padding:40px;text-align:center;color:#9BA3B2">';
    h += '<div style="font-size:32px;margin-bottom:8px">📦</div>';
    h += '<div style="font-size:14px;font-weight:600;margin-bottom:4px">현재 등록된 키트 프로모션이 없습니다</div>';
    h += '<div style="font-size:12px">TTI에서 스크래핑하면 자동으로 표시됩니다</div>';
    h += '</div></div>';
    h += _buildPromoRightPanel('kit');
    return h;
  }
  // 데이터 있을 때 패키지와 동일 구조
  var left = '<div class="po-panel" style="max-height:calc(100vh - 260px)">';
  left += '<div class="po-panel-header"><span>키트구성 패키지 · ' + items.length + '건</span></div>';
  left += '<div class="po-table-wrap"><table class="po-table"><thead><tr><th>No</th><th>제품번호</th><th>모델명</th><th style="text-align:right">공급가</th><th>재고</th><th></th></tr></thead>';
  left += '<tbody>';
  items.forEach(function(item, i) {
    left += '<tr><td>' + (i + 1) + '</td><td>' + (item.productCode || '') + '</td><td>' + (item.modelName || '') + '</td><td style="text-align:right">' + fmtPO(item.supplyPrice || 0) + '</td><td>' + (item.stockStatus || '-') + '</td><td>🛒</td></tr>';
  });
  left += '</tbody></table></div></div>';
  return left + _buildPromoRightPanel('kit');
}

// 누적프로모션 추가 (6-D)
function addCumulativePromo() {
  var promos = _getCumulPromos();
  if (promos.length >= 5) { toast('최대 5개까지 추가할 수 있습니다'); return; }
  var idx = promos.length;
  promos.push({ name: '새 프로모션', amount: '0', benefit: '클릭하여 설정', achieved: 0, next: '0', paletteIdx: idx, targetAmount: 0, period: '', unlimited: true, currentSales: 0, products: [] });
  save('mw_cumulative_promos', promos);
  renderPOTab();
  // 바로 모달 열기
  setTimeout(function() { openCumulativePromoModal(idx); }, 100);
}

// ========================================
// 커머셜 프로모션 모달 (D)
// ========================================
function openCommercialPromoModal() {
  var promos = _getCommercialPromos();
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var now = new Date();

  // 기존 모달 제거
  var existing = document.getElementById('commercial-promo-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'commercial-promo-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';

  // 전체 매출 합계 (이번 달)
  var mRange = getMonthRange(now);
  var totalSalesMonth = 0;
  history.forEach(function(item) {
    var d = new Date(item.date);
    if (d >= mRange.start && d <= mRange.end) totalSalesMonth += (item.amount || 0);
  });
  // 진행 중 프로모션 수
  var activeCount = 0;
  promos.forEach(function(p) {
    var s = new Date(p.startDate); s.setHours(0,0,0,0);
    var e = new Date(p.endDate); e.setHours(23,59,59,999);
    var today = new Date(); today.setHours(0,0,0,0);
    if (today >= s && today <= e) activeCount++;
  });

  var h = '<div style="background:#fff;border-radius:10px;width:720px;max-width:95vw;max-height:85vh;overflow:hidden;border:1px solid #DDE1EB;display:flex;flex-direction:column;font-family:Pretendard,-apple-system,sans-serif">';
  // 헤더
  h += '<div style="background:#1A1D23;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">';
  h += '<span style="font-size:14px;font-weight:600">커머셜 프로모션 관리</span>';
  h += '<button onclick="document.getElementById(\'commercial-promo-modal\').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button></div>';

  // 바디
  h += '<div style="padding:16px;overflow-y:auto;flex:1">';
  // 상단 요약 3칸
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">';
  h += '<div style="background:#F4F6FA;border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:#5A6070">이번 달 총 매출</div><div style="font-size:15px;font-weight:700;color:#185FA5">' + fmtPO(totalSalesMonth) + '원</div></div>';
  h += '<div style="background:#F4F6FA;border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:#5A6070">진행 중 프로모션</div><div style="font-size:15px;font-weight:700;color:#1D9E75">' + activeCount + '개</div></div>';
  h += '<div style="background:#F4F6FA;border-radius:6px;padding:8px 10px"><div style="font-size:10px;color:#5A6070">등록 프로모션</div><div style="font-size:15px;font-weight:700;color:#5A6070">' + promos.length + '개</div></div>';
  h += '</div>';

  // 아코디언 리스트
  h += '<div id="comm-promo-list">';
  promos.forEach(function(promo, idx) {
    h += _buildCommPromoAccordion(promo, idx, history);
  });
  h += '</div>';

  // 새 프로모션 추가 버튼
  h += '<button onclick="_addNewCommercialPromo()" style="width:100%;padding:10px;margin-top:8px;border:2px dashed #DDE1EB;border-radius:6px;background:none;color:#5A6070;font-size:12px;cursor:pointer">+ 새 프로모션 추가</button>';

  h += '</div>'; // 바디 끝

  // 하단 버튼
  h += '<div style="padding:12px 16px;border-top:1px solid #EAECF2;display:flex;justify-content:flex-end;gap:8px">';
  h += '<button onclick="document.getElementById(\'commercial-promo-modal\').remove()" style="padding:6px 16px;border:1px solid #DDE1EB;border-radius:4px;background:#fff;color:#5A6070;font-size:12px;cursor:pointer">취소</button>';
  h += '<button onclick="_saveCommercialPromoModal()" style="padding:6px 16px;border:none;border-radius:4px;background:#185FA5;color:#fff;font-size:12px;cursor:pointer;font-weight:600">저장</button>';
  h += '</div>';

  h += '</div>';
  modal.innerHTML = h;
  document.body.appendChild(modal);

  // 숫자 입력 시 콤마 자동 적용
  modal.querySelectorAll('.comm-money').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var raw = this.value.replace(/[^0-9]/g, '');
      var num = parseInt(raw, 10) || 0;
      var pos = this.selectionStart;
      var oldLen = this.value.length;
      this.value = num > 0 ? num.toLocaleString() : '';
      var newLen = this.value.length;
      this.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
    });
  });
  // 구간 타겟 아이콘 클릭 → 목표금액 자동 입력
  modal.querySelectorAll('.comm-target-icon').forEach(function(icon) {
    icon.addEventListener('click', function() {
      var amt = parseInt(this.getAttribute('data-amount'), 10);
      var promoIdx = this.getAttribute('data-idx');
      var targetInput = document.getElementById('comm-target-' + promoIdx);
      if (targetInput) { targetInput.value = amt > 0 ? amt.toLocaleString() : ''; }
      // 모든 행 초기화 후 선택 행 하이라이트
      modal.querySelectorAll('.comm-target-icon[data-idx="' + promoIdx + '"]').forEach(function(ic) {
        var row = ic.closest('tr');
        if (parseInt(ic.getAttribute('data-amount'), 10) === amt && amt > 0) {
          ic.style.opacity = '1'; ic.style.color = '#185FA5';
          if (row) row.style.background = '#E6F1FB';
        } else {
          ic.style.opacity = '0.3'; ic.style.color = '#9BA3B2';
          if (row) row.style.background = '';
        }
      });
    });
  });
  // 할인율 % 포커스/블러
  modal.querySelectorAll('.comm-rate').forEach(function(inp) {
    inp.addEventListener('focus', function() {
      this.value = this.value.replace('%', '').trim();
    });
    inp.addEventListener('blur', function() {
      var val = parseFloat(this.value);
      if (!isNaN(val)) this.value = val + '%';
      else this.value = '';
    });
  });
}

function _buildCommPromoAccordion(promo, idx, history) {
  var today = new Date(); today.setHours(0,0,0,0);
  var s = new Date(promo.startDate); s.setHours(0,0,0,0);
  var e = new Date(promo.endDate); e.setHours(23,59,59,999);
  var isActive = today >= s && today <= e;
  var isEnded = today > e;
  var collapsed = isEnded; // 종료된 것은 접힘

  // 프로모션 기간 내 매출 합산
  var sales = 0;
  (history || []).forEach(function(item) {
    var d = new Date(item.date);
    if (d >= s && d <= e) sales += (item.amount || 0);
  });
  var tierInfo = _findCommercialTier(promo, sales);

  var h = '<div class="comm-accordion" data-idx="' + idx + '" style="border:1px solid #DDE1EB;border-radius:6px;margin-bottom:8px;overflow:hidden">';
  // 아코디언 헤더
  h += '<div class="comm-accordion-header" onclick="_toggleCommAccordion(' + idx + ')" style="padding:8px 12px;background:#F4F6FA;cursor:pointer;display:flex;align-items:center;gap:8px">';
  h += '<span class="comm-acc-arrow" id="comm-arrow-' + idx + '" style="font-size:10px;transition:transform 0.2s;transform:rotate(' + (collapsed ? '0' : '90') + 'deg)">▶</span>';
  h += '<span style="font-weight:600;font-size:12px;flex:1">' + (promo.name || '프로모션 ' + (idx + 1)) + '</span>';
  h += '<span style="font-size:10px;color:#5A6070;background:#EAECF2;padding:1px 6px;border-radius:3px">' + _commPeriodLabel(promo) + '</span>';
  if (isActive) h += '<span style="font-size:10px;color:#fff;background:#1D9E75;padding:1px 6px;border-radius:3px;font-weight:600">진행중</span>';
  if (isEnded) h += '<span style="font-size:10px;color:#fff;background:#8B8FA0;padding:1px 6px;border-radius:3px">종료</span>';
  h += '<button onclick="event.stopPropagation();_deleteCommPromo(' + idx + ')" style="background:none;border:none;color:#CC2222;font-size:14px;cursor:pointer;padding:0 4px" title="삭제">✕</button>';
  h += '</div>';

  // 아코디언 바디
  h += '<div id="comm-body-' + idx + '" style="padding:12px;display:' + (collapsed ? 'none' : 'block') + '">';

  // 기본 정보 입력
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">프로모션명</label><input type="text" class="comm-input" data-field="name" data-idx="' + idx + '" value="' + (promo.name || '') + '" style="width:100%;padding:6px 10px;border:1px solid #DDE1EB;border-radius:4px;font-size:14px"></div>';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">시작일</label><input type="date" class="comm-input" data-field="startDate" data-idx="' + idx + '" value="' + (promo.startDate || '') + '" style="width:100%;padding:6px 10px;border:1px solid #DDE1EB;border-radius:4px;font-size:13px"></div>';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">종료일</label><input type="date" class="comm-input" data-field="endDate" data-idx="' + idx + '" value="' + (promo.endDate || '') + '" style="width:100%;padding:6px 10px;border:1px solid #DDE1EB;border-radius:4px;font-size:13px"></div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">적용조건</label><input type="text" class="comm-input" data-field="condition" data-idx="' + idx + '" value="' + (promo.condition || '') + '" placeholder="예: 디스플레이 제외" style="width:100%;padding:6px 10px;border:1px solid #DDE1EB;border-radius:4px;font-size:14px"></div>';
  h += '<div><label style="font-size:10px;color:#5A6070;display:block;margin-bottom:2px">목표금액</label><input type="text" class="comm-input comm-money" id="comm-target-' + idx + '" data-field="targetAmount" data-idx="' + idx + '" value="' + fmtPO(promo.targetAmount || 0) + '" style="width:100%;padding:8px 12px;border:1px solid #DDE1EB;border-radius:4px;font-size:16px;font-weight:600;text-align:right"></div>';
  h += '</div>';

  // 현재 상태 박스
  h += '<div style="background:#EBF3FC;border-radius:6px;padding:10px 12px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">';
  h += '<div><div style="font-size:11px;color:#3D6DA6">현재 매출</div><div style="font-size:18px;font-weight:700;color:#185FA5">' + fmtPO(sales) + '원</div></div>';
  h += '<div><div style="font-size:11px;color:#3D6DA6">현재 할인율</div><div style="font-size:18px;font-weight:700;color:#185FA5">' + (tierInfo.current && tierInfo.current.rate != null ? tierInfo.current.rate + '%' : '-') + '</div></div>';
  h += '<div><div style="font-size:11px;color:#3D6DA6">현재 구간</div><div style="font-size:18px;font-weight:700;color:#185FA5">' + (tierInfo.current ? fmtPO(tierInfo.current.minAmount) + '~' + (tierInfo.current.maxAmount ? fmtPO(tierInfo.current.maxAmount) : '∞') : '구간 미달') + '</div></div>';
  h += '<div><div style="font-size:11px;color:#3D6DA6">다음 구간까지</div><div style="font-size:18px;font-weight:700;color:#CC2222">' + (tierInfo.next ? fmtPO(Math.max(0, tierInfo.shortage)) + '원' : '최고 구간') + '</div></div>';
  h += '</div>';

  // 구간별 혜택 테이블
  h += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px">';
  h += '<thead><tr style="background:#F4F6FA"><th style="padding:5px 4px;text-align:center;font-size:12px;border:1px solid #EAECF2;width:24px"></th><th style="padding:5px 6px;text-align:center;font-size:12px;border:1px solid #EAECF2">No</th><th style="padding:5px 6px;text-align:right;font-size:12px;border:1px solid #EAECF2">매출기준 (이상)</th><th style="padding:5px 6px;text-align:right;font-size:12px;border:1px solid #EAECF2">매출기준 (미만)</th><th style="padding:5px 6px;text-align:left;font-size:12px;border:1px solid #EAECF2">지급품목</th><th style="padding:5px 6px;text-align:right;font-size:12px;border:1px solid #EAECF2">할인율(%)</th><th style="padding:5px 6px;text-align:center;font-size:12px;border:1px solid #EAECF2;min-width:50px">상태</th><th style="padding:5px 6px;text-align:center;font-size:12px;border:1px solid #EAECF2"></th></tr></thead>';
  h += '<tbody id="comm-tiers-' + idx + '">';
  (promo.tiers || []).forEach(function(tier, ti) {
    var tierStatus = '';
    if (tierInfo.currentIdx === ti) tierStatus = '<span style="background:#185FA5;color:#fff;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;white-space:nowrap">현재</span>';
    else if (tierInfo.currentIdx > ti) tierStatus = '<span style="background:#1D9E75;color:#fff;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;white-space:nowrap">달성</span>';
    else tierStatus = '<span style="background:#EAECF2;color:#5A6070;padding:2px 8px;border-radius:3px;font-size:10px;white-space:nowrap">미달</span>';

    var _isTarget = (promo.targetAmount || 0) === (tier.minAmount || 0) && tier.minAmount > 0;
    var _targetBg = _isTarget ? 'background:#E6F1FB;' : '';
    h += '<tr style="' + _targetBg + '">';
    h += '<td style="padding:4px 4px;text-align:center;border:1px solid #EAECF2"><span class="comm-target-icon" data-amount="' + (tier.minAmount || 0) + '" data-idx="' + idx + '" style="cursor:pointer;font-size:14px;opacity:' + (_isTarget ? '1' : '0.3') + ';color:' + (_isTarget ? '#185FA5' : '#9BA3B2') + '" title="이 금액을 목표금액으로 설정">🎯</span></td>';
    h += '<td style="padding:4px 6px;text-align:center;border:1px solid #EAECF2">' + (ti + 1) + '</td>';
    h += '<td style="padding:4px 6px;border:1px solid #EAECF2"><input type="text" class="comm-tier-input comm-money" data-promo="' + idx + '" data-tier="' + ti + '" data-tfield="minAmount" value="' + fmtPO(tier.minAmount || 0) + '" style="width:100%;border:none;font-size:13px;text-align:right;padding:2px 0;background:transparent"></td>';
    h += '<td style="padding:4px 6px;border:1px solid #EAECF2"><input type="text" class="comm-tier-input comm-money" data-promo="' + idx + '" data-tier="' + ti + '" data-tfield="maxAmount" value="' + (tier.maxAmount !== null ? fmtPO(tier.maxAmount) : '') + '" placeholder="무제한" style="width:100%;border:none;font-size:13px;text-align:right;padding:2px 0"></td>';
    h += '<td style="padding:4px 6px;border:1px solid #EAECF2"><input type="text" class="comm-tier-input" data-promo="' + idx + '" data-tier="' + ti + '" data-tfield="benefit" value="' + (tier.benefit || '') + '" style="width:100%;border:none;font-size:13px;padding:2px 0"></td>';
    h += '<td style="padding:4px 6px;border:1px solid #EAECF2"><input type="text" class="comm-tier-input comm-rate" data-promo="' + idx + '" data-tier="' + ti + '" data-tfield="rate" value="' + (tier.rate !== null && tier.rate !== undefined ? tier.rate + '%' : '') + '" style="width:100%;border:none;font-size:13px;text-align:right;padding:2px 0"></td>';
    h += '<td style="padding:3px 6px;text-align:center;border:1px solid #EAECF2">' + tierStatus + '</td>';
    h += '<td style="padding:3px 4px;text-align:center;border:1px solid #EAECF2"><button onclick="_deleteCommTier(' + idx + ',' + ti + ')" style="background:none;border:none;color:#CC2222;cursor:pointer;font-size:12px;padding:0">✕</button></td>';
    h += '</tr>';
  });
  h += '</tbody></table>';
  h += '<button onclick="_addCommTier(' + idx + ')" style="font-size:10px;color:#185FA5;background:none;border:1px dashed #B8C5D6;border-radius:4px;padding:3px 10px;cursor:pointer">+ 구간 추가</button>';

  h += '</div>'; // 바디 끝
  h += '</div>'; // 아코디언 끝
  return h;
}

function _toggleCommAccordion(idx) {
  var body = document.getElementById('comm-body-' + idx);
  var arrow = document.getElementById('comm-arrow-' + idx);
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
  } else {
    body.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

function _addNewCommercialPromo() {
  var promos = _getCommercialPromos();
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth();
  var lastDay = new Date(y, m + 1, 0).getDate();
  promos.push({
    id: 'comm_' + Date.now(),
    name: '새 프로모션',
    startDate: y + '-' + String(m + 1).padStart(2, '0') + '-01',
    endDate: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0'),
    condition: '',
    targetAmount: 0,
    tiers: [{ minAmount: 0, maxAmount: null, benefit: '', rate: null }]
  });
  _saveCommercialPromos(promos);
  // 모달 재렌더링
  document.getElementById('commercial-promo-modal').remove();
  openCommercialPromoModal();
  // 마지막 아코디언 펼치기
  setTimeout(function() { var lastIdx = promos.length - 1; var body = document.getElementById('comm-body-' + lastIdx); if (body) body.style.display = 'block'; var arrow = document.getElementById('comm-arrow-' + lastIdx); if (arrow) arrow.style.transform = 'rotate(90deg)'; }, 50);
}

function _deleteCommPromo(idx) {
  if (!confirm('이 프로모션을 삭제하시겠습니까?')) return;
  var promos = _getCommercialPromos();
  promos.splice(idx, 1);
  _saveCommercialPromos(promos);
  document.getElementById('commercial-promo-modal').remove();
  openCommercialPromoModal();
}

function _addCommTier(promoIdx) {
  // 현재 모달 입력값 먼저 수집 후 추가
  var promos = _collectCommModalInputs();
  var promo = promos[promoIdx];
  if (!promo) return;
  if (!promo.tiers) promo.tiers = [];
  var lastMax = promo.tiers.length > 0 ? (promo.tiers[promo.tiers.length - 1].maxAmount || 0) : 0;
  promo.tiers.push({ minAmount: lastMax, maxAmount: null, benefit: '', rate: null });
  _saveCommercialPromos(promos);
  document.getElementById('commercial-promo-modal').remove();
  openCommercialPromoModal();
  setTimeout(function() { var body = document.getElementById('comm-body-' + promoIdx); if (body) body.style.display = 'block'; var arrow = document.getElementById('comm-arrow-' + promoIdx); if (arrow) arrow.style.transform = 'rotate(90deg)'; }, 50);
}

function _deleteCommTier(promoIdx, tierIdx) {
  // 현재 모달 입력값 먼저 수집 후 삭제
  var promos = _collectCommModalInputs();
  if (!promos[promoIdx] || !promos[promoIdx].tiers) return;
  promos[promoIdx].tiers.splice(tierIdx, 1);
  _saveCommercialPromos(promos);
  document.getElementById('commercial-promo-modal').remove();
  openCommercialPromoModal();
  setTimeout(function() { var body = document.getElementById('comm-body-' + promoIdx); if (body) body.style.display = 'block'; var arrow = document.getElementById('comm-arrow-' + promoIdx); if (arrow) arrow.style.transform = 'rotate(90deg)'; }, 50);
}

function _parseMoneyInput(val) {
  return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
}

// 모달 입력값 수집 (공통)
function _collectCommModalInputs() {
  var promos = _getCommercialPromos();
  document.querySelectorAll('.comm-input').forEach(function(inp) {
    var idx = parseInt(inp.getAttribute('data-idx'));
    var field = inp.getAttribute('data-field');
    if (isNaN(idx) || !promos[idx]) return;
    if (field === 'targetAmount') {
      promos[idx][field] = _parseMoneyInput(inp.value);
    } else {
      promos[idx][field] = inp.value;
    }
  });
  document.querySelectorAll('.comm-tier-input').forEach(function(inp) {
    var pi = parseInt(inp.getAttribute('data-promo'));
    var ti = parseInt(inp.getAttribute('data-tier'));
    var tfield = inp.getAttribute('data-tfield');
    if (isNaN(pi) || isNaN(ti) || !promos[pi] || !promos[pi].tiers || !promos[pi].tiers[ti]) return;
    if (tfield === 'minAmount') {
      promos[pi].tiers[ti].minAmount = _parseMoneyInput(inp.value);
    } else if (tfield === 'maxAmount') {
      var v = inp.value.trim();
      promos[pi].tiers[ti].maxAmount = v === '' ? null : _parseMoneyInput(v);
    } else if (tfield === 'rate') {
      var rv = inp.value.trim();
      promos[pi].tiers[ti].rate = rv === '' ? null : parseFloat(rv);
    } else if (tfield === 'benefit') {
      promos[pi].tiers[ti].benefit = inp.value;
    }
  });
  return promos;
}

function _saveCommercialPromoModal() {
  var promos = _collectCommModalInputs();
  _saveCommercialPromos(promos);
  document.getElementById('commercial-promo-modal').remove();
  renderPOTab();
  toast('커머셜 프로모션 저장 완료');
}

// ========================================
// 장바구니 (Step B-2a)
// ========================================
var poCart = JSON.parse(localStorage.getItem('mw_po_cart') || '[]');

function _savePoCart() {
  save('mw_po_cart', poCart);
}

// 장바구니에 제품 추가
function addToCart(productCode) {
  // 수량 확인
  var qtyInput = document.querySelector('input[data-code="' + productCode + '"]');
  var qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
  if (qty <= 0) { toast('수량을 입력하세요'); return; }

  // 제품 정보 찾기
  var p = (DB.products || []).find(function(prod) { return prod.ttiNum === productCode || prod.code === productCode; });
  if (!p) { toast('제품을 찾을 수 없습니다'); return; }

  // TTI 재고 체크 (_poTtiStockMap 기준: 'a'=넉넉, 'b'=여유없음, 'c'=없음)
  var _ttiCode = normalizeTtiCode(p.ttiNum);
  var _ttiStat = _poTtiStockMap && _ttiCode && _poTtiStockMap[_ttiCode] !== undefined ? _poTtiStockMap[_ttiCode] : null;
  if (_ttiStat === 'a') {
    // 넉넉 → 그대로 진행
  } else if (_ttiStat === 'b') {
    alert('⚠️ ' + (p.model || '제품') + ' - 재고 여유가 없습니다. 확인 후 주문하세요');
  } else {
    alert('❌ ' + (p.model || '제품') + ' - 가용재고가 없습니다. 주문할 수 없습니다.');
    return;
  }

  // 중복 확인 → 수량 합산
  var existing = poCart.find(function(c) { return c.ttiNum === (p.ttiNum || '') || (c.code && c.code === p.code); });
  if (existing) {
    existing.qty += qty;
  } else {
    // 누적프로모션 확인
    var promoName = '', promoColor = '';
    var cumulPromos = JSON.parse(localStorage.getItem('mw_cumulative_promos') || 'null') || [];
    for (var i = 0; i < cumulPromos.length; i++) {
      var _nc = normalizeTtiCode(p.ttiNum);
      if (cumulPromos[i].products && cumulPromos[i].products.some(function(pr) { return normalizeTtiCode(pr.ttiNum) === _nc || (p.code && pr.ttiNum === p.code); })) {
        promoName = cumulPromos[i].name;
        var pal = _poPromoPalette[cumulPromos[i].paletteIdx || i] || _poPromoPalette[0];
        promoColor = pal.text;
        break;
      }
    }
    poCart.push({
      code: p.code || '', ttiNum: p.ttiNum || '', orderNum: p.orderNum || '',
      model: p.model || '', detail: p.detail || '',
      supplyPrice: parseInt(p.supplyPrice) || 0, costPrice: 0,
      qty: qty, category: p.category || '',
      promoName: promoName, promoColor: promoColor
    });
  }
  _savePoCart();
  if (qtyInput) qtyInput.value = '0';
  renderPOCartTable();
  toast((p.model || '제품') + ' ' + qty + '개 추가');
}

// 장바구니에 제품 직접 추가 (자동완성에서)
function addToCartDirect(product) {
  if (!product) return;

  // TTI 재고 체크 (_poTtiStockMap 기준: 'a'=넉넉, 'b'=여유없음, 'c'=없음)
  var _ttiCode2 = normalizeTtiCode(product.ttiNum);
  var _ttiStat2 = _poTtiStockMap && _ttiCode2 && _poTtiStockMap[_ttiCode2] !== undefined ? _poTtiStockMap[_ttiCode2] : null;
  if (_ttiStat2 === 'a') {
    // 넉넉 → 그대로 진행
  } else if (_ttiStat2 === 'b') {
    alert('⚠️ ' + (product.model || '제품') + ' - 재고 여유가 없습니다. 확인 후 주문하세요');
  } else {
    alert('❌ ' + (product.model || '제품') + ' - 가용재고가 없습니다. 주문할 수 없습니다.');
    return;
  }

  var existing = poCart.find(function(c) { return c.ttiNum === (product.ttiNum || ''); });
  if (existing) { existing.qty += 1; }
  else {
    var promoName = '', promoColor = '';
    var cumulPromos = JSON.parse(localStorage.getItem('mw_cumulative_promos') || 'null') || [];
    for (var i = 0; i < cumulPromos.length; i++) {
      var _nc2 = normalizeTtiCode(product.ttiNum);
      if (cumulPromos[i].products && cumulPromos[i].products.some(function(pr) { return normalizeTtiCode(pr.ttiNum) === _nc2 || (product.code && pr.ttiNum === product.code); })) {
        promoName = cumulPromos[i].name;
        var pal = _poPromoPalette[cumulPromos[i].paletteIdx || i] || _poPromoPalette[0];
        promoColor = pal.text;
        break;
      }
    }
    poCart.push({
      code: product.code || '', ttiNum: product.ttiNum || '', orderNum: product.orderNum || '',
      model: product.model || '', detail: product.detail || '',
      supplyPrice: parseInt(product.supplyPrice) || 0, costPrice: 0,
      qty: 1, category: product.category || '',
      promoName: promoName, promoColor: promoColor
    });
  }
  _savePoCart();
  renderPOCartTable();
  toast((product.model || '제품') + ' 추가');
}

// 장바구니 수량 변경
function updateCartQty(idx, val) {
  var qty = parseInt(val) || 0;
  if (qty <= 0) { poCart.splice(idx, 1); }
  else { poCart[idx].qty = qty; }
  _savePoCart();
  renderPOCartTable();
}

// 장바구니 항목 삭제
function removeCartItem(idx) {
  poCart.splice(idx, 1);
  _savePoCart();
  renderPOCartTable();
}

// 장바구니 비우기
function clearPOCart() {
  if (poCart.length === 0) return;
  if (!confirm('주문 목록을 비우시겠습니까?')) return;
  poCart = [];
  _savePoCart();
  renderPOCartTable();
}

// 장바구니 테이블 렌더링
function renderPOCartTable() {
  var body = document.getElementById('po-cart-body');
  if (!body) return;

  if (poCart.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#9BA3B2">왼쪽 제품에서 🛒 버튼으로 추가하세요</td></tr>';
  } else {
    var h = '';
    poCart.forEach(function(c, i) {
      var amt = (c.supplyPrice || 0) * (c.qty || 0);
      var _cumulBadge = c.promoName ? '<span style="background:#EEEDFE;color:' + (c.promoColor || '#3C3489') + ';font-size:9px;font-weight:700;padding:2px 4px;border-radius:3px">누적</span>' : '';
      h += '<tr>';
      h += '<td class="center">' + _cumulBadge + '</td>';
      h += '<td>' + (c.orderNum || '-') + '</td>';
      h += '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis" title="' + (c.model || '').replace(/"/g, '&quot;') + '">' + (c.model || '-') + '</td>';
      h += '<td class="num">' + fmtPO(c.supplyPrice) + '</td>';
      h += '<td class="center"><input type="number" min="1" value="' + c.qty + '" style="width:44px;height:26px;border:1px solid #DDE1EB;border-radius:3px;text-align:center;font-size:13px;font-family:Pretendard,sans-serif" onchange="updateCartQty(' + i + ',this.value)"></td>';
      h += '<td class="num" style="font-weight:600">' + fmtPO(amt) + '</td>';
      h += '<td class="center"><button onclick="removeCartItem(' + i + ')" style="width:22px;height:22px;border-radius:4px;border:none;background:#FCEBEB;color:#CC2222;font-size:12px;cursor:pointer">✕</button></td>';
      h += '</tr>';
    });
    body.innerHTML = h;
  }

  // 합계 업데이트
  var totalItems = poCart.length;
  var totalQty = poCart.reduce(function(s, c) { return s + (c.qty || 0); }, 0);
  var totalSupply = poCart.reduce(function(s, c) { return s + (c.supplyPrice || 0) * (c.qty || 0); }, 0);
  var vat = Math.round(totalSupply * 0.1);

  var supplyEl = document.getElementById('po-cart-supply-total');
  if (supplyEl) supplyEl.textContent = fmtPO(totalSupply) + '원';
  var countLabel = document.getElementById('po-cart-count-label');
  if (countLabel) countLabel.textContent = '(' + totalItems + '건, ' + totalQty + '개)';
  var vatEl = document.getElementById('po-cart-vat');
  if (vatEl) vatEl.textContent = fmtPO(vat) + '원';
  var grandEl = document.getElementById('po-cart-grand-total');
  if (grandEl) grandEl.textContent = fmtPO(totalSupply + vat) + '원';

  // 헤더 건수
  var headerCount = document.querySelector('#po-content-normal .po-panel:last-child .po-header-count');
  if (headerCount) headerCount.textContent = totalItems + '건';
}

// 제품등록 검색에서 추가
function addPOCartItem() {
  // 자동완성에서 선택되지 않은 경우 — 무시
  toast('자동완성 목록에서 제품을 선택하세요');
}

// TTI 발주하기 → 자동발주 모달 열기
function submitPOOrder() {
  if (poCart.length === 0) { toast('주문할 제품이 없습니다'); return; }
  openAutoOrderModal();
}

// ========================================
// 자동발주 모달 + 실행 엔진
// ========================================
var _autoOrderState = { running: false, dryRun: true, groups: [], currentGroup: -1, results: [], cancelled: false };

function openAutoOrderModal() {
  // 기존 모달 제거
  var existing = document.getElementById('auto-order-modal');
  if (existing) existing.remove();

  // 장바구니 아이템을 주문유형별 그룹핑
  var groups = _groupCartByOrderType(poCart);
  var totalQty = poCart.reduce(function(s, c) { return s + (c.qty || 0); }, 0);
  var totalSupply = poCart.reduce(function(s, c) { return s + (c.supplyPrice || 0) * (c.qty || 0); }, 0);
  var vat = Math.round(totalSupply * 0.1);

  var savedDryRun = localStorage.getItem('mw_auto_order_dryrun');
  var initDryRun = savedDryRun === null ? true : savedDryRun === 'true';
  _autoOrderState = { running: false, dryRun: initDryRun, groups: groups, currentGroup: -1, results: [], cancelled: false };

  var modal = document.createElement('div');
  modal.id = 'auto-order-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';

  var h = '<div style="background:#fff;border-radius:10px;width:760px;max-width:95vw;max-height:90vh;overflow:hidden;border:1px solid #DDE1EB;display:flex;flex-direction:column;font-family:Pretendard,-apple-system,sans-serif">';

  // 헤더
  h += '<div style="background:#1A1D23;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">';
  h += '<div style="display:flex;align-items:center;gap:10px">';
  h += '<span style="font-size:14px;font-weight:600">TTI 자동발주</span>';
  h += '<span style="background:#185FA5;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px">' + poCart.length + '건</span>';
  h += '</div>';
  h += '<div style="display:flex;align-items:center;gap:12px">';
  // dry-run 토글
  h += '<div style="display:flex;align-items:center;gap:6px">';
  h += '<label style="position:relative;display:inline-block;width:36px;height:20px;cursor:pointer">';
  h += '<input type="checkbox" id="ao-dryrun-toggle" ' + (initDryRun ? 'checked' : '') + ' onchange="_toggleDryRun(this.checked)" style="opacity:0;width:0;height:0">';
  h += '<span id="ao-dryrun-track" style="position:absolute;inset:0;background:' + (initDryRun ? '#185FA5' : '#EF4444') + ';border-radius:10px;transition:background 0.2s"></span>';
  h += '<span id="ao-dryrun-thumb" style="position:absolute;top:2px;left:' + (initDryRun ? '18' : '2') + 'px;width:16px;height:16px;background:#fff;border-radius:50%;transition:left 0.2s"></span>';
  h += '</label>';
  h += '<span id="ao-dryrun-label" style="font-size:11px;font-weight:600;color:' + (initDryRun ? '#6CB4EE' : '#EF4444') + '">' + (initDryRun ? '연습모드' : '실제주문') + '</span>';
  h += '</div>';
  h += '<button onclick="_closeAutoOrderModal()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button>';
  h += '</div></div>';

  // 바디
  h += '<div style="padding:16px;overflow-y:auto;flex:1">';

  // 프로그레스 바
  h += '<div style="margin-bottom:12px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  h += '<span id="ao-progress-text" style="font-size:11px;color:#5A6070">대기 중</span>';
  h += '<span id="ao-progress-count" style="font-size:11px;font-weight:600;color:#185FA5">0 / ' + poCart.length + '</span>';
  h += '</div>';
  h += '<div style="height:6px;background:#F0F2F5;border-radius:3px;overflow:hidden">';
  h += '<div id="ao-progress-bar" style="height:100%;width:0%;background:#185FA5;border-radius:3px;transition:width 0.3s"></div>';
  h += '</div></div>';

  // 주문 테이블
  h += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  h += '<thead><tr style="background:#F4F6FA">';
  h += '<th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:600;color:#5A6070;border-bottom:1px solid #E5E8EB">주문유형</th>';
  h += '<th style="padding:6px 8px;text-align:left;font-size:11px;font-weight:600;color:#5A6070;border-bottom:1px solid #E5E8EB;min-width:180px">모델명</th>';
  h += '<th style="padding:6px 8px;text-align:center;font-size:11px;font-weight:600;color:#5A6070;border-bottom:1px solid #E5E8EB;width:50px">수량</th>';
  h += '<th style="padding:6px 8px;text-align:right;font-size:11px;font-weight:600;color:#5A6070;border-bottom:1px solid #E5E8EB;width:100px">금액</th>';
  h += '<th style="padding:6px 8px;text-align:center;font-size:11px;font-weight:600;color:#5A6070;border-bottom:1px solid #E5E8EB;width:70px">상태</th>';
  h += '<th style="padding:6px 8px;text-align:center;font-size:11px;font-weight:600;color:#5A6070;border-bottom:1px solid #E5E8EB;width:110px">주문번호</th>';
  h += '</tr></thead><tbody id="ao-table-body">';

  poCart.forEach(function(c, idx) {
    var badge = _aoSubtabBadge(c.subtab);
    h += '<tr id="ao-row-' + idx + '" style="border-bottom:1px solid #F0F2F5">';
    h += '<td style="padding:6px 8px">' + badge + '</td>';
    h += '<td style="padding:6px 8px;font-weight:500">' + (c.model || c.ttiNum || '') + '</td>';
    h += '<td style="padding:6px 8px;text-align:center;font-weight:600">' + (c.qty || 0) + '</td>';
    h += '<td style="padding:6px 8px;text-align:right">' + fmtPO((c.supplyPrice || 0) * (c.qty || 0)) + '원</td>';
    h += '<td style="padding:6px 8px;text-align:center" id="ao-status-' + idx + '"><span style="color:#9BA3B2">⏳ 대기</span></td>';
    h += '<td style="padding:6px 8px;text-align:center;font-size:11px;color:#9BA3B2" id="ao-orderno-' + idx + '">-</td>';
    h += '</tr>';
  });
  h += '</tbody></table>';

  // 합계 영역
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px;padding:10px;background:#F4F6FA;border-radius:6px">';
  h += '<div><div style="font-size:10px;color:#5A6070">공급가 합계</div><div style="font-size:14px;font-weight:700">' + fmtPO(totalSupply) + '원</div></div>';
  h += '<div><div style="font-size:10px;color:#5A6070">부가세 (10%)</div><div style="font-size:14px;font-weight:700">' + fmtPO(vat) + '원</div></div>';
  h += '<div><div style="font-size:10px;color:#5A6070">총합계</div><div style="font-size:14px;font-weight:700;color:#185FA5">' + fmtPO(totalSupply + vat) + '원</div></div>';
  h += '</div>';

  h += '</div>'; // 바디 끝

  // 상태 메시지 바
  h += '<div id="ao-status-bar" style="padding:8px 16px;background:#E6F1FB;font-size:12px;color:#185FA5;display:none"></div>';

  // 하단 버튼
  h += '<div style="padding:12px 16px;border-top:1px solid #E5E8EB;display:flex;justify-content:flex-end;gap:8px">';
  h += '<button id="ao-btn-cancel" onclick="_closeAutoOrderModal()" style="padding:8px 20px;border:1px solid #DDE1EB;border-radius:6px;background:#fff;color:#5A6070;font-size:12px;font-weight:600;cursor:pointer">취소</button>';
  h += '<button id="ao-btn-start" onclick="_startAutoOrder()" style="padding:8px 20px;border:none;border-radius:6px;background:#185FA5;color:#fff;font-size:12px;font-weight:600;cursor:pointer">발주 시작</button>';
  h += '</div>';

  h += '</div>'; // 모달 컨테이너 끝
  modal.innerHTML = h;

  // 오버레이 클릭으로 닫기 방지 (진행 중)
  modal.addEventListener('click', function(e) {
    if (e.target === modal && !_autoOrderState.running) _closeAutoOrderModal();
  });

  document.body.appendChild(modal);
}

function _aoSubtabBadge(subtab) {
  if (!subtab || subtab === 'normal') return '<span style="background:#E6F1FB;color:#185FA5;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;white-space:nowrap">일반</span>';
  if (subtab.indexOf('promo-t') === 0) return '<span style="background:#FFF3E0;color:#E67700;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;white-space:nowrap">' + subtab.replace('promo-', '').toUpperCase() + '</span>';
  if (subtab === 'package') return '<span style="background:#F3E8FF;color:#7C3AED;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;white-space:nowrap">패키지</span>';
  return '<span style="background:#F0F2F5;color:#5A6070;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;white-space:nowrap">' + subtab + '</span>';
}

function _toggleDryRun(checked) {
  _autoOrderState.dryRun = checked;
  localStorage.setItem('mw_auto_order_dryrun', String(checked));
  var label = document.getElementById('ao-dryrun-label');
  var track = document.getElementById('ao-dryrun-track');
  var thumb = document.getElementById('ao-dryrun-thumb');
  if (checked) {
    if (label) { label.textContent = '연습모드'; label.style.color = '#6CB4EE'; }
    if (track) track.style.background = '#185FA5';
    if (thumb) thumb.style.left = '18px';
  } else {
    if (label) { label.textContent = '실제주문'; label.style.color = '#EF4444'; }
    if (track) track.style.background = '#EF4444';
    if (thumb) thumb.style.left = '2px';
  }
}

function _closeAutoOrderModal() {
  if (_autoOrderState.running) {
    if (!confirm('발주가 진행 중입니다. 중단하시겠습니까?')) return;
    _autoOrderState.cancelled = true;
    _autoOrderState.running = false;
  }
  var modal = document.getElementById('auto-order-modal');
  if (modal) modal.remove();
}

function _aoSetStatus(msg, isError) {
  var bar = document.getElementById('ao-status-bar');
  if (!bar) return;
  bar.style.display = 'block';
  bar.textContent = msg;
  bar.style.background = isError ? '#FCEBEB' : '#E6F1FB';
  bar.style.color = isError ? '#CC2222' : '#185FA5';
}

function _aoUpdateRow(idx, status, orderNo) {
  var statusEl = document.getElementById('ao-status-' + idx);
  var orderEl = document.getElementById('ao-orderno-' + idx);
  var rowEl = document.getElementById('ao-row-' + idx);
  if (statusEl) statusEl.innerHTML = status;
  if (orderEl && orderNo !== undefined) orderEl.textContent = orderNo;
  if (rowEl) {
    if (status.indexOf('✅') >= 0) rowEl.style.background = '#F0FFF4';
    else if (status.indexOf('❌') >= 0) rowEl.style.background = '#FFF5F5';
    else if (status.indexOf('spinner') >= 0) rowEl.style.background = '#FFFBEB';
  }
}

function _aoUpdateProgress(done, total) {
  var bar = document.getElementById('ao-progress-bar');
  var count = document.getElementById('ao-progress-count');
  var pct = total > 0 ? Math.round(done / total * 100) : 0;
  if (bar) bar.style.width = pct + '%';
  if (count) count.textContent = done + ' / ' + total;
}

// 장바구니를 주문유형별로 그룹핑
function _groupCartByOrderType(cart) {
  var groups = {};
  cart.forEach(function(c, idx) {
    var key = c.subtab || 'normal';
    if (!groups[key]) groups[key] = { subtab: key, items: [], indices: [] };
    groups[key].items.push(c);
    groups[key].indices.push(idx);
  });
  // 순서: normal → promo-t* → package
  var order = ['normal'];
  Object.keys(groups).sort().forEach(function(k) { if (k !== 'normal' && k !== 'package') order.push(k); });
  if (groups['package']) order.push('package');
  return order.filter(function(k) { return groups[k]; }).map(function(k) { return groups[k]; });
}

// 자동발주 시작
function _startAutoOrder() {
  if (_autoOrderState.running) return;
  var btn = document.getElementById('ao-btn-start');
  if (btn) { btn.disabled = true; btn.style.background = '#9BA3B2'; btn.textContent = '진행 중...'; }

  _autoOrderState.running = true;
  _autoOrderState.cancelled = false;
  _autoOrderState.results = [];
  _aoSetStatus('크롬 확장 프로그램 확인 중...');

  // 확장 프로그램 감지 (3초 타임아웃)
  var extensionDetected = false;
  var checkHandler = function(event) {
    if (event.data && event.data.type === 'DAEHAN_EXTENSION_STATUS') {
      extensionDetected = true;
      window.removeEventListener('message', checkHandler);
      _aoSetStatus('확장 프로그램 감지 완료. 발주 시작...');
      _executeOrderGroups();
    }
  };
  window.addEventListener('message', checkHandler);
  window.postMessage({ type: 'DAEHAN_CHECK_EXTENSION' }, '*');

  setTimeout(function() {
    if (!extensionDetected) {
      window.removeEventListener('message', checkHandler);
      // 확장 READY 신호로 재확인
      if (window._daehanExtensionReady) {
        _aoSetStatus('확장 프로그램 감지 완료. 발주 시작...');
        _executeOrderGroups();
      } else {
        _autoOrderState.running = false;
        _aoSetStatus('크롬 확장 프로그램이 감지되지 않습니다. 확장을 설치하고 페이지를 새로고침하세요.', true);
        if (btn) { btn.disabled = false; btn.style.background = '#185FA5'; btn.textContent = '발주 시작'; }
      }
    }
  }, 3000);
}

// 확장 READY 신호 저장 (content-daehan.js가 로드 시 보냄)
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'DAEHAN_EXTENSION_READY') {
    window._daehanExtensionReady = true;
  }
});

// 주문 그룹 순차 실행
async function _executeOrderGroups() {
  var groups = _autoOrderState.groups;
  var totalItems = poCart.length;
  var doneCount = 0;

  for (var g = 0; g < groups.length; g++) {
    if (_autoOrderState.cancelled) break;
    _autoOrderState.currentGroup = g;
    var group = groups[g];
    var subtabLabel = group.subtab === 'normal' ? '일반주문' : group.subtab === 'package' ? '패키지' : group.subtab.replace('promo-', '').toUpperCase() + ' 프로모션';
    _aoSetStatus('[' + (g + 1) + '/' + groups.length + '] ' + subtabLabel + ' ' + group.items.length + '건 발주 중...');

    // 해당 그룹 행 상태 → 진행중
    group.indices.forEach(function(idx) {
      _aoUpdateRow(idx, '<span style="color:#E67700"><span class="ao-spinner"></span> 진행중</span>');
    });

    // postMessage로 크롬 확장에 전달
    var orderItems = group.items.map(function(c) {
      return { code: c.ttiNum || c.code, orderNum: c.orderNum || '', qty: c.qty, model: c.model, supplyPrice: c.supplyPrice };
    });

    try {
      var result = await _sendOrderToExtension(orderItems, group.subtab, _autoOrderState.dryRun);
      // 그룹 결과 처리
      group.indices.forEach(function(idx) {
        if (result.success) {
          var orderNo = _autoOrderState.dryRun ? 'DRY-RUN' : (result.orderNumber || result.result && result.result.orderNumber || '-');
          var statusColor = _autoOrderState.dryRun ? '#E67700' : '#16A34A';
          var statusIcon = _autoOrderState.dryRun ? '🔸' : '✅';
          var statusText = _autoOrderState.dryRun ? 'dry-run 완료' : '완료';
          _aoUpdateRow(idx, '<span style="color:' + statusColor + '">' + statusIcon + ' ' + statusText + '</span>', orderNo);
          _autoOrderState.results.push({ idx: idx, success: true, dryRun: _autoOrderState.dryRun, orderNumber: orderNo });
        } else {
          _aoUpdateRow(idx, '<span style="color:#EF4444">❌ ' + (result.error || '실패') + '</span>', '-');
          _autoOrderState.results.push({ idx: idx, success: false, error: result.error });
        }
        doneCount++;
        _aoUpdateProgress(doneCount, totalItems);
      });
    } catch (err) {
      group.indices.forEach(function(idx) {
        _aoUpdateRow(idx, '<span style="color:#EF4444">❌ ' + err.message + '</span>', '-');
        _autoOrderState.results.push({ idx: idx, success: false, error: err.message });
        doneCount++;
        _aoUpdateProgress(doneCount, totalItems);
      });
    }
  }

  // 전체 완료
  _autoOrderState.running = false;
  var successCount = _autoOrderState.results.filter(function(r) { return r.success; }).length;
  var failCount = _autoOrderState.results.filter(function(r) { return !r.success; }).length;

  if (_autoOrderState.dryRun) {
    _aoSetStatus('dry-run 완료: ' + successCount + '건 성공, ' + failCount + '건 실패. 장바구니는 유지됩니다.');
    // dryRun → mw_po_history에 dryRun:true로 저장 (매출 집계 제외, 이력 확인용)
    _saveAutoOrderHistory(true);
  } else {
    // 실제 주문 → 성공 건만 mw_po_history에 저장 + 장바구니에서 제거
    _aoSetStatus('발주 완료: ' + successCount + '건 성공, ' + failCount + '건 실패');
    _saveAutoOrderHistory(false);
    _removeSuccessFromCart();
  }

  var btn = document.getElementById('ao-btn-start');
  if (btn) { btn.textContent = '완료'; btn.style.background = '#16A34A'; btn.disabled = false; btn.onclick = function() { _closeAutoOrderModal(); }; }

  var progressText = document.getElementById('ao-progress-text');
  if (progressText) progressText.textContent = '완료';
}

// 크롬 확장에 주문 전달 (Promise)
function _sendOrderToExtension(items, orderType, dryRun) {
  return new Promise(function(resolve) {
    var timeout;
    var gotInitial = false;

    // 최종 결과 수신 (AUTO_ORDER_COMPLETE from Phase 4-1a)
    var completeHandler = function(event) {
      if (event.data && event.data.type === 'TTI_AUTO_ORDER_COMPLETE') {
        clearTimeout(timeout);
        window.removeEventListener('message', completeHandler);
        window.removeEventListener('message', initialHandler);
        var r = event.data.result || {};
        resolve({ success: r.success !== false, result: r, orderNumber: r.orderNumber || '' });
      }
    };

    // 초기 응답 (레거시 DAEHAN_ORDER_RESULT — "시작됨" 확인용)
    var initialHandler = function(event) {
      if (event.data && event.data.type === 'DAEHAN_ORDER_RESULT') {
        if (!gotInitial) {
          gotInitial = true;
          console.log('[자동발주] 초기 응답 수신 (시작 확인):', event.data);
          // 시작 자체가 실패이면 즉시 종료
          if (!event.data.success && event.data.error) {
            clearTimeout(timeout);
            window.removeEventListener('message', completeHandler);
            window.removeEventListener('message', initialHandler);
            resolve({ success: false, error: event.data.error });
          }
          // success: true → "진행 중" 상태 유지, 최종 결과 대기
        }
      }
    };

    window.addEventListener('message', completeHandler);
    window.addEventListener('message', initialHandler);

    window.postMessage({
      type: 'DAEHAN_AUTO_ORDER',
      items: items,
      orderType: orderType,
      dryRun: dryRun
    }, '*');
    console.log('[자동발주] postMessage 발신:', { type: 'DAEHAN_AUTO_ORDER', items: items.length, orderType: orderType, dryRun: dryRun });

    // 120초 타임아웃 (로그인+주문 포함)
    timeout = setTimeout(function() {
      window.removeEventListener('message', completeHandler);
      window.removeEventListener('message', initialHandler);
      resolve({ success: false, error: '응답 시간 초과 (120초)' });
    }, 120000);
  });
}

// mw_po_history에 저장
function _saveAutoOrderHistory(isDryRun) {
  var history = JSON.parse(localStorage.getItem('mw_po_history') || '[]');
  var now = new Date().toISOString();
  var dateStr = now.split('T')[0];
  _autoOrderState.results.forEach(function(r) {
    if (!r.success) return;
    var c = poCart[r.idx];
    if (!c) return;
    history.push({
      id: Date.now() + '_' + r.idx,
      date: now,
      type: c.promoName ? c.promoName : 'normal',
      subtab: c.subtab || 'normal',
      promoName: c.promoName || '',
      manageCode: c.code,
      ttiNum: c.ttiNum,
      model: c.model,
      category: c.category || '',
      qty: c.qty,
      supplyPrice: c.supplyPrice,
      costPrice: c.costPrice,
      amount: c.supplyPrice * c.qty,
      orderNumber: r.orderNumber || '',
      dryRun: isDryRun,
      erpStatus: isDryRun ? 'dry-run' : 'pending'
    });
  });
  save('mw_po_history', history);
}

// 성공 건 장바구니에서 제거
function _removeSuccessFromCart() {
  var successIndices = {};
  _autoOrderState.results.forEach(function(r) { if (r.success) successIndices[r.idx] = true; });
  poCart = poCart.filter(function(c, idx) { return !successIndices[idx]; });
  _savePoCart();
  renderPOCartTable();
  renderPOTab();
}

// CSS 스피너 (인라인)
(function _injectAOSpinnerCSS() {
  if (document.getElementById('ao-spinner-style')) return;
  var style = document.createElement('style');
  style.id = 'ao-spinner-style';
  style.textContent = '.ao-spinner{display:inline-block;width:12px;height:12px;border:2px solid #E67700;border-top-color:transparent;border-radius:50%;animation:ao-spin 0.6s linear infinite;vertical-align:middle;margin-right:4px}@keyframes ao-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
})();

// 제품 목록 필터
function filterPOProducts() {
  var search = (document.getElementById('po-prod-search') || {}).value || '';
  var cat = (document.getElementById('po-prod-cat') || {}).value || '';
  var stock = (document.getElementById('po-prod-stock') || {}).value || '';
  search = search.toLowerCase().trim();

  _poFilteredProducts = (DB.products || []).filter(function(p) {
    if (p.discontinued) return false;
    if (cat && p.category !== cat) return false;
    if (stock) {
      var code = normalizeTtiCode(p.ttiNum);
      var s = code && _poTtiStockMap[code] !== undefined ? _poTtiStockMap[code] : '';
      if (s !== stock) return false;
    }
    if (search) {
      var text = ((p.code || '') + ' ' + (p.ttiNum || '') + ' ' + (p.model || '') + ' ' + (p.detail || '') + ' ' + (p.category || '') + ' ' + (p.orderNum || '')).toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });
  var _catOrder = { '파워툴': 1, '수공구': 2, '팩아웃': 3, '악세사리': 4, '액세서리': 4, '드릴비트': 5 };
  _poFilteredProducts.sort(function(a, b) {
    var ca = _catOrder[a.category] || 6, cb = _catOrder[b.category] || 6;
    if (ca !== cb) return ca - cb;
    return (a.model || '').localeCompare(b.model || '', 'ko');
  });
  renderPOProductRows();
}

function renderAllOrders() {
  ['elec', 'hand', 'pack'].forEach(renderOrderTab);
  if (document.getElementById('order-sheet').style.display !== 'none') renderOrderSheet();
}

// ======================== 발주 확정/이력 ========================
const ORDER_HISTORY_KEY = 'mw_order_history';
let orderHistory = loadObj(ORDER_HISTORY_KEY, []);

function confirmOrder() {
  const items = [];
  let totalCost = 0;
  ['elec', 'hand', 'pack'].forEach(type => {
    DB.orders[type].forEach(item => {
      const p = findProduct(item.code);
      if (p && item.qty > 0) {
        const cost = Math.round(calcOrderCost(p.supplyPrice, p.category || ''));
        items.push({
          code: item.code,
          model: p.model,
          type: type,
          qty: item.qty,
          supplyPrice: p.supplyPrice,
          cost: cost,
          costTotal: cost * item.qty,
          memo: item.memo || ''
        });
        totalCost += cost * item.qty;
      }
    });
  });

  if (!items.length) {
    toast('발주 수량이 입력된 제품이 없습니다');
    return;
  }

  if (!confirm('일반 발주를 확정하시겠습니까?\n\n총 ' + items.length + '건, 매입합계 ' + fmt(totalCost) + '원')) return;

  const record = {
    id: Date.now(),
    date: new Date().toISOString(),
    items: items,
    totalCost: totalCost,
    totalItems: items.length
  };
  orderHistory.push(record);
  localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(orderHistory));

  // 수량 즉시 초기화
  ['elec', 'hand', 'pack'].forEach(type => {
    DB.orders[type].forEach(item => { item.qty = 0; });
  });
  save(KEYS.orders, DB.orders);
  // 발주서 화면 즉시 갱신
  ['elec', 'hand', 'pack'].forEach(type => {
    document.getElementById('sheet-' + type + '-body').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9BA3B2;padding:20px">발주없음</td></tr>';
    document.getElementById('sheet-' + type + '-count').textContent = '';
  });
  document.getElementById('sheet-gt-elec').textContent = '-';
  document.getElementById('sheet-gt-hand').textContent = '-';
  document.getElementById('sheet-gt-pack').textContent = '-';
  document.getElementById('sheet-gt-total').textContent = '-';
  // KPI도 초기화
  document.getElementById('order-elec-total').textContent = '-';
  document.getElementById('order-hand-total').textContent = '-';
  document.getElementById('order-pack-total').textContent = '-';
  document.getElementById('order-grand-total').textContent = '-';

  updateOrderSheetButtons(true);
  renderCatalog();
  toast('일반 발주 확정 완료 (' + items.length + '건, ' + fmt(totalCost) + '원)');
}

function updateOrderSheetButtons(confirmed) {
  const confirmBtn = document.getElementById('order-confirm-btn');
  if (confirmed) {
    confirmBtn.textContent = '✅ 발주 확정';
    confirmBtn.onclick = function() { resetOrderConfirm(); };
    confirmBtn.style.background = '#1D9E75';
  } else {
    confirmBtn.textContent = '✅ 발주 확정';
    confirmBtn.onclick = function() { confirmOrder(); };
    confirmBtn.style.background = '';
  }
}

function resetOrderConfirm() {
  if (!confirm('발주 확정을 해제하고 수량을 초기화하시겠습니까?')) return;
  ['elec', 'hand', 'pack'].forEach(type => {
    DB.orders[type].forEach(item => { item.qty = 0; });
  });
  save(KEYS.orders, DB.orders);
  renderAllOrders();
  updateOrderSheetButtons(false);
  toast('발주 확정 해제 및 수량 초기화 완료');
}

function resetAllOrderQty() {
  if (!confirm('전동공구/수공구/팩아웃 전체 수량을 초기화하시겠습니까?')) return;
  ['elec', 'hand', 'pack'].forEach(type => {
    DB.orders[type].forEach(item => { item.qty = 0; });
  });
  save(KEYS.orders, DB.orders);
  renderAllOrders();
  toast('전체 수량 초기화 완료');
}

function showOrderHistory() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recent = orderHistory.filter(r => (now - new Date(r.date).getTime()) < weekMs);
  const list = document.getElementById('order-history-list');

  if (!recent.length) {
    list.innerHTML = '<div class="empty-state"><p>최근 1주일 내 발주 이력이 없습니다</p></div>';
  } else {
    list.innerHTML = recent.sort((a, b) => b.id - a.id).map((r, i) => {
      const d = new Date(r.date);
      const dateStr = d.toLocaleDateString('ko') + ' ' + d.toLocaleTimeString('ko', {hour:'2-digit', minute:'2-digit'});
      return '<div style="border:1px solid var(--tl-border);border-radius:6px;padding:12px 16px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div><span style="font-weight:600;font-size:13px">#' + (recent.length - i) + '</span> <span style="color:#5A6070;font-size:12px">' + dateStr + '</span></div>' +
        '<button class="btn-danger btn-sm" onclick="cancelOrderHistory(' + r.id + ')" style="padding:3px 10px;font-size:11px">취소</button>' +
        '</div>' +
        '<div style="display:flex;gap:16px;font-size:12px;color:#5A6070">' +
        '<span>품목: <span style="color:#1A1D23;font-weight:600">' + r.totalItems + '건</span></span>' +
        '<span>매입합계: <span style="color:#1D9E75;font-weight:600">' + fmt(r.totalCost) + '원</span></span>' +
        '</div>' +
        '<div style="margin-top:8px;max-height:120px;overflow-y:auto">' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
        '<thead><tr style="background:#F4F6FA"><th style="padding:3px 6px;text-align:left">코드</th><th style="padding:3px 6px;text-align:left">모델명</th><th style="padding:3px 6px;text-align:center">수량</th><th style="padding:3px 6px;text-align:right">매입원가</th></tr></thead>' +
        '<tbody>' + r.items.map(it =>
          '<tr style="border-bottom:1px solid #F0F2F7"><td style="padding:3px 6px">' + it.code + '</td><td style="padding:3px 6px">' + it.model + '</td><td style="padding:3px 6px;text-align:center">' + it.qty + '</td><td style="padding:3px 6px;text-align:right;color:#1D9E75">' + fmt(it.costTotal) + '</td></tr>'
        ).join('') + '</tbody></table></div></div>';
    }).join('');
  }

  document.getElementById('order-history-modal').classList.add('show');
}

function closeOrderHistoryModal() {
  document.getElementById('order-history-modal').classList.remove('show');
}

function cancelOrderHistory(id) {
  const record = orderHistory.find(r => r.id === id);
  if (!record) return;
  const d = new Date(record.date);
  const dateStr = d.toLocaleDateString('ko') + ' ' + d.toLocaleTimeString('ko', {hour:'2-digit', minute:'2-digit'});
  if (!confirm(dateStr + ' 발주를 취소하시겠습니까?\n(' + record.totalItems + '건, ' + fmt(record.totalCost) + '원)')) return;

  orderHistory = orderHistory.filter(r => r.id !== id);
  localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(orderHistory));

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recent = orderHistory.filter(r => (now - new Date(r.date).getTime()) < weekMs);
  if (!recent.length) {
    updateOrderSheetButtons(false);
  }

  showOrderHistory();
  toast('발주 취소 완료');
}

// ======================== 프로모션 발주 확정/이력 ========================
const PO_HISTORY_KEY = 'mw_promo_order_history';
let poHistory = loadObj(PO_HISTORY_KEY, []);

function confirmPromoOrder() {
  const items = [];
  let totalCost = 0;

  poOrderData.forEach(item => {
    if (item.orderQty > 0) {
      const prod = item.code ? findProduct(item.code) : null;
      const pdc = prod ? (prod.category || '') : '';
      const unitCost = Math.round(calcOrderCost(item.promoPrice || 0, pdc));
      items.push({
        code: item.code || '',
        model: item.model || '',
        promoNo: item.promoNo || '',
        promoName: item.promoName || '',
        qty: item.orderQty,
        promoPrice: item.promoPrice || 0,
        cost: unitCost,
        costTotal: unitCost * item.orderQty,
        type: 'promo'
      });
      totalCost += unitCost * item.orderQty;
    }
  });

  spotOrderData.forEach(item => {
    if (item.orderQty > 0) {
      const prod = item.code ? findProduct(item.code) : null;
      const pdc = prod ? (prod.category || '') : '';
      const unitCost = Math.round(calcOrderCost(item.promoPrice || 0, pdc));
      items.push({
        code: item.code || '',
        model: item.model || '',
        promoNo: item.promoNo || '',
        promoName: item.promoName || '스팟',
        qty: item.orderQty,
        promoPrice: item.promoPrice || 0,
        cost: unitCost,
        costTotal: unitCost * item.orderQty,
        type: 'spot'
      });
      totalCost += unitCost * item.orderQty;
    }
  });

  if (!items.length) {
    toast('발주 수량이 입력된 프로모션 제품이 없습니다');
    return;
  }

  if (!confirm('프로모션 발주를 확정하시겠습니까?\n\n총 ' + items.length + '건, 매입합계 ' + fmt(totalCost) + '원')) return;

  items.forEach(it => {
    if (it.code) {
      const existing = DB.promotions.find(p => String(p.code) === String(it.code) && p.promoCode === it.promoNo);
      if (!existing) {
        DB.promotions.push({
          code: it.code,
          promoCode: it.promoNo,
          promoName: it.promoName,
          model: it.model,
          promoPrice: it.promoPrice,
          cost: it.cost,
          qty: it.qty,
          orderDate: new Date().toISOString(),
          month: new Date().toISOString().slice(0, 7)
        });
      }
    }
  });
  save(KEYS.promotions, DB.promotions);

  const record = {
    id: Date.now(),
    date: new Date().toISOString(),
    items: items,
    totalCost: totalCost,
    totalItems: items.length
  };
  poHistory.push(record);
  localStorage.setItem(PO_HISTORY_KEY, JSON.stringify(poHistory));

  // 발주완료 처리 (누적은 제외)
  poOrderData.forEach(function(item) {
    if (item.orderQty > 0) {
      var isCumul = item.promoName && item.promoName.indexOf('누적') >= 0;
      if (!isCumul) item.confirmed = true;
    }
  });
  spotOrderData.forEach(item => { item.orderQty = 0; });
  savePoOrders();
  saveSpotOrders();
  // 발주서 화면 즉시 갱신
  document.getElementById('po-sheet-body').innerHTML = '<tr><td colspan="10" style="text-align:center;color:#9BA3B2;padding:30px">발주 수량이 입력된 프로모션이 없습니다</td></tr>';
  document.getElementById('po-sheet-promo-cost-total').textContent = '-';
  document.getElementById('po-sheet-spot-cost-total').textContent = '-';
  document.getElementById('po-sheet-grand-cost-total').textContent = '-';

  updatePoSheetButtons(true);
  renderCatalog();
  toast('프로모션 발주 확정 완료 (' + items.length + '건, ' + fmt(totalCost) + '원)');
}

function updatePoSheetButtons(confirmed) {
  const confirmBtn = document.getElementById('po-confirm-btn');
  if (confirmed) {
    confirmBtn.textContent = '✅ 발주 확정';
    confirmBtn.onclick = function() { resetPoConfirm(); };
    confirmBtn.style.background = '#1D9E75';
  } else {
    confirmBtn.textContent = '✅ 발주 확정';
    confirmBtn.onclick = function() { confirmPromoOrder(); };
    confirmBtn.style.background = '';
  }
}

function resetPoConfirm() {
  if (!confirm('프로모션 발주 확정을 해제하고 수량을 초기화하시겠습니까?')) return;
  poOrderData.forEach(item => { item.orderQty = 0; });
  spotOrderData.forEach(item => { item.orderQty = 0; });
  savePoOrders();
  saveSpotOrders();
  renderPoOrder();
  renderSpotOrder();
  updatePoSheetButtons(false);
  toast('프로모션 발주 확정 해제 및 수량 초기화 완료');
}

function resetAllPromoQty() {
  if (!confirm('프로모션/스팟 전체 수량을 초기화하시겠습니까?')) return;
  poOrderData.forEach(item => { item.orderQty = 0; });
  spotOrderData.forEach(item => { item.orderQty = 0; });
  savePoOrders();
  saveSpotOrders();
  renderPoOrder();
  renderSpotOrder();
  toast('프로모션 전체 수량 초기화 완료');
}

function showPromoOrderHistory() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recent = poHistory.filter(r => (now - new Date(r.date).getTime()) < weekMs);
  const list = document.getElementById('po-history-list');

  if (!recent.length) {
    list.innerHTML = '<div class="empty-state"><p>최근 1주일 내 프로모션 발주 이력이 없습니다</p></div>';
  } else {
    list.innerHTML = recent.sort((a, b) => b.id - a.id).map((r, i) => {
      const d = new Date(r.date);
      const dateStr = d.toLocaleDateString('ko') + ' ' + d.toLocaleTimeString('ko', {hour:'2-digit', minute:'2-digit'});
      return '<div style="border:1px solid var(--tl-border);border-radius:6px;padding:12px 16px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div><span style="font-weight:600;font-size:13px">#' + (recent.length - i) + '</span> <span style="color:#5A6070;font-size:12px">' + dateStr + '</span></div>' +
        '<button class="btn-danger btn-sm" onclick="cancelPoHistory(' + r.id + ')" style="padding:3px 10px;font-size:11px">취소</button>' +
        '</div>' +
        '<div style="display:flex;gap:16px;font-size:12px;color:#5A6070">' +
        '<span>품목: <span style="color:#1A1D23;font-weight:600">' + r.totalItems + '건</span></span>' +
        '<span>매입합계: <span style="color:#1D9E75;font-weight:600">' + fmt(r.totalCost) + '원</span></span>' +
        '</div>' +
        '<div style="margin-top:8px;max-height:120px;overflow-y:auto">' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
        '<thead><tr style="background:#F4F6FA"><th style="padding:3px 6px;text-align:left">코드</th><th style="padding:3px 6px;text-align:left">모델명</th><th style="padding:3px 6px;text-align:center">프로모션</th><th style="padding:3px 6px;text-align:center">수량</th><th style="padding:3px 6px;text-align:right">매입원가</th></tr></thead>' +
        '<tbody>' + r.items.map(it =>
          '<tr style="border-bottom:1px solid #F0F2F7"><td style="padding:3px 6px">' + it.code + '</td><td style="padding:3px 6px">' + it.model + '</td><td style="padding:3px 6px;text-align:center"><span style="background:#E6F1FB;color:#185FA5;font-size:10px;font-weight:600;padding:1px 4px;border-radius:3px">' + it.promoNo + '</span></td><td style="padding:3px 6px;text-align:center">' + it.qty + '</td><td style="padding:3px 6px;text-align:right;color:#1D9E75">' + fmt(it.costTotal) + '</td></tr>'
        ).join('') + '</tbody></table></div></div>';
    }).join('');
  }

  document.getElementById('po-history-modal').classList.add('show');
}

function closePoHistoryModal() {
  document.getElementById('po-history-modal').classList.remove('show');
}

function cancelPoHistory(id) {
  const record = poHistory.find(r => r.id === id);
  if (!record) return;
  const d = new Date(record.date);
  const dateStr = d.toLocaleDateString('ko') + ' ' + d.toLocaleTimeString('ko', {hour:'2-digit', minute:'2-digit'});
  if (!confirm(dateStr + ' 프로모션 발주를 취소하시겠습니까?\n(' + record.totalItems + '건, ' + fmt(record.totalCost) + '원)')) return;

  record.items.forEach(it => {
    if (it.code) {
      const idx = DB.promotions.findIndex(p => String(p.code) === String(it.code) && p.promoCode === it.promoNo && p.orderDate);
      if (idx >= 0) DB.promotions.splice(idx, 1);
    }
  });
  save(KEYS.promotions, DB.promotions);

  poHistory = poHistory.filter(r => r.id !== id);
  localStorage.setItem(PO_HISTORY_KEY, JSON.stringify(poHistory));

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recent = poHistory.filter(r => (now - new Date(r.date).getTime()) < weekMs);
  if (!recent.length) {
    updatePoSheetButtons(false);
  }

  showPromoOrderHistory();
  renderCatalog();
  toast('프로모션 발주 취소 완료');
}

function exportOrder() {
  // 확정 상태면 최신 이력에서 엑셀 생성
  const now2 = Date.now();
  const weekMs2 = 7 * 24 * 60 * 60 * 1000;
  const recentOrd = orderHistory.filter(r => (now2 - new Date(r.date).getTime()) < weekMs2);
  if (recentOrd.length > 0) {
    const latest = recentOrd.sort((a, b) => b.id - a.id)[0];
    if (!window.XLSX) { toast('SheetJS 라이브러리 로딩 중입니다'); return; }
    try {
      const data = [['내부코드', '수량', '매입원가', '적요']];
      latest.items.forEach(it => {
        data.push([it.code, it.qty, it.costTotal, it.memo || '']);
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{wch:12},{wch:8},{wch:14},{wch:40}];
      XLSX.utils.book_append_sheet(wb, ws, '발주서');
      XLSX.writeFile(wb, '밀워키_발주서_' + new Date().toISOString().slice(0, 10) + '.xlsx');
      toast('발주서 다운로드 완료 (' + latest.totalItems + '건)');
    } catch (err) {
      toast('다운로드 실패: ' + err.message);
    }
    return;
  }
  if (!window.XLSX) { toast('SheetJS 라이브러리 로딩 중입니다. 잠시 후 다시 시도하세요.'); return; }
  try {
    const data = [['내부코드', '수량', '원가', '적요']];
    let totalItems = 0;

    // 일반 발주 (전동/수공/팩아웃)
    ['elec', 'hand', 'pack'].forEach(type => {
      DB.orders[type].forEach(item => {
        const p = findProduct(item.code);
        if (p && item.qty > 0) {
          const oc = Math.round(calcOrderCost(p.supplyPrice, p.category || ''));
          data.push([item.code, item.qty, oc * item.qty, item.memo || '']);
          totalItems++;
        }
      });
    });

    if (totalItems === 0) { toast('발주 수량이 입력된 제품이 없습니다'); return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, '발주서');

    XLSX.writeFile(wb, `밀워키_발주서_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast(`발주서 다운로드 완료 (${totalItems}건)`);
  } catch (err) {
    console.error('발주서 다운로드 오류:', err);
    toast('발주서 다운로드 실패: ' + err.message);
  }
}

// ======================== PROMO ORDERS (통합) ========================
let poOrderData = loadObj('mw_po_orders', []);
let spotOrderData = loadObj('mw_spot_orders', []);

function findCodeByModel(model, ttiNum) {
  if (!model && !ttiNum) return '';
  const p = DB.products.find(pr => {
    if (ttiNum && String(pr.ttiNum) === String(ttiNum)) return true;
    if (model && pr.model && String(pr.model).toLowerCase() === String(model).toLowerCase()) return true;
    return false;
  });
  return p ? String(p.code) : '';
}

function renderPoOrder() {
  var body = document.getElementById('po-order-body');
  var sorted = poOrderData.slice().sort(function(a, b) {
    var aC = a.confirmed && !(a.promoName && a.promoName.indexOf('누적') >= 0);
    var bC = b.confirmed && !(b.promoName && b.promoName.indexOf('누적') >= 0);
    if (aC && !bC) return 1;
    if (!aC && bC) return -1;
    return 0;
  });
  var cumulStats = {};
  poOrderData.forEach(function(item) {
    if (item.promoName && item.promoName.indexOf('누적') >= 0) {
      var key = String(item.code || item.model);
      if (!cumulStats[key]) cumulStats[key] = { qty: 0, total: 0 };
      cumulStats[key].qty += (item.orderQty || 0);
      cumulStats[key].total += (item.orderQty || 0) * (item.promoPrice || 0);
    }
  });
  body.innerHTML = sorted.map(function(item) {
    var i = poOrderData.indexOf(item);
    var code = item.code || findCodeByModel(item.model, item.ttiNum);
    var isCumul = item.promoName && item.promoName.indexOf('누적') >= 0;
    var isConf = item.confirmed && !isCumul;
    var prod = item.code ? findProduct(item.code) : null;
    var pdc = prod ? (prod.category || '') : '';
    var unitCost = item.promoPrice ? Math.round(calcOrderCost(item.promoPrice, pdc)) : 0;
    var orderTotal = (item.orderQty || 0) * (unitCost || 0);
    var memoHtml = '';
    if (isConf) {
      memoHtml = '<span style="background:#E1F5EE;color:#085041;font-weight:600;padding:2px 6px;border-radius:3px;font-size:10px">발주완료</span>';
    } else if (isCumul && item.orderQty > 0) {
      var cKey = String(item.code || item.model);
      var cs = cumulStats[cKey] || { qty: 0, total: 0 };
      memoHtml = '<div style="display:flex;flex-direction:column;align-items:center;gap:1px"><span style="font-size:10px;color:#5A6070">공급가</span><span style="font-size:11px;font-weight:600;color:#185FA5">' + fmt(cs.total) + '</span><span style="font-size:10px;color:#5A6070">누적 ' + cs.qty + '개</span></div>';
    }
    var rs = isConf ? ' style="background:#F9FBF9"' : '';
    var cs = isConf ? 'color:#9BA3B2' : '';
    var qtyCell = isConf
      ? '<td class="center" style="' + cs + '">' + (item.orderQty || 0) + '</td>'
      : '<td class="center"><input type="number" value="' + (item.orderQty || '') + '" onchange="poOrderData[' + i + '].orderQty=parseInt(this.value)||0;savePoOrders();renderPoOrder()" min="0" style="width:60px;text-align:center"></td>';
    return '<tr' + rs + '>' +
      '<td class="center"><button class="btn-danger btn-sm" onclick="removePoRow(' + i + ')" style="padding:2px 6px">✕</button></td>' +
      '<td class="center" style="' + cs + '">' + (code || '-') + '</td>' +
      '<td class="center" style="font-weight:600;color:#185FA5;' + (isConf ? 'opacity:0.5' : '') + '">' + (item.promoNo || '-') + '</td>' +
      '<td class="center" style="font-size:11px;' + cs + '">' + (item.promoName || '-') + '</td>' +
      '<td class="center" style="' + cs + '">' + (item.discountRate ? item.discountRate + (String(item.discountRate).includes('%') ? '' : '%') : '-') + '</td>' +
      '<td class="center" style="' + cs + '">' + (item.orderNum || '-') + '</td>' +
      '<td class="center" style="font-weight:500;' + cs + '">' + (item.model || '-') + '</td>' +
      '<td class="center" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + cs + '">' + (item.description || '-') + '</td>' +
      '<td class="center" style="' + cs + '">' + (item.baseQty || '-') + '</td>' +
      qtyCell +
      '<td class="center">' + memoHtml + '</td>' +
      '<td class="num" style="' + cs + '">' + (item.basePrice ? fmt(item.basePrice) : '-') + '</td>' +
      '<td class="num" style="color:#CC2222;font-weight:600;' + (isConf ? 'opacity:0.5' : '') + '">' + (item.promoPrice ? fmt(item.promoPrice) : '-') + '</td>' +
      '<td class="num" style="color:' + (isConf ? '#9BA3B2' : '#1D9E75') + ';font-weight:600">' + (unitCost ? fmt(unitCost) : '-') + '</td>' +
      '<td class="num" style="font-weight:600;color:#185FA5;' + (isConf ? 'opacity:0.5' : '') + '">' + (orderTotal > 0 ? fmt(orderTotal) : '-') + '</td>' +
      '<td class="center" style="font-size:11px;' + cs + '">' + (item.promoName || '-') + '</td>' +
      '</tr>';
  }).join('');
  if (!poOrderData.length) {
    body.innerHTML = '<tr><td colspan="16"><div class="empty-state"><p>프로모션 발주 항목이 없습니다</p><p style="font-size:12px;color:#9BA3B2">엑셀 업로드 또는 + 추가로 등록하세요</p></div></td></tr>';
  }
  document.getElementById('po-order-count').textContent = poOrderData.length + '건';
  initColumnResize('order-po-table');
  initStickyHeader('order-po-table');
}

function savePoOrders() { localStorage.setItem('mw_po_orders', JSON.stringify(poOrderData)); }

function downloadPoTemplate() {
  if (!window.XLSX) { toast('SheetJS 로딩 중'); return; }
  const data = [['프로모션번호','프로모션명','구분','시작','종료','할인율','페이지','순번','TTI#','모델명','제품설명','기본수량','기본단가','프로모션단가','세트당총액','업체당세트제한','오더최대수량','일반주문가능여부','비고']];
  data.push(['M101','M18 BLCV2 신제품 20%','신제품','3/3','3/30','20%','1','2561','016401004','M18 BLCV2-0','18V 브러쉬리스 콤팩트 진공청소기II 베어툴',1,140000,112000,112000,'업체당1세트',5,'N','']);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:35},{wch:8},{wch:8},{wch:8},{wch:8},{wch:6},{wch:6},{wch:12},{wch:22},{wch:35},{wch:8},{wch:12},{wch:12},{wch:12},{wch:14},{wch:12},{wch:14},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, '프로모션발주양식');
  XLSX.writeFile(wb, '프로모션_발주양식.xlsx');
  toast('엑셀 양식 다운로드 완료');
}

function uploadPoExcel(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { toast('데이터가 없습니다'); return; }

      let added = 0;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const model = String(r[9] || '');
        const ttiNum = String(r[8] || '');
        const code = findCodeByModel(model, ttiNum);

        poOrderData.push({
          promoNo: String(r[0] || ''),
          promoName: String(r[1] || ''),
          category: String(r[2] || ''),
          startDate: String(r[3] || ''),
          endDate: String(r[4] || ''),
          discountRate: String(r[5] || ''),
          page: String(r[6] || ''),
          orderNum: String(r[7] || ''),
          ttiNum: ttiNum,
          model: model,
          description: String(r[10] || ''),
          baseQty: parseInt(r[11]) || 0,
          orderQty: 0,
          basePrice: parseInt(r[12]) || 0,
          promoPrice: parseInt(r[13]) || 0,
          setTotal: parseInt(r[14]) || 0,
          setLimit: String(r[15] || ''),
          maxOrderQty: parseInt(r[16]) || 0,
          normalOrderOk: String(r[17] || ''),
          memo: String(r[18] || ''),
          code: code
        });
        added++;
      }
      savePoOrders();
      renderPoOrder();
      input.value = '';
      toast(`${added}건 프로모션 발주 업로드 완료`);
    } catch (err) {
      toast('엑셀 읽기 오류: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function addPoRow() {
  poOrderData.push({ promoNo:'', promoName:'', category:'', discountRate:'', orderNum:'', ttiNum:'', model:'', description:'', baseQty:0, orderQty:0, basePrice:0, promoPrice:0, code:'', memo:'' });
  savePoOrders();
  renderPoOrder();
}

function removePoRow(idx) {
  poOrderData.splice(idx, 1);
  savePoOrders();
  renderPoOrder();
}

function resetPoQty() {
  poOrderData.forEach(item => item.orderQty = 0);
  savePoOrders();
  renderPoOrder();
  toast('수량 초기화 완료');
}

function clearPoAll() {
  if (!confirm('프로모션 발주를 전체 초기화하시겠습니까?')) return;
  poOrderData = [];
  savePoOrders();
  renderPoOrder();
  toast('전체 초기화 완료');
}

// ======================== 스팟 발주 ========================
function renderSpotOrder() {
  const body = document.getElementById('spot-order-body');
  body.innerHTML = spotOrderData.map((item, i) => {
    const code = item.code || findCodeByModel(item.model, item.ttiNum);
    return `<tr>
      <td class="center"><button class="btn-danger btn-sm" onclick="removeSpotRow(${i})" style="padding:2px 6px">✕</button></td>
      <td class="center">${code || '-'}</td>
      <td class="center" style="font-weight:600;color:#185FA5">${item.promoNo || '-'}</td>
      <td class="center" style="font-size:11px">${item.promoName || '-'}</td>
      <td class="center">${item.discountRate ? item.discountRate + (String(item.discountRate).includes('%') ? '' : '%') : '-'}</td>
      <td class="center">${item.orderNum || '-'}</td>
      <td class="center" style="font-weight:500">${item.model || '-'}</td>
      <td class="center" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.description || '-'}</td>
      <td class="center">${item.baseQty || '-'}</td>
      <td class="center"><input type="number" value="${item.orderQty || ''}" onchange="spotOrderData[${i}].orderQty=parseInt(this.value)||0;saveSpotOrders()" min="0" style="width:60px;text-align:center"></td>
      <td class="num">${item.basePrice ? fmt(item.basePrice) : '-'}</td>
      <td class="num" style="color:#CC2222;font-weight:600">${item.promoPrice ? fmt(item.promoPrice) : '-'}</td>
      <td class="center" style="font-size:11px">${item.promoName || '-'}</td>
    </tr>`;
  }).join('');

  if (!spotOrderData.length) {
    body.innerHTML = '<tr><td colspan="13"><div class="empty-state"><p>스팟 발주 항목이 없습니다</p><p style="font-size:12px;color:#9BA3B2">+ 추가로 수동 등록하세요</p></div></td></tr>';
  }
  document.getElementById('spot-order-count').textContent = `${spotOrderData.length}건`;
  initColumnResize('order-spot-table');
  initStickyHeader('order-spot-table');
}

function saveSpotOrders() { localStorage.setItem('mw_spot_orders', JSON.stringify(spotOrderData)); }

function addSpotRow() {
  const model = prompt('모델명을 입력하세요');
  if (!model) return;
  const promoNo = prompt('프로모션 번호') || '';
  const promoName = prompt('프로모션명') || '';
  const description = prompt('제품설명') || '';
  const basePrice = parseInt(prompt('기본단가') || '0') || 0;
  const promoPrice = parseInt(prompt('프로모션단가') || '0') || 0;
  const code = findCodeByModel(model, '');

  spotOrderData.push({ promoNo, promoName, discountRate:'', orderNum:'', ttiNum:'', model, description, baseQty:1, orderQty:0, basePrice, promoPrice, code, memo:'' });
  saveSpotOrders();
  renderSpotOrder();
  toast('스팟 발주 추가 완료');
}

function removeSpotRow(idx) {
  spotOrderData.splice(idx, 1);
  saveSpotOrders();
  renderSpotOrder();
}

function resetSpotQty() {
  spotOrderData.forEach(item => item.orderQty = 0);
  saveSpotOrders();
  renderSpotOrder();
  toast('수량 초기화 완료');
}

function clearSpotAll() {
  if (!confirm('스팟 발주를 전체 초기화하시겠습니까?')) return;
  spotOrderData = [];
  saveSpotOrders();
  renderSpotOrder();
  toast('전체 초기화 완료');
}

// ======================== 프로모션 발주서 ========================
function renderPromoOrderSheet() {
  const now = new Date();
  document.getElementById('po-sheet-date').textContent = now.toLocaleDateString('ko') + ' ' + now.toLocaleTimeString('ko', {hour:'2-digit',minute:'2-digit'});

  const body = document.getElementById('po-sheet-body');
  let promoSupplyTotal = 0, spotSupplyTotal = 0;
  let promoCostTotal = 0, spotCostTotal = 0;
  let rows = '';

  // 프로모션 발주
  poOrderData.filter(item => item.orderQty > 0).forEach(item => {
    const code = item.code || findCodeByModel(item.model, item.ttiNum);
    const supplyAmt = (item.promoPrice || 0) * item.orderQty;
    promoSupplyTotal += supplyAmt;
    const prod = code ? findProduct(code) : null;
    const pdc = prod ? (prod.category || '') : '';
    const unitCost = Math.round(calcOrderCost(item.promoPrice || 0, pdc));
    const costAmt = unitCost * item.orderQty;
    promoCostTotal += costAmt;
    rows += `<tr>
      <td class="center">${code || '-'}</td>
      <td class="center" style="color:#185FA5;font-weight:600">${item.promoNo || '-'}</td>
      <td class="center" style="font-size:11px">${item.promoName || '-'}</td>
      <td class="center" style="font-weight:500">${item.model || '-'}</td>
      <td class="center" style="font-size:11px">${item.description || '-'}</td>
      <td class="center">${item.orderQty}</td>
      <td class="num">${fmt(item.promoPrice || 0)}</td>
      <td class="num" style="color:#1D9E75">${fmt(unitCost)}</td>
      <td class="num" style="color:#1D9E75;font-weight:700">${fmt(costAmt)}</td>
      <td class="center" style="font-size:11px">${item.promoName || '-'}</td>
    </tr>`;
  });

  // 스팟 발주
  spotOrderData.filter(item => item.orderQty > 0).forEach(item => {
    const code = item.code || findCodeByModel(item.model, item.ttiNum);
    const supplyAmt = (item.promoPrice || 0) * item.orderQty;
    spotSupplyTotal += supplyAmt;
    const prod = code ? findProduct(code) : null;
    const pdc = prod ? (prod.category || '') : '';
    const unitCost = Math.round(calcOrderCost(item.promoPrice || 0, pdc));
    const costAmt = unitCost * item.orderQty;
    spotCostTotal += costAmt;
    rows += `<tr style="background:#FFF8F0">
      <td class="center">${code || '-'}</td>
      <td class="center" style="color:#EF9F27;font-weight:600">${item.promoNo || '스팟'}</td>
      <td class="center" style="font-size:11px">${item.promoName || '스팟'}</td>
      <td class="center" style="font-weight:500">${item.model || '-'}</td>
      <td class="center" style="font-size:11px">${item.description || '-'}</td>
      <td class="center">${item.orderQty}</td>
      <td class="num">${fmt(item.promoPrice || 0)}</td>
      <td class="num" style="color:#1D9E75">${fmt(unitCost)}</td>
      <td class="num" style="color:#1D9E75;font-weight:700">${fmt(costAmt)}</td>
      <td class="center" style="font-size:11px">${item.promoName || '스팟'}</td>
    </tr>`;
  });

  if (!rows) {
    rows = '<tr><td colspan="10"><div class="empty-state"><p>발주 수량이 입력된 프로모션이 없습니다</p></div></td></tr>';
  }
  body.innerHTML = rows;
  document.getElementById('po-sheet-promo-total').textContent = fmt(promoSupplyTotal);
  document.getElementById('po-sheet-spot-total').textContent = fmt(spotSupplyTotal);
  document.getElementById('po-sheet-grand-total').textContent = fmt(promoSupplyTotal + spotSupplyTotal);
  document.getElementById('po-sheet-promo-cost-total').textContent = fmt(promoCostTotal);
  document.getElementById('po-sheet-spot-cost-total').textContent = fmt(spotCostTotal);
  document.getElementById('po-sheet-grand-cost-total').textContent = fmt(promoCostTotal + spotCostTotal);
}

function exportPromoOrder() {
  // 확정 상태면 최신 이력에서 엑셀 생성
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentPo = poHistory.filter(r => (now - new Date(r.date).getTime()) < weekMs);
  if (recentPo.length > 0) {
    const latest = recentPo.sort((a, b) => b.id - a.id)[0];
    if (!window.XLSX) { toast('SheetJS 라이브러리 로딩 중입니다'); return; }
    try {
      const data = [['내부코드', '수량', '매입원가', '적요']];
      latest.items.forEach(it => {
        data.push([it.code || '', it.qty, it.costTotal, it.promoName || '']);
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{wch:12},{wch:8},{wch:14},{wch:40}];
      XLSX.utils.book_append_sheet(wb, ws, '프로모션발주서');
      XLSX.writeFile(wb, '프로모션_발주서_' + new Date().toISOString().slice(0, 10) + '.xlsx');
      toast('프로모션 발주서 다운로드 완료 (' + latest.totalItems + '건)');
    } catch (err) {
      toast('다운로드 실패: ' + err.message);
    }
    return;
  }
  if (!window.XLSX) { toast('SheetJS 로딩 중'); return; }
  try {
    const data = [['내부코드', '수량', '프로모션단가', '공급합계', '매입원가(개당)', '매입원가합계', '적요']];
    let totalItems = 0;

    poOrderData.forEach(item => {
      if (item.orderQty > 0) {
        const code = item.code || findCodeByModel(item.model, item.ttiNum);
        const supplyAmt = (item.promoPrice || 0) * item.orderQty;
        const prod = code ? findProduct(code) : null;
        const pdc = prod ? (prod.category || '') : '';
        const unitCost = Math.round(calcOrderCost(item.promoPrice || 0, pdc));
        data.push([code || item.orderNum || '', item.orderQty, item.promoPrice || 0, supplyAmt, unitCost, unitCost * item.orderQty, item.promoName || '']);
        totalItems++;
      }
    });

    spotOrderData.forEach(item => {
      if (item.orderQty > 0) {
        const code = item.code || findCodeByModel(item.model, item.ttiNum);
        const supplyAmt = (item.promoPrice || 0) * item.orderQty;
        const prod = code ? findProduct(code) : null;
        const pdc = prod ? (prod.category || '') : '';
        const unitCost = Math.round(calcOrderCost(item.promoPrice || 0, pdc));
        data.push([code || '', item.orderQty, item.promoPrice || 0, supplyAmt, unitCost, unitCost * item.orderQty, item.promoName || '스팟']);
        totalItems++;
      }
    });

    if (totalItems === 0) { toast('발주 수량이 입력된 프로모션이 없습니다'); return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, '프로모션발주서');
    XLSX.writeFile(wb, `프로모션_발주서_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast(`프로모션 발주서 다운로드 완료 (${totalItems}건)`);
  } catch (err) {
    toast('다운로드 실패: ' + err.message);
  }
}

// ======================== TAB 3: ONLINE SALES ========================
let salesItems = loadObj('mw_sales_items', []);

function addSalesRow() {
  salesItems.push({ code: '', naverPrice: 0, openPrice: 0 });
  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems)); autoSyncToSupabase('mw_sales_items');
  renderSales();
}

function clearSales() {
  if (!confirm('온라인 판매 항목을 모두 삭제하시겠습니까?')) return;
  salesItems = [];
  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems)); autoSyncToSupabase('mw_sales_items');
  renderSales();
}

function onSalesCodeChange(idx, val) {
  salesItems[idx].code = val;
  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems)); autoSyncToSupabase('mw_sales_items');
  renderSales();
}

function onSalesPriceChange(idx, field, val) {
  salesItems[idx][field] = parseInt(val) || 0;
  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems)); autoSyncToSupabase('mw_sales_items');
  calcSalesRow(idx);
}

function removeSalesRow(idx) {
  salesItems.splice(idx, 1);
  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems)); autoSyncToSupabase('mw_sales_items');
  renderSales();
}

function calcSalesProfit(sellPrice, feeRate, cost) {
  const vat = DB.settings.vat || 0.1;
  const fee = feeRate;
  // 판매원가 = (판매가 * (1 - 수수료율)) / (1 + 부가세율)
  const revenue = (sellPrice * (1 - fee)) / (1 + vat);
  const profit = revenue - cost;
  const margin = sellPrice > 0 ? profit / sellPrice : 0;
  return { revenue, profit, margin };
}

// ======================== 판매 서브탭 전환 ========================
function switchSalesSub(sub) {
  document.getElementById('sales-sub-manage').style.display = sub === 'manage' ? '' : 'none';
  document.getElementById('sales-sub-calc').style.display = sub === 'calc' ? '' : 'none';
  var tabs = document.querySelectorAll('#sales-sub-tabs .sub-tab');
  tabs[0].classList.toggle('active', sub === 'manage');
  tabs[1].classList.toggle('active', sub === 'calc');
  if (sub === 'manage') renderOnlineSales();
  if (sub === 'calc') renderFeeCalc();
}

// ======================== 온라인판매관리 V2 ========================
var OS_KEY = 'mw_online_sales';
var OS_MONTH_KEY = 'mw_online_sales_month';
var OS_ARCHIVE_KEY = 'mw_online_sales_archive';
var onlineSalesData = loadObj(OS_KEY, []);
var onlineSalesMonth = loadObj(OS_MONTH_KEY, null);
var onlineSalesArchive = loadObj(OS_ARCHIVE_KEY, {});
var osPromoFilter = 'all';

(function() {
  var now = new Date();
  var curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  if (!onlineSalesMonth) {
    onlineSalesMonth = curMonth;
    localStorage.setItem(OS_MONTH_KEY, JSON.stringify(onlineSalesMonth));
  }
})();

function saveOnlineSales() { localStorage.setItem(OS_KEY, JSON.stringify(onlineSalesData)); }
function todayStr() { var d = new Date(); return d.getFullYear() + '.' + (d.getMonth()+1) + '.' + d.getDate(); }

function buildOsMonthSelect() {
  var sel = document.getElementById('os-month-select');
  if (!sel) return;
  var now = new Date();
  var curMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  var options = '<option value="' + curMonth + '">' + curMonth.replace('-','년 ') + '월 (현재)</option>';
  Object.keys(onlineSalesArchive).sort().reverse().forEach(function(m) {
    options += '<option value="' + m + '">' + m.replace('-','년 ') + '월</option>';
  });
  sel.innerHTML = options;
  sel.value = onlineSalesMonth;
}

function loadOnlineSalesMonth(month) {
  onlineSalesMonth = month;
  localStorage.setItem(OS_MONTH_KEY, JSON.stringify(onlineSalesMonth));
  osPromoFilter = 'all';
  renderOnlineSales();
}

function isCurrentMonth() {
  var now = new Date();
  return onlineSalesMonth === now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
}

function getOsData() { return isCurrentMonth() ? onlineSalesData : (onlineSalesArchive[onlineSalesMonth] || []); }

function buildOsPromoFilters() {
  var container = document.getElementById('os-promo-filters');
  if (!container) return;
  var data = getOsData();
  var promos = [];
  data.forEach(function(item) { if (item.promoName && promos.indexOf(item.promoName)===-1) promos.push(item.promoName); });
  var html = '<span class="os-filter-pill ' + (osPromoFilter==='all'?'active':'') + '" onclick="setOsPromoFilter(\'all\')">전체</span>';
  promos.forEach(function(p) {
    var cls = osPromoFilter===p ? 'active' : 'pill-amber';
    var short = p.length>20 ? p.substring(0,20)+'...' : p;
    html += '<span class="os-filter-pill ' + cls + '" onclick="setOsPromoFilter(\'' + p.replace(/'/g,"\\'") + '\')" title="' + p + '">' + short + '</span>';
  });
  container.innerHTML = html;
  var hint = document.getElementById('os-archive-hint');
  if (hint) { var cnt = Object.keys(onlineSalesArchive).length; hint.textContent = cnt ? '아카이브: ' + cnt + '개월' : ''; }
}

function setOsPromoFilter(f) { osPromoFilter = f; renderOnlineSales(); }

function calcOsProfit(sellPrice, cost, feeRate) {
  if (!sellPrice || !cost) return {profit:0, rate:0};
  var profit = Math.round(sellPrice - sellPrice/11 - sellPrice*feeRate - cost);
  return {profit:profit, rate:(profit/sellPrice)*100};
}

function osStockHtml(stock) {
  var n = parseInt(stock)||0;
  if (n>=3) return '<div class="os-stock-cell"><span class="os-stock-ok">'+n+'</span></div>';
  if (n>=1) return '<div class="os-stock-cell"><span class="os-stock-warn">'+n+'</span><span class="os-stock-alert os-stock-alert-warn">가격확인</span></div>';
  return '<div class="os-stock-cell"><span class="os-stock-danger">0</span><span class="os-stock-alert os-stock-alert-danger">재발주</span></div>';
}

function renderOnlineSales() {
  buildOsMonthSelect();
  buildOsPromoFilters();
  var s = DB.settings;
  var naverFee = s.naverFee || 0.0663;
  var openFee = s.openElecFee || 0.13;
  var data = getOsData();
  var filtered = osPromoFilter==='all' ? data : data.filter(function(item){return item.promoName===osPromoFilter;});
  var editable = isCurrentMonth();
  var body = document.getElementById('os-body');
  if (!body) return;
  var html = '';
  filtered.forEach(function(item) {
    var ri = data.indexOf(item);
    var stockNum = findStock(item.code);
    if (stockNum==null) stockNum = item.stock||0;
    var osProd = item.code ? findProduct(item.code) : null;
    var osPdc = osProd ? (osProd.category || '') : '';
    var costP = item.promoCost ? Math.round(calcOrderCost(item.promoCost, osPdc)) : 0;
    var naver = calcOsProfit(item.naverPrice||0, costP||0, naverFee);
    var open = calcOsProfit(item.openPrice||0, costP||0, openFee);
    var pCls = function(v){return v>=0?'fc-positive':'fc-negative';};

    var pSign = function(v){return v>=0?'+':'';};
    html += '<tr'+(naver.profit<0||open.profit<0?' style="background:#FFF5F5"':'')+'>';
    html += '<td><span class="os-date">'+(item.date||'-')+'</span></td>';
    html += '<td>'+(item.code||'-')+'</td>';
    if (editable) {
      html += '<td><input class="os-input os-input-text" type="search" name="search_naf_os_model" autocomplete="nope" data-form-type="other" data-lpignore="true" value="'+(item.model||'')+'" placeholder="코드, 모델명 검색..." oninput="showAC(this, function(code){ onOsProductSelect('+ri+',code); })" onfocus="if(this.value) showAC(this, function(code){ onOsProductSelect('+ri+',code); })" onchange="updateOsField('+ri+',\'model\',this.value)" style="font-weight:500;min-width:160px"></td>';
    } else {
      html += '<td style="text-align:left;font-weight:500">'+(item.model||'-')+'</td>';
    }
    html += '<td class="center">'+osStockHtml(stockNum)+'</td>';
    if (editable) {
      html += '<td><input class="os-input os-input-text os-vendor-input" value="'+(item.vendor||'')+'" onchange="updateOsField('+ri+',\'vendor\',this.value)"></td>';
      html += '<td><input class="os-input os-input-num" value="'+(item.price?item.price.toLocaleString():'')+'" onchange="updateOsNumField('+ri+',\'price\',this.value)" style="width:80px"></td>';
    } else {
      html += '<td>'+(item.vendor||'-')+'</td>';
      html += '<td class="num">'+(item.price?item.price.toLocaleString():'-')+'</td>';
    }
    html += '<td class="num" style="font-weight:600;color:#185FA5">'+(costP?costP.toLocaleString():'-')+'</td>';
    if (editable) {
      html += '<td><input class="os-input os-input-num" value="'+(item.naverPrice?item.naverPrice.toLocaleString():'')+'" onchange="updateOsNumField('+ri+',\'naverPrice\',this.value)" style="width:80px"></td>';
    } else { html += '<td class="num">'+(item.naverPrice?item.naverPrice.toLocaleString():'-')+'</td>'; }
    html += '<td class="center">';
    if (item.naverPrice && costP) { html += '<div style="font-weight:600" class="'+pCls(naver.profit)+'">'+pSign(naver.profit)+naver.profit.toLocaleString()+'</div><div style="font-size:10px;color:#CC2222">'+naver.rate.toFixed(1)+'%</div>'; }
    else { html += '-'; }
    html += '</td>';
    if (editable) {
      html += '<td><input class="os-input os-input-num" value="'+(item.openPrice?item.openPrice.toLocaleString():'')+'" onchange="updateOsNumField('+ri+',\'openPrice\',this.value)" style="width:80px"></td>';
    } else { html += '<td class="num">'+(item.openPrice?item.openPrice.toLocaleString():'-')+'</td>'; }
    html += '<td class="center">';
    if (item.openPrice && costP) { html += '<div style="font-weight:600" class="'+pCls(open.profit)+'">'+pSign(open.profit)+open.profit.toLocaleString()+'</div><div style="font-size:10px;color:#CC2222">'+open.rate.toFixed(1)+'%</div>'; }
    else { html += '-'; }
    html += '</td>';
    html += '<td style="text-align:left"><span class="os-promo-badge">'+(item.promoName||'-')+'</span></td>';
    if (editable) { html += '<td class="center" style="white-space:nowrap"><button class="btn-edit" onclick="insertOsRowAfter('+ri+')" style="padding:2px 8px;font-size:11px;margin-right:3px">추가</button><button class="btn-danger btn-sm" onclick="removeOsRow('+ri+')" style="padding:2px 8px;font-size:11px">삭제</button></td>'; }
    else { html += '<td></td>'; }
    html += '</tr>';
  });
  if (!filtered.length) html = '<tr><td colspan="13"><div class="empty-state"><p>제품을 추가하세요</p></div></td></tr>';
  body.innerHTML = html;
  renderOsSummary(filtered, naverFee, openFee);
  initColumnResize('os-table');
  initStickyHeader('os-table');
}

function renderOsSummary(data, naverFee, openFee) {
  var c = document.getElementById('os-summary');
  if (!c) return;
  var promos=[],nRates=[],oRates=[],warn=0;
  data.forEach(function(item){
    if(item.promoName&&promos.indexOf(item.promoName)===-1)promos.push(item.promoName);
    var sProd=item.code?findProduct(item.code):null;var sCat=sProd?(sProd.category||''):'';var sCostP=item.promoCost?Math.round(calcOrderCost(item.promoCost,sCat)):0;
    if(item.naverPrice&&sCostP){var n=calcOsProfit(item.naverPrice,sCostP,naverFee);nRates.push(n.rate);}
    if(item.openPrice&&sCostP){var o=calcOsProfit(item.openPrice,sCostP,openFee);oRates.push(o.rate);}
    var sn=findStock(item.code);if(sn==null)sn=item.stock||0;if(sn<=2)warn++;
  });
  var avgN=nRates.length?(nRates.reduce(function(a,b){return a+b},0)/nRates.length):0;
  var avgO=oRates.length?(oRates.reduce(function(a,b){return a+b},0)/oRates.length):0;
  c.innerHTML='<div class="os-sum-card"><div class="os-sum-label">총 제품수</div><div class="os-sum-val">'+data.length+'건</div></div>'+
    '<div class="os-sum-card"><div class="os-sum-label">프로모션</div><div class="os-sum-val">'+promos.length+'개</div></div>'+
    '<div class="os-sum-card"><div class="os-sum-label">스토어팜 평균</div><div class="os-sum-val" style="color:'+(avgN>=0?'#1D9E75':'#CC2222')+'">'+avgN.toFixed(1)+'%</div></div>'+
    '<div class="os-sum-card"><div class="os-sum-label">오픈마켓 평균</div><div class="os-sum-val" style="color:'+(avgO>=0?'#1D9E75':'#CC2222')+'">'+avgO.toFixed(1)+'%</div></div>'+
    '<div class="os-sum-card"><div class="os-sum-label">재고 경고</div><div class="os-sum-val" style="color:#CC2222">'+warn+'건</div></div>';
}

function onOsProductSelect(idx, code) {
  var p = DB.products.find(function(pr) { return String(pr.code) === String(code); });
  if (!p) return;
  var ec = getEffectiveCost(code);
  var stock = findStock(code);
  onlineSalesData[idx].code = String(code);
  onlineSalesData[idx].model = p.model || '';
  onlineSalesData[idx].stock = stock != null ? stock : 0;
  onlineSalesData[idx].price = p.supplyPrice || 0;
  onlineSalesData[idx].promoCost = ec.cost || 0;
  if (ec.isPromo && ec.promoName) onlineSalesData[idx].promoName = ec.promoName;
  if (!onlineSalesData[idx].date) onlineSalesData[idx].date = todayStr();
  saveOnlineSales();
  renderOnlineSales();
}

function updateOsField(idx,field,val){onlineSalesData[idx][field]=val;saveOnlineSales();renderOnlineSales();}
function updateOsNumField(idx,field,val){onlineSalesData[idx][field]=parseInt(String(val).replace(/,/g,''))||0;saveOnlineSales();renderOnlineSales();}

function addOnlineSalesRow(){
  onlineSalesData.push({date:todayStr(),code:'',model:'',stock:0,vendor:'',price:0,promoCost:0,naverPrice:0,openPrice:0,promoName:''});
  saveOnlineSales();renderOnlineSales();
}

function removeOsRow(idx){
  if(!confirm('이 항목을 삭제하시겠습니까?'))return;
  onlineSalesData.splice(idx,1);saveOnlineSales();renderOnlineSales();
}

function insertOsRowAfter(idx) {
  var newRow = {date:todayStr(),code:'',model:'',stock:0,vendor:'',price:0,promoCost:0,naverPrice:0,openPrice:0,promoName:''};
  onlineSalesData.splice(idx+1,0,newRow);
  saveOnlineSales();renderOnlineSales();
}

function importOnlineSalesCumul() {
  var added=0, skipped=0, foundCodes={};

  // 1차: poOrderData (발주 확정 전)
  poOrderData.forEach(function(item) {
    var hasCumul = (String(item.promoNo||'').indexOf('누적')>=0) || (String(item.promoName||'').indexOf('누적')>=0);
    if (!hasCumul) return;
    var code = String(item.code||'');
    if (!code || code==='-') return;
    if (foundCodes[code]) return;
    foundCodes[code] = true;
    if (onlineSalesData.some(function(d){return String(d.code)===code})) { skipped++; return; }
    var p = DB.products.find(function(pr){return String(pr.code)===code});
    var stock = findStock(code);
    var ec = getEffectiveCost(code);
    onlineSalesData.push({
      date:todayStr(), code:code, model:item.model||(p?p.model:''), stock:stock!=null?stock:0,
      vendor:'', price:p?(p.supplyPrice||0):(item.basePrice||0), promoCost:ec.cost||item.promoPrice||0,
      naverPrice:0, openPrice:0, promoName:item.promoName||''
    });
    added++;
  });

  // 2차: DB.promotions (발주 확정 후)
  DB.promotions.forEach(function(promo) {
    var hasCumul = (String(promo.promoCode||'').indexOf('누적')>=0) || (String(promo.promoName||'').indexOf('누적')>=0);
    if (!hasCumul) return;
    var code = String(promo.code);
    if (foundCodes[code]) return;
    foundCodes[code] = true;
    if (onlineSalesData.some(function(d){return String(d.code)===code})) { skipped++; return; }
    var p = DB.products.find(function(pr){return String(pr.code)===code});
    var stock = findStock(code);
    onlineSalesData.push({
      date:todayStr(), code:code, model:promo.model||(p?p.model:''), stock:stock!=null?stock:0,
      vendor:'', price:p?(p.supplyPrice||0):0, promoCost:promo.cost||promo.promoPrice||0,
      naverPrice:0, openPrice:0, promoName:promo.promoName||''
    });
    added++;
  });

  if (!added && !skipped) { toast('누적 프로모션 제품이 없습니다. 발주 > 프로모션 > 프로모션 발주에 먼저 등록하세요.'); return; }
  saveOnlineSales(); renderOnlineSales();
  toast(added+'건 누적P 불러오기 완료'+(skipped>0?' ('+skipped+'건 중복 제외)':''));
}

function importOnlineSalesProducts(){
  var input=prompt('불러올 제품 코드 (쉼표 구분, 예: 23184,23185,23736)');
  if(!input)return;
  var codes=input.split(',').map(function(c){return c.trim()}).filter(function(c){return c});
  var added=0;
  codes.forEach(function(code){
    if(onlineSalesData.some(function(d){return String(d.code)===String(code)}))return;
    var p=DB.products.find(function(pr){return String(pr.code)===String(code)});
    if(!p)return;
    var ec=getEffectiveCost(code);
    var stock=findStock(code);
    onlineSalesData.push({date:todayStr(),code:String(code),model:p.model||'',stock:stock!=null?stock:0,vendor:'',price:p.supplyPrice||0,promoCost:ec.cost||0,naverPrice:0,openPrice:0,promoName:ec.isPromo?ec.promoName:''});
    added++;
  });
  saveOnlineSales();renderOnlineSales();
  toast(added+'건 추가'+(codes.length-added>0?' ('+(codes.length-added)+'건 중복/미존재)':''));
}

function exportOnlineSalesExcel(){
  if(typeof XLSX==='undefined'){toast('XLSX 라이브러리 필요');return;}
  var s=DB.settings,naverFee=s.naverFee||0.0663,openFee=s.openElecFee||0.13,data=getOsData();
  var rows=[['날짜','코드','모델','재고','업체명','판매가','원가P','스토어팜판매가','스토어팜이익','스토어팜이익률','오픈마켓판매가','오픈마켓이익','오픈마켓이익률','프로모션']];
  data.forEach(function(item){
    var xProd=item.code?findProduct(item.code):null;var xCat=xProd?(xProd.category||''):'';var xCostP=item.promoCost?Math.round(calcOrderCost(item.promoCost,xCat)):0;
    var naver=calcOsProfit(item.naverPrice||0,xCostP||0,naverFee);
    var open=calcOsProfit(item.openPrice||0,xCostP||0,openFee);
    rows.push([item.date,item.code,item.model,item.stock,item.vendor,item.price,xCostP,item.naverPrice,naver.profit,Math.round(naver.rate*10)/10,item.openPrice,open.profit,Math.round(open.rate*10)/10,item.promoName]);
  });
  var ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'온라인판매관리');
  XLSX.writeFile(wb,'온라인판매관리_'+onlineSalesMonth+'.xlsx');
}

function archiveOnlineSales(){
  if(!onlineSalesData.length){toast('저장할 데이터가 없습니다');return;}
  if(!confirm('현재 월('+onlineSalesMonth+') 데이터를 아카이브하고 새 월을 시작하시겠습니까?'))return;
  onlineSalesArchive[onlineSalesMonth]=JSON.parse(JSON.stringify(onlineSalesData));
  localStorage.setItem(OS_ARCHIVE_KEY,JSON.stringify(onlineSalesArchive));
  var now=new Date(),nextMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  if(nextMonth===onlineSalesMonth){var nm=new Date(now.getFullYear(),now.getMonth()+1,1);nextMonth=nm.getFullYear()+'-'+String(nm.getMonth()+1).padStart(2,'0');}
  onlineSalesData=[];onlineSalesMonth=nextMonth;
  saveOnlineSales();localStorage.setItem(OS_MONTH_KEY,JSON.stringify(onlineSalesMonth));
  renderOnlineSales();toast('아카이브 완료! 새 월('+nextMonth+') 시작');
}

// ======================== 수수료 계산기 ========================
var feeCalcData = loadObj('mw_fee_calc', []);

function saveFeeCalc() {
  localStorage.setItem('mw_fee_calc', JSON.stringify(feeCalcData));
}

function renderFeeCalc() {
  var s = DB.settings;
  var naverFee = s.naverFee || 0.0663;
  var coupangMpFee = s.coupangMpFee ? s.coupangMpFee / 100 : 0.108;
  var coupangRgFee = s.coupangRgFee ? s.coupangRgFee / 100 : 0.108;
  var coupangLogi = s.coupangLogi || 2800;
  document.getElementById('fc-badge-naver').textContent = '스토어팜: ' + (naverFee * 100).toFixed(2) + '%';
  document.getElementById('fc-badge-coupang-mp').textContent = '쿠팡(마켓): ' + (coupangMpFee * 100).toFixed(1) + '%';
  document.getElementById('fc-badge-coupang-rg').textContent = '쿠팡(로켓그로스): ' + (coupangRgFee * 100).toFixed(1) + '% + 물류 ' + coupangLogi.toLocaleString() + '원';

  var body = document.getElementById('fee-calc-body');
  var html = '';

  feeCalcData.forEach(function(item, i) {
    var cost = parseInt(String(item.cost || '').replace(/,/g, '')) || 0;
    var price = parseInt(String(item.price || '').replace(/,/g, '')) || 0;
    var naverResult = calcFeeProfit(price, cost, naverFee, 0);
    var coupangMpResult = calcFeeProfit(price, cost, coupangMpFee, 0);
    var coupangRgResult = calcFeeProfit(price, cost, coupangRgFee, coupangLogi);

    html += '<tr>';
    html += '<td><input value="' + (item.name || '').replace(/"/g,'&quot;') + '" placeholder="제품명/코드 검색" oninput="updateFeeCalcField(' + i + ',\'name\',this.value); showFeeCalcAC(this,' + i + ')" onfocus="if(this.value) showFeeCalcAC(this,' + i + ')" autocomplete="nope" data-form-type="other" data-lpignore="true" style="text-align:left"></td>';
    html += '<td><input value="' + (cost ? cost.toLocaleString() : '') + '" placeholder="매입가" oninput="updateFeeCalcField(' + i + ',\'cost\',this.value)"></td>';
    html += '<td><input value="' + (price ? price.toLocaleString() : '') + '" placeholder="판매가" oninput="updateFeeCalcField(' + i + ',\'price\',this.value)" style="font-weight:600"></td>';
    html += '<td class="fc-result">' + formatFeeResult(naverResult) + '</td>';
    html += '<td class="fc-result">' + formatFeeResult(coupangMpResult) + '</td>';
    html += '<td class="fc-result">' + formatFeeResult(coupangRgResult) + '</td>';
    html += '<td class="center"><button class="btn-danger btn-sm" onclick="removeFeeCalcRow(' + i + ')" style="padding:2px 8px;font-size:11px">삭제</button></td>';
    html += '</tr>';
  });

  html += '<tr style="background:#F4F6FA">';
  html += '<td><input placeholder="제품명/코드 검색" id="fc-new-name" oninput="showFeeCalcAC(this,-1)" onfocus="if(this.value) showFeeCalcAC(this,-1)" autocomplete="nope" data-form-type="other" data-lpignore="true" style="text-align:left"></td>';
  html += '<td><input placeholder="매입가" id="fc-new-cost"></td>';
  html += '<td><input placeholder="판매가" id="fc-new-price" onkeydown="if(event.key===\'Enter\')addFeeCalcFromInput()"></td>';
  html += '<td class="fc-result"><span class="fc-dash">-</span></td>';
  html += '<td class="fc-result"><span class="fc-dash">-</span></td>';
  html += '<td class="fc-result"><span class="fc-dash">-</span></td>';
  html += '<td></td>';
  html += '</tr>';

  body.innerHTML = html;
  initColumnResize('fee-calc-table');
  initStickyHeader('fee-calc-table');
}

function calcFeeProfit(price, cost, feeRate, logistics) {
  if (!price || !cost) return null;
  var vat = price / 11;
  var fee = price * feeRate;
  var profit = price - vat - fee - cost - (logistics || 0);
  var rate = (profit / price) * 100;
  return { profit: Math.round(profit), rate: rate };
}

function formatFeeResult(r) {
  if (!r) return '<span class="fc-dash">-</span>';
  var cls = r.profit >= 0 ? 'fc-positive' : 'fc-negative';
  var sign = r.profit >= 0 ? '+' : '';
  return '<div class="fc-amount ' + cls + '">' + sign + r.profit.toLocaleString() + '</div>'
       + '<div class="fc-rate ' + cls + '">' + r.rate.toFixed(2) + '%</div>';
}

function updateFeeCalcField(idx, field, val) {
  feeCalcData[idx][field] = val;
  saveFeeCalc();
  // name 입력 시 리렌더링하지 않음 (input 포커스 유지)
  if (field === 'name') return;
  // cost/price 변경 시 해당 행의 결과 셀만 갱신
  updateFeeCalcRow(idx);
}

function updateFeeCalcRow(idx) {
  var s = DB.settings;
  var naverFee = s.naverFee || 0.0663;
  var coupangMpFee = s.coupangMpFee ? s.coupangMpFee / 100 : 0.108;
  var coupangRgFee = s.coupangRgFee ? s.coupangRgFee / 100 : 0.108;
  var coupangLogi = s.coupangLogi || 2800;
  var item = feeCalcData[idx];
  var cost = parseInt(String(item.cost || '').replace(/,/g, '')) || 0;
  var price = parseInt(String(item.price || '').replace(/,/g, '')) || 0;
  var rows = document.getElementById('fee-calc-body').querySelectorAll('tr');
  if (!rows[idx]) return;
  var cells = rows[idx].querySelectorAll('.fc-result');
  if (cells.length >= 3) {
    cells[0].innerHTML = formatFeeResult(calcFeeProfit(price, cost, naverFee, 0));
    cells[1].innerHTML = formatFeeResult(calcFeeProfit(price, cost, coupangMpFee, 0));
    cells[2].innerHTML = formatFeeResult(calcFeeProfit(price, cost, coupangRgFee, coupangLogi));
  }
}

function addFeeCalcRow() {
  feeCalcData.push({ name: '', cost: '', price: '' });
  saveFeeCalc();
  renderFeeCalc();
}

function addFeeCalcFromInput() {
  var name = document.getElementById('fc-new-name').value.trim();
  var cost = document.getElementById('fc-new-cost').value.trim();
  var price = document.getElementById('fc-new-price').value.trim();
  if (!name && !cost && !price) return;
  feeCalcData.push({ name: name, cost: cost, price: price });
  saveFeeCalc();
  renderFeeCalc();
}

function removeFeeCalcRow(idx) {
  feeCalcData.splice(idx, 1);
  saveFeeCalc();
  renderFeeCalc();
}

// 수수료계산기 자동완성 (밀워키 + 일반제품 통합 검색)
function showFeeCalcAC(inputEl, rowIdx) {
  var val = inputEl.value.trim().toLowerCase();
  if (!val || val.length < 1) { hideAC(); return; }
  // 밀워키 검색
  var mwResults = DB.products.filter(function(p) {
    return String(p.code).includes(val) || String(p.model || '').toLowerCase().includes(val) || String(p.description || '').toLowerCase().includes(val);
  }).slice(0, 8).map(function(p) { return { code: p.code, model: p.model || '', desc: (p.description || '').slice(0, 30), cost: p.cost || p.supplyPrice || 0, price: p.priceA || p.priceNaver || 0, source: 'MW' }; });
  // 일반제품 검색
  var genResults = (typeof genProducts !== 'undefined' ? genProducts : []).filter(function(p) {
    return String(p.code || '').includes(val) || String(p.model || '').toLowerCase().includes(val) || String(p.description || '').toLowerCase().includes(val);
  }).slice(0, 7).map(function(p) { return { code: p.code, model: p.model || '', desc: (p.description || '').slice(0, 30), cost: p.cost || 0, price: p.priceNaver || p.priceA || 0, source: '일반' }; });
  var results = mwResults.concat(genResults).slice(0, 12);
  if (!results.length) { hideAC(); return; }

  acActive = { input: inputEl, callback: function(code) {
    var found = results.find(function(r) { return r.code === code; });
    if (!found) return;
    if (rowIdx >= 0) {
      // 기존 행 업데이트
      feeCalcData[rowIdx].name = (found.model || found.code) + ' ' + found.desc;
      feeCalcData[rowIdx].cost = String(found.cost);
      feeCalcData[rowIdx].price = String(found.price);
      saveFeeCalc();
      renderFeeCalc();
    } else {
      // 새 행 추가
      feeCalcData.push({ name: (found.model || found.code) + ' ' + found.desc, cost: String(found.cost), price: String(found.price) });
      saveFeeCalc();
      renderFeeCalc();
    }
  }};
  acEl.innerHTML = results.map(function(r) {
    return '<div class="ac-item" data-code="' + r.code + '">' +
      '<span class="ac-code">' + r.code + '</span>' +
      '<span class="ac-model">' + r.model + '</span>' +
      '<span class="ac-desc">' + r.desc + '</span>' +
      '<span class="ac-price">' + fmt(r.cost) + ' <span style="font-size:10px;color:#9BA3B2">' + r.source + '</span></span>' +
    '</div>';
  }).join('');
  var rect = inputEl.getBoundingClientRect();
  acEl.style.position = 'fixed';
  acEl.style.top = (rect.bottom + 2) + 'px';
  acEl.style.left = rect.left + 'px';
  acEl.classList.add('show');
}

function clearFeeCalc() {
  if (!feeCalcData.length) return;
  if (!confirm('수수료 계산기 데이터를 모두 삭제하시겠습니까?')) return;
  feeCalcData = [];
  saveFeeCalc();
  renderFeeCalc();
}

function renderSales() {
  const naverFee = DB.settings.naverFee || 0.0663;
  const openElecFee = DB.settings.openElecFee || 0.13;

  const body = document.getElementById('sales-body');
  body.innerHTML = salesItems.map((item, i) => {
    const p = findProduct(item.code);
    const stock = findStock(item.code);
    const ec = getEffectiveCost(item.code);
    const cost = ec.cost;
    const costLabel = ec.isPromo ? `<span class="badge badge-amber" title="${ec.promoName}">프로모션</span>` : (p ? '<span class="badge badge-gray">정상</span>' : '');

    const naver = calcSalesProfit(item.naverPrice || 0, naverFee, cost);
    const open = calcSalesProfit(item.openPrice || 0, openElecFee, cost);

    const profitClass = v => v > 0 ? 'profit-pos' : v < 0 ? 'profit-neg' : '';

    return `<tr>
      <td><button class="btn-danger btn-sm" onclick="removeSalesRow(${i})" style="padding:2px 6px">✕</button></td>
      <td><input value="${item.code}" 
        oninput="showAC(this, c => onSalesCodeChange(${i},c))"
        onchange="onSalesCodeChange(${i},this.value)"
        onfocus="if(this.value) showAC(this, c => onSalesCodeChange(${i},c))"
        type="search" name="search_naf_sales_code" autocomplete="nope" data-form-type="other" data-lpignore="true" placeholder="코드/모델 검색" style="width:120px"></td>
      <td style="font-weight:500;white-space:nowrap">${p ? p.model : '-'}</td>
      <td class="center">${stock != null ? stock : '-'}</td>
      <td class="num">${fmt(cost)} ${costLabel}</td>
      <td><input type="number" value="${item.naverPrice || ''}" onchange="onSalesPriceChange(${i},'naverPrice',this.value)" placeholder="판매가" style="width:100px"></td>
      <td class="num ${profitClass(naver.profit)}">${item.naverPrice ? fmt(naver.profit) : '-'}</td>
      <td class="num ${profitClass(naver.margin)}">${item.naverPrice ? pct(naver.margin) : '-'}</td>
      <td><input type="number" value="${item.openPrice || ''}" onchange="onSalesPriceChange(${i},'openPrice',this.value)" placeholder="판매가" style="width:100px"></td>
      <td class="num ${profitClass(open.profit)}">${item.openPrice ? fmt(open.profit) : '-'}</td>
      <td class="num ${profitClass(open.margin)}">${item.openPrice ? pct(open.margin) : '-'}</td>
    </tr>`;
  }).join('');

  if (!salesItems.length) {
    body.innerHTML = '<tr><td colspan="11"><div class="empty-state"><p>판매 항목을 추가하세요</p><button class="btn-action" onclick="addSalesRow()">+ 추가</button></div></td></tr>';
  }
  initColumnResize('sales-table');
  initStickyHeader('sales-table');
}

function calcAllSales() { renderSales(); }
function calcSalesRow(idx) { renderSales(); }

// ======================== TAB 4: PROMOTIONS ========================
function renderPromo() {
  const search = document.getElementById('promo-search').value.toLowerCase();
  let filtered = DB.promotions;
  if (search) {
    filtered = filtered.filter(p => {
      const s = `${p.promoName} ${p.model} ${p.code} ${p.promoCode}`.toLowerCase();
      return s.includes(search);
    });
  }

  const body = document.getElementById('promo-body');
  body.innerHTML = filtered.map((p, i) => {
    const realIdx = DB.promotions.indexOf(p);
    const promoPrice = p.promoPrice || 0;
    const costDisplay = fmt(p.cost);
    return `<tr>
    <td style="white-space:nowrap">
      <button class="btn-edit" onclick="editPromo(${realIdx})">수정</button>
      <button class="btn-danger btn-sm" onclick="deletePromo(${realIdx})" style="padding:2px 6px;font-size:11px">삭제</button>
    </td>
    <td>${p.promoName || '-'}</td>
    <td><span class="badge badge-blue">${p.promoCode || '-'}</span></td>
    <td style="font-weight:500">${p.model || '-'}</td>
    <td class="center">${p.orderNum || '-'}</td>
    <td class="center">${p.qty || 1}</td>
    <td class="num">${fmt(p.dealerPrice)}</td>
    <td class="num">${promoPrice === 0 ? '무상' : fmt(promoPrice)}</td>
    <td class="num" style="color:#1D9E75;font-weight:600">${costDisplay}</td>
    <td class="center">${p.discountDisplay || (p.discountRate ? pct(p.discountRate) : '-')}</td>
    <td>${p.period || '-'}</td>
  </tr>`;
  }).join('');

  document.getElementById('promo-count').textContent = `${filtered.length}건`;
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="11"><div class="empty-state"><p>프로모션 데이터가 없습니다</p><button class="btn-action" onclick="showPromoAddModal()">+ 추가</button></div></td></tr>';
  }

  initColumnResize('promo-table');
}

function renderRebateTable() {
  const body = document.getElementById('rebate-body');
  body.innerHTML = DB.rebate.map(r => `<tr>
    <td>${fmtN(r.min)}원 이상</td>
    <td>${fmtN(r.min)}원</td>
    <td class="center" style="font-weight:600">${pct(r.rate)}</td>
    <td class="num">-</td>
  </tr>`).join('');
}

function calcRebate(el) {
  // Format input
  const raw = el.value.replace(/[^0-9]/g, '');
  el.value = raw ? parseInt(raw).toLocaleString() : '';
  const amount = parseInt(raw) || 0;

  // Find applicable tier
  let tier = null;
  for (let i = DB.rebate.length - 1; i >= 0; i--) {
    if (amount >= DB.rebate[i].min) { tier = DB.rebate[i]; break; }
  }

  const result = document.getElementById('rebate-result');
  if (tier) {
    const rebateAmount = amount * tier.rate;
    result.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">적용 요율</div><div class="kpi-value">${pct(tier.rate)}</div></div>
      <div class="kpi-card"><div class="kpi-label">리베이트 금액</div><div class="kpi-value">${fmt(rebateAmount)}</div><div class="kpi-sub">매출 ${fmtN(amount)}원 기준</div></div>
    `;
  } else {
    result.innerHTML = `<div class="kpi-card-light"><div class="kpi-label">적용 구간</div><div class="kpi-value">해당 없음</div><div class="kpi-sub" style="color:#5A6070">최소 ${fmtN(DB.rebate[0]?.min || 0)}원 이상</div></div>`;
  }

  // Highlight applicable tier
  const tbody = document.getElementById('rebate-body');
  tbody.innerHTML = DB.rebate.map(r => {
    const active = tier && r.min === tier.min;
    const rebAmt = amount >= r.min ? amount * r.rate : 0;
    return `<tr style="${active ? 'background:#E6F1FB;font-weight:600' : ''}">
      <td>${fmtN(r.min)}원 이상</td>
      <td>${fmtN(r.min)}원</td>
      <td class="center" style="font-weight:600">${pct(r.rate)}</td>
      <td class="num">${active ? fmt(rebAmt) : '-'}</td>
    </tr>`;
  }).join('');
}

// ======================== TEMPLATE DOWNLOAD ========================
function downloadTemplate() {
  if (!window.XLSX) { toast('SheetJS 라이브러리 로딩 중...'); return; }
  const wb = XLSX.utils.book_new();

  const priceHeaders = [
    [null, '코드', '관리코드', '대분류', '제품군', '제품구성', '프로모션No.', '제품번호', '모델명', '공급가', '원가', '원가P', 'A(도매)', '소매', '스토어팜', '오픈마켓', '재고', '본사가용', '입고날짜'],
    [null, '', '', '', '', '', '', '', '', '', '← 자동계산', '← 자동계산', '← 자동계산', '← 자동계산', '← 자동계산', '← 자동계산', '', '적정/임박/소진', '← 메모용'],
    [null, 21815, '', '파워툴', '12V FUEL', '드릴 드라이버', 1093, 1093, 'M12 FDD2-0X / 12V FUEL 드릴 드라이버(GEN3) 베어툴', 139000, '', '', '', '', '', '', 5, '적정', '4월 중순 입고예정'],
    [null, 21817, '', '파워툴', '12V FUEL', '해머드릴 드라이버', 1126, 18622019, 'M12 FPD2-0X / 12V FUEL 해머드릴 드라이버(GEN3) 베어툴', 153000, '', '', '', '', '', '', 3, '소진', '']
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(priceHeaders);
  ws1['!cols'] = [{wch:2},{wch:10},{wch:14},{wch:10},{wch:15},{wch:15},{wch:8},{wch:12},{wch:25},{wch:40},{wch:12},{wch:8},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:8},{wch:10},{wch:15}];
  XLSX.utils.book_append_sheet(wb, ws1, '전체가격표');

  XLSX.writeFile(wb, '밀워키_입력양식_' + new Date().toISOString().slice(0,10) + '.xlsx');
  toast('입력 양식 다운로드 완료');
}

// ======================== PRODUCT CRUD ========================

// 제품등록및수정 탭 팝업 열기
function showProductManageModal() {
  switchPmTab('import');
  document.getElementById('import-modal').classList.add('show');
  resetImportFile();
  document.getElementById('import-replace-section').style.display = 'none';
  document.getElementById('import-replace-arrow').style.transform = 'rotate(0deg)';
  var agreeEl = document.getElementById('import-replace-agree');
  if (agreeEl) agreeEl.checked = false;
  updateReplaceBtn();
  // 드래그 가능
  var _im = document.querySelector('#import-modal > .modal');
  if (_im && !_im._dragged) { var _imH = _im.querySelector('.modal-header'); if (_imH) _makeDraggable(_im, _imH); }
}

// 탭 전환
function switchPmTab(tabName) {
  document.querySelectorAll('.pm-tab').forEach(function(btn) {
    var isActive = btn.getAttribute('data-pm-tab') === tabName;
    btn.style.color = isActive ? '#185FA5' : '#9BA3B2';
    btn.style.fontWeight = isActive ? '600' : '500';
    btn.style.borderBottom = isActive ? '2px solid #185FA5' : '2px solid transparent';
    if (isActive) btn.classList.add('active'); else btn.classList.remove('active');
  });
  document.querySelectorAll('.pm-content').forEach(function(el) { el.style.display = 'none'; });
  var target = document.getElementById('pm-content-' + tabName);
  if (target) target.style.display = 'block';
}

// ======================== 편집 모드 ========================
var _mwEditMode = false;

function toggleMwEditMode() {
  _mwEditMode = !_mwEditMode;
  var btn = document.getElementById('mw-edit-toggle-btn');
  if (_mwEditMode) {
    btn.textContent = '저장';
    btn.style.background = '#E24B4A';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    _enterMwEditMode();
  } else {
    btn.textContent = '✎ 수정';
    btn.style.background = '#1D9E75';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    _exitMwEditMode();
  }
  console.log('편집 모드:', _mwEditMode);
}

function _enterMwEditMode() {
  // 미렌더링 행이 있으면 전체 렌더링 (점진 로딩 우회)
  var body = document.getElementById('catalog-body');
  if (window._catalogAllRows && window._catalogBuildRow) {
    var currentRowCount = body.querySelectorAll('tr:not(.discontinued-divider)').length;
    var totalNeeded = window._catalogAllRows.length + (window._catalogDiscontinued || []).length;
    if (currentRowCount < totalNeeded) {
      _catalogRowNum = 0;
      var html = '';
      for (var i = 0; i < window._catalogAllRows.length; i++) {
        html += window._catalogBuildRow(window._catalogAllRows[i]);
      }
      if (window._catalogDiscontinued && window._catalogDiscontinued.length > 0) {
        html += '<tr class="discontinued-divider"><td colspan="20">단종 품목 (' + window._catalogDiscontinued.length + '건)</td></tr>';
        html += window._catalogDiscontinued.map(window._catalogBuildRow).join('');
      }
      body.innerHTML = html;
      var scrollEl = body.closest('.table-scroll');
      if (scrollEl && scrollEl._catalogScroll) {
        scrollEl.removeEventListener('scroll', scrollEl._catalogScroll);
        scrollEl._catalogScroll = null;
      }
    }
  }
  // No. th → 전체선택 체크박스로 교체
  var noTh = document.getElementById('mw-no-th');
  if (noTh) {
    noTh._origHTML = noTh.innerHTML;
    noTh.innerHTML = '<input type="checkbox" id="mw-edit-checkall" onchange="toggleAllMwEditCheckbox(this)" style="width:15px;height:15px;accent-color:#185FA5">';
  }
  // No. td → 체크박스로 교체
  body.querySelectorAll('.mw-no-col').forEach(function(td) {
    td._origHTML = td.innerHTML;
    var code = td.dataset.code || '';
    td.innerHTML = '<input type="checkbox" class="mw-edit-cb" value="' + code + '" onchange="updateMwEditSelection()" style="width:15px;height:15px;accent-color:#185FA5">';
  });
  // 액션바 표시
  var bar = document.getElementById('mw-edit-action-bar');
  if (bar) bar.style.display = 'flex';
  updateMwEditSelection();
}

function _exitMwEditMode() {
  // No. th 복원
  var noTh = document.getElementById('mw-no-th');
  if (noTh && noTh._origHTML) { noTh.innerHTML = noTh._origHTML; delete noTh._origHTML; }
  else if (noTh) noTh.textContent = 'No.';
  // No. td 복원 (순번 재생성)
  var num = 0;
  document.querySelectorAll('#catalog-body .mw-no-col').forEach(function(td) {
    if (td._origHTML) { td.innerHTML = td._origHTML; delete td._origHTML; }
    else { num++; td.textContent = num; }
  });
  // 액션바 숨김
  var bar = document.getElementById('mw-edit-action-bar');
  if (bar) bar.style.display = 'none';
}

function toggleAllMwEditCheckbox(masterCb) {
  document.querySelectorAll('.mw-edit-cb').forEach(function(cb) { cb.checked = masterCb.checked; });
  updateMwEditSelection();
}

function updateMwEditSelection() {
  var checked = document.querySelectorAll('.mw-edit-cb:checked').length;
  var total = document.querySelectorAll('.mw-edit-cb').length;
  var info = document.getElementById('mw-edit-selection-info');
  if (info) info.textContent = checked + '개 선택됨';
  var masterCb = document.getElementById('mw-edit-checkall');
  if (masterCb) masterCb.checked = (checked === total && total > 0);
  // 바의 체크박스도 동기화
  var barCb = document.getElementById('mw-edit-checkall-bar');
  if (barCb) barCb.checked = (checked === total && total > 0);
}

function mwEditAction(action) {
  var checkedRows = document.querySelectorAll('.mw-edit-cb:checked');
  var codes = [];
  checkedRows.forEach(function(cb) {
    if (cb.value) codes.push(cb.value);
  });

  if (action === 'modify') {
    if (codes.length === 0) { alert('제품을 선택해주세요'); return; }
    _showMwBulkEditModal(codes);
    return;
  }

  if (action === 'delete') {
    if (codes.length === 0) { alert('제품을 선택해주세요'); return; }
    if (!confirm('선택하신 ' + codes.length + '개 제품을 삭제하시겠습니까?')) return;
    DB.products = DB.products.filter(function(p) { return codes.indexOf(String(p.code)) === -1; });
    recalcAll();
    save(KEYS.products, DB.products);
    renderCatalog();
    _enterMwEditMode();
    toast(codes.length + '개 제품 삭제 완료');
    return;
  }

  if (action === 'discontinue') {
    if (codes.length === 0) { alert('제품을 선택해주세요'); return; }
    if (!confirm('선택하신 ' + codes.length + '개 제품을 단종 처리하시겠습니까?')) return;
    var cnt = 0;
    DB.products.forEach(function(p) {
      if (codes.indexOf(String(p.code)) !== -1 && !p.discontinued) { p.discontinued = '단종'; cnt++; }
    });
    recalcAll();
    save(KEYS.products, DB.products);
    renderCatalog();
    _enterMwEditMode();
    toast(cnt + '개 제품 단종 처리 완료');
    return;
  }

  console.log('액션:', action, '선택:', codes.length, '개', codes);
}

// ── 일괄 수정 모달 ──
// ── 제품별 탭 방식 일괄 수정 모달 ──
var _mwBulkEditData = []; // [{code, ...fields}, ...]
var _mwBulkOrigData = []; // 원본 데이터 (변경 감지용)
var _mwBulkActiveIdx = 0;
var _mwBulkFields = ['code','manageCode','category','subcategory','detail','orderNum','ttiNum','model','supplyPrice'];
var _mwBulkLabels = ['코드','관리코드','대분류','중분류','소분류','프로모션No.','TTI#','모델명','공급가'];

function _showMwBulkEditModal(codes) {
  var old = document.getElementById('mw-bulk-edit-modal');
  if (old) old.remove();

  // DB에서 선택된 제품 데이터 복사 (String 비교로 타입 불일치 방지)
  _mwBulkEditData = [];
  _mwBulkOrigData = [];
  codes.forEach(function(code) {
    var p = DB.products.find(function(x) { return String(x.code).trim() === String(code).trim(); });
    if (!p) return;
    var copy = {}, orig = {};
    _mwBulkFields.forEach(function(k) { copy[k] = p[k] !== undefined && p[k] !== null ? p[k] : ''; orig[k] = copy[k]; });
    _mwBulkEditData.push(copy);
    _mwBulkOrigData.push(orig);
  });
  if (_mwBulkEditData.length === 0) { alert('선택된 제품을 찾을 수 없습니다'); return; }
  _mwBulkActiveIdx = 0;

  // 탭 HTML
  var tabsHtml = _mwBulkEditData.map(function(d, i) {
    var label = d.model || d.code;
    if (label.length > 20) label = label.substring(0, 20) + '…';
    return '<button class="mwbe-tab" data-idx="' + i + '" onclick="_mwBulkSwitchTab(' + i + ')" ' +
      'style="background:none;border:none;padding:8px 14px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;' +
      'font-family:\'Pretendard\',sans-serif;color:#9BA3B2;border-bottom:2px solid transparent;margin-bottom:-2px">' + label + '</button>';
  }).join('');

  // 필드 HTML (3열 그리드)
  var fieldsHtml = '';
  for (var r = 0; r < 3; r++) {
    fieldsHtml += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">';
    for (var c = 0; c < 3; c++) {
      var fi = r * 3 + c;
      var fk = _mwBulkFields[fi];
      var fl = _mwBulkLabels[fi];
      var inputType = fk === 'supplyPrice' ? 'text' : 'text';
      var oninput = fk === 'supplyPrice' ? ' oninput="var v=this.value.replace(/[^0-9]/g,\'\');if(v)this.value=Number(v).toLocaleString();else this.value=\'\'"' : '';
      fieldsHtml += '<div class="form-field"><label class="label">' + fl + '</label>' +
        '<input class="input mwbe-input" data-field="' + fk + '" id="mwbe-f-' + fk + '" type="' + inputType + '"' + oninput + '></div>';
    }
    fieldsHtml += '</div>';
  }

  var html = '<div class="modal-bg show" id="mw-bulk-edit-modal" style="display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:300;justify-content:center;align-items:flex-start;padding-top:40px">' +
    '<div class="modal" style="max-width:720px;width:92%;border-radius:10px;background:white;overflow:hidden">' +
      '<div class="modal-header" style="padding:14px 20px;border-bottom:1px solid #DDE1EB;display:flex;justify-content:space-between;align-items:center">' +
        '<h3 style="font-size:16px;font-weight:600;margin:0">' + _mwBulkEditData.length + '개 제품 수정</h3>' +
        '<button onclick="closeMwBulkEditModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#9BA3B2">&times;</button>' +
      '</div>' +
      '<div style="background:#F4F6FA;padding:8px 20px;font-size:11px;color:#5A6070">각 제품 탭을 클릭하여 개별 수정 · 수정 후 \'전체 적용\'으로 일괄 저장</div>' +
      '<div id="mwbe-tabs" style="display:flex;gap:0;border-bottom:2px solid #DDE1EB;margin:0 20px;overflow-x:auto;flex-shrink:0">' + tabsHtml + '</div>' +
      '<div style="padding:16px 20px">' + fieldsHtml + '</div>' +
      '<div style="padding:12px 20px;border-top:1px solid #DDE1EB;display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn-secondary" onclick="closeMwBulkEditModal()">취소</button>' +
        '<button class="btn-primary" onclick="applyMwBulkEdit()">전체 적용</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML('beforeend', html);
  // 드래그 가능하게
  var modalEl = document.querySelector('#mw-bulk-edit-modal > .modal');
  var handleEl = modalEl ? modalEl.querySelector('.modal-header') : null;
  if (modalEl && handleEl) _makeDraggable(modalEl, handleEl);
  _mwBulkSwitchTab(0);
}

var _mwBulkTabReady = false; // input에 값이 채워진 후에만 저장 허용
function _mwBulkSaveCurrentTab() {
  if (!_mwBulkTabReady) return; // 첫 switchTab 호출 시 빈 input으로 덮어쓰기 방지
  var d = _mwBulkEditData[_mwBulkActiveIdx];
  if (!d) return;
  _mwBulkFields.forEach(function(k) {
    var el = document.getElementById('mwbe-f-' + k);
    if (!el) return;
    if (k === 'supplyPrice') {
      d[k] = parseInt(el.value.replace(/[^0-9]/g, '')) || 0;
    } else {
      d[k] = el.value;
    }
  });
}

function _mwBulkSwitchTab(idx) {
  // 기존 탭 저장
  _mwBulkSaveCurrentTab();
  _mwBulkActiveIdx = idx;
  // 탭 활성 스타일
  document.querySelectorAll('.mwbe-tab').forEach(function(btn, i) {
    var active = i === idx;
    btn.style.color = active ? '#185FA5' : '#9BA3B2';
    btn.style.fontWeight = active ? '600' : '500';
    btn.style.borderBottom = active ? '2px solid #185FA5' : '2px solid transparent';
    btn.style.background = active ? '#E6F1FB' : 'none';
  });
  // 필드에 데이터 채우기
  var d = _mwBulkEditData[idx];
  if (!d) return;
  _mwBulkFields.forEach(function(k) {
    var el = document.getElementById('mwbe-f-' + k);
    if (!el) return;
    if (k === 'supplyPrice') {
      el.value = d[k] ? Number(d[k]).toLocaleString() : '';
    } else {
      el.value = d[k] || '';
    }
  });
  _mwBulkTabReady = true; // 이제 탭 전환 시 저장 허용
}

function closeMwBulkEditModal() {
  var el = document.getElementById('mw-bulk-edit-modal');
  if (el) el.remove();
  _mwBulkEditData = [];
  _mwBulkOrigData = [];
  _mwBulkActiveIdx = 0;
  _mwBulkTabReady = false;
}

function applyMwBulkEdit() {
  // 현재 탭 저장
  _mwBulkSaveCurrentTab();

  var updated = 0;
  _mwBulkEditData.forEach(function(d, di) {
    var p = DB.products.find(function(x) { return String(x.code).trim() === String(d.code).trim(); });
    if (!p) return;
    var orig = _mwBulkOrigData[di] || {};
    var changed = false;
    _mwBulkFields.forEach(function(k) {
      var newVal = d[k];
      var origVal = orig[k] !== undefined ? orig[k] : '';
      if (k === 'supplyPrice') {
        newVal = parseInt(newVal) || 0;
        origVal = parseInt(origVal) || 0;
      }
      // 원본과 비교하여 변경 감지
      if (String(newVal) !== String(origVal)) {
        p[k] = newVal;
        changed = true;
      }
    });
    if (changed) updated++;
  });

  // 스크롤 위치 저장
  var scrollEl = document.querySelector('#catalog-table')?.closest('.table-scroll');
  var scrollTop = scrollEl ? scrollEl.scrollTop : 0;

  if (updated > 0) {
    recalcAll();
    save(KEYS.products, DB.products);
    renderCatalog();
    // 스크롤 위치 복원
    if (scrollEl) requestAnimationFrame(function() { scrollEl.scrollTop = scrollTop; });
    toast(updated + '개 제품 수정 완료');
  } else {
    toast('변경된 항목이 없습니다');
  }
  closeMwBulkEditModal();
}

function showProductModal(idx) {
  const isEdit = idx !== undefined && idx >= 0;
  document.getElementById('prod-edit-idx').value = isEdit ? idx : -1;

  if (isEdit) {
    const p = DB.products[idx];
    document.getElementById('prod-code').value = p.code || '';
    document.getElementById('prod-manageCode').value = p.manageCode || '';
    document.getElementById('prod-category').value = p.category || '';
    document.getElementById('prod-subcategory').value = p.subcategory || '';
    document.getElementById('prod-detail').value = p.detail || '';
    document.getElementById('prod-orderNum').value = p.orderNum || '';
    document.getElementById('prod-ttiNum').value = p.ttiNum || '';
    document.getElementById('prod-model').value = p.model || '';
    document.getElementById('prod-supplyPrice').value = p.supplyPrice || '';
    // prod-productDC 제거됨 (카테고리 기반 DC로 변경)
    document.getElementById('prod-discontinued').value = p.discontinued || '';
    document.getElementById('prod-inDate').value = p.inDate || '';
  } else {
    ['prod-code','prod-manageCode','prod-category','prod-subcategory','prod-detail','prod-orderNum','prod-ttiNum','prod-model','prod-supplyPrice','prod-inDate'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('prod-discontinued').value = '';
  }
  // 제품등록및수정 팝업의 제품등록 탭으로 열기
  switchPmTab('add');
  document.getElementById('import-modal').classList.add('show');
}

function closeProductModal() { document.getElementById('import-modal').classList.remove('show'); }

function editInDate(idx) {
  const p = DB.products[idx];
  const current = p.inDate || '';
  const val = prompt('입고날짜 메모 (삭제하려면 비워두세요):', current);
  if (val === null) return;
  DB.products[idx].inDate = val.trim();
  save(KEYS.products, DB.products);
  renderCatalog();
  toast(val.trim() ? '입고날짜 메모 저장' : '입고날짜 메모 삭제');
}

function saveProduct() {
  const code = document.getElementById('prod-code').value.trim();
  const model = document.getElementById('prod-model').value.trim();
  const supplyPrice = parseInt(document.getElementById('prod-supplyPrice').value) || 0;

  if (!code) { toast('코드를 입력해주세요'); return; }
  if (!model) { toast('모델명을 입력해주세요'); return; }
  if (!supplyPrice) { toast('공급가를 입력해주세요'); return; }

  const idx = parseInt(document.getElementById('prod-edit-idx').value);
  const prodCategory = document.getElementById('prod-category').value.trim();

  // Calculate cost and prices using current settings (same as recalcAll)
  const s = DB.settings;
  const cost = calcCost(supplyPrice, prodCategory);

  const item = {
    code: code,
    manageCode: document.getElementById('prod-manageCode').value.trim(),
    category: document.getElementById('prod-category').value.trim(),
    subcategory: document.getElementById('prod-subcategory').value.trim(),
    detail: document.getElementById('prod-detail').value.trim(),
    orderNum: document.getElementById('prod-orderNum').value.trim(),
    ttiNum: document.getElementById('prod-ttiNum').value.trim(),
    model: model,
    supplyPrice: supplyPrice,
    productDC: 0,
    discontinued: document.getElementById('prod-discontinued').value,
    inDate: document.getElementById('prod-inDate').value.trim(),
    cost: Math.round(cost),
    priceA: Math.ceil((cost * (1 + (s.mkDomae || 1) / 100)) / 100) * 100,
    priceRetail: Math.ceil((cost * (1 + (s.mkRetail || 15) / 100)) / 100) * 100,
    priceNaver: Math.ceil((cost * (1 + (s.mkNaver || 17) / 100)) / 100) * 100,
    priceOpen: Math.ceil((cost * (1 + (s.mkOpen || 27) / 100)) / 100) * 100,
    raisedPrice: 0,
    raiseRate: 0
  };

  if (idx >= 0) {
    saveActionHistory('제품수정', '밀워키', 1, null);
    DB.products[idx] = { ...DB.products[idx], ...item };
    toast(`"${model}" 제품 수정 완료`);
  } else {
    // Check duplicate code
    if (DB.products.some(p => String(p.code) === String(code))) {
      if (!confirm(`코드 "${code}"가 이미 존재합니다. 그래도 추가하시겠습니까?`)) return;
    }
    saveActionHistory('제품추가', '밀워키', 1, null);
    DB.products.push(item);
    toast(`"${model}" 제품 추가 완료`);
  }

  save(KEYS.products, DB.products);
  populateCatalogFilters();
  renderCatalog();
  // 입력 필드 초기화
  ['prod-code','prod-manageCode','prod-category','prod-subcategory','prod-detail','prod-orderNum','prod-ttiNum','prod-model','prod-supplyPrice','prod-inDate'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('prod-discontinued').value = '';
  document.getElementById('prod-edit-idx').value = '-1';
  closeProductModal();
}

function deleteProduct(idx) {
  const p = DB.products[idx];
  if (!confirm(`"${p.model || p.code}" 제품을 삭제하시겠습니까?`)) return;
  saveActionHistory('제품삭제', '밀워키', 1, null);
  DB.products.splice(idx, 1);
  save(KEYS.products, DB.products);
  renderCatalog();
  toast('제품 삭제 완료');
}

function toggleSelectAll(checked) {
  document.querySelectorAll('#catalog-body .chk-select').forEach(cb => { cb.checked = checked; });
  updateDeleteBtn();
}

function updateDeleteBtn() {
  const selected = document.querySelectorAll('#catalog-body .chk-select:checked');
  const btn = document.getElementById('btn-delete-selected');
  if (selected.length > 0) {
    btn.style.display = '';
    btn.textContent = `선택 삭제 (${selected.length})`;
  } else {
    btn.style.display = 'none';
  }
}

function deleteSelectedProducts() {
  const selected = document.querySelectorAll('#catalog-body .chk-select:checked');
  if (!selected.length) return;
  if (!confirm(`선택한 ${selected.length}개의 제품을 삭제하시겠습니까?`)) return;
  const indices = Array.from(selected).map(cb => parseInt(cb.dataset.idx)).sort((a, b) => b - a);
  indices.forEach(idx => { DB.products.splice(idx, 1); });
  save(KEYS.products, DB.products);
  renderCatalog();
  document.getElementById('chk-select-all').checked = false;
  toast(`${indices.length}개 제품 삭제 완료`);
}

// ======================== PDF PROMO IMPORT ========================
let pdfExtracted = [];

function showPromoPdfModal() {
  document.getElementById('promo-pdf-modal').classList.add('show');
  document.getElementById('pdf-status').textContent = '';
  document.getElementById('pdf-preview').style.display = 'none';
  document.getElementById('btn-pdf-import').style.display = 'none';
  document.getElementById('btn-pdf-parse').style.display = '';
  document.getElementById('promo-pdf-file').value = '';
  pdfExtracted = [];
}

function closePromoPdfModal() { document.getElementById('promo-pdf-modal').classList.remove('show'); }

async function parsePdf() {
  const file = document.getElementById('promo-pdf-file').files[0];
  if (!file) { toast('파일을 선택해주세요'); return; }
  const month = DB.currentPromoMonth || (new Date().getMonth() + 1) + '월';
  const status = document.getElementById('pdf-status');
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  const isImage = file.type.startsWith('image/');

  if (isPdf) {
    status.innerHTML = '<span style="color:#185FA5">⏳ PDF 파일 읽는 중...</span>';
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (typeof pdfjsLib === 'undefined') { status.innerHTML = '<span style="color:#CC2222">PDF.js 라이브러리 로딩 중입니다. 잠시 후 다시 시도하세요.</span>'; return; }
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      status.innerHTML = `<span style="color:#185FA5">⏳ ${pdf.numPages}페이지 분석 중...</span>`;

      let allLines = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;
        const lineMap = {};
        items.forEach(item => {
          const y = Math.round(item.transform[5]);
          if (!lineMap[y]) lineMap[y] = [];
          lineMap[y].push({ x: item.transform[4], text: item.str });
        });
        Object.keys(lineMap).sort((a, b) => b - a).forEach(y => {
          const line = lineMap[y].sort((a, b) => a.x - b.x).map(t => t.text).join(' ').trim();
          if (line) allLines.push({ page: i, text: line });
        });
      }

      pdfExtracted = extractPromosFromLines(allLines, month);
      showPdfResult(allLines);
    } catch (err) {
      status.innerHTML = `<span style="color:#CC2222">❌ PDF 읽기 오류: ${err.message}</span>`;
    }
  } else if (isImage) {
    status.innerHTML = '<span style="color:#EF9F27">⚠ 이미지 파일은 자동 텍스트 추출이 불가합니다. 이미지를 미리보기로 표시합니다. 내용을 보면서 직접 추가해주세요.</span>';
    const reader = new FileReader();
    reader.onload = function(e) {
      const imgHtml = `<div style="margin-top:12px;max-height:400px;overflow-y:auto;border:1px solid var(--tl-border);border-radius:6px;padding:8px">
        <img src="${e.target.result}" style="max-width:100%;display:block">
      </div>
      <div style="margin-top:8px;font-size:12px;color:#5A6070">이미지를 참고하여 "+" 버튼으로 프로모션을 직접 추가하세요.</div>`;
      document.getElementById('pdf-status').innerHTML += imgHtml;
    };
    reader.readAsDataURL(file);
    return;
  } else {
    status.innerHTML = '<span style="color:#CC2222">❌ PDF 또는 이미지 파일만 업로드 가능합니다.</span>';
  }
}

function showPdfResult(allLines) {
  const status = document.getElementById('pdf-status');
  if (pdfExtracted.length > 0) {
    renderPdfPreview();
    document.getElementById('pdf-preview').style.display = 'block';
    document.getElementById('btn-pdf-import').style.display = '';
    document.getElementById('btn-pdf-parse').style.display = 'none';
    status.innerHTML = `<span style="color:#1D9E75">✅ ${pdfExtracted.length}건 추출 완료. 가격을 확인/수정한 뒤 추가하세요.</span>`;
  } else {
    const preview = allLines.slice(0, 30).map(l => `<div style="font-size:11px;color:#5A6070;border-bottom:1px solid #F0F2F7;padding:2px 0">P${l.page}: ${l.text}</div>`).join('');
    status.innerHTML = `<span style="color:#EF9F27">⚠ 자동 추출된 프로모션이 없습니다.</span>
      <div style="margin-top:8px;font-size:12px;color:#5A6070">PDF에서 읽은 텍스트 (처음 30줄):</div>
      <div style="max-height:200px;overflow-y:auto;margin-top:4px;border:1px solid var(--tl-border);border-radius:6px;padding:8px">${preview}</div>`;
  }
}

function calcDiscountDisplay(textDiscount, dealerPrice, promoPrice, isFree) {
  // 1. PDF 텍스트에서 읽은 할인율이 있으면 그대로 사용
  if (textDiscount) return textDiscount;
  // 2. 무상제공이면 표시 안함
  if (isFree || !promoPrice) return '';
  // 3. 대리점가격과 프로모션금액 비교해서 자동 계산
  if (dealerPrice > 0 && promoPrice > 0 && dealerPrice > promoPrice) {
    const rate = Math.round((1 - promoPrice / dealerPrice) * 100);
    if (rate > 0 && rate < 100) return rate + '%';
  }
  return '';
}

function calcDiscountRate(textRate, dealerPrice, promoPrice) {
  if (textRate > 0) return textRate;
  if (dealerPrice > 0 && promoPrice > 0 && dealerPrice > promoPrice) {
    return parseFloat(((1 - promoPrice / dealerPrice)).toFixed(4));
  }
  return 0;
}

function extractPromosFromLines(lines, month) {
  const promos = [];
  let currentPromoCode = '';
  let currentPromoName = '';
  let currentPeriod = '';

  const modelRe = /\b(M12|M18|C12|C18|MX|PH|IR|L4|PACKOUT|SHOCKWAVE)\s*[A-Z0-9\-]+/i;
  const promoCodeRe = /\b([MTN]\d{1,4})\b/;
  const pctRe = /(\d{1,2})\s*%/;
  const plusRe = /(\d{1,2})\s*\+\s*(\d{1,2})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text;

    // Skip header/footer lines
    if (line.includes('오더 합계') || line.includes('제한사항') || line.includes('재고 소진') || line.includes('발신:') || line.includes('수신:') || line.includes('TTI Korea')) continue;

    // Detect promo title lines
    const codeMatch = line.match(promoCodeRe);
    if (codeMatch && (line.includes('프로모션') || line.includes('DC') || line.includes('할인') || line.includes('패키지') || line.includes('특가') || line.includes('신제품') || line.includes('누적') || line.includes('FOC'))) {
      currentPromoCode = codeMatch[1];
      currentPromoName = line.replace(/<[^>]*>/g, '').trim();
      continue;
    }

    // Detect period lines
    if (line.includes('기간') && line.includes('~')) {
      const periodMatch = line.match(/기간\s*[:：]\s*(.+)/);
      if (periodMatch) currentPeriod = periodMatch[1].trim();
      continue;
    }

    // Detect product lines with model numbers
    const modelMatch = line.match(modelRe);
    if (!modelMatch) continue;
    const model = modelMatch[0].trim();

    // ONLY extract comma-formatted prices (e.g., 140,000) - NOT raw digit sequences
    // This prevents TTI# (016401004) from being treated as prices
    const commaPrice = /\b(\d{1,3}(?:,\d{3})+)\b/g;
    const prices = [];
    let cm;
    while ((cm = commaPrice.exec(line)) !== null) {
      const v = parseInt(cm[1].replace(/,/g, ''));
      // Filter: real prices are 1,000 ~ 3,000,000. Skip TTI#-like numbers
      if (v >= 1000 && v <= 3000000 && !prices.includes(v)) prices.push(v);
    }

    // Extract 4-digit order number (순번) - first 4-digit number before model or TTI
    const beforeModel = line.substring(0, line.indexOf(model));
    const orderMatch = beforeModel.match(/\b(\d{4})\b/);

    // Extract quantity - look for standalone small numbers (1-99) after model
    const afterModel = line.substring(line.indexOf(model) + model.length);
    const qtyMatch = afterModel.match(/\b(\d{1,2})\b/);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

    // Extract discount
    const pctMatch = line.match(pctRe);
    const plusMatch = line.match(plusRe);
    let discountDisplay = '', discountRate = 0;
    if (plusMatch) {
      discountDisplay = `${plusMatch[1]}+${plusMatch[2]}`;
      discountRate = parseInt(plusMatch[1]) / 100;
    } else if (pctMatch) {
      discountDisplay = `${pctMatch[1]}%`;
      discountRate = parseInt(pctMatch[1]) / 100;
    }

    // Determine dealer price and promo price from comma-formatted prices
    let dealerPrice = 0, promoPrice = 0;
    const isFree = line.includes('무상') || line.includes('증정') || line.includes('FOC');

    if (isFree) {
      // For free items, first price is dealer price, promo = 0
      dealerPrice = prices.length > 0 ? prices[0] : 0;
      promoPrice = 0;
    } else if (prices.length >= 3) {
      // 단가, 프로모션금액, 총액 -> take first two
      dealerPrice = prices[0];
      promoPrice = prices[1];
    } else if (prices.length === 2) {
      dealerPrice = prices[0];
      promoPrice = prices[1];
    } else if (prices.length === 1) {
      dealerPrice = prices[0];
    }

    promos.push({
      promoCode: currentPromoCode,
      promoName: currentPromoName,
      model: model,
      orderNum: orderMatch ? orderMatch[1] : '',
      qty: qty > 0 && qty <= 99 ? qty : 1,
      dealerPrice: dealerPrice,
      promoPrice: isFree ? 0 : promoPrice,
      discountDisplay: calcDiscountDisplay(discountDisplay, dealerPrice, isFree ? 0 : promoPrice, isFree),
      discountRate: calcDiscountRate(discountRate, dealerPrice, isFree ? 0 : promoPrice),
      period: currentPeriod || month,
      selected: true
    });
  }
  return promos;
}

function renderPdfPreview() {
  const body = document.getElementById('pdf-extract-body');
  body.innerHTML = pdfExtracted.map((p, i) => `<tr>
    <td class="center"><input type="checkbox" class="pdf-chk" data-idx="${i}" ${p.selected ? 'checked' : ''} onchange="pdfExtracted[${i}].selected=this.checked"></td>
    <td style="max-width:160px;overflow:hidden;white-space:nowrap" title="${p.promoName || ''}">${p.promoName || '-'}</td>
    <td><span class="badge badge-blue">${p.promoCode || '-'}</span></td>
    <td style="font-weight:500">${p.model || '-'}</td>
    <td class="center">${p.orderNum || '-'}</td>
    <td class="center"><input type="number" value="${p.qty || 1}" onchange="pdfExtracted[${i}].qty=parseInt(this.value)||1" style="width:40px;text-align:center;font-size:12px;border:1px solid #DDE1EB;border-radius:4px;padding:2px"></td>
    <td style="background:#FCEBEB"><input type="number" value="${p.dealerPrice || 0}" onchange="pdfExtracted[${i}].dealerPrice=parseInt(this.value)||0" style="width:80px;text-align:right;font-size:12px;border:1px solid #CC2222;border-radius:4px;padding:2px"></td>
    <td style="background:#FCEBEB"><input type="number" value="${p.promoPrice || 0}" onchange="pdfExtracted[${i}].promoPrice=parseInt(this.value)||0" style="width:80px;text-align:right;font-size:12px;border:1px solid #CC2222;border-radius:4px;padding:2px"></td>
    <td class="center"><input type="text" value="${p.discountDisplay || ''}" onchange="pdfExtracted[${i}].discountDisplay=this.value" style="width:50px;text-align:center;font-size:12px;border:1px solid #DDE1EB;border-radius:4px;padding:2px"></td>
    <td>${p.period || '-'}</td>
  </tr>`).join('');
  document.getElementById('pdf-extract-count').textContent = pdfExtracted.length;
}

function togglePdfSelectAll(checked) {
  pdfExtracted.forEach(p => p.selected = checked);
  document.querySelectorAll('.pdf-chk').forEach(cb => cb.checked = checked);
}

function importPdfPromos() {
  const selected = pdfExtracted.filter(p => p.selected);
  if (!selected.length) { toast('추가할 프로모션을 선택해주세요'); return; }
  if (!confirm(`선택한 ${selected.length}건의 프로모션을 추가하시겠습니까?`)) return;

  // Group by promoCode
  const grouped = {};
  selected.forEach(p => {
    const code = p.promoCode || 'UNKNOWN';
    if (!grouped[code]) {
      grouped[code] = {
        promoNo: code,
        title: p.promoName || '',
        discount: p.discountDisplay || '',
        period: p.period || '',
        restriction: '',
        items: []
      };
    }
    grouped[code].items.push({
      orderNum: p.orderNum || '',
      ttiNum: '',
      model: p.model || '',
      description: '',
      qty: p.qty || 1,
      price: p.dealerPrice || 0,
      promoPrice: p.promoPrice || 0,
      total: (p.promoPrice || 0) * (p.qty || 1),
      group: '',
      maxQty: ''
    });
  });

  // Categorize and save
  let counts = { newprod: 0, package: 0, monthly: 0, spot: 0 };
  Object.values(grouped).forEach(promo => {
    const no = promo.promoNo.toUpperCase();
    let cat = 'spot';
    if (/^M1\d{2}$/.test(no)) cat = 'newprod';
    else if (/^M2\d{2}$/.test(no)) cat = 'package';
    else if (/^T\d{1,2}$/.test(no)) cat = 'monthly';

    // Check if already exists (avoid duplicates)
    const exists = promosV2[cat].some(p => p.promoNo === promo.promoNo);
    if (!exists) {
      promosV2[cat].push(promo);
      counts[cat]++;
    } else {
      // Merge items into existing
      const existing = promosV2[cat].find(p => p.promoNo === promo.promoNo);
      promo.items.forEach(item => {
        if (!existing.items.some(ei => ei.model === item.model)) {
          existing.items.push(item);
        }
      });
      counts[cat]++;
    }
  });

  savePromosV2();
  renderAllPromosV2();
  closePromoPdfModal();

  const summary = Object.entries(counts).filter(([,v]) => v > 0)
    .map(([k,v]) => `${k === 'newprod' ? '신제품' : k === 'package' ? '패키지' : k === 'monthly' ? '이달의특가' : '스팟'} ${v}건`).join(', ');
  toast(`프로모션 추가 완료: ${summary}`);
}

// ======================== EXCEL IMPORT ========================
var _importParsedRows = [];
var _importCompareResult = null;
var _importParsedWb = null;

function showImportModal() {
  // 제품등록및수정 팝업의 가져오기 탭으로 열기
  showProductManageModal();
}
function closeModal() { document.getElementById('import-modal').classList.remove('show'); }

function resetImportFile() {
  var fi = document.getElementById('import-file-input');
  if (fi) fi.value = '';
  var info = document.getElementById('import-file-info');
  if (info) info.style.display = 'none';
  var area = document.getElementById('import-compare-area');
  if (area) area.style.display = 'none';
  _importParsedRows = [];
  _importCompareResult = null;
  _importParsedWb = null;
}

function handleImportFile(input) {
  var file = input.files[0];
  if (!file) return;
  document.getElementById('import-file-info').style.display = 'block';
  document.getElementById('import-file-name').textContent = '📄 ' + file.name;

  var ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    handleImportPdf(file);
  } else {
    handleImportXlsx(file);
  }
}

function handleImportXlsx(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      _importParsedWb = wb;
      var rows = parseImportWorkbook(wb);
      if (!rows || rows.length === 0) {
        alert('파싱 가능한 데이터가 없습니다. 시트 형식을 확인해주세요.');
        resetImportFile();
        return;
      }
      _importParsedRows = rows;
      _importCompareResult = compareWithExisting(rows);
      renderImportComparison(_importCompareResult);
    } catch (err) {
      console.error('엑셀 파싱 오류:', err);
      alert('파일 파싱 중 오류: ' + err.message);
      resetImportFile();
    }
  };
  reader.readAsArrayBuffer(file);
}

async function handleImportPdf(file) {
  try {
    document.getElementById('import-compare-area').style.display = 'none';
    var formData = new FormData();
    formData.append('file', file);

    var res = await fetch('/api/import/parse-pdf', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('PDF 파싱 실패: HTTP ' + res.status);

    var data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.rows || data.rows.length === 0) {
      alert('PDF에서 파싱 가능한 데이터가 없습니다.');
      resetImportFile();
      return;
    }

    console.log('[PDF Import] 파싱 완료:', data.rows.length + '행, ' + (data.pageCount || '?') + '페이지');
    if (data.debug) console.log('[PDF Import Debug]', data.debug);
    _importParsedRows = data.rows;
    _importCompareResult = compareWithExisting(data.rows);
    if (data.debug) _importCompareResult.debug = data.debug;
    renderImportComparison(_importCompareResult);
  } catch (err) {
    console.error('PDF 파싱 오류:', err);
    alert('PDF 파싱 중 오류: ' + err.message);
    resetImportFile();
  }
}

function toggleFullReplace() {
  var section = document.getElementById('import-replace-section');
  var arrow = document.getElementById('import-replace-arrow');
  if (section.style.display === 'none') {
    section.style.display = 'block';
    arrow.style.transform = 'rotate(90deg)';
  } else {
    section.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  }
}

function updateReplaceBtn() {
  var agreed = document.getElementById('import-replace-agree');
  var btn = document.getElementById('import-replace-btn');
  if (!btn) return;
  if (agreed && agreed.checked && _importParsedRows.length > 0) {
    btn.disabled = false;
    btn.style.background = '#dc2626'; btn.style.color = '#fff'; btn.style.cursor = 'pointer';
    btn.textContent = '전체 교체 실행 (' + _importParsedRows.length + '건)';
  } else {
    btn.disabled = true;
    btn.style.background = '#e5e7eb'; btn.style.color = '#9ca3af'; btn.style.cursor = 'not-allowed';
    btn.textContent = '전체 교체 실행 (동의 필요)';
  }
}

// 워크북에서 전체가격표 시트를 파싱하여 mw_products 형태 배열 반환
function parseImportWorkbook(wb) {
  var sheets = wb.SheetNames;
  var priceSheet = sheets.find(function(s) { return s === '전체가격표(26.04 인상)'; }) ||
    sheets.find(function(s) { return s === '전체가격표(25)'; }) ||
    sheets.find(function(s) { return s.indexOf('가격표') !== -1 && s.indexOf('26') !== -1; }) ||
    sheets.find(function(s) { return s.indexOf('가격표') !== -1 && s.indexOf('25') !== -1; }) ||
    sheets.find(function(s) { return s.indexOf('가격표') !== -1; }) ||
    null;
  if (!priceSheet) return [];

  var ws = wb.Sheets[priceSheet];
  var data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  var is26 = priceSheet.indexOf('26') !== -1;

  var headerRow = -1;
  var col = {};
  for (var r = 0; r < Math.min(10, data.length); r++) {
    var row = data[r];
    if (!row) continue;
    var cells = row.map(function(v) { return String(v || '').trim(); });
    if (cells.indexOf('코드') !== -1 && cells.indexOf('모델명') !== -1) {
      headerRow = r;
      cells.forEach(function(v, i) {
        if (v === '단종') col.단종 = i;
        if (v === '코드') col.코드 = i;
        if (v === '관리코드') col.관리코드 = i;
        if (v === '대분류') col.대분류 = i;
        if (v === '중분류') col.중분류 = i;
        if (v === '소분류') col.소분류 = i;
        if (v === '순번') col.순번 = i;
        if (v.indexOf('TTI') !== -1) col.TTI = i;
        if (v === '모델명') col.모델명 = i;
        if (v === '제품설명') col.제품설명 = i;
        if (v === '공급가') col.공급가 = i;
        if (v === '원가') col.원가 = i;
        if (v === '인상가') col.인상가 = i;
        if (v === '인상률') col.인상률 = i;
        if (v === '재고') col.재고 = i;
        if (v === '입고날짜' || v === '입고일') col.입고날짜 = i;
        if (v === '본사가용' || v === '가용수량' || v === '본사') col.본사가용 = i;
      });
      break;
    }
  }
  if (headerRow < 0) return [];

  var rows = [];
  var dataStart = headerRow + 2;
  for (var i = dataStart; i < data.length; i++) {
    var row = data[i];
    var code = row && row[col.코드 != null ? col.코드 : 2];
    if (!code && !(row && row[col.모델명 != null ? col.모델명 : 8])) continue;
    var supplyPrice = row[col.공급가 != null ? col.공급가 : 10] || 0;
    var importCategory = row[col.대분류 != null ? col.대분류 : 3] || '';
    var costVal = row[col.원가 != null ? col.원가 : (is26 ? 14 : 12)] || 0;
    var cost = costVal || calcCost(supplyPrice, importCategory);
    rows.push({
      discontinued: (String(row[col.단종 != null ? col.단종 : 1] || '').trim() === '단종') ? '단종' : '',
      code: String(code || ''),
      manageCode: col.관리코드 != null ? String(row[col.관리코드] || '') : '',
      category: importCategory,
      subcategory: row[col.중분류 != null ? col.중분류 : 4] || '',
      detail: row[col.소분류 != null ? col.소분류 : 5] || '',
      orderNum: row[col.순번 != null ? col.순번 : 6] || '',
      ttiNum: String(row[col.TTI != null ? col.TTI : 7] || ''),
      model: (function(){ var m = row[col.모델명 != null ? col.모델명 : 8] || ''; var d = row[col.제품설명 != null ? col.제품설명 : 9] || ''; return d ? m + ' / ' + d : m; })(),
      supplyPrice: supplyPrice,
      productDC: 0,
      cost: Math.round(cost || 0),
      priceA: 0, priceRetail: 0, priceNaver: 0, priceOpen: 0,
      raisedPrice: is26 ? (row[col.인상가 != null ? col.인상가 : 11] || 0) : 0,
      raiseRate: is26 ? (row[col.인상률 != null ? col.인상률 : 12] || 0) : 0,
      ttiStock: col.본사가용 != null ? String(row[col.본사가용] || '') : '',
      inDate: col.입고날짜 != null ? String(row[col.입고날짜] || '') : ''
    });
  }
  return rows;
}

// 기존 mw_products와 비교
function compareWithExisting(parsedRows) {
  var existing = DB.products || [];
  var result = { changed: [], added: [], same: [] };
  var byTti = {};
  var byOrder = {};
  var byModel = {};
  existing.forEach(function(p, idx) {
    if (p.ttiNum) byTti[String(p.ttiNum).trim()] = idx;
    if (p.orderNum) byOrder[String(p.orderNum).trim()] = idx;
    if (p.model) byModel[String(p.model).trim().toLowerCase()] = idx;
  });
  var matchedIndices = {};

  parsedRows.forEach(function(newRow) {
    var matchIdx = -1;
    var tti = String(newRow.ttiNum || '').trim();
    var order = String(newRow.orderNum || '').trim();
    var model = String(newRow.model || '').trim().toLowerCase();
    var matchedBy = '';

    if (tti && byTti[tti] != null) { matchIdx = byTti[tti]; matchedBy = 'ttiNum'; }
    else if (order && byOrder[order] != null) { matchIdx = byOrder[order]; matchedBy = 'orderNum'; }
    else if (model && byModel[model] != null) { matchIdx = byModel[model]; matchedBy = 'model'; }

    if (matchIdx >= 0) {
      matchedIndices[matchIdx] = true;
      var old = existing[matchIdx];
      var diffs = [];
      if (String(old.ttiNum || '') !== String(newRow.ttiNum || '')) diffs.push('ttiNum');
      if (String(old.orderNum || '') !== String(newRow.orderNum || '')) diffs.push('orderNum');
      if (String(old.model || '') !== String(newRow.model || '')) diffs.push('model');
      // description은 model에 통합됨
      if (Number(old.supplyPrice || 0) !== Number(newRow.supplyPrice || 0)) diffs.push('supplyPrice');

      if (diffs.length > 0) {
        result.changed.push({ oldData: old, newData: newRow, diffs: diffs, matchedBy: matchedBy, checked: true });
      } else {
        result.same.push(old);
      }
    } else {
      result.added.push({ data: newRow, checked: true });
    }
  });
  return result;
}

// 비교 결과 UI 렌더링 (Part B에서 상세 구현, 여기선 요약만)
function renderImportComparison(result) {
  document.getElementById('import-compare-area').style.display = 'block';

  // 디버그 정보 콘솔 출력
  if (result.debug) { console.log('[Import Debug]', result.debug); }
  if (result.changed && result.changed[0]) { console.log('비교결과 changed[0]:', JSON.stringify(result.changed[0], null, 2)); }

  // 요약 카드
  var summary = document.getElementById('import-summary');
  summary.innerHTML =
    '<div style="flex:1;text-align:center;padding:10px;background:#dbeafe;border-radius:6px"><div style="font-size:18px;font-weight:700;color:#1d4ed8">' + result.changed.length + '</div><div style="font-size:11px;color:#3b82f6">변경</div></div>' +
    '<div style="flex:1;text-align:center;padding:10px;background:#d1fae5;border-radius:6px"><div style="font-size:18px;font-weight:700;color:#065f46">' + result.added.length + '</div><div style="font-size:11px;color:#10b981">신규</div></div>' +
    '<div style="flex:1;text-align:center;padding:10px;background:#f3f4f6;border-radius:6px"><div style="font-size:18px;font-weight:700;color:#6b7280">' + result.same.length + '</div><div style="font-size:11px;color:#9ca3af">동일</div></div>';

  var fieldLabel = { ttiNum:'TTI#', orderNum:'순번', model:'모델명', description:'제품설명', supplyPrice:'공급가' };

  // 변경 항목 (카드 형태)
  var changedEl = document.getElementById('import-changed-section');
  if (result.changed.length > 0) {
    changedEl.style.display = 'block';
    var changedHeader = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<span style="font-size:12px;font-weight:600;color:#1d4ed8">변경 항목 (' + result.changed.length + '건)</span>' +
      '<span onclick="toggleAllImportChecks(\'changed\',true)" style="font-size:11px;color:#3b82f6;cursor:pointer">전체 선택</span></div>';
    var changedCards = '<div style="max-height:350px;overflow-y:auto">' + result.changed.map(function(c, i) {
      var diffRows = c.diffs.map(function(d) {
        var label = fieldLabel[d] || d;
        var oldVal = c.oldData[d] != null ? c.oldData[d] : '';
        var newVal = c.newData[d] != null ? c.newData[d] : '';
        var isPrice = d === 'supplyPrice';
        var oldD = isPrice ? '₩' + Number(oldVal).toLocaleString() : oldVal;
        var newD = isPrice ? '₩' + Number(newVal).toLocaleString() : newVal;
        return '<tr style="border-top:1px solid #f3f4f6">' +
          '<td style="padding:5px 12px;color:#9ca3af;font-size:11px">' + label + '</td>' +
          '<td style="padding:5px 12px;color:#9ca3af;text-decoration:line-through;font-size:11px">' + oldD + '</td>' +
          '<td style="padding:5px 12px;text-align:center;color:#d1d5db;font-size:11px">→</td>' +
          '<td style="padding:5px 12px;font-weight:500;color:#92400e;background:#fef3c7;font-size:11px">' + newD + '</td></tr>';
      }).join('');
      return '<div style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;overflow:hidden">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb">' +
        '<input type="checkbox" ' + (c.checked ? 'checked' : '') + ' data-type="changed" data-idx="' + i + '" onchange="_importCompareResult.changed[' + i + '].checked=this.checked;updateImportApplyBtn()">' +
        '<span style="font-weight:600;font-size:12px">' + (c.newData.model || c.oldData.model) + '</span>' +
        '<span style="font-size:11px;color:#9ca3af">순번 ' + (c.oldData.orderNum || '') + '</span></div>' +
        '<table style="width:100%;border-collapse:collapse">' +
        '<tr style="background:#f9fafb"><th style="padding:4px 12px;text-align:left;color:#9ca3af;width:70px;font-weight:500;font-size:10px">필드</th>' +
        '<th style="padding:4px 12px;text-align:left;color:#9ca3af;font-weight:500;font-size:10px">이전 자료</th>' +
        '<th style="padding:4px 12px;text-align:center;color:#9ca3af;width:24px;font-weight:500;font-size:10px">→</th>' +
        '<th style="padding:4px 12px;text-align:left;color:#9ca3af;font-weight:500;font-size:10px">변경 자료</th></tr>' +
        diffRows + '</table></div>';
    }).join('') + '</div>';
    changedEl.innerHTML = changedHeader + changedCards;
  } else { changedEl.style.display = 'none'; }

  // 신규 항목 (초록 카드)
  var newEl = document.getElementById('import-new-section');
  if (result.added.length > 0) {
    newEl.style.display = 'block';
    var newHeader = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<span style="font-size:12px;font-weight:600;color:#065f46">신규 항목 (' + result.added.length + '건)</span>' +
      '<span onclick="toggleAllImportChecks(\'added\',true)" style="font-size:11px;color:#10b981;cursor:pointer">전체 선택</span></div>';
    var newCards = '<div style="max-height:250px;overflow-y:auto">' + result.added.map(function(a, i) {
      return '<div style="border:1px solid #bbf7d0;border-radius:6px;margin-bottom:8px;background:#f0fdf4">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px">' +
        '<input type="checkbox" ' + (a.checked ? 'checked' : '') + ' data-type="added" data-idx="' + i + '" onchange="_importCompareResult.added[' + i + '].checked=this.checked;updateImportApplyBtn()">' +
        '<span style="font-weight:600;font-size:12px;color:#166534">' + (a.data.model || '-') + '</span>' +
        '<span style="font-size:11px;color:#15803d">TTI# ' + (a.data.ttiNum || '-') + '</span>' +
        '<span style="font-size:11px;color:#15803d;margin-left:auto">₩' + Number(a.data.supplyPrice || 0).toLocaleString() + '</span></div></div>';
    }).join('') + '</div>';
    newEl.innerHTML = newHeader + newCards;
  } else { newEl.style.display = 'none'; }

  // 동일 항목
  var sameEl = document.getElementById('import-same-section');
  sameEl.style.display = result.same.length > 0 ? 'block' : 'none';
  sameEl.innerHTML = '<div style="font-size:11px;color:#94a3b8">동일 항목 ' + result.same.length + '건 — 변경 없음</div>';

  updateImportApplyBtn();
}

function toggleAllImportChecks(type, state) {
  var section = type === 'changed' ? '#import-changed-section' : '#import-new-section';
  document.querySelectorAll(section + ' input[type=checkbox]').forEach(function(cb) { cb.checked = state; });
  if (_importCompareResult) {
    var arr = type === 'changed' ? _importCompareResult.changed : _importCompareResult.added;
    arr.forEach(function(item) { item.checked = state; });
  }
  updateImportApplyBtn();
}

function updateImportApplyBtn() {
  var checks = document.querySelectorAll('#import-compare-area input[type=checkbox]:checked');
  var btn = document.getElementById('import-apply-btn');
  if (btn) btn.textContent = '선택 항목 적용 (' + checks.length + '건)';
}

// 선택 항목 적용
function applyImportChanges() {
  if (!_importCompareResult) return;
  var applied = 0;

  // 변경 항목 적용
  var changedChecks = document.querySelectorAll('#import-changed-section input[data-type="changed"]:checked');
  changedChecks.forEach(function(cb) {
    var idx = parseInt(cb.dataset.idx);
    var item = _importCompareResult.changed[idx];
    if (!item) return;
    // 기존 제품 찾아서 변경 필드만 업데이트
    var existIdx = DB.products.indexOf(item.oldData);
    if (existIdx >= 0) {
      item.diffs.forEach(function(key) { DB.products[existIdx][key] = item.newData[key]; });
      // 공급가 변경 시 원가 재계산
      if (item.diffs.indexOf('supplyPrice') !== -1) {
        DB.products[existIdx].supplyPrice = item.newData.supplyPrice;
        DB.products[existIdx].cost = Math.round(calcCost(item.newData.supplyPrice, DB.products[existIdx].category || ''));
      }
      applied++;
    }
  });

  // 신규 항목 추가
  var addedChecks = document.querySelectorAll('#import-new-section input[data-type="added"]:checked');
  addedChecks.forEach(function(cb) {
    var idx = parseInt(cb.dataset.idx);
    var item = _importCompareResult.added[idx];
    if (!item) return;
    DB.products.push(item.data);
    applied++;
  });

  if (applied > 0) {
    recalcAll();
    saveAll();
    renderCatalog();
    populateCatalogFilters();
    toast('가져오기 완료: ' + applied + '건 적용');
    saveActionHistory('코드매칭', '밀워키', applied, null);
  } else {
    toast('적용할 항목이 없습니다');
  }
  closeModal();
}

// 전체 교체 실행
function executeImportFullReplace() {
  if (!_importParsedRows.length) { alert('파싱된 데이터가 없습니다'); return; }
  if (!confirm('정말 전체 교체를 실행하시겠습니까?\n기존 ' + DB.products.length + '건이 삭제되고 ' + _importParsedRows.length + '건으로 교체됩니다.')) return;

  DB.products = _importParsedRows.slice();
  recalcAll();
  saveAll();
  renderCatalog();
  populateCatalogFilters();
  saveActionHistory('전체교체', '밀워키', _importParsedRows.length, null);
  toast('전체 교체 완료: ' + _importParsedRows.length + '건');
  closeModal();
}

// ======================== SETTINGS ========================
function showSettingsModal() {
  const s = DB.settings;
  // 리베이트
  document.getElementById('set-quarter').value = ((s.quarterDC || 0.04) * 100).toFixed(1);
  document.getElementById('set-year').value = ((s.yearDC || 0.018) * 100).toFixed(1);
  // 이익율
  document.getElementById('set-mk-domae').value = s.mkDomae || 1;
  document.getElementById('set-mk-retail').value = s.mkRetail || 15;
  document.getElementById('set-mk-naver').value = s.mkNaver || 1;
  document.getElementById('set-mk-open-elec').value = s.mkOpenElec || 0.5;
  document.getElementById('set-mk-open-hand').value = s.mkOpenHand || 0.5;
  document.getElementById('set-mk-ssg-elec').value = s.mkSsgElec || 0.5;
  document.getElementById('set-mk-ssg-hand').value = s.mkSsgHand || 0.5;

  // 제품 추가 DC select 동적 채우기
  var cats = ['<option value="">분류 선택</option>'];
  var catList = [];
  try { catList = [...new Set(DB.products.map(function(p) { return p.category; }).filter(Boolean))].sort(); } catch(e) {}
  catList.forEach(function(c) { cats.push('<option value="' + c + '">' + c + '</option>'); });
  var catHtml = cats.join('');
  for (var i = 1; i <= 5; i++) {
    var el12 = document.getElementById('dc12cat' + i);
    var el13 = document.getElementById('dc13cat' + i);
    if (el12) { el12.innerHTML = catHtml; el12.style.backgroundColor = ''; el12.onchange = function() { this.style.backgroundColor = this.value ? '#e9ecef' : ''; }; }
    if (el13) { el13.innerHTML = catHtml; el13.style.backgroundColor = ''; el13.onchange = function() { this.style.backgroundColor = this.value ? '#e9ecef' : ''; }; }
  }
  // 저장된 productDCRules 값 로드
  var rules = s.productDCRules || [];
  rules.forEach(function(rule) {
    var prefix = rule.rate === 12 ? 'dc12cat' : rule.rate === 13 ? 'dc13cat' : '';
    if (!prefix) return;
    (rule.categories || []).forEach(function(cat, idx) {
      var el = document.getElementById(prefix + (idx + 1));
      if (el) { el.value = cat; el.style.backgroundColor = cat ? '#e9ecef' : ''; }
    });
  });

  // 커머셜 프로모션 값 로드 (mw_settings에서)
  var arP = s.arPromos || [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}];
  var volP = s.volPromos || [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}];
  for (var j = 0; j < 4; j++) {
    var arn = document.getElementById('os-ar-name-' + j);
    var arr = document.getElementById('os-ar-rate-' + j);
    var vln = document.getElementById('os-vol-name-' + j);
    var vlr = document.getElementById('os-vol-rate-' + j);
    if (arn) arn.value = (arP[j] && arP[j].name) || '';
    if (arr) arr.value = (arP[j] && arP[j].rate) || '';
    if (vln) vln.value = (volP[j] && volP[j].name) || '';
    if (vlr) vlr.value = (volP[j] && volP[j].rate) || '';
  }

  // 기본 탭: 밀워키 리베이트
  switchSettingsTab('rebate');
  document.getElementById('settings-modal').classList.add('show');
  var _sm = document.querySelector('#settings-modal > .modal');
  if (_sm && !_sm._dragged) { var _smH = _sm.querySelector('.modal-header'); if (_smH) _makeDraggable(_sm, _smH); }
}
function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('show');
  switchSettingsTab('rebate');
}

// ======================== 설정 모달 탭 전환 ========================
function switchSettingsTab(tab) {
  ['rebate', 'online', 'datamgmt'].forEach(function(t) {
    var el = document.getElementById('settings-tab-' + t);
    var btn = document.getElementById('stab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'datamgmt') updateDataMgmtCounts();
}

function updateDataMgmtCounts() {
  var counts = {
    products: DB.products.length,
    inventory: DB.inventory.length,
    promotions: DB.promotions.length,
    orders: (DB.orders.elec || []).length + (DB.orders.hand || []).length + (DB.orders.pack || []).length,
    orderHistory: (typeof orderHistory !== 'undefined' ? orderHistory.length : 0) + (typeof poHistory !== 'undefined' ? poHistory.length : 0),
    general: (typeof genProducts !== 'undefined' ? genProducts.length : 0),
    sales: (typeof salesItems !== 'undefined' ? salesItems.length : 0),
    estimates: (typeof estimates !== 'undefined' ? estimates.length : 0),
    setbun: (typeof setbunItems !== 'undefined' ? setbunItems.length : 0),
    settings: '현재값',
    ui: '컬럼너비'
  };
  Object.keys(counts).forEach(function(k) {
    var el = document.getElementById('dm-cnt-' + k);
    if (el) el.textContent = typeof counts[k] === 'number' ? counts[k] + '건' : counts[k];
  });
}

function executeDataReset() {
  var checks = document.querySelectorAll('#data-mgmt-items input[type="checkbox"]:checked');
  if (!checks.length) { toast('초기화할 항목을 선택하세요'); return; }
  var names = Array.from(checks).map(function(c) { return c.parentElement.querySelector('.dm-label').textContent; });
  if (!confirm('다음 항목을 초기화합니다:\n\n• ' + names.join('\n• ') + '\n\n정말 삭제하시겠습니까?')) return;
  if (!confirm('⚠️ 복구할 수 없습니다. 정말 진행하시겠습니까?')) return;

  checks.forEach(function(c) {
    var v = c.value;
    if (v === 'products') { DB.products = []; save(KEYS.products, DB.products); }
    if (v === 'inventory') { DB.inventory = []; save(KEYS.inventory, DB.inventory); }
    if (v === 'promotions') {
      DB.promotions = []; save(KEYS.promotions, DB.promotions);
      localStorage.removeItem('mw_promo_archive');
      localStorage.removeItem('mw_promo_current_month');
    }
    if (v === 'orders') {
      DB.orders = { elec: [], hand: [], pack: [] }; save(KEYS.orders, DB.orders);
      localStorage.removeItem('mw_po_orders');
      localStorage.removeItem('mw_spot_orders');
      if (typeof poOrderData !== 'undefined') poOrderData = [];
      if (typeof spotOrderData !== 'undefined') spotOrderData = [];
    }
    if (v === 'orderHistory') {
      if (typeof orderHistory !== 'undefined') { orderHistory = []; localStorage.setItem('mw_order_history', '[]'); }
      if (typeof poHistory !== 'undefined') { poHistory = []; localStorage.setItem('mw_promo_order_history', '[]'); }
    }
    if (v === 'general') {
      if (typeof genProducts !== 'undefined') { genProducts.length = 0; localStorage.setItem('mw_gen_products', '[]'); }
    }
    if (v === 'sales') {
      if (typeof salesItems !== 'undefined') { salesItems.length = 0; localStorage.setItem('mw_sales_items', '[]'); }
    }
    if (v === 'estimates') {
      if (typeof estimates !== 'undefined') { estimates.length = 0; localStorage.setItem('mw_estimates', '[]'); }
    }
    if (v === 'setbun') {
      if (typeof setbunItems !== 'undefined') { setbunItems.length = 0; localStorage.setItem('mw_setbun_items', '[]'); }
      if (typeof partsPrices !== 'undefined') { partsPrices = {}; localStorage.setItem('mw_parts_prices', '{}'); }
    }
    if (v === 'settings') {
      DB.settings = { quarterDC: 0.04, yearDC: 0.018, vat: 0.1, naverFee: 0.059, openElecFee: 0.13, openHandFee: 0.176, ssgElecFee: 0.13, ssgHandFee: 0.13, domaeFee: 0.01, mkDomae: 1, mkRetail: 15, mkNaver: 17, mkOpen: 27, promoFee1: 5.8, promoFee2: 3.6, arPromos: [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}], volPromos: [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}] };
      save(KEYS.settings, DB.settings);
      DB.rebate = []; save(KEYS.rebate, DB.rebate);
    }
    if (v === 'ui') {
      Object.keys(localStorage).forEach(function(k) {
        if (k.startsWith('mw_colwidths_')) localStorage.removeItem(k);
      });
    }
  });
  toast('선택 항목 초기화 완료');
  updateDataMgmtCounts();
  checks.forEach(function(c) { c.checked = false; });
}

function executeFullReset() {
  if (!confirm('⚠️ 모든 데이터가 삭제됩니다.\n엑셀 백업을 하셨습니까?')) return;
  if (!confirm('정말 전체 초기화를 진행하시겠습니까?\n이 작업은 복구할 수 없습니다.')) return;
  var input = prompt('전체 초기화를 진행하려면 "초기화"를 입력하세요:');
  if (input !== '초기화') { toast('초기화가 취소되었습니다'); return; }
  localStorage.clear();
  toast('전체 초기화 완료. 새로고침합니다...');
  setTimeout(function() { location.reload(); }, 1000);
}

// 커머셜 프로모션은 설정 팝업(mw_settings)에서 통합 관리

async function syncInventory() {
  // 1) mw_products + mw_gen_products에서 관리코드 수집
  var allItems = [];
  DB.products.forEach(function(p, i) {
    var mc = (p.manageCode || '').trim();
    if (mc && mc !== '-') {
      allItems.push({ source: 'mw', code: p.code, manageCode: mc, index: i });
    }
  });
  var gp = [];
  try { gp = JSON.parse(localStorage.getItem('mw_gen_products') || '[]') || []; } catch(e) { gp = []; }
  gp.forEach(function(p, i) {
    var mc = (p.manageCode || '').trim();
    if (mc && mc !== '-') {
      allItems.push({ source: 'gen', code: p.code, manageCode: mc, index: i });
    }
  });

  if (allItems.length === 0) {
    toast('관리코드가 있는 품목이 없습니다');
    return;
  }

  var mwCount = allItems.filter(function(x){return x.source==='mw'}).length;
  var genCount = allItems.filter(function(x){return x.source==='gen'}).length;
  console.log('[재고동기화] 시작 — 총 ' + allItems.length + '건 (mw: ' + mwCount + ', gen: ' + genCount + ')');

  // 2) 진행상황 표시
  var total = allItems.length;
  var updatedMw = 0;
  var updatedGen = 0;
  var notFound = [];
  var errors = [];

  // 3) 200개씩 배치 분할 → 병렬 호출 (Promise.all)
  var BATCH = 200;
  var batches = [];
  for (var b = 0; b < allItems.length; b += BATCH) {
    batches.push(allItems.slice(b, b + BATCH));
  }
  console.log('[재고동기화] 배치 ' + batches.length + '개로 분할 (각 최대 ' + BATCH + '건), 병렬 호출');
  toast('재고 조회 중... ' + total + '건 (' + batches.length + '개 배치)');

  // 배치별 fetch 함수
  function fetchBatch(batch, batchIdx) {
    var codes = batch.map(function(item) { return item.manageCode; });
    console.log('[재고동기화] 배치 ' + (batchIdx+1) + ' 전송: ' + codes.length + '건, 샘플: ' + codes.slice(0,3).join(', '));
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 60000);

    return fetch('/api/erp/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: codes }),
      signal: controller.signal
    }).then(function(resp) {
      clearTimeout(timeoutId);
      if (!resp.ok) {
        return resp.json().catch(function() { return {}; }).then(function(errData) {
          throw new Error(errData.error || resp.statusText);
        });
      }
      return resp.json();
    }).then(function(data) {
      console.log('[재고동기화] 배치 ' + (batchIdx+1) + ' 응답:', JSON.stringify({
        results: data.results ? data.results.length + '건' : 'null',
        errors: data.errors || [],
        sample: data.results && data.results.length > 0 ? data.results.slice(0, 3) : 'empty'
      }));
      return { batch: batch, data: data, error: null };
    }).catch(function(err) {
      clearTimeout(timeoutId);
      var msg = err.name === 'AbortError' ? '타임아웃 (60초)' : (err.message || '네트워크 오류');
      console.error('[재고동기화] 배치 ' + (batchIdx+1) + ' 오류:', msg);
      return { batch: batch, data: null, error: '배치 ' + (batchIdx+1) + ': ' + msg };
    });
  }

  // 4) 병렬 호출
  var promises = batches.map(function(batch, idx) { return fetchBatch(batch, idx); });
  var results = await Promise.all(promises);

  // 5) 결과 처리
  results.forEach(function(result) {
    if (result.error) {
      errors.push(result.error);
      return;
    }
    var data = result.data;
    var batch = result.batch;

    // 관리코드 → 재고 맵
    var stockMap = {};
    (data.results || []).forEach(function(r) {
      stockMap[r.code] = r.stock;
    });

    var mapKeys = Object.keys(stockMap);
    console.log('[재고동기화] stockMap 키 ' + mapKeys.length + '개, 샘플:', mapKeys.slice(0, 5).map(function(k) { return k + '=' + stockMap[k]; }).join(', '));

    if (data.errors && data.errors.length > 0) {
      console.warn('[재고동기화] API 오류 목록:', data.errors);
      errors = errors.concat(data.errors);
    }

    // 각 품목에 재고 반영
    batch.forEach(function(item) {
      var stock = stockMap[item.manageCode];
      if (stock === undefined || stock === null) {
        notFound.push(item.manageCode);
        return;
      }

      if (item.source === 'mw') {
        var inv = DB.inventory.find(function(i) { return String(i.code) === String(item.code); });
        if (inv) {
          inv.stock = stock;
        } else {
          DB.inventory.push({ code: item.code, stock: stock, note1: '', note2: '' });
        }
        updatedMw++;
      } else if (item.source === 'gen') {
        if (gp[item.index]) {
          gp[item.index].stock = stock;
          updatedGen++;
        }
      }
    });
  });

  // 6) localStorage 저장
  save(KEYS.inventory, DB.inventory);
  localStorage.setItem('mw_gen_products', JSON.stringify(gp)); autoSyncToSupabase('mw_gen_products');

  // 7) 테이블 새로고침
  if (typeof renderCatalog === 'function') renderCatalog();
  if (typeof renderGenProducts === 'function') renderGenProducts();
  if (typeof updateStatus === 'function') updateStatus();

  // 8) 완료 시간 저장 및 표시
  var now = new Date();
  var dateTimeStr = now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  localStorage.setItem('last_inventory_sync', dateTimeStr);
  updateSyncTimeDisplay();

  // 9) 완료 알림 + 디버깅 로그
  var totalUpdated = updatedMw + updatedGen;
  console.log('[재고동기화] 완료 — 밀워키: ' + updatedMw + '건, 일반: ' + updatedGen + '건, 매칭실패: ' + notFound.length + '건, 오류: ' + errors.length + '건');
  if (notFound.length > 0) {
    console.log('[재고동기화] 매칭 안 된 관리코드:', notFound.slice(0, 20).join(', ') + (notFound.length > 20 ? ' 외 ' + (notFound.length - 20) + '건' : ''));
  }
  var msg = '재고 업데이트 완료 — 밀워키 ' + updatedMw + '건';
  if (updatedGen > 0) msg += ' + 일반 ' + updatedGen + '건';
  if (errors.length > 0) {
    msg += ' | 오류 ' + errors.length + '건';
    console.warn('[재고동기화 오류]', errors);
  }
  toast(msg);
}

function updateSyncTimeDisplay() {
  var el = document.getElementById('inventory-sync-time');
  if (!el) return;
  var saved = localStorage.getItem('last_inventory_sync');
  if (saved) {
    el.textContent = '✓ ' + saved;
  } else {
    el.textContent = '';
  }
}


// 발주용 매입원가 계산 (분기+년간+커머셜 모두 적용)
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
  // 제품 추가 DC (카테고리 기반) — 개별 계산
  (s.productDCRules || []).forEach(function(rule) {
    if (rule.rate > 0 && rule.categories && rule.categories.indexOf(category) !== -1) {
      volTotal += price - (price / (1 + rule.rate / 100));
    }
  });
  // 최종: 공급가 - AR할인합계 - 물량할인합계
  return price - arTotal - volTotal;
}

function applySettings() {
  function pv(id, def) { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? def : v; }
  DB.settings.quarterDC = pv('set-quarter', 4) / 100;
  DB.settings.yearDC = pv('set-year', 1.8) / 100;
  DB.settings.mkDomae = pv('set-mk-domae', 1);
  DB.settings.mkRetail = pv('set-mk-retail', 15);
  DB.settings.mkNaver = pv('set-mk-naver', 1);
  DB.settings.mkOpenElec = pv('set-mk-open-elec', 0.5);
  DB.settings.mkOpenHand = pv('set-mk-open-hand', 0.5);
  DB.settings.mkSsgElec = pv('set-mk-ssg-elec', 0.5);
  DB.settings.mkSsgHand = pv('set-mk-ssg-hand', 0.5);
  DB.settings.vat = 0.1;

  // 제품 추가 DC 규칙 저장
  var dc12cats = [], dc13cats = [];
  for (var i = 1; i <= 5; i++) {
    var v12 = document.getElementById('dc12cat' + i); if (v12 && v12.value) dc12cats.push(v12.value);
    var v13 = document.getElementById('dc13cat' + i); if (v13 && v13.value) dc13cats.push(v13.value);
  }
  DB.settings.productDCRules = [
    { rate: 12, categories: dc12cats },
    { rate: 13, categories: dc13cats }
  ];

  // 커머셜 프로모션 저장 (mw_settings에 통합)
  DB.settings.arPromos = [];
  DB.settings.volPromos = [];
  for (var j = 0; j < 4; j++) {
    var arRate = parseFloat((document.getElementById('os-ar-rate-' + j) || {}).value);
    var volRate = parseFloat((document.getElementById('os-vol-rate-' + j) || {}).value);
    DB.settings.arPromos.push({ name: ((document.getElementById('os-ar-name-' + j) || {}).value || '').trim(), rate: isNaN(arRate) ? 0 : arRate });
    DB.settings.volPromos.push({ name: ((document.getElementById('os-vol-name-' + j) || {}).value || '').trim(), rate: isNaN(volRate) ? 0 : volRate });
  }

  save(KEYS.settings, DB.settings);
  recalcAll();
  closeSettingsModal();
  toast(`설정 적용 완료 — ${DB.products.length}건 재계산됨`);
}

function recalcAll() {
  var s = DB.settings;
  var naverFee = s.naverFee || 0.0663;
  var openElecFee = s.openElecFee || 0.13;
  var openHandFee = s.openHandFee || 0.176;
  // 변경 전 값 저장 (이력 비교용)
  var _oldPrices = {};
  DB.products.forEach(function(p) {
    if (p.code) _oldPrices[p.code] = { naver: p.priceNaver || 0, gmarket: p.priceOpen || 0, ssg: p.priceSsg || 0 };
  });

  DB.products.forEach(function(p) {
    if (!p.supplyPrice) return;
    var cost = calcCost(p.supplyPrice, p.category || '');
    p.cost = Math.round(cost);

    // 도매: 단순 마크업, 백원 반올림
    p.priceA = Math.ceil(cost * (1 + (s.mkDomae || 1) / 100) / 100) * 100;

    // 소매: 단순 마크업, 천원 반올림
    p.priceRetail = Math.ceil(cost * (1 + (s.mkRetail || 15) / 100) / 1000) * 1000;

    // 스토어팜: 수수료+VAT 역산, 백원 반올림
    var naverDenom = 10/11 - naverFee - (s.mkNaver || 1) / 100;
    p.priceNaver = naverDenom > 0 ? Math.ceil(cost / naverDenom / 100) * 100 : 0;

    // 오픈마켓: 대분류 기준 수수료 적용
    var isElec = (p.category === '파워툴');
    var openFee = isElec ? openElecFee : openHandFee;
    var openRate = isElec ? (s.mkOpenElec || 0.5) : (s.mkOpenHand || 0.5);
    var openDenom = 10/11 - openFee - openRate / 100;
    p.priceOpen = openDenom > 0 ? Math.ceil(cost / openDenom / 100) * 100 : 0;

    // SSG: 대분류 기준 수수료 적용 (VAT포함 역산, 네이버/오픈마켓과 동일 방식)
    var ssgFee = isElec ? (s.ssgElecFee || 0.13) : (s.ssgHandFee || 0.13);
    var ssgRate = isElec ? (s.mkSsgElec || 0.5) : (s.mkSsgHand || 0.5);
    var ssgDenom = 10/11 - ssgFee - ssgRate / 100;
    p.priceSsg = ssgDenom > 0 ? Math.ceil(cost / ssgDenom / 100) * 100 : 0;
  });

  // 가격 변동 이력 기록
  var reason = '가격 재계산';
  DB.products.forEach(function(p) {
    if (!p.code) return;
    var old = _oldPrices[p.code];
    if (!old) return;
    if (old.naver !== (p.priceNaver || 0)) recordPriceChange(p.code, 'naver', old.naver, p.priceNaver || 0, reason);
    if (old.gmarket !== (p.priceOpen || 0)) recordPriceChange(p.code, 'gmarket', old.gmarket, p.priceOpen || 0, reason);
    if (old.ssg !== (p.priceSsg || 0)) recordPriceChange(p.code, 'ssg', old.ssg, p.priceSsg || 0, reason);
  });
  savePriceHistory();

  // 프로모션 원가 재계산
  DB.promotions.forEach(function(pr) {
    if (pr.promoPrice > 0) {
      var prod = pr.code ? findProduct(pr.code) : null;
      var pCat = prod ? (prod.category || '') : '';
      pr.cost = Math.round(calcCost(pr.promoPrice, pCat));
    }
  });

  save(KEYS.products, DB.products);
  save(KEYS.promotions, DB.promotions);
  save(KEYS.inventory, DB.inventory);
  populateCatalogFilters();
  renderCatalog();
}

// ======================== PROMO CRUD ========================
function showPromoAddModal() {
  document.getElementById('promo-edit-title').textContent = '프로모션 추가';
  document.getElementById('promo-edit-idx').value = -1;
  ['pe-promoCode','pe-promoName','pe-model','pe-orderNum','pe-dealerPrice','pe-promoPrice','pe-discountRate','pe-period'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pe-qty').value = '1';
  document.getElementById('promo-edit-modal').classList.add('show');
}
function closePromoModal() { document.getElementById('promo-edit-modal').classList.remove('show'); }

function editPromo(idx) {
  const p = DB.promotions[idx];
  if (!p) return;
  document.getElementById('promo-edit-title').textContent = '프로모션 수정';
  document.getElementById('promo-edit-idx').value = idx;
  document.getElementById('pe-promoCode').value = p.promoCode || '';
  document.getElementById('pe-promoName').value = p.promoName || '';
  document.getElementById('pe-model').value = p.model || '';
  document.getElementById('pe-orderNum').value = p.orderNum || '';
  document.getElementById('pe-qty').value = p.qty || 1;
  document.getElementById('pe-dealerPrice').value = p.dealerPrice || '';
  document.getElementById('pe-promoPrice').value = p.promoPrice ?? '';
  document.getElementById('pe-discountRate').value = p.discountDisplay || p.discountRate || '';
  document.getElementById('pe-period').value = p.period || '';
  document.getElementById('promo-edit-modal').classList.add('show');
}

function calcPromoCost(promoPrice, category) {
  // 프로모션 공급가에 동일한 설정값(리베이트+커머셜) 적용
  if (!promoPrice || promoPrice <= 0) return 0;
  return calcCost(promoPrice, category || '');
}

function savePromo() {
  const idx = parseInt(document.getElementById('promo-edit-idx').value);
  const promoPrice = parseInt(document.getElementById('pe-promoPrice').value) || 0;
  // 기존 프로모션에 code가 있으면 제품DC 참조
  const existingCode = idx >= 0 ? (DB.promotions[idx]?.code || '') : '';
  const linkedProd = existingCode ? findProduct(existingCode) : null;
  const cost = calcPromoCost(promoPrice, linkedProd ? linkedProd.productDC : 0);
  const discountRaw = document.getElementById('pe-discountRate').value.trim();

  const dealerPrice = parseInt(document.getElementById('pe-dealerPrice').value) || 0;
  const isFree = promoPrice === 0;
  const autoDisplay = calcDiscountDisplay(discountRaw, dealerPrice, promoPrice, isFree);
  const autoRate = discountRaw ? (parseFloat(discountRaw) / 100 || calcDiscountRate(0, dealerPrice, promoPrice)) : calcDiscountRate(0, dealerPrice, promoPrice);

  const item = {
    promoCode: document.getElementById('pe-promoCode').value,
    promoName: document.getElementById('pe-promoName').value,
    model: document.getElementById('pe-model').value,
    orderNum: document.getElementById('pe-orderNum').value,
    qty: parseInt(document.getElementById('pe-qty').value) || 1,
    dealerPrice: dealerPrice,
    promoPrice: promoPrice,
    discountDisplay: autoDisplay,
    discountRate: autoRate,
    period: document.getElementById('pe-period').value,
    cost: Math.round(cost),
    month: DB.currentPromoMonth
  };

  if (idx >= 0) {
    DB.promotions[idx] = { ...DB.promotions[idx], ...item };
  } else {
    DB.promotions.push(item);
  }
  save(KEYS.promotions, DB.promotions);
  closePromoModal();
  renderPromo();
  toast(idx >= 0 ? '프로모션 수정 완료' : '프로모션 추가 완료');
}

function deletePromo(idx) {
  if (!confirm(`"${DB.promotions[idx]?.promoName || ''}" 프로모션을 삭제하시겠습니까?`)) return;
  DB.promotions.splice(idx, 1);
  save(KEYS.promotions, DB.promotions);
  renderPromo();
  toast('프로모션 삭제 완료');
}

// ======================== PROMO MONTHLY MANAGEMENT ========================
function initPromoMonths() {
  const now = new Date();
  const curMonth = (now.getMonth() + 1) + '월';
  DB.currentPromoMonth = loadObj('mw_promo_current_month', curMonth);
  const archive = loadObj('mw_promo_archive', {});

  // Build month selector
  const sel = document.getElementById('promo-month-select');
  const months = Object.keys(archive);
  if (!months.includes(DB.currentPromoMonth)) months.push(DB.currentPromoMonth);
  months.sort((a, b) => parseInt(a) - parseInt(b));

  sel.innerHTML = months.map(m => `<option value="${m}" ${m === DB.currentPromoMonth ? 'selected' : ''}>${m}</option>`).join('');
  document.getElementById('promo-month-label').textContent = DB.currentPromoMonth;
}

function switchPromoMonth(month) {
  // Save current month's data to archive
  const archive = loadObj('mw_promo_archive', {});
  archive[DB.currentPromoMonth] = DB.promotions;
  localStorage.setItem('mw_promo_archive', JSON.stringify(archive));

  // Load target month
  DB.currentPromoMonth = month;
  localStorage.setItem('mw_promo_current_month', JSON.stringify(month));
  DB.promotions = archive[month] || [];
  save(KEYS.promotions, DB.promotions);

  document.getElementById('promo-month-label').textContent = month;
  renderPromo();
  toast(`${month} 프로모션 로드 (${DB.promotions.length}건)`);
}

function archiveAndNewMonth() {
  const curNum = parseInt(DB.currentPromoMonth);
  const nextMonth = (curNum >= 12 ? 1 : curNum + 1) + '월';

  if (!confirm(`현재 ${DB.currentPromoMonth} 프로모션(${DB.promotions.length}건)을 저장하고, ${nextMonth}로 새로 시작하시겠습니까?`)) return;

  const archive = loadObj('mw_promo_archive', {});
  archive[DB.currentPromoMonth] = [...DB.promotions];
  localStorage.setItem('mw_promo_archive', JSON.stringify(archive));

  DB.currentPromoMonth = nextMonth;
  localStorage.setItem('mw_promo_current_month', JSON.stringify(nextMonth));
  DB.promotions = [];
  save(KEYS.promotions, DB.promotions);

  initPromoMonths();
  renderPromo();
  toast(`${nextMonth} 프로모션 시작 (이전 ${archive[Object.keys(archive).pop()]?.length || 0}건 저장됨)`);
}

function clearAllPromos() {
  if (!DB.promotions.length) { toast('삭제할 프로모션이 없습니다'); return; }
  if (!confirm(`현재 ${DB.currentPromoMonth} 프로모션 ${DB.promotions.length}건을 전부 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
  DB.promotions = [];
  save(KEYS.promotions, DB.promotions);
  renderPromo();
  toast('프로모션 일괄 삭제 완료');
}

function importExcel() {
  const file = document.getElementById('import-file-input').files[0];
  if (!file) { toast('파일을 선택해주세요'); return; }

  const status = document.getElementById('import-status');
  status.textContent = '📂 파일 읽는 중...';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      let imported = { products: 0, inventory: 0, promotions: 0, rebate: 0 };

      // Show detected sheets
      const sheets = wb.SheetNames;
      status.innerHTML = `<div style="margin-bottom:8px"><b>📋 감지된 시트 (${sheets.length}개):</b></div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">${sheets.map(s => `<span class="badge badge-blue">${s}</span>`).join('')}</div>
        <div>⏳ 데이터 파싱 중...</div>`;

      // 1. 재고 시트 — fuzzy match
      const stockSheet = sheets.find(s => s === '재고') || sheets.find(s => s.includes('재고'));
      if (stockSheet) {
        const data = XLSX.utils.sheet_to_json(wb.Sheets[stockSheet], { header: 1 });
        DB.inventory = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row && row[1]) {
            DB.inventory.push({ code: String(row[1]), stock: row[2] || 0, note1: row[3] || '', note2: row[4] || '' });
          }
        }
        imported.inventory = DB.inventory.length;
      }

      // 2. 전체가격표 시트 — fuzzy match
      const priceSheet = sheets.find(s => s === '전체가격표(26.04 인상)') ||
        sheets.find(s => s === '전체가격표(25)') ||
        sheets.find(s => s.includes('가격표') && s.includes('26')) ||
        sheets.find(s => s.includes('가격표') && s.includes('25')) ||
        sheets.find(s => s.includes('가격표')) ||
        null;

      if (priceSheet) {
        const ws = wb.Sheets[priceSheet];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const is26 = priceSheet.includes('26');
        
        // Auto-detect header row and column positions
        let headerRow = -1;
        let col = {};
        for (let r = 0; r < Math.min(10, data.length); r++) {
          const row = data[r];
          if (!row) continue;
          const cells = row.map(v => String(v || '').trim());
          if (cells.includes('코드') && cells.includes('모델명')) {
            headerRow = r;
            cells.forEach((v, i) => {
              if (v === '단종') col.단종 = i;
              if (v === '코드') col.코드 = i;
              if (v === '관리코드') col.관리코드 = i;
              if (v === '대분류') col.대분류 = i;
              if (v === '중분류') col.중분류 = i;
              if (v === '소분류') col.소분류 = i;
              if (v === '순번') col.순번 = i;
              if (v.includes('TTI')) col.TTI = i;
              if (v === '모델명') col.모델명 = i;
              if (v === '제품설명') col.제품설명 = i;
              if (v === '공급가') col.공급가 = i;
              if (v === '제품DC') col.제품DC = i;
              if (v === '원가') col.원가 = i;
              if (v === '인상가') col.인상가 = i;
              if (v === '인상률') col.인상률 = i;
              if (v === '재고') col.재고 = i;
              if (v === '입고날짜' || v === '입고일') col.입고날짜 = i;
              if (v === '본사가용' || v === '가용수량' || v === '본사') col.본사가용 = i;
            });
            break;
          }
        }

        // Read discount rates from the row before header (typically row 3, index 2)
        if (headerRow >= 2) {
          const rateRow = data[headerRow - 1];
          if (rateRow) {
            // Find first numeric values in sequence (분기, 년간, 부가세, 네이버...)
            const nums = [];
            for (let c = 0; c < 15; c++) {
              if (typeof rateRow[c] === 'number' && rateRow[c] > 0 && rateRow[c] < 1) nums.push({ c, v: rateRow[c] });
            }
            if (nums.length >= 4) {
              DB.settings.quarterDC = nums[0].v;
              DB.settings.yearDC = nums[1].v;
              DB.settings.vat = nums[2].v;
              DB.settings.naverFee = nums[3].v;
              if (nums[4]) DB.settings.openElecFee = nums[4].v;
              if (nums[5]) DB.settings.openHandFee = nums[5].v;
              if (nums[6]) DB.settings.domaeFee = nums[6].v;
            }
          }
        }

        // 업로드 모드 확인
        var importMode = 'replace';
        var modeRadios = document.querySelectorAll('input[name="import-mode"]');
        modeRadios.forEach(function(r) { if (r.checked) importMode = r.value; });

        if (importMode === 'replace') {
          DB.products = [];
        }

        var updatedCount = 0;
        var addedCount = 0;
        var changes = [];
        const dataStart = headerRow + 2;
        for (let i = dataStart; i < data.length; i++) {
          const row = data[i];
          const code = row && row[col.코드 ?? 2];
          if (!code && !(row[col.모델명 ?? 8])) continue;

          const supplyPrice = row[col.공급가 ?? 10] || 0;
          const importCategory = row[col.대분류 ?? 3] || '';
          const costVal = row[col.원가 ?? (is26 ? 14 : 12)] || 0;
          const cost = costVal || calcCost(supplyPrice, importCategory);

          var newItem = {
            discontinued: (String(row[col.단종 ?? 1] || '').trim() === '단종') ? '단종' : '',
            code: String(code || ''),
            manageCode: col.관리코드 != null ? String(row[col.관리코드] || '') : '',
            category: row[col.대분류 ?? 3] || '',
            subcategory: row[col.중분류 ?? 4] || '',
            detail: row[col.소분류 ?? 5] || '',
            orderNum: row[col.순번 ?? 6] || '',
            ttiNum: String(row[col.TTI ?? 7] || ''),
            model: (function(){ var m = row[col.모델명 ?? 8] || ''; var d = row[col.제품설명 ?? 9] || ''; return d ? m + ' / ' + d : m; })(),
            supplyPrice: supplyPrice,
            productDC: 0,
            cost: Math.round(cost || 0),
            priceA: 0, priceRetail: 0, priceNaver: 0, priceOpen: 0,
            raisedPrice: is26 ? (row[col.인상가 ?? 11] || 0) : 0,
            raiseRate: is26 ? (row[col.인상률 ?? 12] || 0) : 0,
            ttiStock: col.본사가용 != null ? String(row[col.본사가용] || '') : '',
            inDate: col.입고날짜 != null ? String(row[col.입고날짜] || '') : ''
          };

          if (importMode === 'merge') {
            var existIdx = code ? DB.products.findIndex(function(p) { return String(p.code) === String(code); }) : -1;
            if (existIdx >= 0) {
              var exist = DB.products[existIdx];
              if (exist.orderNum && newItem.orderNum && String(exist.orderNum) !== String(newItem.orderNum)) {
                changes.push('순번 변경: ' + exist.model + ' (' + exist.orderNum + ' → ' + newItem.orderNum + ')');
              }
              if (exist.ttiNum && newItem.ttiNum && String(exist.ttiNum) !== String(newItem.ttiNum)) {
                changes.push('TTI# 변경: ' + exist.model + ' (' + exist.ttiNum + ' → ' + newItem.ttiNum + ')');
              }
              Object.keys(newItem).forEach(function(key) {
                if (key === 'priceA' || key === 'priceRetail' || key === 'priceNaver' || key === 'priceOpen') return;
                if (newItem[key] !== '' && newItem[key] !== 0 && newItem[key] !== null) {
                  exist[key] = newItem[key];
                }
              });
              updatedCount++;
            } else {
              DB.products.push(newItem);
              addedCount++;
            }
          } else {
            DB.products.push(newItem);
            addedCount++;
          }

          if (code && col.재고 != null && row[col.재고] != null) {
            const stockCode = String(code);
            const existingStock = DB.inventory.find(s => String(s.code) === stockCode);
            if (existingStock) {
              existingStock.stock = parseInt(row[col.재고]) || 0;
            } else {
              DB.inventory.push({ code: stockCode, stock: parseInt(row[col.재고]) || 0, note1: '', note2: '' });
            }
          }
        }

        if (importMode === 'merge') {
          imported.products = updatedCount + addedCount;
          imported.mergeInfo = '업데이트: ' + updatedCount + '건, 신규추가: ' + addedCount + '건';
          if (changes.length > 0) imported.changes = changes;
        } else {
          imported.products = DB.products.length;
        }
        imported.priceSheet = priceSheet;
        imported.headerInfo = `헤더 Row${headerRow+1}, 컬럼 ${Object.keys(col).length}개 감지`;
        save(KEYS.settings, DB.settings);
      }

      // 3. 프로모션 시트 — fuzzy match
      const promoSheet = sheets.find(s => s === '프로모션') || sheets.find(s => s.includes('프로모션'));
      if (promoSheet) {
        const data = XLSX.utils.sheet_to_json(wb.Sheets[promoSheet], { header: 1 });
        // Row 1: B1=프로모션 수수료1 (0.058), C1=프로모션 수수료2 (0.036)
        if (data[0]) {
          DB.settings.promoFee1 = parseFloat(((data[0][1] || 0.058) * 100).toFixed(2));
          DB.settings.promoFee2 = parseFloat(((data[0][2] || 0.036) * 100).toFixed(2));
        }
        DB.promotions = [];
        for (let i = 2; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[1]) continue;
          DB.promotions.push({
            code: String(row[1]),
            cost: row[2] || 0,
            period: row[3] || '',
            promoCode: row[4] || '',
            promoName: row[5] || '',
            model: row[6] || '',
            orderNum: row[7] || '',
            dealerPrice: row[8] || 0,
            promoPrice: row[9] || 0,
            qty: row[10] || 0,
            discountRate: row[11] || 0,
            limitQty: row[12] || '',
            periodDetail: row[13] || '',
            note: row[14] || '',
            memo: row[17] || ''
          });
        }
        imported.promotions = DB.promotions.length;
      }

      // 4. R (리베이트) 시트 — fuzzy match
      const rebateSheet = sheets.find(s => s === 'R') || sheets.find(s => s.includes('리베이트'));
      if (rebateSheet) {
        const data = XLSX.utils.sheet_to_json(wb.Sheets[rebateSheet], { header: 1 });
        DB.rebate = [];
        for (let i = 2; i < 12; i++) {
          const row = data[i];
          if (row && row[2] && row[3]) {
            DB.rebate.push({ min: row[2], rate: row[3] });
          }
        }
        if (DB.rebate.length) {
          save(KEYS.rebate, DB.rebate);
          imported.rebate = DB.rebate.length;
        }
      }

      saveAll();
      recalcAll();
      populateCatalogFilters();

      // Detailed result with match info
      const matchInfo = [
        { name: '가격표', sheet: priceSheet, count: imported.products },
        { name: '재고', sheet: stockSheet, count: imported.inventory },
        { name: '프로모션', sheet: promoSheet, count: imported.promotions },
        { name: '리베이트', sheet: rebateSheet, count: imported.rebate }
      ];
      const totalImported = imported.products + imported.inventory + imported.promotions;

      if (totalImported === 0) {
        status.innerHTML = `<div style="margin-bottom:8px"><b>📋 감지된 시트 (${sheets.length}개):</b></div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">${sheets.map(s => `<span class="badge badge-gray">${s}</span>`).join('')}</div>
          <div style="color:#CC2222;font-weight:600;margin-bottom:8px">⚠ 데이터를 가져올 수 없습니다</div>
          <div style="font-size:12px;color:#5A6070">
            이 파일에서 인식 가능한 시트를 찾지 못했습니다.<br>
            원본 <b>밀워키.xlsx</b> 파일에는 아래 시트가 있어야 합니다:<br>
            <span class="badge badge-blue" style="margin:2px">재고</span>
            <span class="badge badge-blue" style="margin:2px">전체가격표(25)</span>
            <span class="badge badge-blue" style="margin:2px">전체가격표(26.04 인상)</span>
            <span class="badge badge-blue" style="margin:2px">프로모션</span>
            <span class="badge badge-blue" style="margin:2px">R</span>
          </div>`;
      } else {
        status.innerHTML = `<div style="color:#1D9E75;font-weight:600;margin-bottom:8px">✅ 가져오기 완료!</div>
          <table style="font-size:12px;width:100%;border-collapse:collapse">
            ${matchInfo.map(m => `<tr style="border-bottom:1px solid #F0F2F7">
              <td style="padding:4px 8px;font-weight:600">${m.name}</td>
              <td style="padding:4px 8px;color:#5A6070">${m.sheet ? `→ "${m.sheet}"` : '<span style="color:#CC2222">시트 없음</span>'}</td>
              <td style="padding:4px 8px;text-align:right;font-weight:600;${m.count > 0 ? 'color:#1D9E75' : 'color:#9BA3B2'}">${m.count > 0 ? m.count + (m.name === '리베이트' ? '구간' : '건') : '-'}</td>
            </tr>`).join('')}
          </table>
          ${imported.mergeInfo ? '<div style="margin-top:8px;color:#185FA5;font-weight:600">📋 ' + imported.mergeInfo + '</div>' : ''}
          ${imported.changes && imported.changes.length > 0 ? '<div style="margin-top:8px;padding:8px 12px;background:#FAEEDA;border-radius:6px;font-size:12px;color:#412402"><div style="font-weight:600;margin-bottom:4px">⚠ 순번/TTI# 변경 감지 (' + imported.changes.length + '건)</div>' + imported.changes.map(function(c){ return '<div>• ' + c + '</div>'; }).join('') + '</div>' : ''}
          <div style="margin-top:8px;font-size:11px;color:#5A6070">${imported.headerInfo ? '📊 ' + imported.headerInfo + ' | ' : ''}⚙ 분기 ${(DB.settings.quarterDC*100).toFixed(1)}% | 년간 ${(DB.settings.yearDC*100).toFixed(1)}% | 네이버 ${(DB.settings.naverFee*100).toFixed(1)}% | 오픈전동 ${(DB.settings.openElecFee*100).toFixed(1)}%</div>`;
      }

      if (totalImported > 0) {
        var actionName = importMode === 'merge' ? '코드매칭' : '전체교체';
        saveActionHistory(actionName, '밀워키', imported.products || totalImported, null);
      }
      toast(totalImported > 0 ? `가져오기 완료 (제품 ${imported.products}건)` : '⚠ 인식 가능한 시트가 없습니다');
      if (totalImported > 0) setTimeout(closeModal, 2500);
    } catch (err) {
      status.innerHTML = `<div style="color:#CC2222;font-weight:600">❌ 파일 읽기 오류</div><div style="font-size:12px;margin-top:4px">${err.message}</div>`;
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ======================== EXPORT ALL ========================
function exportAll() {
  if (!window.XLSX) { toast('SheetJS 라이브러리 로딩 중...'); return; }
  const wb = XLSX.utils.book_new();

  // Products
  if (DB.products.length) {
    const pData = [['단종', '코드', '관리코드', '대분류', '제품군', '제품구성', '프로모션No.', '제품번호', '모델명', '공급가', '원가', 'A(도매)', '소매', '스토어팜', '오픈마켓', 'SSG']];
    DB.products.forEach(p => pData.push([p.discontinued, p.code, p.manageCode || '', p.category, p.subcategory, p.detail, p.orderNum, p.ttiNum, p.model, p.supplyPrice, p.cost, p.priceA, p.priceRetail, p.priceNaver, p.priceOpen, p.priceSsg || 0]));
    const ws = XLSX.utils.aoa_to_sheet(pData);
    ws['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, '전체가격표');
  }

  // Inventory
  if (DB.inventory.length) {
    const iData = [['코드', '재고', '비고1', '비고2']];
    DB.inventory.forEach(i => iData.push([i.code, i.stock, i.note1, i.note2]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(iData), '재고');
  }

  // Promotions
  if (DB.promotions.length) {
    const prData = [['코드', '구분', '프로모션명', '모델명', '순번', '대리점가격', '프로모션금액', '할인율', '기간']];
    DB.promotions.forEach(p => prData.push([p.code, p.promoCode, p.promoName, p.model, p.orderNum, p.dealerPrice, p.promoPrice, p.discountRate, p.period]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prData), '프로모션');
  }

  XLSX.writeFile(wb, `밀워키_전체데이터_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('전체 데이터 엑셀 파일 다운로드 완료');
}

function exportGenProducts() {
  if (!window.XLSX) { toast('SheetJS 라이브러리 로딩 중...'); return; }
  var gp = [];
  try { gp = JSON.parse(localStorage.getItem('mw_gen_products') || '[]') || []; } catch(e) { gp = []; }
  if (!gp.length) { toast('내보낼 일반제품 데이터가 없습니다'); return; }
  var wb = XLSX.utils.book_new();
  var data = [['코드', '관리코드', '대분류', '모델 및 규격', '제품설명 및 품명', '원가', '도매(A)', '스토어팜', '오픈마켓', 'IN수량', 'IN단가', 'OUT수량', 'OUT단가', '파레트수량', '파레트단가', '비고', '입고날짜']];
  gp.forEach(function(p) {
    data.push([p.code, p.manageCode || '', p.category || '', p.model || '', p.description || '', p.cost || 0, p.priceA || 0, p.priceNaver || 0, p.priceOpen || 0, p.inQty || 0, p.inPrice || 0, p.outQty || 0, p.outPrice || 0, p.palletQty || 0, p.palletPrice || 0, p.memo || '', p.inDate || '']);
  });
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, '일반제품');
  XLSX.writeFile(wb, '일반제품_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('일반제품 엑셀 다운로드 완료 (' + gp.length + '건)');
}

// ======================== 작업이력 ========================
function getActionHistory() {
  try { return JSON.parse(localStorage.getItem('mw_action_history') || '[]'); } catch(e) { return []; }
}

function saveActionHistory(action, target, count, backupData) {
  var history = getActionHistory();
  var now = new Date();
  var timeStr = now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  history.unshift({
    action: action,
    target: target,
    count: count,
    time: timeStr,
    backup: backupData
  });
  // 최대 5건
  if (history.length > 5) history = history.slice(0, 5);
  localStorage.setItem('mw_action_history', JSON.stringify(history));
}

function renderActionHistory() {
  var history = getActionHistory();
  var emptyEl = document.getElementById('action-history-empty');
  var tableEl = document.getElementById('action-history-table');
  var bodyEl = document.getElementById('action-history-body');
  if (!emptyEl || !tableEl || !bodyEl) return;

  if (!history.length) {
    emptyEl.style.display = '';
    tableEl.style.display = 'none';
    return;
  }
  emptyEl.style.display = 'none';
  tableEl.style.display = '';

  var badgeStyles = {
    '전체삭제': 'background:#FEE2E2;color:#991B1B',
    '제품삭제': 'background:#FEE2E2;color:#991B1B',
    '가져오기': 'background:#DBEAFE;color:#1E40AF',
    '전체교체': 'background:#DBEAFE;color:#1E40AF',
    '코드매칭': 'background:#DBEAFE;color:#1E40AF',
    '제품추가': 'background:#D1FAE5;color:#065F46',
    '제품수정': 'background:#FEF3C7;color:#92400E'
  };

  bodyEl.innerHTML = history.map(function(h, i) {
    var bStyle = badgeStyles[h.action] || 'background:#F3F4F6;color:#374151';
    var hasBackup = h.backup && (Array.isArray(h.backup) ? h.backup.length > 0 : true);
    var restoreBtn = hasBackup
      ? '<button onclick="restoreFromHistory(' + i + ')" style="background:#185FA5;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer">되돌리기</button>'
      : '<span style="color:#ccc;font-size:11px">—</span>';
    return '<tr>' +
      '<td style="font-size:12px;white-space:nowrap">' + h.time + '</td>' +
      '<td><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;' + bStyle + '">' + h.action + '</span></td>' +
      '<td style="font-size:12px">' + h.target + '</td>' +
      '<td style="font-size:12px;text-align:center">' + h.count + '건</td>' +
      '<td style="text-align:center">' + restoreBtn + '</td>' +
      '</tr>';
  }).join('');
}

function restoreFromHistory(idx) {
  var history = getActionHistory();
  var h = history[idx];
  if (!h || !h.backup) { toast('백업 데이터가 없습니다'); return; }
  if (!confirm('이 작업 이전 상태로 되돌리시겠습니까?\n작업: ' + h.action + '\n시간: ' + h.time)) return;

  if (h.target === '밀워키') {
    DB.products = h.backup;
    save(KEYS.products, DB.products);
    populateCatalogFilters();
    renderCatalog();
  } else if (h.target === '일반제품') {
    genProducts.length = 0;
    h.backup.forEach(function(p) { genProducts.push(p); });
    localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
    renderGenProducts();
  }
  toast('되돌리기 완료 (' + h.target + ')');
  renderActionHistory();
}

// ======================== 전체삭제 ========================
function deleteAllMwProducts() {
  var count = DB.products.length;
  if (!count) { toast('삭제할 밀워키 제품이 없습니다'); return; }
  if (!confirm('전체 삭제하시겠습니까? (' + count + '건)')) return;
  if (!confirm('⚠️ 경고: 삭제된 데이터는 복구할 수 없습니다.\n정말 삭제하시겠습니까?')) return;

  saveActionHistory('전체삭제', '밀워키', count, JSON.parse(JSON.stringify(DB.products)));
  DB.products = [];
  save(KEYS.products, DB.products);
  DB.inventory = [];
  save(KEYS.inventory, DB.inventory);
  populateCatalogFilters();
  renderCatalog();
  fetch('/api/products', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteAll: true, productType: 'milwaukee' })
  }).then(function(r) { return r.json(); }).then(function(d) {
    console.log('[전체삭제] Supabase 밀워키 삭제:', d);
  }).catch(function(e) {
    console.error('[전체삭제] Supabase 삭제 실패:', e.message);
  });
  toast('밀워키 전체 삭제 완료 (' + count + '건)');
}

function deleteAllGenProducts() {
  var count = genProducts.length;
  if (!count) { toast('삭제할 일반제품이 없습니다'); return; }
  if (!confirm('전체 삭제하시겠습니까? (' + count + '건)')) return;
  if (!confirm('⚠️ 경고: 삭제된 데이터는 복구할 수 없습니다.\n정말 삭제하시겠습니까?')) return;

  saveActionHistory('전체삭제', '일반제품', count, JSON.parse(JSON.stringify(genProducts)));
  genProducts.length = 0;
  localStorage.setItem('mw_gen_products', '[]');
  renderGenProducts();
  toast('일반제품 전체 삭제 완료 (' + count + '건)');
}

// ======================== STICKY HEADER (JS) ========================
var _stickyTimers = {};
function initStickyHeader(tableId) {
  if (_stickyTimers[tableId]) {
    (window.cancelIdleCallback || clearTimeout)(_stickyTimers[tableId]);
  }
  _stickyTimers[tableId] = _rIC(function() { _initStickyHeaderImpl(tableId); });
}
function _initStickyHeaderImpl(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const scrollContainer = table.closest('.table-scroll');
  if (!scrollContainer) return;
  const thead = table.querySelector('thead');
  if (!thead) return;

  scrollContainer.addEventListener('scroll', function() {
    const scrollTop = this.scrollTop;
    thead.style.transform = 'translateY(' + scrollTop + 'px)';
    thead.style.zIndex = '5';
  });

  thead.querySelectorAll('th').forEach(th => {
    if (!th.style.background) {
      th.style.background = '#EAECF2';
    }
  });
}

// ======================== COLUMN RESIZE ========================
var _resizeTimers = {};
var _origInitColumnResize = _initColumnResizeImpl;
var _rIC = window.requestIdleCallback || function(cb) { setTimeout(cb, 150); };
function initColumnResize(tableId) {
  // requestIdleCallback으로 유휴 시 실행 → 메인 스레드 블로킹 방지
  if (_resizeTimers[tableId]) {
    (window.cancelIdleCallback || clearTimeout)(_resizeTimers[tableId]);
  }
  _resizeTimers[tableId] = _rIC(function() {
    var t = performance.now();
    _initColumnResizeImpl(tableId);
    console.log('[PERF] initColumnResize(' + tableId + '): ' + (performance.now() - t).toFixed(0) + 'ms');
  });
}
function _initColumnResizeImpl(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const ths = table.querySelectorAll('thead th');
  const storageKey = 'mw_colwidths_' + tableId;

  // JS 배열로 컬럼 너비 추적 (offsetWidth 의존 제거)
  let W = null; // 컬럼 너비 배열

  // colgroup 생성 및 너비 적용
  function initCols() {
    if (W) return;
    W = Array.from(ths).map(t => t.offsetWidth);
    applyCols();
  }
  function applyCols() {
    // fixed layout + 정확한 합산 너비 → 각 컬럼 독립, 콘텐츠보다 좁게 축소 가능
    table.style.tableLayout = 'fixed';
    let cg = table.querySelector('colgroup.resize-cg');
    if (!cg) { cg = document.createElement('colgroup'); cg.className = 'resize-cg'; table.insertBefore(cg, table.firstChild); }
    cg.innerHTML = W.map(w => '<col style="width:' + w + 'px">').join('');
    table.style.width = W.reduce((a, b) => a + b, 0) + 'px';
  }

  // 저장된 컬럼 너비 복원
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && saved.length === ths.length) {
      W = saved;
      applyCols();
    }
  } catch(e) {}

  // 컬럼 자동맞춤: 헤더+모든 행의 셀 중 가장 넓은 텍스트에 맞춤
  function autoFitColumn(colIdx) {
    initCols();
    const PAD = 24;
    const measurer = document.createElement('span');
    measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;';
    document.body.appendChild(measurer);

    let maxW = 0;
    const thEl = ths[colIdx];
    measurer.style.font = getComputedStyle(thEl).font;
    measurer.textContent = thEl.textContent.trim();
    maxW = Math.max(maxW, measurer.offsetWidth);

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cell = row.cells[colIdx];
      if (!cell) return;
      const input = cell.querySelector('input');
      if (input) {
        measurer.style.font = getComputedStyle(input).font;
        measurer.textContent = input.value || input.placeholder || '';
      } else {
        measurer.style.font = getComputedStyle(cell).font;
        measurer.textContent = cell.textContent.trim();
      }
      maxW = Math.max(maxW, measurer.offsetWidth);
    });
    measurer.remove();

    W[colIdx] = Math.max(30, maxW + PAD);
    applyCols();
    localStorage.setItem(storageKey, JSON.stringify(W));
  }

  ths.forEach((th, thIdx) => {
    if (th.querySelector('.col-resize')) return;
    th.classList.add('resizable');
    const handle = document.createElement('div');
    handle.className = 'col-resize';
    th.appendChild(handle);

    let startX, startW, clickTimer = null, clickCount = 0;

    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();

      // 더블클릭 감지
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(() => { clickCount = 0; }, 300);
      }
      if (clickCount >= 2) {
        clearTimeout(clickTimer);
        clickCount = 0;
        autoFitColumn(thIdx);
        return;
      }

      initCols();
      startX = e.pageX;
      startW = W[thIdx];
      handle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      // 가이드 라인 생성
      const tableRect = table.getBoundingClientRect();
      const guideLine = document.createElement('div');
      guideLine.style.cssText = 'position:fixed;top:' + tableRect.top + 'px;width:1px;height:' + tableRect.height + 'px;background:var(--tl-primary, #185FA5);z-index:9999;pointer-events:none;';
      guideLine.style.left = th.getBoundingClientRect().right + 'px';
      document.body.appendChild(guideLine);

      function onMove(e2) {
        const newW = Math.max(30, startW + e2.pageX - startX);
        guideLine.style.left = (th.getBoundingClientRect().left + newW) + 'px';
      }
      function onUp(e2) {
        guideLine.remove();
        W[thIdx] = Math.max(30, startW + e2.pageX - startX);
        applyCols();
        handle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        localStorage.setItem(storageKey, JSON.stringify(W));
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}


// ======================== PROMO V2 (신제품/패키지/이달의특가) ========================
let promosV2 = loadObj('mw_promos_v2', { newprod: [], package: [], monthly: [], cumul: [], quarter: [], spot: [], commercial: [] });
let pv2EditItems = [];

function savePromosV2() { localStorage.setItem('mw_promos_v2', JSON.stringify(promosV2)); }

function renderPromoV2(cat) {
  const data = promosV2[cat] || [];
  const body = document.getElementById(`promo-${cat}-tbody`);
  if (!body) return;
  let rows = '';
  data.forEach((promo, pi) => {
    const items = promo.items || [];
    if (!items.length) {
      rows += `<tr>
        <td class="center" style="white-space:nowrap">
          <button class="btn-edit" onclick="editPromoV2('${cat}',${pi})">수정</button>
          <button class="btn-danger btn-sm" style="padding:2px 6px;font-size:11px" onclick="deletePromoV2('${cat}',${pi})">삭제</button>
        </td>
        <td class="center" style="font-weight:600;color:#185FA5">${promo.promoNo || '-'}</td>
        <td class="center">${promo.title || '-'}</td>
        ${cat === 'monthly' ? '<td class="center">-</td>' : ''}
        <td class="center">-</td><td class="center">-</td><td class="center">-</td>
        <td class="num">-</td><td class="num">-</td>
        ${cat === 'monthly' ? '' : '<td class="num">-</td>'}
        <td class="center">${promo.discount || '-'}</td>
        ${cat === 'monthly' ? '<td class="center">-</td>' : ''}
        <td class="center" style="font-size:11px">${promo.period || '-'}</td>
        <td class="center" style="font-size:11px">${promo.restriction || '-'}</td>
      </tr>`;
    } else {
      items.forEach((item, ii) => {
        const discRate = item.price > 0 && item.promoPrice > 0 ? ((1 - item.promoPrice / item.price) * 100).toFixed(1) + '%' : (item.promoPrice === 0 ? '무상' : '-');
        rows += `<tr>
          ${ii === 0 ? `<td class="center" rowspan="${items.length}" style="white-space:nowrap;vertical-align:top">
            <button class="btn-edit" onclick="editPromoV2('${cat}',${pi})">수정</button>
            <button class="btn-danger btn-sm" style="padding:2px 6px;font-size:11px" onclick="deletePromoV2('${cat}',${pi})">삭제</button>
          </td>` : ''}
          ${ii === 0 ? `<td class="center" rowspan="${items.length}" style="font-weight:600;color:#185FA5;vertical-align:top">${promo.promoNo || '-'}</td>` : ''}
          ${ii === 0 ? `<td class="center" rowspan="${items.length}" style="vertical-align:top;font-size:12px">${promo.title || '-'}</td>` : ''}
          ${cat === 'monthly' ? `<td class="center" style="font-size:11px">${item.group || '-'}</td>` : ''}
          <td class="center">${item.orderNum || '-'}</td>
          <td class="center" style="font-weight:500">${item.model || '-'}</td>
          <td class="center" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.description || '-'}</td>
          <td class="center">${item.qty || '-'}</td>
          <td class="num">${item.price ? fmt(item.price) : '-'}</td>
          <td class="num" style="color:#CC2222;font-weight:600">${item.promoPrice != null ? (item.promoPrice === 0 ? '무상 제공' : fmt(item.promoPrice)) : '-'}</td>
          ${cat !== 'monthly' ? `<td class="num" style="font-weight:600">${item.total ? fmt(item.total) : '-'}</td>` : ''}
          <td class="center">${discRate}</td>
          ${cat === 'monthly' ? `<td class="center">${item.maxQty || '-'}</td>` : ''}
          ${ii === 0 ? `<td class="center" rowspan="${items.length}" style="font-size:11px;vertical-align:top">${promo.period || '-'}</td>` : ''}
          ${ii === 0 ? `<td class="center" rowspan="${items.length}" style="font-size:11px;vertical-align:top">${promo.restriction || '-'}</td>` : ''}
        </tr>`;
      });
    }
  });

  if (!data.length) {
    const cols = cat === 'monthly' ? 13 : 13;
    rows = `<tr><td colspan="${cols}"><div class="empty-state"><p>프로모션이 없습니다</p><p style="font-size:12px;color:#9BA3B2">PDF 업로드 또는 수동 추가로 등록하세요</p></div></td></tr>`;
  }
  body.innerHTML = rows;
  const countEl = document.getElementById(`promo-${cat}-count`);
  if (countEl) countEl.textContent = `${data.length}건`;
}

function showPromoEditModal(cat, idx) {
  document.getElementById('pv2-category').value = cat;
  document.getElementById('pv2-edit-idx').value = idx != null ? idx : -1;

  if (idx != null && idx >= 0) {
    const promo = promosV2[cat][idx];
    document.getElementById('pv2-edit-title').textContent = '프로모션 수정';
    document.getElementById('pv2-no').value = promo.promoNo || '';
    document.getElementById('pv2-title').value = promo.title || '';
    document.getElementById('pv2-discount').value = promo.discount || '';
    document.getElementById('pv2-period').value = promo.period || '';
    document.getElementById('pv2-restriction').value = promo.restriction || '';
    pv2EditItems = JSON.parse(JSON.stringify(promo.items || []));
  } else {
    const catNames = { newprod: '신제품', package: '패키지', monthly: '이달의특가', cumul: '누적', quarter: '분기/월별', spot: '스팟' };
    document.getElementById('pv2-edit-title').textContent = (catNames[cat] || '') + ' 프로모션 추가';
    document.getElementById('pv2-no').value = '';
    document.getElementById('pv2-title').value = '';
    document.getElementById('pv2-discount').value = '';
    document.getElementById('pv2-period').value = '';
    document.getElementById('pv2-restriction').value = '';
    pv2EditItems = [];
  }
  renderPv2Items();
  document.getElementById('promo-v2-edit-modal').classList.add('show');
}

function editPromoV2(cat, idx) { showPromoEditModal(cat, idx); }

function deletePromoV2(cat, idx) {
  if (!confirm('이 프로모션을 삭제하시겠습니까?')) return;
  promosV2[cat].splice(idx, 1);
  savePromosV2();
  renderPromoV2(cat);
  toast('프로모션 삭제 완료');
}

function pv2AddItemByCode(code) {
  const p = findProduct(code);
  if (!p) return;
  pv2EditItems.push({
    orderNum: String(p.orderNum || ''),
    ttiNum: String(p.ttiNum || ''),
    model: p.model || '',
    description: p.description || '',
    qty: 1,
    price: p.supplyPrice || 0,
    promoPrice: 0,
    total: 0,
    group: '',
    maxQty: ''
  });
  document.getElementById('pv2-item-search').value = '';
  renderPv2Items();
}

function pv2AddEmptyItem() {
  pv2EditItems.push({ orderNum: '', ttiNum: '', model: '', description: '', qty: 1, price: 0, promoPrice: 0, total: 0, group: '', maxQty: '' });
  renderPv2Items();
}

function pv2RemoveItem(idx) {
  pv2EditItems.splice(idx, 1);
  renderPv2Items();
}

function pv2UpdateItem(idx, field, val) {
  if (['qty', 'price', 'promoPrice', 'total'].includes(field)) {
    pv2EditItems[idx][field] = parseInt(String(val).replace(/,/g, '')) || 0;
    if (field !== 'total') {
      pv2EditItems[idx].total = pv2EditItems[idx].promoPrice * pv2EditItems[idx].qty;
    }
  } else {
    pv2EditItems[idx][field] = val;
  }
}

function renderPv2Items() {
  const body = document.getElementById('pv2-items-body');
  body.innerHTML = pv2EditItems.map((item, i) => `<tr>
    <td class="center"><button class="btn-danger btn-sm" onclick="pv2RemoveItem(${i})" style="padding:1px 5px;font-size:10px">✕</button></td>
    <td><input value="${item.orderNum}" onchange="pv2UpdateItem(${i},'orderNum',this.value)" style="width:50px;font-size:11px;text-align:center"></td>
    <td><input value="${item.ttiNum}" onchange="pv2UpdateItem(${i},'ttiNum',this.value)" style="width:80px;font-size:11px;text-align:center"></td>
    <td><input value="${item.model}" onchange="pv2UpdateItem(${i},'model',this.value)" style="width:120px;font-size:11px"></td>
    <td><input value="${item.description}" onchange="pv2UpdateItem(${i},'description',this.value)" style="width:180px;font-size:11px"></td>
    <td><input type="number" value="${item.qty}" onchange="pv2UpdateItem(${i},'qty',this.value)" style="width:40px;font-size:11px;text-align:center" min="0"></td>
    <td><input type="number" value="${item.price}" onchange="pv2UpdateItem(${i},'price',this.value)" style="width:75px;font-size:11px;text-align:right" min="0"></td>
    <td><input type="number" value="${item.promoPrice}" onchange="pv2UpdateItem(${i},'promoPrice',this.value)" style="width:75px;font-size:11px;text-align:right" min="0"></td>
    <td class="num" style="font-size:11px">${item.promoPrice && item.qty ? fmt(item.promoPrice * item.qty) : '-'}</td>
  </tr>`).join('');
  if (!pv2EditItems.length) {
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#9BA3B2;padding:12px;font-size:12px">제품을 검색하거나 빈 행을 추가하세요</td></tr>';
  }
}

function savePromoV2() {
  const cat = document.getElementById('pv2-category').value;
  const idx = parseInt(document.getElementById('pv2-edit-idx').value);
  const promoNo = document.getElementById('pv2-no').value.trim();
  const title = document.getElementById('pv2-title').value.trim();

  if (!promoNo) { toast('프로모션 번호를 입력해주세요'); return; }

  // Recalculate totals
  pv2EditItems.forEach(item => {
    item.total = (item.promoPrice || 0) * (item.qty || 0);
  });

  const promo = {
    promoNo,
    title,
    discount: document.getElementById('pv2-discount').value.trim(),
    period: document.getElementById('pv2-period').value.trim(),
    restriction: document.getElementById('pv2-restriction').value.trim(),
    items: JSON.parse(JSON.stringify(pv2EditItems))
  };

  if (idx >= 0) {
    promosV2[cat][idx] = promo;
  } else {
    promosV2[cat].push(promo);
  }
  savePromosV2();
  document.getElementById('promo-v2-edit-modal').classList.remove('show');
  renderPromoV2(cat);
  toast(idx >= 0 ? '프로모션 수정 완료' : '프로모션 추가 완료');
}

function renderAllPromosV2() {
  ['newprod', 'package', 'monthly', 'spot'].forEach(renderPromoV2);
  renderCumulPromos();
  renderQuarterPromos();
}

// ======================== 누적 프로모션 ========================
let cumulEditItems = [];

function renderCumulPromos() {
  const data = promosV2.cumul || [];
  const container = document.getElementById('promo-cumul-cards');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><p>누적 프로모션이 없습니다</p><p style="font-size:12px;color:#9BA3B2">+ 누적 추가로 등록하세요</p></div>';
  } else {
    container.innerHTML = data.map((p, i) => {
      const itemRows = (p.items || []).map(it => `<tr>
        <td class="center" style="font-size:11px">${it.group || '-'}</td>
        <td class="center" style="font-size:11px">${it.ttiNum || '-'}</td>
        <td class="center" style="font-size:11px">${it.orderNum || '-'}</td>
        <td class="center" style="font-size:11px;font-weight:500">${it.model || '-'}</td>
        <td class="center" style="font-size:11px">${it.description || '-'}</td>
        <td class="num" style="font-size:11px">${it.price ? fmt(it.price) : '-'}</td>
      </tr>`).join('');

      return `<div style="border:1px solid var(--tl-border);border-radius:8px;margin-bottom:12px;overflow:hidden">
        <div style="background:#185FA5;color:white;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700">[No.${i+1}] ${p.group || '-'}</span>
          <div style="display:flex;gap:6px">
            <button class="btn-ghost" style="padding:2px 8px;font-size:11px" onclick="showCumulEditModal(${i})">수정</button>
            <button class="btn-danger btn-sm" style="padding:2px 8px;font-size:11px" onclick="deleteCumulPromo(${i})">삭제</button>
          </div>
        </div>
        <div style="padding:10px 14px;display:flex;gap:24px;font-size:13px;background:#F8F9FB;border-bottom:1px solid var(--tl-border)">
          <div><strong>기간:</strong> ${p.period || '-'}</div>
          <div><strong>기준금액:</strong> <span style="color:#CC2222;font-weight:700">${p.threshold || '-'}</span></div>
          <div><strong>FOC:</strong> <span style="color:#1D9E75;font-weight:700">${p.foc || '-'}</span></div>
          <div><strong>비고:</strong> ${p.note || '-'}</div>
        </div>
        ${(p.items || []).length ? `<div style="max-height:200px;overflow-y:auto">
          <table class="data-table" style="font-size:12px">
            <thead><tr><th>구분</th><th>TTI#</th><th>순번</th><th>모델명</th><th>제품설명</th><th>대리점공급가</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>` : '<div style="padding:12px;text-align:center;color:#9BA3B2;font-size:12px">적용 제품 리스트 없음</div>'}
      </div>`;
    }).join('');
  }
  const countEl = document.getElementById('promo-cumul-count');
  if (countEl) countEl.textContent = `${data.length}건`;
}

function showCumulEditModal(idx) {
  const isEdit = idx != null && idx >= 0;
  document.getElementById('cumul-edit-title').textContent = isEdit ? '누적 프로모션 수정' : '누적 프로모션 추가';
  document.getElementById('cumul-edit-idx').value = isEdit ? idx : -1;

  if (isEdit) {
    const p = promosV2.cumul[idx];
    document.getElementById('cumul-group').value = p.group || '';
    document.getElementById('cumul-period').value = p.period || '';
    document.getElementById('cumul-threshold').value = p.threshold || '';
    document.getElementById('cumul-foc').value = p.foc || '';
    document.getElementById('cumul-note').value = p.note || '';
    cumulEditItems = JSON.parse(JSON.stringify(p.items || []));
  } else {
    document.getElementById('cumul-group').value = '';
    document.getElementById('cumul-period').value = '';
    document.getElementById('cumul-threshold').value = '';
    document.getElementById('cumul-foc').value = '';
    document.getElementById('cumul-note').value = '';
    cumulEditItems = [];
  }
  renderCumulEditItems();
  document.getElementById('cumul-edit-modal').classList.add('show');
}

function cumulAddItem(code) {
  const p = findProduct(code);
  if (!p) return;
  cumulEditItems.push({ group: '', ttiNum: String(p.ttiNum || ''), orderNum: String(p.orderNum || ''), model: p.model || '', description: p.description || '', price: p.supplyPrice || 0 });
  document.getElementById('cumul-item-search').value = '';
  renderCumulEditItems();
}

function cumulAddEmpty() {
  cumulEditItems.push({ group: '', ttiNum: '', orderNum: '', model: '', description: '', price: 0 });
  renderCumulEditItems();
}

function renderCumulEditItems() {
  const body = document.getElementById('cumul-items-body');
  body.innerHTML = cumulEditItems.map((it, i) => `<tr>
    <td class="center"><button class="btn-danger btn-sm" onclick="cumulEditItems.splice(${i},1);renderCumulEditItems()" style="padding:1px 5px;font-size:10px">✕</button></td>
    <td><input value="${it.group || ''}" onchange="cumulEditItems[${i}].group=this.value" style="width:60px;font-size:11px;text-align:center"></td>
    <td><input value="${it.ttiNum || ''}" onchange="cumulEditItems[${i}].ttiNum=this.value" style="width:80px;font-size:11px;text-align:center"></td>
    <td><input value="${it.orderNum || ''}" onchange="cumulEditItems[${i}].orderNum=this.value" style="width:50px;font-size:11px;text-align:center"></td>
    <td><input value="${it.model || ''}" onchange="cumulEditItems[${i}].model=this.value" style="width:120px;font-size:11px"></td>
    <td><input value="${it.description || ''}" onchange="cumulEditItems[${i}].description=this.value" style="width:160px;font-size:11px"></td>
    <td><input type="number" value="${it.price || 0}" onchange="cumulEditItems[${i}].price=parseInt(this.value)||0" style="width:80px;font-size:11px;text-align:right"></td>
  </tr>`).join('');
  if (!cumulEditItems.length) body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9BA3B2;padding:12px;font-size:12px">제품을 추가하세요</td></tr>';
}

function saveCumulPromo() {
  const idx = parseInt(document.getElementById('cumul-edit-idx').value);
  const promo = {
    group: document.getElementById('cumul-group').value.trim(),
    period: document.getElementById('cumul-period').value.trim(),
    threshold: document.getElementById('cumul-threshold').value.trim(),
    foc: document.getElementById('cumul-foc').value.trim(),
    note: document.getElementById('cumul-note').value.trim(),
    items: JSON.parse(JSON.stringify(cumulEditItems))
  };
  if (!promo.group) { toast('품목군을 입력해주세요'); return; }
  if (idx >= 0) { promosV2.cumul[idx] = promo; } else { promosV2.cumul.push(promo); }
  savePromosV2();
  document.getElementById('cumul-edit-modal').classList.remove('show');
  renderCumulPromos();
  toast(idx >= 0 ? '누적 프로모션 수정 완료' : '누적 프로모션 추가 완료');
}

function deleteCumulPromo(idx) {
  if (!confirm('이 누적 프로모션을 삭제하시겠습니까?')) return;
  promosV2.cumul.splice(idx, 1);
  savePromosV2();
  renderCumulPromos();
  toast('삭제 완료');
}

// ======================== 분기/월별 프로모션 ========================
function renderQuarterPromos() {
  const data = promosV2.quarter || [];
  const container = document.getElementById('promo-quarter-cards');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><p>분기/월별 프로모션이 없습니다</p><p style="font-size:12px;color:#9BA3B2">+ 분기/월별 추가로 등록하세요</p></div>';
  } else {
    container.innerHTML = data.map((p, i) => {
      const tierRows = (p.tiers || []).filter(t => t.amount).map(t =>
        `<tr><td class="center" style="font-size:12px">${p.unit} 누적 ${t.amount} 이상</td><td class="center" style="font-weight:700;color:#1D9E75;font-size:13px">${t.rate}</td></tr>`
      ).join('');

      return `<div style="border:1px solid var(--tl-border);border-radius:8px;margin-bottom:12px;overflow:hidden">
        <div style="background:#1D9E75;color:white;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700">${p.group || '-'} (${p.unit})</span>
          <div style="display:flex;gap:6px">
            <button class="btn-ghost" style="padding:2px 8px;font-size:11px" onclick="showQuarterEditModal(${i})">수정</button>
            <button class="btn-danger btn-sm" style="padding:2px 8px;font-size:11px" onclick="deleteQuarterPromo(${i})">삭제</button>
          </div>
        </div>
        <div style="padding:10px 14px;display:flex;gap:24px;font-size:13px;background:#F8F9FB;border-bottom:1px solid var(--tl-border)">
          <div><strong>대상:</strong> ${p.target || '-'}</div>
          <div><strong>기간:</strong> ${p.period || '-'}</div>
          <div><strong>비고:</strong> ${p.note || '-'}</div>
        </div>
        <div style="padding:8px 14px">
          <table class="data-table" style="font-size:12px;max-width:400px">
            <thead><tr><th>주문 금액 구간</th><th>물량 지원율</th></tr></thead>
            <tbody>${tierRows || '<tr><td colspan="2" style="text-align:center;color:#9BA3B2">구간 없음</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');
  }
  const countEl = document.getElementById('promo-quarter-count');
  if (countEl) countEl.textContent = `${data.length}건`;
}

function showQuarterEditModal(idx) {
  const isEdit = idx != null && idx >= 0;
  document.getElementById('quarter-edit-title').textContent = isEdit ? '분기/월별 수정' : '분기/월별 추가';
  document.getElementById('quarter-edit-idx').value = isEdit ? idx : -1;

  if (isEdit) {
    const p = promosV2.quarter[idx];
    document.getElementById('quarter-group').value = p.group || '';
    document.getElementById('quarter-target').value = p.target || '';
    document.getElementById('quarter-unit').value = p.unit || '월별';
    document.getElementById('quarter-period').value = p.period || '';
    document.getElementById('quarter-note').value = p.note || '';
    (p.tiers || []).forEach((t, i) => {
      const a = document.getElementById('qt-amt-' + i);
      const r = document.getElementById('qt-rate-' + i);
      if (a) a.value = t.amount || '';
      if (r) r.value = t.rate || '';
    });
  } else {
    ['quarter-group','quarter-target','quarter-period','quarter-note'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('quarter-unit').value = '월별';
    for (let i = 0; i < 4; i++) {
      const a = document.getElementById('qt-amt-' + i);
      const r = document.getElementById('qt-rate-' + i);
      if (a) a.value = '';
      if (r) r.value = '';
    }
  }
  document.getElementById('quarter-edit-modal').classList.add('show');
}

function saveQuarterPromo() {
  const idx = parseInt(document.getElementById('quarter-edit-idx').value);
  const tiers = [];
  for (let i = 0; i < 4; i++) {
    const a = document.getElementById('qt-amt-' + i);
    const r = document.getElementById('qt-rate-' + i);
    if (a && a.value) tiers.push({ amount: a.value.trim(), rate: (r ? r.value.trim() : '') });
  }
  const promo = {
    group: document.getElementById('quarter-group').value.trim(),
    target: document.getElementById('quarter-target').value.trim(),
    unit: document.getElementById('quarter-unit').value,
    period: document.getElementById('quarter-period').value.trim(),
    note: document.getElementById('quarter-note').value.trim(),
    tiers
  };
  if (!promo.group) { toast('제품군을 입력해주세요'); return; }
  if (idx >= 0) { promosV2.quarter[idx] = promo; } else { promosV2.quarter.push(promo); }
  savePromosV2();
  document.getElementById('quarter-edit-modal').classList.remove('show');
  renderQuarterPromos();
  toast(idx >= 0 ? '수정 완료' : '추가 완료');
}

function deleteQuarterPromo(idx) {
  if (!confirm('삭제하시겠습니까?')) return;
  promosV2.quarter.splice(idx, 1);
  savePromosV2();
  renderQuarterPromos();
  toast('삭제 완료');
}

// ======================== TAB 7: 일반제품 단가표 ========================
let genProducts = loadObj('mw_gen_products', []);

function renderGenProducts() {
  const search = (document.getElementById('gen-search').value || '').toLowerCase();
  let filtered = genProducts;
  if (search) filtered = filtered.filter(p => `${p.code} ${p.manageCode || ''} ${p.model} ${p.description}`.toLowerCase().includes(search));

  const body = document.getElementById('gen-body');
  body.innerHTML = filtered.map((p, i) => {
    const idx = genProducts.indexOf(p);
    return `<tr>
      <td>${p.code || '-'}</td>
      <td>${p.manageCode || '-'}</td>
      <td>${p.category || '-'}</td>
      <td style="font-weight:500">${p.model || '-'}</td>
      <td>${p.description || '-'}</td>
      <td class="center">${p.stock != null && p.stock !== '' ? (p.stock > 0 ? '<span class="badge badge-green">' + p.stock + '</span>' : p.stock === 0 ? '<span class="badge badge-amber">0</span>' : '<span class="badge badge-red">' + p.stock + '</span>') : '<span class="badge badge-gray">-</span>'}</td>
      <td class="num" style="color:#1D9E75">${fmt(p.cost || 0)}</td>
      <td class="num">${fmt(p.priceA || 0)}</td>
      <td class="num" style="padding:4px 3px">${marketBadge(p, 'naver')}</td>
      <td class="num" style="padding:4px 3px">${marketBadge(p, 'gmarket')}</td>
      <td class="num" style="padding:4px 3px">${marketBadge(p, 'ssg')}</td>
      <td class="center" style="cursor:pointer" onclick="editTierField(${idx},'in')">${(p.inQty || p.inPrice) ? '<div style="display:flex;flex-direction:column;align-items:center">' + (p.inQty ? '<span style="font-size:10px;color:#5A6070">' + p.inQty + '개</span>' : '') + (p.inPrice ? '<span style="font-size:12px;font-weight:600;color:#185FA5">' + (p.inPrice).toLocaleString() + '</span>' : '') + '</div>' : '<span style="color:#DDE1EB">-</span>'}</td>
      <td class="center" style="cursor:pointer" onclick="editTierField(${idx},'out')">${(p.outQty || p.outPrice) ? '<div style="display:flex;flex-direction:column;align-items:center">' + (p.outQty ? '<span style="font-size:10px;color:#5A6070">' + p.outQty + '개</span>' : '') + (p.outPrice ? '<span style="font-size:12px;font-weight:600;color:#185FA5">' + (p.outPrice).toLocaleString() + '</span>' : '') + '</div>' : '<span style="color:#DDE1EB">-</span>'}</td>
      <td class="center" style="cursor:pointer" onclick="editTierField(${idx},'pallet')">${(p.palletQty || p.palletPrice) ? '<div style="display:flex;flex-direction:column;align-items:center">' + (p.palletQty ? '<span style="font-size:10px;color:#5A6070">' + p.palletQty + '개</span>' : '') + (p.palletPrice ? '<span style="font-size:12px;font-weight:600;color:#185FA5">' + (p.palletPrice).toLocaleString() + '</span>' : '') + '</div>' : '<span style="color:#DDE1EB">-</span>'}</td>
      <td><input value="${(p.memo || '').replace(/"/g,'&quot;')}" onchange="updateGenMemo(${idx},this.value)" placeholder="" style="width:100%;font-size:12px;border:1px solid #DDE1EB;border-radius:4px;padding:2px 6px;background:#fff;color:#1A1D23;text-align:left"></td>
      <td style="text-align:left;font-size:12px;cursor:pointer;white-space:nowrap;padding-left:8px" onclick="editGenInDate(${idx})">${p.inDate ? '<span style="color:#CC2222;margin-right:4px">●</span>' + p.inDate : '-'}</td>
      <td class="center" style="white-space:nowrap"><button class="btn-edit" onclick="editGenProduct(${idx})" style="padding:2px 8px;font-size:11px">수정</button> <button class="btn-danger btn-sm" onclick="removeGenProduct(${idx})" style="padding:2px 6px;font-size:11px">삭제</button></td>
    </tr>`;
  }).join('');
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="17"><div class="empty-state"><p>일반제품이 없습니다</p><p style="font-size:12px;color:#9BA3B2">양식을 다운로드하여 업로드하거나, + 제품 추가를 이용하세요</p></div></td></tr>';
  }
  document.getElementById('gen-count').textContent = `${genProducts.length}건`;
  initColumnResize('gen-table');
  initStickyHeader('gen-table');
}

function addGenProduct() {
  const code = prompt('코드를 입력하세요');
  if (!code) return;
  const manageCode = prompt('관리코드(바코드)를 입력하세요') || '';
  const category = prompt('대분류를 입력하세요') || '';
  const model = prompt('모델명을 입력하세요') || '';
  const description = prompt('제품설명을 입력하세요') || '';
  const cost = parseInt(prompt('원가를 입력하세요') || '0') || 0;
  const priceA = parseInt(prompt('판매가를 입력하세요') || '0') || 0;
  const priceNaver = parseInt(prompt('스토어팜 가격을 입력하세요') || '0') || 0;
  const priceOpen = parseInt(prompt('오픈마켓 가격을 입력하세요') || '0') || 0;
  const memo = prompt('비고를 입력하세요') || '';
  genProducts.push({ code, manageCode, category, model, description, supplyPrice: 0, cost, priceA, priceNaver, priceOpen, memo, source: 'general' });
  localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
  renderGenProducts();
  toast('일반제품 추가 완료');
}

function editGenProduct(idx) {
  var p = genProducts[idx];
  if (!p) return;
  var code = prompt('코드', p.code || '');
  if (code === null) return;
  var manageCode = prompt('관리코드(바코드)', p.manageCode || '');
  if (manageCode === null) return;
  var category = prompt('대분류', p.category || '');
  if (category === null) return;
  var model = prompt('모델명', p.model || '');
  if (model === null) return;
  var description = prompt('제품설명', p.description || '');
  if (description === null) return;
  var cost = prompt('원가', p.cost || '');
  if (cost === null) return;
  var priceA = prompt('판매가(도매A)', p.priceA || '');
  if (priceA === null) return;
  var priceNaver = prompt('스토어팜 가격', p.priceNaver || '');
  if (priceNaver === null) return;
  var priceOpen = prompt('오픈마켓 가격', p.priceOpen || '');
  if (priceOpen === null) return;
  var memo = prompt('비고', p.memo || '');
  if (memo === null) return;
  genProducts[idx].code = code;
  genProducts[idx].manageCode = manageCode;
  genProducts[idx].category = category;
  genProducts[idx].model = model;
  genProducts[idx].description = description;
  genProducts[idx].cost = parseInt(String(cost).replace(/,/g,'')) || 0;
  genProducts[idx].priceA = parseInt(String(priceA).replace(/,/g,'')) || 0;
  genProducts[idx].priceNaver = parseInt(String(priceNaver).replace(/,/g,'')) || 0;
  genProducts[idx].priceOpen = parseInt(String(priceOpen).replace(/,/g,'')) || 0;
  genProducts[idx].memo = memo;
  localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
  renderGenProducts();
  toast('제품 정보 수정 완료');
}

function removeGenProduct(idx) {
  if (!confirm('이 제품을 삭제하시겠습니까?')) return;
  genProducts.splice(idx, 1);
  localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
  renderGenProducts();
}

function updateGenMemo(idx, val) {
  genProducts[idx].memo = val.trim();
  localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
}

function editTierField(idx, type) {
  var p = genProducts[idx];
  if (type === 'in') {
    var qty = prompt('IN 수량 (예: 10)', p.inQty || '');
    if (qty === null) return;
    var price = prompt('IN 단가 (예: 800)', p.inPrice || '');
    if (price === null) return;
    genProducts[idx].inQty = parseInt(String(qty).replace(/,/g,'')) || 0;
    genProducts[idx].inPrice = parseInt(String(price).replace(/,/g,'')) || 0;
  } else if (type === 'out') {
    var qty = prompt('OUT 수량 (예: 120)', p.outQty || '');
    if (qty === null) return;
    var price = prompt('OUT 단가 (예: 750)', p.outPrice || '');
    if (price === null) return;
    genProducts[idx].outQty = parseInt(String(qty).replace(/,/g,'')) || 0;
    genProducts[idx].outPrice = parseInt(String(price).replace(/,/g,'')) || 0;
  } else if (type === 'pallet') {
    var qty = prompt('파레트 수량 (예: 1200)', p.palletQty || '');
    if (qty === null) return;
    var price = prompt('파레트 단가 (예: 700, 없으면 빈칸)', p.palletPrice || '');
    if (price === null) return;
    genProducts[idx].palletQty = parseInt(String(qty).replace(/,/g,'')) || 0;
    genProducts[idx].palletPrice = parseInt(String(price).replace(/,/g,'')) || 0;
  }
  localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
  renderGenProducts();
}

function editGenInDate(idx) {
  const p = genProducts[idx];
  const current = p.inDate || '';
  const val = prompt('입고날짜 메모 (삭제하려면 비워두세요):', current);
  if (val === null) return;
  genProducts[idx].inDate = val.trim();
  localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
  renderGenProducts();
  toast(val.trim() ? '입고날짜 메모 저장' : '입고날짜 메모 삭제');
}

function downloadGenTemplate() {
  if (!window.XLSX) { toast('SheetJS 로딩 중...'); return; }
  const data = [['코드', '관리코드', '대분류', '모델 및 규격', '제품설명 및 품명', '원가', '도매(A)', '스토어팜', '오픈마켓', 'IN수량', 'IN단가', 'OUT수량', 'OUT단가', '파레트수량', '파레트단가', '비고', '입고날짜']];
  data.push(['SAMPLE-001', '8801234567890', '전동공구', '샘플 제품', '샘플 설명', 90000, 95000, 97000, 105000, 10, 800, 120, 750, 1200, 700, '', '']);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:16},{wch:12},{wch:25},{wch:40},{wch:12},{wch:12},{wch:12},{wch:12},{wch:8},{wch:10},{wch:8},{wch:10},{wch:10},{wch:10},{wch:20},{wch:15}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '일반제품');
  XLSX.writeFile(wb, '일반제품_양식.xlsx');
  toast('양식 다운로드 완료');
}

function uploadGenProducts(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      let count = 0;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        genProducts.push({
          code: String(r[0] || ''),
          manageCode: String(r[1] || ''),
          category: String(r[2] || ''),
          model: String(r[3] || ''),
          description: String(r[4] || ''),
          supplyPrice: 0,
          cost: parseInt(r[5]) || 0,
          priceA: parseInt(r[6]) || 0,
          priceNaver: parseInt(r[7]) || 0,
          priceOpen: parseInt(r[8]) || 0,
          inQty: parseInt(r[9]) || 0,
          inPrice: parseInt(r[10]) || 0,
          outQty: parseInt(r[11]) || 0,
          outPrice: parseInt(r[12]) || 0,
          palletQty: parseInt(r[13]) || 0,
          palletPrice: parseInt(r[14]) || 0,
          memo: String(r[15] || ''),
          inDate: String(r[16] || ''),
          source: 'general'
        });
        count++;
      }
      localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
      renderGenProducts();
      toast(`${count}건 업로드 완료`);
    } catch (err) {
      toast('업로드 실패: ' + err.message);
    }
    input.value = '';
  };
  reader.readAsArrayBuffer(file);
}

// ======================== GENERAL IMPORT MODAL ========================
function openGenImportModal() {
  document.getElementById('gen-import-modal').classList.add('show');
  document.getElementById('gen-import-status').textContent = '';
  var fileInput = document.getElementById('gen-excel-file');
  if (fileInput) fileInput.value = '';
  var radios = document.querySelectorAll('input[name="gen-import-mode"]');
  if (radios[0]) radios[0].checked = true;
}

function closeGenImportModal() {
  document.getElementById('gen-import-modal').classList.remove('show');
}

function importGenExcel() {
  var fileInput = document.getElementById('gen-excel-file');
  var file = fileInput && fileInput.files[0];
  if (!file) { toast('파일을 선택해주세요'); return; }
  if (!window.XLSX) { toast('SheetJS 로딩 중...'); return; }

  var mode = 'replace';
  var radios = document.querySelectorAll('input[name="gen-import-mode"]');
  radios.forEach(function(r) { if (r.checked) mode = r.value; });

  var statusEl = document.getElementById('gen-import-status');
  statusEl.textContent = '파일 읽는 중...';

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      var imported = [];
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r || !r[0]) continue;
        imported.push({
          code: String(r[0] || ''),
          manageCode: String(r[1] || ''),
          category: String(r[2] || ''),
          model: String(r[3] || ''),
          description: String(r[4] || ''),
          supplyPrice: 0,
          cost: parseInt(r[5]) || 0,
          priceA: parseInt(r[6]) || 0,
          priceNaver: parseInt(r[7]) || 0,
          priceOpen: parseInt(r[8]) || 0,
          inQty: parseInt(r[9]) || 0,
          inPrice: parseInt(r[10]) || 0,
          outQty: parseInt(r[11]) || 0,
          outPrice: parseInt(r[12]) || 0,
          palletQty: parseInt(r[13]) || 0,
          palletPrice: parseInt(r[14]) || 0,
          memo: String(r[15] || ''),
          inDate: String(r[16] || ''),
          source: 'general'
        });
      }

      if (!imported.length) {
        statusEl.textContent = '가져올 데이터가 없습니다 (1행은 헤더)';
        return;
      }

      if (mode === 'replace') {
        genProducts.length = 0;
        imported.forEach(function(item) { genProducts.push(item); });
        statusEl.textContent = '전체 교체: ' + imported.length + '건 등록';
      } else {
        var updated = 0, added = 0;
        imported.forEach(function(item) {
          var idx = genProducts.findIndex(function(p) { return String(p.code) === String(item.code); });
          if (idx >= 0) {
            Object.keys(item).forEach(function(key) {
              if (item[key] !== '' && item[key] !== 0 && item[key] !== null) {
                genProducts[idx][key] = item[key];
              }
            });
            updated++;
          } else {
            genProducts.push(item);
            added++;
          }
        });
        statusEl.textContent = '코드매칭: ' + updated + '건 업데이트, ' + added + '건 신규 추가';
      }

      localStorage.setItem('mw_gen_products', JSON.stringify(genProducts)); autoSyncToSupabase('mw_gen_products');
      renderGenProducts();
      var genActionName = mode === 'merge' ? '코드매칭' : '전체교체';
      saveActionHistory(genActionName, '일반제품', imported.length, null);
      toast('일반제품 가져오기 완료 (' + imported.length + '건)');
      setTimeout(function() { closeGenImportModal(); }, 1500);
    } catch (err) {
      statusEl.textContent = '오류: ' + err.message;
      toast('가져오기 실패: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ======================== TAB 6: 견적서 ========================
let estimates = loadObj('mw_estimates', []);
let currentEstIdx = -1;
let currentEstItems = [];

function genEstNo() {
  const d = new Date();
  const prefix = 'DH-' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0');
  const existing = estimates.filter(e => e.no && e.no.startsWith(prefix));
  const nextNum = existing.length + 1;
  return prefix + '-' + String(nextNum).padStart(4,'0');
}

// Helper: find product from both 밀워키 + 일반제품
function getGenTierPrice(genProduct, qty) {
  if (!genProduct) return { price: 0, tier: '' };
  var q = parseInt(qty) || 0;
  if (genProduct.palletQty && genProduct.palletPrice && q >= genProduct.palletQty) {
    return { price: genProduct.palletPrice, tier: '파레트' };
  }
  if (genProduct.outQty && genProduct.outPrice && q >= genProduct.outQty) {
    return { price: genProduct.outPrice, tier: 'OUT' };
  }
  if (genProduct.inQty && genProduct.inPrice && q >= genProduct.inQty) {
    return { price: genProduct.inPrice, tier: 'IN' };
  }
  return { price: genProduct.priceA || genProduct.cost || 0, tier: '' };
}

function findAnyProduct(code) {
  const mw = findProduct(code);
  if (mw) return { ...mw, _source: 'milwaukee' };
  const gen = genProducts.find(p => String(p.code) === String(code));
  if (gen) return { ...gen, _source: 'general' };
  return null;
}

function searchEstProducts(val) {
  const body = document.getElementById('est-search-body');
  if (!val || val.length < 1) { body.innerHTML = ''; return; }
  const q = val.toLowerCase();

  // Search 밀워키
  const mwResults = searchProducts(val).slice(0, 20).map(p => ({ ...p, _source: 'milwaukee' }));

  // Search 일반제품
  const genResults = genProducts.filter(p => {
    return `${p.code} ${p.model} ${p.description}`.toLowerCase().includes(q);
  }).slice(0, 20).map(p => ({ ...p, _source: 'general' }));

  const combined = [...mwResults, ...genResults].slice(0, 30);

  body.innerHTML = combined.map(p => {
    const srcBadge = p._source === 'milwaukee'
      ? '<span class="badge badge-blue" style="font-size:10px">밀워키</span>'
      : '<span class="badge badge-green" style="font-size:10px">일반</span>';
    const aPrice = p.priceA || 0;
    const naverPrice = p.priceNaver || 0;
    const openPrice = p.priceOpen || 0;
    const cost = p.cost || 0;
    const margin = aPrice > 0 && cost > 0 ? aPrice - cost : 0;
    const marginRate = aPrice > 0 && cost > 0 ? ((margin / aPrice) * 100).toFixed(1) : '-';
    const marginDisplay = margin > 0 ? `${fmt(margin)} (${marginRate}%)` : (margin < 0 ? `<span style="color:#CC2222">${fmt(margin)} (${marginRate}%)</span>` : '-');
    // IN/OUT/파레트 셀
    var inCell, outCell, palletCell;
    if (p._source === 'general') {
      inCell = (p.inQty && p.inPrice) ? '<div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:10px;color:#5A6070">' + p.inQty + '개</span><span style="font-size:10px;font-weight:600;color:#185FA5">' + p.inPrice.toLocaleString() + '</span></div>' : '<span style="color:#DDE1EB;font-size:10px">-</span>';
      outCell = (p.outQty && p.outPrice) ? '<div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:10px;color:#5A6070">' + p.outQty + '개</span><span style="font-size:10px;font-weight:600;color:#185FA5">' + p.outPrice.toLocaleString() + '</span></div>' : '<span style="color:#DDE1EB;font-size:10px">-</span>';
      palletCell = (p.palletQty && p.palletPrice) ? '<div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:10px;color:#5A6070">' + p.palletQty + '개</span><span style="font-size:10px;font-weight:600;color:#185FA5">' + p.palletPrice.toLocaleString() + '</span></div>' : p.palletQty ? '<div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:10px;color:#5A6070">' + p.palletQty + '개</span><span style="font-size:10px;color:#9BA3B2">단가없음</span></div>' : '<span style="color:#DDE1EB;font-size:10px">-</span>';
    } else {
      inCell = '<span style="color:#DDE1EB;font-size:10px">-</span>';
      outCell = '<span style="color:#DDE1EB;font-size:10px">-</span>';
      palletCell = '<span style="color:#DDE1EB;font-size:10px">-</span>';
    }
    return `<tr>
      <td class="center"><button class="btn-edit" onclick="addEstimateProduct('${p.code}')">견적서 추가</button></td>
      <td class="center">${p.code} ${srcBadge}</td>
      <td class="center" style="font-size:10px">${p.manageCode || '-'}</td>
      <td class="center">${p.category || '-'}</td>
      <td class="center" style="font-weight:500">${p.model || '-'}</td>
      <td class="center" style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.description || '-'}</td>
      <td class="center">${(function(){ var s = p._source === 'milwaukee' ? findStock(p.code) : (p.stock != null ? p.stock : null); return s != null ? (s > 0 ? '<span class="badge badge-green">' + s + '</span>' : s === 0 ? '<span class="badge badge-amber">0</span>' : '<span class="badge badge-red">' + s + '</span>') : '<span class="badge badge-gray">-</span>'; })()}</td>
      <td class="num" style="color:#1D9E75">${cost ? fmt(cost) : '-'}</td>
      <td class="num" style="color:#185FA5;font-weight:700">${fmt(aPrice)}</td>
      <td class="num" style="padding:4px 3px">${marketBadge(p, 'naver')}</td>
      <td class="num" style="padding:4px 3px">${marketBadge(p, 'gmarket')}</td>
      <td class="num" style="padding:4px 3px">${marketBadge(p, 'ssg')}</td>
      <td class="center">${inCell}</td>
      <td class="center">${outCell}</td>
      <td class="center">${palletCell}</td>
      <td class="num" style="color:#1D9E75">${cost ? fmt(cost) : '-'}</td>
      <td class="num" style="font-size:11px">${marginDisplay}</td>
      <td class="center">-</td>
      <td style="text-align:left;font-size:12px;white-space:nowrap;padding-left:8px">${p.inDate ? '<span style="color:#CC2222;margin-right:4px">●</span>' + p.inDate : '-'}</td>
    </tr>`;
  }).join('');
  initColumnResize('est-search-table');
  initStickyHeader('est-search-table');
}

function showEstimateList() {
  renderEstimateList();
  document.getElementById('est-list-modal').classList.add('show');
}

function renderEstimateList() {
  const body = document.getElementById('est-list-body');
  body.innerHTML = estimates.map((e, i) => {
    return `<tr>
      <td class="center" style="font-weight:600">${e.no}</td>
      <td class="center">${e.client || '-'}</td>
      <td class="num" style="font-weight:600">${fmt(e.total || 0)}</td>
      <td class="center">${e.date || '-'}</td>
      <td class="center" style="white-space:nowrap">
        <button class="btn-edit" onclick="openEstimate(${i})">열기</button>
        <button class="btn-danger btn-sm" onclick="deleteEstimate(${i})" style="padding:2px 8px;font-size:11px">삭제</button>
      </td>
    </tr>`;
  }).join('');
  if (!estimates.length) {
    body.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>저장된 견적서가 없습니다</p></div></td></tr>';
  }
  document.getElementById('est-list-count').textContent = `${estimates.length}건`;
}

function getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
var _estDateManuallySet = false;

function newEstimate() {
  currentEstIdx = -1;
  currentEstItems = [];
  document.getElementById('est-client').value = '';
  document.getElementById('est-date').value = getTodayStr();
  _estDateManuallySet = false;
  estSelectedClient = null;
  var cInfo = document.getElementById('est-client-info');
  if (cInfo) { cInfo.style.display = 'none'; cInfo.style.background = '#F4F6FA'; cInfo.innerHTML = ''; }
  renderEstimateItems();
}

// 견적 날짜 input 변경 감지 — 사용자 직접 변경 시 플래그 설정
(function() {
  function attachDateListener() {
    var dateInput = document.getElementById('est-date');
    if (dateInput && !dateInput._dateListenerAttached) {
      dateInput._dateListenerAttached = true;
      dateInput.addEventListener('change', function() { _estDateManuallySet = true; });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachDateListener);
  } else {
    setTimeout(attachDateListener, 0);
  }
})();

// ======================== 견적서 거래처 자동완성 ========================
var estSelectedClient = null;

function searchClientAC(val) {
  var list = document.getElementById('client-ac-list');
  if (!list) return;
  if (!val || val.length < 1) { list.style.display = 'none'; return; }
  var q = String(val).toLowerCase();
  var results = (typeof clientData !== 'undefined' ? clientData : []).filter(function(c) {
    return String(c.name || '').toLowerCase().includes(q) ||
           String(c.bizNo || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
           String(c.ceo || '').toLowerCase().includes(q) ||
           String(c.code || '').toLowerCase().includes(q);
  }).slice(0, 8);
  var html = '';
  results.forEach(function(c) {
    var idx = clientData.indexOf(c);
    html += '<div class="client-ac-item" data-idx="' + idx + '" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid #F0F2F7">';
    html += '<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;background:#E1F5EE;color:#085041;white-space:nowrap">등록</span>';
    html += '<span style="font-weight:600;color:#1A1D23">' + (c.name || '') + '</span>';
    html += '<span style="font-size:10px;color:#5A6070">' + (c.bizNo || '') + '</span>';
    html += '<span style="font-size:10px;color:#9BA3B2">' + (c.ceo || '') + '</span>';
    html += '<span style="font-size:10px;color:#9BA3B2">' + (c.phone || c.mobile || '') + '</span>';
    html += '</div>';
  });
  html += '<div class="client-ac-new" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;background:#FAFBFC;border-top:2px solid #DDE1EB">';
  html += '<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;background:#E6F1FB;color:#0C447C;white-space:nowrap">신규</span>';
  html += '<span style="color:#185FA5;font-weight:500">"' + val + '"</span>';
  html += '<span style="font-size:10px;color:#9BA3B2">← 미등록 거래처로 직접 입력</span>';
  html += '</div>';
  list.innerHTML = html;
  list.style.display = 'block';
  list.querySelectorAll('.client-ac-item').forEach(function(el) {
    el.onmousedown = function(e) {
      e.preventDefault();
      var idx = parseInt(el.dataset.idx);
      var c = clientData[idx];
      if (!c) return;
      document.getElementById('est-client').value = c.name;
      estSelectedClient = c;
      showEstClientInfo(c);
      renderEstimateItems();
      list.style.display = 'none';
    };
  });
  var newBtn = list.querySelector('.client-ac-new');
  if (newBtn) {
    newBtn.onmousedown = function(e) {
      e.preventDefault();
      estSelectedClient = null;
      showEstClientUnreg(val);
      renderEstimateItems();
      list.style.display = 'none';
    };
  }
}

function showEstClientInfo(c) {
  var info = document.getElementById('est-client-info');
  if (!info) return;
  info.style.display = 'flex';
  info.style.background = '#F4F6FA';
  info.innerHTML =
    '<div><span style="color:#5A6070">상호: </span><span style="font-weight:500">' + (c.name || '') + '</span>' +
    '<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;background:#E1F5EE;color:#085041;margin-left:4px">등록</span></div>' +
    '<div><span style="color:#5A6070">사업자: </span><span>' + (c.bizNo || '-') + '</span></div>' +
    '<div><span style="color:#5A6070">대표: </span><span>' + (c.ceo || '-') + '</span></div>' +
    '<div><span style="color:#5A6070">전화: </span><span>' + (c.phone || c.mobile || '-') + '</span></div>' +
    '<div><span style="color:#5A6070">주소: </span><span>' + (c.address || '-') + '</span></div>' +
    '<div><span style="color:#5A6070">이메일: </span><span>' + (c.email || '-') + '</span></div>' +
    (c.vatExempt ? '<div style="color:#CC2222;font-weight:600;margin-top:4px">⚠️ 부가세 면제 거래처</div>' : '');
}

function showEstClientUnreg(name) {
  var info = document.getElementById('est-client-info');
  if (!info) return;
  info.style.display = 'flex';
  info.style.background = '#FFF5F5';
  info.innerHTML =
    '<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;background:#FCEBEB;color:#791F1F">미등록</span>' +
    '<span style="color:#5A6070;font-size:11px">"' + name + '" — 설정 > 거래처 등록에서 등록하면 자동 연결됩니다</span>';
}

document.addEventListener('mousedown', function(e) {
  var wrap = document.getElementById('client-ac-wrap');
  var list = document.getElementById('client-ac-list');
  if (wrap && list && !wrap.contains(e.target)) {
    list.style.display = 'none';
  }
});

function openEstimate(idx) {
  const e = estimates[idx];
  if (!e) return;
  currentEstIdx = idx;
  currentEstItems = JSON.parse(JSON.stringify(e.items || []));
  document.getElementById('est-client').value = e.client || '';
  document.getElementById('est-date').value = e.date || '';
  _estDateManuallySet = true; // 저장된 견적서의 날짜 유지
  document.getElementById('est-current-no').textContent = e.no || '';
  document.getElementById('est-list-modal').classList.remove('show');
  renderEstimateItems();
}

function deleteEstimate(idx) {
  if (!confirm('이 견적서를 삭제하시겠습니까?')) return;
  estimates.splice(idx, 1);
  localStorage.setItem('mw_estimates', JSON.stringify(estimates));
  autoSyncToSupabase('mw_estimates');
  if (currentEstIdx === idx) { currentEstIdx = -1; currentEstItems = []; renderEstimateItems(); }
  renderEstimateList();
  toast('견적서 삭제 완료');
}

function addEstimateProduct(code) {
  const p = findAnyProduct(code);
  if (!p) return;
  if (currentEstItems.some(it => String(it.code) === String(code))) {
    toast('이미 추가된 제품입니다');
    return;
  }
  currentEstItems.push({
    code: String(p.code),
    manageCode: p.manageCode || '',
    category: p.category || '',
    model: p.model || '',
    description: p.description || '',
    priceA: p.priceA || 0,
    qty: 1,
    memo: ''
  });
  renderEstimateItems();
  toast(`${p.model} 추가 완료`);
}

function removeEstimateItem(idx) {
  currentEstItems.splice(idx, 1);
  renderEstimateItems();
}

function onEstQtyChange(idx, val) {
  currentEstItems[idx].qty = parseInt(val) || 0;
  // 일반제품이면 수량별 자동 단가 적용
  var p = findAnyProduct(currentEstItems[idx].code);
  if (p && p._source === 'general') {
    var tier = getGenTierPrice(p, currentEstItems[idx].qty);
    currentEstItems[idx].customPrice = tier.price;
    currentEstItems[idx]._tier = tier.tier;
  }
  renderEstimateItems();
}

function onEstMemoChange(idx, val) {
  currentEstItems[idx].memo = val;
}

function renderEstimateItems() {
  const body = document.getElementById('est-body');
  const isVatExempt = estSelectedClient && estSelectedClient.vatExempt === true;
  let total = 0;
  body.innerHTML = currentEstItems.map((item, i) => {
    const p = findAnyProduct(item.code);
    const aPrice = item.customPrice != null ? item.customPrice : (p ? p.priceA : (item.priceA || 0));
    const stock = findStock(item.code);
    const qty = item.qty || 0;
    const amount = aPrice * qty;
    const vat = isVatExempt ? 0 : Math.round(amount * 0.1);
    total += amount;
    const stockTxt = stock == null ? '-' : `<span style="color:#CC2222;font-weight:700">${stock}</span>`;
    return `<tr>
      <td class="center"><button class="btn-danger btn-sm" onclick="removeEstimateItem(${i})" style="padding:2px 6px">✕</button></td>
      <td class="center">${item.code}</td>
      <td class="center" style="font-size:10px">${item.manageCode || (p ? p.manageCode : '') || '-'}</td>
      <td class="center">${item.category || (p ? p.category : '') || '-'}</td>
      <td class="center" style="font-weight:500">${p ? p.model : item.model}</td>
      <td class="center" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p ? p.description : item.description}</td>
      <td class="center"><input type="number" value="${qty || ''}" onchange="onEstQtyChange(${i},this.value)" min="0" style="width:60px;text-align:center"></td>
      <td class="num"><input type="number" value="${aPrice || ''}" onchange="onEstPriceChange(${i},this.value)" min="0" style="width:80px;text-align:right;font-size:12px">${item._tier === '파레트' ? '<span style="font-size:10px;background:#FAEEDA;color:#633806;padding:1px 4px;border-radius:2px;font-weight:600;margin-left:4px">파레트</span>' : item._tier === 'IN' ? '<span style="font-size:10px;background:#E6F1FB;color:#0C447C;padding:1px 4px;border-radius:2px;font-weight:600;margin-left:4px">IN</span>' : (item._tier === 'OUT' ? '<span style="font-size:10px;background:#E6F1FB;color:#0C447C;padding:1px 4px;border-radius:2px;font-weight:600;margin-left:4px">OUT</span>' : '')}</td>
      <td class="num" style="font-weight:600">${amount ? fmt(amount) : '-'}</td>
      <td class="num" style="color:#5A6070">${amount ? fmt(vat) : '-'}</td>
      <td class="center"><input value="${item.memo || ''}" onchange="onEstMemoChange(${i},this.value)" style="width:60px;font-size:12px;text-align:center"></td>
      <td class="center"><input value="${item.shipCompany || ''}" onchange="currentEstItems[${i}].shipCompany=this.value" style="width:70px;font-size:12px;text-align:center" placeholder=""></td>
      <td class="num"><input type="number" value="${item.shipCost || ''}" onchange="currentEstItems[${i}].shipCost=parseInt(this.value)||0" min="0" style="width:70px;text-align:right;font-size:12px" placeholder=""></td>
      <td class="center">${stockTxt}</td>
    </tr>`;
  }).join('');
  if (!currentEstItems.length) {
    body.innerHTML = '<tr><td colspan="14" style="text-align:center;color:#9BA3B2;padding:20px">제품을 검색하여 추가하세요</td></tr>';
  }
  const totalVat = isVatExempt ? 0 : Math.round(total * 0.1);
  const vatLabel = isVatExempt ? '부가세 면제' : '부가세 ' + fmt(totalVat);
  document.getElementById('est-total').innerHTML = `${fmt(total)} <span style="font-size:13px;color:#5A6070;font-weight:400">+</span> <span style="font-size:13px;color:${isVatExempt ? '#CC2222' : '#5A6070'}">${vatLabel}</span> <span style="font-size:13px;color:#5A6070;font-weight:400">=</span> <span style="font-size:18px;color:#CC2222">토탈 ${fmt(total + totalVat)}</span>`;
  initColumnResize('est-table');
  initStickyHeader('est-table');
}

function onEstPriceChange(idx, val) {
  currentEstItems[idx].customPrice = parseInt(val) || 0;
  currentEstItems[idx]._tier = '';
  renderEstimateItems();
}

function saveEstimate() {
  var noEl = document.getElementById('est-current-no');
  var no = noEl.textContent;
  if (!no || no === '-') no = genEstNo();
  noEl.textContent = no;
  const client = document.getElementById('est-client').value.trim();
  const date = document.getElementById('est-date').value;
  if (!client) { toast('거래처를 입력해주세요'); return; }

  let total = 0;
  currentEstItems.forEach(item => {
    const p = findAnyProduct(item.code);
    const aPrice = p ? p.priceA : (item.priceA || 0);
    total += aPrice * (item.qty || 0);
  });

  const estData = { no, client, date, total, items: JSON.parse(JSON.stringify(currentEstItems)) };

  if (currentEstIdx >= 0) {
    estimates[currentEstIdx] = estData;
  } else {
    estimates.push(estData);
    currentEstIdx = estimates.length - 1;
  }
  localStorage.setItem('mw_estimates', JSON.stringify(estimates));
  autoSyncToSupabase('mw_estimates');
  renderEstimateList();
  toast('견적서 저장 완료');
}

function previewEstimatePdf() {
  const no = document.getElementById('est-current-no').textContent;
  const client = document.getElementById('est-client').value.trim();
  const date = document.getElementById('est-date').value;
  if (!client) { toast('거래처를 입력해주세요'); return; }

  let total = 0;
  let hasShipping = false;
  let shippingRows = '';
  const rows = currentEstItems.filter(it => it.qty > 0).map((item, i) => {
    const p = findAnyProduct(item.code);
    const aPrice = item.customPrice != null ? item.customPrice : (p ? p.priceA : (item.priceA || 0));
    const amount = aPrice * item.qty;
    const vat = Math.round(amount * 0.1);
    total += amount;
    if (item.shipCost > 0) {
      hasShipping = true;
      shippingRows += `<tr>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:center" colspan="4">택배비 (${item.shipCompany || '-'})</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">1</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:right">${fmt(item.shipCost)}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;font-weight:600">${fmt(item.shipCost)}</td>
        <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;color:#5A6070">${fmt(Math.round(item.shipCost * 0.1))}</td>
      </tr>`;
      total += item.shipCost;
    }
    return `<tr>
      <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${i+1}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${item.code}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:500">${p ? p.model : item.model}</td>
      <td style="padding:6px 8px;border:1px solid #ccc">${p ? p.description : item.description}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${item.qty}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;text-align:right">${fmt(aPrice)}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;font-weight:600">${fmt(amount)}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;color:#5A6070">${fmt(vat)}</td>
    </tr>`;
  }).join('');

  const totalVat = Math.round(total * 0.1);
  const shippingMessage = hasShipping ? '' : `<div style="background:#FFF8E8;border:1px solid #EF9F27;border-radius:4px;padding:10px 14px;margin-bottom:20px;font-size:13px;font-weight:600;color:#8B6914;text-align:center">※ 모든 제품은 택배비가 별도입니다.</div>`;

  const html = `
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="font-size:24px;margin:0 0 4px">견 적 서</h1>
      <p style="font-size:12px;color:#888">본 견적서는 발행일로부터 10일 이내 유효합니다.</p>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px">
      <div>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px;font-weight:600;background:#f5f5f5;border:1px solid #ccc">견적번호</td><td style="padding:4px 12px;border:1px solid #ccc">${no}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:600;background:#f5f5f5;border:1px solid #ccc">공급받는자</td><td style="padding:4px 12px;border:1px solid #ccc;font-weight:700">${client}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:600;background:#f5f5f5;border:1px solid #ccc">견적일자</td><td style="padding:4px 12px;border:1px solid #ccc">${date}</td></tr>
        </table>
      </div>
      <div style="text-align:right">
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px;font-weight:600;background:#f5f5f5;border:1px solid #ccc">합계금액</td><td style="padding:4px 12px;border:1px solid #ccc;font-weight:700;font-size:15px;color:#185FA5">${fmt(total)}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:600;background:#f5f5f5;border:1px solid #ccc">부가세(10%)</td><td style="padding:4px 12px;border:1px solid #ccc">${fmt(totalVat)}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:600;background:#f5f5f5;border:1px solid #ccc">총계(VAT포함)</td><td style="padding:4px 12px;border:1px solid #ccc;font-weight:700">${fmt(total + totalVat)}</td></tr>
        </table>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px">
      <thead>
        <tr style="background:#1A1D23;color:white">
          <th style="padding:8px;border:1px solid #ccc">No</th>
          <th style="padding:8px;border:1px solid #ccc">코드</th>
          <th style="padding:8px;border:1px solid #ccc">모델 및 품명</th>
          <th style="padding:8px;border:1px solid #ccc">제품설명 및 규격</th>
          <th style="padding:8px;border:1px solid #ccc">수량</th>
          <th style="padding:8px;border:1px solid #ccc">단가</th>
          <th style="padding:8px;border:1px solid #ccc">합계금액</th>
          <th style="padding:8px;border:1px solid #ccc">부가세</th>
        </tr>
      </thead>
      <tbody>${rows}${shippingRows}</tbody>
      <tfoot>
        <tr style="background:#f5f5f5;font-weight:700">
          <td colspan="6" style="padding:8px;border:1px solid #ccc;text-align:right">합 계</td>
          <td style="padding:8px;border:1px solid #ccc;text-align:right">${fmt(total)}</td>
          <td style="padding:8px;border:1px solid #ccc;text-align:right">${fmt(totalVat)}</td>
        </tr>
      </tfoot>
    </table>
    ${shippingMessage}
    <div style="border-top:2px solid #1A1D23;padding-top:14px;font-size:12px;color:#555">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#222">공급자</div>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:3px 10px;width:100px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">업체명</td><td style="padding:3px 10px;border:1px solid #ddd;font-weight:700">(주)대한종합상사</td><td style="padding:3px 10px;width:80px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">대표</td><td style="padding:3px 10px;border:1px solid #ddd">최병우</td></tr>
        <tr><td style="padding:3px 10px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">소재지</td><td colspan="3" style="padding:3px 10px;border:1px solid #ddd">경기도 양주시 백석읍 부흥로 1110</td></tr>
        <tr><td style="padding:3px 10px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">업태</td><td style="padding:3px 10px;border:1px solid #ddd">도소매</td><td style="padding:3px 10px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">종목</td><td style="padding:3px 10px;border:1px solid #ddd">공구 및 철물</td></tr>
        <tr><td style="padding:3px 10px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">TEL</td><td style="padding:3px 10px;border:1px solid #ddd">031-871-0945</td><td style="padding:3px 10px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">FAX</td><td style="padding:3px 10px;border:1px solid #ddd">031-871-0944</td></tr>
        <tr><td style="padding:3px 10px;font-weight:600;background:#f9f9f9;border:1px solid #ddd">이메일</td><td colspan="3" style="padding:3px 10px;border:1px solid #ddd">0945Daehan@naver.com</td></tr>
      </table>
    </div>
  `;

  document.getElementById('est-pdf-content').innerHTML = html;
  document.getElementById('est-pdf-modal').classList.add('show');
}

function downloadEstimatePdf() {
  const content = document.getElementById('est-pdf-content');
  const no = document.getElementById('est-current-no').textContent;
  const client = document.getElementById('est-client').value.trim();

  const printWin = window.open('', '_blank');
  printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>견적서_${no}_${client}</title>
    <style>
      body { font-family: Pretendard, 'Malgun Gothic', sans-serif; margin: 30px; color: #222; }
      @media print { body { margin: 15px; } }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    </style></head><body>${content.innerHTML}</body></html>`);
  printWin.document.close();
  setTimeout(() => { printWin.print(); }, 500);
}

// ======================== 전표 등록 (NewOrderOut) ========================
async function registerOrderOut() {
  var btn = document.getElementById('btn-order-out');

  // 거래처 확인
  var clientName = document.getElementById('est-client').value.trim();
  if (!clientName) { alert('거래처를 선택해주세요'); return; }

  var customerCode = '';
  if (estSelectedClient && estSelectedClient.manageCode && estSelectedClient.manageCode !== '-') {
    customerCode = estSelectedClient.manageCode;
  } else if (estSelectedClient) {
    alert('이 거래처에 관리코드(CODE2)가 없습니다.\n경영박사에서 거래처 관리코드를 등록한 후 다시 시도하세요.\n\n거래처: ' + clientName);
    return;
  } else {
    alert('등록된 거래처를 선택해주세요.\n(경영박사에 등록된 거래처만 전표 등록 가능)');
    return;
  }

  // 품목 확인
  if (!currentEstItems.length) { alert('품목을 추가해주세요'); return; }

  // 날짜
  var dateVal = document.getElementById('est-date').value || '';
  var erpDate = '';
  if (dateVal) {
    var d = new Date(dateVal);
    erpDate = String(d.getFullYear()).slice(2) + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
  }

  // 품목 데이터 구성
  var isVatExempt = estSelectedClient && estSelectedClient.vatExempt === true;
  var totalAmount = 0;
  var itemsData = currentEstItems.filter(function(it) { return it.qty > 0; }).map(function(it) {
    var p = findAnyProduct(it.code);
    var price = it.customPrice != null ? it.customPrice : (p ? p.priceA : (it.priceA || 0));
    var amount = price * it.qty;
    var vat = isVatExempt ? 0 : Math.round(amount * 0.1);
    totalAmount += amount;
    return {
      code: p ? (p.manageCode || p.code) : it.code,
      qty: it.qty,
      price: price,
      amount: amount,
      vat: vat,
      memo: it.memo || ''
    };
  });

  if (!itemsData.length) { alert('수량이 0인 품목은 등록할 수 없습니다'); return; }

  // 확인
  if (!confirm('매출 전표를 등록하시겠습니까?\n거래처: ' + clientName + '\n품목: ' + itemsData.length + '건\n합계: ' + totalAmount.toLocaleString() + '원')) return;

  // API 호출
  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    var resp = await fetch('/api/erp/order-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerCode: customerCode,
        memo: '',
        date: erpDate,
        items: itemsData
      })
    });
    var data = await resp.json();

    if (!resp.ok || data.error) {
      alert('전표 등록 실패: ' + (data.error || '서버 오류') + (data.detail ? '\n' + data.detail : ''));
    } else {
      alert('전표 등록 완료\n' + (data.result || ''));
      // 카운터 업데이트
      updateInvoiceCounter(clientName, customerCode, totalAmount);
      // 작업이력 기록
      if (typeof saveActionHistory === 'function') {
        saveActionHistory('전표등록', '밀워키', itemsData.length, null);
      }
    }
  } catch (err) {
    alert('전표 등록 실패: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📋 전표 등록';
  }
}

// ======================== 전표 카운터 + 팝오버 ========================
function getInvoiceToday() {
  var saved = loadObj('mw_invoice_today', { date: '', count: 0, items: [] });
  var today = new Date().toISOString().slice(0, 10);
  if (saved.date !== today) return { date: today, count: 0, items: [] };
  return saved;
}

function saveInvoiceToday(data) {
  localStorage.setItem('mw_invoice_today', JSON.stringify(data));
}

function updateInvoiceCounter(customerName, customerCode, amount) {
  var data = getInvoiceToday();
  data.count++;
  var found = data.items.find(function(it) { return it.customerCode === customerCode; });
  if (found) {
    found.count++;
    found.totalAmount += amount;
  } else {
    data.items.push({ customer: customerName, customerCode: customerCode, count: 1, totalAmount: amount });
  }
  saveInvoiceToday(data);
  renderInvoiceBadge();
}

function renderInvoiceBadge() {
  var data = getInvoiceToday();
  var badge = document.getElementById('invoice-count-badge');
  if (badge) badge.textContent = data.count + '건';
}

function toggleInvoicePopover() {
  var existing = document.getElementById('invoice-popover');
  if (existing) { existing.remove(); return; }
  var data = getInvoiceToday();
  var badge = document.getElementById('invoice-count-badge');
  if (!badge) return;

  var pop = document.createElement('div');
  pop.id = 'invoice-popover';
  pop.style.cssText = 'position:absolute;top:100%;right:0;width:360px;background:#fff;border:1px solid #DDE1EB;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:500;font-size:12px;margin-top:4px';

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #EEF0F4"><span style="font-size:13px;font-weight:600;color:#1A1D23">오늘 전표 등록 이력</span><span onclick="document.getElementById(\'invoice-popover\').remove()" style="cursor:pointer;color:#9BA3B2;font-size:16px">&times;</span></div>';

  if (!data.items.length) {
    html += '<div style="padding:24px;text-align:center;color:#9BA3B2">오늘 등록된 전표가 없습니다</div>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid #EEF0F4"><th style="padding:8px 14px;text-align:left;color:#5A6070;font-weight:500">거래처</th><th style="padding:8px;text-align:center;color:#5A6070;font-weight:500">거래건수</th><th style="padding:8px 14px;text-align:right;color:#5A6070;font-weight:500">총금액</th></tr></thead><tbody>';
    var totalAmt = 0;
    data.items.forEach(function(it) {
      totalAmt += it.totalAmount;
      html += '<tr style="border-bottom:1px solid #F4F6FA"><td style="padding:6px 14px;font-weight:500">' + it.customer + '</td><td style="padding:6px 8px;text-align:center;color:#185FA5;font-weight:500">' + it.count + '건</td><td style="padding:6px 14px;text-align:right;color:#1D9E75;font-weight:500">' + it.totalAmount.toLocaleString() + '원</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div style="padding:8px 14px;background:#F9FAFB;border-top:1px solid #EEF0F4;display:flex;justify-content:space-between;font-weight:600"><span>오늘 합계 (' + data.count + '건)</span><span style="color:#1D9E75">' + totalAmt.toLocaleString() + '원</span></div>';
  }
  pop.innerHTML = html;

  // badge의 부모에 position:relative 적용
  var parent = badge.parentElement;
  parent.style.position = 'relative';
  parent.appendChild(pop);

  // 바깥 클릭 닫기
  setTimeout(function() {
    document.addEventListener('click', function closePop(e) {
      if (!pop.contains(e.target) && e.target !== badge) {
        pop.remove();
        document.removeEventListener('click', closePop);
      }
    });
  }, 100);
}

// 페이지 로드 시 뱃지 초기화
setTimeout(renderInvoiceBadge, 300);

// ======================== 밀워키 자동발주 카운터 + 팝오버 ========================

function getAutoOrderToday() {
  var saved = loadObj('mw_auto_order_today', { date: '', count: 0, items: [] });
  var today = new Date().toISOString().slice(0, 10);
  if (saved.date !== today) return { date: today, count: 0, items: [] };
  return saved;
}

function saveAutoOrderToday(data) {
  localStorage.setItem('mw_auto_order_today', JSON.stringify(data));
}

function updateAutoOrderCounter(type, label, supplyTotal, costTotal) {
  var data = getAutoOrderToday();
  data.count++;
  var found = data.items.find(function(it) { return it.type === type; });
  if (found) {
    found.count++;
    found.supplyTotal += supplyTotal;
    found.costTotal += costTotal;
  } else {
    data.items.push({ type: type, label: label, count: 1, supplyTotal: supplyTotal, costTotal: costTotal });
  }
  saveAutoOrderToday(data);
  renderAutoOrderBadge();
}

function renderAutoOrderBadge() {
  var data = getAutoOrderToday();
  var b1 = document.getElementById('autoOrderBadge-normal');
  var b2 = document.getElementById('autoOrderBadge-promo');
  if (b1) b1.textContent = data.count + '건';
  if (b2) b2.textContent = data.count + '건';
}

function showAutoOrderPopover(event, orderType) {
  event.stopPropagation();
  var popId = 'autoOrder-popover';
  var existing = document.getElementById(popId);
  if (existing) { existing.remove(); return; }

  var data = getAutoOrderToday();
  var badge = document.getElementById('autoOrderBadge-' + orderType);
  if (!badge) return;

  var pop = document.createElement('div');
  pop.id = popId;
  pop.style.cssText = 'position:absolute;top:100%;right:0;width:420px;background:#fff;border:1px solid #DDE1EB;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:500;font-size:12px;margin-top:4px';

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #EEF0F4"><span style="font-size:13px;font-weight:600;color:#1A1D23">오늘 밀워키 발주 이력</span><span onclick="document.getElementById(\'' + popId + '\').remove()" style="cursor:pointer;color:#9BA3B2;font-size:16px">&times;</span></div>';

  if (!data.items.length) {
    html += '<div style="padding:24px;text-align:center;color:#9BA3B2">오늘 발주 이력이 없습니다</div>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid #EEF0F4"><th style="padding:8px 14px;text-align:left;color:#5A6070;font-weight:500">구분</th><th style="padding:8px;text-align:center;color:#5A6070;font-weight:500">건수</th><th style="padding:8px;text-align:right;color:#5A6070;font-weight:500">공급합계</th><th style="padding:8px 14px;text-align:right;color:#5A6070;font-weight:500">원가합계</th></tr></thead><tbody>';
    var totalSupply = 0, totalCost = 0;
    data.items.forEach(function(it) {
      totalSupply += it.supplyTotal;
      totalCost += it.costTotal;
      html += '<tr style="border-bottom:1px solid #F4F6FA"><td style="padding:6px 14px;font-weight:500">' + it.label + '</td><td style="padding:6px 8px;text-align:center;color:#185FA5;font-weight:500">' + it.count + '건</td><td style="padding:6px 8px;text-align:right">' + totalSupply.toLocaleString() + '원</td><td style="padding:6px 14px;text-align:right;color:#1D9E75;font-weight:500">' + it.costTotal.toLocaleString() + '원</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div style="padding:8px 14px;background:#F9FAFB;border-top:1px solid #EEF0F4;display:flex;justify-content:space-between;font-weight:600"><span>합계 (' + data.count + '건)</span><span>공급 ' + totalSupply.toLocaleString() + '원 / <span style="color:#1D9E75">원가 ' + totalCost.toLocaleString() + '원</span></span></div>';
  }
  pop.innerHTML = html;

  var parent = badge.parentElement;
  parent.style.position = 'relative';
  parent.appendChild(pop);

  setTimeout(function() {
    document.addEventListener('click', function closePop(e) {
      if (!pop.contains(e.target) && e.target !== badge) {
        pop.remove();
        document.removeEventListener('click', closePop);
      }
    });
  }, 100);
}

// ======================== 매입전표 카운터 + 팝오버 ========================

function getPurchaseInvoiceToday() {
  var saved = loadObj('mw_purchase_invoice_today', { date: '', count: 0, items: [] });
  var today = new Date().toISOString().slice(0, 10);
  if (saved.date !== today) return { date: today, count: 0, items: [] };
  return saved;
}

function savePurchaseInvoiceToday(data) {
  localStorage.setItem('mw_purchase_invoice_today', JSON.stringify(data));
}

function updatePurchaseInvoiceCounter(type, label, productCount, costTotal) {
  var data = getPurchaseInvoiceToday();
  data.count++;
  var found = data.items.find(function(it) { return it.type === type; });
  if (found) {
    found.count++;
    found.productCount += productCount;
    found.costTotal += costTotal;
  } else {
    data.items.push({ type: type, label: label, count: 1, productCount: productCount, costTotal: costTotal });
  }
  savePurchaseInvoiceToday(data);
  renderPurchaseInvoiceBadge();
}

function renderPurchaseInvoiceBadge() {
  var data = getPurchaseInvoiceToday();
  var b1 = document.getElementById('purchaseInvoiceBadge-normal');
  var b2 = document.getElementById('purchaseInvoiceBadge-promo');
  if (b1) b1.textContent = data.count + '건';
  if (b2) b2.textContent = data.count + '건';
}

function showPurchaseInvoicePopover(event, orderType) {
  event.stopPropagation();
  var popId = 'purchaseInvoice-popover';
  var existing = document.getElementById(popId);
  if (existing) { existing.remove(); return; }

  var data = getPurchaseInvoiceToday();
  var badge = document.getElementById('purchaseInvoiceBadge-' + orderType);
  if (!badge) return;

  var pop = document.createElement('div');
  pop.id = popId;
  pop.style.cssText = 'position:absolute;top:100%;right:0;width:400px;background:#fff;border:1px solid #DDE1EB;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:500;font-size:12px;margin-top:4px';

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #EEF0F4"><span style="font-size:13px;font-weight:600;color:#1A1D23">오늘 매입전표 등록 이력</span><span onclick="document.getElementById(\'' + popId + '\').remove()" style="cursor:pointer;color:#9BA3B2;font-size:16px">&times;</span></div>';

  if (!data.items.length) {
    html += '<div style="padding:24px;text-align:center;color:#9BA3B2">오늘 등록된 매입전표가 없습니다</div>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid #EEF0F4"><th style="padding:8px 14px;text-align:left;color:#5A6070;font-weight:500">구분</th><th style="padding:8px;text-align:center;color:#5A6070;font-weight:500">건수</th><th style="padding:8px 14px;text-align:right;color:#5A6070;font-weight:500">매입원가 합계</th></tr></thead><tbody>';
    var totalCost = 0;
    data.items.forEach(function(it) {
      totalCost += it.costTotal;
      html += '<tr style="border-bottom:1px solid #F4F6FA"><td style="padding:6px 14px;font-weight:500">' + it.label + '</td><td style="padding:6px 8px;text-align:center;color:#185FA5;font-weight:500">' + it.count + '건(' + it.productCount + '품목)</td><td style="padding:6px 14px;text-align:right;color:#1D9E75;font-weight:500">' + it.costTotal.toLocaleString() + '원</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div style="padding:8px 14px;background:#F9FAFB;border-top:1px solid #EEF0F4;display:flex;justify-content:space-between;font-weight:600"><span>합계 (' + data.count + '건)</span><span style="color:#1D9E75">' + totalCost.toLocaleString() + '원</span></div>';
  }
  pop.innerHTML = html;

  var parent = badge.parentElement;
  parent.style.position = 'relative';
  parent.appendChild(pop);

  setTimeout(function() {
    document.addEventListener('click', function closePop(e) {
      if (!pop.contains(e.target) && e.target !== badge) {
        pop.remove();
        document.removeEventListener('click', closePop);
      }
    });
  }, 100);
}

// ======================== 자동발주 + 매입전표 핸들러 ========================

// 발주서 품목 수집 (일반/프로모션 공통)
function collectOrderItems(orderType) {
  var items = [];
  if (orderType === 'normal') {
    ['elec', 'hand', 'pack'].forEach(function(type) {
      (DB.orders[type] || []).forEach(function(item) {
        if (!item.code || !item.qty || item.qty <= 0) return;
        var p = findProduct(item.code);
        if (!p) return;
        var supply = p.supplyPrice || 0;
        var cost = Math.round(calcOrderCost(supply, p.category || ''));
        items.push({
          code: item.code,
          orderNum: p.orderNum || '',
          ttiNum: p.ttiNum || '',
          model: p.model || '',
          qty: item.qty,
          supplyPrice: supply,
          costPrice: cost,
          productDC: p.productDC || 0
        });
      });
    });
  } else {
    // 프로모션: poOrderData + spotOrderData
    (typeof poOrderData !== 'undefined' ? poOrderData : []).forEach(function(item) {
      if (!item.orderQty || item.orderQty <= 0) return;
      var code = item.code || findCodeByModel(item.model, item.ttiNum);
      var p = code ? findProduct(code) : null;
      items.push({
        code: code || '',
        orderNum: item.orderNum || (p ? p.orderNum : '') || '',
        ttiNum: item.ttiNum || (p ? p.ttiNum : '') || '',
        model: item.model || '',
        qty: item.orderQty,
        supplyPrice: item.promoPrice || item.basePrice || 0,
        costPrice: p ? Math.round(calcOrderCost(p.supplyPrice, p.category || '')) : 0,
        productDC: p ? (p.productDC || 0) : 0
      });
    });
    (typeof spotOrderData !== 'undefined' ? spotOrderData : []).forEach(function(item) {
      if (!item.orderQty || item.orderQty <= 0) return;
      var code = item.code || findCodeByModel(item.model, item.ttiNum);
      var p = code ? findProduct(code) : null;
      items.push({
        code: code || '',
        orderNum: item.orderNum || (p ? p.orderNum : '') || '',
        ttiNum: item.ttiNum || (p ? p.ttiNum : '') || '',
        model: item.model || '',
        qty: item.orderQty,
        supplyPrice: item.promoPrice || item.basePrice || 0,
        costPrice: p ? Math.round(calcOrderCost(p.supplyPrice, p.category || '')) : 0,
        productDC: p ? (p.productDC || 0) : 0
      });
    });
  }
  return items;
}

// 밀워키 자동발주
function handleAutoOrder(orderType) {
  var items = collectOrderItems(orderType);
  if (!items.length) {
    toast('발주할 품목이 없습니다');
    return;
  }

  // TTI 순번이 있는 품목만 추출
  var ttiItems = items.filter(function(it) { return it.orderNum; });
  if (!ttiItems.length) {
    toast('TTI 순번이 있는 품목이 없습니다');
    return;
  }

  // 확장 프로그램 설치 확인
  if (!window._daehanExtensionReady) {
    alert('크롬 확장 프로그램(밀워키 자동발주)을 설치해주세요.\n\n설치 후 페이지를 새로고침하세요.');
    return;
  }

  var label = orderType === 'normal' ? '일반주문' : '프로모션';
  var supplyTotal = 0, costTotal = 0;
  ttiItems.forEach(function(it) {
    supplyTotal += it.supplyPrice * it.qty;
    costTotal += it.costPrice * it.qty;
  });

  if (!confirm('[밀워키 자동발주]\n\n' + label + ' ' + ttiItems.length + '건\n공급가 합계: ' + supplyTotal.toLocaleString() + '원\n원가 합계: ' + costTotal.toLocaleString() + '원\n\nTTI 사이트에서 자동 발주를 진행하시겠습니까?')) {
    return;
  }

  // 확장 프로그램에 메시지 전송
  window.postMessage({
    type: 'DAEHAN_AUTO_ORDER',
    action: 'autoOrder',
    orderType: orderType,
    items: ttiItems.map(function(it) { return { code: it.orderNum, qty: it.qty }; })
  }, '*');

  // 카운터 업데이트
  updateAutoOrderCounter(orderType, label, supplyTotal, costTotal);
  toast('자동 발주 요청 전송 (' + ttiItems.length + '건)');
}

// 매입전표 등록 (경영박사 NewOrderIn)
var TTI_CUSTOMER_CODE = '20260401_2159';

async function handlePurchaseInvoice(orderType) {
  var items = collectOrderItems(orderType);
  if (!items.length) {
    alert('발주서에 수량이 입력된 품목이 없습니다');
    return;
  }

  // 매입원가 계산
  var costTotal = 0;
  items.forEach(function(it) { costTotal += it.costPrice * it.qty; });
  var label = orderType === 'normal' ? '일반주문 매입' : '프로모션 매입';

  if (!confirm('매입전표를 등록하시겠습니까?\n\n거래처: TTI코리아\n품목: ' + items.length + '건\n매입원가 합계: ' + costTotal.toLocaleString() + '원')) {
    return;
  }

  // 날짜 포맷: YY.MM.DD
  var now = new Date();
  var yy = String(now.getFullYear()).slice(2);
  var mm = String(now.getMonth() + 1).padStart(2, '0');
  var dd = String(now.getDate()).padStart(2, '0');
  var dateStr = yy + '.' + mm + '.' + dd;

  try {
    // 품목별 manageCode(CODE2) 조회 + 매입원가 계산
    var apiItems = items.map(function(it) {
      var p = findProduct(it.code);
      var code2 = p ? (p.manageCode || p.ttiNum || String(it.code)) : String(it.code);
      var amount = it.costPrice * it.qty;
      var vat = Math.round(amount / 10);
      return {
        code: code2,
        qty: it.qty,
        price: it.costPrice,
        amount: amount,
        vat: vat,
        memo: ''
      };
    });

    console.log('[매입전표] 거래처:', TTI_CUSTOMER_CODE, '품목:', apiItems.length + '건', '합계:', costTotal);

    var res = await fetch('/api/erp/order-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerCode: TTI_CUSTOMER_CODE,
        memo: '밀워키 발주매입',
        date: dateStr,
        items: apiItems
      })
    });

    var result = await res.json();
    if (!res.ok || result.error) {
      alert('등록 실패: ' + (result.error || '알 수 없는 오류'));
      console.error('[매입전표 실패]', result);
      return;
    }

    alert('매입전표 등록 완료' + (result.orderNo ? ' — 전표번호: ' + result.orderNo : ''));
    console.log('[매입전표 성공]', result);
    updatePurchaseInvoiceCounter(orderType, label, items.length, costTotal);

  } catch (err) {
    alert('서버 연결 실패: ' + err.message);
    console.error('[매입전표 오류]', err);
  }
}

// ======================== 크롬 확장 연결 ========================

window._daehanExtensionReady = false;

window.addEventListener('message', function(event) {
  if (event.source !== window) return;

  // 확장 프로그램 READY 신호
  if (event.data && event.data.type === 'DAEHAN_EXTENSION_READY') {
    window._daehanExtensionReady = true;
    console.log('[자동발주] 크롬 확장 프로그램 감지됨, 버전:', event.data.version);
  }

  // 자동발주 결과 수신
  if (event.data && event.data.type === 'DAEHAN_ORDER_RESULT') {
    console.log('[자동발주] 결과 수신:', event.data);
    if (event.data.success) {
      toast('TTI 자동 발주 시작됨');
    } else {
      toast('자동 발주 실패: ' + (event.data.error || event.data.message), 'error');
    }
  }

  // 확장 상태 응답
  if (event.data && event.data.type === 'DAEHAN_EXTENSION_STATUS') {
    window._daehanExtensionReady = event.data.installed;
  }

  // TTI 제품 스크래핑 결과 수신
  if (event.data && event.data.type === 'DAEHAN_SCRAPE_RESULT') {
    handleTtiScrapeResult(event.data);
  }

  // TTI 스크래핑 진행 상태
  if (event.data && event.data.type === 'DAEHAN_SCRAPE_PROGRESS') {
    showTtiSyncProgress(event.data.status || (event.data.current + '/' + event.data.total + ' 페이지 스크래핑 중... (' + event.data.count + '건)'));
  }

  // (프로모션 스크래핑 결과 수신 제거됨 — 온라인주문내역 Remark로 대체)

  // TTI 주문취소/재주문 결과 수신
  if (event.data && event.data.type === 'TTI_ACTION_RESULT') {
    var actionText = event.data.action === 'TTI_CANCEL_ORDER' ? '주문취소' : '재주문';
    if (event.data.success) {
      console.log('[app] TTI', actionText, '성공:', event.data.orderNo);
      toast(actionText + ' 처리 완료');
      setTimeout(function() {
        var listContent = document.getElementById('po-content-list');
        if (listContent) listContent.innerHTML = buildPOListPanel();
      }, 3000);
    } else {
      console.error('[app] TTI', actionText, '실패:', event.data.error);
      alert(actionText + ' 처리에 실패했습니다.\n' + (event.data.error || 'TTI 사이트를 확인해주세요.'));
      var listContent = document.getElementById('po-content-list');
      if (listContent) listContent.innerHTML = buildPOListPanel();
    }
  }

  // TTI 주문내역 스크래핑 결과 수신
  if (event.data && event.data.type === 'TTI_ORDER_HISTORY_DATA') {
    console.log('[app] TTI 주문내역 수신:', event.data.orders.length, '건');
    syncTtiOrderHistory(event.data.orders);
    save('mw_order_sync_time', new Date().toISOString());
    var tsEl = document.getElementById('po-scrape-timestamp');
    if (tsEl) {
      var d = new Date();
      tsEl.textContent = '최근 동기화: ' + (d.getMonth()+1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }
    toast('주문내역 동기화 완료: ' + event.data.orders.length + '건');
  }
});

// 페이지 로드 시 확장 확인 + 뱃지 초기화
setTimeout(function() {
  window.postMessage({ type: 'DAEHAN_CHECK_EXTENSION' }, '*');
  renderAutoOrderBadge();
  renderPurchaseInvoiceBadge();
}, 500);

// ========================================
// Phase 2-1: TTI 제품연동 (크롬 확장 연동)
// ========================================

// TTI 제품 스크래핑 요청
function startTtiProductScrape() {
  if (!window._daehanExtensionReady) {
    alert('크롬 확장 프로그램이 설치되어 있지 않습니다.\n대한종합상사 자동발주 확장을 설치해주세요.');
    return;
  }

  console.log('[TTI연동] 제품 스크래핑 요청');
  window.postMessage({ type: 'DAEHAN_SCRAPE_PRODUCTS' }, '*');

  // 진행 상태 표시
  showTtiSyncProgress('제품 데이터 수집 중...');
}

// TTI 주문내역 동기화 요청 (이번 달 1일 ~ 오늘)
function startTtiOrderSync() {
  if (!window._daehanExtensionReady) {
    alert('크롬 확장 프로그램이 설치되어 있지 않습니다.');
    return;
  }
  var now = new Date();
  var startDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  var endDate = now.toISOString().slice(0, 10);
  console.log('[TTI연동] 주문내역 동기화 요청:', startDate, '~', endDate);
  window.postMessage({ type: 'DAEHAN_SCRAPE_ORDER_HISTORY', startDate: startDate, endDate: endDate }, '*');
  showTtiSyncProgress('주문내역 수집 중...');
}

// 스크래핑 진행 상태 표시
function showTtiSyncProgress(message) {
  var statusEl = document.getElementById('tti-sync-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'tti-sync-status';
    statusEl.style.cssText = 'position:fixed;top:20px;right:20px;background:#1e3a5f;color:white;padding:12px 20px;border-radius:8px;z-index:10000;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(statusEl);
  }
  statusEl.textContent = message;
  statusEl.style.display = 'block';
}

// 스크래핑 진행 상태 숨기기
function hideTtiSyncProgress() {
  var statusEl = document.getElementById('tti-sync-status');
  if (statusEl) statusEl.style.display = 'none';
}

// TTI 스크래핑 결과 수신 처리
function handleTtiScrapeResult(data) {
  console.log('[TTI연동] 제품 스크래핑 결과:', data.totalCount || data.data.length, '건');
  hideTtiSyncProgress();

  // TTI 데이터를 localStorage에 임시 저장
  var ttiProducts = data.data || [];
  save('mw_tti_products', {
    data: ttiProducts,
    count: ttiProducts.length,
    scrapedAt: new Date().toISOString()
  });

  // 비교 실행 → 결과 팝업 표시
  showProductSyncReport(ttiProducts);
}

// (handleTtiPromoResult 제거됨 — 온라인주문내역 Remark로 대체)

// TTI 코드 정규화 (앞자리 0 제거)
function normalizeTtiCode(code) {
  return String(code || '').replace(/^0+/, '');
}

// TTI vs 대한플랫폼 제품 비교
function showProductSyncReport(ttiProducts) {
  // 기존 mw_products 로드
  var mwProducts = JSON.parse(localStorage.getItem('mw_products') || '[]');

  // ttiNum 기준 매핑 (앞자리 0 제거 후 비교)
  var mwMap = {};
  mwProducts.forEach(function(p) {
    var code = normalizeTtiCode(p.ttiNum);
    if (code) mwMap[code] = p;
  });

  var newProducts = [];      // TTI에만 있는 제품
  var priceChanged = [];     // 공급가 다른 제품
  var infoChanged = [];      // 기타 정보 다른 제품
  var matched = [];          // 일치
  var ttiMap = {};           // TTI 제품 맵 (단종 체크용)

  ttiProducts.forEach(function(tti) {
    var ttiCode = normalizeTtiCode(tti.productCode);
    ttiMap[ttiCode] = tti;
    var mw = mwMap[ttiCode];

    if (!mw) {
      newProducts.push(tti);
      return;
    }

    // 공급가 비교
    var mwPrice = parseInt(String(mw.supplyPrice || 0).replace(/,/g, '')) || 0;
    if (mwPrice > 0 && tti.supplyPrice > 0 && mwPrice !== tti.supplyPrice) {
      priceChanged.push({
        tti: tti,
        mw: mw,
        oldPrice: mwPrice,
        newPrice: tti.supplyPrice
      });
      return;
    }

    matched.push(tti);
  });

  // 단종 의심: mw에 있지만 TTI에 없는 제품
  var discontinued = [];
  mwProducts.forEach(function(mw) {
    var code = normalizeTtiCode(mw.ttiNum);
    if (code && !ttiMap[code]) {
      discontinued.push(mw);
    }
  });

  console.log('[TTI연동] 비교 결과: 신규', newProducts.length, '가격변경', priceChanged.length, '단종의심', discontinued.length, '일치', matched.length);

  // 결과를 localStorage에 저장 (팝업에서 사용)
  save('mw_tti_sync_report', {
    newProducts: newProducts,
    priceChanged: priceChanged,
    infoChanged: infoChanged,
    discontinued: discontinued,
    matched: matched,
    ttiTotal: ttiProducts.length,
    mwTotal: mwProducts.length,
    generatedAt: new Date().toISOString()
  });

  // 팝업 표시
  showSyncReportPopup();
}

// 제품연동 결과 팝업 표시
function showSyncReportPopup() {
  var report = JSON.parse(localStorage.getItem('mw_tti_sync_report') || '{}');
  if (!report.newProducts) {
    alert('비교 결과가 없습니다. 먼저 TTI 스캔을 실행해주세요.');
    return;
  }

  // 기존 팝업 제거
  var existing = document.getElementById('tti-sync-popup');
  if (existing) existing.remove();

  var popup = document.createElement('div');
  popup.id = 'tti-sync-popup';
  popup.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding-top:40px;';

  var newCount = report.newProducts.length;
  var priceCount = report.priceChanged.length;
  var discCount = report.discontinued.length;
  var matchCount = report.matched.length;

  var html = '<div style="background:white;border-radius:12px;width:1400px;max-width:95vw;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">';

  // 헤더
  html += '<div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">';
  html += '<div><span style="font-size:16px;font-weight:600;">제품연동</span><span style="font-size:12px;color:#888;margin-left:8px;">TTI 제품검색 vs 대한플랫폼 단가표</span></div>';
  html += '<button onclick="document.getElementById(\'tti-sync-popup\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888;">✕</button>';
  html += '</div>';

  // 상태 바
  html += '<div style="padding:8px 20px;background:#f8f8f8;border-bottom:1px solid #eee;font-size:11px;color:#666;">';
  html += 'TTI ' + report.ttiTotal + '건 vs 대한플랫폼 ' + report.mwTotal + '건 비교 완료 | ' + report.generatedAt;
  html += '</div>';

  // 요약 카드
  html += '<div style="display:flex;gap:8px;padding:12px 20px;">';
  html += '<div style="flex:1;padding:10px;border-radius:8px;background:#e6f1fb;text-align:center;"><div style="font-size:20px;font-weight:600;color:#0c447c;">' + newCount + '</div><div style="font-size:11px;color:#666;">신규 제품</div></div>';
  html += '<div style="flex:1;padding:10px;border-radius:8px;background:#faeeda;text-align:center;"><div style="font-size:20px;font-weight:600;color:#854f0b;">' + priceCount + '</div><div style="font-size:11px;color:#666;">가격 변경</div></div>';
  html += '<div style="flex:1;padding:10px;border-radius:8px;background:#fcebeb;text-align:center;"><div style="font-size:20px;font-weight:600;color:#a32d2d;">' + discCount + '</div><div style="font-size:11px;color:#666;">단종 의심</div></div>';
  html += '<div style="flex:1;padding:10px;border-radius:8px;background:#f1efe8;text-align:center;"><div style="font-size:20px;font-weight:600;color:#888;">' + matchCount + '</div><div style="font-size:11px;color:#666;">일치</div></div>';
  html += '</div>';

  // 탭
  html += '<div style="display:flex;gap:0;border-bottom:1px solid #eee;padding:0 20px;" id="sync-tabs">';
  html += '<button class="sync-tab active" onclick="switchSyncTab(\'new\')" data-tab="new" style="padding:8px 16px;border:none;background:none;border-bottom:2px solid #185fa5;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;">신규 추가 (' + newCount + ')</button>';
  html += '<button class="sync-tab" onclick="switchSyncTab(\'price\')" data-tab="price" style="padding:8px 16px;border:none;background:none;border-bottom:2px solid transparent;font-size:12px;color:#888;cursor:pointer;white-space:nowrap;">가격 변경 (' + priceCount + ')</button>';
  html += '<button class="sync-tab" onclick="switchSyncTab(\'disc\')" data-tab="disc" style="padding:8px 16px;border:none;background:none;border-bottom:2px solid transparent;font-size:12px;color:#888;cursor:pointer;white-space:nowrap;">단종 의심 (' + discCount + ')</button>';
  html += '</div>';

  // 테이블 영역 (스크롤)
  html += '<div style="flex:1;overflow-y:auto;overflow-x:auto;padding:0;" id="sync-table-area">';
  html += buildSyncTable('new', report);
  html += '</div>';

  // 하단
  html += '<div style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;background:#f8f8f8;">';
  html += '<span style="font-size:11px;color:#888;" id="sync-selected-count">선택: 0건</span>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<button onclick="selectAllSyncItems()" style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;background:white;font-size:11px;cursor:pointer;">전체 선택</button>';
  html += '<button onclick="deselectAllSyncItems()" style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;background:white;font-size:11px;cursor:pointer;">선택 해제</button>';
  html += '<button onclick="applySyncItems()" style="padding:6px 14px;border:none;border-radius:6px;background:#185fa5;color:white;font-size:12px;font-weight:500;cursor:pointer;">선택 항목 적용</button>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  popup.innerHTML = html;
  document.body.appendChild(popup);

  // 팝업 외부 클릭 시 닫기
  popup.addEventListener('click', function(e) {
    if (e.target === popup) popup.remove();
  });

  updateSyncSelectedCount();
}

// 탭별 테이블 빌드
function buildSyncTable(tab, report) {
  var thStyle = 'padding:6px 8px;font-weight:500;font-size:11px;color:#888;border-bottom:1px solid #eee;white-space:nowrap;';
  var tdStyle = 'padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap;';
  var modelTdStyle = tdStyle + 'max-width:400px;overflow:hidden;text-overflow:ellipsis;';
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';

  if (tab === 'new') {
    html += '<tr style="background:#f8f8f8;"><th style="' + thStyle + 'text-align:left;width:24px;"><input type="checkbox" onchange="toggleAllSync(this)" checked></th>';
    html += '<th style="' + thStyle + 'text-align:left;">제품번호</th>';
    html += '<th style="' + thStyle + 'text-align:left;">순번</th>';
    html += '<th style="' + thStyle + 'text-align:left;">제품군</th>';
    html += '<th style="' + thStyle + 'text-align:left;">제품구성</th>';
    html += '<th style="' + thStyle + 'text-align:left;">모델명</th>';
    html += '<th style="' + thStyle + 'text-align:right;">공급가</th>';
    html += '<th style="' + thStyle + 'text-align:left;">상태</th></tr>';

    report.newProducts.forEach(function(p, i) {
      html += '<tr style="background:#f5f9ff;" data-sync-type="new" data-sync-idx="' + i + '">';
      html += '<td style="' + tdStyle + '"><input type="checkbox" class="sync-check" data-type="new" data-idx="' + i + '" checked onchange="updateSyncSelectedCount()"></td>';
      html += '<td style="' + tdStyle + 'font-family:monospace;font-size:10px;">' + p.productCode + '</td>';
      html += '<td style="' + tdStyle + '">' + p.promoNo + '</td>';
      html += '<td style="' + tdStyle + '">' + p.category + '</td>';
      html += '<td style="' + tdStyle + '">' + p.subCategory + '</td>';
      html += '<td style="' + modelTdStyle + 'font-size:11px;" title="' + (p.modelName || '').replace(/"/g, '&quot;') + '">' + p.modelName + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;font-weight:500;">' + (p.supplyPrice || 0).toLocaleString() + '</td>';
      html += '<td style="' + tdStyle + '"><span style="background:#e6f1fb;color:#0c447c;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">신규</span></td>';
      html += '</tr>';
    });
  }

  if (tab === 'price') {
    html += '<tr style="background:#f8f8f8;"><th style="' + thStyle + 'text-align:left;width:24px;"><input type="checkbox" onchange="toggleAllSync(this)" checked></th>';
    html += '<th style="' + thStyle + 'text-align:left;">제품번호</th>';
    html += '<th style="' + thStyle + 'text-align:left;">모델명</th>';
    html += '<th style="' + thStyle + 'text-align:right;">기존 공급가</th>';
    html += '<th style="' + thStyle + 'text-align:right;">변경 공급가</th>';
    html += '<th style="' + thStyle + 'text-align:right;">차이</th>';
    html += '<th style="' + thStyle + 'text-align:left;">상태</th></tr>';

    report.priceChanged.forEach(function(p, i) {
      var diff = p.newPrice - p.oldPrice;
      var diffColor = diff > 0 ? '#a32d2d' : '#0f6e56';
      html += '<tr style="background:#fffbf0;" data-sync-type="price" data-sync-idx="' + i + '">';
      html += '<td style="' + tdStyle + '"><input type="checkbox" class="sync-check" data-type="price" data-idx="' + i + '" checked onchange="updateSyncSelectedCount()"></td>';
      html += '<td style="' + tdStyle + 'font-family:monospace;font-size:10px;">' + p.tti.productCode + '</td>';
      html += '<td style="' + modelTdStyle + 'font-size:11px;" title="' + (p.tti.modelName || '').replace(/"/g, '&quot;') + '">' + p.tti.modelName + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;text-decoration:line-through;color:#999;">' + p.oldPrice.toLocaleString() + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;font-weight:500;color:#0f6e56;">' + p.newPrice.toLocaleString() + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;color:' + diffColor + ';">' + (diff > 0 ? '+' : '') + diff.toLocaleString() + '</td>';
      html += '<td style="' + tdStyle + '"><span style="background:#faeeda;color:#854f0b;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">가격변경</span></td>';
      html += '</tr>';
    });
  }

  if (tab === 'disc') {
    html += '<tr style="background:#f8f8f8;">';
    html += '<th style="' + thStyle + 'text-align:left;">코드</th>';
    html += '<th style="' + thStyle + 'text-align:left;">모델명</th>';
    html += '<th style="' + thStyle + 'text-align:left;">제품설명</th>';
    html += '<th style="' + thStyle + 'text-align:right;">공급가</th>';
    html += '<th style="' + thStyle + 'text-align:left;">상태</th></tr>';

    report.discontinued.forEach(function(p) {
      html += '<tr style="background:#fff5f5;">';
      html += '<td style="' + tdStyle + '">' + (p.code || '') + '</td>';
      html += '<td style="' + modelTdStyle + 'font-size:11px;" title="' + (p.model || '').replace(/"/g, '&quot;') + '">' + (p.model || '') + '</td>';
      html += '<td style="' + modelTdStyle + 'font-size:11px;" title="' + (p.detail || '').replace(/"/g, '&quot;') + '">' + (p.detail || '') + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;">' + (parseInt(String(p.supplyPrice || 0).replace(/,/g, '')) || 0).toLocaleString() + '</td>';
      html += '<td style="' + tdStyle + '"><span style="background:#fcebeb;color:#a32d2d;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">단종의심</span></td>';
      html += '</tr>';
    });
  }

  if (html.indexOf('<tr style="background:') === -1 || html.split('<tr').length < 3) {
    html += '<tr><td colspan="8" style="padding:40px;text-align:center;color:#999;font-size:13px;">해당 항목이 없습니다.</td></tr>';
  }

  html += '</table>';
  return html;
}

// 탭 전환
function switchSyncTab(tab) {
  var report = JSON.parse(localStorage.getItem('mw_tti_sync_report') || '{}');
  var area = document.getElementById('sync-table-area');
  if (area) area.innerHTML = buildSyncTable(tab, report);

  // 탭 스타일 전환
  document.querySelectorAll('.sync-tab').forEach(function(btn) {
    if (btn.getAttribute('data-tab') === tab) {
      btn.style.borderBottom = '2px solid #185fa5';
      btn.style.color = '#333';
      btn.style.fontWeight = '500';
    } else {
      btn.style.borderBottom = '2px solid transparent';
      btn.style.color = '#888';
      btn.style.fontWeight = '400';
    }
  });

  updateSyncSelectedCount();
}

// 전체 선택/해제
function toggleAllSync(masterCheckbox) {
  document.querySelectorAll('.sync-check').forEach(function(cb) {
    cb.checked = masterCheckbox.checked;
  });
  updateSyncSelectedCount();
}
function selectAllSyncItems() {
  document.querySelectorAll('.sync-check').forEach(function(cb) { cb.checked = true; });
  updateSyncSelectedCount();
}
function deselectAllSyncItems() {
  document.querySelectorAll('.sync-check').forEach(function(cb) { cb.checked = false; });
  updateSyncSelectedCount();
}

// 선택 카운트 업데이트
function updateSyncSelectedCount() {
  var count = document.querySelectorAll('.sync-check:checked').length;
  var el = document.getElementById('sync-selected-count');
  if (el) el.textContent = '선택: ' + count + '건';
}

// 선택 항목 적용 (본사재고 + 신규 제품 추가 + 가격 변경)
function applySyncItems() {
  var report = JSON.parse(localStorage.getItem('mw_tti_sync_report') || '{}');
  var ttiRaw = JSON.parse(localStorage.getItem('mw_tti_products') || '{}');
  var ttiProducts = ttiRaw.data || [];
  var mwProducts = JSON.parse(localStorage.getItem('mw_products') || '[]');

  var applied = { new: 0, price: 0, stock: 0 };

  // 선택된 신규 제품 추가
  document.querySelectorAll('.sync-check:checked[data-type="new"]').forEach(function(cb) {
    var idx = parseInt(cb.getAttribute('data-idx'));
    var tti = report.newProducts[idx];
    if (tti) {
      mwProducts.push({
        code: '',
        ttiNum: normalizeTtiCode(tti.productCode),
        manageCode: '',
        model: tti.modelName || '',
        detail: '',
        category: '',
        subcategory: tti.subCategory || '',
        orderNum: tti.promoNo || '',
        supplyPrice: tti.supplyPrice || 0,
        cost: 0,
        priceA: 0,
        priceRetail: 0,
        priceNaver: 0,
        priceOpen: 0,
        ttiStock: tti.available ? '●' : '✕',
        inDate: '',
        productDC: 0,
        raiseRate: 0,
        raisedPrice: 0,
        discontinued: 0
      });
      applied.new++;
    }
  });

  // 선택된 가격 변경 적용
  document.querySelectorAll('.sync-check:checked[data-type="price"]').forEach(function(cb) {
    var idx = parseInt(cb.getAttribute('data-idx'));
    var item = report.priceChanged[idx];
    if (item) {
      for (var i = 0; i < mwProducts.length; i++) {
        var code = normalizeTtiCode(mwProducts[i].ttiNum);
        if (code === normalizeTtiCode(item.tti.productCode)) {
          mwProducts[i].supplyPrice = item.newPrice;
          applied.price++;
          break;
        }
      }
    }
  });

  // 본사재고 업데이트 (전체 TTI 제품에 대해)
  var ttiMap = {};
  ttiProducts.forEach(function(t) { ttiMap[normalizeTtiCode(t.productCode)] = t; });

  mwProducts.forEach(function(mw) {
    var code = normalizeTtiCode(mw.ttiNum);
    if (code && ttiMap[code]) {
      mw.ttiStock = ttiMap[code].available ? '●' : '✕';
      applied.stock++;
    }
  });

  // 저장
  save('mw_products', mwProducts);

  alert('적용 완료!\n\n신규 추가: ' + applied.new + '건\n가격 변경: ' + applied.price + '건\n본사재고 업데이트: ' + applied.stock + '건');

  // 팝업 닫기 + 단가표 새로고침
  document.getElementById('tti-sync-popup').remove();
  renderCatalog();
}

// ======================== TAB 5: 세트및분해 ========================
const PARTS_KEYS = ['M12B2','M12HB25','M12B4','M12HB5','M18B2','M18HB3','M18B5','M18FB6','M18FB8','M18FB12','C12C','M1218C','M1218FC'];
const PARTS_LABELS = {'M12B2':'M12 B2','M12HB25':'M12 HB2.5','M12B4':'M12 B4','M12HB5':'M12 HB5','M18B2':'M18 B2','M18HB3':'M18 HB3','M18B5':'M18 B5','M18FB6':'M18 FB6','M18FB8':'M18 FB8','M18FB12':'M18 FB12','C12C':'C12C','M1218C':'M12-18C','M1218FC':'M12-18FC'};

let partsPrices = loadObj('mw_parts_prices', {});
let promoParts = loadObj('mw_parts_prices_promo', {});
let setbunItems = loadObj('mw_setbun_items', []);

function formatPartsInput(el) {
  const raw = el.value.replace(/[^0-9]/g, '');
  el.value = raw ? parseInt(raw).toLocaleString() : '';
}

function loadPartsPricesUI() {
  PARTS_KEYS.forEach(k => {
    const el = document.getElementById('pp-' + k);
    if (el && partsPrices[k]) el.value = partsPrices[k].toLocaleString();
    const pel = document.getElementById('ppp-' + k);
    if (pel && promoParts[k]) pel.value = promoParts[k].toLocaleString();
  });
}

function savePartsPrices() {
  PARTS_KEYS.forEach(k => {
    const el = document.getElementById('pp-' + k);
    if (el) partsPrices[k] = parseInt(el.value.replace(/,/g, '')) || 0;
    const pel = document.getElementById('ppp-' + k);
    if (pel) promoParts[k] = parseInt(pel.value.replace(/,/g, '')) || 0;
  });
  localStorage.setItem('mw_parts_prices', JSON.stringify(partsPrices)); autoSyncToSupabase('mw_parts_prices');
  localStorage.setItem('mw_parts_prices_promo', JSON.stringify(promoParts));
  renderSetbun();
  toast('배터리/충전기 시세 저장 완료 (일반+프로모션)');
}

function getPartPrice(key) { return partsPrices[key] || 0; }

function getPromoPartPrice(key) {
  if (promoParts[key] && promoParts[key] > 0) return promoParts[key];
  return partsPrices[key] || 0;
}

function addSetbunItem(mode) {
  document.getElementById('setbun-edit-title').textContent = '세트 분해 분석 추가';
  document.getElementById('sb-edit-idx').value = -1;
  document.getElementById('sb-search-mode').value = mode || 'normal';
  document.getElementById('sb-set-code').value = '';
  document.getElementById('sb-bare-code').value = '';
  document.getElementById('sb-set-model-input').value = '';
  document.getElementById('sb-set-info').textContent = '-';
  document.getElementById('sb-bare-info').textContent = '-';
  document.getElementById('sb-bare-candidates').style.display = 'none';
  var _ph = document.getElementById('sb-bare-placeholder');
  if (_ph) _ph.style.display = '';
  document.getElementById('sb-promo').value = '';
  document.getElementById('sb-promo-cost').value = '';
  sbUpdateBatteryOptions('');
  document.getElementById('setbun-edit-modal').classList.add('show');
}

function showSetbunAC(inputEl, callback) {
  var val = inputEl.value.trim();
  if (!val || val.length < 1) { hideAC(); return; }
  var mode = document.getElementById('sb-search-mode').value;
  var q = val.toLowerCase();
  var results;
  if (mode === 'promo') {
    results = DB.products.filter(function(p) {
      var hasPromo = DB.promotions.some(function(pr) { return String(pr.code) === String(p.code); });
      if (!hasPromo) return false;
      return String(p.code).includes(q) || String(p.model || '').toLowerCase().includes(q) || String(p.description || '').toLowerCase().includes(q);
    }).slice(0, 15);
  } else {
    results = searchProducts(val);
  }
  if (!results || !results.length) { hideAC(); return; }
  acActive = { input: inputEl, callback: callback };
  acEl.innerHTML = results.map(function(p) {
    var stock = findStock(p.code);
    var stockTxt = stock != null ? '[' + stock + ']' : '';
    var promoTag = mode === 'promo' ? '<span style="color:#CC2222;font-size:10px;margin-left:4px">P</span>' : '';
    return '<div class="ac-item" data-code="' + p.code + '">' +
      '<span class="ac-code">' + p.code + '</span>' +
      '<span class="ac-model">' + String(p.model || '') + promoTag + '</span>' +
      '<span class="ac-desc">' + String(p.description || '').slice(0, 30) + '</span>' +
      '<span class="ac-price">' + fmt(p.supplyPrice) + ' ' + stockTxt + '</span>' +
      '</div>';
  }).join('');
  var rect = inputEl.getBoundingClientRect();
  acEl.style.position = 'fixed';
  acEl.style.top = (rect.bottom + 2) + 'px';
  acEl.style.left = rect.left + 'px';
  acEl.classList.add('show');
}

function closeSetbunModal() { document.getElementById('setbun-edit-modal').classList.remove('show'); }

function sbSelectSet(code) {
  const p = findProduct(code);
  if (!p) return;
  document.getElementById('sb-set-code').value = code;
  document.getElementById('sb-set-model-input').value = p.model || '';
  document.getElementById('sb-set-info').innerHTML = `<span style="font-weight:600">${p.model}</span> — ${p.description || ''}<br><span style="color:#1D9E75">원가: ${fmt(p.cost)}</span> / 공급가: ${fmt(p.supplyPrice)} / 코드: ${code}`;
  // 드롭다운 즉시 닫기 + input blur로 onfocus 재트리거 방지
  hideAC();
  document.getElementById('sb-set-model-input').blur();

  // Detect M12 or M18
  const series = (p.model || '').startsWith('M18') || (p.model || '').startsWith('C18') ? 'M18' : 'M12';
  sbUpdateBatteryOptions(series);

  // Auto-recommend bare tools
  var setModel = p.model || '';
  // 규칙: 마지막 하이픈 뒤 숫자→0, 알파벳 유지 (예: -502X → -0X)
  var bareModel = setModel.replace(/-\d+([A-Za-z]*)$/, '-0$1');
  var baseModel = setModel.replace(/[-]\S*$/, '');
  console.log('[SetBun] 베어툴 매칭:', setModel, '→', bareModel, '/ base:', baseModel);

  // 1순위: 정확 매칭 + 변형 매칭 (예: -0X, -0X0 둘 다 시도)
  var exactCandidates = [];
  if (bareModel !== setModel) {
    // -0X 패턴과 -0X0 패턴 둘 다 시도
    var tryModels = [bareModel];
    if (/[A-Za-z]$/.test(bareModel)) tryModels.push(bareModel + '0');
    tryModels.push(bareModel.replace(/[A-Za-z]+$/, '') + '0');
    DB.products.forEach(function(bp) {
      if (bp.model && tryModels.indexOf(bp.model) !== -1) exactCandidates.push(bp);
    });
    console.log('[SetBun] 정확 매칭 시도:', tryModels.join(', '), '→', exactCandidates.length + '개');
  }
  // 2순위: base 모델 + suffix 매칭
  var bareSuffixes = ['-0', '-0X', '-0X0', '-0B', '-0C', '-0C0'];
  var suffixBare = baseModel ? DB.products.filter(function(bp) {
    if (!bp.model || typeof bp.model !== 'string') return false;
    var bpBase = bp.model.replace(/[-]\S*$/, '');
    if (bpBase !== baseModel) return false;
    return bareSuffixes.some(function(s) { return bp.model.endsWith(s); }) || bp.model.indexOf('-0') !== -1;
  }) : [];
  // 중복 제거 후 합침
  var seenCodes = {};
  var candidates = [];
  exactCandidates.concat(suffixBare).forEach(function(bp) {
    if (!seenCodes[bp.code]) { seenCodes[bp.code] = true; candidates.push(bp); }
  });
  console.log('[SetBun] 총 후보:', candidates.length + '개');

  var listEl = document.getElementById('sb-bare-list');
  var _ph2 = document.getElementById('sb-bare-placeholder');
  if (candidates.length > 0) {
    document.getElementById('sb-bare-candidates').style.display = 'block';
    if (_ph2) _ph2.style.display = 'none';
    listEl.innerHTML = candidates.map(function(bp) {
      return '<button onclick="sbSelectBare(\'' + bp.code + '\')" style="padding:4px 10px;font-size:12px;border:1px solid #DDE1EB;border-radius:4px;background:#fff;cursor:pointer;color:#1A1D23">' + bp.model + '</button>';
    }).join('');
    // 후보가 1개면 자동 선택
    if (candidates.length === 1) {
      sbSelectBare(candidates[0].code);
    }
  } else {
    document.getElementById('sb-bare-candidates').style.display = 'block';
    if (_ph2) _ph2.style.display = 'none';
    listEl.innerHTML = '<span style="color:#9BA3B2;font-size:12px">추천 베어툴 없음 — 아래에서 직접 검색하세요</span>';
  }
}

function sbSelectBare(code) {
  const p = findProduct(code);
  if (!p) return;
  document.getElementById('sb-bare-code').value = code;
  document.getElementById('sb-bare-info').innerHTML = `<span style="font-weight:600">${p.model}</span> — ${p.description || ''}<br><span style="color:#1D9E75">원가: ${fmt(p.cost)}</span> / 공급가: ${fmt(p.supplyPrice)} / 코드: ${code}`;
  // Highlight selected button
  document.querySelectorAll('#sb-bare-list button').forEach(btn => {
    var isSelected = btn.textContent.includes(p.model);
    btn.style.background = isSelected ? '#E6F1FB' : '#fff';
    btn.style.borderColor = isSelected ? '#185FA5' : '#DDE1EB';
    btn.style.fontWeight = isSelected ? '600' : '';
  });
}

function sbUpdateBatteryOptions(series) {
  const bat1 = document.getElementById('sb-bat1');
  const bat2 = document.getElementById('sb-bat2');
  const charger = document.getElementById('sb-charger');
  const prevBat1 = bat1.value, prevBat2 = bat2.value, prevCharger = charger.value;

  let batOptions = '<option value="">없음</option>';
  let chargerOptions = '<option value="">없음</option>';

  if (series === 'M12') {
    batOptions += '<option value="M12B2">M12 B2 (2.0Ah)</option><option value="M12HB25">M12 HB2.5 (2.5Ah)</option><option value="M12B4">M12 B4 (4.0Ah)</option><option value="M12HB5">M12 HB5 (5.0Ah)</option>';
    chargerOptions += '<option value="C12C">C12C (12V 전용)</option>';
  } else if (series === 'M18') {
    batOptions += '<option value="M18B2">M18 B2 (2.0Ah)</option><option value="M18HB3">M18 HB3 (3.0Ah)</option><option value="M18B5">M18 B5 (5.0Ah)</option><option value="M18FB6">M18 FB6 (FORGE 6Ah)</option><option value="M18FB8">M18 FB8 (FORGE 8Ah)</option><option value="M18FB12">M18 FB12 (FORGE 12Ah)</option>';
    chargerOptions += '<option value="M1218C">M12-18C (멀티)</option><option value="M1218FC">M12-18FC (급속)</option>';
  } else {
    // Show all if no series detected
    batOptions += '<option value="M12B2">M12 B2 (2.0Ah)</option><option value="M12HB25">M12 HB2.5 (2.5Ah)</option><option value="M12B4">M12 B4 (4.0Ah)</option><option value="M12HB5">M12 HB5 (5.0Ah)</option>';
    batOptions += '<option value="M18B2">M18 B2 (2.0Ah)</option><option value="M18HB3">M18 HB3 (3.0Ah)</option><option value="M18B5">M18 B5 (5.0Ah)</option><option value="M18FB6">M18 FB6 (FORGE 6Ah)</option><option value="M18FB8">M18 FB8 (FORGE 8Ah)</option><option value="M18FB12">M18 FB12 (FORGE 12Ah)</option>';
    chargerOptions += '<option value="C12C">C12C (12V 전용)</option><option value="M1218C">M12-18C (멀티)</option><option value="M1218FC">M12-18FC (급속)</option>';
  }

  bat1.innerHTML = batOptions;
  bat2.innerHTML = batOptions;
  charger.innerHTML = chargerOptions;
  // Restore previous values if still valid
  bat1.value = prevBat1; bat2.value = prevBat2; charger.value = prevCharger;
}

function editSetbunItem(idx) {
  const item = setbunItems[idx];
  if (!item) return;
  document.getElementById('setbun-edit-title').textContent = '세트 분해 분석 수정';
  document.getElementById('sb-edit-idx').value = idx;
  document.getElementById('sb-set-code').value = item.setCode || '';
  document.getElementById('sb-bare-code').value = item.bareCode || '';
  document.getElementById('sb-promo').value = item.promo || '';
  document.getElementById('sb-promo-cost').value = item.promoCost || '';

  // Fill set info
  const setP = findProduct(item.setCode);
  if (setP) {
    document.getElementById('sb-set-model-input').value = setP.model || '';
    document.getElementById('sb-set-info').innerHTML = `<span style="font-weight:600">${setP.model}</span> — ${setP.description || ''}<br><span style="color:#1D9E75">원가: ${fmt(setP.cost)}</span> / 공급가: ${fmt(setP.supplyPrice)} / 코드: ${item.setCode}`;
    const series = (setP.model || '').startsWith('M18') ? 'M18' : 'M12';
    sbUpdateBatteryOptions(series);
  } else {
    document.getElementById('sb-set-model-input').value = '';
    sbUpdateBatteryOptions('');
  }

  // Fill bare info
  const bareP = findProduct(item.bareCode);
  var _phEdit = document.getElementById('sb-bare-placeholder');
  if (bareP) {
    document.getElementById('sb-bare-info').innerHTML = `<span style="font-weight:600">${bareP.model}</span> — ${bareP.description || ''}<br><span style="color:#1D9E75">원가: ${fmt(bareP.cost)}</span> / 공급가: ${fmt(bareP.supplyPrice)} / 코드: ${item.bareCode}`;
    if (_phEdit) _phEdit.style.display = 'none';
  } else {
    document.getElementById('sb-bare-info').textContent = '-';
    if (_phEdit) _phEdit.style.display = '';
  }
  document.getElementById('sb-bare-candidates').style.display = 'none';

  document.getElementById('sb-bat1').value = item.bat1 || '';
  document.getElementById('sb-bat2').value = item.bat2 || '';
  document.getElementById('sb-charger').value = item.charger || '';
  document.getElementById('setbun-edit-modal').classList.add('show');
}

function saveSetbunItem() {
  const idx = parseInt(document.getElementById('sb-edit-idx').value);
  const item = {
    setCode: document.getElementById('sb-set-code').value.trim(),
    bareCode: document.getElementById('sb-bare-code').value.trim(),
    bat1: document.getElementById('sb-bat1').value,
    bat2: document.getElementById('sb-bat2').value,
    charger: document.getElementById('sb-charger').value,
    promo: document.getElementById('sb-promo').value.trim(),
    promoCost: parseInt(document.getElementById('sb-promo-cost').value) || 0
  };

  if (!item.setCode) { toast('세트 제품을 선택해주세요'); return; }
  if (!item.bareCode) { toast('베어툴을 선택해주세요'); return; }

  if (idx >= 0) {
    setbunItems[idx] = item;
  } else {
    setbunItems.push(item);
  }
  localStorage.setItem('mw_setbun_items', JSON.stringify(setbunItems)); autoSyncToSupabase('mw_setbun_items');
  closeSetbunModal();
  renderSetbun();
  toast(idx >= 0 ? '분석 수정 완료' : '분석 추가 완료');
}

function deleteSetbunItem(idx) {
  if (!confirm('이 분석 항목을 삭제하시겠습니까?')) return;
  setbunItems.splice(idx, 1);
  localStorage.setItem('mw_setbun_items', JSON.stringify(setbunItems)); autoSyncToSupabase('mw_setbun_items');
  renderSetbun();
  toast('삭제 완료');
}

function calcSetbun(item) {
  const setP = findProduct(item.setCode);
  const bareP = findProduct(item.bareCode);
  const setCost = item.promoCost > 0 ? item.promoCost : (setP ? setP.cost : 0);
  const bareCost = bareP ? bareP.cost : 0;

  const bat1Price = getPartPrice(item.bat1);
  const bat2Price = getPartPrice(item.bat2);
  const chargerPrice = getPartPrice(item.charger);
  const partsTotal = bat1Price + bat2Price + chargerPrice;

  const disassembledCost = setCost - partsTotal;
  const diff = bareCost - disassembledCost;
  const verdict = diff > 0 ? '세트발주' : '베어툴발주';

  return { setP, bareP, setCost, bareCost, bat1Price, bat2Price, chargerPrice, partsTotal, disassembledCost, diff, verdict };
}

function calcSetbunPromo(item) {
  var setP = findProduct(item.setCode);
  var bareP = findProduct(item.bareCode);
  var setEC = getEffectiveCost(item.setCode);
  var bareEC = getEffectiveCost(item.bareCode);
  var setCost = setEC.cost || (setP ? setP.cost : 0);
  var bareCost = bareEC.cost || (bareP ? bareP.cost : 0);
  var bat1Price = getPromoPartPrice(item.bat1);
  var bat2Price = getPromoPartPrice(item.bat2);
  var chargerPrice = getPromoPartPrice(item.charger);
  var partsTotal = bat1Price + bat2Price + chargerPrice;
  var disassembledCost = setCost - partsTotal;
  var diff = bareCost - disassembledCost;
  return { setP:setP, bareP:bareP, setCost:setCost, bareCost:bareCost, bat1Price:bat1Price, bat2Price:bat2Price, chargerPrice:chargerPrice, partsTotal:partsTotal, disassembledCost:disassembledCost, diff:diff, verdict: diff > 0 ? '세트발주' : '베어툴발주' };
}

function renderSetbun() {
  var normalBody = document.getElementById('setbun-body-normal');
  var promoBody = document.getElementById('setbun-body-promo');
  if (!normalBody || !promoBody) return;
  var normalHtml = '', promoHtml = '', verdictChanges = 0;

  setbunItems.forEach(function(item, i) {
    var rn = calcSetbun(item);
    var rp = calcSetbunPromo(item);
    if (rn.verdict !== rp.verdict) verdictChanges++;
    var isSetN = rn.diff > 0, isSetP = rp.diff > 0;

    // 좌측 일반
    normalHtml += '<tr>';
    normalHtml += '<td style="white-space:nowrap;text-align:center"><button class="btn-edit" onclick="editSetbunItem('+i+')">수정</button> <button class="btn-danger btn-sm" onclick="deleteSetbunItem('+i+')" style="padding:2px 6px;font-size:11px">삭제</button></td>';
    normalHtml += '<td class="center">'+item.setCode+'</td>';
    normalHtml += '<td class="center" style="font-weight:500">'+(rn.setP?rn.setP.model:'-')+'</td>';
    normalHtml += '<td class="num" style="color:#1D9E75">'+fmt(rn.setCost)+'</td>';
    normalHtml += '<td class="center">'+item.bareCode+'</td>';
    normalHtml += '<td class="center" style="font-weight:500">'+(rn.bareP?rn.bareP.model:'-')+'</td>';
    normalHtml += '<td class="num" style="color:#1D9E75">'+fmt(rn.bareCost)+'</td>';
    normalHtml += '<td class="num" style="font-weight:600">'+fmt(rn.partsTotal)+'</td>';
    normalHtml += '<td class="num" style="font-weight:600">'+fmt(rn.disassembledCost)+'</td>';
    normalHtml += '<td class="num" style="font-weight:700;color:'+(isSetN?'#1D9E75':'#CC2222')+'">'+(rn.diff>0?'+':'')+fmt(rn.diff)+'</td>';
    normalHtml += '<td style="text-align:center;font-weight:700;'+(isSetN?'background:#E6F9F1;color:#1D9E75':'background:#FCEBEB;color:#CC2222')+'">'+rn.verdict+'</td>';
    normalHtml += '</tr>';

    // 우측 프로모션
    var setCostDiff = rp.setCost - rn.setCost;
    var bareCostDiff = rp.bareCost - rn.bareCost;
    promoHtml += '<tr>';
    promoHtml += '<td class="center">'+item.setCode+'</td>';
    promoHtml += '<td class="center" style="font-weight:500">'+(rp.setP?rp.setP.model:'-')+'</td>';
    promoHtml += '<td class="num"><span style="color:#185FA5;font-weight:600">'+fmt(rp.setCost)+'</span>'+(setCostDiff!==0?'<div style="font-size:10px;color:#CC2222">'+(setCostDiff>0?'+':'')+fmt(setCostDiff)+'</div>':'')+'</td>';
    promoHtml += '<td class="center">'+item.bareCode+'</td>';
    promoHtml += '<td class="center" style="font-weight:500">'+(rp.bareP?rp.bareP.model:'-')+'</td>';
    promoHtml += '<td class="num"><span style="color:#185FA5;font-weight:600">'+fmt(rp.bareCost)+'</span>'+(bareCostDiff!==0?'<div style="font-size:10px;color:#CC2222">'+(bareCostDiff>0?'+':'')+fmt(bareCostDiff)+'</div>':'')+'</td>';
    promoHtml += '<td class="num" style="font-weight:600">'+fmt(rp.partsTotal)+'</td>';
    promoHtml += '<td class="num" style="font-weight:600">'+fmt(rp.disassembledCost)+'</td>';
    promoHtml += '<td class="num" style="font-weight:700;color:'+(isSetP?'#1D9E75':'#CC2222')+'">'+(rp.diff>0?'+':'')+fmt(rp.diff)+'</td>';
    var verdictChanged = rn.verdict !== rp.verdict;
    var vBg = isSetP?'background:#E6F9F1;color:#1D9E75':'background:#FCEBEB;color:#CC2222';
    if (verdictChanged) vBg += ';border:2px solid #EF9F27';
    promoHtml += '<td style="text-align:center;font-weight:700;'+vBg+'">'+rp.verdict+(verdictChanged?' ⚠':'')+'</td>';
    promoHtml += '</tr>';
  });

  if (!setbunItems.length) {
    normalHtml = '<tr><td colspan="11"><div class="empty-state"><p>분석 항목이 없습니다</p><button class="btn-action" onclick="addSetbunItem()">+ 분석 추가</button></div></td></tr>';
    promoHtml = '<tr><td colspan="10"><div class="empty-state"><p>분석 항목이 없습니다</p></div></td></tr>';
  }
  if (setbunItems.length > 0 && verdictChanges > 0) {
    promoHtml += '<tr><td colspan="10" style="background:#FAEEDA;text-align:center;font-weight:600;font-size:11px;color:#633806;padding:6px">⚠ 일반 대비 판정 변경: '+verdictChanges+'건</td></tr>';
  }

  normalBody.innerHTML = normalHtml;
  promoBody.innerHTML = promoHtml;
  document.getElementById('setbun-count').textContent = setbunItems.length + '건';
  initColumnResize('setbun-table-normal');
  initColumnResize('setbun-table-promo');
  initStickyHeader('setbun-table-normal');
  initStickyHeader('setbun-table-promo');
}

// ======================== MODAL DRAG ========================
function makeModalDraggable(modalBgId) {
  const modalBg = document.getElementById(modalBgId);
  if (!modalBg) return;
  const modal = modalBg.querySelector('.modal');
  const header = modalBg.querySelector('.modal-header');
  if (!modal || !header) return;

  header.style.cursor = 'move';
  header.style.userSelect = 'none';

  let isDragging = false, startX, startY, initialX, initialY;

  header.addEventListener('mousedown', function(e) {
    if (e.target.classList.contains('modal-close')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = modal.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    modal.style.position = 'fixed';
    modal.style.margin = '0';
    modal.style.left = initialX + 'px';
    modal.style.top = initialY + 'px';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    modal.style.left = (initialX + dx) + 'px';
    modal.style.top = (initialY + dy) + 'px';
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  });

  const observer = new MutationObserver(function() {
    if (!modalBg.classList.contains('show')) {
      modal.style.position = '';
      modal.style.left = '';
      modal.style.top = '';
      modal.style.margin = '';
    }
  });
  observer.observe(modalBg, { attributes: true, attributeFilter: ['class'] });
}

// ======================== INIT ========================
// 브라우저 자동완성 방지 — 3회 반복 클리어
function clearSearchInputs() {
  document.querySelectorAll('input[type="text"], input[type="search"]').forEach(function(input) {
    if (input.placeholder && (input.placeholder.includes('검색') || input.placeholder.includes('입력'))) {
      input.value = '';
      input.setAttribute('autocomplete', 'nope');
      input.setAttribute('data-form-type', 'other');
      input.setAttribute('data-lpignore', 'true');
    }
  });
}

async function init() {
  var _initStart = performance.now();

  // 1회성 마이그레이션: SDS 드릴비트 대분류 수정
  (function migrateDrillbitCategory() {
    var flag = localStorage.getItem('_migration_drillbit_v1');
    if (flag) return;
    var products = load('mw_products');
    if (!products || !products.length) return;
    var count = 0;
    products.forEach(function(p) {
      if (p.subcategory && (p.subcategory.indexOf('SDS') === 0 || p.subcategory === 'SDS +' || p.subcategory === 'SDS MAX')) {
        if (p.category !== '드릴비트') { p.category = '드릴비트'; count++; }
      }
    });
    if (count > 0) {
      save('mw_products', products);
      DB.products = products;
      console.log('[마이그레이션] SDS 드릴비트 대분류 수정: ' + count + '건');
    }
    localStorage.setItem('_migration_drillbit_v1', '1');
  })();

  // 1회성 마이그레이션: PDF 파싱 오류로 잘못 추가된 항목 삭제
  (function migrateRemoveBadPdfImports() {
    var flag = localStorage.getItem('_migration_remove_bad_pdf_v1');
    if (flag) return;
    var products = load('mw_products');
    if (!products || !products.length) return;
    var badPattern = /\d{1,2}V\s*(FUEL|브러쉬|브러쉬리스|기타)/;
    var before = products.length;
    var cleaned = products.filter(function(p) {
      if (!p.model) return true;
      return !badPattern.test(p.model);
    });
    var removed = before - cleaned.length;
    if (removed > 0) {
      save('mw_products', cleaned);
      DB.products = cleaned;
      console.log('[마이그레이션] PDF 파싱 오류 항목 삭제: ' + removed + '건 (남은: ' + cleaned.length + '건)');
    }
    localStorage.setItem('_migration_remove_bad_pdf_v1', '1');
  })();

  // 1회성 마이그레이션: model + description 통합
  (function migrateMergeModelDesc() {
    if (localStorage.getItem('_migration_merge_model_desc_v1')) return;
    var products = load('mw_products');
    if (!products || !products.length) { localStorage.setItem('_migration_merge_model_desc_v1', '1'); return; }
    var changed = 0;
    products.forEach(function(p) {
      if (p.description && String(p.description).trim()) {
        p.model = (p.model || '') + ' / ' + p.description;
        changed++;
      }
      delete p.description;
    });
    if (changed > 0) {
      save('mw_products', products);
      DB.products = products;
      console.log('[마이그레이션] model+description 통합: ' + changed + '건');
    }
    localStorage.setItem('_migration_merge_model_desc_v1', String(Date.now()));
  })();

  // 마지막 활성 탭 즉시 복원 (딜레이 없이)
  var savedTab = localStorage.getItem('mw_active_tab');
  if (savedTab && savedTab !== 'catalog' && document.getElementById('tab-' + savedTab)) {
    document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById('tab-' + savedTab).classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(function(el) {
      if (el.getAttribute('onclick') && el.getAttribute('onclick').indexOf("'" + savedTab + "'") !== -1) el.classList.add('active');
    });
    // localStorage 캐시 데이터로 즉시 렌더링되므로 tbody 비우기 불필요
  }

  // 브라우저 자동완성 방지 — 즉시 + 100ms + 500ms
  clearSearchInputs();
  setTimeout(clearSearchInputs, 100);
  setTimeout(clearSearchInputs, 500);

  // 0. localStorage 캐시로 즉시 렌더링 (서버 다운로드 기다리지 않음)
  var _t = performance.now();
  populateCatalogFilters();
  renderCatalog();
  _renderedTabs['catalog'] = true;
  if (savedTab && savedTab !== 'catalog') {
    switchTab(savedTab);
  }
  updateStatus();
  console.log('[PERF] init — step0 즉시 렌더링: ' + (performance.now() - _t).toFixed(0) + 'ms');

  // 1. 백그라운드에서 Supabase 다운로드 → 변경분만 업데이트
  updateSyncStatus('동기화 중...');
  _bgSyncFromSupabase(savedTab);

  // 2. 나머지 탭은 지연 렌더링 (유저가 클릭할 때 또는 백그라운드)
  setTimeout(function() {
    var t = performance.now();
    newEstimate();
    updateSyncTimeDisplay();
    console.log('[PERF] init — 지연 초기화: ' + (performance.now() - t).toFixed(0) + 'ms');
  }, 200);
  console.log('[PERF] init 전체: ' + (performance.now() - _initStart).toFixed(0) + 'ms');

  // 3. (init에서 이미 서버 동기화 완료 — Realtime이 이후 변경 감지)

  _t = performance.now();
  initStickyHeader('catalog-table');
  console.log('[PERF] init — step2 initStickyHeader: ' + (performance.now() - _t).toFixed(0) + 'ms');

  // 나머지 탭 초기화는 지연 (첫 방문 시 switchTab에서 렌더링)
  setTimeout(function() {
    var t = performance.now();
    initPromoMonths();
    console.log('[PERF] init — deferred initPromoMonths: ' + (performance.now() - t).toFixed(0) + 'ms');
    t = performance.now();
    loadPartsPricesUI();
    console.log('[PERF] init — deferred loadPartsPricesUI: ' + (performance.now() - t).toFixed(0) + 'ms');
  }, 500);

  // Supabase 업로드 버튼 동적 추가 (설정 탭 > 수수료 섹션 헤더)
  setTimeout(function() {
    var feeHeader = document.querySelector('#settings-sub-fee .section-header');
    if (feeHeader && !document.getElementById('btn-supabase-upload')) {
      var btn = document.createElement('button');
      btn.id = 'btn-supabase-upload';
      btn.textContent = '업로드';
      btn.style.cssText = 'background:#185FA5;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;margin-left:8px';
      btn.onclick = uploadAllToSupabase;
      var headerRight = feeHeader.querySelector('button');
      if (headerRight) headerRight.parentElement.insertBefore(btn, headerRight);
      else feeHeader.appendChild(btn);
    }
  }, 500);

  _t = performance.now();
  makeModalDraggable('settings-modal');
  makeModalDraggable('order-history-modal');
  makeModalDraggable('po-history-modal');
  console.log('[PERF] init — step3 makeModalDraggable x4: ' + (performance.now() - _t).toFixed(0) + 'ms');

  _t = performance.now();
  (function() {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const recent = orderHistory.filter(r => (now - new Date(r.date).getTime()) < weekMs);
    if (recent.length) updateOrderSheetButtons(true);
    const recentPo = poHistory.filter(r => (now - new Date(r.date).getTime()) < weekMs);
    if (recentPo.length) updatePoSheetButtons(true);
  })();
  console.log('[PERF] init — step4 orderSheetButtons: ' + (performance.now() - _t).toFixed(0) + 'ms');

  console.log('[PERF] init 전체: ' + (performance.now() - _initStart).toFixed(0) + 'ms');
}

// ======================== 관리: 수수료 설정 ========================
// ======================== 온라인 판매채널 수수료 (5카드 UI) ========================
var _channelFeesDefault = {
  lastUpdated: new Date().toISOString(),
  channels: {
    naver: { name: '네이버 스토어팜', color: '#1D9E75', vatIncluded: true, fees: [
      { name: '판매수수료', desc: '네이버 카테고리별 판매 수수료', rate: 3, unit: '%', fixed: true },
      { name: '결제수수료', desc: 'Npay 결제 수수료', rate: 3.63, unit: '%', fixed: true }
    ], formula: '정산 = 기준금액 - Npay수수료 - 판매수수료' },
    coupang_mp: { name: '쿠팡 마켓플레이스', color: '#E8344E', vatIncluded: false, vatMultiplier: 1.1,
      categories: [
        { name: '전동공구', desc: '파워툴·배터리·충전기', rate: 7.8, unit: '%', fixed: true },
        { name: '수공구/공구함', desc: '핸드툴·액세서리·팩아웃', rate: 10.8, unit: '%', fixed: true }
      ],
      shipping: { name: '배송비', desc: '판매 배송비에 대한 수수료', rate: 3.0, unit: '%' },
      formula: '수수료 = 판매액 × 율 × 1.1(VAT)' },
    coupang_growth: { name: '쿠팡 로켓그로스', color: '#E8344E', vatIncluded: false, vatMultiplier: 1.1,
      categories: [
        { name: '전동공구', desc: '파워툴·배터리·충전기', rate: 7.8, unit: '%', fixed: true },
        { name: '수공구/공구함', desc: '핸드툴·액세서리·팩아웃', rate: 10.8, unit: '%', fixed: true }
      ],
      logistics: [
        { size: '극소형', cost: 1650, unit: '원', fixed: true },
        { size: '소형', cost: 1950, unit: '원', fixed: true },
        { size: '중형', cost: 2800, unit: '원', fixed: true },
        { size: '대형', cost: 4000, unit: '원', fixed: true }
      ],
      formula: '수수료 = 판매액 × 율, VAT = 수수료 × 10%' },
    gmarket: { name: 'G마켓 / 옥션', color: '#185FA5', vatIncluded: true,
      categories: [
        { name: '전동공구', desc: '파워툴 카테고리', rate: 9, unit: '%', fixed: true },
        { name: '수공구/악세서리', desc: '수공구·팩아웃', rate: 13, unit: '%', fixed: true }
      ],
      shipping: { name: '선결제 배송비', desc: 'G마켓 배송비 수수료', rate: 3.3, unit: '%' },
      ssgLink: { enabled: true, rate: 1, unit: '%' },
      formula: '이용료 = 판매가 × 카테고리율 / SSG연동 시 +1%' },
    ssg: { name: 'SSG 직접입점', color: '#EF9F27', vatIncluded: true,
      categories: [
        { name: '공구류 전체', desc: '전동/수공구 동일 수수료', rate: 13, unit: '%', fixed: true }
      ],
      stores: ['신세계몰', '이마트몰', 'S.COM몰'],
      formula: '정산 = 판매단가 - 수수료 - SSG할인' }
  }
};
var _channelFees = null;
var _feeEditMode = {};

function loadChannelFees() {
  var stored = loadObj('mw_channel_fees', null);
  if (stored && stored.channels) {
    _channelFees = stored;
  } else {
    // 마이그레이션: 기존 flat → 새 구조
    _channelFees = JSON.parse(JSON.stringify(_channelFeesDefault));
    var s = DB.settings;
    var ch = _channelFees.channels;
    if (s.naverSaleRate !== undefined) ch.naver.fees[0].rate = s.naverSaleRate;
    if (s.naverPayRate !== undefined) ch.naver.fees[1].rate = s.naverPayRate;
    if (s.coupangMpFee !== undefined) {
      ch.coupang_mp.categories[0].rate = s.coupangMpFee < 1 ? s.coupangMpFee * 100 : (s.coupangMpFee === 10.8 ? 7.8 : s.coupangMpFee);
      ch.coupang_mp.categories[1].rate = s.coupangMpFee < 1 ? s.coupangMpFee * 100 : s.coupangMpFee;
    }
    if (s.coupangRgFee !== undefined) {
      ch.coupang_growth.categories[0].rate = s.coupangRgFee < 1 ? s.coupangRgFee * 100 : (s.coupangRgFee === 10.8 ? 7.8 : s.coupangRgFee);
      ch.coupang_growth.categories[1].rate = s.coupangRgFee < 1 ? s.coupangRgFee * 100 : s.coupangRgFee;
    }
    if (s.coupangLogi !== undefined) ch.coupang_growth.logistics[2].cost = s.coupangLogi;
    // G마켓/옥션, SSG: 기존 flat 구조에 해당 데이터가 없으므로 기본값 유지
    // openElecFee/openHandFee는 밀워키 단가표 전용이며, G마켓 수수료와 별개
    _channelFees.lastUpdated = new Date().toISOString();
    saveChannelFeesRaw();
  }
  return _channelFees;
}

function saveChannelFeesRaw() {
  localStorage.setItem('mw_channel_fees', JSON.stringify(_channelFees));
  autoSyncToSupabase('mw_channel_fees');
}

// 호환 레이어: 새 구조 → DB.settings 플랫 키 동기화
function syncChannelFeesToSettings() {
  var ch = _channelFees.channels;
  var naverSale = ch.naver.fees[0] ? ch.naver.fees[0].rate : 3;
  var naverPay = ch.naver.fees[1] ? ch.naver.fees[1].rate : 3.63;
  DB.settings.naverSaleRate = naverSale;
  DB.settings.naverPayRate = naverPay;
  DB.settings.naverFee = (naverSale + naverPay) / 100;
  // 쿠팡: 기존은 단일값, 새 구조는 카테고리별 → 수공구(높은 값) 기준
  var mpCats = ch.coupang_mp.categories || [];
  DB.settings.coupangMpFee = mpCats.length > 1 ? mpCats[1].rate : (mpCats[0] ? mpCats[0].rate : 10.8);
  var rgCats = ch.coupang_growth.categories || [];
  DB.settings.coupangRgFee = rgCats.length > 1 ? rgCats[1].rate : (rgCats[0] ? rgCats[0].rate : 10.8);
  var logi = ch.coupang_growth.logistics || [];
  DB.settings.coupangLogi = logi.length > 2 ? logi[2].cost : (logi.length > 0 ? logi[logi.length - 1].cost : 2800);
  // 오픈마켓: openElecFee/openHandFee는 밀워키 단가표 전용 종합수수료.
  // G마켓 카테고리 수수료(9%/13%)와 다르므로 기존 값을 보존한다.
  // 기존 설정이 없을 때만 기본값 적용.
  if (DB.settings.openElecFee === undefined) DB.settings.openElecFee = 0.13;
  if (DB.settings.openHandFee === undefined) DB.settings.openHandFee = 0.176;
  // SSG flat 키 동기화
  var ssgCats = ch.ssg.categories || [];
  // SSG: 현재 전동/수공구 동일 13%이지만 향후 분리 가능
  DB.settings.ssgElecFee = ssgCats[0] ? ssgCats[0].rate / 100 : 0.13;
  DB.settings.ssgHandFee = ssgCats.length > 1 ? ssgCats[1].rate / 100 : (ssgCats[0] ? ssgCats[0].rate / 100 : 0.13);
  DB.settings.feeVatMode = 'incl';
  save(KEYS.settings, DB.settings);
}

// ======================== 수수료 읽기 헬퍼 ========================
// 새 channels 구조에서 채널+카테고리별 수수료율(%)을 리턴
// channel: 'naver','coupang_mp','coupang_growth','gmarket','ssg'
// category: 'powertool'(전동공구), 'handtool'(수공구/악세서리/팩아웃), 또는 카테고리 한글명
// 리턴: 소수(0.xx) — 기존 DB.settings 형식과 동일
function getChannelFeeRate(channel, category) {
  if (!_channelFees) loadChannelFees();
  var ch = _channelFees.channels;
  var data = ch[channel];
  if (!data) return 0;

  // 네이버: 전체 fees 합산
  if (channel === 'naver') {
    var sum = 0;
    (data.fees || []).forEach(function(f) { if (f.unit === '%') sum += (f.rate || 0); });
    return sum / 100;
  }

  // 카테고리 매칭 함수
  var isElec = !category || category === 'powertool' || category === '파워툴' || category === '전동공구';
  var cats = data.categories || [];

  // 쿠팡 마켓플레이스
  if (channel === 'coupang_mp') {
    var rate = isElec ? (cats[0] ? cats[0].rate : 7.8) : (cats[1] ? cats[1].rate : 10.8);
    return rate / 100;
  }

  // 쿠팡 로켓그로스
  if (channel === 'coupang_growth') {
    var rate = isElec ? (cats[0] ? cats[0].rate : 7.8) : (cats[1] ? cats[1].rate : 10.8);
    return rate / 100;
  }

  // G마켓/옥션
  if (channel === 'gmarket') {
    var rate = isElec ? (cats[0] ? cats[0].rate : 9) : (cats[1] ? cats[1].rate : 13);
    return rate / 100;
  }

  // SSG: 카테고리별 분기 (현재 동일 13%이지만 향후 변경 가능)
  if (channel === 'ssg') {
    if (isElec) return DB.settings.ssgElecFee || 0.13;
    return DB.settings.ssgHandFee || 0.13;
  }

  return 0;
}

// 쿠팡 로켓그로스 물류비(원) 조회
// size: '극소형','소형','중형','대형' 또는 인덱스
function getCoupangLogistics(size) {
  if (!_channelFees) loadChannelFees();
  var logi = _channelFees.channels.coupang_growth.logistics || [];
  if (typeof size === 'number') return logi[size] ? logi[size].cost : 2800;
  for (var i = 0; i < logi.length; i++) {
    if (logi[i].size === size) return logi[i].cost;
  }
  return 2800; // 기본 중형
}

// SSG 판매가 역산 (네이버/G마켓과 동일한 VAT포함 방식)
// cost: 원가, category: '파워툴' 등, mkSsg: 마크업%(기본 0.5)
// 공식: price = cost / (10/11 - ssgFee - mkSsg/100), 백원 올림
function calcSsgPrice(cost, category, mkSsg) {
  var isElec = (category === '파워툴');
  var ssgFee = isElec ? (DB.settings.ssgElecFee || 0.13) : (DB.settings.ssgHandFee || 0.13);
  var mkDefault = isElec ? (DB.settings.mkSsgElec || 0.5) : (DB.settings.mkSsgHand || 0.5);
  var markup = (mkSsg !== undefined ? mkSsg : mkDefault) / 100;
  var denom = 10/11 - ssgFee - markup;
  if (denom <= 0) return 0;
  return Math.ceil(cost / denom / 100) * 100;
}

function loadFeeSettings() {
  loadChannelFees();
  renderChannelFees();
}

// ======================== 5카드 렌더링 ========================
function renderChannelFees() {
  var container = document.getElementById('channel-fees-container');
  if (!container) return;
  var ch = _channelFees.channels;
  var keys = ['naver', 'coupang_mp', 'coupang_growth', 'gmarket', 'ssg'];
  var html = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">';
  keys.forEach(function(key) {
    html += buildFeeCard(key, ch[key]);
  });
  html += '</div>';
  container.innerHTML = html;
  // 타임스탬프
  var tsEl = document.getElementById('channel-fees-timestamp');
  if (tsEl && _channelFees.lastUpdated) {
    var d = new Date(_channelFees.lastUpdated);
    tsEl.textContent = '마지막 수정: ' + d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
}

function buildFeeCard(key, data) {
  var isEdit = _feeEditMode[key] || false;
  var disAttr = isEdit ? '' : ' disabled';
  var inpBg = isEdit ? 'background:#fff;border:1px solid #DDE1EB' : 'background:#F4F6FA;border:1px solid #EAECF2';
  var vatTag = '';
  if (data.vatIncluded === false) vatTag = '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#FCEBEB;color:#791F1F;font-weight:500;white-space:nowrap">VAT별도</span>';
  else vatTag = '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#E1F5EE;color:#085041;font-weight:500;white-space:nowrap">VAT포함</span>';

  // 네이버 합계
  var totalHtml = '';
  if (key === 'naver') {
    var sum = 0;
    (data.fees || []).forEach(function(f) { if (f.unit === '%') sum += (f.rate || 0); });
    totalHtml = '<span style="font-size:13px;font-weight:700;color:#185FA5;white-space:nowrap">합계 ' + sum.toFixed(2) + '%</span>';
  }

  var btnStyle = isEdit
    ? 'background:#185FA5;color:#fff;border:1px solid #185FA5;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif;white-space:nowrap'
    : 'background:#fff;color:#5A6070;border:1px solid #DDE1EB;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:500;cursor:pointer;font-family:Pretendard,sans-serif;white-space:nowrap';
  var btnText = isEdit ? '저장' : '수정';

  var h = '<div style="background:#fff;border:1px solid #DDE1EB;border-radius:8px;overflow:hidden">';
  // 헤더
  h += '<div style="padding:8px 14px;display:flex;align-items:center;gap:6px">';
  h += '<span style="width:8px;height:8px;border-radius:50%;background:' + data.color + ';display:inline-block;flex-shrink:0"></span>';
  h += '<span style="font-size:13px;font-weight:600;color:#1A1D23;white-space:nowrap">' + data.name + '</span>';
  h += vatTag;
  h += '<span style="flex:1"></span>';
  if (totalHtml) h += totalHtml + ' ';
  h += '<button onclick="toggleFeeEdit(\'' + key + '\')" style="' + btnStyle + '">' + btnText + '</button>';
  h += '</div>';

  // 바디
  h += '<div style="padding:6px 14px 12px">';

  // 네이버: fees
  if (key === 'naver') {
    h += feeSection('수수료 항목', data.fees, key, 'fees', inpBg, disAttr, isEdit, '%');
  }

  // 쿠팡 마켓: categories + shipping
  if (key === 'coupang_mp') {
    h += feeSection('판매수수료 (카테고리별)', data.categories, key, 'categories', inpBg, disAttr, isEdit, '%');
    h += feeSingleRow('배송비 수수료', data.shipping, key, 'shipping', inpBg, disAttr);
  }

  // 쿠팡 로켓: categories + logistics
  if (key === 'coupang_growth') {
    h += feeSection('판매수수료', data.categories, key, 'categories', inpBg, disAttr, isEdit, '%');
    h += feeLogisticsSection('물류비 (사이즈별)', data.logistics, key, inpBg, disAttr, isEdit);
  }

  // G마켓: categories + shipping + ssgLink
  if (key === 'gmarket') {
    h += feeSection('카테고리별 서비스이용료', data.categories, key, 'categories', inpBg, disAttr, isEdit, '%');
    h += '<div style="margin-top:8px">';
    h += '<div style="font-size:10px;font-weight:600;color:#9BA3B2;padding-bottom:4px;border-bottom:1px solid #F4F6FA;margin-bottom:4px">배송비·연동</div>';
    h += feeSingleRow(null, data.shipping, key, 'shipping', inpBg, disAttr);
    // SSG 제휴연동 토글
    var ssg = data.ssgLink || { enabled: true, rate: 1 };
    h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0">';
    h += '<span style="min-width:100px;font-size:12px;font-weight:500;color:#1A1D23">SSG 제휴연동</span>';
    h += '<span style="flex:1;font-size:11px;color:#9BA3B2">ON 시 추가 수수료 부과</span>';
    h += '<label style="position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0">';
    h += '<input type="checkbox" ' + (ssg.enabled ? 'checked' : '') + disAttr + ' onchange="toggleSsgLink(this.checked)" style="opacity:0;width:0;height:0">';
    h += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (ssg.enabled ? '#185FA5' : '#DDE1EB') + ';border-radius:10px;transition:0.2s"></span>';
    h += '<span style="position:absolute;left:' + (ssg.enabled ? '18px' : '2px') + ';top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>';
    h += '</label>';
    h += '<input type="text" value="' + ssg.rate + '" data-fee-key="gmarket" data-fee-field="ssgLink.rate" style="width:70px;height:28px;text-align:right;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-radius:4px;padding:0 8px;' + inpBg + '"' + disAttr + '>';
    h += '<span style="font-size:12px;color:#5A6070;flex-shrink:0">%</span>';
    h += '</div></div>';
  }

  // SSG: categories + stores
  if (key === 'ssg') {
    h += feeSection('판매수수료', data.categories, key, 'categories', inpBg, disAttr, isEdit, '%');
    h += '<div style="margin-top:8px">';
    h += '<div style="font-size:10px;font-weight:600;color:#9BA3B2;padding-bottom:4px;border-bottom:1px solid #F4F6FA;margin-bottom:6px">노출 점포</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    (data.stores || []).forEach(function(s) {
      h += '<span style="font-size:11px;padding:3px 10px;border-radius:12px;background:#FEF3C7;color:#92400E;font-weight:500">' + s + '</span>';
    });
    h += '</div></div>';
  }

  // 공식 박스
  if (data.formula) {
    h += '<div style="margin-top:8px;background:#F4F6FA;border-radius:4px;padding:6px 10px;font-size:10px;color:#5A6070">' + data.formula + '</div>';
  }

  h += '</div></div>';
  return h;
}

function feeSection(label, items, chKey, section, inpBg, disAttr, isEdit, unitLabel) {
  var h = '<div style="margin-bottom:4px">';
  h += '<div style="font-size:10px;font-weight:600;color:#9BA3B2;padding-bottom:4px;border-bottom:1px solid #F4F6FA;margin-bottom:2px">' + label + '</div>';
  (items || []).forEach(function(item, idx) {
    h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F4F6FA">';
    if (isEdit && !item.fixed) {
      h += '<input type="text" value="' + item.name + '" data-fee-key="' + chKey + '" data-fee-section="' + section + '" data-fee-idx="' + idx + '" data-fee-field-name="name" placeholder="명칭" style="min-width:80px;max-width:100px;height:28px;font-size:12px;font-weight:500;font-family:Pretendard,sans-serif;border-radius:4px;padding:0 6px;' + inpBg + '">';
      h += '<input type="text" value="' + (item.desc || '') + '" data-fee-key="' + chKey + '" data-fee-section="' + section + '" data-fee-idx="' + idx + '" data-fee-field-name="desc" placeholder="설명" style="flex:1;min-width:60px;height:28px;font-size:11px;color:#9BA3B2;font-family:Pretendard,sans-serif;border-radius:4px;padding:0 6px;' + inpBg + '">';
    } else {
      h += '<span style="min-width:100px;font-size:12px;font-weight:500;color:#1A1D23;white-space:nowrap">' + item.name + '</span>';
      h += '<span style="flex:1;font-size:11px;color:#9BA3B2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (item.desc || '') + '</span>';
    }
    h += '<input type="text" value="' + item.rate + '" data-fee-key="' + chKey + '" data-fee-section="' + section + '" data-fee-idx="' + idx + '" style="width:70px;height:28px;text-align:right;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-radius:4px;padding:0 8px;' + inpBg + '"' + disAttr + '>';
    h += '<span style="font-size:12px;color:#5A6070;flex-shrink:0">' + unitLabel + '</span>';
    if (isEdit && !item.fixed) {
      h += '<button onclick="removeFeeItem(\'' + chKey + '\',\'' + section + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;color:#CC2222;font-size:14px;padding:0 2px" title="삭제">✕</button>';
    }
    h += '</div>';
  });
  if (isEdit) {
    h += '<button onclick="addFeeItem(\'' + chKey + '\',\'' + section + '\')" style="background:none;border:none;color:#185FA5;font-size:11px;font-weight:600;cursor:pointer;padding:4px 0;font-family:Pretendard,sans-serif">+ 항목 추가</button>';
  }
  h += '</div>';
  return h;
}

function feeSingleRow(label, item, chKey, field, inpBg, disAttr) {
  if (!item) return '';
  var h = '';
  if (label) h += '<div style="margin-top:8px"><div style="font-size:10px;font-weight:600;color:#9BA3B2;padding-bottom:4px;border-bottom:1px solid #F4F6FA;margin-bottom:4px">' + label + '</div>';
  h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F4F6FA">';
  h += '<span style="min-width:100px;font-size:12px;font-weight:500;color:#1A1D23;white-space:nowrap">' + item.name + '</span>';
  h += '<span style="flex:1;font-size:11px;color:#9BA3B2">' + (item.desc || '') + '</span>';
  h += '<input type="text" value="' + item.rate + '" data-fee-key="' + chKey + '" data-fee-field="' + field + '.rate" style="width:70px;height:28px;text-align:right;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-radius:4px;padding:0 8px;' + inpBg + '"' + disAttr + '>';
  h += '<span style="font-size:12px;color:#5A6070;flex-shrink:0">' + (item.unit || '%') + '</span>';
  h += '</div>';
  if (label) h += '</div>';
  return h;
}

function feeLogisticsSection(label, items, chKey, inpBg, disAttr, isEdit) {
  var h = '<div style="margin-top:8px">';
  h += '<div style="font-size:10px;font-weight:600;color:#9BA3B2;padding-bottom:4px;border-bottom:1px solid #F4F6FA;margin-bottom:2px">' + label + '</div>';
  (items || []).forEach(function(item, idx) {
    h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F4F6FA">';
    if (isEdit && !item.fixed) {
      h += '<input type="text" value="' + item.size + '" data-fee-key="' + chKey + '" data-fee-section="logistics" data-fee-idx="' + idx + '" data-fee-field-name="size" placeholder="사이즈명" style="min-width:80px;max-width:100px;height:28px;font-size:12px;font-weight:500;font-family:Pretendard,sans-serif;border-radius:4px;padding:0 6px;' + inpBg + '">';
    } else {
      h += '<span style="min-width:100px;font-size:12px;font-weight:500;color:#1A1D23;white-space:nowrap">' + item.size + '</span>';
    }
    h += '<span style="flex:1;font-size:11px;color:#9BA3B2"></span>';
    h += '<input type="text" value="' + item.cost.toLocaleString() + '" data-fee-key="' + chKey + '" data-fee-section="logistics" data-fee-idx="' + idx + '" data-fee-type="cost" style="width:70px;height:28px;text-align:right;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-radius:4px;padding:0 8px;' + inpBg + '"' + disAttr + '>';
    h += '<span style="font-size:12px;color:#5A6070;flex-shrink:0">원</span>';
    if (isEdit && !item.fixed) {
      h += '<button onclick="removeFeeItem(\'' + chKey + '\',\'logistics\',' + idx + ')" style="background:none;border:none;cursor:pointer;color:#CC2222;font-size:14px;padding:0 2px" title="삭제">✕</button>';
    }
    h += '</div>';
  });
  if (isEdit) {
    h += '<button onclick="addFeeLogistics(\'' + chKey + '\')" style="background:none;border:none;color:#185FA5;font-size:11px;font-weight:600;cursor:pointer;padding:4px 0;font-family:Pretendard,sans-serif">+ 사이즈 추가</button>';
  }
  h += '</div>';
  return h;
}

// ======================== 수정/저장 토글 ========================
function toggleFeeEdit(key) {
  if (_feeEditMode[key]) {
    // 저장 모드: input 값 수집 → 저장
    collectFeeInputs(key);
    _channelFees.lastUpdated = new Date().toISOString();
    saveChannelFeesRaw();
    syncChannelFeesToSettings();
    _feeEditMode[key] = false;
    renderChannelFees();
    toast('저장되었습니다');
  } else {
    _feeEditMode[key] = true;
    renderChannelFees();
  }
}

function collectFeeInputs(key) {
  var inputs = document.querySelectorAll('input[data-fee-key="' + key + '"]');
  inputs.forEach(function(inp) {
    var section = inp.getAttribute('data-fee-section');
    var idx = parseInt(inp.getAttribute('data-fee-idx'));
    var field = inp.getAttribute('data-fee-field');
    var feeType = inp.getAttribute('data-fee-type');
    var fieldName = inp.getAttribute('data-fee-field-name');
    var ch = _channelFees.channels[key];
    // name/desc 필드 (추가된 항목)
    if (fieldName && section && !isNaN(idx)) {
      var arr = ch[section];
      if (arr && arr[idx]) arr[idx][fieldName] = inp.value;
      return;
    }
    var rawVal = inp.value.replace(/,/g, '');
    var val = parseFloat(rawVal) || 0;
    if (section && !isNaN(idx)) {
      var arr = ch[section];
      if (arr && arr[idx]) {
        if (feeType === 'cost') arr[idx].cost = val;
        else arr[idx].rate = val;
      }
    } else if (field) {
      var parts = field.split('.');
      if (parts.length === 2) {
        if (ch[parts[0]]) ch[parts[0]][parts[1]] = val;
      }
    }
  });
  // 체크박스 (SSG토글 등)
  var checks = document.querySelectorAll('input[type="checkbox"][data-fee-key="' + key + '"]');
  checks.forEach(function(chk) {
    var field = chk.getAttribute('data-fee-field');
    if (field) {
      var parts = field.split('.');
      var ch2 = _channelFees.channels[key];
      if (parts.length === 2 && ch2[parts[0]]) ch2[parts[0]][parts[1]] = chk.checked;
    }
  });
}

function toggleSsgLink(checked) {
  if (!_channelFees.channels.gmarket.ssgLink) {
    _channelFees.channels.gmarket.ssgLink = { enabled: true, rate: 1, unit: '%' };
  }
  _channelFees.channels.gmarket.ssgLink.enabled = checked;
  renderChannelFees();
}

// ======================== 항목 추가/삭제 ========================
function addFeeItem(chKey, section) {
  var ch = _channelFees.channels[chKey];
  if (!ch[section]) ch[section] = [];
  // 먼저 현재 입력값 수집
  collectFeeInputs(chKey);
  if (section === 'fees') {
    ch[section].push({ name: '', desc: '', rate: 0, unit: '%', fixed: false });
  } else {
    ch[section].push({ name: '', desc: '', rate: 0, unit: '%', fixed: false });
  }
  if (!_feeEditMode[chKey]) _feeEditMode[chKey] = true;
  renderChannelFees();
}

function addFeeLogistics(chKey) {
  var ch = _channelFees.channels[chKey];
  if (!ch.logistics) ch.logistics = [];
  collectFeeInputs(chKey);
  ch.logistics.push({ size: '', cost: 0, unit: '원', fixed: false });
  if (!_feeEditMode[chKey]) _feeEditMode[chKey] = true;
  renderChannelFees();
}

function removeFeeItem(chKey, section, idx) {
  var ch = _channelFees.channels[chKey];
  if (ch[section] && ch[section][idx] && !ch[section][idx].fixed) {
    collectFeeInputs(chKey);
    ch[section].splice(idx, 1);
    renderChannelFees();
  }
}

// 새 행에 name 편집 가능하게 하기 위한 이벤트 위임 (추가된 항목)
// → buildFeeCard에서 fixed=false인 항목은 name이 input으로 표시됨
// 기존 saveFeeSettings 호환 래퍼
function saveFeeSettings() {
  // 모든 카드 저장
  ['naver','coupang_mp','coupang_growth','gmarket','ssg'].forEach(function(k) {
    collectFeeInputs(k);
    _feeEditMode[k] = false;
  });
  _channelFees.lastUpdated = new Date().toISOString();
  saveChannelFeesRaw();
  syncChannelFeesToSettings();
  renderChannelFees();
  toast('수수료 설정 저장 완료');
}

// 기존 updateNaverTotal/applyCoupangPreset은 더 이상 HTML에서 호출되지 않지만 안전을 위해 빈 함수 유지
function updateNaverTotal() {}
function applyCoupangPreset() {}

// ======================== 설정 서브탭: 거래처 등록 ========================
var _clientStart = performance.now();
var clientData = loadObj('mw_clients', []);
console.log('[PERF] clientData 파싱: ' + (performance.now() - _clientStart).toFixed(0) + 'ms (clients:' + clientData.length + ')');
console.log('[PERF] 스크립트 전체 파싱+실행: ' + (performance.now() - _scriptStart).toFixed(0) + 'ms');

function switchSettingsMain(type) {
  document.getElementById('settings-sub-fee').style.display = type === 'fee' ? '' : 'none';
  document.getElementById('settings-sub-client').style.display = type === 'client' ? '' : 'none';
  document.getElementById('settings-sub-history').style.display = type === 'history' ? '' : 'none';
  document.getElementById('settings-sub-users').style.display = type === 'users' ? '' : 'none';
  document.getElementById('settings-sub-api').style.display = type === 'api' ? '' : 'none';
  var tabs = document.querySelectorAll('#settings-main-tabs .sub-tab');
  tabs[0].classList.toggle('active', type === 'fee');
  tabs[1].classList.toggle('active', type === 'client');
  tabs[2].classList.toggle('active', type === 'history');
  tabs[3].classList.toggle('active', type === 'users');
  tabs[4].classList.toggle('active', type === 'api');
  if (type === 'client') renderClients();
  if (type === 'history') renderActionHistory();
  if (type === 'users') renderUsers();
  if (type === 'api') renderApiManagement();
}

// ======================== 설정 서브탭: API 관리 ========================
var _apiPlatformMeta = {
  erp:     { logo: '경', logoBg: '#1A1D23', keys: ['ERP_USER_KEY', 'ERP_URL'], note: '' },
  naver:   { logo: 'N',  logoBg: '#03C75A', keys: ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET'], note: '' },
  coupang: { logo: 'C',  logoBg: '#E3002B', keys: ['COUPANG_ACCESS_KEY', 'COUPANG_SECRET_KEY'], note: '' },
  ssg:     { logo: 'S',  logoBg: '#FF5A2E', keys: ['SSG_API_KEY'], note: '※ 운영서버 IP 등록 필요' },
  gmarket: { logo: 'G',  logoBg: '#43B02A', keys: ['GMARKET_API_KEY'], note: '고객센터 문의 완료 · 답변 대기 중' },
  kakao:   { logo: 'AI', logoBg: '#D97706', keys: ['KAKAO_REST_API_KEY'], note: '카카오톡 자동응답 (NAS Docker) 연동용' }
};

// API 키 → Supabase 필드 매핑 (label → keys 객체 경로)
var _apiKeyFieldMap = {
  'ERP_USER_KEY': { platform: 'erp', field: 'userKey' },
  'ERP_URL': { platform: 'erp', field: 'url' },
  'NAVER_CLIENT_ID': { platform: 'naver', field: 'clientId' },
  'NAVER_CLIENT_SECRET': { platform: 'naver', field: 'clientSecret' },
  'COUPANG_ACCESS_KEY': { platform: 'coupang', field: 'accessKey' },
  'COUPANG_SECRET_KEY': { platform: 'coupang', field: 'secretKey' },
  'SSG_API_KEY': { platform: 'ssg', field: 'apiKey' },
  'GMARKET_API_KEY': { platform: 'gmarket', field: 'apiKey' },
  'KAKAO_REST_API_KEY': { platform: 'kakao', field: 'apiKey' }
};

// 편집 모드 raw 데이터 캐시
var _apiRawKeys = null;

function renderApiManagement() {
  var container = document.getElementById('api-management-container');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:#9BA3B2;font-size:13px">API 상태 조회 중...</div>';
  fetch('/api/settings/api-status')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var html = '';
      (data.platforms || []).forEach(function(p) {
        var meta = _apiPlatformMeta[p.id] || { logo: '?', logoBg: '#999', keys: [], note: '' };
        var badgeClass = p.status === 'connected' ? 'blue' : p.status === 'error' ? 'red' : 'yellow';
        var badgeText = p.status === 'connected' ? '● 키 등록됨' : p.status === 'error' ? '● 오류' : '● 미등록';
        // 서버에서 마스킹된 키 값 사용
        var serverKeys = {};
        (p.keys || []).forEach(function(k) { serverKeys[k.label] = k.value || ''; });
        var keysHtml = meta.keys.map(function(k) {
          var val = serverKeys[k] || '';
          return '<div class="api-field"><div class="api-field-label">' + k + '</div>' +
            '<div class="api-field-value' + (val ? '' : ' empty') + '" id="api-val-' + p.id + '-' + k + '">' + (val || '미등록') + '</div></div>';
        }).join('');
        var noteHtml = meta.note ? '<div class="api-note">' + meta.note + '</div>' : '';
        html += '<div class="api-card" id="api-card-' + p.id + '">' +
          '<div class="api-card-header">' +
            '<div class="api-card-logo" style="background:' + meta.logoBg + ';">' + meta.logo + '</div>' +
            '<span class="api-card-name">' + p.name + '</span>' +
            '<span class="api-badge api-badge-' + badgeClass + '">' + badgeText + '</span>' +
          '</div>' +
          '<div class="api-card-body" id="api-body-' + p.id + '">' + keysHtml + noteHtml + '</div>' +
          '<div class="api-card-footer">' +
            '<button class="api-btn" style="background:#F4F6FA;color:#5A6070" onclick="editApiKeys(\'' + p.id + '\')">수정</button>' +
            '<button class="api-btn api-btn-test" id="api-test-btn-' + p.id + '" onclick="testApiConnection(\'' + p.id + '\')">연결 테스트</button>' +
          '</div>' +
        '</div>';
      });
      container.innerHTML = html;
    })
    .catch(function(err) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#791F1F;font-size:13px">API 상태 조회 실패: ' + err.message + '</div>';
    });
}

// 수정 모드 진입
function editApiKeys(platformId) {
  var card = document.getElementById('api-card-' + platformId);
  if (!card) return;
  var meta = _apiPlatformMeta[platformId] || { keys: [] };
  var body = document.getElementById('api-body-' + platformId);
  if (!body) return;

  // raw 키 로드 (최초 1회만)
  var loadRaw = _apiRawKeys ? Promise.resolve(_apiRawKeys) : fetch('/api/settings/api-status?raw=true')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      // 플랫폼별 raw 값 캐시
      var raw = {};
      (data.platforms || []).forEach(function(p) {
        raw[p.id] = {};
        (p.keys || []).forEach(function(k) { raw[p.id][k.label] = k.value || ''; });
      });
      _apiRawKeys = raw;
      return raw;
    });

  loadRaw.then(function(raw) {
    var platformRaw = raw[platformId] || {};
    var fieldsHtml = meta.keys.map(function(k) {
      var val = platformRaw[k] || '';
      return '<div class="api-field"><div class="api-field-label">' + k + '</div>' +
        '<input type="text" class="api-field-input" id="api-input-' + platformId + '-' + k + '" value="' + val.replace(/"/g, '&quot;') + '" ' +
        'style="width:100%;font-size:12px;padding:6px 10px;border:1px solid #185FA5;border-radius:4px;font-family:Pretendard,sans-serif;background:#FAFBFF;outline:none;box-sizing:border-box" ' +
        'placeholder="' + k + ' 입력"></div>';
    }).join('');
    body.innerHTML = fieldsHtml;

    // 푸터 버튼 교체: 저장 + 취소
    var footer = card.querySelector('.api-card-footer');
    if (footer) {
      footer.innerHTML =
        '<button class="api-btn" style="background:#F4F6FA;color:#5A6070" onclick="_apiRawKeys=null;renderApiManagement()">취소</button>' +
        '<button class="api-btn" style="background:#185FA5;color:#fff" onclick="saveApiKeysFromUI(\'' + platformId + '\')">저장</button>';
    }
  });
}

// UI에서 전체 키 수집 → PUT 저장
function saveApiKeysFromUI(platformId) {
  // 현재 편집 중인 input에서 값 수집
  var meta = _apiPlatformMeta[platformId] || { keys: [] };
  var updates = {};
  meta.keys.forEach(function(k) {
    var inp = document.getElementById('api-input-' + platformId + '-' + k);
    updates[k] = inp ? inp.value.trim() : '';
  });

  // raw 캐시에 반영
  if (_apiRawKeys && _apiRawKeys[platformId]) {
    Object.keys(updates).forEach(function(k) { _apiRawKeys[platformId][k] = updates[k]; });
  }

  // 전체 keys 객체 구성 (Supabase에 저장할 형태)
  var keysObj = { erp: { userKey: '', url: '' }, naver: { clientId: '', clientSecret: '' }, coupang: { accessKey: '', secretKey: '' }, ssg: { apiKey: '' }, gmarket: { apiKey: '' }, kakao: { apiKey: '' } };

  // 캐시에서 전체 값 채우기
  if (_apiRawKeys) {
    Object.keys(_apiKeyFieldMap).forEach(function(label) {
      var m = _apiKeyFieldMap[label];
      var platformRaw = _apiRawKeys[m.platform] || {};
      keysObj[m.platform][m.field] = platformRaw[label] || '';
    });
  }

  // 현재 편집 값 덮어쓰기
  Object.keys(updates).forEach(function(label) {
    var m = _apiKeyFieldMap[label];
    if (m) keysObj[m.platform][m.field] = updates[label];
  });

  // PUT 호출
  var card = document.getElementById('api-card-' + platformId);
  var footer = card ? card.querySelector('.api-card-footer') : null;
  if (footer) {
    var saveBtn = footer.querySelectorAll('button')[1];
    if (saveBtn) { saveBtn.textContent = '저장 중...'; saveBtn.disabled = true; }
  }

  fetch('/api/settings/api-status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys: keysObj })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        toast('API 키 저장 완료');
        _apiRawKeys = null; // 캐시 초기화
        renderApiManagement(); // 마스킹 모드로 복귀
      } else {
        alert('저장 실패: ' + (data.message || '알 수 없는 오류'));
        if (footer) {
          var saveBtn2 = footer.querySelectorAll('button')[1];
          if (saveBtn2) { saveBtn2.textContent = '저장'; saveBtn2.disabled = false; }
        }
      }
    })
    .catch(function(err) {
      alert('저장 실패: ' + err.message);
      if (footer) {
        var saveBtn3 = footer.querySelectorAll('button')[1];
        if (saveBtn3) { saveBtn3.textContent = '저장'; saveBtn3.disabled = false; }
      }
    });
}

function testApiConnection(platformId) {
  var btn = document.getElementById('api-test-btn-' + platformId);
  if (!btn) return;
  var origText = btn.textContent;
  btn.textContent = '테스트 중...';
  btn.disabled = true;
  btn.classList.remove('success', 'fail');
  fetch('/api/settings/api-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platformId: platformId })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        btn.textContent = '✓ ' + data.message;
        btn.classList.add('success');
        // 배지를 "연결 확인됨" (초록)으로 업데이트
        var card = btn.closest('.api-card');
        if (card) {
          var badge = card.querySelector('.api-badge');
          if (badge) {
            badge.className = 'api-badge api-badge-green';
            badge.textContent = '● 연결 확인됨';
          }
        }
      } else {
        btn.textContent = '✕ ' + data.message;
        btn.classList.add('fail');
      }
      setTimeout(function() {
        btn.textContent = origText;
        btn.disabled = false;
        btn.classList.remove('success', 'fail');
      }, 3000);
    })
    .catch(function(err) {
      btn.textContent = '✕ 오류';
      btn.classList.add('fail');
      alert('연결 테스트 오류: ' + err.message);
      setTimeout(function() {
        btn.textContent = origText;
        btn.disabled = false;
        btn.classList.remove('fail');
      }, 3000);
    });
}

function saveClients() {
  localStorage.setItem('mw_clients', JSON.stringify(clientData));
  autoSyncToSupabase('mw_clients');
}

function toggleClientVat(idx, checked) {
  // checked=true → 부가세 포함(기본), checked=false → 면제
  clientData[idx].vatExempt = !checked;
  saveClients();
}

var clientPage = 0;
var CLIENT_PAGE_SIZE = 50;

function renderClients() {
  var search = (document.getElementById('client-search').value || '').toLowerCase();
  var filtered = clientData;
  if (search) {
    filtered = clientData.filter(function(c) {
      return String(c.code || '').toLowerCase().includes(search) ||
             String(c.name || '').toLowerCase().includes(search) ||
             String(c.bizNo || '').includes(search) ||
             String(c.ceo || '').toLowerCase().includes(search) ||
             String(c.manager || '').toLowerCase().includes(search) ||
             String(c.manageCode || '').toLowerCase().includes(search);
    });
  }

  var totalPages = Math.ceil(filtered.length / CLIENT_PAGE_SIZE);
  if (clientPage >= totalPages) clientPage = Math.max(0, totalPages - 1);
  var start = clientPage * CLIENT_PAGE_SIZE;
  var pageData = filtered.slice(start, start + CLIENT_PAGE_SIZE);

  var kindBadge = function(k) {
    if (k == 1) return '<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;background:#DBEAFE;color:#1E40AF">매입</span>';
    if (k == 2) return '<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;background:#D1FAE5;color:#065F46">매출</span>';
    return '<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;background:#F3F4F6;color:#6B7280">-</span>';
  };

  var body = document.getElementById('client-body');
  body.innerHTML = pageData.map(function(c) {
    var ri = clientData.indexOf(c);
    var bankDisplay = (c.bankName && c.bankAccount) ? c.bankName + ' ' + c.bankAccount : (c.bankAccount || '-');
    var isExempt = !!c.vatExempt;
    var exemptBadge = isExempt ? ' <span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px;background:#FCEBEB;color:#791F1F">면제</span>' : '';
    return '<tr style="' + (isExempt ? 'background:#FFF5F5' : '') + '">' +
      '<td class="center"><span style="color:#CC2222;cursor:pointer;font-size:12px" onclick="removeClient(' + ri + ')">✕</span></td>' +
      '<td class="center" style="font-weight:600">' + (c.code || '-') + '</td>' +
      '<td style="text-align:left;font-weight:500">' + (c.name || '-') + exemptBadge + '</td>' +
      '<td class="center">' + (c.bizNo || '-') + '</td>' +
      '<td class="center">' + (c.ceo || '-') + '</td>' +
      '<td class="center">' + (c.phone || '-') + '</td>' +
      '<td class="center">' + (c.mobile || '-') + '</td>' +
      '<td class="center">' + (c.fax || '-') + '</td>' +
      '<td class="center">' + (c.manageCode || '-') + '</td>' +
      '<td class="center">' + (c.zip || '-') + '</td>' +
      '<td style="text-align:left;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (c.address || '-') + '</td>' +
      '<td class="center">' + (c.bizType || '-') + '</td>' +
      '<td class="center">' + (c.bizItem || '-') + '</td>' +
      '<td class="center">' + (c.email || '-') + '</td>' +
      '<td class="center">' + bankDisplay + '</td>' +
      '<td class="center">' + (c.manager || '-') + '</td>' +
      '<td class="center">' + kindBadge(c.kind) + '</td>' +
      '<td class="center">' + (c.priceGrade || '-') + '</td>' +
      '<td class="center"><input type="checkbox" ' + (c.vatExempt ? '' : 'checked') + ' onchange="toggleClientVat(' + ri + ',this.checked)" title="체크=부가세포함, 해제=면제"></td>' +
      '<td class="center">' + (c.bankHolder || '-') + '</td>' +
      '<td class="center"><button class="btn-primary" onclick="editClient(' + ri + ')" style="padding:2px 6px;font-size:10px">수정</button></td>' +
      '</tr>';
  }).join('');
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="21"><div class="empty-state"><p>거래처가 없습니다</p><p style="font-size:12px;color:#9BA3B2">경영박사 거래처 가져오기 또는 엑셀 일괄등록으로 추가하세요</p></div></td></tr>';
  }
  document.getElementById('client-count').textContent = clientData.length + '건' + (filtered.length !== clientData.length ? ' (검색 ' + filtered.length + '건)' : '');

  // 페이지네이션
  var pagEl = document.getElementById('client-pagination');
  if (pagEl && totalPages > 1) {
    var html = '';
    for (var i = 0; i < totalPages; i++) {
      var active = i === clientPage ? 'background:#185FA5;color:#fff' : 'background:#F3F4F6;color:#374151';
      html += '<button onclick="clientPage=' + i + ';renderClients()" style="border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;' + active + '">' + (i+1) + '</button>';
    }
    pagEl.innerHTML = html;
  } else if (pagEl) {
    pagEl.innerHTML = '';
  }
  initColumnResize('client-table');
  initStickyHeader('client-table');
}

function addClient() {
  var name = prompt('상호명');
  if (!name) return;
  var bizNo = prompt('사업자등록증 (예: 123-45-67890)') || '';
  var ceo = prompt('대표자명') || '';
  var phone = prompt('전화') || '';
  var mobile = prompt('핸드폰') || '';
  var code = 'C' + String(clientData.length + 1).padStart(3, '0');
  clientData.push({
    id: Date.now(), code: code, name: name, bizNo: bizNo, phone: phone, mobile: mobile,
    fax: '', manageCode: '', ceo: ceo, zip: '', address: '', bizType: '', bizItem: '', email: '', bankAccount: '',
    manager: '', kind: 0, priceGrade: 0, bankHolder: '', bankName: ''
  });
  saveClients();
  renderClients();
  toast('거래처 등록 완료: ' + name);
}

function editClient(idx) {
  var c = clientData[idx];
  var name = prompt('상호명', c.name);
  if (name === null) return;
  c.name = name;
  c.bizNo = prompt('사업자등록증', c.bizNo) || c.bizNo;
  c.ceo = prompt('대표자명', c.ceo) || c.ceo;
  c.phone = prompt('전화', c.phone) || c.phone;
  c.mobile = prompt('핸드폰', c.mobile) || c.mobile;
  c.fax = prompt('팩스', c.fax) || c.fax;
  c.manageCode = prompt('관리코드', c.manageCode) || c.manageCode;
  c.zip = prompt('우편번호', c.zip) || c.zip;
  c.address = prompt('주소', c.address) || c.address;
  c.bizType = prompt('업태', c.bizType) || c.bizType;
  c.bizItem = prompt('종목', c.bizItem) || c.bizItem;
  c.email = prompt('이메일', c.email) || c.email;
  c.bankAccount = prompt('은행계좌', c.bankAccount) || c.bankAccount;
  c.manager = prompt('담당자', c.manager || '') || c.manager || '';
  c.bankHolder = prompt('예금주', c.bankHolder || '') || c.bankHolder || '';
  var kindInput = prompt('거래처구분 (1=매입, 2=매출)', c.kind || '');
  if (kindInput) c.kind = parseInt(kindInput) || 0;
  var gradeInput = prompt('단가구분 (1~9)', c.priceGrade || '');
  if (gradeInput) c.priceGrade = parseInt(gradeInput) || 0;
  saveClients();
  renderClients();
  toast('거래처 수정 완료: ' + name);
}

function removeClient(idx) {
  if (!confirm(clientData[idx].name + ' 거래처를 삭제하시겠습니까?')) return;
  clientData.splice(idx, 1);
  saveClients();
  renderClients();
  toast('거래처 삭제 완료');
}

async function importErpCustomers() {
  if (!confirm('경영박사에서 거래처를 가져옵니다.\n기존 거래처 데이터는 전체 교체됩니다.\n진행하시겠습니까?')) return;
  toast('거래처 가져오는 중...');
  try {
    var resp = await fetch('/api/erp/customers', { method: 'POST' });
    if (!resp.ok) {
      var err = await resp.json().catch(function(){return {}});
      throw new Error(err.error || 'HTTP ' + resp.status);
    }
    var data = await resp.json();
    if (!data.customers || !data.customers.length) {
      toast('가져온 거래처가 없습니다');
      return;
    }
    clientData.length = 0;
    data.customers.forEach(function(c) { clientData.push(c); });
    saveClients();
    clientPage = 0;
    renderClients();
    toast('경영박사 거래처 가져오기 완료 (' + data.total + '건)');
  } catch (err) {
    toast('거래처 가져오기 실패: ' + err.message);
    console.error('[거래처 가져오기]', err);
  }
}

function downloadClientTemplate() {
  if (!window.XLSX) { toast('SheetJS 로딩 중'); return; }
  var data = [['코드','상호명','사업자등록증','전화','핸드폰','팩스','관리코드','대표자명','우편','주소','업태','종목','이메일','은행계좌']];
  data.push(['C001','아리랑공구','123-45-67890','02-1234-5678','010-1234-5678','02-1234-5679','A01','김철수','04520','서울시 중구 남대문로 123','도소매','공구류','arirang@test.com','국민 123-456-789']);
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:8},{wch:18},{wch:16},{wch:15},{wch:15},{wch:15},{wch:10},{wch:10},{wch:8},{wch:30},{wch:10},{wch:10},{wch:22},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, '거래처양식');
  XLSX.writeFile(wb, '거래처_등록양식.xlsx');
  toast('거래처 엑셀 양식 다운로드 완료');
}

function uploadClients(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { toast('데이터가 없습니다'); return; }
      var added = 0;
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r || (!r[0] && !r[1])) continue;
        clientData.push({
          id: Date.now() + i,
          code: String(r[0] || ''),
          name: String(r[1] || ''),
          bizNo: String(r[2] || ''),
          phone: String(r[3] || ''),
          mobile: String(r[4] || ''),
          fax: String(r[5] || ''),
          manageCode: String(r[6] || ''),
          ceo: String(r[7] || ''),
          zip: String(r[8] || ''),
          address: String(r[9] || ''),
          bizType: String(r[10] || ''),
          bizItem: String(r[11] || ''),
          email: String(r[12] || ''),
          bankAccount: String(r[13] || '')
        });
        added++;
      }
      saveClients();
      renderClients();
      input.value = '';
      toast(added + '건 거래처 일괄등록 완료');
    } catch (err) {
      toast('엑셀 읽기 오류: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ======================== 사용자관리 ========================
var _selectedRole = 'staff';

function selectRole(role) {
  _selectedRole = role;
  var btns = document.querySelectorAll('#user-role-btns .role-btn');
  var colors = { admin: { bg: '#DBEAFE', border: '#DBEAFE', color: '#1E40AF' }, staff: { bg: '#D1FAE5', border: '#D1FAE5', color: '#065F46' }, customer: { bg: '#FEF3C7', border: '#FEF3C7', color: '#92400E' } };
  btns.forEach(function(btn) {
    var r = btn.getAttribute('data-role');
    var c = colors[r] || colors.staff;
    if (r === role) {
      btn.style.background = c.bg;
      btn.style.borderColor = c.border;
    } else {
      btn.style.background = '#fff';
      btn.style.borderColor = c.border;
    }
  });
}

function showUserModal(editId) {
  document.getElementById('user-edit-id').value = editId || '';
  document.getElementById('user-modal-title').textContent = editId ? '사용자 수정' : '사용자 추가';
  document.getElementById('user-name').value = '';
  document.getElementById('user-login-id').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-active').checked = true;
  selectRole('staff');

  if (editId) {
    fetch('/api/auth/users').then(function(r){return r.json()}).then(function(d) {
      var u = (d.users||[]).find(function(x){return x.id==editId});
      if (u) {
        document.getElementById('user-name').value = u.name || '';
        document.getElementById('user-login-id').value = u.loginId || '';
        document.getElementById('user-active').checked = u.isActive;
        selectRole(u.role || 'staff');
      }
    });
  }
  document.getElementById('user-modal').style.display = '';
  document.getElementById('user-modal').classList.add('show');
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
  document.getElementById('user-modal').classList.remove('show');
}

function saveUser() {
  var id = document.getElementById('user-edit-id').value;
  var name = document.getElementById('user-name').value.trim();
  var loginId = document.getElementById('user-login-id').value.trim();
  var password = document.getElementById('user-password').value;
  var isActive = document.getElementById('user-active').checked;

  if (!name) { toast('이름을 입력하세요'); return; }
  if (!loginId) { toast('아이디를 입력하세요'); return; }
  if (!id && (!password || password.length < 6)) { toast('비밀번호는 6자 이상이어야 합니다'); return; }

  var method = id ? 'PUT' : 'POST';
  var body = { name: name, loginId: loginId, role: _selectedRole, isActive: isActive };
  if (id) body.id = id;
  if (password && password.length >= 6) body.password = password;

  fetch('/api/auth/users', {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r){return r.json()}).then(function(d) {
    if (d.error) { toast(d.error); return; }
    toast(id ? '사용자 수정 완료' : '사용자 추가 완료');
    closeUserModal();
    renderUsers();
  }).catch(function(e) { toast('오류: ' + e.message); });
}

function deleteUser(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  fetch('/api/auth/users', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id })
  }).then(function(r){return r.json()}).then(function(d) {
    if (d.error) { toast(d.error); return; }
    toast('사용자 삭제 완료');
    renderUsers();
  });
}

function toggleUserActive(id, current) {
  fetch('/api/auth/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, isActive: !current })
  }).then(function(r){return r.json()}).then(function(d) {
    if (d.error) { toast(d.error); return; }
    renderUsers();
  });
}

function renderUsers() {
  fetch('/api/auth/users').then(function(r){return r.json()}).then(function(d) {
    var users = d.users || [];
    document.getElementById('user-count').textContent = users.length + '명';
    var roleBadge = { admin: 'background:#DBEAFE;color:#1E40AF', staff: 'background:#D1FAE5;color:#065F46', customer: 'background:#FEF3C7;color:#92400E' };
    var roleLabel = { admin: '관리자', staff: '직원', customer: '거래처' };
    document.getElementById('user-body').innerHTML = users.map(function(u, i) {
      var badge = roleBadge[u.role] || roleBadge.staff;
      var label = roleLabel[u.role] || u.role;
      var activeColor = u.isActive ? '#22C55E' : '#DC2626';
      var activeText = u.isActive ? 'ON' : 'OFF';
      var lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString('ko-KR') : '-';
      return '<tr>' +
        '<td class="center">' + (i+1) + '</td>' +
        '<td style="font-weight:500">' + (u.name||'-') + '</td>' +
        '<td>' + (u.loginId||'-') + '</td>' +
        '<td style="color:#9BA3B2">********</td>' +
        '<td><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;' + badge + '">' + label + '</span></td>' +
        '<td class="center"><button onclick="toggleUserActive(' + u.id + ',' + u.isActive + ')" style="background:' + activeColor + ';color:#fff;border:none;border-radius:10px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer">' + activeText + '</button></td>' +
        '<td style="font-size:11px;color:#5A6070">' + lastLogin + '</td>' +
        '<td class="center" style="white-space:nowrap"><button class="btn-edit" onclick="showUserModal(' + u.id + ')">수정</button> <button class="btn-danger btn-sm" onclick="deleteUser(' + u.id + ')" style="padding:2px 6px;font-size:11px">삭제</button></td>' +
        '</tr>';
    }).join('');
  });
}

init();

// ── 네이버 API 콘솔 테스트용 (나중에 제거) ──
window._testNaverProducts = async function() {
  try {
    const res = await fetch('/api/naver/products?page=1&size=10');
    const data = await res.json();
    console.log('네이버 상품 목록:', data);
    return data;
  } catch(e) {
    console.error('네이버 상품 조회 실패:', e);
  }
};

window._testNaverPriceUpdate = async function(originProductNo, newPrice) {
  if (!originProductNo || !newPrice) {
    console.error('사용법: _testNaverPriceUpdate("상품번호", 55000)');
    return;
  }
  try {
    const res = await fetch('/api/naver/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originProductNo, newPrice }),
    });
    const data = await res.json();
    console.log('가격 수정 결과:', data);
    return data;
  } catch(e) {
    console.error('가격 수정 실패:', e);
  }
};
