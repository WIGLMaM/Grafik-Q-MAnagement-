// TrapFinder – wird im Seitenkontext (MAIN world) des Rise-Kurses ausgeführt.
// Stellt window.__riseHtmlFinder mit scan(), crawl() und goTo() bereit.
(() => {
  // Bei neuer Version der Erweiterung den alten Scanner in der Seite ersetzen
  const VERSION = '2.2.0';
  if (window.__riseHtmlFinder && window.__riseHtmlFinder.version === VERSION) return;

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

  // Titel können im Editor Objekte sein (z. B. pro Sprache) – Text daraus lesen.
  function textOf(v, depth = 4) {
    if (v == null || depth < 0) return '';
    if (typeof v === 'string') return stripHtml(v);
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.map((x) => textOf(x, depth - 1)).filter(Boolean).join(' ');
    if (typeof v === 'object') {
      const lang = (navigator.language || '').slice(0, 2).toLowerCase();
      for (const k of [lang, 'de', 'en', 'text', 'value', 'title', 'plain', 'label', 'html', 'content']) {
        if (k && k in v) {
          const t = textOf(v[k], depth - 1);
          if (t) return t;
        }
      }
      for (const k of Object.keys(v)) {
        const t = textOf(v[k], depth - 1);
        if (t) return t;
      }
    }
    return '';
  }

  // Erster lesbarer Text eines Blocks (z. B. Überschrift in einem Custom Block)
  function firstText(block) {
    const skip = /^(id|key|type|family|variant|src|url|href|style|class|color|font|align|layout|.*Id|.*Url|.*Color)$/i;
    for (const { key, value } of allStrings(block)) {
      if (skip.test(key) || /^https?:|^#|^[\w-]{16,}$/.test(value)) continue;
      const t = stripHtml(value);
      if (t.length >= 3 && /[A-Za-zÄÖÜäöü]{3}/.test(t) && !/^[{[]/.test(t)) return t.slice(0, 80);
    }
    return '';
  }

  const baseUrl = () => location.href.split('#')[0];
  const isAuthoring = () => /\/authoring\//.test(location.pathname);

  // Link zu einer Lektion: im Editor aus der Seite übernehmen, im Kurs-Player per Hash.
  function lessonLink(id) {
    const a = id && document.querySelector(`a[href*="${CSS.escape(id)}"]`);
    if (a) return a.href;
    return isAuthoring() ? location.href : `${baseUrl()}#/lessons/${id}`;
  }
  const lessonUrl = lessonLink;

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

  // Kurs aus den mitgelesenen Serverantworten (capture.js) zusammensetzen.
  function courseFromCapture() {
    const cap = window.__riseCapture;
    if (!cap) return null;
    const lessons = cap.lessons || {};
    const course = cap.courses.slice().sort((a, b) => b.lessons.length - a.lessons.length)[0];
    if (course) {
      return {
        ...course,
        lessons: course.lessons.map((l) =>
          l && (!Array.isArray(l.items) || !l.items.length) && lessons[l.id] ? { ...l, items: lessons[l.id].items } : l
        ),
      };
    }
    const list = Object.values(lessons);
    return list.length ? { title: document.title, lessons: list } : null;
  }

  function findCourse() {
    const captured = courseFromCapture();
    if (captured && captured.lessons.some((l) => l && Array.isArray(l.items) && l.items.length)) return captured;
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
    return captured;
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

  const STORYLINE_SRC = /story(_html5)?\.html|storyline/i;
  // PDF- und Word-Dateien
  const DOC_EXT = /\.(pdf|docx?|dotx|docm|rtf|odt)(?=$|[?#"'\s])/i;

  function isStoryline(block, typeStr) {
    if (/storyline/i.test(typeStr)) return true;
    return collectStrings(block, /^(src|url|type|kind|mediaType)$/i).some((s) => STORYLINE_SRC.test(s));
  }

  // Alle Strings eines Blocks mit Schlüsselpfad
  function allStrings(obj, path = '', out = [], depth = 10, seen = new WeakSet()) {
    if (!obj || typeof obj !== 'object' || depth < 0 || seen.has(obj)) return out;
    seen.add(obj);
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === 'string') out.push({ key: k, path: p, value: v });
      else if (v && typeof v === 'object') allStrings(v, p, out, depth - 1, seen);
    }
    return out;
  }

  const fileBase = (u) => {
    let f = String(u).split(/[?#]/)[0].split(/[\\/]/).pop() || '';
    try { f = decodeURIComponent(f); } catch (_) { /* ignore */ }
    return f;
  };

  // PDF-/Word-Dateien eines Blocks finden (Anhänge, Links in Text und Buttons)
  function findDocuments(block, typeStr) {
    const files = new Map(); // Dateiname -> URL
    for (const { key, value } of allStrings(block)) {
      if (/<a\b|href\s*=/i.test(value)) {
        const re = /href\s*=\s*["']([^"']+)["']/gi;
        let m;
        while ((m = re.exec(value))) if (DOC_EXT.test(m[1])) files.set(fileBase(m[1]), m[1]);
      } else if (value.length < 2000 && DOC_EXT.test(value)) {
        const isName = /name|title|file/i.test(key) && !/[\\/]/.test(value);
        const name = isName ? value.trim() : fileBase(value);
        if (!name) continue;
        if (![...files.keys()].some((n) => n.toLowerCase() === name.toLowerCase())) {
          files.set(name, /^https?:|^\//.test(value) ? value : files.get(name) || '');
        }
      }
    }
    // Anhang-Block ohne erkennbare Dateiendung trotzdem melden
    if (!files.size && /attachment/i.test(typeStr)) {
      const n = collectStrings(block, /^(fileName|filename|originalName|name|title)$/i, [], 8).map(stripHtml).filter(Boolean)[0];
      return [{ name: n || 'Anhang (Dateityp unbekannt)', url: '' }];
    }
    // Namen bevorzugen, die nicht nur aus einer Hash-ID bestehen
    return [...files.entries()].map(([name, url]) => ({ name, url }));
  }

  // Name der Storyline-Datei/-Projekt aus den Blockdaten
  function storylineInfo(block) {
    const strings = allStrings(block);
    const story = strings.find((x) => /story(_html5)?\.html/i.test(x.value) && x.value.length < 1000);
    let storyUrl = '';
    if (story) {
      const v = story.value.trim();
      try { storyUrl = new URL(v, location.href).href; } catch (_) { /* ignore */ }
    }
    const generic = /^(storyline|story|story\.html|index|untitled|ohne titel)$/i;
    const names = strings
      .filter((x) => /^(title|name|fileName|filename|originalName|originalFilename|projectName|displayName)$/i.test(x.key))
      .map((x) => ({ path: x.path, v: stripHtml(x.value).replace(/\.(story|zip|html?)$/i, '').trim() }))
      .filter((x) => x.v && x.v.length < 200 && !/^https?:|[\\/]/.test(x.v) && !generic.test(x.v));
    // Werte aus Storyline-/Media-Objekten bevorzugen
    names.sort((a, b) => (/storyline|media|file/i.test(b.path) ? 1 : 0) - (/storyline|media|file/i.test(a.path) ? 1 : 0));
    return { slName: names[0] ? names[0].v : '', storyUrl };
  }

  function describeBlock(block) {
    const typeStr = [block.type, block.family, block.variant].filter(Boolean).join(' / ');
    const out = [];
    const storyline = isStoryline(block, typeStr);
    const scenario = !storyline && /scenario/i.test(typeStr);
    const hint = TYPE_HINT.test(typeStr);
    const raw = storyline || scenario ? null : findRawHtml(block);

    if (storyline || scenario || hint) {
      let kind;
      if (storyline) kind = 'Storyline';
      else if (scenario) kind = 'Szenario';
      else if (/mondrian/i.test(typeStr)) kind = 'Custom Block'; // Rise-intern: Custom Blocks
      else if (/embed|iframe/i.test(typeStr)) kind = 'Embed';
      else if (/code|html/i.test(typeStr)) kind = 'Code-/HTML-Block';
      else if (/custom/i.test(typeStr)) kind = 'Custom Block';
      else kind = 'Code-/HTML-Block';

      const urls = extractUrls(raw, block);
      const sl = storyline ? storylineInfo(block) : { slName: '', storyUrl: '' };
      if (sl.storyUrl && !urls.includes(sl.storyUrl)) urls.unshift(sl.storyUrl);
      const titleCandidates = ['title', 'heading', 'name', 'caption', 'label']
        .map((k) => textOf(block[k]))
        .concat(collectStrings(block, /^(title|heading|name|caption|label)$/i, [], 3).map(stripHtml))
        .filter(Boolean);
      let name = sl.slName || titleCandidates[0] || '';
      if (!name && !storyline && kind !== 'Code-/HTML-Block') name = firstText(block);
      if (!name && !storyline && urls[0]) name = hostOf(urls[0]);
      if (!name && raw) name = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
      if (!name) name = storyline ? 'Storyline-Block (ohne Titel)' : scenario ? 'Szenario (ohne Titel)' : '(ohne Titel)';

      const codeSource = raw || collectStrings(block, /(code|html|embed|content|markup)/i)[0] || '';
      out.push({
        kind,
        blockType: typeStr || '–',
        name,
        nameFromData: !!(sl.slName || titleCandidates[0]),
        storyUrl: sl.storyUrl,
        urls,
        preview: String(codeSource).replace(/\s+/g, ' ').trim().slice(0, 400),
      });
    }

    if (!storyline) {
      const docs = findDocuments(block, typeStr);
      if (docs.length) {
        out.push({
          kind: 'Dokument',
          blockType: typeStr || '–',
          name: docs.map((d) => d.name).join(', '),
          nameFromData: true,
          storyUrl: '',
          urls: docs.map((d) => d.url).filter(Boolean).slice(0, 10),
          preview: docs.map((d) => d.name).join(' | '),
        });
      }
    }
    return out;
  }

  function analyzeCourse(course) {
    const items = [];
    let chapter = '';
    let lessonNo = 0;
    for (const lesson of course.lessons || []) {
      if (!lesson) continue;
      if (lesson.type === 'section') {
        chapter = textOf(lesson.title);
        continue;
      }
      lessonNo++;
      (lesson.items || []).forEach((block, i) => {
        if (!block || typeof block !== 'object') return;
        for (const d of describeBlock(block)) items.push({
          chapter: chapter || '–',
          lesson: textOf(lesson.title) || `Lektion ${lessonNo}`,
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
    for (const a of document.querySelectorAll('a[href*="#/lessons/"], a[href*="/lesson/"], a[href*="/lessons/"]')) {
      const m = (a.getAttribute('href') || '').match(/\/lessons?\/([^/?#]+)/);
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
        courseTitle: textOf(course.title) || document.title.replace(/\s*\|\s*Rise 360\s*$/i, ''),
        baseUrl: baseUrl(),
        lessonCount: (course.lessons || []).filter((l) => l && l.type !== 'section').length,
        lessonsWithContent: (course.lessons || []).filter((l) => l && Array.isArray(l.items) && l.items.length).length,
        authoring: isAuthoring(),
        items,
      };
    }
    return { source: 'none', authoring: isAuthoring(), courseTitle: document.title, baseUrl: baseUrl(), lessonLinks: lessonLinks().length, items: [] };
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
      const base = {
        chapter: '–', lesson: lesson.title, lessonNo, lessonId: lesson.id,
        blockId: b.getAttribute('data-block-id'), blockNo: i + 1, url: lessonUrl(lesson.id),
        blockType: 'aus Seitenansicht erkannt', nameFromData: false, storyUrl: '',
      };
      const docs = [...b.querySelectorAll('a[href]')].filter((a) => DOC_EXT.test(a.getAttribute('href')));
      if (docs.length) {
        const names = [...new Set(docs.map((a) => a.getAttribute('download') || fileBase(a.getAttribute('href'))))];
        out.push({ ...base, kind: 'Dokument', name: names.join(', '), nameFromData: true,
          urls: docs.map((a) => a.href).slice(0, 10), preview: names.join(' | ') });
      }
      const iframe = b.querySelector('iframe');
      const code = b.querySelector('pre, code');
      const scenario = /scenario/i.test(b.className) || b.querySelector('[class*="scenario" i]');
      if (!iframe && !code && !scenario && !/custom/i.test(b.className)) return;
      const src = iframe ? iframe.getAttribute('src') || '' : '';
      const storyline = STORYLINE_SRC.test(src) || /storyline/i.test(b.className) || b.querySelector('[class*="storyline" i]');
      const custom = /custom/i.test(b.className) || b.querySelector('[class*="custom-block" i], [class*="customBlock" i]');
      const kind = storyline ? 'Storyline' : scenario ? 'Szenario' : custom ? 'Custom Block' : iframe ? 'Embed' : 'Code-/HTML-Block';
      const heading = stripHtml((b.querySelector('h1,h2,h3,h4') || {}).textContent);
      out.push({
        ...base,
        kind,
        storyUrl: storyline && src ? new URL(src, location.href).href : '',
        name: (iframe && iframe.title) || heading || (src && hostOf(src)) || '(ohne Titel)',
        urls: src && !src.startsWith('about:') ? [src] : [],
        preview: iframe
          ? (iframe.getAttribute('srcdoc') || src).slice(0, 400)
          : stripHtml((code || b).textContent).slice(0, 400),
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
    if (lessonId && !location.href.includes(lessonId)) {
      const a = document.querySelector(`a[href*="${CSS.escape(lessonId)}"]`);
      if (a) a.click();
      else if (!isAuthoring()) location.hash = `#/lessons/${lessonId}`;
      else return false;
    }
    if (!blockId) return true;
    const id = CSS.escape(blockId);
    const sel = `[data-block-id="${id}"], [data-id="${id}"], [id="${id}"], [id$="${id}"]`;
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

  // Strukturinfos zur Fehlersuche – ohne Kursinhalte.
  function diagnose() {
    const cap = window.__riseCapture;
    let std = new Set();
    try {
      const f = document.createElement('iframe');
      f.style.display = 'none';
      document.documentElement.appendChild(f);
      std = new Set(Object.keys(f.contentWindow));
      f.remove();
    } catch (_) { /* ignore */ }
    const dataAttrs = new Set();
    for (const el of document.querySelectorAll('*')) {
      for (const at of el.attributes) if (at.name.startsWith('data-')) dataAttrs.add(at.name);
      if (dataAttrs.size > 60) break;
    }
    const hrefs = [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href').replace(/[A-Za-z0-9_-]{12,}/g, '…'))
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .slice(0, 25);
    return {
      url: location.origin + location.pathname.replace(/[A-Za-z0-9_-]{12,}/g, '…'),
      hash: location.hash.replace(/[A-Za-z0-9_-]{12,}/g, '…'),
      frame: window === window.top ? 'top' : 'iframe',
      captureAktiv: !!cap,
      gefundeneKurse: cap ? cap.courses.map((c) => ({ lektionen: c.lessons.length, keys: Object.keys(c).slice(0, 15), lektionKeys: Object.keys(c.lessons[0] || {}) })) : [],
      lektionenMitBloecken: cap ? Object.keys(cap.lessons).length : 0,
      anfragen: cap ? cap.log.map((l) => ({ ...l, url: l.url.replace(/[A-Za-z0-9_-]{12,}/g, '…') })) : [],
      globaleVariablen: Object.keys(window).filter((k) => !std.has(k)).slice(0, 60),
      dataAttribute: [...dataAttrs],
      links: hrefs,
      iframes: [...document.querySelectorAll('iframe')].map((f) => (f.src || '').replace(/[A-Za-z0-9_-]{12,}/g, '…')).slice(0, 10),
    };
  }

  window.__riseHtmlFinder = { version: VERSION, scan, crawl, goTo, diagnose };
})();
