/*
 * Keep this GitHub Pages site current without asking visitors to clear caches.
 * Checks the published HTML directly; CSS/JS use unique URLs on every visit.
 */
(() => {
  if (!/^https?:$/.test(location.protocol) ||
      ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;

  const originalBody = window.x0xpInitialBody;
  if (typeof originalBody !== 'string') return;

  const checkInterval = 10 * 60 * 1000;
  const githubCheckInterval = 30 * 60 * 1000;
  const lastGithubCheckKey = 'x0xp-last-github-revision-attempt';
  const releaseGrace = 90 * 1000;
  const lastReloadKey = 'x0xp-last-site-refresh';
  const seenRevisionKey = 'x0xp-last-seen-commit';
  let lastAttempt = 0;
  let lastGithubCheckInMemory = 0;
  let busy = false;
  let seenRevision;

  try { seenRevision = sessionStorage.getItem(seenRevisionKey); } catch (_) { /* Optional. */ }

  function reloadWithFreshHTML() {
    try {
      const prior = Number(sessionStorage.getItem(lastReloadKey) || 0);
      if (Date.now() - prior < 30000) return; // Avoid CDN propagation loops.
      sessionStorage.setItem(lastReloadKey, String(Date.now()));
    } catch (_) { /* Private browsing may disable session storage. */ }
    const url = new URL(location.href);
    url.searchParams.set('site_refresh', String(Date.now()));
    location.replace(url.href); // Preserves the current #checker/#github/#item route.
  }

  async function checkForUpdate() {
    if (busy || (lastAttempt && Date.now() - lastAttempt < 30000)) return;
    lastAttempt = Date.now();
    busy = true;
    try {
      // Unique URLs bypass browser caching and previously cached CDN objects.
      const pageURL = new URL('index.html', location.href);
      pageURL.searchParams.set('fresh', String(Date.now()));
      try {
        const response = await fetch(pageURL.href, {cache: 'no-store'});
        if (response.ok) {
          const latest = new DOMParser().parseFromString(await response.text(), 'text/html');
          // Do not downgrade to pre-updater HTML while Pages propagates a release.
          if (latest.querySelector('script[data-site-bootstrap]') &&
              latest.body && latest.body.innerHTML !== originalBody) {
            reloadWithFreshHTML();
            return;
          }
        }
      } catch (_) { /* Offline: leave the currently loaded page usable. */ }

      // Detect stylesheet/script-only updates, but avoid exhausting the public
      // API allowance with frequent checks across tabs on the same browser.
      // HTML and fresh asset URLs remain the primary, same-origin update path.
      let priorGithubCheck = lastGithubCheckInMemory;
      try {
        priorGithubCheck = Math.max(priorGithubCheck,
          Number(localStorage.getItem(lastGithubCheckKey)) || 0);
      } catch (_) { /* Storage is optional. */ }
      if (Date.now() - priorGithubCheck < githubCheckInterval) return;
      lastGithubCheckInMemory = Date.now();
      try { localStorage.setItem(lastGithubCheckKey, String(lastGithubCheckInMemory)); }
      catch (_) { /* Storage is optional. */ }
      try {
        const response = await fetch('https://api.github.com/repos/x0XP/x0xp.github.io/commits/main', {
          cache: 'no-store',
          headers: {Accept: 'application/vnd.github+json'}
        });
        if (!response.ok) return;
        const commit = await response.json();
        const revision = commit && commit.sha;
        if (typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision)) return;
        const published = Date.parse(commit.commit?.committer?.date || '');
        if (Number.isFinite(published) && Date.now() - published < releaseGrace) return;
        if (seenRevision && seenRevision !== revision) {
          seenRevision = revision;
          try { sessionStorage.setItem(seenRevisionKey, revision); } catch (_) { /* Optional. */ }
          reloadWithFreshHTML();
          return;
        }
        seenRevision = revision;
        try { sessionStorage.setItem(seenRevisionKey, revision); } catch (_) { /* Optional. */ }
      } catch (_) { /* GitHub may be unreachable/rate-limited; HTML checks still work. */ }
    } finally {
      busy = false;
    }
  }

  checkForUpdate();
  window.addEventListener('focus', checkForUpdate);
  window.addEventListener('pageshow', event => { if (event.persisted) checkForUpdate(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
  setInterval(checkForUpdate, checkInterval);
})();