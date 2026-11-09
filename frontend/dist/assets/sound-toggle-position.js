(() => {
  let source = null;
  let group = null;
  let floating = null;
  let clone = null;

  function sync() {
const current = [...document.querySelectorAll('.shopqr-sound-toggle')]
      .find(button => !button.closest('.shopqr-sound-floating'));
    if (!current) return;
    const profile = document.querySelector('.ro-profile-wrap, .global-profile');

    if (!profile) {
      if (current === source) source.style.display = '';
      return;
    }
    if (current !== source) {
      source = current;
      source.style.display = 'none';
    }

    if (group !== profile) {
      group = profile;
      group.classList.add('shopqr-profile-sound-group');
    }
    if (!floating) {
      floating = document.createElement('span');
      floating.className = 'shopqr-sound-floating';
      clone = document.createElement('button');
      clone.type = 'button';
      clone.addEventListener('click', () => source?.click());
      floating.append(clone);
    }
    if (floating.parentElement !== profile) {
      profile.insertBefore(floating, profile.querySelector('.ro-profile, .global-profile-trigger') || profile.firstChild);
    }

    if (!clone) return;
    for (const name of ['class', 'title', 'aria-label']) {
      const value = source.getAttribute(name);
      if (clone.getAttribute(name) !== value) {
        if (value === null) clone.removeAttribute(name);
        else clone.setAttribute(name, value);
      }
    }
    if (clone.innerHTML !== source.innerHTML) clone.innerHTML = source.innerHTML;
  }

  const start = () => {
    sync();
    new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'title', 'aria-label'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
