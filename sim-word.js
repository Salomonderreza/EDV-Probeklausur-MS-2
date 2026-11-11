/* =====================================================================
   SIMULATION: WORD-TEXTBEARBEITUNG (vereinfachtes Word-Fenster).
   Basierend auf der Engine des Word-Kompetenztrainers: echte Auswahl
   über die Selection-API, Methodenerkennung Maus/Tastatur, eigene
   Zwischenablage als Rückfallebene für Schul-Browser. Zusätzlich
   protokolliert: benutzte Tastenkombinationen, Ausschneiden/Kopieren/
   Einfügen, Rückgängig/Wiederholen und der Verlauf der Textstände.
   "Live"-Kriterien (z. B. eine bestimmte Markierung) werden gespeichert,
   sobald sie einmal erfüllt waren. Keine Rückmeldung an die Lernenden.
   ===================================================================== */
window.KL = window.KL || {};
KL.sims = KL.sims || {};

KL.sims.word = (() => {
  "use strict";
  const { esc, norm } = KL.util;

  // def: { dokName, absaetze:[...] }
  function init(def) {
    return {
      absaetze: def.absaetze.slice(),
      verlauf: [norm(def.absaetze.join("\n"))],
      tasten: [],
      zaehler: { rueckgaengig: 0, wiederholen: 0, ausschneiden: 0, kopieren: 0, einfuegen: 0 },
      erreicht: {},
      bearbeitet: false,
    };
  }

  function mount(host, S, ctx) {
    const def = ctx.task.sim.def;
    const kriterien = ctx.task.kriterien || [];
    host.innerHTML = `
      <div class="wd wd-edit">
        <div class="wd-title"><span>📘</span><span>${esc(def.dokName)} – Word</span><span class="win-ctrls"><span>—</span><span>☐</span><span>✕</span></span></div>
        <div class="wd-ribbon">
          <div class="wd-tabs"><span class="on">Start</span><span>Einfügen</span><span>Layout</span><span>Überprüfen</span><span>Ansicht</span></div>
          <div class="wd-tools">
            <div class="wd-group">
              <button type="button" class="wd-tool big" data-cmd="einfuegen" title="Einfügen (Strg+V)">📋<span>Einfügen</span></button>
              <div class="wd-col">
                <button type="button" class="wd-tool" data-cmd="ausschneiden" title="Ausschneiden (Strg+X)">✂️ Ausschneiden</button>
                <button type="button" class="wd-tool" data-cmd="kopieren" title="Kopieren (Strg+C)">⧉ Kopieren</button>
              </div>
              <div class="wd-glabel">Zwischenablage</div>
            </div>
            <div class="wd-group">
              <div class="wd-col">
                <button type="button" class="wd-tool" data-cmd="rueckgaengig" title="Rückgängig (Strg+Z)">↶ Rückgängig</button>
                <button type="button" class="wd-tool" data-cmd="wiederholen" title="Wiederholen (Strg+Y)">↷ Wiederholen</button>
              </div>
              <div class="wd-glabel">Rückgängig</div>
            </div>
            <div class="wd-group wd-fake"><span><b>F</b> <i>K</i> <u>U</u></span><span>Calibri · 11</span><div class="wd-glabel">Schriftart</div></div>
          </div>
        </div>
        <div class="wd-pagewrap"><div class="wd-page"><div class="wd-editor" contenteditable="true" spellcheck="false"></div></div></div>
        <div class="wd-status"><span class="wd-count"></span><span>Deutsch (Deutschland)</span></div>
      </div>`;
    const editor = host.querySelector(".wd-editor");
    const elCount = host.querySelector(".wd-count");
    let lastMethod = null;
    let appClip = ""; // wird über KL.zwischenablage seitenweit geteilt
    let saveTimer = null;

    function setAbsaetze(list) {
      editor.innerHTML = "";
      list.forEach((t) => {
        const p = document.createElement("p");
        if (t) p.textContent = t; else p.appendChild(document.createElement("br"));
        editor.appendChild(p);
      });
    }
    function getAbsaetze() {
      const out = [];
      let loose = "";
      editor.childNodes.forEach((n) => {
        if (n.nodeType === 3) { loose += n.data; return; }
        if (n.nodeType !== 1) return;
        if (n.tagName === "BR") { if (loose) { out.push(loose); loose = ""; } return; }
        if (loose) { out.push(loose); loose = ""; }
        out.push(n.textContent);
      });
      if (loose) out.push(loose);
      return out.length ? out : [""];
    }
    function plain() { return getAbsaetze().join("\n"); }
    function wortzahl() {
      const w = norm(plain()).split(/\s+/).filter(Boolean).length;
      elCount.textContent = `${w} Wörter`;
    }

    let dirty = false;
    function speichernBald() {
      dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(speichernJetzt, 250);
    }
    function speichernJetzt() {
      clearTimeout(saveTimer);
      if (!dirty) return;
      dirty = false;
      S.absaetze = getAbsaetze();
      ctx.save();
    }
    function textGeaendert() {
      const t = norm(plain());
      if (S.verlauf[S.verlauf.length - 1] !== t) {
        S.verlauf.push(t);
        if (S.verlauf.length > 400) S.verlauf.splice(1, 1);
      }
      S.bearbeitet = true;
      wortzahl();
      speichernBald();
    }
    function taste(combo) {
      if (!S.tasten.includes(combo)) { S.tasten.push(combo); speichernBald(); }
    }

    // ----- Live-Kriterien (z. B. Markierungen) -----
    function pruefeLive() {
      if (!kriterien.some((k) => k.live)) return;
      const sel = window.getSelection();
      const inEditor = sel && sel.rangeCount && editor.contains(sel.anchorNode);
      const c = {
        methode: lastMethod,
        markiert: inEditor && !sel.isCollapsed ? norm(sel.toString()) : "",
        text: norm(plain()),
        absaetze: getAbsaetze().map(norm),
      };
      let neu = false;
      kriterien.forEach((k, i) => {
        if (k.live && !S.erreicht[i]) {
          let ok = false;
          try { ok = !!k.live(c); } catch (e) { ok = false; }
          if (ok) { S.erreicht[i] = true; neu = true; }
        }
      });
      if (neu) speichernBald();
    }

    // ----- Ereignisse -----
    const NAV = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Backspace", "Delete", "PageUp", "PageDown"]);
    editor.addEventListener("mousedown", () => { lastMethod = "maus"; });
    editor.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (NAV.has(e.key) || (mod && ["a", "x", "c", "v", "z", "y"].includes(k))) lastMethod = "tastatur";
      if (!["control", "shift", "alt", "meta"].includes(k)) {
        const combo = (mod ? "strg+" : "") + (e.shiftKey && (mod || NAV.has(e.key)) ? "umschalt+" : "") + k;
        if (mod || NAV.has(e.key) || k === "enter") taste(combo);
      }
      if (mod && k === "z" && !e.shiftKey) S.zaehler.rueckgaengig++;
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
        S.zaehler.wiederholen++;
        // Strg+Y funktioniert nicht in jedem Browser nativ — einheitlich auslösen
        e.preventDefault();
        document.execCommand("redo");
        setTimeout(textGeaendert, 0);
      }
      // Formatierungen gehören nicht zu dieser Klausur
      if (mod && ["b", "i", "u", "f", "k"].includes(k)) e.preventDefault();
    });
    editor.addEventListener("beforeinput", (e) => {
      if (/^format/.test(e.inputType)) e.preventDefault();
    });
    editor.addEventListener("input", textGeaendert);
    editor.addEventListener("keyup", pruefeLive);
    editor.addEventListener("mouseup", () => setTimeout(pruefeLive, 0));
    const onSel = () => { if (document.activeElement === editor) pruefeLive(); };
    document.addEventListener("selectionchange", onSel);

    editor.addEventListener("copy", (e) => {
      const sel = window.getSelection();
      const t = sel ? sel.toString() : "";
      if (!t) return;
      appClip = t; KL.zwischenablage = t;
      S.zaehler.kopieren++;
      speichernBald();
      try { e.clipboardData.setData("text/plain", t); e.preventDefault(); } catch (err) {}
    });
    editor.addEventListener("cut", (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const t = sel.toString();
      appClip = t; KL.zwischenablage = t;
      S.zaehler.ausschneiden++;
      try {
        e.clipboardData.setData("text/plain", t);
        e.preventDefault();
        document.execCommand("delete");
      } catch (err) {}
      setTimeout(textGeaendert, 0);
    });
    function insertText(t) {
      if (!t) return;
      let ok = false;
      try { ok = document.execCommand("insertText", false, t); } catch (e) { ok = false; }
      if (!ok) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return;
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const node = document.createTextNode(t);
        r.insertNode(node);
        r.setStartAfter(node); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
      }
      textGeaendert();
    }
    editor.addEventListener("paste", (e) => {
      e.preventDefault();
      let t = "";
      // Zuletzt auf dieser Seite Kopiertes hat Vorrang (auch Kopien über das
      // Menüband, die nicht in die System-Zwischenablage gelangen).
      if (KL.zwischenablage) t = KL.zwischenablage;
      else { try { t = e.clipboardData ? e.clipboardData.getData("text/plain") : ""; } catch (err) {} }
      t = t.replace(/\r?\n/g, " ");
      S.zaehler.einfuegen++;
      insertText(t);
    });
    editor.addEventListener("drop", (e) => {
      // Ziehen von Text innerhalb des Dokuments ist erlaubt, Fremdinhalte nicht
      if (!e.dataTransfer || !e.dataTransfer.types.includes("text/plain")) e.preventDefault();
      setTimeout(textGeaendert, 0);
    });

    // Menüband-Schaltflächen (verändern die Auswahl nicht)
    host.querySelector(".wd-tools").addEventListener("mousedown", (e) => { if (e.target.closest(".wd-tool")) e.preventDefault(); });
    host.querySelector(".wd-tools").addEventListener("click", (e) => {
      const b = e.target.closest(".wd-tool");
      if (!b) return;
      const sel = window.getSelection();
      const inEditor = sel && sel.rangeCount && editor.contains(sel.anchorNode);
      editor.focus();
      switch (b.dataset.cmd) {
        case "kopieren":
          if (inEditor && !sel.isCollapsed) {
            appClip = sel.toString(); KL.zwischenablage = appClip; S.zaehler.kopieren++; speichernBald();
            try { navigator.clipboard.writeText(appClip).catch(() => {}); } catch (err) {}
          }
          break;
        case "ausschneiden":
          if (inEditor && !sel.isCollapsed) { appClip = sel.toString(); KL.zwischenablage = appClip; S.zaehler.ausschneiden++; document.execCommand("delete"); textGeaendert(); }
          break;
        case "einfuegen":
          if (inEditor && KL.zwischenablage) { S.zaehler.einfuegen++; insertText(KL.zwischenablage.replace(/\r?\n/g, " ")); }
          break;
        case "rueckgaengig":
          S.zaehler.rueckgaengig++; document.execCommand("undo"); textGeaendert();
          break;
        case "wiederholen":
          S.zaehler.wiederholen++; document.execCommand("redo"); textGeaendert();
          break;
      }
      pruefeLive();
    });

    setAbsaetze(S.absaetze);
    wortzahl();
    return function destroy() {
      document.removeEventListener("selectionchange", onSel);
      speichernJetzt();
    };
  }

  return { init, mount };
})();

// Seitenweite Zwischenablage: Was irgendwo auf der Klausurseite kopiert
// wird (auch aus dem Aufgabentext), steht beim Einfügen zur Verfügung —
// unabhängig davon, ob der Browser das Lesen der System-Zwischenablage
// erlaubt.
document.addEventListener("copy", () => {
  const t = String(window.getSelection() || "");
  if (t) KL.zwischenablage = t;
}, true);
document.addEventListener("cut", () => {
  const t = String(window.getSelection() || "");
  if (t) KL.zwischenablage = t;
}, true);
