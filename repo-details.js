/* GitHub repository details. Only text from GitHub is rendered as text nodes. */
(() => {
  const owner = 'x0XP';
  const title = document.getElementById('repoDetailTitle');
  const body = document.getElementById('repoDetailBody');
  const repoCache = new Map();
  let generation = 0;

  function validName(name) {
    return typeof name === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(name);
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function link(text, url, icon) {
    const a = element('a', 'ui-button', text);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (icon) {
      const i = element('i', 'fas fa-arrow-up-right-from-square');
      i.setAttribute('aria-hidden', 'true');
      a.append(i);
    }
    return a;
  }
  function repoUrl(name) {
    return `https://github.com/${owner}/${encodeURIComponent(name)}`;
  }
  function displayDate(dateString) {
    const date = new Date(dateString);
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})
      : 'Unknown';
  }
  function metric(label, value) {
    const card = element('div', 'repo-detail-stat');
    card.append(element('span', 'repo-detail-stat-label', label),
      element('strong', 'repo-detail-stat-value', value));
    return card;
  }
  async function apiJson(url) {
    const response = await fetch(url, {headers: {Accept: 'application/vnd.github+json'}});
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return response.json();
  }
  function fetchRepository(name) {
    if (!repoCache.has(name)) {
      const promise = (async () => {
        // Direct #repo links should work without a GitHub API request.
        const saved = await window.X0XPGithubData.find(name).catch(() => null);
        if (saved) return saved;
        const repo = await apiJson(`https://api.github.com/repos/${owner}/${encodeURIComponent(name)}`);
        if (!repo || repo.name !== name || repo.private) throw new Error('Repository unavailable');
        return repo;
      })();
      repoCache.set(name, promise);
      promise.catch(() => { if (repoCache.get(name) === promise) repoCache.delete(name); });
    }
    return repoCache.get(name);
  }
  const readmeCache = new Map();

  async function fetchReadme(name, branch) {
    const key = name + ':' + branch;
    if (!readmeCache.has(key)) {
      // raw.githubusercontent.com is not subject to the public REST API's
      // 60-request-per-hour limit. README previews are optional, never fatal.
      const promise = (async () => {
        for (const filename of ['README.md', 'readme.md']) {
          try {
            const path = [owner, name, branch, filename]
              .map(part => encodeURIComponent(part)).join('/');
            const response = await fetch('https://raw.githubusercontent.com/' + path);
            if (!response.ok) continue;
            const text = await response.text();
            if (text.length <= 250000) return text;
          } catch (_) { /* Try the next filename. */ }
        }
        return '';
      })();
      readmeCache.set(key, promise);
    }
    return readmeCache.get(key);
  }
  function readmePreview(markdown) {
    // Preserve headings in a short preview while creating only text nodes.
    const clean = markdown.replace(/\x60{3}[\s\S]*?\x60{3}/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\r/g, '');
    const blocks = [];
    for (const chunk of clean.split(/\n\s*\n/)) {
      const raw = chunk.trim();
      if (!raw || /^\|/.test(raw) || /^([-*_]\s*){3,}$/.test(raw)) continue;
      const heading = /^(#{1,6})\s+(.+)$/.exec(raw);
      const text = (heading ? heading[2] : raw)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*|__|\x60/g, '')
        .replace(/^\s*[-*+]\s+/gm, '• ')
        .replace(/\s+/g, ' ').trim();
      if (!text) continue;
      blocks.push({
        tag: heading ? (heading[1].length === 1 ? 'h4' : 'h5') : 'p',
        text: text.length > 450 ? text.slice(0, 447) + '…' : text
      });
      if (blocks.length === 5) break;
    }
    // Never leave a section heading dangling at the end of the preview.
    if (blocks.length > 1 && blocks[blocks.length - 1].tag !== 'p') blocks.pop();
    return blocks;
  }
  function previewImage(markdown, repo) {
    const imageMatch = /!\[([^\]]*)\]\(([^)]+)\)/.exec(markdown);
    if (!imageMatch) return null;
    const path = imageMatch[2].split(/\s+"/)[0].replace(/^\.\//, '').trim();
    // Only preview files belonging to the selected repository; don't embed
    // arbitrary URLs or README-supplied HTML into the site.
    const segments = path.split('/');
    if (!segments.length || segments.some(p => !p || p === '..' || p === '.' ||
        !/^[a-zA-Z0-9_ .()%+@-]+$/.test(p))) return null;
    const branch = repo.default_branch || 'main';
    if (!/^[a-zA-Z0-9._\/-]+$/.test(branch)) return null;
    const resource = [owner, repo.name, branch, ...segments].map(p => encodeURIComponent(p)).join('/');
    return {
      src: `https://raw.githubusercontent.com/${resource}`,
      alt: imageMatch[1].slice(0, 120) || 'Project screenshot'
    };
  }
  function showStatus(message, retryName) {
    body.replaceChildren();
    body.append(element('p', 'repo-detail-status ui-muted', message));
    if (retryName) {
      const retry = element('button', 'ui-button repo-detail-retry', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', () => show(retryName));
      body.append(retry);
    }
  }
  function render(repo, markdown) {
    title.textContent = repo.name;
    body.replaceChildren();
    const summary = element('p', 'repo-detail-description',
      repo.description || 'No repository description provided.');
    body.append(summary);

    const stats = element('div', 'repo-detail-stats');
    const number = n => Number.isFinite(n) ? new Intl.NumberFormat('en-GB').format(n) : '—';
    stats.append(metric('Language', repo.language || 'Not specified'),
      metric('Stars', number(repo.stargazers_count)),
      metric('Forks', number(repo.forks_count)),
      metric('Updated', displayDate(repo.updated_at)));
    body.append(stats);

    const actions = element('div', 'repo-detail-actions');
    const url = repoUrl(repo.name);
    actions.append(link('View repository', url, true));
    // The fork still carries the original project's homepage metadata.
    // Do not send visitors to a different developer's hosted trainer.
    const homepage = repo.name === 'ColosseumTrainer' && /colosim\.com/i.test(repo.homepage || '')
      ? '' : repo.homepage;
    if (typeof homepage === 'string' && /^https:\/\//i.test(homepage)) {
      actions.append(link('Visit website', homepage, true));
    }
    body.append(actions);

    const readmeSection = element('section', 'repo-detail-section');
    readmeSection.append(element('h3', 'ui-section-heading', 'README'));
    const readmeBox = element('div', 'repo-detail-readme');
    const blocks = readmePreview(markdown || '');
    if (blocks.length) {
      for (const block of blocks) readmeBox.append(element(block.tag, '', block.text));
    } else {
      readmeBox.append(element('p', '', 'No README preview is available for this repository.'));
    }
    if (markdown) {
      const image = previewImage(markdown, repo);
      if (image) {
        const img = element('img', 'repo-detail-preview');
        img.src = image.src;
        img.alt = image.alt;
        img.loading = 'lazy';
        img.addEventListener('error', () => img.remove(), {once:true});
        readmeBox.append(img);
      }
    }
    readmeSection.append(readmeBox, link('Read on GitHub', url + '#readme', true));
    body.append(readmeSection);
  }
  async function show(name, listedRepo) {
    const current = ++generation;
    if (!validName(name)) {
      title.textContent = 'Repository';
      showStatus('This repository link is invalid.');
      return;
    }
    title.textContent = name;
    showStatus('Loading repository details…');
    try {
      // Reuse the verified GitHub list data when entering from the profile.
      const repository = listedRepo && listedRepo.name === name && !listedRepo.private
        ? listedRepo : await fetchRepository(name);
      if (current !== generation) return;
      render(repository, '');
      const markdown = await fetchReadme(name, repository.default_branch || 'main');
      if (current !== generation) return;
      render(repository, markdown);
    } catch (_) {
      if (current === generation) showStatus('Could not load this repository. Please try again.', name);
    }
  }
  window.X0XPRepoDetails = Object.freeze({show, validName});
})();
