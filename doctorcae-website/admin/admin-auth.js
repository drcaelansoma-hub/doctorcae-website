/**
 * Shared admin session + nav.
 * Include after: <script src="/admin/admin-auth.js"></script>
 * Call AdminAuth.init({ active: 'overview' | 'analytics' | 'financial' | 'journal' | 'forms' | 'social' | 'content' })
 */
(function (global) {
  var ACTIVE = '';

  function gate() {
    return fetch('/api/admin-session', { method: 'GET', credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) {
          window.location.replace('/admin/login.html');
          return false;
        }
        return true;
      })
      .catch(function () {
        window.location.replace('/admin/login.html');
        return false;
      });
  }

  function renderNav(active) {
    var links = [
      { id: 'overview', href: '/admin/', label: 'Overview' },
      { id: 'analytics', href: '/admin/analytics.html', label: 'Analytics' },
      { id: 'financial', href: '/admin/financial.html', label: 'Financial' },
      { id: 'journal', href: '/admin/journal/index.html', label: 'Journal' },
      { id: 'forms', href: '/admin/formspree.html', label: 'Form inbox' },
      { id: 'social', href: '/admin/social/index.html', label: 'Social content' },
      { id: 'content', href: '/admin/content/instagram-post-tool.html', label: 'IG post (AI)' },
    ];
    var nav = document.getElementById('admin-nav');
    if (!nav) return;
    nav.innerHTML = links
      .map(function (L) {
        var activeCls = L.id === active ? ' class="is-active"' : '';
        return '<a href="' + L.href + '"' + activeCls + '>' + L.label + '</a>';
      })
      .join('');
    var lo = document.getElementById('admin-logout');
    if (lo) {
      lo.onclick = function () {
        fetch('/api/admin-logout', { method: 'POST', credentials: 'same-origin' }).finally(function () {
          window.location.href = '/admin/login.html';
        });
      };
    }
  }

  global.AdminAuth = {
    init: function (opts) {
      opts = opts || {};
      ACTIVE = opts.active || '';
      var gateEl = document.getElementById('admin-gate');
      var shell = document.getElementById('admin-shell');
      return gate().then(function (ok) {
        if (!ok) return false;
        if (gateEl) gateEl.classList.add('admin-hidden');
        if (shell) shell.classList.remove('admin-hidden');
        renderNav(ACTIVE);
        return true;
      });
    },
  };
})(typeof window !== 'undefined' ? window : this);
