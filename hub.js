(() => {
  const hub = document.getElementById('hubView');
  const checker = document.getElementById('checkerView');
  const open = document.getElementById('openChecker');
  const back = document.getElementById('backHome');
  // Keep the light in the button's own coordinate system, even during a slide.
  document.querySelectorAll('.project-link, .clear-all-float-btn').forEach(link => {
    link.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const bounds = link.getBoundingClientRect();
      link.style.setProperty('--glow-x', `${event.clientX - bounds.left}px`);
      link.style.setProperty('--glow-y', `${event.clientY - bounds.top}px`);
      link.classList.add('pointer-lit');
    });
    link.addEventListener('pointerleave', () => link.classList.remove('pointer-lit'));
    link.addEventListener('focus', () => {
      if (!link.classList.contains('pointer-lit')) {
        link.style.removeProperty('--glow-x');
        link.style.removeProperty('--glow-y');
      }
    });
  });
  let focusTimer;
  function showChecker(active, focus = true) {
    clearTimeout(focusTimer);
    document.body.classList.toggle('checker-open', active);
    hub.inert = active;
    checker.inert = !active;
    hub.setAttribute('aria-hidden', String(active));
    checker.setAttribute('aria-hidden', String(!active));
    back.hidden = !active;
    document.getElementById('floatingContainer').inert = !active;
    document.getElementById('clearAllFloating').inert = !active;
    document.title = active ? 'OSRS Price Checker · x0XP' : 'x0XP';
    document.querySelectorAll('.help-box').forEach(panel => panel.classList.remove('visible'));
    helpVisible = false;
    changelogVisible = false;
    if (focus) focusTimer = setTimeout(() => (active ? document.getElementById('itemSearch') : open).focus({preventScroll: true}), 650);
  }
  async function readRoute(focus = false) {
    const route = location.hash;
    showChecker(/^#(?:checker|item=|boss=)/.test(route), focus);
    await trackerReady;
    if (location.hash !== route) return;
    const params = parseHash(route);
    const name = params.item || params.boss;
    if (name && document.getElementById('priceDisplay').dataset.name !== name) getPrice(name, true);
  }
  open.addEventListener('click', () => {
    history.pushState({checker: true}, '', '#checker');
    showChecker(true);
  });
  back.addEventListener('click', () => {
    history.pushState(null, '', location.pathname + location.search);
    showChecker(false);
  });
  window.addEventListener('popstate', () => readRoute(true));
  window.addEventListener('hashchange', () => readRoute());
  readRoute();
})();
