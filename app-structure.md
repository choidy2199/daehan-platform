# app-structure.md — 대한종합상사 관리시스템 코드 구조

생성일: 2026-03-31 14:33

## 1. app.js 함수 목록
```
14:(function checkSession() {
41:function doLogout() {
53:function load(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
54:function save(key, data) {
66:function loadObj(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; } }
71:function autoSyncToSupabase(key) {
91:function updateSyncStatus(text) {
138:async function forceUploadAll() {
181:async function uploadAllToSupabase() {
235:async function loadFromSupabase() {
262:function syncProductsToSupabase() { autoSyncToSupabase(KEYS.products); }
282:(function initSupabaseRealtime() {
329:async function realtimeDownloadAndRefresh() {
374:function refreshActiveTab() {
424:function saveAll() {
439:function calcMargin(price, cost, feeRate) {
448:function marginBadge(price, cost, feeRate) {
455:function toast(msg) {
461:function updateStatus() {
466:function findProduct(code) { return DB.products.find(p => String(p.code) === String(code)); }
470:function _buildStockMap() {
474:function findStock(code) {
479:function findPromo(code) { return DB.promotions.find(p => String(p.code) === String(code)); }
483:function showPromoPop(e, code) {
592:function calcCost(supplyPrice, productDC) {
613:function searchProducts(query) {
621:function showAC(inputEl, callback) {
645:function hideAC() { acEl.classList.remove('show'); acActive = null; }
662:function getEffectiveCost(code) {
671:function debounce(fn, delay) {
688:  function applyDebounce() {
708:function switchTab(tab) {
738:function switchOrderMain(type) {
761:function switchPromoSub(type) {
777:function switchOrderSub(type) {
791:function showSheetAC(input, type) {
820:function selectSheetAC(type, code) {
829:function addSheetItem(type) {
880:function showOrderSearchAC(input, type) {
918:function selectOrderSearchAC(type, code) {
944:function addOrderSearchItem(type) {
975:function renderOrderSheet() {
1024:function switchPromoTab(type) {
1037:function setCatalogFilter(mode) {
1047:function renderCatalog() {
1089:  function buildRow(p) {
1166:  function renderBatch(start, count) {
1229:  (function updateFilterCounts() {
1248:function toggleDiscontinued(idx, checked) {
1254:function toggleAllDiscontinued(checked) {
1308:function getSubcatOrder(subcat) {
1324:function sortProducts(list) {
1333:function populateCatalogFilters() {
1345:function showProductPicker(type) {
1361:function closeProductPicker() {
1365:function renderPickerList() {
1408:function togglePickerItem(idx, checked) {
1414:function togglePickerAll(checked) {
1432:function updatePickerCount() {
1436:function confirmProductPicker() {
1464:function addOrderRow(type) {
1470:function removeOrderRow(type, idx) {
1477:function clearOrderTab(type) {
1485:function resetOrderQty(type) {
1494:function onOrderCodeChange(type, idx, val) {
1500:function onOrderQtyChange(type, idx, val) {
1506:function onOrderMemoChange(type, idx, val) {
1511:function renderOrderTab(type) {
1544:function calcOrderTotals() {
1558:function renderAllOrders() {
1567:function confirmOrder() {
1632:function updateOrderSheetButtons(confirmed) {
1645:function resetOrderConfirm() {
1656:function resetAllOrderQty() {
1666:function showOrderHistory() {
1699:function closeOrderHistoryModal() {
1703:function cancelOrderHistory(id) {
1728:function confirmPromoOrder() {
1830:function updatePoSheetButtons(confirmed) {
1843:function resetPoConfirm() {
1855:function resetAllPromoQty() {
1866:function showPromoOrderHistory() {
1899:function closePoHistoryModal() {
1903:function cancelPoHistory(id) {
1933:function exportOrder() {
1993:function findCodeByModel(model, ttiNum) {
2003:function renderPoOrder() {
2070:function savePoOrders() { localStorage.setItem('mw_po_orders', JSON.stringify(poOrderData)); }
2072:function downloadPoTemplate() {
2084:function uploadPoExcel(input) {
2139:function addPoRow() {
2145:function removePoRow(idx) {
2151:function resetPoQty() {
2158:function clearPoAll() {
2167:function renderSpotOrder() {
2196:function saveSpotOrders() { localStorage.setItem('mw_spot_orders', JSON.stringify(spotOrderData)); }
2198:function addSpotRow() {
2214:function removeSpotRow(idx) {
2220:function resetSpotQty() {
2227:function clearSpotAll() {
```

## 2. 모든 getElementById / querySelector
```
35:      var nameEl = document.getElementById('current-user-name');
93:  var el = document.getElementById('sync-status');
102:  var btn = document.getElementById('header-sync-btn');
103:  var icon = document.getElementById('header-sync-icon');
104:  var txt = document.getElementById('header-sync-text');
139:  var btn = document.getElementById('header-sync-btn');
182:  var btn = document.getElementById('btn-supabase-upload');
267:    var btn = document.getElementById('btn-supabase-upload');
377:    var activeTab = document.querySelector('.tab-content[style*="display: block"], .tab-content[style*="display:block"]');
456:  const t = document.getElementById('toast');
462:  document.getElementById('status-products').textContent = `제품: ${DB.products.length}건 | 재고: ${DB.inventory.length}건 | 프로모션: ${DB.promotions.length}건`;
463:  document.getElementById('status-save').textContent = `마지막 저장: ${new Date().toLocaleTimeString('ko')}`;
685:    'est-search': function() { searchEstProducts(document.getElementById('est-search').value); },
690:      var el = document.getElementById(id);
710:  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
711:  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
712:  document.getElementById('tab-' + tab).classList.add('active');
723:      if (tab === 'estimate') { renderEstimateList(); if (!_estDateManuallySet) document.getElementById('est-date').value = getTodayStr(); }
732:      document.getElementById('est-date').value = getTodayStr();
739:  document.querySelectorAll('.order-tab-content').forEach(t => t.style.display = 'none');
740:  document.querySelectorAll('#order-main-tabs .sub-tab').forEach(t => t.classList.remove('active'));
743:  const normalWrap = document.getElementById('order-normal-wrap');
744:  const promoWrap = document.getElementById('order-promo-wrap');
746:  var kpiBar = document.getElementById('order-kpi-bar');
762:  document.querySelectorAll('.order-tab-content').forEach(t => t.style.display = 'none');
763:  document.getElementById('order-' + type).style.display = 'block';
766:    const btn = document.getElementById('order-sub-' + t);
769:  const sheetBtn = document.getElementById('order-sub-po-sheet');
778:  document.querySelectorAll('.order-tab-content').forEach(t => t.style.display = 'none');
779:  document.getElementById('order-' + type).style.display = 'block';
782:    const btn = document.getElementById('order-sub-' + t);
785:  const sheetBtn = document.getElementById('order-sub-sheet');
793:  var acDiv = document.getElementById('sheet-ac-' + type);
823:  document.getElementById('sheet-add-' + type + '-ordernum').value = p.orderNum || p.code;
824:  document.getElementById('sheet-add-' + type + '-ordernum').dataset.code = code;
825:  document.getElementById('sheet-ac-' + type).style.display = 'none';
826:  document.getElementById('sheet-add-' + type + '-qty').focus();
830:  var input = document.getElementById('sheet-add-' + type + '-ordernum');
831:  var qtyInput = document.getElementById('sheet-add-' + type + '-qty');
868:    var ac = document.getElementById('sheet-ac-' + type);
872:    var oac = document.getElementById('order-ac-' + type);
882:  var acDiv = document.getElementById('order-ac-' + type);
921:  var input = document.getElementById('order-search-' + type);
924:  document.getElementById('order-ac-' + type).style.display = 'none';
945:  var input = document.getElementById('order-search-' + type);
971:  document.getElementById('order-ac-' + type).style.display = 'none';
977:  document.getElementById('order-sheet-date').textContent = now.toLocaleDateString('ko') + ' ' + now.toLocaleTimeString('ko', {hour:'2-digit',minute:'2-digit'});
981:    const body = document.getElementById(`sheet-${type}-body`);
1010:    document.getElementById(`sheet-${type}-count`).textContent = items.length ? `(${items.length}건)` : '';
1011:    document.getElementById(`sheet-${type}-sum`).innerHTML = `${fmt(totalSupply)} <span style="color:#1D9E75;margin-left:4px">${fmt(totalCost)}</span>`;
```

