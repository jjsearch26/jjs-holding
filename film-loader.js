(() => {
  const loads = new WeakMap();
  let catalogue;
  window.jjsKeepFilmLooping = (video, {shouldPlay, resume}) => {
    video.loop = true;
    let retry;
    let lastTime = video.currentTime;
    let lastProgress = performance.now();
    const atEnd = () => Number.isFinite(video.duration) && video.duration > 0 &&
      video.currentTime >= video.duration - 0.25;
    function recover() {
      clearTimeout(retry);
      if (document.hidden || !shouldPlay() || !video.currentSrc || video.error) return;
      const stalledAtEnd = atEnd() && performance.now() - lastProgress >= 2000;
      if (video.ended || (video.paused && atEnd()) || stalledAtEnd) {
        // Some mobile browsers stop at the last frame despite the loop flag.
        try { video.currentTime = 0; } catch { return; }
        lastTime = 0;
        lastProgress = performance.now();
        void resume();
      } else if (video.paused) {
        void resume();
      }
    }
    const schedule = () => {
      clearTimeout(retry);
      // Allow a deliberate pause, source switch or background event to settle.
      retry = setTimeout(recover, 50);
    };
    for (const event of ['ended', 'pause', 'canplay', 'seeked']) video.addEventListener(event, schedule);
    video.addEventListener('timeupdate', () => {
      if (video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        lastProgress = performance.now();
      }
    });
    // Also cover a frozen final frame when the browser omits the ended event.
    setInterval(() => { if (atEnd()) recover(); }, 1000);
  };
  window.jjsReleaseFilm = video => {
    loads.delete(video);
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
  window.jjsLoadFilm = async (video, key) => {
    const state = {};
    loads.set(video, state);
    video.pause();
    catalogue ??= fetch('/films.json?v=approved-launch-20261022',{cache:'no-store'}).then(response => {
      if (!response.ok) throw new Error('Film list unavailable');
      return response.json();
    }).catch(error => { catalogue = null; throw error; });
    const films = await catalogue;
    if (!Object.hasOwn(films, key)) throw new Error('Film unavailable');
    if (loads.get(video) !== state) return false;
    // Native byte-range playback starts with the first frames at full quality.
    video.src = '/film/' + encodeURIComponent(key) + '?v=' + films[key].sha256.slice(0, 12);
    video.load();
    return true;
  };
})();
