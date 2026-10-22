(() => {
  'use strict';
  const sound = document.getElementById('sound');
  const audio = document.getElementById('film-ambience');
  const status = document.getElementById('status');
  let wantsSound = false;

  function sync() {
    sound.textContent = wantsSound ? 'Sound off' : 'Sound on';
    sound.setAttribute('aria-pressed', String(wantsSound));
  }
  async function resume() {
    if (!wantsSound || document.hidden) return;
    if (!audio.getAttribute('src')) audio.src = audio.dataset.src;
    audio.muted = false;
    try {
      await audio.play();
      if (!wantsSound) audio.pause();
      else status.textContent = '';
    } catch {
      if (!wantsSound || document.hidden) return;
      wantsSound = false;
      status.textContent = 'Select Sound on to try the background audio again.';
      sync();
    }
  }
  sound.disabled = false;
  sound.addEventListener('click', () => {
    wantsSound = !wantsSound;
    sync();
    if (wantsSound) void resume();
    else audio.pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
    else void resume();
  });
  addEventListener('focus', () => void resume());
  sync();
})();
