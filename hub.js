(() => {
  const hub = document.getElementById('hubView');
  const checker = document.getElementById('checkerView');
  const github = document.getElementById('githubView');
  const repoDetail = document.getElementById('repoDetailView');
  const solTrainer = document.getElementById('solTrainerView');
  const openSolTrainer = document.getElementById('openSolTrainer');
  const solFrame = document.getElementById('solTrainerFrame');
  const solPanel = document.getElementById('solTrainerPanel');
  const solPlaceholder = document.getElementById('solTrainerPlaceholder');
  const solStatus = document.getElementById('solTrainerStatus');
  const solFullscreen = document.getElementById('solTrainerFullscreen');
  const openChecker = document.getElementById('openChecker');
  const openGithub = document.getElementById('openGithub');
  const back = document.getElementById('backHome');
  const githubStatus = document.getElementById('githubStatus');
  const githubRepos = document.getElementById('githubRepos');
  let lastHomeTrigger = openChecker;
  let githubRequest = null;
  let focusTimer;
  let trainerGeneration = 0;
  const independentTrainerURL = 'https://x0xp.github.io/ColosseumTrainer/';
  const backupTrainerURL = new URL('sol-trainer/', document.baseURI).href;

  async function preferredTrainerURL() {
    // During the fork's Pages activation use the previously compiled x0XP
    // build, then switch to the independent fork as soon as its assets exist.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const probe = await fetch(independentTrainerURL + 'osrs-assets/manifest.json', {
        method: 'HEAD', cache: 'no-store', signal: controller.signal
      });
      return probe.ok ? independentTrainerURL : backupTrainerURL;
    } catch (_) {
      return backupTrainerURL;
    } finally {
      clearTimeout(timeout);
    }
  }

  function openTrainerFrame() {
    const generation = ++trainerGeneration;
    solPanel.dataset.state = 'loading';
    solPlaceholder.hidden = false;
    solStatus.textContent = 'Loading the trainer…';
    preferredTrainerURL().then(url => {
      if (generation !== trainerGeneration ||
          !document.body.classList.contains('sol-trainer-open')) return;
      solFullscreen.href = url;
      solFrame.src = url;
    });
  }

  function stopTrainerFrame() {
    trainerGeneration++;
    if (solFrame.getAttribute('src') !== 'about:blank') {
      solFrame.setAttribute('src', 'about:blank');
    }
    solPanel.dataset.state = 'idle';
    solPlaceholder.hidden = false;
  }

  solFrame.addEventListener('load', () => {
    if (document.body.classList.contains('sol-trainer-open') &&
        solFrame.getAttribute('src') !== 'about:blank') {
      solPanel.dataset.state = 'ready';
      solPlaceholder.hidden = true;
    }
  });

  solFrame.addEventListener('error', () => {
    if (document.body.classList.contains('sol-trainer-open')) {
      solPanel.dataset.state = 'error';
      solStatus.textContent = 'The trainer could not load. Try Full screen.';
      solPlaceholder.hidden = false;
    }
  });

  // Avoid CSS masks on elements with backdrop-filter: iOS Safari can
  // change the entire wallpaper's brightness when the mask is toggled.
  // Draw a 12px translucent edge strictly within the visible card bounds.
  for (const [panel, selector, viewClass] of [
    [checker, '.card', 'checker-open'],
    [github, '.github-card', 'github-open'],
    [repoDetail, '.repo-detail-card', 'repo-detail-open'],
    [solTrainer, '.sol-trainer-card', 'sol-trainer-open']
  ]) {
    const card = panel.querySelector(selector);
    if (!card) continue;
    const edge = document.createElement('div');
    edge.className = 'scroll-card-edge';
    edge.setAttribute('aria-hidden', 'true');
    edge.hidden = true;
    document.body.appendChild(edge);
    let scheduled = false;
    const updateEdge = () => {
      scheduled = false;
      if (!document.body.classList.contains(viewClass)) {
        edge.hidden = true;
        return;
      }
      const panelBox = panel.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const top = Math.max(0, panelBox.top);
      const left = Math.max(panelBox.left, cardBox.left);
      const right = Math.min(panelBox.right, cardBox.right);
      const height = Math.min(18, panelBox.bottom - top, cardBox.bottom - top);
      const clipped = panel.scrollTop > 0 && cardBox.top < top - .5 &&
        right > left && height > 0;
      edge.hidden = !clipped;
      if (clipped) {
        edge.style.top = `${top}px`;
        edge.style.left = `${left}px`;
        edge.style.width = `${right - left}px`;
        edge.style.height = `${height}px`;
      }
    };
    const scheduleEdge = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(updateEdge);
    };
    panel.addEventListener('scroll', scheduleEdge, {passive: true});
    panel.addEventListener('transitionend', scheduleEdge);
    window.addEventListener('resize', scheduleEdge, {passive: true});
    updateEdge();
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
    const isRepoDetail = view === 'repo-detail';
    const isSolTrainer = view === 'sol-trainer';
    if (!isSolTrainer && document.body.classList.contains('sol-trainer-open')) stopTrainerFrame();
    document.body.classList.toggle('sol-trainer-open', isSolTrainer);
    document.body.classList.toggle('checker-open', isChecker);
    document.body.classList.toggle('github-open', isGithub);
    document.body.classList.toggle('repo-detail-open', isRepoDetail);
    for (const [element, active] of [[hub, view === 'home'], [checker, isChecker],
      [github, isGithub], [repoDetail, isRepoDetail], [solTrainer, isSolTrainer]]) {
      element.inert = !active;
      element.setAttribute('aria-hidden', String(!active));
    }
    back.hidden = view === 'home';
    back.setAttribute('aria-label', isRepoDetail ? 'Back to GitHub repositories' : 'Back to home');
    document.getElementById('floatingContainer').inert = !isChecker;
    document.getElementById('clearAllFloating').inert = !isChecker;
    document.title = isChecker ? 'OSRS Price Checker · x0XP'
      : isRepoDetail ? 'Repository · x0XP'
      : isSolTrainer ? 'Sol Heredit Trainer · x0XP'
      : isGithub ? 'GitHub · x0XP' : 'x0XP';
    document.querySelectorAll('.help-box').forEach(panel => panel.classList.remove('visible'));
    helpVisible = false;
    changelogVisible = false;
    if (focus) {
      const target = isChecker ? document.getElementById('itemSearch')
        : isRepoDetail ? document.getElementById('repoDetailTitle')
        : isGithub ? document.getElementById('githubTitle')
        : isSolTrainer ? document.getElementById('solTrainerTitle') : lastHomeTrigger;
      focusTimer = setTimeout(() => target.focus({preventScroll: true}), 650);
    }
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

  function openRepository(name, repo) {
    if (!window.X0XPRepoDetails?.validName(name)) return;
    history.pushState({repository: name}, '', '#repo=' + encodeURIComponent(name));
    showView('repo-detail');
    window.X0XPRepoDetails.show(name, repo);
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
      link.className = 'github-repo ui-list-row';
      link.href = '#repo=' + encodeURIComponent(repo.name);
      link.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
            event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openRepository(repo.name, repo);
      });

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
      external.className = 'fas fa-chevron-right github-repo-external';
      external.setAttribute('aria-hidden', 'true');
      meta.append(updated, external);
      link.append(main, meta);
      fragment.append(link);
    }
    githubRepos.append(fragment);
  }

  function renderGitHubData(data) {
    renderProfile(data.profile);
    renderRepositories(data.repositories);
  }

  function showGitHubFailure() {
    githubStatus.hidden = false;
    githubStatus.textContent = 'Repository information is temporarily unavailable.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'github-retry ui-button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      githubRequest = null;
      githubStatus.textContent = 'Loading repositories…';
      // An explicit Retry also attempts the public API if the local file
      // and any previously saved snapshot could not be loaded.
      window.X0XPGithubData.refresh({force: true})
        .then(result => renderGitHubData(result.data))
        .catch(showGitHubFailure);
    });
    githubStatus.append(document.createElement('br'), retry);
  }

  function loadGitHub() {
    if (githubRequest) return githubRequest;
    githubStatus.hidden = false;
    githubStatus.textContent = 'Loading repositories…';
    // Render the same-origin snapshot immediately, without waiting for an
    // external API. The optional live refresh must never blank this list.
    githubRequest = window.X0XPGithubData.load()
      .then(data => {
        renderGitHubData(data);
        window.X0XPGithubData.refresh()
          .then(result => {
            if (result.changed && document.body.classList.contains('github-open'))
              renderGitHubData(result.data);
          })
          .catch(() => { /* Keep the working snapshot. */ });
      })
      .catch(() => window.X0XPGithubData.refresh({force: true})
        .then(result => renderGitHubData(result.data))
        .catch(() => {
          githubRequest = null;
          showGitHubFailure();
        }));
    return githubRequest;
  }

  async function readRoute(focus = false) {
    const route = location.hash;
    const repoMatch = /^#repo=(.+)$/.exec(route);
    const view = repoMatch ? 'repo-detail' :
      /^#(?:checker|item=|boss=)/.test(route) ? 'checker' :
      route === '#github' ? 'github' :
      route === '#sol-trainer' ? 'sol-trainer' : 'home';
    showView(view, focus);
    if (view === 'sol-trainer') {
      openTrainerFrame();
      return;
    }
    if (view === 'repo-detail') {
      let name = '';
      try { name = decodeURIComponent(repoMatch[1]); } catch (_) { /* Show invalid link. */ }
      window.X0XPRepoDetails.show(name);
      return;
    }
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
  openSolTrainer.addEventListener('click', () => {
    lastHomeTrigger = openSolTrainer;
    history.pushState({trainer: true}, '', '#sol-trainer');
    showView('sol-trainer');
    openTrainerFrame();
  });
  back.addEventListener('click', () => {
    if (document.body.classList.contains('repo-detail-open')) {
      history.pushState({github: true}, '', '#github');
      showView('github');
      loadGitHub();
    } else {
      history.pushState(null, '', location.pathname + location.search);
      showView('home');
    }
  });
  window.addEventListener('popstate', () => readRoute(true));
  window.addEventListener('hashchange', () => readRoute());
  readRoute();
  // Routing has established the intended view. CSS and wallpaper readiness
  // determine when the loading overlay can safely reveal it.
  window.x0xpMarkAppReady?.();
})();
