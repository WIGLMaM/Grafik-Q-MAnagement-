// Rise HTML-Finder – wird im Seitenkontext (MAIN world) des Rise-Kurses ausgeführt.
// Stellt window.__riseHtmlFinder mit scan(), crawl() und goTo() bereit.
(() => {
  if (window.__riseHtmlFinder) return;

  // Tags, die in normalem Rise-Text nicht vorkommen und auf manuell eingebauten Code hinweisen.
  const RAW_HTML = /<\s*(iframe|script|embed|object|style|form|canvas)\b/i;
  // Hinweise im Blocktyp (type / family / variant) auf Code- oder Embed-Blöcke.
  const TYPE_HINT = /(embed|code|html|iframe|custom)/i;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = 6000, step = 150) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        const v = fn();
        if (v) return v;
      } catch (_) { /* weiter versuchen */ }
      await sleep(step);
    }
    return null;
  }

  const stripHtml = (s) =>
    String(s || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

  const baseUrl = () => location.href.split('#')[0];
  const lessonUrl = (id) => `${baseUrl()}#/lessons/${id}`;

  // ---------- Kursdaten finden ----------

  function decodeBase64Json(str) {
    try {
      const bin = atob(String(str).trim());
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (_) {
      return null;
    }
  }

  function parseAny(value) {
    if (value && typeof value === 'object') return value;
    if (typeof value !== 'string' || value.length < 50) return null;
    const t = value.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return JSON.parse(t); } catch (_) { /* ignore */ }
    }
    return decodeBase64Json(t);
  }

  function looksLikeCourse(obj) {
    return (
      obj &&
      typeof obj === 'object' &&
      Array.isArray(obj.lessons) &&
      obj.lessons.length > 0 &&
      obj.lessons.some((l) => l && typeof l === 'object' && ('items' in l || 'title' in l))
    );
  }

  function searchCourse(obj, depth, seen) {
    if (!obj || typeof obj !== 'object' || depth < 0 || seen.has(obj)) return null;
    if (obj instanceof Node || obj === window) return null;
    seen.add(obj);
    if (looksLikeCourse(obj)) return obj;
    if (obj.course && looksLikeCourse(obj.course)) return obj.course;
    let keys;
    try { keys = Object.keys(obj); } catch (_) { return null; }
    if (keys.length > 500) return null;
    for (const k of keys) {
      let v;
      try { v = obj[k]; } catch (_) { continue; }
      if (v && typeof v === 'object') {
        const found = searchCourse(v, depth - 1, seen);
        if (found) return found;
      }
    }
    return null;
  }

  function findCourse() {
    const seen = new WeakSet();

    // 1) Bekannte globale Variablen (Rise-Export: window.courseData als Base64-JSON)
    for (const name of ['courseData', '__courseData', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__NEXT_DATA__']) {
      let v;
      try { v = window[name]; } catch (_) { continue; }
      const parsed = parseAny(v);
      const c = parsed && searchCourse(parsed, 6, seen);
      if (c) return c;
    }

    // 2) Alle übrigen globalen Variablen durchsuchen
    for (const name of Object.keys(window)) {
      let v;
      try { v = window[name]; } catch (_) { continue; }
      if (typeof v === 'function') continue;
      const parsed = typeof v === 'string' ? (v.length > 2000 ? parseAny(v) : null) : v;
      const c = parsed && searchCourse(parsed, 4, seen);
      if (c) return c;
    }

    // 3) Inline-Skripte nach Base64-/JSON-Blöcken durchsuchen
    for (const s of document.querySelectorAll('script:not([src])')) {
      const txt = s.textContent || '';
      if (txt.length < 2000) continue;
      const matches = txt.match(/["'`]([A-Za-z0-9+/=\s]{2000,})["'`]/g) || [];
      for (const m of matches) {
        const parsed = decodeBase64Json(m.slice(1, -1).replace(/\s/g, ''));
        const c = parsed && searchCourse(parsed, 6, seen);
        if (c) return c;
      }
      if (s.type === 'application/json' || s.type === 'application/ld+json') {
        const parsed = parseAny(txt);
        const c = parsed && searchCourse(parsed, 6, seen);
        if (c) return c;
      }
    }
    return null;
  }

  // ---------- Blöcke analysieren ----------

  function findRawHtml(obj, depth = 6, seen = new WeakSet()) {
    if (depth < 0 || obj == null) return null;
    if (typeof obj === 'string') return RAW_HTML.test(obj) ? obj : null;
    if (typeof obj !== 'object' || seen.has(obj)) return null;
    seen.add(obj);
    for (const k of Object.keys(obj)) {
      const r = findRawHtml(obj[k], depth - 1, seen);
      if (r) return r;
    }
    return null;
  }

  function collectStrings(obj, keys, out = [], depth = 5) {
    if (!obj || typeof obj !== 'object' || depth < 0) return out;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && keys.test(k) && v.trim()) out.push(v);
      else if (v && typeof v === 'object') collectStrings(v, keys, out, depth - 1);
    }
    return out;
  }

  function extractUrls(raw, block) {
    const urls = new Set();
    const re = /\b(?:src|href|data)\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(raw || ''))) urls.add(m[1]);
    for (const s of collectStrings(block, /^(src|url|embedUrl|originalUrl)$/i)) {
      if (/^https?:\/\//i.test(s)) urls.add(s);
    }
    return [...urls].slice(0, 5);
  }

  function hostOf(u) {
    try { return new URL(u, location.href).hostname; } catch (_) { return ''; }
  }

  function describeBlock(block) {
    const typeStr = [block.type, block.family, block.variant].filter(Boolean).join(' / ');
    const hint = TYPE_HINT.test(typeStr) && !/storyline/i.test(typeStr);
    const raw = findRawHtml(block);
    if (!hint && !raw) return null;

    let kind;
    if (/code/i.test(typeStr)) kind = 'Code-Block';
    else if (/embed|iframe/i.test(typeStr)) kind = 'Embed';
    else if (/html|custom/i.test(typeStr)) kind = 'HTML-Block';
    else kind = 'HTML im Inhalt';

    const urls = extractUrls(raw, block);
    const titleCandidates = [
      ...collectStrings(block, /^(title|heading|name|caption|label)$/i, [], 3),
    ].map(stripHtml).filter(Boolean);
    let name = titleCandidates[0] || '';
    if (!name && urls[0]) name = hostOf(urls[0]);
    if (!name && raw) name = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) name = '(ohne Titel)';

    const codeSource = raw || collectStrings(block, /(code|html|embed|content|markup)/i)[0] || '';
    return {
      kind,
      blockType: typeStr || '–',
      name,
      urls,
      preview: String(codeSource).replace(/\s+/g, ' ').trim().slice(0, 400),
    };
  }

  function analyzeCourse(course) {
    const items = [];
    let chapter = '';
    let lessonNo = 0;
    for (const lesson of course.lessons || []) {
      if (!lesson) continue;
      if (lesson.type === 'section') {
        chapter = stripHtml(lesson.title);
        continue;
      }
      lessonNo++;
      (lesson.items || []).forEach((block, i) => {
        if (!block || typeof block !== 'object') return;
        const d = describeBlock(block);
        if (!d) return;
        items.push({
          chapter: chapter || '–',
          lesson: stripHtml(lesson.title) || `Lektion ${lessonNo}`,
          lessonNo,
          lessonId: lesson.id,
          blockId: block.id || '',
          blockNo: i + 1,
          url: lesson.id ? lessonUrl(lesson.id) : baseUrl(),
          ...d,
        });
      });
    }
    return items;
  }

  function lessonLinks() {
    const map = new Map();
    for (const a of document.querySelectorAll('a[href*="#/lessons/"]')) {
      const m = (a.getAttribute('href') || '').match(/#\/lessons\/([^/?#]+)/);
      if (m && !map.has(m[1])) map.set(m[1], stripHtml(a.textContent) || m[1]);
    }
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }

  // ---------- Öffentliche Funktionen ----------

  function scan() {
    const course = findCourse();
    if (course) {
      const items = analyzeCourse(course);
      return {
        source: 'data',
        courseTitle: stripHtml(course.title) || document.title,
        baseUrl: baseUrl(),
        lessonCount: (course.lessons || []).filter((l) => l && l.type !== 'section').length,
        items,
      };
    }
    return { source: 'none', courseTitle: document.title, baseUrl: baseUrl(), lessonLinks: lessonLinks().length, items: [] };
  }

  async function scrollThrough() {
    const el = document.scrollingElement || document.documentElement;
    let last = -1;
    for (let i = 0; i < 60 && el.scrollTop !== last; i++) {
      last = el.scrollTop;
      el.scrollBy(0, window.innerHeight * 0.9);
      await sleep(120);
    }
    el.scrollTo(0, 0);
  }

  function scanDomBlocks(lesson, lessonNo) {
    const out = [];
    const blocks = [...document.querySelectorAll('[data-block-id]')];
    blocks.forEach((b, i) => {
      const iframe = b.querySelector('iframe');
      const code = b.querySelector('pre, code');
      if (!iframe && !code) return;
      const src = iframe ? iframe.getAttribute('src') || '' : '';
      if (/storyline|story_html5|story\.html/i.test(src)) return;
      const heading = stripHtml((b.querySelector('h1,h2,h3,h4') || {}).textContent);
      out.push({
        chapter: '–',
        lesson: lesson.title,
        lessonNo,
        lessonId: lesson.id,
        blockId: b.getAttribute('data-block-id'),
        blockNo: i + 1,
        url: lessonUrl(lesson.id),
        kind: iframe ? 'Embed / HTML (iFrame)' : 'Code-Block',
        blockType: 'aus Seitenansicht erkannt',
        name: (iframe && iframe.title) || heading || (src && hostOf(src)) || '(ohne Titel)',
        urls: src && !src.startsWith('about:') ? [src] : [],
        preview: iframe ? (iframe.getAttribute('srcdoc') || src).slice(0, 400) : stripHtml(code.textContent).slice(0, 400),
      });
    });
    return out;
  }

  // Fallback: klickt sich durch alle Lektionen und sucht in der Seitenansicht.
  async function crawl() {
    const lessons = lessonLinks();
    const startHash = location.hash;
    const items = [];
    for (let n = 0; n < lessons.length; n++) {
      const l = lessons[n];
      location.hash = `#/lessons/${l.id}`;
      await waitFor(() => location.hash.includes(l.id) && document.querySelector('[data-block-id]'), 6000);
      await sleep(700);
      await scrollThrough();
      items.push(...scanDomBlocks(l, n + 1));
    }
    location.hash = startHash;
    return { source: 'dom', courseTitle: document.title, baseUrl: baseUrl(), lessonCount: lessons.length, items };
  }

  function highlight(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prev = el.style.outline;
    const prevOffset = el.style.outlineOffset;
    el.style.outline = '4px solid #e8590c';
    el.style.outlineOffset = '4px';
    setTimeout(() => {
      el.style.outline = prev;
      el.style.outlineOffset = prevOffset;
    }, 4000);
  }

  async function goTo(lessonId, blockId) {
    if (lessonId && !location.hash.includes(lessonId)) location.hash = `#/lessons/${lessonId}`;
    if (!blockId) return true;
    const sel = `[data-block-id="${CSS.escape(blockId)}"]`;
    let el = await waitFor(() => document.querySelector(sel), 5000);
    if (!el) {
      // Rise lädt Blöcke teils erst beim Scrollen – schrittweise nach unten scrollen.
      const s = document.scrollingElement || document.documentElement;
      let last = -1;
      for (let i = 0; i < 80 && !el && s.scrollTop !== last; i++) {
        last = s.scrollTop;
        s.scrollBy(0, window.innerHeight * 0.8);
        await sleep(150);
        el = document.querySelector(sel);
      }
    }
    if (el) highlight(el);
    return !!el;
  }

  window.__riseHtmlFinder = { scan, crawl, goTo };
})();