## 3. 모든 addEventListener
```
584:document.addEventListener('click', function(e) {
647:acEl.addEventListener('mousedown', function(e) {
657:document.addEventListener('click', function(e) {
700:    document.addEventListener('DOMContentLoaded', applyDebounce);
866:document.addEventListener('click', function(e) {
1199:    scrollContainer.addEventListener('scroll', scrollContainer._catalogScroll);
4461:  scrollContainer.addEventListener('scroll', function() {
4566:    handle.addEventListener('mousedown', function(e) {
4611:      document.addEventListener('mousemove', onMove);
4612:      document.addEventListener('mouseup', onUp);
5463:      dateInput.addEventListener('change', function() { _estDateManuallySet = true; });
5467:    document.addEventListener('DOMContentLoaded', attachDateListener);
5556:document.addEventListener('mousedown', function(e) {
5977:    document.addEventListener('click', function closePop(e) {
6061:    document.addEventListener('click', function closePop(e) {
6141:    document.addEventListener('click', function closePop(e) {
6337:window.addEventListener('message', function(event) {
6720:  header.addEventListener('mousedown', function(e) {
6735:  document.addEventListener('mousemove', function(e) {
6743:  document.addEventListener('mouseup', function() {
```

## 4. 모든 input 요소 (HTML)
```
85:        <input class="input" id="catalog-search" type="search" name="search_naf_catalog" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" oninput="renderCatalog()">
176:          <input class="input" id="order-search-elec" type="search" name="search_naf_order_elec" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="코드, 순번, 모델명 검색 → 발주 추가" style="flex:1;height:34px;font-size:13px" oninput="showOrderSearchAC(this,'elec')" onkeydown="if(event.key==='Enter')addOrderSearchItem('elec')">
204:          <input class="input" id="order-search-hand" type="search" name="search_naf_order_hand" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="코드, 순번, 모델명 검색 → 발주 추가" style="flex:1;height:34px;font-size:13px" oninput="showOrderSearchAC(this,'hand')" onkeydown="if(event.key==='Enter')addOrderSearchItem('hand')">
232:          <input class="input" id="order-search-pack" type="search" name="search_naf_order_pack" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="코드, 순번, 모델명 검색 → 발주 추가" style="flex:1;height:34px;font-size:13px" oninput="showOrderSearchAC(this,'pack')" onkeydown="if(event.key==='Enter')addOrderSearchItem('pack')">
254:          <input type="file" id="po-upload-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="uploadPoExcel(this)">
399:              <input class="input" id="sheet-add-elec-ordernum" type="search" name="search_naf_sheet_elec" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="순번 입력" style="width:90px;height:32px;font-size:13px" oninput="showSheetAC(this,'elec')" onkeydown="if(event.key==='Enter')addSheetItem('elec')">
400:              <input class="input" id="sheet-add-elec-qty" type="number" placeholder="수량" min="1" style="width:70px;height:32px;font-size:13px;text-align:center" onkeydown="if(event.key==='Enter')addSheetItem('elec')">
416:              <input class="input" id="sheet-add-hand-ordernum" type="search" name="search_naf_sheet_hand" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="순번 입력" style="width:90px;height:32px;font-size:13px" oninput="showSheetAC(this,'hand')" onkeydown="if(event.key==='Enter')addSheetItem('hand')">
417:              <input class="input" id="sheet-add-hand-qty" type="number" placeholder="수량" min="1" style="width:70px;height:32px;font-size:13px;text-align:center" onkeydown="if(event.key==='Enter')addSheetItem('hand')">
433:              <input class="input" id="sheet-add-pack-ordernum" type="search" name="search_naf_sheet_pack" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="순번 입력" style="width:90px;height:32px;font-size:13px" oninput="showSheetAC(this,'pack')" onkeydown="if(event.key==='Enter')addSheetItem('pack')">
434:              <input class="input" id="sheet-add-pack-qty" type="number" placeholder="수량" min="1" style="width:70px;height:32px;font-size:13px;text-align:center" onkeydown="if(event.key==='Enter')addSheetItem('pack')">
583:  <input type="hidden" id="promo-search">
594:  <input id="rebate-amount"><div id="rebate-result"></div><tbody id="rebate-body"></tbody>
616:                <div><label class="label" style="font-size:11px">M12 B2 (2.0Ah)</label><input class="input" id="pp-M12B2" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
617:                <div><label class="label" style="font-size:11px">M12 HB2.5 (2.5Ah)</label><input class="input" id="pp-M12HB25" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
618:                <div><label class="label" style="font-size:11px">M12 B4 (4.0Ah)</label><input class="input" id="pp-M12B4" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
619:                <div><label class="label" style="font-size:11px">M12 HB5 (5.0Ah)</label><input class="input" id="pp-M12HB5" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
620:                <div><label class="label" style="font-size:11px;color:#185FA5;font-weight:600">C12C (충전기)</label><input class="input" id="pp-C12C" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
626:                <div><label class="label" style="font-size:11px">M18 B2 (2.0Ah)</label><input class="input" id="pp-M18B2" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
627:                <div><label class="label" style="font-size:11px">M18 HB3 (3.0Ah)</label><input class="input" id="pp-M18HB3" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
628:                <div><label class="label" style="font-size:11px">M18 B5 (5.0Ah)</label><input class="input" id="pp-M18B5" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
629:                <div><label class="label" style="font-size:11px">M18 FB6 (FORGE)</label><input class="input" id="pp-M18FB6" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
630:                <div><label class="label" style="font-size:11px">M18 FB8 (FORGE)</label><input class="input" id="pp-M18FB8" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
631:                <div><label class="label" style="font-size:11px">M18 FB12 (FORGE)</label><input class="input" id="pp-M18FB12" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
632:                <div><label class="label" style="font-size:11px;color:#185FA5;font-weight:600">M12-18C</label><input class="input" id="pp-M1218C" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
633:                <div><label class="label" style="font-size:11px;color:#185FA5;font-weight:600">M12-18FC</label><input class="input" id="pp-M1218FC" type="text" placeholder="원가" style="font-size:11px;text-align:right;height:26px" oninput="formatPartsInput(this)"></div>
647:                <div><label class="label" style="font-size:11px">M12 B2 (2.0Ah)</label><input class="input" id="ppp-M12B2" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
648:                <div><label class="label" style="font-size:11px">M12 HB2.5 (2.5Ah)</label><input class="input" id="ppp-M12HB25" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
649:                <div><label class="label" style="font-size:11px">M12 B4 (4.0Ah)</label><input class="input" id="ppp-M12B4" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
650:                <div><label class="label" style="font-size:11px">M12 HB5 (5.0Ah)</label><input class="input" id="ppp-M12HB5" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
651:                <div><label class="label" style="font-size:11px;color:#185FA5;font-weight:600">C12C (충전기)</label><input class="input" id="ppp-C12C" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
657:                <div><label class="label" style="font-size:11px">M18 B2 (2.0Ah)</label><input class="input" id="ppp-M18B2" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
658:                <div><label class="label" style="font-size:11px">M18 HB3 (3.0Ah)</label><input class="input" id="ppp-M18HB3" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
659:                <div><label class="label" style="font-size:11px">M18 B5 (5.0Ah)</label><input class="input" id="ppp-M18B5" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
660:                <div><label class="label" style="font-size:11px">M18 FB6 (FORGE)</label><input class="input" id="ppp-M18FB6" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
661:                <div><label class="label" style="font-size:11px">M18 FB8 (FORGE)</label><input class="input" id="ppp-M18FB8" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
662:                <div><label class="label" style="font-size:11px">M18 FB12 (FORGE)</label><input class="input" id="ppp-M18FB12" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
663:                <div><label class="label" style="font-size:11px;color:#185FA5;font-weight:600">M12-18C</label><input class="input" id="ppp-M1218C" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
664:                <div><label class="label" style="font-size:11px;color:#185FA5;font-weight:600">M12-18FC</label><input class="input" id="ppp-M1218FC" type="text" placeholder="빈칸=일반가" style="font-size:11px;text-align:right;height:26px;border-color:#B5D4F4;background:#FAFCFF" oninput="formatPartsInput(this)"></div>
739:      <input class="input" id="gen-search" type="search" name="search_naf_gen" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" style="max-width:400px;margin-bottom:12px" oninput="renderGenProducts()">
758:      <input class="input" id="est-search" type="search" name="search_naf_est" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" style="max-width:500px;margin-bottom:12px"
810:            <input class="input" id="est-client" type="search" name="search_naf_est_client" placeholder="거래처명 또는 사업자번호 검색..." autocomplete="off" data-form-type="other" data-lpignore="true"
818:          <input class="input" id="est-date" type="date">
883:            <div style="flex:1"><label style="font-size:11px;color:#5A6070;display:block;margin-bottom:3px">판매수수료 (%)</label><input class="input" id="fee-naver-sale" type="number" step="0.01" value="3.0" oninput="updateNaverTotal()"></div>
884:            <div style="flex:1"><label style="font-size:11px;color:#5A6070;display:block;margin-bottom:3px">결제수수료 (%)</label><input class="input" id="fee-naver-pay" type="number" step="0.01" value="3.63" oninput="updateNaverTotal()"></div>
895:            <div style="flex:1"><label style="font-size:11px;color:#5A6070;display:block;margin-bottom:3px">판매수수료 (%)</label><input class="input" id="fee-coupang-mp" type="number" step="0.1" value="10.8"></div>
907:            <div style="flex:1"><label style="font-size:11px;color:#5A6070;display:block;margin-bottom:3px">판매수수료 (%)</label><input class="input" id="fee-coupang-rg" type="number" step="0.1" value="10.8"></div>
908:            <div style="flex:1"><label style="font-size:11px;color:#5A6070;display:block;margin-bottom:3px">물류비 (원)</label><input class="input" id="fee-coupang-logi" type="number" step="100" value="2800"></div>
919:            <div style="flex:1"><label style="font-size:11px;color:#5A6070;display:block;margin-bottom:3px">전동공구 (%)<span style="font-size:10px;color:#9BA3B2"> 파워툴</span></label><input class="input" id="fee-open-elec" type="number" step="0.1" value="13.0"></div>
920:            <div style="flex:1"><label style="font-size:11px;color:#5A6070;display:block;margin-bottom:3px">수공구 (%)<span style="font-size:10px;color:#9BA3B2"> 수공구,액세서리,팩아웃</span></label><input class="input" id="fee-open-hand" type="number" step="0.1" value="17.6"></div>
941:          <input type="file" id="client-upload-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="uploadClients(this)">
947:          <input class="input" id="client-search" type="search" name="search_naf_client" placeholder="상호명, 사업자번호, 대표자명, 코드 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" style="max-width:400px" oninput="renderClients()">
1024:        <input type="hidden" id="user-edit-id" value="">
1027:          <input class="input" id="user-name" placeholder="이름">
1031:          <input class="input" id="user-login-id" placeholder="아이디">
1035:          <input class="input" id="user-password" type="password" placeholder="비밀번호">
1046:          <input type="checkbox" id="user-active" checked> 즉시 승인
1078:        <input type="file" id="excel-file" accept=".xlsx,.xls" style="font-size:13px">
1083:          <input type="radio" name="import-mode" value="replace" checked style="accent-color:#185FA5"> 전체 교체 — 기존 데이터 삭제 후 새로 등록 (최초 업로드)
1086:          <input type="radio" name="import-mode" value="merge"> 코드 매칭 업데이트 — 기존 제품은 덮어쓰기, 신규는 추가 (부분 수정용)
1114:        <input type="file" id="gen-excel-file" accept=".xlsx,.xls,.csv" style="font-size:13px">
1119:          <input type="radio" name="gen-import-mode" value="replace" checked style="accent-color:#185FA5"> 전체 교체 — 기존 데이터 삭제 후 새로 등록 (최초 업로드)
1122:          <input type="radio" name="gen-import-mode" value="merge"> 코드 매칭 업데이트 — 기존 제품은 덮어쓰기, 신규는 추가 (부분 수정용)
1153:            <input class="input" id="set-quarter" type="number" step="0.1">
1157:            <input class="input" id="set-year" type="number" step="0.1">
1174:            <input class="input" id="set-mk-domae" type="number" step="0.1">
1179:            <input class="input" id="set-mk-retail" type="number" step="0.1">
1186:            <input class="input" id="set-mk-naver" type="number" step="0.1">
1191:            <input class="input" id="set-mk-open-elec" type="number" step="0.1">
1196:            <input class="input" id="set-mk-open-hand" type="number" step="0.1">
1214:        <label class="dm-row"><input type="checkbox" value="products"><span class="dm-label">밀워키 제품 데이터</span><span class="dm-badge" id="dm-cnt-products"></span></label>
1215:        <label class="dm-row"><input type="checkbox" value="inventory"><span class="dm-label">재고 데이터</span><span class="dm-badge" id="dm-cnt-inventory"></span></label>
1216:        <label class="dm-row"><input type="checkbox" value="promotions"><span class="dm-label">프로모션 데이터</span><span class="dm-badge" id="dm-cnt-promotions"></span></label>
1217:        <label class="dm-row"><input type="checkbox" value="orders"><span class="dm-label">발주 데이터</span><span class="dm-badge" id="dm-cnt-orders"></span></label>
1218:        <label class="dm-row"><input type="checkbox" value="orderHistory"><span class="dm-label">발주 이력 (원가P)</span><span class="dm-badge" id="dm-cnt-orderHistory"></span></label>
1219:        <label class="dm-row"><input type="checkbox" value="general"><span class="dm-label">일반제품</span><span class="dm-badge" id="dm-cnt-general"></span></label>
1220:        <label class="dm-row"><input type="checkbox" value="sales"><span class="dm-label">온라인판매 항목</span><span class="dm-badge" id="dm-cnt-sales"></span></label>
1221:        <label class="dm-row"><input type="checkbox" value="estimates"><span class="dm-label">견적서</span><span class="dm-badge" id="dm-cnt-estimates"></span></label>
1222:        <label class="dm-row"><input type="checkbox" value="setbun"><span class="dm-label">세트분해 / 배터리 시세</span><span class="dm-badge" id="dm-cnt-setbun"></span></label>
1223:        <label class="dm-row"><input type="checkbox" value="settings"><span class="dm-label">설정값 (리베이트·수수료·마크업)</span><span class="dm-badge" id="dm-cnt-settings"></span></label>
1224:        <label class="dm-row"><input type="checkbox" value="ui"><span class="dm-label">UI 설정 (컬럼 너비)</span><span class="dm-badge" id="dm-cnt-ui"></span></label>
1261:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-ar-name-0" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-ar-rate-0" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1262:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-ar-name-1" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-ar-rate-1" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1263:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-ar-name-2" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-ar-rate-2" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1264:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-ar-name-3" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-ar-rate-3" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1271:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-vol-name-0" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-vol-rate-0" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1272:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-vol-name-1" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-vol-rate-1" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1273:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-vol-name-2" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-vol-rate-2" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1274:            <div style="display:flex;gap:6px;align-items:center"><input class="input" id="os-vol-name-3" placeholder="프로모션명" style="flex:1;height:32px;font-size:12px"><input class="input" id="os-vol-rate-3" type="number" step="0.1" placeholder="%" style="width:70px;height:32px;font-size:12px;text-align:right"><span style="font-size:12px;color:#5A6070">%</span></div>
1325:      <input type="hidden" id="promo-edit-idx" value="-1">
1329:          <input class="input" id="pe-promoName" placeholder="예: M12 IR-202B 7% DC 프로모션">
1333:          <input class="input" id="pe-promoCode" placeholder="예: T6, T7, M202">
1337:          <input class="input" id="pe-model" placeholder="예: M12 IR-202B">
1341:          <input class="input" id="pe-orderNum" placeholder="예: 1026">
1345:          <input class="input" id="pe-qty" type="number" placeholder="예: 1" value="1">
1349:          <input class="input" id="pe-dealerPrice" type="number" placeholder="예: 189000">
1353:          <input class="input" id="pe-promoPrice" type="number" placeholder="예: 175000, 무상제공=0">
1357:          <input class="input" id="pe-discountRate" placeholder="예: 7% 또는 7+1">
1361:          <input class="input" id="pe-period" placeholder="예: 일반주문 오픈후~3월30일">
1380:      <input type="hidden" id="prod-edit-idx" value="-1">
1384:          <input class="input" id="prod-code" placeholder="예: 21815">
1388:          <input class="input" id="prod-manageCode" placeholder="바코드">
1392:          <input class="input" id="prod-category" placeholder="예: 파워툴">
1396:          <input class="input" id="prod-subcategory" placeholder="예: 12V FUEL">
1400:          <input class="input" id="prod-detail" placeholder="예: 드릴 드라이버">
1404:          <input class="input" id="prod-orderNum" placeholder="예: 1093">
1408:          <input class="input" id="prod-ttiNum" placeholder="예: 18621019">
1414:          <input class="input" id="prod-model" placeholder="예: M12 FDD2-0X">
1418:          <input class="input" id="prod-supplyPrice" type="number" placeholder="예: 139000">
1424:          <input class="input" id="prod-description" placeholder="예: 12V FUEL 드릴 드라이버(GEN3) 베어툴">
1430:          <input class="input" id="prod-productDC" type="number" step="0.001" placeholder="예: 0.13">
1441:          <input class="input" id="prod-inDate" placeholder="예: 4월 중순 입고예정">
1469:        <input type="file" id="promo-pdf-file" accept=".pdf,.jpg,.jpeg,.png,.webp" style="font-size:13px;flex:1">
1481:          <label style="cursor:pointer"><input type="checkbox" id="pdf-select-all" onchange="togglePdfSelectAll(this.checked)" checked> 전체 선택</label>
1502:      <input type="hidden" id="cumul-edit-idx" value="-1">
1506:          <input class="input" id="cumul-group" placeholder="예: M12 렌치&라쳇">
1510:          <input class="input" id="cumul-period" placeholder="예: 2026년 3월">
1516:          <input class="input" id="cumul-threshold" placeholder="예: 200만원 당">
1520:          <input class="input" id="cumul-foc" placeholder="예: FOC 쿠폰 16만원">
1524:          <input class="input" id="cumul-note" placeholder="예: 제한없음">
1529:        <input class="input" id="cumul-item-search" type="search" name="search_naf_cumul" placeholder="모델명/코드 검색" style="max-width:300px" autocomplete="off" data-form-type="other" data-lpignore="true"
1555:      <input type="hidden" id="quarter-edit-idx" value="-1">
1559:          <input class="input" id="quarter-group" placeholder="예: 수공구 & 액세서리류">
1563:          <input class="input" id="quarter-target" placeholder="예: 대분류: 수공구 / 액세서리">
1576:          <input class="input" id="quarter-period" placeholder="예: 2026년 1월~3월">
1582:          <input class="input" placeholder="금액 (예: 100만원)" style="flex:1" id="qt-amt-0">
1583:          <input class="input" placeholder="지원율 (예: 8%)" style="width:100px" id="qt-rate-0">
1586:          <input class="input" placeholder="금액" style="flex:1" id="qt-amt-1">
1587:          <input class="input" placeholder="지원율" style="width:100px" id="qt-rate-1">
1590:          <input class="input" placeholder="금액" style="flex:1" id="qt-amt-2">
1591:          <input class="input" placeholder="지원율" style="width:100px" id="qt-rate-2">
1594:          <input class="input" placeholder="금액" style="flex:1" id="qt-amt-3">
1595:          <input class="input" placeholder="지원율" style="width:100px" id="qt-rate-3">
1600:        <input class="input" id="quarter-note" placeholder="비고">
1618:      <input type="hidden" id="pv2-category" value="">
1619:      <input type="hidden" id="pv2-edit-idx" value="-1">
1623:          <input class="input" id="pv2-no" placeholder="예: M101, M201, T5">
1627:          <input class="input" id="pv2-discount" placeholder="예: 20%, 7+1, 무상">
1631:          <input class="input" id="pv2-period" placeholder="예: 3/3~3/30">
1637:          <input class="input" id="pv2-title" placeholder="예: M18 BLCV2 신제품 패키지 프로모션 - 20% 할인">
1641:          <input class="input" id="pv2-restriction" placeholder="예: 업체당 1세트 제한">
1647:        <input class="input" id="pv2-item-search" type="search" name="search_naf_pv2" placeholder="모델명/코드 검색으로 추가" style="max-width:300px" autocomplete="off" data-form-type="other" data-lpignore="true"
1716:      <input type="hidden" id="sb-edit-idx" value="-1">
1717:      <input type="hidden" id="sb-search-mode" value="normal">
1718:      <input type="hidden" id="sb-set-code" value="">
1719:      <input type="hidden" id="sb-bare-code" value="">
1725:          <input class="input" id="sb-set-model-input" type="search" name="search_naf_setbun" placeholder="모델명 검색 (예: FID2)" autocomplete="off" data-form-type="other" data-lpignore="true"
1759:          <input class="input" id="sb-promo" placeholder="예: M201 7% DC">
1763:          <input class="input" id="sb-promo-cost" type="number" placeholder="프로모션 적용 시 세트 매입원가">
1783:        <input class="input" id="picker-search" type="search" name="search_naf_picker" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" oninput="renderPickerList()" style="flex:1">
1792:        <label style="cursor:pointer"><input type="checkbox" id="picker-select-all" onchange="togglePickerAll(this.checked)"> 전체 선택</label>
```

