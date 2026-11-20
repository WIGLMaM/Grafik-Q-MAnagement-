#!/usr/bin/env node
/* =====================================================================
   Prüfscript für Rise-Codes

   Aufruf:
     node rise-codes/pruefen.js                      prüft alle Codes in rise-codes/codes/
     node rise-codes/pruefen.js datei.html …         prüft einzelne Dateien
     node rise-codes/pruefen.js --aktualisieren      ersetzt in allen Codes die Bausteine
                                                     durch die aktuelle Version aus
                                                     rise-codes/vorgaben/bausteine/
   ✖ = Fehler (muss behoben werden)   ⚠ = Hinweis (bitte prüfen)
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---------- Einstellungen ---------- */
const SPRACHEN = ['de', 'fr', 'it', 'en'];
const ROOT = __dirname;
const CODES_DIR = path.join(ROOT, 'codes');
const BAUSTEIN_DIR = path.join(ROOT, 'vorgaben', 'bausteine');
const BAUSTEINE = [
  { name:'sprachsystem',     datei:'sprachsystem.html' },
  { name:'corporate-design', datei:'corporate-design.css' },
  { name:'lektoratsmodus',   datei:'lektoratsmodus.html' }
];

/* ---------- Hilfsfunktionen ---------- */
function findTexteBlock(src){
  const m = /const\s+TEXTE\s*=\s*/.exec(src);
  if(!m) return null;
  let i = m.index + m[0].length;
  if(src[i] !== '{') return null;
  const start = i;
  let depth = 0;
  for(; i < src.length; i++){
    const c = src[i];
    if(c === '"' || c === "'" || c === '`'){
      const q = c; i++;
      while(i < src.length && src[i] !== q){ if(src[i] === '\\') i++; i++; }
    } else if(c === '/' && src[i+1] === '/'){ while(i < src.length && src[i] !== '\n') i++; }
    else if(c === '/' && src[i+1] === '*'){ i = src.indexOf('*/', i + 2) + 1; if(i === 0) return null; }
    else if(c === '{' || c === '['){ depth++; }
    else if(c === '}' || c === ']'){ depth--; if(depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

function flatten(node, p = [], out = []){
  if(typeof node === 'string') out.push({ key:p.join('.'), value:node });
  else if(Array.isArray(node)) node.forEach((v, i) => flatten(v, p.concat(i), out));
  else if(node && typeof node === 'object') Object.keys(node).forEach(k => flatten(node[k], p.concat(k), out));
  return out;
}

const placeholders = t => (t.match(/\{\w+\}/g) || []).sort().join();
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

function bausteinRegex(name){
  const n = name.replace(/[-]/g, '\\-');
  return new RegExp('^[^\\n]*BAUSTEIN:' + n + ' START[^\\n]*\\n[\\s\\S]*?^[^\\n]*BAUSTEIN:' + n + ' ENDE[^\\n]*$', 'm');
}
function bausteinSoll(b){ return fs.readFileSync(path.join(BAUSTEIN_DIR, b.datei), 'utf8').replace(/\s+$/, ''); }
const norm = s => s.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();

function jetzt(){
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}

/* Teile des Codes ohne Bausteine (für die Design-Prüfung) */
function ohneBausteine(src){
  let s = src;
  BAUSTEINE.forEach(b => { s = s.replace(bausteinRegex(b.name), m => m.replace(/[^\n]/g, ' ')); });
  return s;
}

/* ---------- Statische Prüfung ---------- */
function pruefeStatisch(datei, src, fehler, hinweise){
  const sprache = /const\s+SPRACHE\s*=\s*['"]([^'"]*)['"]/.exec(src);
  const codeId = /const\s+CODE_ID\s*=\s*['"]([^'"]*)['"]/.exec(src);
  const stand = /const\s+STAND\s*=\s*['"]([^'"]*)['"]/.exec(src);
  if(!sprache) fehler.push('Zeile «const SPRACHE = …» fehlt.');
  else if(!SPRACHEN.includes(sprache[1])) fehler.push(`SPRACHE ist «${sprache[1]}», erlaubt: ${SPRACHEN.join(', ')}.`);
  if(!codeId) fehler.push('Zeile «const CODE_ID = …» fehlt.');
  else {
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(codeId[1])) fehler.push(`CODE_ID «${codeId[1]}» ist ungültig: nur Kleinbuchstaben, Ziffern und Bindestriche.`);
    const base = path.basename(datei).replace(/\.html?$/i, '');
    if(base !== codeId[1]) hinweise.push(`Dateiname «${base}» und CODE_ID «${codeId[1]}» sind verschieden. Empfohlen: Datei «${codeId[1]}.html».`);
  }
  if(!stand) fehler.push('Zeile «const STAND = …» fehlt.');

  // Texte
  let texte = null;
  const lit = findTexteBlock(src);
  if(!lit) fehler.push('Sprachblock «const TEXTE = { … }» fehlt.');
  else {
    try{ texte = new Function('"use strict"; return (' + lit + ');')(); }
    catch(e){ fehler.push('Sprachblock lässt sich nicht lesen: ' + e.message); }
  }
  if(texte){
    SPRACHEN.forEach(l => { if(!texte[l]) fehler.push(`Sprache «${l}» fehlt im Sprachblock.`); });
    Object.keys(texte).filter(l => !SPRACHEN.includes(l)).forEach(l => hinweise.push(`Unbekannte Sprache «${l}» im Sprachblock.`));
    if(texte.de){
      const de = flatten(texte.de);
      if(!de.some(t => t.key === 'seitentitel')) hinweise.push('Text «seitentitel» fehlt (Titel des Browser-Tabs).');
      SPRACHEN.filter(l => l !== 'de' && texte[l]).forEach(l => {
        const map = new Map(flatten(texte[l]).map(t => [t.key, t.value]));
        de.forEach(t => {
          if(!map.has(t.key)) fehler.push(`${l.toUpperCase()}: Text «${t.key}» fehlt.`);
          else if(!map.get(t.key).trim()) fehler.push(`${l.toUpperCase()}: Text «${t.key}» ist leer.`);
          else if(placeholders(map.get(t.key)) !== placeholders(t.value)) fehler.push(`${l.toUpperCase()}: Platzhalter in «${t.key}» stimmen nicht mit Deutsch überein.`);
        });
        const deKeys = new Set(de.map(t => t.key));
        [...map.keys()].filter(k => !deKeys.has(k)).forEach(k => hinweise.push(`${l.toUpperCase()}: Text «${k}» gibt es auf Deutsch nicht.`));
      });
      de.filter(t => !t.value.trim()).forEach(t => fehler.push(`DE: Text «${t.key}» ist leer.`));
    }
  }

  // Bausteine
  BAUSTEINE.forEach(b => {
    const m = bausteinRegex(b.name).exec(src);
    if(!m) fehler.push(`Baustein «${b.name}» fehlt.`);
    else if(norm(m[0]) !== norm(bausteinSoll(b))) fehler.push(`Baustein «${b.name}» ist veraltet oder verändert. Beheben mit: node rise-codes/pruefen.js --aktualisieren`);
  });

  // Design und Texte im individuellen Teil
  const indiv = ohneBausteine(src);
  const styleParts = [];
  indiv.replace(/<style>([\s\S]*?)<\/style>/g, (all, css, off) => { styleParts.push({ css, off: off + 7 }); return all; });
  const farben = [], schriften = [], groessen = [];
  styleParts.forEach(({ css, off }) => {
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
    let m;
    const reFarbe = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
    while((m = reFarbe.exec(ohneKommentare))) farben.push(lineOf(src, off + m.index));
    const reSchrift = /font-family\s*:\s*([^;}]+)/g;
    while((m = reSchrift.exec(ohneKommentare))) if(!/var\(--cd-schrift/.test(m[1]) && !/inherit/.test(m[1])) schriften.push(lineOf(src, off + m.index));
    const reGroesse = /font-size\s*:\s*([^;}]+)/g;
    while((m = reGroesse.exec(ohneKommentare))) if(!/var\(--cd-/.test(m[1]) && !/inherit|^\s*1em|%/.test(m[1])) groessen.push(lineOf(src, off + m.index));
  });
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(indiv) || [, ''])[1];
  const bodyOff = indiv.indexOf(body);
  let m;
  const reAttrFarbe = /(?:fill|stroke|color|stop-color)\s*=\s*"(#[0-9a-fA-F]{3,8}|rgb[^"]*)"/g;
  while((m = reAttrFarbe.exec(body))) farben.push(lineOf(src, bodyOff + m.index));
  const reInlineFarbe = /style="[^"]*(#[0-9a-fA-F]{3,8}|rgba?\()/g;
  while((m = reInlineFarbe.exec(body))) farben.push(lineOf(src, bodyOff + m.index));
  if(farben.length) hinweise.push(`Feste Farben statt CD-Variablen (var(--cd-…)) in Zeile ${[...new Set(farben)].join(', ')}.`);
  if(schriften.length) hinweise.push(`Schrift nicht aus dem CD (var(--cd-schrift)) in Zeile ${schriften.join(', ')}.`);
  if(groessen.length) hinweise.push(`Schriftgrösse nicht aus dem CD (var(--cd-…)) in Zeile ${groessen.join(', ')}.`);

  // Sichtbarer Text direkt im HTML
  const sichtbar = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split('\n').map(t => t.trim()).filter(t => /\p{L}{2,}/u.test(t));
  if(sichtbar.length) hinweise.push('Text steht direkt im HTML statt im Sprachblock: ' + sichtbar.slice(0, 5).map(t => '«' + t.slice(0, 40) + '»').join(', ') + (sichtbar.length > 5 ? ' …' : ''));

  return texte;
}

