(() => {
  if (window.__shopqrCustomerMenuControls) return;
  window.__shopqrCustomerMenuControls = true;

  function keepOneActionStack() {
    const stacks = document.querySelectorAll('.customer-menu-page .menu-service-actions');
    stacks.forEach((stack, index) => {
      if (index > 0) stack.style.setProperty('display', 'none', 'important');
      else stack.style.removeProperty('display');
    });
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      keepOneActionStack();
    });
  });
  observer.observe(document.documentElement, {childList:true, subtree:true});
  keepOneActionStack();
})();
