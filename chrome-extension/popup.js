// ======================== 대한종합상사 자동발주 — Popup ========================

document.addEventListener('DOMContentLoaded', async function() {
  var statusEl = document.getElementById('status');
  var pendingEl = document.getElementById('pending-order');
  var pendingInfo = document.getElementById('pending-info');

  // 저장된 로그인 정보 로드
  var data = await chrome.storage.local.get(['ttiId', 'ttiPw', 'pendingOrder']);

  if (data.ttiId) document.getElementById('ttiId').value = data.ttiId;
  if (data.ttiPw) document.getElementById('ttiPw').value = data.ttiPw;

  // 로그인 정보 상태
  if (!data.ttiId || !data.ttiPw) {
    statusEl.textContent = 'TTI 로그인 정보를 입력해주세요';
    statusEl.className = 'status pending';
  }

  // 대기 중인 주문 표시
  if (data.pendingOrder) {
    pendingEl.style.display = 'block';
    var order = data.pendingOrder;
    pendingInfo.textContent = order.items.length + '건 · ' + order.orderType + ' · ' + new Date(order.createdAt).toLocaleString('ko-KR');
  }

  // 저장 버튼
  document.getElementById('saveBtn').addEventListener('click', async function() {
    var ttiId = document.getElementById('ttiId').value.trim();
    var ttiPw = document.getElementById('ttiPw').value.trim();

    if (!ttiId || !ttiPw) {
      statusEl.textContent = 'ID와 비밀번호를 모두 입력해주세요';
      statusEl.className = 'status error';
      return;
    }

    await chrome.storage.local.set({ ttiId: ttiId, ttiPw: ttiPw });
    statusEl.textContent = '✓ 저장 완료';
    statusEl.className = 'status ok';

    setTimeout(function() {
      statusEl.textContent = '확장 프로그램 정상 작동 중';
    }, 2000);
  });
});
