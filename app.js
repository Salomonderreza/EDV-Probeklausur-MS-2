/* =====================================================================
   KLAUSUR-ABLAUF: Start, Aufgabennavigation, Timer, Speicherung im
   Browser, Fokus-Protokoll, Abgabe, PDF-Bericht.
   ===================================================================== */
(() => {
  "use strict";
  const C = KL.CONFIG;
  const U = KL.util;
  const { esc } = U;
  const app = document.getElementById("app");
  const KEY = C.SPEICHER_SCHLUESSEL;
  const DAUER_MS = C.DAUER_MINUTEN * 60 * 1000;

  let S = null;              // gesamter Klausurzustand
  let destroySim = null;
  let timer = null;
  let speicherFehler = false;

  // ---------------- Speicherung ----------------
  function laden() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  let saveTimer = null;
  function speichern(sofort) {
    clearTimeout(saveTimer);
    const run = () => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); speicherFehler = false; }
      catch (e) { speicherFehler = true; }
      const w = document.querySelector(".kl-savewarn");
      if (w) w.hidden = !speicherFehler;
    };
    if (sofort) run(); else saveTimer = setTimeout(run, 150);
  }

  function initAufgabe(task) {
    const sim = KL.sims[task.sim.typ];
    const rand = U.rng((S.seed + task.id.charCodeAt(0) * 131 + Number(task.id.slice(1)) * 7919) >>> 0);
    let st;
    if (task.sim.typ === "explorer") st = KL.fs.build(task.sim.def);
    else st = sim.init(task.sim.def, rand);
    return { sim: st, antworten: {}, beruehrt: false };
  }

  // ---------------- Startseite ----------------
  function startseite() {
    app.innerHTML = `
      <div class="kl-start">
        <div class="kl-start-card">
          <div class="kl-kicker">Klausur</div>
          <h1>${esc(C.TITEL)}</h1>
          <p class="kl-sub">${esc(C.UNTERTITEL)}</p>
          <div class="kl-facts">
            <div><b>${C.DAUER_MINUTEN} Minuten</b><span>Bearbeitungszeit</span></div>
            <div><b>${KL.AUFGABEN.reduce((s, t) => s + t.punkte, 0)} Punkte</b><span>${KL.AUFGABEN.length} Aufgaben in 2 Teilen</span></div>
            <div><b>Keine Hilfsmittel</b><span>keine Erklärungen, keine Tipps</span></div>
          </div>
          <ul class="kl-rules">
            <li>Du kannst die Aufgaben in beliebiger Reihenfolge bearbeiten und bis zur Abgabe ändern.</li>
            <li>Du bekommst während der Klausur <b>keine Rückmeldung</b>, ob eine Lösung richtig ist.</li>
            <li>Dein Stand wird automatisch in diesem Browser gespeichert. Falls die Seite neu lädt, geht nichts verloren.</li>
            <li>Bleibe in diesem Fenster. <b>Wechsel in andere Fenster oder Tabs werden protokolliert</b> und stehen im Bericht.</li>
            <li>Nach Ablauf der Zeit wird automatisch abgegeben. Danach erstellst du den PDF-Bericht und schickst ihn per E-Mail.</li>
          </ul>
          <form class="kl-form" autocomplete="off">
            <label>Vor- und Nachname<input name="name" required maxlength="60" spellcheck="false" /></label>
            <label>Klasse / Kurs<input name="klasse" required maxlength="30" spellcheck="false" /></label>
            <label class="kl-check"><input type="checkbox" name="ok" required /> Ich bearbeite die Klausur selbstständig und ohne fremde Hilfe.</label>
            <button type="submit" class="kl-btn primary big">Klausur starten</button>
          </form>
        </div>
      </div>`;
    app.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.name.value.trim().replace(/\s+/g, " ");
      const klasse = f.klasse.value.trim();
      if (name.split(" ").length < 2) { modal("Bitte gib deinen Vor- und Nachnamen ein.", [["OK"]]); return; }
      S = {
        v: 1, name, klasse,
        seed: (Math.random() * 4294967296) >>> 0,
        start: Date.now(), ende: null, abgabeArt: null,
        fokus: { anzahl: 0, sekunden: 0 },
        aktuell: KL.AUFGABEN[0].id,
        aufgaben: {},
      };
      KL.AUFGABEN.forEach((t) => (S.aufgaben[t.id] = initAufgabe(t)));
      speichern(true);
      klausur();
    });
  }

  // ---------------- Klausuransicht ----------------
  function klausur() {
    app.innerHTML = `
      <div class="kl-shell">
        <header class="kl-head">
          <div class="kl-head-title">${esc(C.TITEL)}</div>
          <div class="kl-head-who">${esc(S.name)} · ${esc(S.klasse)}</div>
          <div class="kl-timer" title="Verbleibende Zeit">⏱ <span>--:--</span></div>
          <button type="button" class="kl-btn primary" data-abgeben>Abgeben</button>
        </header>
        <div class="kl-savewarn" hidden>Achtung: Dein Stand kann in diesem Browser nicht gespeichert werden. Lade die Seite nicht neu und sag deiner Lehrkraft Bescheid.</div>
        <div class="kl-body">
          <aside class="kl-side"></aside>
          <main class="kl-main"></main>
        </div>
      </div>`;
    app.querySelector("[data-abgeben]").addEventListener("click", abgabeDialog);
    seitenleiste();
    zeigeAufgabe(S.aktuell);
    starteTimer();
  }

  function bearbeitet(id) { return S.aufgaben[id] && S.aufgaben[id].beruehrt; }

  function seitenleiste() {
    const side = app.querySelector(".kl-side");
    side.innerHTML = KL.TEILE.map((teil) => {
      const tasks = KL.AUFGABEN.filter((t) => t.teil === teil.id);
      const sum = tasks.reduce((s, t) => s + t.punkte, 0);
      return `<div class="kl-part"><div class="kl-part-title">${esc(teil.titel)} <span>${sum} P.</span></div>
        ${tasks.map((t) => `<button type="button" class="kl-nav ${t.id === S.aktuell ? "active" : ""} ${bearbeitet(t.id) ? "done" : ""}" data-id="${t.id}">
          <span class="kl-nav-id">${t.id}</span><span class="kl-nav-t">${esc(t.titel)}</span><span class="kl-nav-p">${t.punkte} P.</span></button>`).join("")}
      </div>`;
    }).join("") + `<div class="kl-legend"><span class="kl-dot done"></span> bearbeitet <span class="kl-dot"></span> noch nicht bearbeitet</div>`;
    side.querySelectorAll(".kl-nav").forEach((b) => b.addEventListener("click", () => zeigeAufgabe(b.dataset.id)));
  }
  function markiereNav() {
    app.querySelectorAll(".kl-nav").forEach((b) => {
      b.classList.toggle("active", b.dataset.id === S.aktuell);
      b.classList.toggle("done", bearbeitet(b.dataset.id));
    });
  }

  function zeigeAufgabe(id) {
    if (destroySim) { try { destroySim(); } catch (e) {} destroySim = null; }
    S.aktuell = id;
    speichern();
    const idx = KL.AUFGABEN.findIndex((t) => t.id === id);
    const task = KL.AUFGABEN[idx];
    const zustand = S.aufgaben[id];
    const main = app.querySelector(".kl-main");
    main.innerHTML = `
      <div class="kl-task-head">
        <div><div class="kl-task-kicker">Aufgabe ${task.id} · ${task.punkte} Punkte</div><h2>${esc(task.titel)}</h2></div>
      </div>
      <ol class="kl-auftrag">${task.auftrag.map((a) => `<li>${a}</li>`).join("")}</ol>
      ${task.hinweis ? `<p class="kl-hinweis">${esc(task.hinweis)}</p>` : ""}
      <div class="kl-sim kl-sim-${task.sim.typ}"></div>
      ${(task.felder || []).length ? `<div class="kl-felder">${task.felder.map((f) => `
        <label class="kl-feld"><span>${esc(f.label)}</span><input data-feld="${f.id}" placeholder="${esc(f.platzhalter || "")}" value="${esc(zustand.antworten[f.id] || "")}" spellcheck="false" autocomplete="off" /></label>`).join("")}</div>` : ""}
      <div class="kl-task-foot">
        <button type="button" class="kl-btn ghost" data-reset>Aufgabe zurücksetzen</button>
        <span class="kl-spacer"></span>
        <button type="button" class="kl-btn" data-prev ${idx === 0 ? "disabled" : ""}>← Vorherige</button>
        <button type="button" class="kl-btn" data-next ${idx === KL.AUFGABEN.length - 1 ? "disabled" : ""}>Nächste →</button>
      </div>`;
    const host = main.querySelector(".kl-sim");
    const ctx = {
      task,
      save() {
        if (!zustand.beruehrt) { zustand.beruehrt = true; markiereNav(); }
        speichern();
      },
    };
    destroySim = KL.sims[task.sim.typ].mount(host, zustand.sim, ctx);
    main.querySelectorAll("[data-feld]").forEach((inp) => inp.addEventListener("input", () => {
      zustand.antworten[inp.dataset.feld] = inp.value;
      ctx.save();
    }));
    main.querySelector("[data-reset]").addEventListener("click", () => {
      modal(`Aufgabe ${task.id} wirklich auf den Anfangszustand zurücksetzen? Alles, was du in dieser Aufgabe gemacht hast, geht verloren.`, [
        ["Zurücksetzen", () => {
          if (destroySim) { try { destroySim(); } catch (e) {} destroySim = null; }
          S.aufgaben[id] = initAufgabe(task);
          speichern(true);
          markiereNav();
          zeigeAufgabe(id);
        }, "danger"],
        ["Abbrechen"],
      ]);
    });
    main.querySelector("[data-prev]").addEventListener("click", () => zeigeAufgabe(KL.AUFGABEN[idx - 1].id));
    main.querySelector("[data-next]").addEventListener("click", () => zeigeAufgabe(KL.AUFGABEN[idx + 1].id));
    markiereNav();
    main.scrollTop = 0;
  }

  // ---------------- Timer ----------------
  function starteTimer() {
    clearInterval(timer);
    const el = app.querySelector(".kl-timer");
    const span = el.querySelector("span");
    let warn10 = false, warn5 = false;
    const tick = () => {
      const rest = S.start + DAUER_MS - Date.now();
      if (rest <= 0) { clearInterval(timer); abgeben("zeit"); return; }
      const m = Math.floor(rest / 60000), s = Math.floor((rest % 60000) / 1000);
      span.textContent = `${U.pad(m)}:${U.pad(s)}`;
      el.classList.toggle("warn", rest < 10 * 60000);
      el.classList.toggle("crit", rest < 5 * 60000);
      if (!warn10 && rest < 10 * 60000 && rest > 9.9 * 60000) { warn10 = true; hinweis("Noch 10 Minuten."); }
      if (!warn5 && rest < 5 * 60000 && rest > 4.9 * 60000) { warn5 = true; hinweis("Noch 5 Minuten. Denke an die Abgabe."); }
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  function hinweis(text) {
    const d = document.createElement("div");
    d.className = "kl-toast";
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6000);
  }

  // ---------------- Fokus-Protokoll ----------------
  let weg = null;
  function verlassen() { if (S && !S.ende && weg === null) weg = Date.now(); }
  function zurueck() {
    if (!S || S.ende || weg === null) { weg = null; return; }
    const dauer = Date.now() - weg;
    weg = null;
    if (dauer >= 2000) {
      S.fokus.anzahl++;
      S.fokus.sekunden += Math.round(dauer / 1000);
      speichern(true);
    }
  }
  window.addEventListener("blur", verlassen);
  window.addEventListener("focus", zurueck);
  document.addEventListener("visibilitychange", () => (document.hidden ? verlassen() : zurueck()));

  window.addEventListener("beforeunload", (e) => {
    if (S && !S.ende) { speichern(true); e.preventDefault(); e.returnValue = ""; }
  });

  // ---------------- Abgabe ----------------
  function abgabeDialog() {
    const n = KL.AUFGABEN.filter((t) => bearbeitet(t.id)).length;
    const offen = KL.AUFGABEN.filter((t) => !bearbeitet(t.id)).map((t) => t.id);
    modal(`<b>Klausur jetzt abgeben?</b><br><br>Bearbeitet: ${n} von ${KL.AUFGABEN.length} Aufgaben.${offen.length ? `<br>Noch nicht bearbeitet: ${offen.join(", ")}` : ""}<br><br>Nach der Abgabe kannst du nichts mehr ändern.`, [
      ["Endgültig abgeben", () => abgeben("manuell"), "primary"],
      ["Weiter bearbeiten"],
    ], true);
  }

  function abgeben(art) {
    if (!S || S.ende) return;
    if (destroySim) { try { destroySim(); } catch (e) {} destroySim = null; }
    clearInterval(timer);
    S.ende = Math.min(Date.now(), S.start + DAUER_MS + 5000);
    S.abgabeArt = art;
    speichern(true);
    abgegeben();
  }

  function ergebnis() {
    const tasks = KL.AUFGABEN.map((t) => ({ task: t, ...KL.bewerte(t, S.aufgaben[t.id]), beruehrt: bearbeitet(t.id) }));
    const punkte = tasks.reduce((s, t) => s + t.punkte, 0);
    const max = tasks.reduce((s, t) => s + t.max, 0);
    const prozent = Math.round((punkte / max) * 1000) / 10;
    return { tasks, punkte, max, prozent, note: U.note(prozent) };
  }

  function prueftcode(erg) {
    return U.makeCode({
      v: 1, x: KL.CONFIG.KENNUNG, n: S.name, k: S.klasse,
      s: Math.round(S.start / 1000), e: Math.round(S.ende / 1000),
      a: S.abgabeArt === "zeit" ? "z" : "m",
      f: [S.fokus.anzahl, S.fokus.sekunden],
      m: erg.tasks.map((t) => t.kriterien.reduce((bits, k, i) => bits | (k.ok ? 1 << i : 0), 0)),
      b: erg.tasks.map((t) => (t.beruehrt ? 1 : 0)).join(""),
      g: erg.punkte,
    });
  }

  function abgegeben() {
    clearInterval(timer);
    app.innerHTML = `
      <div class="kl-start">
        <div class="kl-start-card">
          <div class="kl-kicker">${S.abgabeArt === "zeit" ? "Zeit abgelaufen – automatisch abgegeben" : "Abgegeben"}</div>
          <h1>Deine Klausur ist abgegeben ✓</h1>
          <p class="kl-sub">${esc(S.name)} · ${esc(S.klasse)} · ${U.fmtDatum(S.start)}, ${U.fmtZeit(S.start)}–${U.fmtZeit(S.ende)} Uhr</p>
          <ol class="kl-steps">
            <li>Klicke auf <b>„PDF-Bericht herunterladen“</b>.</li>
            <li>${esc(C.ABGABE_HINWEIS)}</li>
          </ol>
          <button type="button" class="kl-btn primary big" data-pdf>PDF-Bericht herunterladen</button>
          <p class="kl-small" data-pdfinfo></p>
        </div>
      </div>`;
    app.querySelector("[data-pdf]").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Bericht wird erstellt …";
      try {
        const erg = ergebnis();
        const code = prueftcode(erg);
        const blob = await KL.bericht(S, erg, code);
        const dateiname = `Klausur_${S.name.replace(/[^A-Za-zÄÖÜäöüß0-9]+/g, "_")}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = dateiname;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        app.querySelector("[data-pdfinfo]").textContent = `Gespeichert als „${dateiname}“ (meist im Ordner „Downloads“).`;
      } catch (err) {
        app.querySelector("[data-pdfinfo]").textContent = "Der Bericht konnte nicht erstellt werden. Bitte sag deiner Lehrkraft Bescheid.";
        console.error(err);
      }
      btn.disabled = false;
      btn.textContent = "PDF-Bericht erneut herunterladen";
    });
  }

  // ---------------- Modaldialog ----------------
  function modal(html, buttons, isHtml) {
    const ov = document.createElement("div");
    ov.className = "kl-modal";
    ov.innerHTML = `<div class="kl-modal-box"><div class="kl-modal-text">${isHtml === false ? esc(html) : html}</div><div class="kl-modal-btns">${buttons.map((b, i) => `<button type="button" class="kl-btn ${b[2] || ""}" data-i="${i}">${esc(b[0])}</button>`).join("")}</div></div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
      ov.remove();
      const fn = buttons[+b.dataset.i][1];
      if (fn) fn();
    }));
    ov.querySelector("[data-i]").focus();
  }

  // ---------------- Start ----------------
  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.has("reset")) {
      modal("Gespeicherten Klausurstand auf diesem Gerät löschen? Das ist nur für Testläufe gedacht.", [
        ["Löschen", () => { localStorage.removeItem(KEY); location.replace(location.pathname); }, "danger"],
        ["Abbrechen", () => location.replace(location.pathname)],
      ]);
      return;
    }
    S = laden();
    if (S && S.v === 1 && S.aufgaben) {
      // Fehlende Aufgaben (z. B. nach Aktualisierung) ergänzen
      KL.AUFGABEN.forEach((t) => { if (!S.aufgaben[t.id]) S.aufgaben[t.id] = initAufgabe(t); });
      if (!KL.AUFGABEN.some((t) => t.id === S.aktuell)) S.aktuell = KL.AUFGABEN[0].id;
      if (S.ende) abgegeben();
      else if (Date.now() > S.start + DAUER_MS) abgeben("zeit");
      else klausur();
    } else {
      S = null;
      startseite();
    }
  }

  KL.app = { ergebnis: () => ergebnis(), zustand: () => S };
  boot();
})();
