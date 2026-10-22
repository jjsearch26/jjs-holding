(() => {
  'use strict';
  function select(date, portrait) {
    const daytime = date.getHours() >= 7 && date.getHours() < 19;
    const format = portrait ? 'mobile' : 'desktop';
    const key = (daytime ? 'daytime-' : 'nighttime-') + format + '-4k-v1';
    return {
      key,
      format,
      period: daytime ? 'daytime' : 'nighttime',
      poster: daytime ? '/posters/daytime-raised.jpg?v=sign-depth-20261022' : '/posters/night-' + format + '-glass.jpg?v=approved-launch-20261022',
      speed: !daytime && !portrait ? 0.5 : 1,
      position: daytime ? '50% 12%' : portrait ? '50% 18%' : '50% 50%'
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