## 5. 업로드/동기화 관련 코드
```
63:  // 자동 Supabase 동기화
64:  autoSyncToSupabase(key);
69:// 자동 동기화 (5초 디바운스)
70:var _syncTimers = {};
71:function autoSyncToSupabase(key) {
72:  if (_syncTimers[key]) clearTimeout(_syncTimers[key]);
73:  _syncTimers[key] = setTimeout(function() {
77:    sessionStorage.setItem('_lastSyncTs', String(Date.now()));
78:    fetch('/api/sync/save', {
83:      if (d.success) { updateSyncStatus('동기화 완료'); console.log('[Supabase] 자동 동기화:', key); }
85:      console.log('[Supabase] 동기화 실패:', key, e.message);
86:      updateSyncStatus('동기화 실패');
91:function updateSyncStatus(text) {
92:  // 기존 설정 탭 #sync-status 업데이트
93:  var el = document.getElementById('sync-status');
101:  // 헤더 동기화 버튼 업데이트
102:  var btn = document.getElementById('header-sync-btn');
103:  var icon = document.getElementById('header-sync-icon');
104:  var txt = document.getElementById('header-sync-text');
111:    // 상태 1: 동기화 완료 (녹색)
117:    txt.textContent = '동기화 완료 · ' + ts;
127:    // 상태 2: 동기화 중 (주황색 + 회전)
133:    txt.textContent = '동기화 중...';
137:// 헤더 버튼 클릭: 즉시 강제 업로드
138:async function forceUploadAll() {
139:  var btn = document.getElementById('header-sync-btn');
141:  updateSyncStatus('동기화 중...');
146:    var uploadData = [];
149:      if (raw) uploadData.push({ key: keys[i], value: raw });
152:    if (!uploadData.length) {
153:      updateSyncStatus('동기화 완료');
159:    sessionStorage.setItem('_lastSyncTs', String(Date.now()));
161:    var res = await fetch('/api/sync/upload', {
164:      body: JSON.stringify({ data: uploadData })
166:    if (!res.ok) throw new Error('업로드 실패: HTTP ' + res.status);
169:    console.log('[강제 업로드] 완료:', result.saved || uploadData.length, '개 키');
170:    updateSyncStatus('동기화 완료');
172:    console.error('[강제 업로드 실패]', err);
173:    updateSyncStatus('동기화 실패');
180:// 전체 업로드 (최초 1회)
181:async function uploadAllToSupabase() {
182:  var btn = document.getElementById('btn-supabase-upload');
186:  btn.textContent = '업로드 중...';
193:    var uploadData = [];
197:        uploadData.push({ key: keys[i], value: raw });
198:        btn.textContent = '업로드 중... (' + keys[i] + ')';
202:    sessionStorage.setItem('_lastSyncTs', String(Date.now()));
204:    var res = await fetch('/api/sync/upload', {
207:      body: JSON.stringify({ data: uploadData })
209:    if (!res.ok) throw new Error('업로드 실패: ' + res.status);
212:    btn.textContent = '업로드 완료!';
214:    updateSyncStatus('동기화 완료');
218:      btn.textContent = '업로드';
225:    alert('업로드 실패. 다시 시도해주세요.\n' + error.message);
226:    btn.textContent = '업로드';
235:async function loadFromSupabase() {
238:    var res = await fetch('/api/sync/download');
253:    updateSyncStatus('동기화 완료');
262:function syncProductsToSupabase() { autoSyncToSupabase(KEYS.products); }
264:// 업로드 버튼 초기 상태 설정
267:    var btn = document.getElementById('btn-supabase-upload');
269:      btn.textContent = '업로드';
299:      var lastTs = parseInt(sessionStorage.getItem('_lastSyncTs') || '0');
306:      updateSyncStatus('동기화 중...');
317:        updateSyncStatus('동기화 완료');
319:        updateSyncStatus('연결 끊김');
321:        updateSyncStatus('연결 끊김');
329:async function realtimeDownloadAndRefresh() {
331:    var res = await fetch('/api/sync/download');
366:    updateSyncStatus('동기화 완료');
369:    updateSyncStatus('동기화 실패');
2063:    body.innerHTML = '<tr><td colspan="16"><div class="empty-state"><p>프로모션 발주 항목이 없습니다</p><p style="font-size:12px;color:#9BA3B2">엑셀 업로드 또는 + 추가로 등록하세요</p></div></td></tr>';
2084:function uploadPoExcel(input) {
2131:      toast(`${added}건 프로모션 발주 업로드 완료`);
3132:async function parsePdf() {
3184:    status.innerHTML = '<span style="color:#CC2222">❌ PDF 또는 이미지 파일만 업로드 가능합니다.</span>';
3544:async function syncInventory() {
3569:  console.log('[재고동기화] 시작 — 총 ' + allItems.length + '건 (mw: ' + mwCount + ', gen: ' + genCount + ')');
3584:  console.log('[재고동기화] 배치 ' + batches.length + '개로 분할 (각 최대 ' + BATCH + '건), 병렬 호출');
3590:    console.log('[재고동기화] 배치 ' + (batchIdx+1) + ' 전송: ' + codes.length + '건, 샘플: ' + codes.slice(0,3).join(', '));
3608:      console.log('[재고동기화] 배치 ' + (batchIdx+1) + ' 응답:', JSON.stringify({
3617:      console.error('[재고동기화] 배치 ' + (batchIdx+1) + ' 오류:', msg);
3642:    console.log('[재고동기화] stockMap 키 ' + mapKeys.length + '개, 샘플:', mapKeys.slice(0, 5).map(function(k) { return k + '=' + stockMap[k]; }).join(', '));
3645:      console.warn('[재고동기화] API 오류 목록:', data.errors);
3686:  localStorage.setItem('last_inventory_sync', dateTimeStr);
3687:  updateSyncTimeDisplay();
3691:  console.log('[재고동기화] 완료 — 밀워키: ' + updatedMw + '건, 일반: ' + updatedGen + '건, 매칭실패: ' + notFound.length + '건, 오류: ' + errors.length + '건');
3693:    console.log('[재고동기화] 매칭 안 된 관리코드:', notFound.slice(0, 20).join(', ') + (notFound.length > 20 ? ' 외 ' + (notFound.length - 20) + '건' : ''));
3699:    console.warn('[재고동기화 오류]', errors);
3704:function updateSyncTimeDisplay() {
3705:  var el = document.getElementById('inventory-sync-time');
3707:  var saved = localStorage.getItem('last_inventory_sync');
4076:        // 업로드 모드 확인
4677:    rows = `<tr><td colspan="${cols}"><div class="empty-state"><p>프로모션이 없습니다</p><p style="font-size:12px;color:#9BA3B2">PDF 업로드 또는 수동 추가로 등록하세요</p></div></td></tr>`;
5078:    body.innerHTML = '<tr><td colspan="16"><div class="empty-state"><p>일반제품이 없습니다</p><p style="font-size:12px;color:#9BA3B2">양식을 다운로드하여 업로드하거나, + 제품 추가를 이용하세요</p></div></td></tr>';
5165:function uploadGenProducts(input) {
5203:      toast(`${count}건 업로드 완료`);
5205:      toast('업로드 실패: ' + err.message);
5822:async function registerOrderOut() {
6257:async function handlePurchaseInvoice(orderType) {
6774:async function init() {
6782:  // 0. 항상 Supabase에서 최신 데이터 다운로드 (서버 기준 동기화)
6784:  updateSyncStatus('동기화 중...');
6796:      updateSyncStatus('동기화 완료');
6800:      updateSyncStatus('동기화 완료');
6802:      // 서버 데이터 없지만 로컬에는 있음 → 로컬 데이터 자동 업로드
6803:      console.log('[Init] 서버 데이터 없음 — 로컬 데이터 자동 업로드');
6804:      sessionStorage.setItem('_lastSyncTs', String(Date.now()));
6805:      forceUploadAll();
6809:    updateSyncStatus('동기화 실패');
6811:  console.log('[PERF] init — step0 supabase동기화: ' + (performance.now() - _t).toFixed(0) + 'ms');
6832:    updateSyncTimeDisplay();
6836:  // 3. (init에서 이미 서버 동기화 완료 — Realtime이 이후 변경 감지)
6852:  // Supabase 업로드 버튼 동적 추가 (설정 탭 > 수수료 섹션 헤더)
6855:    if (feeHeader && !document.getElementById('btn-supabase-upload')) {
6857:      btn.id = 'btn-supabase-upload';
6858:      btn.textContent = '업로드';
6860:      btn.onclick = uploadAllToSupabase;
6952:  autoSyncToSupabase('mw_clients');
7094:async function importErpCustomers() {
7132:function uploadClients(input) {
```

