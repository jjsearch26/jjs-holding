(() => {
  'use strict';
  if (document.getElementById('jjs-inquiry')) return;

  const recipient = 'jonathan.mcmanus@jj-search.com';
  const endpoint = 'https://formsubmit.co/ajax/' + recipient;
  const launcher = document.createElement('div');
  launcher.className = 'jjs-contact-launcher';
  launcher.innerHTML = '<button class="jjs-contact-trigger" type="button" aria-haspopup="dialog" aria-controls="jjs-inquiry" aria-expanded="false">Start a conversation <span class="jjs-contact-arrow" aria-hidden="true">↗</span></button>';

  const dialog = document.createElement('dialog');
  dialog.id = 'jjs-inquiry';
  dialog.className = 'jjs-inquiry';
  dialog.setAttribute('aria-labelledby', 'jjs-inquiry-title');
  dialog.innerHTML = `
    <div class="jjs-inquiry-panel">
      <button class="jjs-inquiry-close" type="button" aria-label="Close inquiry form">×</button>
      <div class="jjs-inquiry-wordmark" aria-label="Jonathan James Search"><strong>JONATHAN JAMES</strong><span>SEARCH</span></div>
      <div class="jjs-inquiry-entry">
        <h2 class="jjs-inquiry-title" id="jjs-inquiry-title">Start a conversation</h2>
        <p class="jjs-inquiry-intro">Connect with us ahead of our January 2027 launch.</p>
        <form method="post">
          <div class="jjs-inquiry-fields">
            <label class="jjs-inquiry-field" for="jjs-inquiry-name">Name<input id="jjs-inquiry-name" name="name" autocomplete="name" placeholder="Your name" maxlength="120" required></label>
            <label class="jjs-inquiry-field" for="jjs-inquiry-email">Work email<input id="jjs-inquiry-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@company.com" maxlength="254" required></label>
            <label class="jjs-inquiry-field jjs-inquiry-wide" for="jjs-inquiry-company">Company<input id="jjs-inquiry-company" name="company" autocomplete="organization" placeholder="Your company" maxlength="160"></label>
            <label class="jjs-inquiry-field jjs-inquiry-wide" for="jjs-inquiry-message">How can we help?<textarea id="jjs-inquiry-message" name="message" placeholder="Tell us a little about your inquiry." maxlength="5000" required></textarea></label>
          </div>
          <div class="jjs-inquiry-honey" aria-hidden="true"><label>Leave this field empty<input name="_honey" autocomplete="off" tabindex="-1"></label></div>
          <button class="jjs-inquiry-send" type="submit"><span data-send-label>Send inquiry</span><span class="jjs-contact-arrow" aria-hidden="true">→</span></button>
          <p class="jjs-inquiry-note">Your inquiry will be treated in confidence.</p>
          <p class="jjs-inquiry-error" role="alert" hidden>We couldn’t confirm your inquiry was sent. Please try again or <a href="mailto:${recipient}">email us directly</a>.</p>
        </form>
      </div>
      <div class="jjs-inquiry-success" role="status" aria-live="polite" hidden>
        <div class="jjs-inquiry-check" aria-hidden="true">✓</div>
        <h2 id="jjs-inquiry-success-title">Thank you.</h2>
        <p>Your inquiry has been sent to Jonathan James Search.</p>
        <button class="jjs-inquiry-send" type="button" data-inquiry-return>Return to JJS <span class="jjs-contact-arrow" aria-hidden="true">→</span></button>
      </div>
    </div>`;
  document.body.append(launcher, dialog);

  const trigger = launcher.querySelector('button');
  const panel = dialog.querySelector('.jjs-inquiry-panel');
  const closeButton = dialog.querySelector('.jjs-inquiry-close');
  const form = dialog.querySelector('form');
  const entry = dialog.querySelector('.jjs-inquiry-entry');
  const success = dialog.querySelector('.jjs-inquiry-success');
  const error = dialog.querySelector('.jjs-inquiry-error');
  const submit = form.querySelector('button[type="submit"]');
  const sendLabel = form.querySelector('[data-send-label]');
  const returnButton = dialog.querySelector('[data-inquiry-return]');
  let sending = false;
  let completed = false;
  form.action = endpoint;

  function reset() {
    form.reset();
    entry.hidden = false;
    success.hidden = true;
    error.hidden = true;
    completed = false;
    dialog.setAttribute('aria-labelledby', 'jjs-inquiry-title');
  }
  function close() {
    dialog.close();
  }
  trigger.addEventListener('click', () => {
    if (completed) reset();
    dialog.showModal();
    document.documentElement.classList.add('jjs-contact-open');
    trigger.setAttribute('aria-expanded', 'true');
  });
  closeButton.addEventListener('click', close);
  returnButton.addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('jjs-contact-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({preventScroll: true});
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const name = form.elements.namedItem('name').value.trim();
    const email = form.elements.namedItem('email').value.trim();
    const company = form.elements.namedItem('company').value.trim();
    const message = form.elements.namedItem('message').value.trim();
    if (!name || !email || !message) {
      const field = !name ? 'name' : !email ? 'email' : 'message';
      form.elements.namedItem(field).value = '';
      form.elements.namedItem(field).reportValidity();
      return;
    }
    const data = new FormData(form);
    data.set('name', name);
    data.set('email', email);
    data.set('company', company);
    data.set('message', message);
    data.set('_replyto', email);
    data.set('_subject', 'JJS website inquiry' + (company ? ' — ' + company.replace(/[\r\n]/g, ' ') : ''));
    data.set('_template', 'table');
    data.set('_url', location.origin + '/');
    data.set('Page', location.href);
    data.set('Version', document.getElementById('film')?.dataset.film || 'JJS holding page');
    data.set('Layout', document.documentElement.dataset.layout || 'full-bleed');

    sending = true;
    error.hidden = true;
    submit.disabled = true;
    sendLabel.textContent = 'Sending…';
    panel.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: data,
        headers: {'Accept': 'application/json'},
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin',
        signal: controller.signal
      });
      const result = await response.json();
      const accepted = result.success === true || result.success === 'true';
      const activationPending = /activat|confirm your form/i.test(String(result.message || ''));
      if (!response.ok || !accepted || activationPending) throw new Error('Inquiry not accepted');
      completed = true;
      entry.hidden = true;
      success.hidden = false;
      dialog.setAttribute('aria-labelledby', 'jjs-inquiry-success-title');
      panel.scrollTop = 0;
      if (dialog.open) returnButton.focus({preventScroll: true});
    } catch {
      error.hidden = false;
    } finally {
      clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      sendLabel.textContent = 'Send inquiry';
      panel.removeAttribute('aria-busy');
    }
  });
})();
