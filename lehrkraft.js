/* =====================================================================
   LEHRKRAFT-SEITE — liest Prüfcodes aus PDF-Berichten, prüft die
   Signatur, berechnet Punkte und Noten, exportiert eine CSV-Notenliste.
   ===================================================================== */
(() => {
  "use strict";
  const U = KL.util;
  const { esc } = U;
  const out = document.querySelector(".lk-out");
  const csvBtn = document.querySelector("[data-csv]");
  let eintraege = [];

  function auswerten(code, quelle) {
    const { payload, gueltig } = U.readCode(code);
    if (!payload) return { quelle, fehler: "UNGÜLTIG: Prüfcode beschädigt oder verändert" };
    if ((payload.x || "K1") !== KL.CONFIG.KENNUNG) return { quelle, fehler: `Dieser Bericht gehört zu einer anderen Klausur (${payload.x || "Klausur 1"}) – bitte auf deren Lehrkraft-Seite auswerten.` };
    const tasks = KL.AUFGABEN.map((t, i) => {
      const bits = (payload.m || [])[i] || 0;
      const krit = t.kriterien.map((k, j) => ({ text: k.text, max: k.punkte, ok: !!(bits & (1 << j)) }));
      return { id: t.id, titel: t.titel, teil: t.teil, max: t.punkte, punkte: krit.reduce((s, k) => s + (k.ok ? k.max : 0), 0), krit, beruehrt: (payload.b || "")[i] === "1" };
    });
    const punkte = tasks.reduce((s, t) => s + t.punkte, 0);
    const max = tasks.reduce((s, t) => s + t.max, 0);
    const prozent = Math.round((punkte / max) * 1000) / 10;
    const teil = (id) => tasks.filter((t) => t.teil === id).reduce((s, t) => s + t.punkte, 0);
    return {
      quelle, code: code.code, gueltig: gueltig && punkte === payload.g,
      name: payload.n, klasse: payload.k, start: payload.s * 1000, ende: payload.e * 1000,
      abgabe: payload.a === "z" ? "Zeit abgelaufen" : "selbst", fokus: payload.f || [0, 0],
      tasks, punkte, max, prozent, note: U.note(prozent), teilA: teil("A"), teilB: teil("B"),
    };
  }

  function hinzufuegen(e) {
    if (e.code && eintraege.some((x) => x.code === e.code)) return;
    eintraege.push(e);
  }

  function render() {
    eintraege.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));
    csvBtn.disabled = !eintraege.some((e) => !e.fehler);
    if (!eintraege.length) { out.innerHTML = ""; return; }
    const namen = {};
    eintraege.forEach((e) => { if (e.name) namen[e.name] = (namen[e.name] || 0) + 1; });
    out.innerHTML = `<table class="lk-table"><thead><tr>
      <th>Name</th><th>Klasse</th><th>Punkte</th><th>%</th><th>Note</th><th>Teil A</th><th>Teil B</th>
      <th>Zeit</th><th>Abgabe</th><th>Fenster&shy;wechsel</th><th>Prüfcode</th><th>Quelle</th></tr></thead><tbody>
      ${eintraege.map((e, i) => e.fehler
        ? `<tr class="bad"><td colspan="11">${esc(e.fehler)}</td><td>${esc(e.quelle)}</td></tr>`
        : `<tr class="row ${e.gueltig ? "" : "bad"}" data-i="${i}">
          <td><b>${esc(e.name)}</b>${namen[e.name] > 1 ? ' <span class="lk-bad" title="Mehrere Berichte mit diesem Namen">⚠ doppelt</span>' : ""}</td>
          <td>${esc(e.klasse)}</td><td>${U.fmtPunkte(e.punkte)} / ${e.max}</td><td>${U.fmtPunkte(e.prozent)}</td><td><b>${e.note}</b></td>
          <td>${U.fmtPunkte(e.teilA)}</td><td>${U.fmtPunkte(e.teilB)}</td>
          <td>${U.fmtDatum(e.start)}<br>${U.fmtZeit(e.start)}–${U.fmtZeit(e.ende)} (${Math.round((e.ende - e.start) / 60000)} min)</td>
          <td>${esc(e.abgabe)}</td><td>${e.fokus[0] ? `${e.fokus[0]}× / ${e.fokus[1]} s` : "keine"}</td>
          <td>${e.gueltig ? '<span class="lk-ok">✓ gültig</span>' : '<span class="lk-bad">✗ UNGÜLTIG – verändert</span>'}</td>
          <td>${esc(e.quelle)}</td></tr>
          <tr class="lk-detail" data-d="${i}" hidden><td colspan="12"><div class="lk-crit">${e.tasks.map((t) => `
            <div><b>${t.id} ${esc(t.titel)}: ${U.fmtPunkte(t.punkte)}/${t.max}</b>${t.beruehrt ? "" : " <i>(nicht bearbeitet)</i>"}
            ${t.krit.map((k) => `<div>${k.ok ? "✓" : "✗"} ${esc(k.text)} (${k.ok ? k.max : 0}/${k.max})</div>`).join("")}</div>`).join("")}</div></td></tr>`).join("")}
      </tbody></table>
      <p class="lk-note">Zeile anklicken, um die Bewertung aller Kriterien zu sehen.</p>`;
    out.querySelectorAll("tr.row").forEach((tr) => tr.addEventListener("click", () => {
      const d = out.querySelector(`tr[data-d="${tr.dataset.i}"]`);
      d.hidden = !d.hidden;
    }));
  }

  // Liest den Prüfcode aus einer PDF-Datei: zuerst aus den (unkomprimierten)
  // Metadaten, sonst aus allen komprimierten Inhaltsströmen.
  async function ausPdf(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let latin = "";
    for (let i = 0; i < buf.length; i += 8192) latin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    let codes = U.findCodes(latin);
    if (!codes.length && typeof DecompressionStream !== "undefined") {
      const re = /stream\r?\n/g;
      let m, text = "";
      while ((m = re.exec(latin))) {
        const start = m.index + m[0].length;
        const end = latin.indexOf("endstream", start);
        if (end < 0) break;
        try {
          const ds = new Blob([buf.subarray(start, end)]).stream().pipeThrough(new DecompressionStream("deflate"));
          const raw = new Uint8Array(await new Response(ds).arrayBuffer());
          let s = "";
          for (let i = 0; i < raw.length; i += 8192) s += String.fromCharCode.apply(null, raw.subarray(i, i + 8192));
          text += (s.match(/\(([^)]*)\)\s*Tj/g) || []).map((x) => x.replace(/^\(|\)\s*Tj$/g, "")).join("");
        } catch (e) { /* kein Deflate-Strom */ }
      }
      codes = U.findCodes(text);
    }
    return codes;
  }

  async function dateien(files) {
    for (const f of files) {
      if (!/\.pdf$/i.test(f.name)) { hinzufuegen({ quelle: f.name, fehler: "Keine PDF-Datei" }); continue; }
      try {
        const codes = await ausPdf(f);
        if (!codes.length) hinzufuegen({ quelle: f.name, fehler: "Kein Prüfcode gefunden – Datei verändert oder kein Klausurbericht" });
        else codes.slice(0, 1).forEach((c) => hinzufuegen(auswerten(c, f.name)));
      } catch (e) { hinzufuegen({ quelle: f.name, fehler: "Datei konnte nicht gelesen werden" }); }
    }
    render();
  }

  const drop = document.querySelector(".lk-drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); dateien([...e.dataTransfer.files]); });
  drop.querySelector("input").addEventListener("change", (e) => { dateien([...e.target.files]); e.target.value = ""; });
  document.querySelector("[data-codes]").addEventListener("click", () => {
    const codes = U.findCodes(document.querySelector("textarea").value);
    if (!codes.length) hinzufuegen({ quelle: "eingefügt", fehler: "Kein Prüfcode erkannt" });
    codes.forEach((c) => hinzufuegen(auswerten(c, "eingefügt")));
    render();
  });
  document.querySelector("[data-clear]").addEventListener("click", () => { eintraege = []; render(); });

  csvBtn.addEventListener("click", () => {
    const head = ["Name", "Klasse", "Punkte", "Max", "Prozent", "Note", "Teil A", "Teil B", ...KL.AUFGABEN.map((t) => t.id), "Datum", "Beginn", "Abgabe", "Minuten", "Abgabeart", "Fensterwechsel", "Sekunden außerhalb", "Prüfcode"];
    const rows = eintraege.filter((e) => !e.fehler).map((e) => [
      e.name, e.klasse, U.fmtPunkte(e.punkte), e.max, U.fmtPunkte(e.prozent), e.note, U.fmtPunkte(e.teilA), U.fmtPunkte(e.teilB),
      ...e.tasks.map((t) => U.fmtPunkte(t.punkte)), U.fmtDatum(e.start), U.fmtZeit(e.start), U.fmtZeit(e.ende),
      Math.round((e.ende - e.start) / 60000), e.abgabe, e.fokus[0], e.fokus[1], e.gueltig ? "gültig" : "UNGÜLTIG",
    ]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Notenliste_${U.fmtDatum(Date.now()).replace(/\./g, "-")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