## 6. disabled 관련 코드
```
140:  if (btn) btn.disabled = true;
154:      if (btn) btn.disabled = false;
176:    if (btn) btn.disabled = false;
185:  btn.disabled = true;
222:      btn.disabled = false;
230:    btn.disabled = false;
273:      btn.disabled = false;
5876:  btn.disabled = true;
5906:    btn.disabled = false;
```

## 7. autocomplete 관련 코드
```
public/manager/app.js:2534:      html += '<td><input class="os-input os-input-text" type="search" name="search_naf_os_model" autocomplete="off" data-form-type="other" data-lpignore="true" value="'+(item.model||'')+'" placeholder="코드, 모델명 검색..." oninput="showAC(this, function(code){ onOsProductSelect('+ri+',code); })" onfocus="if(this.value) showAC(this, function(code){ onOsProductSelect('+ri+',code); })" onchange="updateOsField('+ri+',\'model\',this.value)" style="font-weight:500;min-width:160px"></td>';
public/manager/app.js:2848:        type="search" name="search_naf_sales_code" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="코드/모델 검색" style="width:120px"></td>
public/manager/app.js:6767:      input.setAttribute('autocomplete', 'off');
public/manager/index.html:85:        <input class="input" id="catalog-search" type="search" name="search_naf_catalog" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" oninput="renderCatalog()">
public/manager/index.html:176:          <input class="input" id="order-search-elec" type="search" name="search_naf_order_elec" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="코드, 순번, 모델명 검색 → 발주 추가" style="flex:1;height:34px;font-size:13px" oninput="showOrderSearchAC(this,'elec')" onkeydown="if(event.key==='Enter')addOrderSearchItem('elec')">
public/manager/index.html:204:          <input class="input" id="order-search-hand" type="search" name="search_naf_order_hand" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="코드, 순번, 모델명 검색 → 발주 추가" style="flex:1;height:34px;font-size:13px" oninput="showOrderSearchAC(this,'hand')" onkeydown="if(event.key==='Enter')addOrderSearchItem('hand')">
public/manager/index.html:232:          <input class="input" id="order-search-pack" type="search" name="search_naf_order_pack" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="코드, 순번, 모델명 검색 → 발주 추가" style="flex:1;height:34px;font-size:13px" oninput="showOrderSearchAC(this,'pack')" onkeydown="if(event.key==='Enter')addOrderSearchItem('pack')">
public/manager/index.html:399:              <input class="input" id="sheet-add-elec-ordernum" type="search" name="search_naf_sheet_elec" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="순번 입력" style="width:90px;height:32px;font-size:13px" oninput="showSheetAC(this,'elec')" onkeydown="if(event.key==='Enter')addSheetItem('elec')">
public/manager/index.html:416:              <input class="input" id="sheet-add-hand-ordernum" type="search" name="search_naf_sheet_hand" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="순번 입력" style="width:90px;height:32px;font-size:13px" oninput="showSheetAC(this,'hand')" onkeydown="if(event.key==='Enter')addSheetItem('hand')">
public/manager/index.html:433:              <input class="input" id="sheet-add-pack-ordernum" type="search" name="search_naf_sheet_pack" autocomplete="off" data-form-type="other" data-lpignore="true" placeholder="순번 입력" style="width:90px;height:32px;font-size:13px" oninput="showSheetAC(this,'pack')" onkeydown="if(event.key==='Enter')addSheetItem('pack')">
public/manager/index.html:739:      <input class="input" id="gen-search" type="search" name="search_naf_gen" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" style="max-width:400px;margin-bottom:12px" oninput="renderGenProducts()">
public/manager/index.html:758:      <input class="input" id="est-search" type="search" name="search_naf_est" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" style="max-width:500px;margin-bottom:12px"
public/manager/index.html:810:            <input class="input" id="est-client" type="search" name="search_naf_est_client" placeholder="거래처명 또는 사업자번호 검색..." autocomplete="off" data-form-type="other" data-lpignore="true"
public/manager/index.html:947:          <input class="input" id="client-search" type="search" name="search_naf_client" placeholder="상호명, 사업자번호, 대표자명, 코드 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" style="max-width:400px" oninput="renderClients()">
public/manager/index.html:1529:        <input class="input" id="cumul-item-search" type="search" name="search_naf_cumul" placeholder="모델명/코드 검색" style="max-width:300px" autocomplete="off" data-form-type="other" data-lpignore="true"
public/manager/index.html:1647:        <input class="input" id="pv2-item-search" type="search" name="search_naf_pv2" placeholder="모델명/코드 검색으로 추가" style="max-width:300px" autocomplete="off" data-form-type="other" data-lpignore="true"
public/manager/index.html:1725:          <input class="input" id="sb-set-model-input" type="search" name="search_naf_setbun" placeholder="모델명 검색 (예: FID2)" autocomplete="off" data-form-type="other" data-lpignore="true"
public/manager/index.html:1783:        <input class="input" id="picker-search" type="search" name="search_naf_picker" placeholder="코드, 모델명, 제품설명 검색..." autocomplete="off" data-form-type="other" data-lpignore="true" oninput="renderPickerList()" style="flex:1">
```

