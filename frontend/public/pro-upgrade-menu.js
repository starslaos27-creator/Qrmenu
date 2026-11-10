(() => {
  let expiresAt = 0;
  let trialActive = false;
  let serverTime = 0;
  let synchronizedAt = 0;
  let syncing = false;
  let lastSync = 0;
  function updateCountdown() {
    const link = document.querySelector('.shopqr-header-upgrade');
    if (!link) return;
    const remaining = expiresAt - (serverTime + performance.now() - synchronizedAt);
    let label = '⭐ อัปเกรดโปร';
    if (remaining > 0) {
      const seconds = Math.floor(remaining / 1000);
      const days = Math.floor(seconds / 86400);
      const clock = [Math.floor(seconds % 86400 / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
      label = `⭐ ${trialActive ? 'ทดลองใช้ฟรี' : 'โปรเหลือ'} ${days} วัน ${clock}`;
    }
    if (link.textContent !== label) link.textContent = label;
    link.title = remaining > 0 ? `${trialActive ? 'ทดลองโปรฟรีหมดอายุ' : 'ครบกำหนด'} ${new Date(expiresAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}` : 'เลือกแพ็กเกจโปร';
  }
  async function api(path) {
    const send = () => {
      const headers = new Headers();
      try {
        const token = localStorage.getItem('shopqr_access_token');
        if (token) headers.set('Authorization', `Bearer ${token}`);
      } catch {}
      return fetch(path, { headers, credentials: 'include' });
    };
    let response = await send();
    if (response.status === 401) {
      const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      const session = await refreshed.json().catch(() => null);
      if (refreshed.ok && session?.accessToken) {
        try { localStorage.setItem('shopqr_access_token', session.accessToken); } catch {}
        response = await send();
      }
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `HTTP_${response.status}`);
    return data;
  }

  async function syncCountdown() {
    if (syncing || !document.querySelector('.shopqr-header-upgrade') || Date.now() - lastSync < 10000) return;
    syncing = true; lastSync = Date.now();
    try {
      // Reuse the authenticated API client already loaded by the legacy application.
      const session = await api('/api/auth/me');
      if (!session.membership?.restaurant_id) { expiresAt = 0; trialActive = false; updateCountdown(); return; }
      const data = await api(`/api/restaurants/${session.membership.restaurant_id}/pro-countdown`);
      expiresAt = Date.parse(data.expires_at) || 0;
      trialActive = data.trial_active === true;
      serverTime = Date.parse(data.server_now);
      synchronizedAt = performance.now();
      updateCountdown();
    } catch { /* Keep the last confirmed deadline while offline. */ }
    finally { syncing = false; }
  }
  function addHeaderUpgrade() {
    const actions = document.querySelector('.ro-header .ro-actions');
    if (!actions || actions.querySelector('.shopqr-header-upgrade')) return;
    const link = document.createElement('a');
    link.href = '/dashboard/upgrade';
    link.className = 'shopqr-header-upgrade';
    link.textContent = '⭐ อัปเกรดโปร';
    actions.insertBefore(link, actions.firstChild);
    updateCountdown();
    void syncCountdown();
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; addHeaderUpgrade(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  addHeaderUpgrade();
  window.setInterval(updateCountdown, 1000);
  window.setInterval(() => void syncCountdown(), 15000);
  window.addEventListener('focus', () => void syncCountdown());
  document.addEventListener('click', event => {
    const item = event.target instanceof Element ? event.target.closest('a,button,[role="menuitem"]') : null;
    if (!item || !(item.classList.contains('shopqr-header-upgrade') || item.classList.contains('ro-profile-upgrade') || item.textContent.trim() === 'อัปเกรดโปร' || item.textContent.trim() === '⭐ อัปเกรดโปร')) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = window.parent !== window ? window.parent : window;
    target.location.assign('/dashboard/upgrade');
  }, true);
})();