/* ---------- Prüfung im Browser (falls Playwright vorhanden) ---------- */
async function pruefeBrowser(dateien, ergebnisse){
  let chromium;
  try{ ({ chromium } = require('playwright')); }
  catch(e){ console.log('⚠ Playwright nicht gefunden: Browser-Prüfung übersprungen.\n'); return; }
  const browser = await chromium.launch();
  for(const datei of dateien){
    const r = ergebnisse.get(datei);
    if(!r.texte) continue;
    const page = await browser.newPage({ viewport:{ width:1100, height:900 } });
    await page.route('https://fonts.googleapis.com/**', x => x.abort());
    await page.route('https://fonts.gstatic.com/**', x => x.abort());
    const jsFehler = [];
    page.on('pageerror', e => jsFehler.push(e.message));
    const angezeigt = new Set();
    for(const l of SPRACHEN){
      if(!r.texte[l]) continue;
      jsFehler.length = 0;
      await page.goto('file://' + path.resolve(datei) + '?lang=' + l);
      await page.waitForTimeout(150);
      const info = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[data-key]')];
        return {
          leer: els.filter(e => !e.textContent.trim()).map(e => e.dataset.key),
          keys: els.map(e => e.dataset.key)
        };
      });
      info.keys.forEach(k => angezeigt.add(k));
      if(jsFehler.length) r.fehler.push(`${l.toUpperCase()}: JavaScript-Fehler: ${jsFehler[0]}`);
      if(info.leer.length) r.fehler.push(`${l.toUpperCase()}: leere Textstellen (Text fehlt oder data-key falsch): ${[...new Set(info.leer)].slice(0, 6).join(', ')}`);
      if(l === 'de'){
        await page.mouse.click(5, 5);
        await page.keyboard.press('Control+Alt+KeyL');
        await page.waitForTimeout(400);
        const lk = await page.evaluate(() => {
          const bar = document.querySelector('.lk-bar');
          const versteckt = [...document.querySelectorAll('[data-key]')].filter(e => {
            const rc = e.getBoundingClientRect();
            const st = getComputedStyle(e);
            return rc.width === 0 || rc.height === 0 || st.visibility === 'hidden';
          }).map(e => e.dataset.key);
          return { an: !!bar && !bar.hidden && document.body.classList.contains('lektorat'), versteckt };
        });
        if(!lk.an) r.fehler.push('Lektoratsmodus lässt sich mit Ctrl+Alt+L nicht einschalten.');
        else if(lk.versteckt.length) r.hinweise.push('Im Lektoratsmodus nicht sichtbar (CSS für body.lektorat ergänzen): ' + [...new Set(lk.versteckt)].slice(0, 6).join(', '));
      }
    }
    const nie = flatten(r.texte.de).map(t => t.key).filter(k => k !== 'seitentitel' && !angezeigt.has(k));
    if(nie.length) r.hinweise.push('Texte, die beim Öffnen nicht angezeigt werden (evtl. erst nach einer Aktion): ' + nie.slice(0, 6).join(', ') + (nie.length > 6 ? ' …' : ''));
    await page.close();
  }
  await browser.close();
}

