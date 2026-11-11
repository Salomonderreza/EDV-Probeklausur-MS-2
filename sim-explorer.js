/* =====================================================================
   SIMULATION: DATEI-EXPLORER mit kleinem, veränderlichem Dateisystem.
   Unterstützt: Navigation (Doppelklick, Zurück, Nach oben, Adressleiste,
   Navigationsbereich), Auswahl (Klick, Strg, Umschalt, Strg+A),
   Neu/Umbenennen/Löschen/Wiederherstellen, Kopieren/Ausschneiden/Einfügen
   (Menü, Kontextmenü, Tastatur, Ziehen), Suchen, Sortieren, ZIP
   extrahieren und erstellen, USB-Stick auswerfen, Eigenschaften.
   Es gibt bewusst KEINE Rückmeldung, ob etwas richtig ist.
   ===================================================================== */
window.KL = window.KL || {};
KL.sims = KL.sims || {};

/* ---------------- Dateisystem-Hilfen (auch für die Bewertung) ------ */
KL.fs = (() => {
  "use strict";

  const TYPEN = {
    docx: ["Microsoft Word-Dokument", "📝", "Word"],
    doc: ["Microsoft Word 97-2003-Dokument", "📝", "Word"],
    xlsx: ["Microsoft Excel-Arbeitsblatt", "📊", "Excel"],
    pptx: ["Microsoft PowerPoint-Präsentation", "📙", "PowerPoint"],
    pdf: ["PDF-Dokument", "📕", "der PDF-Anzeige"],
    txt: ["Textdokument", "📄", "dem Editor"],
    jpg: ["JPG-Datei", "🖼️", "der Fotos-App"],
    png: ["PNG-Datei", "🖼️", "der Fotos-App"],
    mp3: ["MP3-Datei", "🎵", "der Medienwiedergabe"],
    mp4: ["MP4-Datei", "🎬", "der Medienwiedergabe"],
    exe: ["Anwendung", "⚙️", "Windows"],
    zip: ["ZIP-komprimierter Ordner", "🗜️", "dem Explorer"],
  };

  function ext(name) {
    const i = name.lastIndexOf(".");
    return i > 0 ? name.slice(i + 1).toLowerCase() : "";
  }
  function typText(n) {
    if (n.typ === "ordner") return "Dateiordner";
    if (n.typ === "laufwerk" || n.typ === "usb") return n.typ === "usb" ? "Wechseldatenträger" : "Lokaler Datenträger";
    const t = TYPEN[ext(n.name)];
    return t ? t[0] : (ext(n.name).toUpperCase() + "-Datei");
  }
  function icon(n) {
    if (n.typ === "ordner") return "📁";
    if (n.typ === "usb") return "💾";
    if (n.typ === "laufwerk") return "🖴";
    if (n.typ === "pc") return "🖥️";
    if (n.typ === "papierkorb") return "🗑️";
    const t = TYPEN[ext(n.name)];
    return t ? t[1] : "📄";
  }
  function programm(name) {
    const t = TYPEN[ext(name)];
    return t ? t[2] : "einem passenden Programm";
  }

  // Deterministische Standardwerte, falls Größe/Datum nicht angegeben sind
  function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function stdGroesse(name) {
    const e = ext(name);
    const base = { jpg: 2400, png: 900, mp3: 4200, mp4: 48000, pdf: 340, docx: 28, xlsx: 19, pptx: 1600, txt: 2, zip: 1200, exe: 5200 }[e] || 50;
    return Math.max(1, Math.round(base * (0.6 + (hash(name) % 80) / 100)));
  }
  function stdDatum(name) {
    const h = hash(name);
    const d = 1 + (h % 27), m = 1 + ((h >>> 5) % 10), hh = 8 + ((h >>> 9) % 10), mm = (h >>> 13) % 60;
    const p = (x) => String(x).padStart(2, "0");
    return `${p(d)}.${p(m)}.2026 ${p(hh)}:${p(mm)}`;
  }

  // Datei-Definition für Aufgaben: KL.fs.datei(groesseKB, "TT.MM.JJJJ HH:MM")
  function datei(groesse, datum) { return { __datei: true, groesse, datum }; }
  function zip(inhalt, groesse, datum) { return { __zip: true, inhalt, groesse, datum }; }

  // Baut den Startzustand. def = { desktop:{}, dokumente:{}, downloads:{},
  // bilder:{}, musik:{}, usb:{}|undefined, papierkorb:{ "Name": {von:"Dokumente", inhalt} },
  // start:"Dokumente/Unterordner" }
  function build(def) {
    const nodes = {};
    let seq = 1;
    const mk = (props) => {
      const id = props.id || "n" + seq++;
      nodes[id] = { id, ...props };
      return nodes[id];
    };
    const pc = mk({ id: "pc", name: "Dieser PC", typ: "pc", kinder: [] });
    const fill = (parent, obj) => {
      for (const [name, val] of Object.entries(obj || {})) addEntry(parent, name, val);
    };
    function addEntry(parent, name, val) {
      let node;
      if (val && val.__zip) {
        node = mk({ name, typ: "zip", eltern: parent.id, groesse: val.groesse || stdGroesse(name), datum: val.datum || stdDatum(name), zipInhalt: val.inhalt.slice() });
      } else if (val === null || (val && val.__datei)) {
        node = mk({ name, typ: "datei", eltern: parent.id, groesse: (val && val.groesse) || stdGroesse(name), datum: (val && val.datum) || stdDatum(name) });
      } else {
        node = mk({ name, typ: "ordner", eltern: parent.id, datum: stdDatum(name), kinder: [] });
        fill(node, val);
      }
      parent.kinder.push(node.id);
      return node;
    }
    const roots = [
      ["desktop", "Desktop"], ["dokumente", "Dokumente"], ["downloads", "Downloads"],
      ["bilder", "Bilder"], ["musik", "Musik"],
    ];
    for (const [id, name] of roots) {
      const n = mk({ id, name, typ: "ordner", eltern: "pc", datum: "01.09.2026 08:00", kinder: [], fest: true });
      pc.kinder.push(id);
      fill(n, def[id]);
    }
    const c = mk({ id: "c", name: "Lokaler Datenträger (C:)", typ: "laufwerk", eltern: "pc", kinder: [], fest: true });
    pc.kinder.push("c");
    fill(c, { Programme: {}, Windows: {}, Benutzer: {} });
    Object.values(nodes).forEach((n) => { if (n.eltern === "c") n.fest = true; });
    if (def.usb) {
      const u = mk({ id: "usb", name: "USB-Stick (E:)", typ: "usb", eltern: "pc", kinder: [], fest: true });
      pc.kinder.push("usb");
      fill(u, def.usb);
    }
    const trash = mk({ id: "papierkorb", name: "Papierkorb", typ: "papierkorb", kinder: [] });
    for (const [name, info] of Object.entries(def.papierkorb || {})) {
      const n = addEntry(trash, name, info.inhalt === undefined ? {} : info.inhalt);
      n.herkunft = findPath({ nodes }, info.von).id;
      n.geloeschtAm = info.am || "28.10.2026 16:12";
    }
    const startNode = def.start ? findPath({ nodes }, def.start) : pc;
    return {
      nodes, seq, cwd: startNode ? startNode.id : "pc", verlauf: [],
      sort: { key: "name", dir: 1 }, usbAusgeworfen: false, geoeffnet: [], log: [],
    };
  }

  // Sucht einen Knoten über einen Pfad wie "Dokumente/Schule/Mathe"
  // (ausgehend von "Dieser PC"). Elemente im Papierkorb werden nicht gefunden.
  function findPath(state, path) {
    let node = state.nodes.pc;
    if (!path) return node;
    const parts = path.split("/").filter(Boolean);
    for (const part of parts) {
      if (!node || !node.kinder) return null;
      const next = node.kinder.map((id) => state.nodes[id]).find((n) => n && (n.name === part || (part === "USB" && n.typ === "usb")));
      if (!next) return null;
      node = next;
    }
    return node;
  }
  function existiert(state, path) { return !!findPath(state, path); }
  function imPapierkorb(state, name) {
    return state.nodes.papierkorb.kinder.some((id) => state.nodes[id].name === name);
  }
  function kinderNamen(state, path) {
    const n = findPath(state, path);
    return n && n.kinder ? n.kinder.map((id) => state.nodes[id].name) : [];
  }
  function pfadVon(state, id) {
    const parts = [];
    let n = state.nodes[id];
    while (n && n.id !== "pc" && n.id !== "papierkorb") { parts.unshift(n.name); n = state.nodes[n.eltern]; }
    if (n && n.id === "papierkorb") parts.unshift("Papierkorb");
    return parts.join("/");
  }

  return { build, datei, zip, findPath, existiert, imPapierkorb, kinderNamen, pfadVon, ext, typText, icon, programm };
})();