## 8. localStorage 키 목록
```
15:  var token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
23:      localStorage.removeItem('session_token');
32:    var saved = JSON.parse(localStorage.getItem('current_user') || '{}');
42:  var token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
44:  localStorage.removeItem('session_token');
46:  localStorage.removeItem('current_user');
53:function load(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
55:  localStorage.setItem(key, JSON.stringify(data));
66:function loadObj(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; } }
74:    var raw = localStorage.getItem(key);
148:      var raw = localStorage.getItem(keys[i]);
195:      var raw = localStorage.getItem(keys[i]);
234:// Supabase에서 자동 다운로드 (localStorage 비어있을 때)
248:        localStorage.setItem(item.key, typeof item.value === 'string' ? item.value : JSON.stringify(item.value));
256:    console.log('[Supabase] 로드 실패, localStorage 폴백:', error.message);
342:        var oldVal = localStorage.getItem(item.key);
344:          localStorage.setItem(item.key, newVal);
411:console.log('[PERF] DB localStorage 파싱: ' + (performance.now() - _dbStart).toFixed(0) + 'ms (products:' + DB.products.length + ', inventory:' + DB.inventory.length + ', promos:' + DB.promotions.length + ')');
1605:  localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(orderHistory));
1711:  localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(orderHistory));
1807:  localStorage.setItem(PO_HISTORY_KEY, JSON.stringify(poHistory));
1919:  localStorage.setItem(PO_HISTORY_KEY, JSON.stringify(poHistory));
2070:function savePoOrders() { localStorage.setItem('mw_po_orders', JSON.stringify(poOrderData)); }
2196:function saveSpotOrders() { localStorage.setItem('mw_spot_orders', JSON.stringify(spotOrderData)); }
2376:  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems));
2383:  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems));
2389:  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems));
2395:  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems));
2401:  localStorage.setItem('mw_sales_items', JSON.stringify(salesItems));
2440:    localStorage.setItem(OS_MONTH_KEY, JSON.stringify(onlineSalesMonth));
```

