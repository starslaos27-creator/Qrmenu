// All connected views render the saved menu description from the API.
export function menuDetails(jsx, menu) {
  if (!menu?.description?.trim()) return null;
  return jsx.jsxs('span', {
    className: 'menu-shared-description',
    style: {display: 'block', position: 'relative', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '12px', fontWeight: 400, lineHeight: 1.6, color: '#756247', marginTop: '5px', marginBottom: '5px'},
    children: [
      jsx.jsx('span', {
        className: 'menu-description-preview',
        style: {display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'},
        children: menu.description
      }),
      jsx.jsx('button', {
        type: 'button', className: 'menu-description-open', hidden: true,
        style: {position: 'absolute', right: 0, bottom: 0, color: '#17613f', fontSize: '12px', fontWeight: 600, padding: '0 0 0 4px', textDecoration: 'underline', background: '#fffaf1', border: 0, cursor: 'pointer', whiteSpace: 'nowrap'},
        'aria-haspopup': 'dialog',
        onClick: event => { event.preventDefault(); event.stopPropagation(); openMenuDescription(menu, event.currentTarget); },
        children: '\u0e2d\u0e48\u0e32\u0e19\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21'
      })
    ],
    ref: node => {
      if (!node) return;
      requestAnimationFrame(() => {
        const preview = node.querySelector('.menu-description-preview');
        const button = node.querySelector('.menu-description-open');
        if (!preview || !button || !document.body) return;
        const style = getComputedStyle(preview);
        const probe = document.createElement('span');
        probe.textContent = menu.description;
        probe.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;display:block;white-space:pre-wrap;overflow-wrap:anywhere;box-sizing:border-box;margin:0;padding:0;border:0;';
        probe.style.width = preview.clientWidth + 'px';
        probe.style.font = style.font;
        probe.style.lineHeight = style.lineHeight;
        probe.style.letterSpacing = style.letterSpacing;
        document.body.appendChild(probe);
        button.hidden = probe.scrollHeight <= preview.clientHeight + 2;
        probe.remove();
      });
    }
  });
}

function openMenuDescription(menu, trigger) {
  const dialog = document.createElement('dialog');
  dialog.className = 'menu-description-dialog';
  dialog.setAttribute('aria-label', menu.name || '\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2d\u0e32\u0e2b\u0e32\u0e23');
  dialog.style.cssText = 'width:min(520px,calc(100vw - 32px));max-height:80dvh;margin:auto;padding:20px;border:1px solid #dfcfb2;border-radius:18px;background:#fffaf1;color:#174a34;overflow:auto;box-sizing:border-box;box-shadow:0 16px 60px #0004;';
  const title = document.createElement('h2');
  title.textContent = menu.name || '\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2d\u0e32\u0e2b\u0e32\u0e23';
  title.style.cssText = 'font-size:18px;font-weight:700;margin:0 0 12px;overflow-wrap:anywhere;';
  const description = document.createElement('p');
  description.textContent = menu.description;
  description.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-size:14px;margin:0 0 16px;';
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = '\u0e1b\u0e34\u0e14';
  close.style.cssText = 'padding:10px 20px;border:0;border-radius:10px;background:#17613f;color:white;cursor:pointer;';
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => { dialog.remove(); if (trigger.isConnected) trigger.focus(); }, {once:true});
  dialog.append(title, description, close);
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}

// Refresh shared menu fields without reloading the page or clearing carts/forms.
export function watchMenuDetails(fetchData, onData) {
  let stopped = false, pending = false;
  async function refresh() {
    if (stopped || pending || document.hidden) return;
    pending = true;
    try { const data = await fetchData(); if (!stopped) onData(data); }
    catch { /* Keep the last successfully loaded menu while offline. */ }
    finally { pending = false; }
  }
  const timer = window.setInterval(refresh, 10000);
  window.addEventListener('focus', refresh);
  return () => { stopped = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
}