/* ---------------- Explorer-Oberfläche ----------------------------- */
KL.sims.explorer = (() => {
  "use strict";
  const { esc } = KL.util;
  const fs = KL.fs;

  const UNGUELTIG = /[\\/:*?"<>|]/;

  function parseDatum(s) {
    const m = /(\d+)\.(\d+)\.(\d+) (\d+):(\d+)/.exec(s || "");
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime() : 0;
  }
  function fmtGroesse(kb) {
    if (kb == null) return "";
    return Math.ceil(kb).toLocaleString("de-DE") + " KB";
  }

  function mount(host, state, ctx) {
    const S = state;
    let sel = [];          // ausgewählte IDs
    let anchor = null;
    let clip = null;       // { mode: 'copy'|'cut', ids: [] }
    let suche = "";
    let renaming = null;   // ID im Umbenennen-Modus
    const undo = [];

    host.innerHTML = `
      <div class="xp" tabindex="0">
        <div class="xp-title"><span class="xp-title-icon">📁</span><span class="xp-title-text"></span><span class="win-ctrls"><span>—</span><span>☐</span><span>✕</span></span></div>
        <div class="xp-toolbar"></div>
        <div class="xp-addr">
          <button type="button" class="xp-navbtn" data-act="zurueck" title="Zurück">←</button>
          <button type="button" class="xp-navbtn" data-act="hoch" title="Nach oben">↑</button>
          <div class="xp-crumbs"></div>
          <input type="search" class="xp-search" placeholder="Suchen" spellcheck="false" />
        </div>
        <div class="xp-body">
          <nav class="xp-nav"></nav>
          <div class="xp-main"></div>
        </div>
        <div class="xp-status"></div>
        <div class="xp-toast" hidden></div>
      </div>`;
    const root = host.querySelector(".xp");
    const elTitle = root.querySelector(".xp-title-text");
    const elToolbar = root.querySelector(".xp-toolbar");
    const elCrumbs = root.querySelector(".xp-crumbs");
    const elSearch = root.querySelector(".xp-search");
    const elNav = root.querySelector(".xp-nav");
    const elMain = root.querySelector(".xp-main");
    const elStatus = root.querySelector(".xp-status");
    const elToast = root.querySelector(".xp-toast");

    const N = (id) => S.nodes[id];
    const cwd = () => N(S.cwd);

    function save() { ctx.save(); }
    function log(op, extra) { S.log.push({ op, ...(extra || {}) }); if (S.log.length > 200) S.log.shift(); }
    function snapshot() { undo.push(JSON.stringify({ nodes: S.nodes, seq: S.seq, usb: S.usbAusgeworfen })); if (undo.length > 25) undo.shift(); }

    let toastTimer = null;
    function toast(msg) {
      elToast.textContent = msg;
      elToast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (elToast.hidden = true), 3200);
    }

    // ---------- Struktur-Hilfen ----------
    function isInZip() { return cwd().typ === "zip"; }
    function laufwerkVon(id) {
      let n = N(id);
      while (n && n.eltern && n.eltern !== "pc") n = N(n.eltern);
      return n && n.id === "usb" ? "usb" : "c";
    }
    function istNachfahre(id, vorfahreId) {
      let n = N(id);
      while (n) { if (n.id === vorfahreId) return true; n = N(n.eltern); }
      return false;
    }
    function sichtbar(n) { return !(n.typ === "usb" && S.usbAusgeworfen); }
    function kannErstellenHier() {
      const c = cwd();
      return !["pc", "papierkorb", "zip"].includes(c.typ) && !suche;
    }
    function eindeutigerName(parentId, wunsch, istKopie) {
      const namen = new Set(N(parentId).kinder.map((id) => N(id).name.toLowerCase()));
      if (!namen.has(wunsch.toLowerCase())) return wunsch;
      const e = fs.ext(wunsch);
      const basis = e && !/^(ordner)$/.test(e) ? wunsch.slice(0, -(e.length + 1)) : wunsch;
      const endung = e ? "." + e : "";
      if (istKopie) {
        let k = `${basis} - Kopie${endung}`;
        let i = 2;
        while (namen.has(k.toLowerCase())) k = `${basis} - Kopie (${i++})${endung}`;
        return k;
      }
      let i = 2;
      let k = `${basis} (${i})${endung}`;
      while (namen.has(k.toLowerCase())) k = `${basis} (${++i})${endung}`;
      return k;
    }
    function neueId() { return "n" + S.seq++; }
    function deepCopy(id, neuesEltern) {
      const src = N(id);
      const nid = neueId();
      const copy = { ...src, id: nid, eltern: neuesEltern };
      delete copy.herkunft; delete copy.fest; delete copy.geloeschtAm;
      if (src.kinder) copy.kinder = [];
      if (src.zipInhalt) copy.zipInhalt = src.zipInhalt.slice();
      S.nodes[nid] = copy;
      if (src.kinder) src.kinder.forEach((cid) => copy.kinder.push(deepCopy(cid, nid)));
      return nid;
    }
    function detach(id) {
      const n = N(id);
      const p = N(n.eltern);
      if (p) p.kinder = p.kinder.filter((x) => x !== id);
    }
    function attach(id, parentId) {
      N(id).eltern = parentId;
      N(parentId).kinder.push(id);
    }
    function alleNamenIn(id) {
      const n = N(id);
      if (n.typ !== "ordner") return [n.name];
      return n.kinder.flatMap((cid) => alleNamenIn(cid));
    }

    // ---------- Anzeige-Liste ----------
    function eintraege() {
      const c = cwd();
      if (suche) {
        const q = suche.toLowerCase();
        const out = [];
        const walk = (id) => {
          const n = N(id);
          if (!n || !sichtbar(n)) return;
          if (n.id !== c.id && n.name.toLowerCase().includes(q)) out.push(n);
          if (n.kinder) n.kinder.forEach(walk);
        };
        walk(c.id);
        return sortiere(out);
      }
      if (c.typ === "zip") {
        return c.zipInhalt.map((name, i) => ({ id: `zip:${c.id}:${i}`, name, typ: "datei", groesse: Math.max(1, Math.round(c.groesse / c.zipInhalt.length)), datum: c.datum, virtuell: true }));
      }
      return sortiere(c.kinder.map(N).filter((n) => n && sichtbar(n)));
    }
    function sortiere(list) {
      const { key, dir } = S.sort;
      const val = (n) => key === "datum" ? parseDatum(n.datum) : key === "groesse" ? (n.groesse || 0) : key === "typ" ? fs.typText(n).toLowerCase() : n.name.toLowerCase();
      return list.slice().sort((a, b) => {
        const fa = a.kinder ? 0 : 1, fb = b.kinder ? 0 : 1;
        if (cwd().typ !== "pc" && fa !== fb) return fa - fb; // Ordner zuerst
        const va = val(a), vb = val(b);
        if (va < vb) return -dir;
        if (va > vb) return dir;
        return a.name.localeCompare(b.name, "de");
      });
    }

    // ---------- Rendern ----------
    function render() {
      const c = cwd();
      elTitle.textContent = (suche ? `Suchergebnisse in ${c.name}` : c.name) + " – Datei-Explorer";
      renderToolbar();
      renderCrumbs();
      renderNav();
      renderMain();
      elSearch.placeholder = `${c.name} durchsuchen`;
      if (elSearch.value !== suche) elSearch.value = suche;
    }

    function renderToolbar() {
      const c = cwd();
      const one = sel.length === 1 ? N(sel[0]) : null;
      const buttons = [];
      const ro = c.typ === "zip" || c.typ === "pc";
      if (c.typ === "papierkorb") {
        buttons.push(["wiederherstellen", "♻️ Wiederherstellen", sel.length > 0]);
        buttons.push(["leeren", "Papierkorb leeren", c.kinder.length > 0]);
        buttons.push(["eigenschaften", "Eigenschaften", !!one]);
      } else {
        buttons.push(["neu", "＋ Neu ▾", kannErstellenHier()]);
        buttons.push(["ausschneiden", "✂️ Ausschneiden", sel.length > 0 && !ro && !selFest()]);
        buttons.push(["kopieren", "⧉ Kopieren", sel.length > 0 && c.typ !== "zip"]);
        buttons.push(["einfuegen", "📋 Einfügen", !!clip && kannErstellenHier()]);
        buttons.push(["umbenennen", "✏️ Umbenennen", !!one && !ro && !one.fest]);
        buttons.push(["loeschen", "🗑️ Löschen", sel.length > 0 && !ro && !selFest()]);
        buttons.push(["sortieren", "⇅ Sortieren ▾", true]);
        if (c.typ === "zip" || (one && one.typ === "zip")) buttons.push(["extrahieren", "🗜️ Alle extrahieren", true]);
        if ((one && one.typ === "usb") || (!S.usbAusgeworfen && laufwerkVon(c.id) === "usb" && c.id !== "pc")) buttons.push(["auswerfen", "⏏️ Auswerfen", true]);
        buttons.push(["eigenschaften", "Eigenschaften", !!one]);
      }
      elToolbar.innerHTML = buttons.map(([act, label, on]) =>
        `<button type="button" class="xp-tbtn" data-act="${act}" ${on ? "" : "disabled"}>${label}</button>`).join("");
    }
    function selFest() { return sel.some((id) => N(id) && N(id).fest); }

    function renderCrumbs() {
      const c = cwd();
      const chain = [];
      let n = c;
      while (n) { chain.unshift(n); n = n.eltern ? N(n.eltern) : null; }
      if (c.id === "papierkorb") chain.splice(0, chain.length, c);
      elCrumbs.innerHTML = chain.map((n, i) =>
        `<button type="button" class="xp-crumb" data-id="${n.id}">${i === 0 ? fs.icon(n) + " " : ""}${esc(n.name)}</button>`).join('<span class="xp-crumb-sep">›</span>');
    }

    function renderNav() {
      const items = [
        ["desktop", "🖥️"], ["dokumente", "📄"], ["downloads", "⬇️"], ["bilder", "🖼️"], ["musik", "🎵"],
        ["pc", "🖥️"], ["c", "🖴"], ["usb", "💾"], ["papierkorb", "🗑️"],
      ];
      elNav.innerHTML = items.filter(([id]) => N(id) && sichtbar(N(id))).map(([id, ic]) =>
        `<button type="button" class="xp-navitem ${S.cwd === id && !suche ? "active" : ""} ${id === "pc" ? "sep" : ""}" data-id="${id}">${ic} ${esc(N(id).name)}</button>`).join("");
    }

    function renderMain() {
      const list = eintraege();
      const c = cwd();
      const cols = [["name", "Name"], ["datum", "Änderungsdatum"], ["typ", "Typ"], ["groesse", "Größe"]];
      const arrow = (k) => S.sort.key === k ? (S.sort.dir === 1 ? " ▲" : " ▼") : "";
      let html = `<table class="xp-table"><thead><tr>${cols.map(([k, l]) => `<th data-sort="${k}">${l}${arrow(k)}</th>`).join("")}${suche ? "<th>Ordner</th>" : ""}</tr></thead><tbody>`;
      for (const n of list) {
        const isSel = sel.includes(n.id);
        const nameCell = renaming === n.id
          ? `<input class="xp-rename" value="${esc(n.name)}" spellcheck="false" />`
          : `<span class="xp-ico">${fs.icon(n)}</span>${esc(n.name)}`;
        const cut = clip && clip.mode === "cut" && clip.ids.includes(n.id);
        html += `<tr class="xp-row ${isSel ? "sel" : ""} ${cut ? "cut" : ""}" data-id="${n.id}" draggable="${!n.virtuell && !n.fest && c.typ !== "papierkorb"}">
          <td class="xp-name">${nameCell}</td>
          <td>${n.typ === "pc" || n.typ === "usb" || n.typ === "laufwerk" ? "" : esc(n.datum || "")}</td>
          <td>${esc(fs.typText(n))}</td>
          <td class="xp-num">${n.kinder ? "" : fmtGroesse(n.groesse)}</td>
          ${suche ? `<td class="xp-loc">${esc(fs.pfadVon(S, n.eltern).replace(/\//g, " › ") || "Dieser PC")}</td>` : ""}
        </tr>`;
      }
      html += "</tbody></table>";
      if (!list.length) html += `<p class="xp-empty">${suche ? "Es wurden keine Suchergebnisse gefunden." : "Dieser Ordner ist leer."}</p>`;
      elMain.innerHTML = html;
      elStatus.textContent = `${list.length} ${list.length === 1 ? "Element" : "Elemente"}${sel.length ? ` · ${sel.length} ${sel.length === 1 ? "Element" : "Elemente"} ausgewählt` : ""}${c.typ === "zip" ? " · ZIP-Datei (nur lesen)" : ""}`;
      if (renaming) {
        const inp = elMain.querySelector(".xp-rename");
        if (inp) {
          inp.focus();
          const n = N(renaming);
          const e = fs.ext(n.name);
          if (n.typ !== "ordner" && e) inp.setSelectionRange(0, n.name.length - e.length - 1);
          else inp.select();
          inp.addEventListener("keydown", (ev) => {
            ev.stopPropagation();
            if (ev.key === "Enter") commitRename(inp.value);
            if (ev.key === "Escape") { renaming = null; render(); root.focus(); }
          });
          inp.addEventListener("blur", () => { if (renaming) commitRename(inp.value); });
          inp.addEventListener("click", (ev) => ev.stopPropagation());
          inp.addEventListener("dblclick", (ev) => ev.stopPropagation());
        }
      }
    }

    // Nur Markierung aktualisieren, ohne die Tabelle neu aufzubauen —
    // sonst geht ein Doppelklick verloren, weil das Element ausgetauscht wird.
    function zeigeAuswahl() {
      elMain.querySelectorAll(".xp-row").forEach((r) => r.classList.toggle("sel", sel.includes(r.dataset.id)));
      const n = elMain.querySelectorAll(".xp-row").length;
      const c = cwd();
      elStatus.textContent = `${n} ${n === 1 ? "Element" : "Elemente"}${sel.length ? ` · ${sel.length} ${sel.length === 1 ? "Element" : "Elemente"} ausgewählt` : ""}${c.typ === "zip" ? " · ZIP-Datei (nur lesen)" : ""}`;
      renderToolbar();
    }

    // ---------- Aktionen ----------
    function navigate(id, { push = true } = {}) {
      const n = N(id);
      if (!n || (n.typ === "usb" && S.usbAusgeworfen)) return;
      if (push && S.cwd !== id) S.verlauf.push(S.cwd);
      if (S.verlauf.length > 50) S.verlauf.shift();
      S.cwd = id;
      sel = []; anchor = null; suche = ""; renaming = null;
      log("navigiere", { pfad: fs.pfadVon(S, id) });
      save();
      render();
    }

    function open(id) {
      const n = N(id);
      if (!n) {
        if (String(id).startsWith("zip:")) toast("Diese Datei liegt in einer ZIP-Datei. Extrahiere die ZIP-Datei zuerst.");
        return;
      }
      if (S.cwd === "papierkorb") { toast("Elemente im Papierkorb können nicht geöffnet werden. Stelle sie zuerst wieder her."); return; }
      if (n.kinder || n.typ === "zip") { navigate(id); return; }
      const pfad = fs.pfadVon(S, id);
      if (!S.geoeffnet.includes(pfad)) S.geoeffnet.push(pfad);
      log("oeffne", { pfad, perSuche: !!suche });
      save();
      dialog(`<div class="xp-dlg-head">${fs.icon(n)} ${esc(n.name)}</div>
        <p>Die Datei „${esc(n.name)}“ wurde in ${esc(fs.programm(n.name))} geöffnet.</p>
        <div class="xp-dlg-btns"><button type="button" class="xp-btn primary" data-close>Schließen</button></div>`);
    }

    function startRename() {
      if (sel.length !== 1) return;
      const n = N(sel[0]);
      if (!n || n.fest || ["pc", "papierkorb", "zip"].includes(cwd().typ)) return;
      renaming = n.id;
      render();
    }
    function commitRename(value) {
      const id = renaming;
      const n = N(id);
      const neu = value.trim();
      if (!n) { renaming = null; render(); return; }
      if (!neu || neu === n.name) { renaming = null; render(); root.focus(); return; }
      if (UNGUELTIG.test(neu)) {
        toast('Ein Dateiname darf keines der folgenden Zeichen enthalten: \\ / : * ? " < > |');
        renaming = null; render(); renaming = id; render(); return;
      }
      const konflikt = N(n.eltern).kinder.some((cid) => cid !== id && N(cid).name.toLowerCase() === neu.toLowerCase());
      if (konflikt) {
        toast(`An diesem Ort ist bereits ein Element mit dem Namen „${neu}“ vorhanden.`);
        renaming = null; render(); renaming = id; render(); return;
      }
      snapshot();
      log("umbenennen", { von: n.name, zu: neu });
      n.name = neu;
      n.datum = jetzt();
      renaming = null;
      save();
      render();
      root.focus();
    }

    function jetzt() {
      const d = new Date(), p = (x) => String(x).padStart(2, "0");
      return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    function neu(typ) {
      if (!kannErstellenHier()) return;
      snapshot();
      const id = neueId();
      const name = eindeutigerName(S.cwd, typ === "ordner" ? "Neuer Ordner" : "Neues Textdokument.txt");
      S.nodes[id] = typ === "ordner"
        ? { id, name, typ: "ordner", eltern: S.cwd, kinder: [], datum: jetzt() }
        : { id, name, typ: "datei", eltern: S.cwd, groesse: 0, datum: jetzt() };
      N(S.cwd).kinder.push(id);
      log("neu", { typ, pfad: fs.pfadVon(S, id) });
      sel = [id];
      save();
      renaming = id;
      render();
    }

    function loeschen() {
      const ids = sel.filter((id) => N(id) && !N(id).fest);
      if (!ids.length || ["pc", "zip", "papierkorb"].includes(cwd().typ)) return;
      snapshot();
      for (const id of ids) {
        const n = N(id);
        n.herkunft = n.eltern;
        n.geloeschtAm = jetzt();
        detach(id);
        attach(id, "papierkorb");
        log("loeschen", { name: n.name });
      }
      sel = [];
      save();
      render();
    }

    function wiederherstellen() {
      if (S.cwd !== "papierkorb") return;
      snapshot();
      for (const id of sel) {
        const n = N(id);
        const ziel = N(n.herkunft) && !istNachfahre(n.herkunft, "papierkorb") ? n.herkunft : "dokumente";
        detach(id);
        n.name = eindeutigerName(ziel, n.name);
        attach(id, ziel);
        delete n.herkunft; delete n.geloeschtAm;
        log("wiederherstellen", { name: n.name });
      }
      sel = [];
      save();
      render();
    }

    function papierkorbLeeren() {
      confirmDlg("Möchten Sie wirklich alle Elemente im Papierkorb endgültig löschen?", () => {
        snapshot();
        const weg = (id) => { const n = N(id); if (n && n.kinder) n.kinder.forEach(weg); delete S.nodes[id]; };
        N("papierkorb").kinder.forEach(weg);
        N("papierkorb").kinder = [];
        log("papierkorb-leeren");
        sel = [];
        save();
        render();
      });
    }

    function kopieren(mode) {
      const ids = sel.filter((id) => N(id));
      if (!ids.length || ["papierkorb"].includes(cwd().typ)) return;
      if (mode === "cut" && (ids.some((id) => N(id).fest) || cwd().typ === "zip" || cwd().typ === "pc")) return;
      clip = { mode, ids };
      log(mode === "copy" ? "kopieren" : "ausschneiden", { namen: ids.map((id) => N(id).name) });
      render();
    }

    function einfuegen(zielId) {
      const ziel = zielId || S.cwd;
      if (!clip || !N(ziel) || ["pc", "papierkorb", "zip"].includes(N(ziel).typ)) return;
      const ids = clip.ids.filter((id) => N(id) && !istNachfahre(id, "papierkorb"));
      if (!ids.length) { clip = null; render(); return; }
      if (ids.some((id) => istNachfahre(ziel, id))) { toast("Der Zielordner ist ein Unterordner des Quellordners."); return; }
      snapshot();
      const neu = [];
      for (const id of ids) {
        if (clip.mode === "copy") {
          const nid = deepCopy(id, ziel);
          N(nid).name = eindeutigerName(ziel, N(nid).name, N(id).eltern === ziel);
          N(ziel).kinder.push(nid);
          neu.push(nid);
        } else {
          if (N(id).eltern === ziel) continue;
          detach(id);
          N(id).name = eindeutigerName(ziel, N(id).name);
          attach(id, ziel);
          neu.push(id);
        }
      }
      log("einfuegen", { modus: clip.mode, ziel: fs.pfadVon(S, ziel), namen: neu.map((id) => N(id).name) });
      if (clip.mode === "cut") clip = null;
      sel = ziel === S.cwd ? neu : [];
      save();
      render();
    }

    function ziehen(ids, zielId) {
      const ziel = N(zielId);
      if (!ziel) return;
      if (zielId === "papierkorb") { sel = ids; loeschen(); return; }
      if (!ziel.kinder || ["pc"].includes(ziel.typ)) return;
      ids = ids.filter((id) => N(id) && !N(id).fest && id !== zielId && !istNachfahre(zielId, id));
      if (!ids.length) return;
      const copy = laufwerkVon(zielId) !== laufwerkVon(ids[0]);
      const alt = clip;
      clip = { mode: copy ? "copy" : "cut", ids };
      log("ziehen", { modus: clip.mode });
      einfuegen(zielId);
      clip = alt && alt.mode === "copy" ? alt : null;
    }

    function extrahieren() {
      let zipNode = cwd().typ === "zip" ? cwd() : sel.length === 1 ? N(sel[0]) : null;
      if (!zipNode || zipNode.typ !== "zip") return;
      const parent = zipNode.eltern;
      const base = zipNode.name.replace(/\.zip$/i, "");
      const vorschlag = (fs.pfadVon(S, parent) + "/" + base).replace(/\//g, "\\");
      dialog(`<div class="xp-dlg-head">🗜️ ZIP-komprimierte Ordner extrahieren</div>
        <p>Wählen Sie ein Ziel aus und klicken Sie auf „Extrahieren“.</p>
        <label class="xp-lbl">Dateien werden in diesen Ordner extrahiert:</label>
        <input class="xp-input" value="${esc(vorschlag)}" readonly />
        <div class="xp-dlg-btns"><button type="button" class="xp-btn primary" data-ok>Extrahieren</button><button type="button" class="xp-btn" data-close>Abbrechen</button></div>`,
      () => {
        snapshot();
        const id = neueId();
        const name = eindeutigerName(parent, base);
        S.nodes[id] = { id, name, typ: "ordner", eltern: parent, kinder: [], datum: jetzt() };
        N(parent).kinder.push(id);
        zipNode.zipInhalt.forEach((fname) => {
          const fid = neueId();
          S.nodes[fid] = { id: fid, name: fname, typ: "datei", eltern: id, groesse: Math.max(1, Math.round(zipNode.groesse * 1.4 / zipNode.zipInhalt.length)), datum: zipNode.datum };
          S.nodes[id].kinder.push(fid);
        });
        log("extrahieren", { zip: zipNode.name, ziel: fs.pfadVon(S, id) });
        save();
        navigate(id);
      });
    }

    function zuZip() {
      const ids = sel.filter((id) => N(id));
      if (!ids.length || !kannErstellenHier()) return;
      snapshot();
      const first = N(ids[0]);
      const base = first.typ === "ordner" ? first.name : first.name.replace(/\.[^.]+$/, "");
      const id = neueId();
      const name = eindeutigerName(S.cwd, base + ".zip");
      const inhalt = ids.flatMap((x) => alleNamenIn(x));
      const groesse = Math.max(1, Math.round(ids.reduce((s, x) => s + groesseVon(x), 0) * 0.7));
      S.nodes[id] = { id, name, typ: "zip", eltern: S.cwd, zipInhalt: inhalt, groesse, datum: jetzt(), quelle: ids.map((x) => N(x).name) };
      N(S.cwd).kinder.push(id);
      log("zip-erstellen", { name, quelle: ids.map((x) => N(x).name) });
      sel = [id];
      save();
      renaming = id;
      render();
    }
    function groesseVon(id) {
      const n = N(id);
      return n.kinder ? n.kinder.reduce((s, c) => s + groesseVon(c), 0) : (n.groesse || 0);
    }

    function auswerfen() {
      if (S.usbAusgeworfen || !N("usb")) return;
      S.usbAusgeworfen = true;
      log("auswerfen");
      if (laufwerkVon(S.cwd) === "usb" && S.cwd !== "pc") { S.cwd = "pc"; }
      sel = [];
      save();
      render();
      toast("Hardware kann jetzt entfernt werden: „USB-Stick (E:)“ kann jetzt sicher vom Computer entfernt werden.");
    }

    function eigenschaften() {
      if (sel.length !== 1) return;
      const n = N(sel[0]);
      if (!n) return;
      const ort = fs.pfadVon(S, n.eltern).replace(/\//g, "\\") || "Dieser PC";
      const groesse = n.kinder ? groesseVon(n.id) : n.groesse;
      const rows = [
        ["Typ", fs.typText(n)],
        ["Ort", ort],
        ["Größe", fmtGroesse(groesse)],
        n.kinder ? ["Inhalt", `${n.kinder.length} Elemente`] : null,
        ["Geändert", n.datum || "—"],
        n.geloeschtAm ? ["Gelöscht am", n.geloeschtAm] : null,
      ].filter(Boolean);
      dialog(`<div class="xp-dlg-head">Eigenschaften von „${esc(n.name)}“</div>
        <div class="xp-props"><div class="xp-props-name">${fs.icon(n)} ${esc(n.name)}</div>
        ${rows.map(([k, v]) => `<div class="xp-prop"><span>${k}:</span><span>${esc(v)}</span></div>`).join("")}</div>
        <div class="xp-dlg-btns"><button type="button" class="xp-btn primary" data-close>OK</button></div>`);
      log("eigenschaften", { name: n.name });
    }

    function rueckgaengig() {
      const last = undo.pop();
      if (!last) return;
      const snap = JSON.parse(last);
      S.nodes = snap.nodes; S.seq = snap.seq; S.usbAusgeworfen = snap.usb;
      if (!N(S.cwd)) S.cwd = "pc";
      sel = []; renaming = null;
      log("rueckgaengig");
      save();
      render();
    }

    // ---------- Dialoge & Menüs ----------
    function closeOverlays() { root.querySelectorAll(".xp-menu, .xp-overlay").forEach((e) => e.remove()); }

    function dialog(html, onOk) {
      closeOverlays();
      const ov = document.createElement("div");
      ov.className = "xp-overlay";
      ov.innerHTML = `<div class="xp-dlg">${html}</div>`;
      root.appendChild(ov);
      ov.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { ov.remove(); root.focus(); }));
      const ok = ov.querySelector("[data-ok]");
      if (ok) ok.addEventListener("click", () => { ov.remove(); onOk && onOk(); root.focus(); });
      const first = ov.querySelector("[data-ok], [data-close]");
      if (first) first.focus();
    }
    function confirmDlg(text, onYes) {
      dialog(`<p>${esc(text)}</p><div class="xp-dlg-btns"><button type="button" class="xp-btn primary" data-ok>Ja</button><button type="button" class="xp-btn" data-close>Nein</button></div>`, onYes);
    }

    function menu(x, y, items) {
      closeOverlays();
      const m = document.createElement("div");
      m.className = "xp-menu";
      m.innerHTML = items.map((it) => it === "-" ? '<div class="xp-menu-sep"></div>'
        : `<button type="button" class="xp-menu-item" data-k="${it[0]}" ${it[2] === false ? "disabled" : ""}>${it[1]}</button>`).join("");
      root.appendChild(m);
      const r = root.getBoundingClientRect();
      let left = x - r.left, top = y - r.top;
      const mw = m.offsetWidth, mh = m.offsetHeight;
      if (left + mw > r.width) left = Math.max(0, r.width - mw - 4);
      if (top + mh > r.height) top = Math.max(0, r.height - mh - 4);
      m.style.left = left + "px";
      m.style.top = top + "px";
      m.addEventListener("click", (e) => {
        const b = e.target.closest(".xp-menu-item");
        if (!b || b.disabled) return;
        m.remove();
        aktion(b.dataset.k);
      });
      m.addEventListener("mousedown", (e) => e.stopPropagation());
    }

    function aktion(k) {
      switch (k) {
        case "neu": {
          const b = elToolbar.querySelector('[data-act="neu"]').getBoundingClientRect();
          menu(b.left, b.bottom, [["neu-ordner", "📁 Ordner"], ["neu-text", "📄 Textdokument"]]);
          break;
        }
        case "neu-ordner": neu("ordner"); break;
        case "neu-text": neu("text"); break;
        case "oeffnen": if (sel.length === 1) open(sel[0]); break;
        case "ausschneiden": kopieren("cut"); break;
        case "kopieren": kopieren("copy"); break;
        case "einfuegen": einfuegen(); break;
        case "umbenennen": startRename(); break;
        case "loeschen": loeschen(); break;
        case "wiederherstellen": wiederherstellen(); break;
        case "leeren": papierkorbLeeren(); break;
        case "extrahieren": extrahieren(); break;
        case "zip": zuZip(); break;
        case "auswerfen": auswerfen(); break;
        case "eigenschaften": eigenschaften(); break;
        case "sortieren": {
          const b = elToolbar.querySelector('[data-act="sortieren"]').getBoundingClientRect();
          sortMenu(b.left, b.bottom);
          break;
        }
        default:
          if (k.startsWith("sort-")) {
            const [, key, dir] = k.split("-");
            if (key === "auf" || key === "ab") S.sort.dir = key === "auf" ? 1 : -1;
            else S.sort.key = key;
            if (dir) S.sort.dir = dir === "auf" ? 1 : -1;
            log("sortieren", { ...S.sort });
            save();
            render();
          }
      }
    }
    function sortMenu(x, y) {
      const mark = (k) => (S.sort.key === k ? "● " : "　");
      menu(x, y, [
        ["sort-name", mark("name") + "Name"], ["sort-datum", mark("datum") + "Änderungsdatum"],
        ["sort-typ", mark("typ") + "Typ"], ["sort-groesse", mark("groesse") + "Größe"], "-",
        ["sort-auf", (S.sort.dir === 1 ? "● " : "　") + "Aufsteigend"], ["sort-ab", (S.sort.dir === -1 ? "● " : "　") + "Absteigend"],
      ]);
    }

    function contextMenuFor(id, x, y) {
      const c = cwd();
      if (id && !sel.includes(id)) { sel = [id]; anchor = id; zeigeAuswahl(); }
      const n = id ? N(id) : null;
      if (c.typ === "papierkorb") {
        if (n) menu(x, y, [["wiederherstellen", "Wiederherstellen"], "-", ["eigenschaften", "Eigenschaften"]]);
        return;
      }
      if (String(id || "").startsWith("zip:")) {
        menu(x, y, [["extrahieren", "Alle extrahieren …"]]);
        return;
      }
      if (n) {
        const ro = c.typ === "pc";
        const items = [["oeffnen", "<b>Öffnen</b>"]];
        if (n.typ === "zip") items.push(["extrahieren", "Alle extrahieren …"]);
        if (n.typ === "usb") items.push(["auswerfen", "Auswerfen"]);
        items.push("-");
        items.push(["ausschneiden", "Ausschneiden", !ro && !selFest()]);
        items.push(["kopieren", "Kopieren"]);
        if (n.kinder && clip && n.typ === "ordner") items.push(["einfuegen-in", "Einfügen"]);
        items.push("-");
        items.push(["zip", "Senden an › ZIP-komprimierter Ordner", !ro && kannErstellenHier()]);
        items.push("-");
        items.push(["loeschen", "Löschen", !ro && !selFest()]);
        items.push(["umbenennen", "Umbenennen", !ro && sel.length === 1 && !n.fest]);
        items.push("-");
        items.push(["eigenschaften", "Eigenschaften", sel.length === 1]);
        menu(x, y, items);
        const inBtn = root.querySelector('.xp-menu [data-k="einfuegen-in"]');
        if (inBtn) inBtn.addEventListener("click", () => { closeOverlays(); einfuegen(n.id); }, { once: true });
        return;
      }
      menu(x, y, [
        ["sortieren", "Sortieren nach ›"], "-",
        ["einfuegen", "Einfügen", !!clip && kannErstellenHier()], "-",
        ["neu-ordner", "Neu › Ordner", kannErstellenHier()],
        ["neu-text", "Neu › Textdokument", kannErstellenHier()],
      ]);
      const s = root.querySelector('.xp-menu [data-k="sortieren"]');
      if (s) s.addEventListener("click", (e) => { e.stopPropagation(); sortMenu(x, y); }, { once: true });
    }

    // ---------- Ereignisse ----------
    root.addEventListener("mousedown", (e) => {
      if (!e.target.closest(".xp-menu")) root.querySelectorAll(".xp-menu").forEach((m) => m.remove());
    });

    elToolbar.addEventListener("click", (e) => {
      const b = e.target.closest(".xp-tbtn");
      if (!b || b.disabled) return;
      e.stopPropagation();
      aktion(b.dataset.act);
    });

    root.querySelector('[data-act="zurueck"]').addEventListener("click", () => {
      if (suche) { suche = ""; render(); return; }
      const prev = S.verlauf.pop();
      if (prev && N(prev)) navigate(prev, { push: false });
    });
    root.querySelector('[data-act="hoch"]').addEventListener("click", () => {
      const c = cwd();
      if (suche) { suche = ""; render(); return; }
      if (c.eltern && N(c.eltern)) navigate(c.eltern);
      else if (c.id === "papierkorb") navigate("pc");
    });
    elCrumbs.addEventListener("click", (e) => {
      const b = e.target.closest(".xp-crumb");
      if (b) navigate(b.dataset.id);
    });
    elNav.addEventListener("click", (e) => {
      const b = e.target.closest(".xp-navitem");
      if (b) navigate(b.dataset.id);
    });
    elNav.addEventListener("contextmenu", (e) => {
      const b = e.target.closest(".xp-navitem");
      e.preventDefault();
      if (b && b.dataset.id === "usb") menu(e.clientX, e.clientY, [["auswerfen", "Auswerfen"]]);
    });
    elSearch.addEventListener("input", () => {
      suche = elSearch.value.trim();
      sel = [];
      if (suche) log("suche", { begriff: suche });
      renderMain();
      elTitle.textContent = (suche ? `Suchergebnisse in ${cwd().name}` : cwd().name) + " – Datei-Explorer";
    });
    elSearch.addEventListener("keydown", (e) => e.stopPropagation());

    elMain.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (th) {
        const k = th.dataset.sort;
        if (S.sort.key === k) S.sort.dir *= -1; else { S.sort.key = k; S.sort.dir = 1; }
        log("sortieren", { ...S.sort });
        save();
        renderMain();
        return;
      }
      const row = e.target.closest(".xp-row");
      root.focus({ preventScroll: true });
      if (!row) { sel = []; anchor = null; zeigeAuswahl(); return; }
      const id = row.dataset.id;
      const ids = eintraege().map((n) => n.id);
      if (e.shiftKey && anchor && ids.includes(anchor)) {
        const a = ids.indexOf(anchor), b = ids.indexOf(id);
        sel = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      } else if (e.ctrlKey || e.metaKey) {
        sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
        anchor = id;
      } else {
        sel = [id];
        anchor = id;
      }
      zeigeAuswahl();
    });
    elMain.addEventListener("dblclick", (e) => {
      const row = e.target.closest(".xp-row");
      if (row) open(row.dataset.id);
    });
    elMain.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const row = e.target.closest(".xp-row");
      if (!row) { sel = []; zeigeAuswahl(); }
      contextMenuFor(row ? row.dataset.id : null, e.clientX, e.clientY);
    });

    // Ziehen und Ablegen
    let dragIds = null;
    elMain.addEventListener("dragstart", (e) => {
      const row = e.target.closest(".xp-row");
      if (!row) return;
      const id = row.dataset.id;
      if (!sel.includes(id)) { sel = [id]; anchor = id; }
      dragIds = sel.slice();
      e.dataTransfer.effectAllowed = "copyMove";
      try { e.dataTransfer.setData("text/plain", dragIds.join(",")); } catch (err) {}
      setTimeout(() => renderToolbar(), 0);
    });
    const dropTarget = (e) => {
      const row = e.target.closest(".xp-row");
      if (row) {
        const n = N(row.dataset.id);
        return n && (n.kinder || n.id === "papierkorb") && !(dragIds || []).includes(n.id) ? n.id : null;
      }
      const nav = e.target.closest(".xp-navitem");
      if (nav && nav.dataset.id !== "pc") return nav.dataset.id;
      return null;
    };
    [elMain, elNav].forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        if (!dragIds) return;
        const t = dropTarget(e);
        zone.querySelectorAll(".drop").forEach((x) => x.classList.remove("drop"));
        if (t) {
          e.preventDefault();
          (e.target.closest(".xp-row") || e.target.closest(".xp-navitem")).classList.add("drop");
        }
      });
      zone.addEventListener("dragleave", () => zone.querySelectorAll(".drop").forEach((x) => x.classList.remove("drop")));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        const t = dropTarget(e);
        const ids = dragIds;
        dragIds = null;
        if (t && ids) ziehen(ids, t);
      });
    });
    elMain.addEventListener("dragend", () => { dragIds = null; });

    root.addEventListener("keydown", (e) => {
      if (e.target.closest("input")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === "a") { e.preventDefault(); sel = eintraege().map((n) => n.id); zeigeAuswahl(); }
      else if (ctrl && k === "c") { e.preventDefault(); kopieren("copy"); }
      else if (ctrl && k === "x") { e.preventDefault(); kopieren("cut"); }
      else if (ctrl && k === "v") { e.preventDefault(); einfuegen(); }
      else if (ctrl && k === "z") { e.preventDefault(); rueckgaengig(); }
      else if (e.key === "Delete") { e.preventDefault(); if (S.cwd === "papierkorb") return; loeschen(); }
      else if (e.key === "F2") { e.preventDefault(); startRename(); }
      else if (e.key === "Enter") { e.preventDefault(); if (sel.length === 1) open(sel[0]); }
      else if (e.key === "Backspace") { e.preventDefault(); root.querySelector('[data-act="zurueck"]').click(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const ids = eintraege().map((n) => n.id);
        if (!ids.length) return;
        let i = sel.length ? ids.indexOf(sel[sel.length - 1]) : -1;
        i = e.key === "ArrowDown" ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
        sel = [ids[i]]; anchor = ids[i];
        zeigeAuswahl();
      } else if (e.key === "Escape") { closeOverlays(); }
    });

    render();
    return function destroy() { closeOverlays(); clearTimeout(toastTimer); };
  }

  return { mount };
})();