## 9. [2026-04-21] P1 변경 — 제품V2 제거 + 제품·발주 통합탭 뼈대

### 파일 라인 수 갱신
- public/manager/app.js: **27,058줄** (기존 27,006 → UI 주석 처리 + 65/35 레이아웃 교체로 증가)
- public/manager/style.css: **2,233줄** (기존 2,204 → .pc- 블록 추가)
- public/manager/index.html: **1,911줄** (기존 1,914 → 제품V2 DOM 3줄 제거)

### 탭 구조 변경
| 변경 유형 | 항목 | 비고 |
|---|---|---|
| 삭제 | `tab-import-products-v2` 빈 div (index.html:1096) | |
| 삭제 | 사이드바 "제품V2" 아이템 (index.html:98) | |
| 삭제 | 탑바 드롭다운 "제품V2" (index.html:216) | |
| 삭제 | `_windowConfig['제품V2']` | |
| 삭제 | `_tabIdMap['import-product-v2']` | |
| 삭제 | switchTab `importProductsV2` 분기 | |
| 추가 | `_removedWindowNames` 에 '제품V2' 포함 | 즐겨찾기 자동 정리 |
| **표시명만 변경** | 사이드바 "발주서V2" → "제품·발주" | 내부 윈도우키 `'발주서V2'`, 탭ID `tab-import-po-v2`, 함수 prefix `_po*`, localStorage 키 `mw_cache_import_po_v2` 전부 유지 |