/* ---------- Bausteine aktualisieren ---------- */
function aktualisiere(datei){
  let src = fs.readFileSync(datei, 'utf8');
  const vorher = src;
  const fehlend = [];
  BAUSTEINE.forEach(b => {
    const re = bausteinRegex(b.name);
    if(re.test(src)) src = src.replace(re, () => bausteinSoll(b));
    else fehlend.push(b.name);
  });
  if(src !== vorher){
    src = src.replace(/const\s+STAND\s*=\s*(['"])(.*?)\1\s*;?/, `const STAND = '${jetzt()} · Bausteine aktualisiert';`);
    fs.writeFileSync(datei, src);
    console.log(`↻ ${path.basename(datei)}: Bausteine aktualisiert, neuer Stand gesetzt.`);
  } else console.log(`= ${path.basename(datei)}: bereits aktuell.`);
  fehlend.forEach(n => console.log(`  ✖ Baustein «${n}» fehlt und kann nicht automatisch eingefügt werden.`));
}

/* ---------- Ablauf ---------- */
(async () => {
  const args = process.argv.slice(2);
  const modusAkt = args.includes('--aktualisieren');
  let dateien = args.filter(a => !a.startsWith('--'));
  if(!dateien.length) dateien = fs.readdirSync(CODES_DIR).filter(f => /\.html?$/i.test(f)).map(f => path.join(CODES_DIR, f));
  if(!dateien.length){ console.log('Keine Codes gefunden.'); return; }

  if(modusAkt){ dateien.forEach(aktualisiere); console.log(''); }

  const ergebnisse = new Map();
  dateien.forEach(d => {
    const src = fs.readFileSync(d, 'utf8');
    const fehler = [], hinweise = [];
    const texte = pruefeStatisch(d, src, fehler, hinweise);
    ergebnisse.set(d, { fehler, hinweise, texte });
  });
  await pruefeBrowser(dateien, ergebnisse);

  let total = 0;
  ergebnisse.forEach((r, d) => {
    const status = r.fehler.length ? '✖' : (r.hinweise.length ? '⚠' : '✔');
    console.log(`${status} ${path.relative(process.cwd(), d)}`);
    r.fehler.forEach(f => console.log('   ✖ ' + f));
    r.hinweise.forEach(h => console.log('   ⚠ ' + h));
    total += r.fehler.length;
  });
  console.log(`\n${ergebnisse.size} Code(s) geprüft, ${total} Fehler.`);
  process.exitCode = total ? 1 : 0;
})();
