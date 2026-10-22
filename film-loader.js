(() => {
  const loads = new WeakMap();
  let catalogue;
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
    catalogue ??= fetch('/films.json?v=4k-v1').then(response => {
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
