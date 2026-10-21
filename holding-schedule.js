(() => {
  'use strict';
  function select(date, portrait) {
    const daytime = date.getHours() >= 7 && date.getHours() < 19;
    const format = portrait ? 'mobile' : 'desktop';
    const key = daytime ? 'daytime-' + format : portrait ? 'austin-mobile-sharp-v2' : 'austin-desktop-sharp-v4';
    return {
      key,
      format,
      period: daytime ? 'daytime' : 'nighttime',
      poster: '/' + (daytime ? 'daytime-' + format + '-v2' : key) + '.jpg',
      speed: !daytime && !portrait ? 0.5 : 1,
      position: daytime ? '50% 0%' : portrait ? '50% 18%' : '50% 50%'
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
