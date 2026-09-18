(() => {
  const mobile = /\/mobile\.html$/.test(location.pathname);
  const original = document.querySelector(mobile ? '.mobile-primary-action' : '.hero-actions .primary-action');
  const copy = window.SC_SHOWCASE_COPY;
  if (!original || !copy) return;

  const releasesUrl = 'https://github.com/CAPTCHAAAAA/SillyClient/releases';
  const latestUrl = 'https://api.github.com/repos/CAPTCHAAAAA/SillyClient/releases/latest';
  const wide = matchMedia('(min-aspect-ratio: 1 / 1)');
  const platforms = { windows: 'Windows', android: 'Android' };
  let platform = wide.matches ? 'windows' : 'android';
  let busy = false;
  let pendingPlatform;
  let status = '';
  let requestedPlatform = platform;
  const control = document.createElement('div');
  control.className = 'sc-download';
  control.innerHTML = `
    <div class="sc-download-control">
      <div class="sc-platform-toggle" role="radiogroup">
        <span class="sc-platform-thumb" aria-hidden="true"></span>
        <label class="sc-platform-choice">
          <input type="radio" name="sc-download-platform" value="windows">
          <span>Windows</span>
        </label>
        <label class="sc-platform-choice">
          <input type="radio" name="sc-download-platform" value="android">
          <span>Android</span>
        </label>
      </div>
      <button class="sc-download-button" type="button">
        <svg aria-hidden="true"><use href="./landing-icons.svg#icon-download"></use></svg>
      </button>
    </div>
    <a class="sc-download-manual" href="${releasesUrl}" target="_blank" rel="noopener">
      <span></span><svg aria-hidden="true"><use href="./landing-icons.svg#icon-external"></use></svg>
    </a>
    <p class="sc-download-status" role="status" aria-live="polite" hidden></p>`;
  original.replaceWith(control);
  const group = control.querySelector('[role="radiogroup"]');
  const radios = [...control.querySelectorAll('input')];
  const button = control.querySelector('button');
  const statusElement = control.querySelector('[role="status"]');
  let downloadFrame;

  function render() {
    const language = document.documentElement.lang.startsWith('en') ? 'en' : 'zh';
    const text = copy[language].downloadControl;
    control.style.setProperty('--sc-platform-index', platform === 'windows' ? 0 : 1);
    group.setAttribute('aria-label', text.platform);
    radios.forEach(radio => {
      radio.checked = radio.value === platform;
      radio.disabled = busy;
    });
    const buttonLabel = (busy ? text.loading : text.download).replace('{platform}', platforms[platform]);
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    button.setAttribute('aria-label', buttonLabel);
    button.title = buttonLabel;
    control.querySelector('.sc-download-manual > span').textContent = text.manual;
    statusElement.textContent = status ? text[status].replace('{platform}', platforms[requestedPlatform]) : '';
    statusElement.hidden = !status;
  }

  radios.forEach(radio => radio.addEventListener('change', () => {
    platform = radio.value;
    status = '';
    render();
  }));
  wide.addEventListener('change', () => {
    const next = wide.matches ? 'windows' : 'android';
    if (busy) pendingPlatform = next;
    else {
      platform = next;
      status = '';
      render();
    }
  });
  new MutationObserver(render).observe(document.documentElement, {
    attributes: true, attributeFilter: ['lang']
  });

  function chooseAsset(release, target) {
    if (release.draft || release.prerelease || !Array.isArray(release.assets)) return null;
    const pattern = target === 'windows'
      ? /^SillyClient-Windows(?:-|_).*\.exe$/i
      : /^SillyClient-Android(?:-|_).*\.apk$/i;
    return release.assets.find(asset => {
      if (!pattern.test(asset.name || '') || (asset.state && asset.state !== 'uploaded')) return false;
      try {
        const url = new URL(asset.browser_download_url);
        return url.protocol === 'https:' && url.hostname === 'github.com'
          && url.pathname.startsWith('/CAPTCHAAAAA/SillyClient/releases/download/');
      } catch {
        return false;
      }
    });
  }

  function requestDownload(asset) {
    // A dedicated frame keeps the showcase open while GitHub serves the attachment.
    if (!downloadFrame) {
      downloadFrame = document.createElement('iframe');
      downloadFrame.name = 'sc-release-download';
      downloadFrame.hidden = true;
      downloadFrame.title = 'Download';
      document.body.append(downloadFrame);
    }
    const link = document.createElement('a');
    link.href = asset.browser_download_url;
    link.download = asset.name;
    link.target = downloadFrame.name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  }

  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    requestedPlatform = platform;
    status = 'loading';
    render();
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    try {
      const response = await fetch(latestUrl, {
        headers: { Accept: 'application/vnd.github+json' },
        credentials: 'omit', cache: 'no-store', signal: abort.signal
      });
      if (!response.ok) throw new Error(`Release request failed: ${response.status}`);
      const asset = chooseAsset(await response.json(), requestedPlatform);
      if (!asset) status = 'missing';
      else {
        requestDownload(asset);
        status = 'started';
      }
    } catch {
      status = 'failed';
    } finally {
      clearTimeout(timeout);
      busy = false;
      if (pendingPlatform) {
        platform = pendingPlatform;
        pendingPlatform = undefined;
      }
      render();
    }
  });
  render();
})();
