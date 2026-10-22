(() => {
  'use strict';
  const stage = document.querySelector('main');
  const video = document.getElementById('film');
  const play = document.getElementById('play');
  const sound = document.getElementById('sound');
  const full = document.getElementById('fullscreen');
  const status = document.getElementById('status');
  const mobile = document.documentElement.dataset.format === 'mobile';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const speed = mobile ? 1 : 0.5;
  const crop = mobile ? {width:1532, height:2722} : {width:3264, height:1836};
  let loaded = false;
  let requested = !reduce.matches;
  let scale = 0;
  let width = 0;
  let lastOffset;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.defaultPlaybackRate = speed;
  video.playbackRate = speed;

  // Match the reviewed exports, retaining the unaltered highest-quality source.
  // The desktop export baked in half-speed timing; this player applies it once.
  function paint() {
    if (!scale || !video.videoWidth) return;
    const progress = Math.min(Math.max(video.currentTime, 0) / 10, 1);
    const sourceCenter = mobile ? 1198 - 90 * (1 - Math.cos(Math.PI * progress)) : 1920;
    const offset = width / 2 - sourceCenter * scale;
    if (lastOffset === undefined || Math.abs(offset - lastOffset) > 0.001) {
      video.style.transform = 'translate3d(' + offset + 'px,0,0)';
      lastOffset = offset;
    }
  }
  function resize() {
    width = stage.clientWidth;
    scale = Math.max(width / crop.width, stage.clientHeight / crop.height);
    if (video.videoWidth) {
      video.style.width = video.videoWidth * scale + 'px';
      video.style.height = video.videoHeight * scale + 'px';
    }
    lastOffset = undefined;
    paint();
  }
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  function animate() {
    if (!document.hidden && !video.paused) paint();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  for (const event of ['seeking','seeked','timeupdate']) video.addEventListener(event, paint);

  function sync() {
    play.hidden = !loaded || !video.paused;
    sound.textContent = video.muted ? 'Sound on' : 'Sound off';
    sound.setAttribute('aria-pressed', String(!video.muted));
    sound.disabled = !loaded;
  }
  async function start() {
    if (!loaded || !requested || document.hidden) return;
    try {
      await video.play();
    } catch {
      if (!video.muted) {
        video.muted = true;
        try { await video.play(); } catch {}
      }
      if (video.paused) status.textContent = 'Select Play video to start.';
    }
    sync();
  }
  window.jjsKeepFilmLooping(video, {shouldPlay:() => requested && loaded, resume:start});
  video.addEventListener('loadedmetadata', () => { video.playbackRate = speed; resize(); });
  video.addEventListener('loadeddata', () => {
    loaded = true;
    resize();
    video.classList.add('is-ready');
    sync();
    start();
  });
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  video.addEventListener('volumechange', sync);
  video.addEventListener('error', () => {status.textContent = 'The film could not load. Please refresh this page.';});
  play.addEventListener('click', () => {requested = true; start();});
  sound.addEventListener('click', () => {video.muted = !video.muted; requested = true; start(); sync();});
  full.hidden = mobile || !document.fullscreenEnabled || !stage.requestFullscreen;
  full.addEventListener('click', async () => {
    try { await stage.requestFullscreen(); } catch {}
  });
  document.addEventListener('visibilitychange', () => {if (document.hidden) video.pause(); else start();});
  for (const event of ['focus','pageshow','online']) window.addEventListener(event, start);
  reduce.addEventListener('change', () => {requested = !reduce.matches; if (requested) start(); else video.pause(); sync();});
  if (reduce.matches) video.autoplay = false;
  window.jjsLoadFilm(video, video.dataset.film).catch(() => {
    status.textContent = 'The film could not load. Please refresh this page.';
  });
  resize();
  sync();
})();
