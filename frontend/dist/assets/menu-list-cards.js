(() => {
  let menuView = 'grid';
  function setMenuView(panel, view) {
    menuView = view === 'list' ? 'list' : 'grid';
    panel.dataset.menuView = menuView;
    panel.querySelectorAll('[data-menu-view-button]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.menuViewButton === menuView));
    });
  }
  function applyMenuCardLayout() {
    if (location.pathname !== '/dashboard/menu') return;

    const form = document.getElementById('menu-add-form');
    if (!form) return;

    const root = form.closest('.grid');
    const listPanel = root?.lastElementChild;
    if (!listPanel) return;

    const editor = root.firstElementChild === listPanel ? null : root.firstElementChild;
    const addView = new URLSearchParams(location.search).get('view') === 'add';
    root.classList.toggle('menu-add-overlay-open', addView);
    editor?.classList.add('menu-add-editor');
    if (editor && !editor.querySelector('.menu-add-overlay-close')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'menu-add-overlay-close';
      close.setAttribute('aria-label', 'ปิดหน้าต่างเพิ่มเมนู');
      close.textContent = '×';
      close.onclick = () => {
        history.pushState({}, '', '/dashboard/menu');
        window.dispatchEvent(new PopStateEvent('popstate'));
        applyMenuCardLayout();
      };
      editor.prepend(close);
    }

    listPanel.classList.add('menu-card-list-panel');
    listPanel.dataset.menuView = menuView;
    listPanel.querySelectorAll('section > ul > li').forEach(card => {
      card.classList.add('menu-card-list-item');
      card.firstElementChild?.classList.add('menu-card-list-content');


    });

    const originalSearch = listPanel.querySelector('input[type="text"], input[type="search"]');
    const originalFilters = originalSearch?.closest('.grid') || originalSearch?.parentElement;
    const originalHeader = originalFilters?.previousElementSibling;
    const categorySelect = originalFilters?.querySelector('select') || listPanel.querySelector('select');
    if (!originalSearch || !categorySelect) {
      if (!listPanel.querySelector('.menu-list-toolbar')) {
        const toolbar = document.createElement('section');
        toolbar.className = 'menu-list-toolbar';
        toolbar.dataset.emptyFallback = 'true';
        toolbar.innerHTML = `
          <div class="menu-list-toolbar-title">
            <div><span>MENU MANAGEMENT</span><h2>จัดการเมนูอาหาร</h2><p>รายการเมนูของร้าน</p></div>
            <div class="menu-list-toolbar-actions">
              <div class="menu-view-switch" role="group" aria-label="มุมมองรายการสินค้า">
                <button type="button" data-menu-view-button="list" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/></svg>รายการ</button>
                <button type="button" data-menu-view-button="grid" aria-pressed="true"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>รูปภาพ</button>
              </div>
              <button type="button" class="menu-list-add">＋ เพิ่มสินค้า</button>
            </div>
          </div>`;
        toolbar.querySelectorAll('[data-menu-view-button]').forEach(button => {
          button.onclick = () => {
            setMenuView(listPanel, button.dataset.menuViewButton);
            try { localStorage.setItem('shopqr-menu-view', menuView); } catch {}
          };
        });
        toolbar.querySelector('.menu-list-add').onclick = () => {
          history.pushState({}, '', '/dashboard/menu?view=add');
          window.dispatchEvent(new PopStateEvent('popstate'));
          applyMenuCardLayout();
          form.querySelector('input')?.focus({ preventScroll: true });
        };
        listPanel.prepend(toolbar);
      }
      setMenuView(listPanel, menuView);
      return;
    }

    originalHeader?.classList.add('menu-original-list-header');
    originalFilters?.classList.add('menu-original-list-filters');

    const existingToolbar = listPanel.querySelector('.menu-list-toolbar');
    if (existingToolbar?.dataset.emptyFallback) existingToolbar.remove();
    if (!listPanel.querySelector('.menu-list-toolbar')) {
      const toolbar = document.createElement('section');
      toolbar.className = 'menu-list-toolbar';
      toolbar.innerHTML = `
        <div class="menu-list-toolbar-title">
          <div><span>📦 STOCK MANAGEMENT</span><h2>สต็อกสินค้า</h2><p>เพิ่มสินค้า รับเข้า และตรวจยอดสต็อกได้ในหน้าเดียว</p></div>
          <div class="menu-list-toolbar-actions">
            <div class="menu-view-switch" role="group" aria-label="มุมมองรายการสินค้า">
              <button type="button" data-menu-view-button="list" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/></svg>รายการ</button>
              <button type="button" data-menu-view-button="grid" aria-pressed="true"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>รูปภาพ</button>
            </div>
            <button type="button" class="menu-list-adjust" aria-haspopup="dialog">ปรับเปลี่ยนสต็อก</button>
            <button type="button" class="menu-list-add">＋ เพิ่มสินค้าใหม่</button>
          </div>
        </div>
        <div class="menu-list-toolbar-filters">
          <label><span aria-hidden="true">⌕</span><input type="search" placeholder="ค้นหาสินค้า..." aria-label="ค้นหาสินค้า"></label>
          <select class="menu-list-category-select" aria-label="เลือกหมวดหมู่"></select>
          <button type="button" class="menu-list-search-button">ค้นหา</button>
          <div class="menu-list-category-chips"></div>
        </div>`;
      const chipContainer = toolbar.querySelector('.menu-list-category-chips');
      toolbar.querySelectorAll('[data-menu-view-button]').forEach(button => {
        button.onclick = () => {
          setMenuView(listPanel, button.dataset.menuViewButton);
          try { localStorage.setItem('shopqr-menu-view', menuView); } catch {}
        };
      });
      Array.from(categorySelect.options).slice(0, 8).forEach(option => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.dataset.category = option.value;
        chip.textContent = option.textContent;
        chipContainer.append(chip);
      });
      const search = toolbar.querySelector('input');
      search.value = originalSearch.value;
      search.addEventListener('input', () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(originalSearch, search.value);
        originalSearch.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const picker = toolbar.querySelector('.menu-list-category-select');
      picker.addEventListener('change', () => {
        categorySelect.value = picker.value;
        categorySelect.dispatchEvent(new Event('change', {bubbles:true}));
      });
      const runSearch = () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(originalSearch, search.value);
        originalSearch.dispatchEvent(new Event('input', {bubbles:true}));
        categorySelect.value = picker.value;
        categorySelect.dispatchEvent(new Event('change', {bubbles:true}));
      };
      toolbar.querySelector('.menu-list-search-button').onclick = runSearch;
      search.addEventListener('keydown', event => {
        if (event.key === 'Enter') {event.preventDefault(); runSearch();}
      });
      toolbar.querySelector('.menu-list-adjust').onclick = () => {
        window.dispatchEvent(new Event('shopqr:adjust-menu-stock'));
      };
      toolbar.querySelector('.menu-list-add').onclick = () => {
        history.pushState({}, '', '/dashboard/menu?view=add');
        window.dispatchEvent(new PopStateEvent('popstate'));
        applyMenuCardLayout();
        form.querySelector('input')?.focus({ preventScroll: true });
      };
      toolbar.querySelectorAll('[data-category]').forEach(chip => {
        chip.classList.toggle('is-active', chip.dataset.category === categorySelect.value);
        chip.onclick = () => {
          categorySelect.value = chip.dataset.category;
          categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
          toolbar.querySelectorAll('[data-category]').forEach(item => item.classList.toggle('is-active', item === chip));
        };
      });
      listPanel.prepend(toolbar);
    }
    const toolbar = listPanel.querySelector('.menu-list-toolbar');
    setMenuView(listPanel, menuView);
    const picker = toolbar.querySelector('.menu-list-category-select');
    const options = Array.from(categorySelect.options);
    const signature = JSON.stringify(options.map(option => [option.value, option.textContent]));
    if (picker.dataset.options !== signature) {
      picker.dataset.options = signature;
      picker.replaceChildren(...options.map(option => {
        const copy = option.cloneNode(true);
        if (copy.value === 'all') copy.textContent = 'เลือกหมวดหมู่ · ทั้งหมด';
        return copy;
      }));
      const chips = toolbar.querySelector('.menu-list-category-chips');
      chips.replaceChildren(...options.slice(0,8).map(option => {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.dataset.category = option.value; chip.textContent = option.textContent;
        chip.onclick = () => {
          categorySelect.value = option.value;
          categorySelect.dispatchEvent(new Event('change', {bubbles:true}));
        };
        return chip;
      }));
    }
    picker.value = categorySelect.value;
    toolbar.querySelector('input[type="search"]').value = originalSearch.value;
    toolbar.querySelectorAll('[data-category]').forEach(chip => {
      chip.classList.toggle('is-active', chip.dataset.category === categorySelect.value);
      chip.setAttribute('aria-pressed', String(chip.dataset.category === categorySelect.value));
    });
  }

  document.addEventListener('DOMContentLoaded', applyMenuCardLayout);
  new MutationObserver(applyMenuCardLayout).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener('popstate', applyMenuCardLayout);
})();
