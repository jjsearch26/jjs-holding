(() => {
  'use strict';
  const stage = document.querySelector('main');
  const video = document.getElementById('film');
  const play = document.getElementById('play');
  const sound = document.getElementById('sound');
  const full = document.getElementById('fullscreen');
  const status = document.getElementById('status');
  const soundtrack = document.getElementById('desktop-soundtrack');
  let soundRequested = false;
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
  if (soundtrack) {
    soundtrack.loop = true;
    soundtrack.defaultPlaybackRate = 1;
    soundtrack.playbackRate = 1;
  }

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

  function alignSoundtrack(force = false) {
    if (!soundtrack || !Number.isFinite(soundtrack.duration) || soundtrack.duration <= 0) return;
    const target = (video.currentTime / speed) % soundtrack.duration;
    const difference = Math.abs(soundtrack.currentTime - target);
    const drift = Math.min(difference, soundtrack.duration - difference);
    if (force || drift > 0.75) {
      try { soundtrack.currentTime = target; } catch {}
    }
  }
  function playSoundtrack(forceSync = false) {
    if (!soundtrack || !soundRequested || !loaded || !requested || document.hidden) return;
    alignSoundtrack(forceSync);
    soundtrack.playbackRate = 1;
    void soundtrack.play().catch(() => {
      soundRequested = false;
      soundtrack.pause();
      status.textContent = 'Select Sound on to enable audio.';
      sync();
    });
  }
  function sync() {
    play.hidden = !loaded || !video.paused;
    const audible = soundtrack ? soundRequested : !video.muted;
    sound.textContent = audible ? 'Sound off' : 'Sound on';
    sound.setAttribute('aria-pressed', String(audible));
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
    if (video.paused) soundtrack?.pause();
    else playSoundtrack();
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
  video.addEventListener('pause', () => {soundtrack?.pause(); sync();});
  video.addEventListener('waiting', () => soundtrack?.pause());
  video.addEventListener('playing', () => playSoundtrack(true));
  video.addEventListener('seeked', () => {
    if (soundtrack && soundRequested && !video.paused) playSoundtrack(true);
  });
  video.addEventListener('timeupdate', () => {
    if (soundtrack && soundRequested && !soundtrack.paused && !video.paused) alignSoundtrack();
  });
  video.addEventListener('volumechange', () => {
    // Keep the half-speed embedded track silent; only the normal-speed track is audible.
    if (soundtrack && !video.muted) video.muted = true;
    sync();
  });
  if (soundtrack) {
    soundtrack.addEventListener('loadedmetadata', () => {
      if (soundRequested) alignSoundtrack(true);
    });
    soundtrack.addEventListener('ended', () => {
      if (soundRequested && !video.paused) playSoundtrack(true);
    });
    soundtrack.addEventListener('error', () => {
      soundRequested = false;
      status.textContent = 'The audio could not load. Select Sound on to try again.';
      sync();
    });
  }
  video.addEventListener('error', () => {status.textContent = 'The film could not load. Please refresh this page.';});
  play.addEventListener('click', () => {requested = true; start();});
  sound.addEventListener('click', () => {
    requested = true;
    if (soundtrack) {
      soundRequested = !soundRequested;
      video.muted = true;
      if (soundRequested) {
        if (soundtrack.error) soundtrack.load();
        // Start inside the click gesture so Safari can authorize sound playback.
        playSoundtrack(true);
      } else soundtrack.pause();
    } else video.muted = !video.muted;
    start();
    sync();
  });
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
