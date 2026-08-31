/* ==========================================================================
   Gambit client portal — access gate
   Per-client access code, held for the browser session (sessionStorage).

   A page opts in by adding class="preauth" to <html> and, before this script,
   declaring:  window.GAMBIT_CLIENT = { slug:'hoem', name:'HOEM', code:'hoem2026' };

   Note: this is a client-side gate. It keeps the area private and out of
   search, but the code lives in the page. It is not hard security. For
   anything sensitive, move to server-side auth.
   ========================================================================== */
(function () {
  var doc = document.documentElement;
  if (!doc.classList.contains('preauth')) return; // page is not gated

  var cfg = window.GAMBIT_CLIENT || {};
  var code = String(cfg.code || '').trim().toLowerCase();
  var slug = cfg.slug || 'client';
  var name = cfg.name || 'Client';
  var key = 'gambit_gate_' + slug;

  function reveal() {
    doc.classList.remove('preauth');
    var g = document.getElementById('gate');
    if (g) g.parentNode.removeChild(g);
    wireLocks();
  }

  function wireLocks() {
    var locks = document.querySelectorAll('[data-portal-lock]');
    for (var i = 0; i < locks.length; i++) {
      locks[i].addEventListener('click', function (e) {
        e.preventDefault();
        try { sessionStorage.removeItem(key); } catch (err) {}
        location.reload();
      });
    }
  }

  // Already unlocked this session?
  var authed = false;
  try { authed = sessionStorage.getItem(key) === '1'; } catch (e) {}
  if (authed) { reveal(); return; }

  // Build the gate overlay.
  var gate = document.createElement('div');
  gate.id = 'gate';

  var configured = code.length > 0;
  var sub = configured
    ? 'Enter your access code to open the ' + name + ' workspace.'
    : 'This workspace is being set up. Please check back shortly.';

  gate.innerHTML =
    '<div class="gate-card">' +
      '<img class="gate-logo" src="/img/gambit-logo.png" alt="Gambit">' +
      '<p class="gate-eyebrow">' + escapeHtml(name) + ' workspace</p>' +
      '<h1 class="gate-title">Private client access</h1>' +
      '<p class="gate-sub">' + escapeHtml(sub) + '</p>' +
      (configured ?
        '<form class="gate-form" id="gate-form" autocomplete="off">' +
          '<input class="gate-input" id="gate-input" type="password" ' +
                 'placeholder="Access code" aria-label="Access code" ' +
                 'autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '<button class="gate-btn" type="submit">Enter workspace</button>' +
        '</form>' +
        '<p class="gate-err" id="gate-err" role="alert"></p>'
        : '') +
      '<p class="gate-foot">Need access? Email ' +
        '<a href="mailto:hello@gambitco.io">hello@gambitco.io</a></p>' +
    '</div>';

  document.body.appendChild(gate);

  if (!configured) return; // fail closed: no code, no entry

  var form = document.getElementById('gate-form');
  var input = document.getElementById('gate-input');
  var err = document.getElementById('gate-err');
  var errTimer = null;

  function attempt(e) {
    if (e) e.preventDefault();
    if (input.value.trim().toLowerCase() === code) {
      try { sessionStorage.setItem(key, '1'); } catch (er) {}
      reveal();
    } else {
      err.textContent = 'That code did not match. Try again.';
      input.value = '';
      input.focus();
      if (errTimer) clearTimeout(errTimer);
      errTimer = setTimeout(function () { err.textContent = ''; }, 3200);
    }
  }

  form.addEventListener('submit', attempt);
  setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
