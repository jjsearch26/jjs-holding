(() => {
  'use strict';
  function select(date, portrait) {
    const daytime = date.getHours() >= 7 && date.getHours() < 19;
    const format = portrait ? 'mobile' : 'desktop';
    const key = daytime ? 'daytime-' + format + '-still-v1' : portrait ? 'nighttime-mobile-4k-v1' : 'nighttime-desktop-mobile-loop-4k-v1';
    return {
      key,
      type: daytime ? 'image' : 'video',
      format,
      period: daytime ? 'daytime' : 'nighttime',
      poster: daytime ? '/images/daytime-' + format + '-still-v1.jpg' : '/posters/night-mobile-glass.jpg?v=mobile-loop-v1',
      speed: 1,
      audio: daytime ? 'separate' : 'embedded',
      audioSource: daytime ? '/daytime-quiet-still-v1.m4a' : null,
      position: daytime ? '50% 12%' : '50% 18%'
    };
  }
  function nextChange(date) {
    const next = new Date(date.getTime());
    if (date.getHours() < 7) next.setHours(7, 0, 0, 0);
    else if (date.getHours() < 19) next.setHours(19, 0, 0, 0);
    else {
      next.setDate(next.getDate() + 1);
      next.setHours(7, 0, 0, 0);
    }
    return next;
  }
  window.JJSHoldingSchedule = Object.freeze({select, nextChange});
})();
