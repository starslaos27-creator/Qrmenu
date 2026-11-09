(() => {
  const receiptPrefix = 'shopqr.receipt-header.';
  const namePrefix = 'shopqr.sidebar-brand.';
  const currentBrandKey = 'shopqr.sidebar-brand.current';
  const validLogo = value => typeof value === 'string' && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || /^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/[\w./?&=%+-]+$/.test(value));
  const logoByRestaurant = new Map();
  const nameByRestaurant = new Map();

  const activeRestaurantId = () => document.querySelector('.manager-navigation')?.dataset.restaurantId || null;

  function applyLogo(logo, sidebar = document.querySelector('.sidebar-shell'), restaurantId = activeRestaurantId()) {
    const value = validLogo(logo) ? logo : '';
    if (restaurantId) logoByRestaurant.set(restaurantId, value);
    if (!sidebar) return false;
    if (value) {
      sidebar.style.setProperty('--sidebar-logo', `url("${value}")`);
      sidebar.setAttribute('data-has-custom-logo', 'true');
    } else {
      sidebar.style.removeProperty('--sidebar-logo');
      sidebar.removeAttribute('data-has-custom-logo');
    }
    return true;
  }

  function loadSavedLogo(sidebar = document.querySelector('.sidebar-shell')) {
    const restaurantId = activeRestaurantId();
    if (restaurantId && logoByRestaurant.has(restaurantId)) {
      return applyLogo(logoByRestaurant.get(restaurantId), sidebar, restaurantId);
    }
    if (restaurantId) {
      try {
        const raw = localStorage.getItem(receiptPrefix + restaurantId);
        if (raw !== null) {
          const settings = JSON.parse(raw);
          if (Object.prototype.hasOwnProperty.call(settings, 'logo')) {
            if (settings.logo === '') return applyLogo('', sidebar, restaurantId);
            if (validLogo(settings.logo)) return applyLogo(settings.logo, sidebar, restaurantId);
          }
        }
      } catch {}
    }
    try {
      const saved = JSON.parse(localStorage.getItem(currentBrandKey) || 'null');
      if (saved && (!restaurantId || saved.restaurantId === restaurantId) && validLogo(saved.logo)) {
        return applyLogo(saved.logo, sidebar, restaurantId);
      }
    } catch {}
    return false;
  }

  function rememberVisibleLogo() {
    const restaurantId = activeRestaurantId();
    const sidebar = document.querySelector('.sidebar-shell');
    if (!restaurantId || !sidebar) return;
    const cssUrl = value => value.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || '';
    const header = sidebar.firstElementChild;
    const logo = [
      cssUrl(sidebar.style.getPropertyValue('--sidebar-logo')),
      header?.querySelector('img')?.currentSrc,
      cssUrl(header ? getComputedStyle(header, '::before').backgroundImage : ''),
    ].find(value => validLogo(value)) || '';
    if (!validLogo(logo)) return;
    logoByRestaurant.set(restaurantId, logo);
    try {
      const receiptKey = receiptPrefix + restaurantId;
      const settings = JSON.parse(localStorage.getItem(receiptKey) || '{}');
      localStorage.setItem(receiptKey, JSON.stringify({ ...settings, logo }));
      const brand = JSON.parse(localStorage.getItem(currentBrandKey) || '{}');
      localStorage.setItem(currentBrandKey, JSON.stringify({ ...brand, restaurantId, logo }));
    } catch {}
  }

  function applyName(sidebar = document.querySelector('.sidebar-shell')) {
    const restaurantId = activeRestaurantId();
    if (!restaurantId || !sidebar) return;
    let name = nameByRestaurant.get(restaurantId);
    if (name === undefined) {
      try {
        const saved = JSON.parse(localStorage.getItem(namePrefix + restaurantId) || 'null');
        name = typeof saved?.name === 'string' && saved.name.trim() ? saved.name.trim() : null;
      } catch {
        name = null;
      }
      if (name) nameByRestaurant.set(restaurantId, name);
    }
    if (!name) {
      try {
        const saved = JSON.parse(localStorage.getItem(currentBrandKey) || 'null');
        if (saved?.restaurantId === restaurantId && typeof saved.name === 'string' && saved.name.trim()) name = saved.name.trim();
      } catch {}
    }
    if (!name) return;
    const title = sidebar.querySelector(':scope > div:nth-child(2) > p:first-child');
    if (title && title.textContent !== name) title.textContent = name;
  }

  window.addEventListener('shopqr:restaurant-logo-updated', event => {
    const activeId = activeRestaurantId();
    const restaurantId = event.detail?.restaurantId || activeId;
    if (restaurantId && activeId && restaurantId !== activeId) return;
    if (restaurantId && event.detail && Object.prototype.hasOwnProperty.call(event.detail, 'logo')) {
      const logo = validLogo(event.detail.logo) ? event.detail.logo : '';
      logoByRestaurant.set(restaurantId, logo);
      try {
        const key = receiptPrefix + restaurantId;
        const settings = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...settings, logo }));
        const brand = JSON.parse(localStorage.getItem(currentBrandKey) || '{}');
        localStorage.setItem(currentBrandKey, JSON.stringify({ ...brand, restaurantId, logo }));
      } catch {}
      applyLogo(logo, undefined, restaurantId);
    } else {
      if (restaurantId) logoByRestaurant.delete(restaurantId);
      loadSavedLogo();
    }
  });

  window.addEventListener('shopqr:restaurant-name-updated', event => {
    const name = event.detail?.name;
    const activeId = activeRestaurantId();
    const restaurantId = event.detail?.restaurantId || activeId;
    if (!restaurantId || (activeId && restaurantId !== activeId) || typeof name !== 'string' || !name.trim()) return;
    const cleanName = name.trim();
    nameByRestaurant.set(restaurantId, cleanName);
    try {
      localStorage.setItem(namePrefix + restaurantId, JSON.stringify({ name: cleanName }));
      const brand = JSON.parse(localStorage.getItem(currentBrandKey) || '{}');
      localStorage.setItem(currentBrandKey, JSON.stringify({ ...brand, restaurantId, name: cleanName }));
    } catch {}
    applyName();
  });

  window.addEventListener('storage', event => {
    if (event.key?.startsWith(receiptPrefix)) {
      const restaurantId = event.key.slice(receiptPrefix.length);
      try {
        const settings = JSON.parse(event.newValue || '{}');
        if (Object.prototype.hasOwnProperty.call(settings, 'logo')) logoByRestaurant.set(restaurantId, validLogo(settings.logo) ? settings.logo : '');
        else logoByRestaurant.delete(restaurantId);
      } catch {
        logoByRestaurant.delete(restaurantId);
      }
      if (restaurantId === activeRestaurantId()) loadSavedLogo();
    }
    if (event.key?.startsWith(namePrefix)) {
      const restaurantId = event.key.slice(namePrefix.length);
      try {
        const saved = JSON.parse(event.newValue || 'null');
        if (typeof saved?.name === 'string' && saved.name.trim()) nameByRestaurant.set(restaurantId, saved.name.trim());
        else nameByRestaurant.delete(restaurantId);
      } catch {
        nameByRestaurant.delete(restaurantId);
      }
      if (restaurantId === activeRestaurantId()) applyName();
    }
  });

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.data?.type !== 'shopqr-sync-route') return;
    requestAnimationFrame(() => {
      const sidebar = document.querySelector('.sidebar-shell');
      applyName(sidebar);
      loadSavedLogo(sidebar);
    });
  });

  window.addEventListener('shopqr:before-dashboard-navigation', rememberVisibleLogo);

  let currentSidebar = null;
  let currentRestaurantId = null;
  const observer = new MutationObserver(() => {
    const sidebar = document.querySelector('.sidebar-shell');
    if (!sidebar) { currentSidebar = null; currentRestaurantId = null; return; }
    applyName(sidebar);
    const restaurantId = activeRestaurantId();
    if (sidebar === currentSidebar && restaurantId === currentRestaurantId) {
      if (!sidebar.hasAttribute('data-has-custom-logo') && restaurantId && logoByRestaurant.has(restaurantId)) {
        loadSavedLogo(sidebar);
      }
      return;
    }
    currentSidebar = sidebar;
    currentRestaurantId = restaurantId;
    loadSavedLogo(sidebar);
  });

  const start = () => {
    const sidebar = document.querySelector('.sidebar-shell');
    if (sidebar) {
      currentSidebar = sidebar;
      currentRestaurantId = activeRestaurantId();
      applyName(sidebar);
      loadSavedLogo(sidebar);
    }
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-restaurant-id', 'data-has-custom-logo'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