### 주석 처리 블록 (P2에서 재평가 — 엑셀 파싱/검증 로직 재활용 가능성)
- 블록 1: `_ipv2Esc`, `_renderImportProductsV2`
- 블록 2: `_ipv2RenderLayout`, `_ipv2BindEvents`, `_ipv2ScheduleSearch`, `_ipv2Filtered`, `_ipv2PopulateBrandFilter`, `_ipv2RenderTable`, `_ipv2InlineEdit`, `_ipv2Delete`, `_ipv2OpenModal`, `_ipv2CloseModal`, `_ipv2FormatBaseFob`, `_ipv2FormatBaseFobDisplay`, `_ipv2SaveModal`, `_ipv2Template`, `_ipv2FormatError`, `_ipv2IsExampleRow`, `_ipv2ValidateUploadStructure`, `_ipv2Backup`, `_ipv2Upload`, `_ipv2ShowUploadResult`, `_ipv2Toast`, `_ipv2FlashRow`, `_ipv2FlashInternalCodeCell`, `_ipv2FetchByInternalCode`, `_ipv2ShowOverwriteModal`

### 유지된 제품V2 자원 (발주서V2가 의존하거나 P2 재연결 대상)
- Supabase 테이블 `import_products_v2` (데이터 보존)
- API 라우트 `/api/import-products-v2`, `/api/import-products-v2/bulk`
- JS 상태변수 `_ipv2Data`, `_ipv2Loading`, `_ipv2Filter`, `_ipv2Search`, `_ipv2Sort`, `_ipv2SearchTimer`
- JS 함수 `_ipv2FetchList()` (발주서V2 상세 화면이 브랜드 드롭다운/제품 로드에 의존)
- localStorage 캐시 키 `mw_cache_import_products_v2`
- 엑셀 유틸 `src/lib/import-v2.ts` — `importProductsV2FromExcel`

### 65/35 레이아웃 뼈대
- `_poRenderDetail()` 전면 재작성 — 기존 `_poRenderDetailHeader/Info/ProductsSection/Table/Summary` 미호출 (함수 자체는 보존, P7에서 재활용 가능)
- CSS 신규 prefix `.pc-*` (style.css 말단) — 기존 `_po*` 함수와 `po-*` 클래스는 변경 없음
- 버튼은 전부 `onclick="alert('P2~P9에서 구현 예정')"` placeholder
- 좌측 패널 65%, 우측 패널 35%, 상단 다크바 1줄 (← 목록 버튼 + PO번호 + 상태뱃지 + 날짜/브랜드/제품수)

### P2~P9 계획 요약
| Phase | 범위 |
|---|---|
| P2 | 좌측 "제품목록" 테이블 13컬럼 구현 + 주석 처리된 엑셀/템플릿/백업복원 로직 재연결 |
| P3 | 좌측 테이블 컬럼 리사이저 |
| P4 | 우측 "제품발주" 테이블 8컬럼 + 🛒 제품→발주 복사 로직 + 요약 섹션 |
| P5 | 경영박사 재고 연동 (↻ 버튼) |
| P6 | 발주확정 → 리스트 전환 |
| P7 | 발주서 리스트 화면 (기존 `_poRenderList` 재활용, 모달 형태) |
| P8 | PDF 내보내기 |
| P9 | 폴리싱/QA |

## 10. [2026-04-21] P1 후속 — 탭바 rename + 진입 상세화면 + 에러 폴백

P1 배포 후 사용자 확인에서 발견된 3건 보완.

