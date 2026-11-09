/* Same-origin GitHub snapshot with occasional, optional live updates.
   The public repository list must never depend on GitHub API availability. */
(() => {
  'use strict';

  const SNAPSHOT_URL = 'github-data.json';
  const API_URL = 'https://api.github.com/users/x0XP/repos?sort=updated&direction=desc&per_page=100&page=1';
  const CACHE_KEY = 'x0xp-public-github-data-v1';
  const ATTEMPT_KEY = 'x0xp-github-last-api-attempt-v1';
  const REMOTE_INTERVAL = 6 * 60 * 60 * 1000;
  const REPO_NAME = /^[a-zA-Z0-9_.-]{1,100}$/;
  let current = null;
  let loading = null;
  let refreshing = null;
  let memoryLastAttempt = 0;

  function getStorage(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function putStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* Storage is optional. */ }
  }
  function normalize(data) {
    if (!data || !Array.isArray(data.repositories)) throw new Error('Invalid GitHub data');
    const unique = new Set();
    const repositories = data.repositories.filter(r => {
      if (!r || typeof r.name !== 'string' || !REPO_NAME.test(r.name) ||
          r.private === true || (r.full_name && !r.full_name.startsWith('x0XP/')) ||
          unique.has(r.name)) return false;
      unique.add(r.name);
      return true;
    }).sort((a, b) =>
      (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0));
    if (!repositories.length) throw new Error('No valid public repositories');
    const fallbackProfile = {
      login: 'x0XP', name: 'x0XP', bio: '',
      avatar_url: 'https://github.com/x0XP.png?size=128'
    };
    return {
      schema_version: 1,
      generated_at: typeof data.generated_at === 'string' ? data.generated_at : '',
      profile: Object.assign(fallbackProfile, data.profile || {}),
      repositories
    };
  }
  function readCached() {
    try {
      const value = getStorage(CACHE_KEY);
      return value ? normalize(JSON.parse(value)) : null;
    } catch (_) {
      return null;
    }
  }
  function store(data) {
    putStorage(CACHE_KEY, JSON.stringify(data));
  }
  async function load() {
    if (current) return current;
    if (loading) return loading;
    loading = (async () => {
      const cached = readCached();
      let snapshot = null;
      try {
        const response = await fetch(SNAPSHOT_URL, {cache: 'no-store'});
        if (!response.ok) throw new Error('Cannot load public GitHub snapshot');
        snapshot = normalize(await response.json());
      } catch (_) {
        // A successful prior visit remains usable even if the local fetch fails.
      }
      if (!snapshot && !cached) throw new Error('No repository data available');
      const cachedDate = Date.parse(cached?.generated_at) || 0;
      const snapshotDate = Date.parse(snapshot?.generated_at) || 0;
      current = cachedDate > snapshotDate ? cached : (snapshot || cached);
      store(current);
      return current;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }
  async function refresh(options = {}) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      let previous;
      try { previous = await load(); } catch (_) { previous = null; }
      const lastAttempt = Math.max(memoryLastAttempt, Number(getStorage(ATTEMPT_KEY)) || 0);
      if (!options.force && Date.now() - lastAttempt < REMOTE_INTERVAL && previous) {
        return {data: previous, changed: false};
      }
      const now = Date.now();
      memoryLastAttempt = now;
      putStorage(ATTEMPT_KEY, String(now));
      try {
        const response = await fetch(API_URL, {
          headers: {Accept: 'application/vnd.github+json'}
        });
        if (!response.ok) throw new Error('GitHub API unavailable');
        const repositories = await response.json();
        if (!Array.isArray(repositories) || repositories.length === 0)
          throw new Error('Unexpected GitHub response');
        // The profile is served locally; only the repository list needs
        // periodic refreshing. Avoid an extra public API request.
        const data = normalize({
          generated_at: new Date().toISOString(),
          profile: previous?.profile,
          repositories
        });
        const oldSignature = previous?.repositories.map(r =>
          [r.name, r.updated_at, r.description, r.language].join('|')).join('\n');
        const newSignature = data.repositories.map(r =>
          [r.name, r.updated_at, r.description, r.language].join('|')).join('\n');
        current = data;
        loading = Promise.resolve(data);
        store(data);
        return {data, changed: oldSignature !== newSignature};
      } catch (_) {
        if (previous) return {data: previous, changed: false};
        throw new Error('Repository data is temporarily unavailable');
      }
    })();
    try { return await refreshing; } finally { refreshing = null; }
  }
  async function find(name) {
    const data = await load();
    return data.repositories.find(r => r.name === name) || null;
  }
  window.X0XPGithubData = Object.freeze({load, refresh, find});
})();