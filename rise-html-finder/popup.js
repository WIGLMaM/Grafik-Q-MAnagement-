const $ = (id) => document.getElementById(id);
let tab = null;
let state = null; // { result, frameId }

const KINDS = [
  { id: 'Embed', label: 'Embed (iFrame)' },
  { id: 'Code-/HTML-Block', label: 'HTML (Code-Block)' },
  { id: 'Custom Block', label: 'Custom Block' },
  { id: 'Storyline', label: 'Storyline (SL)' },
  { id: 'Szenario', label: 'Szenario' },
];
const kindLabel = (k) => (KINDS.find((x) => x.id === k) || {}).label || k;
let selected = new Set(KINDS.map((k) => k.id));

const visibleItems = () => (state && state.result ? state.result.items.filter((it) => selected.has(it.kind)) : []);

function renderFilters() {
  const box = $('filters');
  box.querySelectorAll('label').forEach((l) => l.remove());
  const all = state && state.result ? state.result.items : null;
  for (const k of KINDS) {
    const count = all ? all.filter((it) => it.kind === k.id).length : null;
    const label = document.createElement('label');
    label.innerHTML =
      `<input type="checkbox" value="${esc(k.id)}" ${selected.has(k.id) ? 'checked' : ''}>` +
      `${esc(k.label)}${count === null ? '' : ` <span class="count">(${count})</span>`}`;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) selected.add(k.id);
      else selected.delete(k.id);
      onFilterChange();
    });
    box.appendChild(label);
  }
}

