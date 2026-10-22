(() => {
  'use strict';
  const poster = document.getElementById('film-poster');
  const sound = document.getElementById('sound');
  const status = document.getElementById('status');
  const ambience = document.getElementById('film-ambience');
  const portrait = matchMedia('(max-width:900px) and (orientation:portrait)');
  const schedule = window.JJSHoldingSchedule;
  let active = null;
  let pendingKey = null;
  let failedKey = null;
  let revision = 0;
  let muted = true;
  let boundaryTimer;

  function sync() {
    sound.textContent = muted ? 'Sound on' : 'Sound off';
    sound.setAttribute('aria-pressed', String(!muted));
    sound.disabled = !active;
  }
  async function playAmbience() {
    if (!active || muted || document.hidden) { ambience.pause(); return; }
    const source = active.audioSource;
    if (ambience.getAttribute('src') !== source) {
      ambience.pause();
      ambience.src = source;
    }
    ambience.muted = false;
    try {
      await ambience.play();
      if (muted || document.hidden) ambience.pause();
    } catch (error) {
      if (error?.name === 'AbortError' || document.hidden || muted) return;
      muted = true;
      ambience.pause();
      status.textContent = 'Select Sound on to enable audio.';
      sync();
    }
  }
  async function selectImage(scene, force) {
    if (pendingKey === scene.key || (!pendingKey && active?.key === scene.key)) return;
    if (!force && failedKey === scene.key) return;
    const token = ++revision;
    pendingKey = null;
    if (active?.key === scene.key) return;
    pendingKey = scene.key;
    failedKey = null;
    try {
      const image = new Image();
      image.src = scene.poster;
      await image.decode();
      if (token !== revision) return;
      active = scene;
      poster.src = scene.poster;
      poster.dataset.film = scene.key;
      poster.dataset.scene = scene.period + '-' + scene.format;
      poster.style.objectPosition = scene.position;
      poster.style.animation = 'none';
      poster.style.transition = 'none';
      document.documentElement.dataset.media = 'image';
      document.documentElement.dataset.period = scene.period;
      document.documentElement.dataset.format = scene.format;
      document.documentElement.dataset.film = scene.key;
      pendingKey = null;
      status.textContent = '';
      sync();
      void playAmbience();
    } catch {
      if (token !== revision) return;
      pendingKey = null;
      failedKey = scene.key;
      status.textContent = 'The launch image could not load. Please refresh to try again.';
      sync();
    }
  }
  function refresh(force = false) {
    const now = new Date();
    void selectImage(schedule.select(now, portrait.matches), force);
    clearTimeout(boundaryTimer);
    boundaryTimer = setTimeout(refresh, Math.max(50, schedule.nextChange(now).getTime() - now.getTime() + 50));
  }
  sound.addEventListener('click', () => {
    muted = !muted;
    sync();
    void playAmbience();
  });
  portrait.addEventListener('change', () => refresh());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ambience.pause();
    else { refresh(true); void playAmbience(); }
  });
  for (const event of ['pageshow','focus']) window.addEventListener(event, () => { refresh(); void playAmbience(); });
  window.addEventListener('online', () => refresh(true));
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  refresh();
  sync();
})();
