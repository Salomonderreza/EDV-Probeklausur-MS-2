/* =====================================================================
   SIMULATIONEN: "Speichern unter" (Word-Fenster mit Datei-Menü) und
   Lernplattform im Browser (Herunterladen + Hochladen).
   Beide nutzen denselben Datei-Dialog (Speichern/Öffnen).
   ===================================================================== */
window.KL = window.KL || {};
KL.sims = KL.sims || {};

KL.dateiDialog = (() => {
  "use strict";
  const { esc } = KL.util;
  const fs = KL.fs;

  // Öffnet einen modalen Datei-Dialog in "overlayHost".
  // opts: { modus:'speichern'|'oeffnen', fsState, start:'dokumente', name, typen:[...], typ, filter:(node)=>bool, onFertig(result), onAbbruch }
  function open(overlayHost, opts) {
    const S = opts.fsState;
    let cwd = opts.start || "dokumente";
    const verlauf = [];
    let auswahl = null;
    const ov = document.createElement("div");
    ov.className = "fd-overlay";
    ov.innerHTML = `
      <div class="fd" role="dialog">
        <div class="fd-title">${opts.modus === "speichern" ? "Speichern unter" : "Öffnen"}<button type="button" class="fd-x" data-cancel>✕</button></div>
        <div class="fd-addr">
          <button type="button" class="xp-navbtn" data-act="zurueck">←</button>
          <button type="button" class="xp-navbtn" data-act="hoch">↑</button>
          <div class="xp-crumbs fd-crumbs"></div>
          ${opts.modus === "speichern" ? '<button type="button" class="xp-btn fd-newfolder">Neuer Ordner</button>' : ""}
        </div>
        <div class="fd-body">
          <nav class="xp-nav fd-nav"></nav>
          <div class="fd-list"></div>
        </div>
        <div class="fd-foot">
          <label>Dateiname:</label><input type="text" class="xp-input fd-name" spellcheck="false" value="${esc(opts.name || "")}" />
          ${opts.modus === "speichern"
            ? `<label>Dateityp:</label><select class="xp-input fd-typ">${opts.typen.map((t) => `<option ${t === opts.typ ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`
            : `<label></label><select class="xp-input fd-typ" disabled><option>Alle Dateien (*.*)</option></select>`}
          <div class="fd-btns"><button type="button" class="xp-btn primary" data-ok>${opts.modus === "speichern" ? "Speichern" : "Öffnen"}</button><button type="button" class="xp-btn" data-cancel>Abbrechen</button></div>
        </div>
        <div class="xp-toast fd-toast" hidden></div>
      </div>`;
    overlayHost.appendChild(ov);
    const elCrumbs = ov.querySelector(".fd-crumbs");
    const elNav = ov.querySelector(".fd-nav");
    const elList = ov.querySelector(".fd-list");
    const elName = ov.querySelector(".fd-name");
    const elTyp = ov.querySelector(".fd-typ");
    const elToast = ov.querySelector(".fd-toast");
    const N = (id) => S.nodes[id];

    function toast(msg) { elToast.textContent = msg; elToast.hidden = false; setTimeout(() => (elToast.hidden = true), 3000); }

    function render() {
      const chain = [];
      let n = N(cwd);
      while (n) { chain.unshift(n); n = n.eltern ? N(n.eltern) : null; }
      elCrumbs.innerHTML = chain.map((x) => `<button type="button" class="xp-crumb" data-id="${x.id}">${esc(x.name)}</button>`).join('<span class="xp-crumb-sep">›</span>');
      elNav.innerHTML = ["desktop", "dokumente", "downloads", "bilder", "musik", "pc"].filter((id) => N(id))
        .map((id) => `<button type="button" class="xp-navitem ${cwd === id ? "active" : ""}" data-id="${id}">${fs.icon(N(id))} ${esc(N(id).name)}</button>`).join("");
      const kinder = (N(cwd).kinder || []).map(N).filter((x) => x && !(x.typ === "usb" && S.usbAusgeworfen))
        .sort((a, b) => (a.kinder ? 0 : 1) - (b.kinder ? 0 : 1) || a.name.localeCompare(b.name, "de"));
      elList.innerHTML = kinder.length ? `<table class="xp-table"><thead><tr><th>Name</th><th>Änderungsdatum</th><th>Typ</th></tr></thead><tbody>${kinder.map((x) => {
        const passt = x.kinder || !opts.filter || opts.filter(x);
        return `<tr class="xp-row ${auswahl === x.id ? "sel" : ""} ${passt ? "" : "dim"}" data-id="${x.id}"><td class="xp-name"><span class="xp-ico">${fs.icon(x)}</span>${esc(x.name)}</td><td>${esc(x.datum || "")}</td><td>${esc(fs.typText(x))}</td></tr>`;
      }).join("")}</tbody></table>` : '<p class="xp-empty">Dieser Ordner ist leer.</p>';
    }
    function nav(id) {
      if (!N(id) || !N(id).kinder) return;
      if (id !== cwd) verlauf.push(cwd);
      cwd = id; auswahl = null; render();
    }

    ov.addEventListener("click", (e) => {
      if (e.target.closest("[data-cancel]")) { ov.remove(); opts.onAbbruch && opts.onAbbruch(); return; }
      const crumb = e.target.closest(".xp-crumb, .xp-navitem");
      if (crumb) { nav(crumb.dataset.id); return; }
      const act = e.target.closest("[data-act]");
      if (act) {
        if (act.dataset.act === "zurueck") { const p = verlauf.pop(); if (p) { cwd = p; render(); } }
        else if (N(cwd).eltern) nav(N(cwd).eltern);
        return;
      }
      if (e.target.closest(".fd-newfolder")) {
        if (N(cwd).typ === "pc") { toast("Hier kann kein Ordner erstellt werden."); return; }
        const id = "n" + S.seq++;
        let name = "Neuer Ordner", i = 2;
        const namen = new Set(N(cwd).kinder.map((k) => N(k).name));
        while (namen.has(name)) name = `Neuer Ordner (${i++})`;
        S.nodes[id] = { id, name, typ: "ordner", eltern: cwd, kinder: [], datum: "29.10.2026 10:00" };
        N(cwd).kinder.push(id);
        auswahl = id;
        render();
        const neu = prompt0(ov, "Name des neuen Ordners:", name, (val) => {
          val = (val || "").trim();
          if (val && !/[\\/:*?"<>|]/.test(val) && !N(cwd).kinder.some((k) => k !== id && N(k).name.toLowerCase() === val.toLowerCase())) S.nodes[id].name = val;
          render();
        });
        return neu;
      }
      const row = e.target.closest(".xp-row");
      if (row) {
        auswahl = row.dataset.id;
        const n = N(auswahl);
        if (!n.kinder) elName.value = opts.modus === "speichern" ? n.name.replace(/\.[^.]+$/, "") : n.name;
        // nur Markierung umschalten (kein Neuaufbau, sonst geht der Doppelklick verloren)
        elList.querySelectorAll(".xp-row").forEach((r) => r.classList.toggle("sel", r.dataset.id === auswahl));
        return;
      }
      if (e.target.closest("[data-ok]")) bestaetigen();
    });
    ov.addEventListener("dblclick", (e) => {
      const row = e.target.closest(".xp-row");
      if (!row) return;
      const n = N(row.dataset.id);
      if (n.kinder) nav(n.id);
      else if (opts.modus === "oeffnen") { elName.value = n.name; bestaetigen(); }
    });
    elName.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") bestaetigen(); });

    function bestaetigen() {
      const name = elName.value.trim();
      if (!name) { toast("Bitte einen Dateinamen eingeben."); return; }
      if (N(cwd).typ === "pc") { toast("Bitte einen Ordner auswählen."); return; }
      if (opts.modus === "oeffnen") {
        const n = (N(cwd).kinder || []).map(N).find((x) => x.name.toLowerCase() === name.toLowerCase() && !x.kinder);
        if (!n) { toast(`„${name}“ wurde nicht gefunden. Überprüfen Sie den Dateinamen.`); return; }
        ov.remove();
        opts.onFertig({ name: n.name, pfad: fs.pfadVon(S, n.id) });
        return;
      }
      if (/[\\/:*?"<>|]/.test(name)) { toast('Der Dateiname darf keines der Zeichen \\ / : * ? " < > | enthalten.'); return; }
      ov.remove();
      opts.onFertig({ name, ordner: fs.pfadVon(S, cwd), typ: elTyp.value });
    }

    render();
    elName.focus();
    elName.select();
  }

  // kleines Eingabefeld im Dialog statt window.prompt
  function prompt0(host, label, wert, onOk) {
    const box = document.createElement("div");
    box.className = "fd-prompt";
    box.innerHTML = `<label>${esc(label)}</label><input class="xp-input" value="${esc(wert)}" /><div class="fd-btns"><button type="button" class="xp-btn primary">OK</button></div>`;
    host.querySelector(".fd").appendChild(box);
    const inp = box.querySelector("input");
    inp.focus(); inp.select();
    const done = () => { box.remove(); onOk(inp.value); };
    box.querySelector("button").addEventListener("click", (e) => { e.stopPropagation(); done(); });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") done(); });
    inp.addEventListener("click", (e) => e.stopPropagation());
  }

  return { open };
})();

/* ---------------- "Speichern unter" in einem Word-Fenster ---------- */
KL.sims.speichern = (() => {
  "use strict";
  const { esc } = KL.util;

  const TYPEN = ["Word-Dokument (*.docx)", "Word 97-2003-Dokument (*.doc)", "PDF (*.pdf)", "Nur Text (*.txt)", "Webseite (*.htm; *.html)"];

  // def: { dokName, text:[Absätze], fs:{...} }
  function init(def) {
    return { fs: KL.fs.build(def.fs), dokName: def.dokName, text: def.text, gespeichert: null, versuche: 0, dialogGeoeffnet: false };
  }

  function mount(host, S, ctx) {
    host.innerHTML = `
      <div class="wd">
        <div class="wd-title"><span>📘</span><span class="wd-docname"></span><span class="win-ctrls"><span>—</span><span>☐</span><span>✕</span></span></div>
        <div class="wd-menubar">
          <button type="button" class="wd-menu" data-m="datei">Datei</button>
          <span class="wd-menu off">Start</span><span class="wd-menu off">Einfügen</span><span class="wd-menu off">Layout</span><span class="wd-menu off">Überprüfen</span><span class="wd-menu off">Ansicht</span>
        </div>
        <div class="wd-backstage" hidden>
          <div class="wd-bs-nav">
            <button type="button" data-b="zurueck">← Zurück</button>
            <button type="button" data-b="neu">Neu</button>
            <button type="button" data-b="oeffnen">Öffnen</button>
            <button type="button" data-b="speichern">Speichern</button>
            <button type="button" data-b="speichernunter">Speichern unter</button>
            <button type="button" data-b="drucken">Drucken</button>
            <button type="button" data-b="schliessen">Schließen</button>
          </div>
          <div class="wd-bs-main"><h3>Datei</h3><p class="wd-bs-hint"></p></div>
        </div>
        <div class="wd-pagewrap"><div class="wd-page">${S.text.map((t, i) => `<p class="${i === 0 ? "wd-h" : ""}">${esc(t)}</p>`).join("")}</div></div>
        <div class="wd-status"></div>
      </div>`;
    const root = host.querySelector(".wd");
    const bs = root.querySelector(".wd-backstage");
    const hint = root.querySelector(".wd-bs-hint");

    function render() {
      const g = S.gespeichert;
      root.querySelector(".wd-docname").textContent = (g ? g.name : S.dokName) + " – Word";
      root.querySelector(".wd-status").textContent = g ? `Zuletzt gespeichert: ${g.name} (${g.typ}) in ${g.ordner.replace(/\//g, " › ")}` : "Noch nicht gespeichert";
    }
    root.querySelector('[data-m="datei"]').addEventListener("click", () => { bs.hidden = false; hint.textContent = ""; });
    bs.addEventListener("click", (e) => {
      const b = e.target.closest("[data-b]");
      if (!b) return;
      const k = b.dataset.b;
      if (k === "zurueck") { bs.hidden = true; return; }
      if (k === "speichernunter" || (k === "speichern" && !S.gespeichert)) { bs.hidden = true; dialog(); return; }
      if (k === "speichern") { hint.textContent = "Das Dokument wurde gespeichert."; return; }
      hint.textContent = "Diese Funktion wird in dieser Aufgabe nicht benötigt.";
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "F12") { e.preventDefault(); dialog(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && e.shiftKey) { e.preventDefault(); dialog(); }
    });
    root.tabIndex = 0;

    function dialog() {
      S.dialogGeoeffnet = true;
      ctx.save();
      KL.dateiDialog.open(root, {
        modus: "speichern", fsState: S.fs, start: "dokumente",
        name: S.gespeichert ? S.gespeichert.name : S.dokName, typen: TYPEN, typ: TYPEN[0],
        onFertig: (r) => { S.gespeichert = r; S.alle = (S.alle || []).concat([r]); S.versuche++; ctx.save(); render(); },
      });
    }
    render();
    return function destroy() {};
  }

  return { init, mount, TYPEN };
})();

/* ---------------- Lernplattform: Herunterladen und Hochladen -------- */
KL.sims.browser = (() => {
  "use strict";
  const { esc } = KL.util;

  // def: { url, kurs, material:[{name, groesse}], fs:{...}, aufgabeTitel }
  function init(def) {
    return { def, fs: KL.fs.build(def.fs), downloads: [], gewaehlt: null, hochgeladen: null, uploadVersuche: 0 };
  }

  function mount(host, S, ctx) {
    const d = S.def;
    host.innerHTML = `
      <div class="br">
        <div class="br-tabs"><span class="br-tab">🎓 ${esc(d.kurs)}</span><span class="win-ctrls"><span>—</span><span>☐</span><span>✕</span></span></div>
        <div class="br-bar"><span>←</span><span>→</span><span>⟳</span><div class="br-url">🔒 ${esc(d.url)}</div><span class="br-dlicon" title="Downloads">⬇</span></div>
        <div class="br-page">
          <h3>${esc(d.kurs)}</h3>
          <section class="br-card"><h4>📚 Material</h4>
            <ul class="br-files">${d.material.map((m, i) => `<li><span>${KL.fs.icon({ name: m.name, typ: "datei" })} ${esc(m.name)} <small>(${esc(m.groesse)})</small></span><button type="button" class="br-dl" data-i="${i}">⬇ Herunterladen</button></li>`).join("")}</ul>
          </section>
          <section class="br-card"><h4>📤 Abgabe: ${esc(d.aufgabeTitel)}</h4>
            <p class="br-small">Erlaubt: .docx, .pdf · max. 10 MB</p>
            <div class="br-upload">
              <button type="button" class="br-pick">Datei auswählen</button>
              <span class="br-chosen"></span>
            </div>
            <button type="button" class="br-send">Hochladen</button>
            <div class="br-progress" hidden><div></div></div>
            <div class="br-result"></div>
          </section>
        </div>
        <div class="br-dlbar" hidden></div>
      </div>`;
    const root = host.querySelector(".br");
    const elChosen = root.querySelector(".br-chosen");
    const elResult = root.querySelector(".br-result");
    const elProg = root.querySelector(".br-progress");
    const elDl = root.querySelector(".br-dlbar");

    function render() {
      elChosen.textContent = S.gewaehlt ? S.gewaehlt.name : "Keine Datei ausgewählt";
      elResult.textContent = S.hochgeladen ? `Hochgeladen: ${S.hochgeladen.name}` : "";
      if (S.downloads.length) {
        elDl.hidden = false;
        elDl.innerHTML = S.downloads.slice(-3).map((n) => `<span class="br-dlitem">📄 ${esc(n)} <small>Fertig · gespeichert in „Downloads“</small></span>`).join("");
      }
    }
    root.querySelectorAll(".br-dl").forEach((b) => b.addEventListener("click", () => {
      const m = d.material[+b.dataset.i];
      S.downloads.push(m.name);
      const dl = S.fs.nodes.downloads;
      if (!dl.kinder.some((id) => S.fs.nodes[id].name === m.name)) {
        const id = "n" + S.fs.seq++;
        S.fs.nodes[id] = { id, name: m.name, typ: "datei", eltern: "downloads", groesse: 120, datum: "29.10.2026 10:15" };
        dl.kinder.push(id);
      }
      ctx.save();
      render();
    }));
    root.querySelector(".br-pick").addEventListener("click", () => {
      KL.dateiDialog.open(root, {
        modus: "oeffnen", fsState: S.fs, start: "dokumente",
        filter: (n) => /\.(docx|pdf)$/i.test(n.name),
        onFertig: (r) => { S.gewaehlt = r; ctx.save(); render(); },
      });
    });
    root.querySelector(".br-send").addEventListener("click", () => {
      if (!S.gewaehlt) { elResult.textContent = "Bitte zuerst eine Datei auswählen."; return; }
      S.uploadVersuche++;
      elProg.hidden = false;
      const bar = elProg.querySelector("div");
      bar.style.width = "0%";
      let p = 0;
      const t = setInterval(() => {
        p += 20;
        bar.style.width = p + "%";
        if (p >= 100) {
          clearInterval(t);
          elProg.hidden = true;
          S.hochgeladen = { ...S.gewaehlt };
          ctx.save();
          render();
        }
      }, 250);
    });
    render();
    return function destroy() {};
  }

  return { init, mount };
})();
