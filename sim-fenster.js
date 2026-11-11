/* =====================================================================
   SIMULATION: WINDOWS-DESKTOP mit Startmenü, Taskleiste und Fenstern.
   Zustand: welche Programme offen, minimiert, maximiert sind; wie sie
   geöffnet wurden; ob ein Fenster verschoben wurde. Keine Rückmeldung.
   ===================================================================== */
window.KL = window.KL || {};
KL.sims = KL.sims || {};

KL.sims.fenster = (() => {
  "use strict";
  const { esc } = KL.util;

  const APPS = {
    edge: { name: "Microsoft Edge", icon: "🌐", inhalt: '<div class="fw-web"><div class="fw-web-bar">https://www.wetter-monheim.de</div><h3>Wetter Monheim am Rhein</h3><p>Heute: 12 °C, bewölkt</p></div>' },
    editor: { name: "Editor", icon: "📝", inhalt: '<div class="fw-note">Einkaufsliste<br>- Brot<br>- Milch<br>- Äpfel</div>' },
    paint: { name: "Paint", icon: "🎨", inhalt: '<div class="fw-paint"><div class="fw-paint-tools">✏️ 🪣 🔤 ⬛ 🟥 🟦</div><div class="fw-paint-canvas"></div></div>' },
    rechner: { name: "Rechner", icon: "🧮", inhalt: '<div class="fw-calc"><div class="fw-calc-disp">0</div><div class="fw-calc-keys">' + "789÷456×123−0,=+".split("").map((k) => `<span>${k}</span>`).join("") + "</div></div>" },
    explorer: { name: "Datei-Explorer", icon: "📁", inhalt: '<div class="fw-note">Schnellzugriff<br>📁 Desktop<br>📁 Dokumente<br>📁 Downloads</div>' },
    word: { name: "Word", icon: "📘", inhalt: '<div class="fw-note">Dokument1</div>' },
    einstellungen: { name: "Einstellungen", icon: "⚙️", inhalt: '<div class="fw-note">System · Bluetooth · Netzwerk · Personalisierung</div>' },
    uhr: { name: "Uhr", icon: "⏰", inhalt: '<div class="fw-note">Wecker · Timer · Stoppuhr</div>' },
  };
  const START_APPS = ["edge", "word", "explorer", "editor", "rechner", "paint", "uhr", "einstellungen"];

  // def: { fenster: [{app, zustand:'normal'|'min'|'max', x, y}], uhr:"10:47", datum:"29.10.2026" }
  function init(def) {
    const fenster = {};
    let z = 1;
    for (const f of def.fenster) {
      fenster[f.app] = { offen: true, min: f.zustand === "min", max: f.zustand === "max", x: f.x, y: f.y, z: z++, verschoben: false, via: "start" };
    }
    return { fenster, uhr: def.uhr, datum: def.datum || KL.util.fmtDatum(Date.now()), z, startGeoeffnet: [], log: [] };
  }

  function mount(host, S, ctx) {
    host.innerHTML = `
      <div class="fw">
        <div class="fw-desktop">
          <div class="fw-icons">
            <div class="fw-dicon" data-app="papierkorb"><span>🗑️</span>Papierkorb</div>
            <div class="fw-dicon" data-app="explorer"><span>📁</span>Datei-Explorer</div>
          </div>
          <div class="fw-windows"></div>
          <div class="fw-start" hidden>
            <input class="fw-start-search" placeholder="Zum Suchen hier eingeben" />
            <div class="fw-start-title">Angeheftet</div>
            <div class="fw-start-grid"></div>
          </div>
        </div>
        <div class="fw-taskbar">
          <button type="button" class="fw-startbtn" title="Start">⊞</button>
          <div class="fw-tasks"></div>
          <div class="fw-tray"><span>🔊</span><span>📶</span><div class="fw-clock"><div>${esc(S.uhr)}</div><div>${esc(S.datum)}</div></div></div>
        </div>
      </div>`;
    const root = host.querySelector(".fw");
    const elWins = root.querySelector(".fw-windows");
    const elTasks = root.querySelector(".fw-tasks");
    const elStart = root.querySelector(".fw-start");
    const elGrid = root.querySelector(".fw-start-grid");
    const elSearch = root.querySelector(".fw-start-search");

    function log(op, app) { S.log.push({ op, app }); if (S.log.length > 200) S.log.shift(); }
    function save() { ctx.save(); }

    function oeffnen(app, via) {
      const f = S.fenster[app];
      if (f && f.offen) { f.min = false; f.z = ++S.z; }
      else {
        const n = Object.values(S.fenster).filter((x) => x.offen).length;
        S.fenster[app] = { offen: true, min: false, max: false, x: 40 + n * 30, y: 20 + n * 24, z: ++S.z, verschoben: false, via };
      }
      if (via === "start" && !S.startGeoeffnet.includes(app)) S.startGeoeffnet.push(app);
      log("oeffnen-" + via, app);
      save();
      render();
    }

    function renderStart() {
      const q = elSearch.value.trim().toLowerCase();
      elGrid.innerHTML = START_APPS.filter((a) => !q || APPS[a].name.toLowerCase().includes(q))
        .map((a) => `<button type="button" class="fw-sapp" data-app="${a}"><span>${APPS[a].icon}</span>${esc(APPS[a].name)}</button>`).join("");
    }

    function render() {
      const offen = Object.entries(S.fenster).filter(([, f]) => f.offen);
      const top = offen.filter(([, f]) => !f.min).sort((a, b) => b[1].z - a[1].z)[0];
      elWins.innerHTML = offen.filter(([, f]) => !f.min).map(([app, f]) => `
        <div class="fw-win ${f.max ? "max" : ""} ${top && top[0] === app ? "active" : ""}" data-app="${app}" style="left:${f.x}px;top:${f.y}px;z-index:${f.z}">
          <div class="fw-win-title"><span>${APPS[app].icon} ${esc(APPS[app].name)}</span>
            <span class="fw-win-btns">
              <button type="button" data-w="min" title="Minimieren">—</button>
              <button type="button" data-w="max" title="${f.max ? "Verkleinern" : "Maximieren"}">${f.max ? "❐" : "☐"}</button>
              <button type="button" data-w="close" class="close" title="Schließen">✕</button>
            </span></div>
          <div class="fw-win-body">${APPS[app].inhalt}</div>
        </div>`).join("");
      elTasks.innerHTML = offen.map(([app, f]) =>
        `<button type="button" class="fw-task ${!f.min && top && top[0] === app ? "active" : ""} ${f.min ? "min" : ""}" data-app="${app}" title="${esc(APPS[app].name)}">${APPS[app].icon}<span>${esc(APPS[app].name)}</span></button>`).join("");
    }

    root.querySelector(".fw-startbtn").addEventListener("click", (e) => {
      e.stopPropagation();
      elStart.hidden = !elStart.hidden;
      if (!elStart.hidden) { elSearch.value = ""; renderStart(); log("startmenue"); }
    });
    elSearch.addEventListener("input", renderStart);
    elSearch.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { const b = elGrid.querySelector(".fw-sapp"); if (b) b.click(); }
    });
    elGrid.addEventListener("click", (e) => {
      const b = e.target.closest(".fw-sapp");
      if (!b) return;
      elStart.hidden = true;
      oeffnen(b.dataset.app, "start");
    });
    root.querySelector(".fw-desktop").addEventListener("mousedown", (e) => {
      if (!e.target.closest(".fw-start")) elStart.hidden = true;
    });
    root.querySelector(".fw-icons").addEventListener("dblclick", (e) => {
      const d = e.target.closest(".fw-dicon");
      if (d && APPS[d.dataset.app]) oeffnen(d.dataset.app, "desktop");
    });
    elTasks.addEventListener("click", (e) => {
      const b = e.target.closest(".fw-task");
      if (!b) return;
      const app = b.dataset.app, f = S.fenster[app];
      const offen = Object.entries(S.fenster).filter(([, x]) => x.offen && !x.min).sort((a, b2) => b2[1].z - a[1].z)[0];
      if (f.min) { f.min = false; f.z = ++S.z; log("wiederherstellen-taskleiste", app); }
      else if (offen && offen[0] === app) { f.min = true; log("minimieren-taskleiste", app); }
      else { f.z = ++S.z; log("fokus-taskleiste", app); }
      save();
      render();
    });

    elWins.addEventListener("mousedown", (e) => {
      const w = e.target.closest(".fw-win");
      if (!w) return;
      const app = w.dataset.app, f = S.fenster[app];
      if (e.target.closest("button")) return;
      if (f.z !== S.z) { f.z = ++S.z; render(); }
      const title = e.target.closest(".fw-win-title");
      if (!title || f.max) return;
      const sx = e.clientX, sy = e.clientY, ox = f.x, oy = f.y;
      const winEl = elWins.querySelector(`.fw-win[data-app="${app}"]`);
      const area = root.querySelector(".fw-desktop").getBoundingClientRect();
      const move = (ev) => {
        f.x = Math.max(-200, Math.min(area.width - 80, ox + ev.clientX - sx));
        f.y = Math.max(0, Math.min(area.height - 40, oy + ev.clientY - sy));
        winEl.style.left = f.x + "px";
        winEl.style.top = f.y + "px";
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        if (Math.abs(f.x - ox) + Math.abs(f.y - oy) > 30) { f.verschoben = true; log("verschieben", app); }
        save();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      e.preventDefault();
    });
    elWins.addEventListener("dblclick", (e) => {
      const t = e.target.closest(".fw-win-title");
      if (!t || e.target.closest("button")) return;
      const app = t.closest(".fw-win").dataset.app;
      S.fenster[app].max = !S.fenster[app].max;
      log(S.fenster[app].max ? "maximieren" : "verkleinern", app);
      save();
      render();
    });
    elWins.addEventListener("click", (e) => {
      const b = e.target.closest("[data-w]");
      if (!b) return;
      const app = b.closest(".fw-win").dataset.app, f = S.fenster[app];
      if (b.dataset.w === "min") { f.min = true; log("minimieren", app); }
      if (b.dataset.w === "max") { f.max = !f.max; log(f.max ? "maximieren" : "verkleinern", app); }
      if (b.dataset.w === "close") { f.offen = false; f.min = false; f.max = false; log("schliessen", app); }
      save();
      render();
    });

    render();
    return function destroy() {};
  }

  return { init, mount, APPS };
})();
