/* =====================================================================
   PDF-BERICHT — Aufbau des Abgabe-Berichts
   ===================================================================== */
window.KL = window.KL || {};

KL.bericht = async function (S, erg, code) {
  "use strict";
  const C = KL.CONFIG;
  const U = KL.util;
  const doc = new KL.PDF.Doc();
  const L = 50, R = KL.PDF.PAGE_W - 50, W = R - L;
  const BOTTOM = KL.PDF.PAGE_H - 60;
  const PETROL = [0.12, 0.37, 0.4], GRAU = [0.38, 0.42, 0.45], GRUEN = [0.16, 0.46, 0.24], ROT = [0.62, 0.18, 0.14];
  let y = 56;

  const platz = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 56; } };
  const zeile = (text, opt = {}) => {
    const size = opt.size || 10;
    const lines = doc.wrap(text, opt.maxW || W - (opt.x || 0), opt.font || "R", size);
    lines.forEach((ln) => {
      platz(size * 1.45);
      doc.text(L + (opt.x || 0), y + size, ln, { font: opt.font || "R", size, color: opt.color || [0.1, 0.12, 0.14] });
      y += size * 1.45;
    });
  };
  const rechts = (text, yy, opt = {}) => {
    const size = opt.size || 10;
    doc.text(R - doc.width(text, opt.font || "R", size), yy, text, { font: opt.font || "R", size, color: opt.color || [0.1, 0.12, 0.14] });
  };

  // ---------- Kopf ----------
  doc.text(L, y, "KLAUSURBERICHT", { font: "B", size: 9, color: PETROL });
  y += 22;
  doc.text(L, y, C.TITEL, { font: "B", size: 17 });
  y += 18;
  doc.text(L, y, C.UNTERTITEL, { size: 11, color: GRAU });
  y += 14;
  doc.line(L, y, R, y, { width: 1.2, color: PETROL });
  y += 20;

  const dauerSek = (S.ende - S.start) / 1000;
  const info = [
    ["Name", S.name],
    ["Klasse / Kurs", S.klasse],
    ["Datum", U.fmtDatum(S.start)],
    ["Beginn – Abgabe", `${U.fmtZeit(S.start)} – ${U.fmtZeit(S.ende)} Uhr (${U.fmtDauer(dauerSek)})`],
    ["Abgabe", S.abgabeArt === "zeit" ? "automatisch nach Ablauf der Zeit" : "selbst abgegeben"],
    ["Fensterwechsel", S.fokus.anzahl === 0 ? "keine" : `${S.fokus.anzahl}× (insgesamt ${S.fokus.sekunden} s außerhalb der Klausur)`],
    ["Bearbeitet", `${erg.tasks.filter((t) => t.beruehrt).length} von ${erg.tasks.length} Aufgaben`],
  ];
  info.forEach(([k, v]) => {
    doc.text(L, y, k, { size: 10, color: GRAU });
    doc.text(L + 110, y, v, { size: 10, font: k === "Name" ? "B" : "R" });
    y += 15;
  });
  y += 8;

  // ---------- Ergebnis ----------
  if (C.ERGEBNIS_IM_BERICHT) {
    doc.rect(L, y, W, 54, { fill: [0.9, 0.94, 0.95] });
    doc.text(L + 14, y + 22, "Ergebnis", { font: "B", size: 10, color: PETROL });
    doc.text(L + 14, y + 42, `${U.fmtPunkte(erg.punkte)} von ${erg.max} Punkten  (${U.fmtPunkte(erg.prozent)} %)`, { font: "B", size: 15 });
    const noteTxt = `Note ${erg.note}`;
    doc.text(R - 14 - doc.width(noteTxt, "B", 20), y + 38, noteTxt, { font: "B", size: 20, color: PETROL });
    y += 66;
    KL.TEILE.forEach((teil) => {
      const ts = erg.tasks.filter((t) => t.task.teil === teil.id);
      const p = ts.reduce((s, t) => s + t.punkte, 0), m = ts.reduce((s, t) => s + t.max, 0);
      doc.text(L, y, teil.titel, { size: 10 });
      rechts(`${U.fmtPunkte(p)} / ${m} P.`, y, { font: "B" });
      y += 15;
    });
    y += 6;
    y -= 8;
    zeile("Notenschlüssel: " + C.NOTENSCHLUESSEL.map(([p, n]) => `${n} ab ${p} %`).join(" · "), { size: 7, color: GRAU });
    y += 10;
  }

  // ---------- Aufgaben ----------
  KL.TEILE.forEach((teil) => {
    platz(40);
    y += 6;
    doc.text(L, y, teil.titel, { font: "B", size: 13, color: PETROL });
    y += 8;
    doc.line(L, y, R, y, { width: 0.8, color: PETROL });
    y += 14;
    erg.tasks.filter((t) => t.task.teil === teil.id).forEach((t) => {
      platz(18 + (C.ERGEBNIS_IM_BERICHT ? 13 * Math.min(3, t.kriterien.length) : 0));
      doc.rect(L, y - 11, W, 16, { fill: [0.95, 0.96, 0.97] });
      doc.text(L + 6, y, `${t.task.id}  ${t.task.titel}`, { font: "B", size: 10 });
      if (C.ERGEBNIS_IM_BERICHT) rechts(`${U.fmtPunkte(t.punkte)} / ${t.max} P.  `, y, { font: "B" });
      else rechts(t.beruehrt ? "bearbeitet  " : "nicht bearbeitet  ", y, { color: GRAU });
      y += 16;
      if (C.ERGEBNIS_IM_BERICHT) {
        if (!t.beruehrt) { zeile("Aufgabe nicht bearbeitet.", { x: 14, size: 8.5, color: GRAU }); }
        t.kriterien.forEach((k) => {
          const lines = doc.wrap(k.text, W - 90, "R", 8.5);
          platz(lines.length * 12);
          doc.text(L + 8, y, k.ok ? "+" : "–", { font: "B", size: 9, color: k.ok ? GRUEN : ROT });
          lines.forEach((ln, i) => doc.text(L + 20, y + i * 12, ln, { size: 8.5, color: k.ok ? [0.1, 0.12, 0.14] : GRAU }));
          rechts(`${U.fmtPunkte(k.punkte)}/${k.max}  `, y, { size: 8.5, color: GRAU });
          y += lines.length * 12;
        });
        y += 6;
      }
    });
  });

  // ---------- Prüfcode ----------
  const codeZeilen = code.match(/.{1,84}/g);
  platz(70 + codeZeilen.length * 10);
  y += 10;
  doc.text(L, y, "Prüfcode für die Lehrkraft", { font: "B", size: 10, color: PETROL });
  y += 13;
  zeile("Dieser Code enthält das Ergebnis in codierter, signierter Form. Die Lehrkraft prüft ihn auf der Lehrkraft-Seite der Klausur. Nachträgliche Änderungen an diesem Bericht werden dadurch erkannt.", { size: 8, color: GRAU });
  y += 4;
  codeZeilen.forEach((z) => { doc.text(L, y + 7, z, { font: "M", size: 7.5 }); y += 10; });

  // ---------- Fußzeilen ----------
  const n = doc.pages.length;
  doc.pages.forEach((page, i) => {
    doc.cur = page;
    doc.line(L, KL.PDF.PAGE_H - 40, R, KL.PDF.PAGE_H - 40, { width: 0.5 });
    doc.text(L, KL.PDF.PAGE_H - 28, `${S.name} · ${S.klasse} · ${U.fmtDatum(S.start)}`, { size: 8, color: GRAU });
    const s = `Seite ${i + 1} von ${n}`;
    doc.text(R - doc.width(s, "R", 8), KL.PDF.PAGE_H - 28, s, { size: 8, color: GRAU });
  });

  doc.info = {
    Title: `Klausurbericht ${S.name}`,
    Author: S.name,
    Subject: C.TITEL,
    Keywords: code,
    CreationDate: "D:" + new Date(S.ende).toISOString().replace(/[-:T]/g, "").slice(0, 14),
  };
  return doc.output();
};
