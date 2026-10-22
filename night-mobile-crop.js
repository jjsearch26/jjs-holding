(() => {
  'use strict';
  // Restore the mobile framing approved on 22 October. Crop the existing
  // master at display time so the film and its audio are not re-encoded.
  const crop = {width: 1532, height: 2722};
  function geometry(width, height, time, sourceWidth, sourceHeight) {
    const progress = Math.min(1, Math.max(0, time / 10));
    const center = 1198 - 90 * (1 - Math.cos(Math.PI * progress));
    const scale = Math.max(width / crop.width, height / crop.height);
    return {
      width: sourceWidth * scale,
      height: sourceHeight * scale,
      x: width / 2 - center * scale
    };
  }
  window.JJSNightMobileCrop = Object.freeze({geometry});
  const videos = [...document.querySelectorAll('video.film')];
  const states = new WeakMap();
  function enabled(video) {
    return video.hasAttribute('data-night-mobile-crop') || video.dataset.scene === 'nighttime-mobile';
  }
  function draw(video) {
    const state = states.get(video);
    if (!enabled(video) || !video.videoWidth) {
      if (state.applied) {
        for (const [property, value] of Object.entries(state.original)) video.style[property] = value;
        state.applied = false;
      }
      return;
    }
    const stage = video.parentElement;
    const frame = geometry(stage.clientWidth, stage.clientHeight, video.currentTime, video.videoWidth, video.videoHeight);
    Object.assign(video.style, {
      left: '0px', top: '0px', right: 'auto', bottom: 'auto', maxWidth: 'none',
      width: frame.width + 'px', height: frame.height + 'px', objectFit: 'fill',
      transformOrigin: '0 0', transform: 'translate3d(' + frame.x + 'px,0,0)'
    });
    state.applied = true;
  }
  function cancel(video) {
    const state = states.get(video);
    if (state.callback == null) return;
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(state.callback);
    else cancelAnimationFrame(state.callback);
    state.callback = null;
  }
  function follow(video) {
    cancel(video);
    draw(video);
    if (!enabled(video) || video.paused || document.hidden) return;
    const state = states.get(video);
    const next = () => { state.callback = null; follow(video); };
    state.callback = video.requestVideoFrameCallback
      ? video.requestVideoFrameCallback(next) : requestAnimationFrame(next);
  }
  for (const video of videos) {
    const original = {};
    for (const property of ['left','top','right','bottom','maxWidth','width','height','objectFit','transformOrigin','transform']) original[property] = video.style[property];
    states.set(video, {original, applied: false, callback: null});
    for (const event of ['loadedmetadata','loadeddata','play','seeked','timeupdate','emptied']) video.addEventListener(event, () => follow(video));
    video.addEventListener('pause', () => { cancel(video); draw(video); });
    new ResizeObserver(() => draw(video)).observe(video.parentElement);
    follow(video);
  }
  document.addEventListener('visibilitychange', () => videos.forEach(follow));
  window.jjsApplyNightMobileCrop = video => { if (states.has(video)) follow(video); };
})();