### 변경 요약
| # | 항목 | 위치 | 비고 |
|---|---|---|---|
| a | `_windowConfig['발주서V2']`에 `displayName: '제품·발주'` 추가 | [app.js:1732](public/manager/app.js:1732) | 내부 윈도우키 `'발주서V2'` 유지, 표시만 교체 |
| b | `_renderTabBar` label 우선순위 = `cfg.displayName \|\| name` | [app.js:1909~](public/manager/app.js:1909) | 열린 창 탭바 (상단) |
| c | `_renderChromeTabBar` 동일 패턴 적용 | [app.js:64~](public/manager/app.js:64) | 크롬 탭 스타일 동기화 |
| d | `_poRenderLayout` 다크헤더 타이틀 "발주서V2" → "제품·발주" | [app.js:~21424](public/manager/app.js) | P7 리스트 모달 재활용 시 일관된 명칭 |
| e | `_poInit` 전면 재작성 — 최근 draft 재사용 → 없으면 신규 생성 → `_poRenderDetail` | [app.js:21344~](public/manager/app.js:21344) | 탭 진입 기본 화면을 상세로 전환 |
| f | `_poRenderDetail` 좌측 상단 "← 목록" 버튼 제거 | [app.js:~21654](public/manager/app.js) | 사용자 주도 복귀 버튼 차단 |
| g | 에러 폴백 UI — 상단 [오류] 배지 + 에러 배너 + ↻ 다시 시도 버튼 + 모든 액션 disabled | [app.js:~21690](public/manager/app.js) | `_poState.loadError` / `_poState.loadErrorMsg` 신설 |
| h | 우측 "발주서 리스트" onclick 문구 명시화 — "발주서 리스트 모달은 P7에서 구현 예정" | [app.js](public/manager/app.js) | P7 구현 시 실제 모달 호출로 교체 |

### 보존
- `_poRenderList`, `_poRenderLayout`, `_poRenderFilterChips`, `_poRenderEmpty`, `_poBindEvents`, `_poLoadList` — 호출 경로만 차단, 함수 본체는 **P7 재활용용 유지**
- `mw_cache_import_po_v2` localStorage 캐시 키 — P7 재활용용, 현재 `_poInit`에선 미사용
- `_poBackToList` 호출처 3곳(에러/삭제 폴백) 그대로 유지 (탭 진입 기본 경로와는 별개)

### draft 빈 누적 방지
- 진입 시 `GET /api/import-po?status=draft` → 가장 최근 draft 1건 재사용
- 없을 때만 `POST /api/import-po` 로 신규 생성
- 사용자가 탭을 나갔다 다시 들어오면 같은 draft 재로딩

### 에러 UX 계약
- 네트워크/서버 오류 시 `_poRenderDetail()`이 `_poState.loadError=true` 상태를 읽어 에러 배너만 표시
- 목록 화면으로 폴백하지 않음 (P7까지 목록 차단 원칙 유지)
- 사용자가 `↻ 다시 시도` 클릭 → `_poInit()` 재호출 → 성공 시 정상 화면 복구

### 커밋
- P1 base: `c846097`
- P1 후속: `55bdf6d`

## 11. [2026-04-21] 수입 모듈 정리 — "제품/수입계산기/인보이스" 3개 메뉴 삭제

구버전 수입 메뉴 3종을 UI에서 제거. 각 메뉴의 기능은 이미 신규 모듈로 이관됨.

### 대체 매핑
| 삭제 메뉴 | 대체처 | 상태 |
|---|---|---|
| "제품" | 제품·발주 탭 좌측 (mw_gen_products 참조) | P2에서 구현 예정 |
| "수입계산기" | 수입건V2 원가계산 (통합 완료) | 기능 중복 제거 |
| "인보이스" | 인보이스V2 (구버전) | 대체 완료 |

### 최종 수입 워크플로우
제품·발주(PO) → 인보이스V2(선적) → 수입건V2(수입묶음 + 원가확정) → 경영박사(매입전표)

### 남은 수입 탭 (3개)
- **제품·발주** (`tab-import-po-v2`) — displayName '제품·발주', 내부 키 '발주서V2' 유지
- **인보이스V2** (`tab-import-invoice-v2`)
- **수입건V2** (`tab-import-batch-v2`)

### 변경 요약
| # | 항목 | 위치 | 비고 |
|---|---|---|---|
| a | `_DEPRECATED_KEYS` 전역 상수 추가 | app.js 상단 | `['mw_import_calcs', 'mw_import_items']` |
| b | `cleanupDeprecatedKeys` IIFE 추가 | `_windowConfig` 직후 | 페이지 로드 시 잔존 localStorage 정리 |
| c | sync 다운로드 3경로에 deprecated key 필터 추가 | `loadFromSupabase`, 배경 sync, Realtime | app_data 다운받아도 localStorage에 재생성 안 됨 |
| d | 사이드바/탑바 드롭다운/빈 div 9줄 삭제 | index.html | |
| e | 아이콘 오버라이드 3줄 삭제 | app.js `_windowIconOverrides` | '제품'/'수입계산기'/'인보이스' |
| f | `_windowConfig` 3개 엔트리 삭제 + `_removedWindowNames` 3개 추가 | app.js | |
| g | `_tabIdMap` 3개 엔트리 + `switchTab` 3개 분기 삭제 | app.js | |
| h | `_import*` 섹션 약 961줄 주석 처리 (`/* DELETED 2026-04-21 */`) | app.js:19976~20936 | 전체 self-contained, 외부 호출 0건 |
| i | `.imc-*` CSS 약 170줄 주석 처리 | style.css:952~1123 | 내부 주석 10개 제거 후 전체 래핑 |

### Supabase 정책
- 테이블 **DROP 절대 금지** ✅ 준수
- `app_data['mw_import_calcs']` row **유지**(1.28 KB, 2026-04-12 마지막 수정)
- 복원 필요 시 git history + 이 섹션 참조

### 삭제된 CSS 내부 주석 (style.css 952~1123 `.imc-*` 블록)
복원 시 참고 (원본 주석 그대로):
- 라인 952: `/* ======================== 수입계산기 (Import Calculator) ======================== */`
- 라인 965: `/* wildcard rule(line 221)이 flex:1 + overflow:hidden 부여 → 그대로 수용, 스크롤은 .imc-scroll에서 처리 */`
- 라인 1054: `/* 계산서 선택 바 */`
- 라인 1076: `/* 토글 */`
- 라인 1088: `/* 송금 아이템 */`
- 라인 1097: `/* 할인율 strip 4열 */`
- 라인 1104: `/* 스크롤바 */`
- 라인 1109: `/* 인보이스 목록 행 */`
- 라인 1114: `/* 통계 바 (상세 패널) */`
- 라인 1122: `/* 제품 카드 (상세 패널) */`

### 의존성 검증 요약 (조사 결과)
- `_import*` 함수 풀은 완전 self-contained — 19976~20936 범위 밖 호출 0건
- 수입계산기 `_importCompute` 등 계산 로직은 수입건V2(`_ipbat2*`)에서 호출되지 않음 — 별도 구현
- src/ (Next.js) 내 참조 0건

### 커밋
- P1 base: `c846097`
- P1 후속: `55bdf6d`
- 수입 모듈 정리: (이번 커밋)
