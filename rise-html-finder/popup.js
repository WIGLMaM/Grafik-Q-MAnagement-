const $ = (id) => document.getElementById(id);
let tab = null;
let state = null; // { result, frameId }

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
  const n = r.items.length;
  setStatus(
    `<strong>${esc(r.courseTitle)}</strong><br>` +
      (n
        ? `${n} HTML-Stelle${n === 1 ? '' : 'n'} in ${r.lessonCount} Lektionen gefunden. Klick auf einen Eintrag springt dorthin.`
        : `Keine manuell eingebauten HTML-Blöcke in ${r.lessonCount} Lektionen gefunden.`) +
      (r.source === 'dom' ? '<br><em>Quelle: Seitenansicht (Kapitel nicht verfügbar)</em>' : '')
  );
  $('actions').hidden = n === 0;

  let lastChapter = null;
  let lastLesson = null;
  r.items.forEach((it, idx) => {
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
      `<span class="name"><span class="badge">${esc(it.kind)}</span>${esc(it.name)}</span>` +
      `<span class="meta">Block ${it.blockNo}${it.urls[0] ? ' · ' + esc(it.urls[0]) : ''}</span>`;
    btn.addEventListener('click', () => goTo(idx));
    box.appendChild(btn);
  });
}

async function goTo(idx) {
  const it = state.result.items[idx];
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

// ---------- Protokoll ----------

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const fileBase = () =>
  `HTML-Protokoll_${(state.result.courseTitle || 'Rise-Kurs').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 60)}_${new Date().toISOString().slice(0, 10)}`;

function exportCsv() {
  const cols = ['Nr', 'Kapitel', 'Lektion-Nr', 'Lektion', 'Block-Nr', 'Typ', 'Name', 'Blocktyp (Rise)', 'Quellen', 'Link', 'Block-ID', 'Code-Vorschau'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = state.result.items.map((it, i) =>
    [i + 1, it.chapter, it.lessonNo, it.lesson, it.blockNo, it.kind, it.name, it.blockType, it.urls.join(' | '), it.url, it.blockId, it.preview].map(q).join(';')
  );
  download(`${fileBase()}.csv`, '﻿' + [cols.map(q).join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
}

function exportHtml() {
  const r = state.result;
  const date = new Date().toLocaleString('de-CH');
  const rows = r.items
    .map(
      (it, i) => `<tr>
  <td>${i + 1}</td><td>${esc(it.chapter)}</td><td>${it.lessonNo}. ${esc(it.lesson)}</td><td>${it.blockNo}</td>
  <td>${esc(it.kind)}</td><td>${esc(it.name)}</td>
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
<h1>HTML-Protokoll: ${esc(r.courseTitle)}</h1>
<div class="meta">Kurs-Link: <a href="${esc(r.baseUrl)}">${esc(r.baseUrl)}</a><br>Erstellt: ${esc(date)} · ${r.items.length} Fundstellen in ${r.lessonCount} Lektionen${r.source === 'dom' ? ' · Quelle: Seitenansicht' : ''}</div>
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

  // Letztes Ergebnis für diesen Tab wieder anzeigen
  const key = `tab_${tab.id}`;
  const saved = (await chrome.storage.session.get(key))[key];
  if (saved && saved.result && tab.url && saved.pageUrl === tab.url.split('#')[0]) {
    state = saved;
    render();
  }
})();
