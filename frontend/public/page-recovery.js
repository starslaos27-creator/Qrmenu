(() => {
  const retryKey = 'shopqr.recovery-auto-retry';
  function retryOnce() {
    try {
      if (sessionStorage.getItem(retryKey) === '1') return false;
      sessionStorage.setItem(retryKey, '1');
      window.location.reload();
      return true;
    } catch { return false; }
  }
  window.addEventListener('load', () => window.setTimeout(() => {
    if (!document.getElementById('shopqr-recovery')) {
      try { sessionStorage.removeItem(retryKey); } catch {}
    }
  }, 10000), { once: true });
  function showRecovery(message) {
    if (document.getElementById('shopqr-recovery')) return;
    const card = document.createElement('main');
    card.id = 'shopqr-recovery';
    card.setAttribute('role', 'alert');
    card.style.cssText = 'position:fixed;inset:0;z-index:9999;min-height:100vh;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:24px;background:#f2e8d8;color:#174a34;font-family:system-ui,sans-serif;text-align:center';
    const panel = document.createElement('section');
    panel.style.cssText = 'width:min(100%,420px);box-sizing:border-box;padding:28px;border:1px solid #dfcfb2;border-radius:20px;background:#fffaf1;box-shadow:0 8px 28px #174a3418';
    const title = document.createElement('h1');
    title.textContent = 'เปิดหน้าเว็บไม่สำเร็จ';
    title.style.cssText = 'margin:0 0 10px;font-size:20px';
    const detail = document.createElement('p');
    detail.textContent = message;
    detail.style.cssText = 'margin:0 0 20px;color:#756247;line-height:1.6';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'ลองโหลดอีกครั้ง';
    retry.style.cssText = 'padding:12px 22px;border:0;border-radius:12px;background:#174a34;color:#fff;font:inherit;font-weight:600;cursor:pointer';
    retry.addEventListener('click', () => window.location.reload());
    panel.append(title, detail, retry);
    card.append(panel);
    document.body.append(card);
  }

  window.addEventListener('error', event => {
    const target = event.target;
    // Images and optional styles must not block the restaurant application.
    if (target && target !== window) {
      if (target.tagName !== 'SCRIPT' || target.defer) return;
      console.error('ShopQR script failed:', target.src);
      if (retryOnce()) return;
      showRecovery('โหลดหน้าเว็บไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
      return;
    }
    console.error('ShopQR page error:', event.error || event.message);
    if (retryOnce()) return;
    showRecovery('หน้าเว็บเกิดข้อผิดพลาด กรุณาลองโหลดอีกครั้ง');
  }, true);

  window.addEventListener('unhandledrejection', event => {
    console.error('ShopQR unhandled rejection:', event.reason);
    // Failed background requests should be handled by their own page controls.
    // Only a failed application module requires a full-page recovery screen.
    const message = String(event.reason?.message || event.reason || '');
    if (/Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message)) {
    if (retryOnce()) return;
      showRecovery('โหลดหน้าเว็บไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
    }
  });

  window.setTimeout(() => {
    if (!document.getElementById('root')?.childElementCount) {
      showRecovery('หน้าเว็บใช้เวลาโหลดนานเกินไป กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
    }
  }, 15000);
})();
