(() => {
  const hub = document.getElementById('hubView');
  const checker = document.getElementById('checkerView');
  const github = document.getElementById('githubView');
  const openChecker = document.getElementById('openChecker');
  const openGithub = document.getElementById('openGithub');
  const back = document.getElementById('backHome');
  const githubStatus = document.getElementById('githubStatus');
  const githubRepos = document.getElementById('githubRepos');
  let lastHomeTrigger = openChecker;
  let githubRequest = null;
  let focusTimer;

  // Only soften the card's actual clipped edge (12px); masking the whole
  // scrolling view changes how backdrop-filter composites over the wallpaper.
  for (const [panel, selector] of [[checker, '.card'], [github, '.github-card']]) {
    const card = panel.querySelector(selector);
    if (!card) continue;
    let fadeScheduled = false;
    const updateCardEdge = () => {
      fadeScheduled = false;
      const offset = Math.max(0, panel.getBoundingClientRect().top - card.getBoundingClientRect().top);
      const clipped = panel.scrollTop > 0 && offset > 0.5;
      card.classList.toggle('has-card-edge-fade', clipped);
      if (clipped) card.style.setProperty('--card-fade-offset', `${offset}px`);
      else card.style.removeProperty('--card-fade-offset');
    };
    panel.addEventListener('scroll', () => {
      if (fadeScheduled) return;
      fadeScheduled = true;
      requestAnimationFrame(updateCardEdge);
    }, {passive: true});
    window.addEventListener('resize', updateCardEdge, {passive: true});
    updateCardEdge();
  }

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

  function showView(view, focus = true) {
    clearTimeout(focusTimer);
    const isChecker = view === 'checker';
    const isGithub = view === 'github';
    document.body.classList.toggle('checker-open', isChecker);
    document.body.classList.toggle('github-open', isGithub);
    for (const [element, active] of [[hub, view === 'home'], [checker, isChecker], [github, isGithub]]) {
      element.inert = !active;
      element.setAttribute('aria-hidden', String(!active));
    }
    back.hidden = view === 'home';
    document.getElementById('floatingContainer').inert = !isChecker;
    document.getElementById('clearAllFloating').inert = !isChecker;
    document.title = isChecker ? 'OSRS Price Checker · x0XP' : isGithub ? 'GitHub · x0XP' : 'x0XP';
    document.querySelectorAll('.help-box').forEach(panel => panel.classList.remove('visible'));
    helpVisible = false;
    changelogVisible = false;
    if (focus) {
      const target = isChecker ? document.getElementById('itemSearch') : isGithub ? document.getElementById('githubTitle') : lastHomeTrigger;
      focusTimer = setTimeout(() => target.focus({preventScroll: true}), 650);
    }
  }

  async function requestGitHub(url) {
    const response = await fetch(url, {headers: {Accept: 'application/vnd.github+json'}});
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    return response.json();
  }

  async function fetchRepositories() {
    const repositories = [];
    // GitHub allows up to 100 repositories per request. Continue for larger profiles.
    for (let page = 1; page <= 20; page++) {
      const batch = await requestGitHub(`https://api.github.com/users/x0XP/repos?sort=updated&direction=desc&per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error('Unexpected GitHub response');
      repositories.push(...batch);
      if (batch.length < 100) break;
    }
    return repositories.sort((a, b) => Date.parse(b.updated_at || 0) - Date.parse(a.updated_at || 0));
  }

  function renderProfile(profile) {
    if (!profile || typeof profile !== 'object') return;
    const avatar = document.getElementById('githubAvatar');
    if (typeof profile.avatar_url === 'string' && profile.avatar_url.startsWith('https://avatars.githubusercontent.com/')) {
      avatar.src = profile.avatar_url;
    }
    document.getElementById('githubName').textContent = profile.name || profile.login || 'x0XP';
    document.getElementById('githubHandle').textContent = `@${profile.login || 'x0XP'}`;
    document.getElementById('githubBio').textContent = profile.bio || '';
  }

  // Human-readable update ages, with the exact date available on hover.
  function formatUpdateAge(date) {
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    if (days === 0) return 'Updated today';
    const unit = days >= 365 ? 'year' : days >= 30 ? 'month' : 'day';
    const amount = unit === 'year' ? Math.floor(days / 365) : unit === 'month' ? Math.floor(days / 30) : days;
    return 'Updated ' + new Intl.RelativeTimeFormat('en-GB', {numeric: 'always'}).format(-amount, unit);
  }

  function renderRepositories(repositories) {
    githubRepos.replaceChildren();
    const count = document.getElementById('githubRepoCount');
    count.textContent = `${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'}`;
    githubStatus.hidden = true;
    if (!repositories.length) {
      githubStatus.textContent = 'No public repositories found.';
      githubStatus.hidden = false;
      return;
    }
    const exactFormat = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
    const fragment = document.createDocumentFragment();
    for (const repo of repositories) {
      if (!repo || typeof repo.name !== 'string') continue;
      const link = document.createElement('a');
      link.className = 'github-repo';
      link.href = `https://github.com/x0XP/${encodeURIComponent(repo.name)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      const main = document.createElement('span');
      main.className = 'github-repo-main';
      const name = document.createElement('strong');
      name.className = 'github-repo-name';
      name.textContent = repo.name;
      main.append(name);
      if (repo.description) {
        const description = document.createElement('span');
        description.className = 'github-repo-description';
        description.textContent = repo.description;
        main.append(description);
      }

      const meta = document.createElement('span');
      meta.className = 'github-repo-meta';
      const updated = document.createElement('time');
      updated.className = 'github-repo-updated';
      const date = new Date(repo.updated_at);
      if (Number.isNaN(date.getTime())) {
        updated.textContent = 'Update date unavailable';
      } else {
        updated.dateTime = date.toISOString();
        updated.title = `Updated ${exactFormat.format(date)}`;
        updated.textContent = formatUpdateAge(date);
      }
      const external = document.createElement('i');
      external.className = 'fas fa-arrow-up-right-from-square github-repo-external';
      external.setAttribute('aria-hidden', 'true');
      meta.append(updated, external);
      link.append(main, meta);
      fragment.append(link);
    }
    githubRepos.append(fragment);
  }

  function showGitHubFailure() {
    githubStatus.hidden = false;
    githubStatus.textContent = 'Could not load repositories from GitHub.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'github-retry';
    retry.textContent = 'Retry';
    retry.addEventListener('click', loadGitHub);
    githubStatus.append(document.createElement('br'), retry);
  }

  function loadGitHub() {
    if (githubRequest) return githubRequest;
    githubStatus.hidden = false;
    githubStatus.textContent = 'Loading repositories…';
    githubRequest = Promise.allSettled([
      requestGitHub('https://api.github.com/users/x0XP'),
      fetchRepositories()
    ]).then(([profileResult, repoResult]) => {
      if (profileResult.status === 'fulfilled') renderProfile(profileResult.value);
      if (repoResult.status === 'fulfilled') renderRepositories(repoResult.value);
      else {
        githubRequest = null; // Allow an explicit retry after network/rate-limit errors.
        showGitHubFailure();
      }
    });
    return githubRequest;
  }

  async function readRoute(focus = false) {
    const route = location.hash;
    const view = /^#(?:checker|item=|boss=)/.test(route) ? 'checker' : route === '#github' ? 'github' : 'home';
    showView(view, focus);
    if (view === 'github') {
      loadGitHub();
      return;
    }
    if (view !== 'checker') return;
    await trackerReady;
    if (location.hash !== route) return;
    const params = parseHash(route);
    const name = params.item || params.boss;
    if (name && document.getElementById('priceDisplay').dataset.name !== name) getPrice(name, true);
  }

  openChecker.addEventListener('click', () => {
    lastHomeTrigger = openChecker;
    history.pushState({checker: true}, '', '#checker');
    showView('checker');
  });
  openGithub.addEventListener('click', () => {
    lastHomeTrigger = openGithub;
    history.pushState({github: true}, '', '#github');
    showView('github');
    loadGitHub();
  });
  back.addEventListener('click', () => {
    history.pushState(null, '', location.pathname + location.search);
    showView('home');
  });
  window.addEventListener('popstate', () => readRoute(true));
  window.addEventListener('hashchange', () => readRoute());
  readRoute();
})();
