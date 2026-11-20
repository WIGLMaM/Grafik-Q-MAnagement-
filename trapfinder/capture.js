// TrapFinder – läuft ab Seitenstart im Seitenkontext von *.articulate.com.
// Liest die Kursdaten mit, die der Rise-Editor (oder die Vorschau) per fetch/XHR vom Server lädt.
// Es wird nichts verändert oder verschickt; die Daten bleiben in window.__riseCapture.
(() => {
  if (window.__riseCapture) return;
  const cap = (window.__riseCapture = { courses: [], lessons: {}, log: [] });
  const MAX = 30 * 1024 * 1024;

  const isBlock = (b) => b && typeof b === 'object' && 'family' in b;
  const isCourse = (o) =>
    Array.isArray(o.lessons) && o.lessons.length > 0 && o.lessons.some((l) => l && typeof l === 'object' && ('title' in l || 'items' in l));

  function walk(o, depth, seen, found) {
    if (!o || typeof o !== 'object' || depth < 0 || seen.has(o)) return;
    seen.add(o);
    if (!Array.isArray(o)) {
      if (isCourse(o)) found.courses.push(o);
      if (o.id && Array.isArray(o.items) && o.items.some(isBlock)) found.lessons.push(o);
    }
    for (const k in o) {
      const v = o[k];
      if (v && typeof v === 'object') walk(v, depth - 1, seen, found);
    }
  }

  function handle(url, text) {
    if (typeof text !== 'string' || text.length < 2 || text.length > MAX) return;
    const t = text.trim();
    if (t[0] !== '{' && t[0] !== '[') return;
    let data;
    try { data = JSON.parse(t); } catch (_) { return; }
    const found = { courses: [], lessons: [] };
    walk(data, 12, new WeakSet(), found);
    found.courses.forEach((c) => cap.courses.push(c));
    found.lessons.forEach((l) => { cap.lessons[l.id] = l; });
    let path = String(url || '');
    try { const u = new URL(path, location.href); path = u.origin + u.pathname; } catch (_) { /* ignore */ }
    if (cap.log.length < 200) {
      cap.log.push({
        url: path,
        size: t.length,
        keys: Array.isArray(data) ? [`[Array ${data.length}]`] : Object.keys(data).slice(0, 15),
        courses: found.courses.length,
        lessons: found.lessons.length,
      });
    }
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args);
      p.then((res) => {
        try {
          const ct = res.headers.get('content-type') || '';
          if (/json|text\/plain/i.test(ct)) res.clone().text().then((txt) => handle(res.url, txt)).catch(() => {});
        } catch (_) { /* ignore */ }
      }).catch(() => {});
      return p;
    };
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener('load', () => {
      try {
        if (this.responseType === '' || this.responseType === 'text') handle(this.responseURL || url, this.responseText);
        else if (this.responseType === 'json' && this.response) handle(this.responseURL || url, JSON.stringify(this.response));
      } catch (_) { /* ignore */ }
    });
    return origOpen.call(this, method, url, ...rest);
  };
})();
