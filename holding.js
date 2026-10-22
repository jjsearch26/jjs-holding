(() => {
  'use strict';
  const videos = [...document.querySelectorAll('video.film')];
  const poster = document.getElementById('film-poster');
  const sound = document.getElementById('sound');
  const play = document.getElementById('play');
  const status = document.getElementById('status');
  const portrait = matchMedia('(max-width:900px) and (orientation:portrait)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const schedule = window.JJSHoldingSchedule;
  const previewButton = document.getElementById('preview-transition');
  const previewStatus = document.getElementById('preview-period');
  let previewPeriod = previewButton ? 'daytime' : null;
  let previewAutoTimer;
  let previewAuto = !!previewButton;
  let active = null;
  let pendingKey = null;
  let failedKey = null;
  let revision = 0;
  let muted = true;
  let requested = !reduce.matches;
  let boundaryTimer;
  let fadeTimer;

  function sync() {
    sound.textContent = muted ? 'Sound on' : 'Sound off';
    sound.setAttribute('aria-pressed', String(!muted));
    sound.disabled = !active;
    play.hidden = active ? !active.paused : !failedKey;
  }
  function release(video) {
    if (!video) return;
    video.classList.remove('is-visible');
    video.muted = true;
    window.jjsReleaseFilm(video);
  }
  async function start() {
    const video = active;
    if (!video || document.hidden || !requested) return;
    for (const other of videos) if (other !== video) other.muted = true;
    video.muted = muted;
    try {
      await video.play();
    } catch {
      // Keep autoplay available if the browser requires a muted film.
      if (!muted) {
        muted = true;
        video.muted = true;
        try { await video.play(); } catch {}
      }
    }
    if (video === active) sync();
  }
  function firstFrame(video) {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', ready);
        video.removeEventListener('error', failed);
        error ? reject(error) : resolve();
      };
      const ready = () => finish();
      const failed = () => finish(new Error('Film unavailable'));
      const timeout = setTimeout(failed, 30000);
      video.addEventListener('loadeddata', ready, {once:true});
      video.addEventListener('error', failed, {once:true});
    });
  }
  async function selectFilm(scene, force) {
    if (pendingKey === scene.key || (!pendingKey && active?.dataset.film === scene.key)) return;
    if (!force && failedKey === scene.key) return;
    const token = ++revision;
    clearTimeout(fadeTimer);
    for (const video of videos) if (video !== active) release(video);
    pendingKey = null;
    if (active?.dataset.film === scene.key) return;
    pendingKey = scene.key;
    failedKey = null;
    if (previewButton) {
      previewButton.disabled = true;
      previewButton.textContent = scene.period === 'daytime' ? 'Loading daytime…' : 'Loading night-time…';
    }
    const incoming = videos.find(video => video !== active);
    incoming.poster = scene.poster;
    incoming.style.objectPosition = scene.position;
    incoming.muted = true;
    incoming.defaultMuted = true;
    incoming.playsInline = true;
    incoming.autoplay = requested;
    incoming.loop = true;
    incoming.defaultPlaybackRate = scene.speed;
    incoming.playbackRate = scene.speed;
    incoming.dataset.film = scene.key;
    incoming.setAttribute('aria-label', (scene.period === 'daytime' ? 'Daytime' : 'Night-time') + ' JJS rooftop launch film');
    if (!active) {
      poster.src = scene.poster;
      poster.style.objectPosition = scene.position;
    }
    sync();
    try {
      const loaded = await window.jjsLoadFilm(incoming, scene.key);
      if (!loaded || token !== revision) return;
      await firstFrame(incoming);
      if (token !== revision) return;
      incoming.playbackRate = scene.speed;
      if (requested && !document.hidden) {
        try { await incoming.play(); } catch {}
      }
      if (token !== revision) return;
      const outgoing = active;
      active = incoming;
      pendingKey = null;
      poster.src = scene.poster;
      poster.style.objectPosition = scene.position;
      document.documentElement.dataset.period = scene.period;
      document.documentElement.dataset.format = scene.format;
      document.documentElement.dataset.film = scene.key;
      incoming.style.zIndex = '2';
      if (outgoing) outgoing.style.zIndex = '1';
      incoming.classList.add('is-visible');
      status.textContent = '';
      if (previewStatus) previewStatus.textContent = outgoing ? 'Fading to ' + (scene.period === 'daytime' ? 'daytime' : 'night-time') : 'Daytime';
      const finish = () => {
        if (active !== incoming) return;
        release(outgoing);
        incoming.muted = muted;
        if (requested) start();
        sync();
        if (previewButton) {
          previewStatus.textContent = scene.period === 'daytime' ? 'Daytime' : 'Night-time';
          previewButton.disabled = false;
          previewButton.textContent = scene.period === 'daytime' ? 'Preview day → night' : 'Preview night → day';
          if (previewAuto && !reduce.matches) {
            previewAuto = false;
            previewAutoTimer = setTimeout(previewTransition, 5000);
          }
        }
      };
      if (outgoing && !reduce.matches) fadeTimer = setTimeout(finish, 2000);
      else finish();
      sync();
    } catch {
      if (token !== revision) return;
      pendingKey = null;
      failedKey = scene.key;
      release(incoming);
      status.textContent = active ? 'The updated video could not load. Please refresh to try again.' : 'JJS rooftop image shown. Select Play video to retry.';
      sync();
      if (previewButton) {
        previewButton.disabled = false;
        previewButton.textContent = 'Retry transition';
        previewStatus.textContent = 'Preview unavailable';
      }
    }
  }
  function refresh(force = false) {
    const now = new Date();
    if (previewPeriod) now.setHours(previewPeriod === 'daytime' ? 12 : 21, 0, 0, 0);
    selectFilm(schedule.select(now, portrait.matches), force);
    clearTimeout(boundaryTimer);
    if (!previewPeriod) boundaryTimer = setTimeout(refresh, Math.max(50, schedule.nextChange(now).getTime() - now.getTime() + 50));
  }
  function previewTransition() {
    clearTimeout(previewAutoTimer);
    previewAuto = false;
    if (!failedKey) previewPeriod = previewPeriod === 'daytime' ? 'nighttime' : 'daytime';
    requested = true;
    refresh(true);
  }
  if (previewButton) previewButton.addEventListener('click', previewTransition);
  for (const video of videos) {
    window.jjsKeepFilmLooping(video, {
      shouldPlay: () => video === active && requested,
      resume: start
    });
    video.addEventListener('playing', () => { if (video === active) sync(); });
    video.addEventListener('pause', () => { if (video === active) sync(); });
    video.addEventListener('loadedmetadata', () => {
      const date = new Date();
      if (previewPeriod) date.setHours(previewPeriod === 'daytime' ? 12 : 21, 0, 0, 0);
      const scene = schedule.select(date, portrait.matches);
      if (video.dataset.film === scene.key) video.playbackRate = scene.speed;
    });
    video.addEventListener('error', () => {
      if (video !== active) return;
      status.textContent = 'The video could not play. Please refresh this page.';
      sync();
    });
  }
  play.addEventListener('click', () => {
    requested = true;
    if (active) start();
    else refresh(true);
  });
  sound.addEventListener('click', () => {
    muted = !muted;
    requested = true;
    start();
    sync();
  });
  portrait.addEventListener('change', () => refresh());
  reduce.addEventListener('change', () => {
    requested = !reduce.matches;
    if (requested) start();
    else for (const video of videos) video.pause();
    sync();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const video of videos) video.pause();
    else { refresh(true); start(); }
  });
  window.addEventListener('pageshow', () => { refresh(); start(); });
  window.addEventListener('focus', () => { refresh(); start(); });
  window.addEventListener('online', () => refresh(true));
  // Catch clock or timezone changes while a visitor leaves the page open.
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  refresh();
  sync();
})();