async function onFilterChange() {
  await chrome.storage.local.set({ selectedKinds: [...selected], knownKinds: KINDS.map((k) => k.id) });
  if (state && state.result) render();
  else renderFilters();
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setStatus(html) { $('status').innerHTML = html; }

async function inject(frameIds) {
  const target = frameIds ? { tabId: tab.id, frameIds } : { tabId: tab.id, allFrames: true };
  await chrome.scripting.executeScript({ target, files: ['scanner.js'], world: 'MAIN' });
  return target;
}

async function run(target, method, args = []) {
  return chrome.scripting.executeScript({
    target,
    world: 'MAIN',
    func: (m, a) => (window.__riseHtmlFinder ? window.__riseHtmlFinder[m](...a) : null),
    args: [method, args],
  });
}

async function save() {
  await chrome.storage.session.set({ [`tab_${tab.id}`]: { ...state, pageUrl: tab.url.split('#')[0] } });
}

async function scan() {
  $('scan').disabled = true;
  $('fallback').hidden = true;
  setStatus('Kurs wird untersucht …');
  try {
    const target = await inject();
    const frames = (await run(target, 'scan')).filter((f) => f.result);
    const withData = frames.filter((f) => f.result.source === 'data');
    if (withData.length) {
      withData.sort((a, b) => b.result.items.length - a.result.items.length);
      state = { result: withData[0].result, frameId: withData[0].frameId };
      await save();
      render();
      return;
    }
    const withLinks = frames.filter((f) => f.result.lessonLinks > 0).sort((a, b) => b.result.lessonLinks - a.result.lessonLinks);
    if (withLinks.length) {
      state = { result: null, frameId: withLinks[0].frameId, lessonLinks: withLinks[0].result.lessonLinks };
      setStatus(`Keine Kursdaten gefunden, aber <strong>${withLinks[0].result.lessonLinks}</strong> Lektionen in der Navigation.`);
      $('fallback').hidden = false;
    } else if (frames.some((f) => f.result.authoring)) {
      setStatus('Im Rise-Editor wurden noch keine Kursdaten gefunden. Lade die Seite einmal neu (F5) und scanne dann erneut. ' +
        'Klappt es weiterhin nicht: Öffne <strong>Preview</strong> und scanne dort, oder klicke unten auf «Diagnose».');
    } else {
      setStatus('Auf dieser Seite wurde kein Rise-Kurs erkannt. Öffne den Kurs-Link (z.&nbsp;B. den Freigabe-Link) und versuche es erneut.');
    }
  } catch (e) {
    setStatus(`Fehler: ${esc(e.message)}<br>Hinweis: Auf chrome://-Seiten und im Chrome Web Store funktionieren Erweiterungen nicht.`);
  } finally {
    $('scan').disabled = false;
  }
}

async function crawl() {
  $('crawl').disabled = true;
  $('scan').disabled = true;
  setStatus(`Durchsuche ${state.lessonLinks} Lektionen … Bitte das Fenster offen lassen.`);
  try {
    const target = await inject([state.frameId]);
    const [res] = await run(target, 'crawl');
    state.result = res.result;
    await save();
    $('fallback').hidden = true;
    render();
  } catch (e) {
    setStatus(`Fehler: ${esc(e.message)}`);
  } finally {
    $('crawl').disabled = false;
    $('scan').disabled = false;
  }
}

function render() {
  const r = state.result;
  const box = $('results');
  box.innerHTML = '';
  renderFilters();
  const items = visibleItems();
  const n = items.length;
  setStatus(
    `<strong>${esc(r.courseTitle)}</strong><br>` +
      (selected.size === 0
        ? 'Keine Kategorie ausgewählt.'
        : n
        ? `${n} Fundstelle${n === 1 ? '' : 'n'} in ${r.lessonCount} Lektionen` +
          (n < r.items.length ? ` (${r.items.length} insgesamt)` : '') +
          '. Klick auf einen Eintrag springt dorthin.'
        : `Keine passenden Blöcke in ${r.lessonCount} Lektionen gefunden` +
          (r.items.length ? ` (${r.items.length} in anderen Kategorien)` : '') + '.') +
      (r.source === 'dom' ? '<br><em>Quelle: Seitenansicht (Kapitel nicht verfügbar)</em>' : '') +
      (r.source === 'data' && r.lessonsWithContent === 0
        ? '<br><strong>Achtung:</strong> Die Kursstruktur wurde gefunden, die Blockinhalte aber nicht. Öffne <strong>Preview</strong> und scanne dort.'
        : r.source === 'data' && r.lessonsWithContent < r.lessonCount
        ? `<br><em>Inhalte von ${r.lessonsWithContent} der ${r.lessonCount} Lektionen geladen. Für alle Lektionen: in der Preview scannen.</em>`
        : '')
  );
  $('actions').hidden = n === 0;

  let lastChapter = null;
  let lastLesson = null;
  items.forEach((it) => {
    if (it.chapter !== lastChapter) {
      lastChapter = it.chapter;
      lastLesson = null;
      if (it.chapter !== '–') box.insertAdjacentHTML('beforeend', `<div class="chapter">${esc(it.chapter)}</div>`);
    }
    if (it.lessonId !== lastLesson) {
      lastLesson = it.lessonId;
      box.insertAdjacentHTML('beforeend', `<div class="lesson">${it.lessonNo}. ${esc(it.lesson)}</div>`);
    }
    const btn = document.createElement('button');
    btn.className = 'item';
    btn.title = it.preview || it.name;
    btn.innerHTML =
      `<span class="name"><span class="badge">${esc(kindLabel(it.kind))}</span>${esc(it.name)}</span>` +
      `<span class="meta">Block ${it.blockNo}${it.urls[0] ? ' · ' + esc(it.urls[0]) : ''}` +
      `${it.blockType && it.blockType !== '–' ? ' · Rise-Typ: ' + esc(it.blockType) : ''}</span>`;
    btn.addEventListener('click', () => goTo(it));
    box.appendChild(btn);
  });
}

async function goTo(it) {
  try {
    const target = await inject([state.frameId]);
    const [res] = await run(target, 'goTo', [it.lessonId, it.blockId]);
    if (!res.result) setStatus(`Lektion geöffnet. Der Block «${esc(it.name)}» wurde nicht automatisch gefunden (Block ${it.blockNo}).`);
  } catch (_) {
    // Frame nicht mehr erreichbar (z. B. Seite neu geladen) – Lektion direkt öffnen.
    if (state.frameId === 0) await chrome.tabs.update(tab.id, { url: it.url });
    else setStatus('Die Kursseite wurde neu geladen. Bitte erneut scannen.');
  }
}

async function diagnose() {
  $('diagBox').hidden = false;
  $('diagText').value = 'Sammle Informationen …';
  try {
    const target = await inject();
    const frames = await run(target, 'diagnose');
    const out = {
      version: chrome.runtime.getManifest().version,
      frames: frames.map((f) => ({ frameId: f.frameId, ...(f.result || {}) })),
    };
    $('diagText').value = JSON.stringify(out, null, 1);
  } catch (e) {
    $('diagText').value = 'Fehler: ' + e.message;
  }
}

// ---------- Protokoll ----------

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const fileBase = () =>
  `Block-Protokoll_${(state.result.courseTitle || 'Rise-Kurs').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 60)}_${new Date().toISOString().slice(0, 10)}`;

function exportCsv() {
  const cols = ['Nr', 'Kapitel', 'Lektion-Nr', 'Lektion', 'Block-Nr', 'Typ', 'Name', 'Blocktyp (Rise)', 'Quellen', 'Link', 'Block-ID', 'Code-Vorschau'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = visibleItems().map((it, i) =>
    [i + 1, it.chapter, it.lessonNo, it.lesson, it.blockNo, kindLabel(it.kind), it.name, it.blockType, it.urls.join(' | '), it.url, it.blockId, it.preview].map(q).join(';')
  );
  download(`${fileBase()}.csv`, '﻿' + [cols.map(q).join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
}

function exportHtml() {
  const r = state.result;
  const date = new Date().toLocaleString('de-CH');
  const items = visibleItems();
  const rows = items
    .map(
      (it, i) => `<tr>
  <td>${i + 1}</td><td>${esc(it.chapter)}</td><td>${it.lessonNo}. ${esc(it.lesson)}</td><td>${it.blockNo}</td>
  <td>${esc(kindLabel(it.kind))}</td><td>${esc(it.name)}</td>
  <td>${it.urls.map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join('<br>')}</td>
  <td><a href="${esc(it.url)}">öffnen</a></td>
  <td><code>${esc(it.preview)}</code></td></tr>`
    )
    .join('\n');
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(fileBase())}</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#1f2328}
h1{font-size:20px;margin:0 0 4px}.meta{color:#656d76;margin-bottom:16px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #d8dee4;padding:6px 8px;vertical-align:top;text-align:left}
th{background:#f6f8fa}code{font-size:12px;word-break:break-all;white-space:pre-wrap}
</style></head><body>
<h1>Block-Protokoll: ${esc(r.courseTitle)}</h1>
<div class="meta">Kurs-Link: <a href="${esc(r.baseUrl)}">${esc(r.baseUrl)}</a><br>Erstellt: ${esc(date)} · ${items.length} Fundstellen in ${r.lessonCount} Lektionen<br>Kategorien: ${esc([...selected].join(', '))}${r.source === 'dom' ? ' · Quelle: Seitenansicht' : ''}</div>
<table><thead><tr><th>Nr</th><th>Kapitel</th><th>Lektion</th><th>Block</th><th>Typ</th><th>Name</th><th>Quellen</th><th>Link</th><th>Code-Vorschau</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  download(`${fileBase()}.html`, html, 'text/html;charset=utf-8');
}

// ---------- Start ----------

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  $('scan').addEventListener('click', scan);
  $('crawl').addEventListener('click', crawl);
  $('exportCsv').addEventListener('click', exportCsv);
  $('exportHtml').addEventListener('click', exportHtml);
  $('diagnose').addEventListener('click', diagnose);
  $('diagCopy').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('diagText').value);
    $('diagCopy').textContent = 'Kopiert ✓';
  });
  $('toggleAll').addEventListener('click', () => {
    selected = selected.size === KINDS.length ? new Set() : new Set(KINDS.map((k) => k.id));
    onFilterChange();
  });

  const { selectedKinds: stored, knownKinds } = await chrome.storage.local.get(['selectedKinds', 'knownKinds']);
  if (Array.isArray(stored)) {
    selected = new Set(stored.filter((k) => KINDS.some((x) => x.id === k)));
    // Neu hinzugekommene Kategorien standardmässig aktivieren
    const known = Array.isArray(knownKinds) ? knownKinds : ['Embed', 'Code-/HTML-Block', 'HTML im Inhalt', 'Storyline', 'Szenario'];
    KINDS.forEach((k) => { if (!known.includes(k.id)) selected.add(k.id); });
  }
  renderFilters();

  // Letztes Ergebnis für diesen Tab wieder anzeigen
  const key = `tab_${tab.id}`;
  const saved = (await chrome.storage.session.get(key))[key];
  if (saved && saved.result && tab.url && saved.pageUrl === tab.url.split('#')[0]) {
    state = saved;
    render();
  }
})();
