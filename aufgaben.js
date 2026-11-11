/* =====================================================================
   KLAUSUR 2 (Aufbaustufe) — Teil A (Windows, 50 P.) und Teil B (Word, 50 P.)
   Jede Aufgabe: id, teil, titel, auftrag[], sim {typ, def}, felder[]
   (optionale Antwortfelder), kriterien[] mit Punkten.
   Ein Kriterium hat entweder pruefe(simZustand, antworten) → true/false
   oder live(kontext) → true/false (wird während der Bearbeitung geprüft
   und gespeichert, sobald es einmal erfüllt war — z. B. Markierungen).
   ===================================================================== */
window.KL = window.KL || {};

(() => {
  "use strict";
  const { norm, simple } = KL.util;
  const fs = KL.fs;
  const D = fs.datei, Z = fs.zip;

  // Vergleich, der Leerzeichen-Kleinigkeiten verzeiht (doppelt, vor
  // Satzzeichen, am Rand)
  const glatt = (t) => norm(t).replace(/\s+/g, " ").replace(/ +([.,!?:;])/g, "$1").trim();
  const gleich = (a, b) => glatt(a) === glatt(b);
  const ohneLeer = (t) => norm(t).replace(/\s+/g, "");
  const text = (st) => glatt(st.absaetze.join("\n"));
  const zeilen = (st) => st.absaetze.map(glatt).filter(Boolean);
  const hatZeile = (st, z) => zeilen(st).some((x) => x === glatt(z));
  const offen = (st, app) => st.fenster[app] && st.fenster[app].offen;

  // Sucht im Teilbaum unter "pfad" nach einem Element mit diesem Namen
  function unter(state, pfad, name) {
    const start = fs.findPath(state, pfad);
    if (!start) return false;
    const walk = (id) => {
      const n = state.nodes[id];
      if (!n) return false;
      if (n.name === name && n.id !== start.id) return true;
      return (n.kinder || []).some(walk);
    };
    return walk(start.id);
  }
  const istOrdner = (state, pfad) => { const n = fs.findPath(state, pfad); return !!n && n.typ === "ordner"; };

  const A = [];
  const B = [];

  // ---------- zusätzliche Helfer für Klausur 2 ----------
  const pfadNorm = (t) => String(t || "").trim().toLowerCase()
    .replace(/\s*[›>\\/]\s*/g, "/").replace(/^dieser pc\//, "").replace(/\/+$/, "");
  const kinder = (s, pfad) => { const n = fs.findPath(s, pfad); return n && n.kinder ? n.kinder.map((id) => s.nodes[id]) : []; };
  const datumGleich = (antwort, soll) => {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(String(antwort || "").trim());
    const z = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(soll);
    return !!m && !!z && +m[1] === +z[1] && +m[2] === +z[2] && (m[3].length === 2 ? "20" + m[3] : m[3]) === z[3];
  };
  // Verlauf: gibt es nacheinander Textstände, die bed1, dann bed2, … erfüllen?
  function folge(st, ...bed) {
    const v = st.verlauf.map(glatt);
    let i = -1;
    for (const b of bed) { i = v.findIndex((t, k) => k > i && b(t)); if (i < 0) return false; }
    return true;
  }

  /* ================================================================
     TEIL A — WINDOWS
     ================================================================ */

  A.push({
    id: "A1", teil: "A", titel: "Fenster aufräumen",
    auftrag: [
      "Öffne die <b>Einstellungen</b> über das Startmenü.",
      "Schließe <b>Microsoft Edge</b>, den <b>Editor</b>, den <b>Rechner</b>, den <b>Datei-Explorer</b> und <b>Paint</b>. Tipp: Paint ist minimiert – hole es zuerst über die Taskleiste zurück.",
      "Hole <b>Word</b> über die Taskleiste zurück und <b>maximiere</b> es.",
      "Minimiere zum Schluss die <b>Einstellungen</b>. Sie sollen geöffnet bleiben.",
      "Trage das <b>Datum</b> aus der Taskleiste (unten rechts) ein.",
    ],
    sim: { typ: "fenster", def: { uhr: "13:52", fenster: [
      { app: "edge", zustand: "max", x: 20, y: 10 },
      { app: "editor", zustand: "normal", x: 60, y: 30 },
      { app: "paint", zustand: "min", x: 120, y: 50 },
      { app: "rechner", zustand: "normal", x: 380, y: 70 },
      { app: "word", zustand: "min", x: 90, y: 40 },
      { app: "explorer", zustand: "normal", x: 200, y: 90 },
    ] } },
    felder: [{ id: "datum", label: "Datum laut Taskleiste:", platzhalter: "TT.MM.JJJJ" }],
    kriterien: [
      { text: "Einstellungen über das Startmenü geöffnet", punkte: 1, pruefe: (s) => offen(s, "einstellungen") && s.startGeoeffnet.includes("einstellungen") },
      { text: "Edge, Editor und Paint geschlossen", punkte: 1, pruefe: (s) => ["edge", "editor", "paint"].every((a) => !offen(s, a)) },
      { text: "Rechner und Datei-Explorer geschlossen", punkte: 1, pruefe: (s) => ["rechner", "explorer"].every((a) => !offen(s, a)) },
      { text: "Word sichtbar und maximiert", punkte: 1, pruefe: (s) => offen(s, "word") && !s.fenster.word.min && s.fenster.word.max },
      { text: "Einstellungen minimiert (noch geöffnet)", punkte: 1, pruefe: (s) => offen(s, "einstellungen") && s.fenster.einstellungen.min },
      { text: "Datum richtig abgelesen", punkte: 1, pruefe: (s, a) => datumGleich(a.datum, s.datum) },
    ],
  });

  A.push({
    id: "A2", teil: "A", titel: "Dateien finden und Pfade lesen",
    auftrag: [
      "Es gibt zwei Dateien „Protokoll_Elternabend.docx“: eine in <b>Dokumente › Schule › Klasse_9b › Elternabend</b> und eine in <b>Dokumente › Archiv › 2025</b>. Öffne nur die <b>neuere</b> (achte auf das Änderungsdatum).",
      "In welchem Ordner liegt die Datei „Kassenbuch_2026.xlsx“? Tipp: Sie liegt im Ordner „Verein“ oder in einem seiner Unterordner. Gib den Pfad ab „Dokumente“ an, z. B. <i>Dokumente › Ordner › Unterordner</i>.",
      "Der Explorer soll am Ende genau diesen Ordner anzeigen.",
    ],
    sim: { typ: "explorer", def: {
      start: "",
      dokumente: {
        Schule: { Klasse_9b: { Elternabend: { "Protokoll_Elternabend.docx": D(34, "14.10.2026 20:15"), "Einladung_Elternabend.pdf": null } }, Klassenfahrt: { "Packliste.docx": null } },
        Archiv: { "2025": { "Protokoll_Elternabend.docx": D(31, "18.11.2025 21:02"), "Kassenbuch_2025.xlsx": null } },
        Verein: { Finanzen: { "Kassenbuch_2026.xlsx": null, "Belege_Oktober.pdf": null }, Mitglieder: { "Mitgliederliste.xlsx": null } },
        "Kassenbuch_Vorlage.xlsx": null,
      },
      downloads: { "Kassenbuch_2026_alt.xlsx": null },
    } },
    felder: [{ id: "pfad", label: "Pfad des Ordners von „Kassenbuch_2026.xlsx“:", platzhalter: "Dokumente › …" }],
    kriterien: [
      { text: "Neuere Datei Protokoll_Elternabend.docx (Schule › Klasse_9b › Elternabend) geöffnet, die ältere nicht", punkte: 2, pruefe: (s) => s.geoeffnet.includes("Dokumente/Schule/Klasse_9b/Elternabend/Protokoll_Elternabend.docx") && !s.geoeffnet.includes("Dokumente/Archiv/2025/Protokoll_Elternabend.docx") },
      { text: "Pfad richtig angegeben (Dokumente › Verein › Finanzen)", punkte: 2, pruefe: (s, a) => pfadNorm(a.pfad) === "dokumente/verein/finanzen" },
      { text: "Explorer zeigt am Ende Dokumente › Verein › Finanzen", punkte: 1, pruefe: (s) => { const n = fs.findPath(s, "Dokumente/Verein/Finanzen"); return !!n && s.cwd === n.id; } },
    ],
  });

  A.push({
    id: "A3", teil: "A", titel: "Ordnerstruktur anlegen",
    auftrag: [
      "Erstelle in „Dokumente“ den Ordner <b>Bewerbungen</b>.",
      "Öffne „Bewerbungen“ und erstelle darin die zwei Ordner <b>2026</b> und <b>Unterlagen</b>.",
      "Benenne in „Dokumente“ den Ordner „Neuer Ordner (2)“ in <b>Zeugnisse</b> um. Verschiebe „Zeugnisse“ danach in den Ordner <b>Bewerbungen › Unterlagen</b>.",
      "Lösche den leeren Ordner <b>Temp</b>.",
      "Stelle <b>Lebenslauf_2025.docx</b> aus dem Papierkorb wieder her (sie landet in „Dokumente“) und verschiebe sie danach ebenfalls in <b>Bewerbungen › Unterlagen</b>.",
    ],
    sim: { typ: "explorer", def: {
      start: "Dokumente",
      dokumente: {
        "Neuer Ordner (2)": { "Zeugnis_Klasse9.pdf": null, "Praktikumsbescheinigung.pdf": null },
        Temp: {},
        Privat: { "Urlaub_Planung.docx": null },
        Briefe: { "Kündigung_Fitnessstudio.docx": null },
        "Anschreiben_Vorlage.docx": null,
      },
      papierkorb: {
        "Lebenslauf_2025.docx": { von: "Dokumente", inhalt: null },
        "Alte_Notizen.txt": { von: "Desktop", inhalt: null },
      },
    } },
    kriterien: [
      { text: "Ordner Bewerbungen in Dokumente", punkte: 1, pruefe: (s) => istOrdner(s, "Dokumente/Bewerbungen") },
      { text: "Unterordner Bewerbungen › 2026", punkte: 1, pruefe: (s) => istOrdner(s, "Dokumente/Bewerbungen/2026") },
      { text: "Unterordner Bewerbungen › Unterlagen", punkte: 1, pruefe: (s) => istOrdner(s, "Dokumente/Bewerbungen/Unterlagen") },
      { text: "Ordner Zeugnisse (mit Inhalt) liegt in Unterlagen", punkte: 1, pruefe: (s) => fs.existiert(s, "Dokumente/Bewerbungen/Unterlagen/Zeugnisse/Zeugnis_Klasse9.pdf") },
      { text: "„Neuer Ordner (2)“ gibt es nicht mehr", punkte: 1, pruefe: (s) => !unter(s, "Dokumente", "Neuer Ordner (2)") },
      { text: "Leerer Ordner Temp gelöscht", punkte: 1, pruefe: (s) => !fs.existiert(s, "Dokumente/Temp") },
      { text: "Lebenslauf_2025.docx wiederhergestellt und in Unterlagen", punkte: 1, pruefe: (s) => fs.existiert(s, "Dokumente/Bewerbungen/Unterlagen/Lebenslauf_2025.docx") },
    ],
  });

  const JPGS = ["IMG_20261003_1422.jpg", "IMG_20261003_1430.jpg", "Screenshot_Busplan.jpg", "Profilbild.jpg"];
  const RECHNUNGEN = ["Rechnung_Strom_Oktober.pdf", "Rechnung_Handy_Oktober.pdf"];
  A.push({
    id: "A4", teil: "A", titel: "Downloads aufräumen",
    auftrag: [
      "Verschiebe die vier Bilder <b>IMG_20261003_1422.jpg</b>, <b>IMG_20261003_1430.jpg</b>, <b>Screenshot_Busplan.jpg</b> und <b>Profilbild.jpg</b> in den Ordner <b>Bilder › Handy</b>.",
      "Kopiere die zwei Rechnungen <b>Rechnung_Strom_Oktober.pdf</b> und <b>Rechnung_Handy_Oktober.pdf</b> auf den USB-Stick in den Ordner <b>Steuer</b>. Die Originale bleiben in „Downloads“.",
      "Lösche das Installationsprogramm <b>Setup_PDFReader.exe</b>.",
      "Benenne „scan0001.pdf“ in <b>Mietvertrag_Scan.pdf</b> um.",
      "Verschiebe <b>Fotos_Geburtstag.zip</b> auf den <b>Desktop</b>.",
      "Leere zum Schluss den <b>Papierkorb</b>.",
    ],
    sim: { typ: "explorer", def: {
      start: "Downloads",
      downloads: {
        ...Object.fromEntries(JPGS.map((n) => [n, null])),
        "Rechnung_Strom_Oktober.pdf": null, "Rechnung_Handy_Oktober.pdf": null, "Rechnungsadresse.txt": null, "Angebot_Küche.pdf": null,
        "scan0001.pdf": null, "Bewerbung_Entwurf.docx": null, "Rezept_Linsensuppe.docx": null,
        "Setup_PDFReader.exe": null, "Fotos_Geburtstag.zip": Z(["Torte.jpg", "Gäste.jpg"]), "Sprachnachricht.mp3": null,
      },
      bilder: { Handy: { "IMG_20260815_0910.jpg": null }, Urlaub: {} },
      desktop: { "Notizen.txt": null },
      usb: { Steuer: { "Lohnsteuer_2025.pdf": null }, Fotos: {} },
      papierkorb: { "Werbung_Möbelhaus.pdf": { von: "Downloads", inhalt: null }, "Alt.txt": { von: "Desktop", inhalt: null } },
    } },
    kriterien: [
      { text: "Alle vier JPG-Bilder in Bilder › Handy", punkte: 1, pruefe: (s) => JPGS.every((n) => fs.existiert(s, `Bilder/Handy/${n}`)) },
      { text: "Keine JPG-Datei mehr in Downloads", punkte: 1, pruefe: (s) => !kinder(s, "Downloads").some((n) => /\.jpg$/i.test(n.name)) },
      { text: "Beide Rechnungen in USB › Steuer", punkte: 1, pruefe: (s) => RECHNUNGEN.every((n) => fs.existiert(s, `USB/Steuer/${n}`)) },
      { text: "Rechnungen kopiert, nicht verschoben (Originale noch in Downloads)", punkte: 1, pruefe: (s) => RECHNUNGEN.every((n) => fs.existiert(s, `USB/Steuer/${n}`) && fs.existiert(s, `Downloads/${n}`)) },
      { text: "Installationsprogramm gelöscht", punkte: 1, pruefe: (s) => !unter(s, "Downloads", "Setup_PDFReader.exe") && !unter(s, "Desktop", "Setup_PDFReader.exe") },
      { text: "scan0001.pdf in Mietvertrag_Scan.pdf umbenannt", punkte: 1, pruefe: (s) => fs.existiert(s, "Downloads/Mietvertrag_Scan.pdf") && !fs.existiert(s, "Downloads/scan0001.pdf") },
      { text: "ZIP-Datei auf den Desktop verschoben", punkte: 1, pruefe: (s) => fs.existiert(s, "Desktop/Fotos_Geburtstag.zip") && !fs.existiert(s, "Downloads/Fotos_Geburtstag.zip") },
      { text: "Papierkorb am Ende leer", punkte: 1, pruefe: (s) => s.nodes.papierkorb.kinder.length === 0 },
    ],
  });

  A.push({
    id: "A5", teil: "A", titel: "Suchen, sortieren, auswerten",
    auftrag: [
      "Öffne den Ordner <b>Dokumente › Fotos_Archiv</b>. Wie viele Dateien darin wurden im <b>September 2026</b> geändert? Tipp: Sortiere nach Änderungsdatum, dann stehen sie zusammen.",
      "Welche ist die größte <b>PDF-Datei</b> in diesem Ordner? Tipp: Sortiere nach Größe und achte auf die Spalte „Typ“.",
      "Sortiere „Fotos_Archiv“ zum Schluss nach <b>Typ</b>.",
      "Suche im Ordner „Dokumente“ mit dem Suchfeld oben rechts nach <b>Garantie_Waschmaschine.pdf</b> und öffne die Datei (nicht die Kopie).",
      "Trage ein, in welchem Ordner sie liegt (Spalte „Ordner“ in den Suchergebnissen) und wann sie zuletzt geändert wurde.",
    ],
    sim: { typ: "explorer", def: {
      start: "Dokumente",
      dokumente: {
        Fotos_Archiv: {
          "Grillfest_01.jpg": D(2800, "05.09.2026 18:22"), "Grillfest_02.jpg": D(3100, "05.09.2026 18:25"),
          "Einladung_Grillfest.pdf": D(420, "28.08.2026 10:02"), "Rechnung_Catering.pdf": D(1980, "12.09.2026 09:15"),
          "Teilnehmerliste.xlsx": D(25, "03.09.2026 16:40"), "Video_Grillfest.mp4": D(61200, "06.09.2026 11:10"),
          "Dankesbrief.docx": D(31, "02.10.2026 08:30"), "Flyer_Herbstfest.pdf": D(1450, "14.10.2026 12:00"),
          "Herbstfest_01.jpg": D(3300, "18.10.2026 15:05"), "Plakat_Entwurf.pdf": D(1720, "30.08.2026 21:45"),
          "Musik_Playlist.mp3": D(5400, "21.08.2026 19:30"), "Spendenliste.xlsx": D(18, "29.09.2026 17:55"),
          "Sitzplan.docx": D(40, "01.10.2026 09:12"), "Herbstfest_02.jpg": D(3150, "18.10.2026 15:09"),
        },
        Haushalt: {
          Geräte: { Garantien: { "Garantie_Waschmaschine.pdf": D(612, "23.05.2026 18:44"), "Garantie_Fernseher.pdf": D(540, "02.02.2026 10:10") }, "Bedienungsanleitung_Herd.pdf": null },
          "Garantie_Waschmaschine_Kopie.pdf": D(612, "01.06.2026 08:00"),
          Versicherungen: { "Hausrat.pdf": null },
        },
        "Einkaufsliste.docx": null,
      },
    } },
    felder: [
      { id: "anzahl", label: "Anzahl Dateien aus September 2026:", platzhalter: "Zahl" },
      { id: "pdf", label: "Größte PDF-Datei in Fotos_Archiv:", platzhalter: "Dateiname" },
      { id: "ordner", label: "Ordner von Garantie_Waschmaschine.pdf:", platzhalter: "Ordnername" },
      { id: "datum", label: "Änderungsdatum dieser Datei:", platzhalter: "TT.MM.JJJJ" },
    ],
    kriterien: [
      { text: "Anzahl der September-Dateien richtig (6)", punkte: 1, pruefe: (s, a) => /^(6|sechs)$/i.test((a.anzahl || "").trim()) },
      { text: "Größte PDF-Datei richtig (Rechnung_Catering.pdf)", punkte: 1, pruefe: (s, a) => /^rechnung_catering(\.pdf)?$/i.test((a.pdf || "").trim()) },
      { text: "Fotos_Archiv nach Typ sortiert", punkte: 1, pruefe: (s) => s.sort.key === "typ" },
      { text: "Garantie_Waschmaschine.pdf (Original) geöffnet", punkte: 1, pruefe: (s) => s.geoeffnet.includes("Dokumente/Haushalt/Geräte/Garantien/Garantie_Waschmaschine.pdf") },
      { text: "Ordner richtig angegeben (Garantien)", punkte: 1, pruefe: (s, a) => /(^|\/)garantien$/.test(pfadNorm(a.ordner)) },
      { text: "Änderungsdatum richtig (23.05.2026)", punkte: 1, pruefe: (s, a) => datumGleich(a.datum, "23.05.2026") },
    ],
  });

  const REFERAT = ["Folie1.pptx", "Handout.pdf", "Quellen.docx"];
  A.push({
    id: "A6", teil: "A", titel: "ZIP-Dateien und USB-Stick",
    auftrag: [
      "Markiere im Ordner „Referat“ die drei Dateien <b>Folie1.pptx</b>, <b>Handout.pdf</b> und <b>Quellen.docx</b> (mit gedrückter Strg-Taste) und packe sie zusammen in eine ZIP-Datei. Gib ihr den Namen <b>Referat_Abgabe</b>. „Notizen_privat.txt“ gehört nicht hinein.",
      "Kopiere „Referat_Abgabe.zip“ auf den <b>USB-Stick (E:)</b>.",
      "Entpacke <b>Vorlagen.zip</b> im Ordner „Downloads“. Verschiebe den entpackten Ordner <b>Vorlagen</b> danach nach „Dokumente“.",
      "Wirf den USB-Stick zum Schluss sicher aus.",
    ],
    sim: { typ: "explorer", def: {
      start: "Dokumente/Referat",
      dokumente: { Referat: { "Folie1.pptx": null, "Handout.pdf": null, "Quellen.docx": null, "Notizen_privat.txt": null }, "Stundenplan.pdf": null },
      downloads: { "Vorlagen.zip": Z(["Brief_Vorlage.docx", "Rechnung_Vorlage.xlsx", "Briefkopf.png"], 840, "09.11.2026 17:20"), "Fahrplan.pdf": null },
      usb: { Schule: { "Hausaufgabe.docx": null } },
    } },
    kriterien: [
      { text: "Eine ZIP-Datei mit genau den drei Referat-Dateien", punkte: 1, pruefe: (s) => kinder(s, "Dokumente/Referat").some((n) => n.typ === "zip" && n.zipInhalt.length === 3 && REFERAT.every((f) => n.zipInhalt.includes(f))) },
      { text: "ZIP-Datei heißt Referat_Abgabe.zip", punkte: 1, pruefe: (s) => { const n = fs.findPath(s, "Dokumente/Referat/Referat_Abgabe.zip"); return !!n && n.typ === "zip"; } },
      { text: "Referat_Abgabe.zip auf dem USB-Stick", punkte: 1, pruefe: (s) => unter(s, "USB", "Referat_Abgabe.zip") },
      { text: "Entpackter Ordner Vorlagen liegt in Dokumente", punkte: 1, pruefe: (s) => fs.existiert(s, "Dokumente/Vorlagen/Briefkopf.png") && !kinder(s, "Downloads").some((n) => n.typ === "ordner") },
      { text: "USB-Stick sicher ausgeworfen", punkte: 1, pruefe: (s) => s.usbAusgeworfen === true },
    ],
  });

  const alle = (s) => s.alle || (s.gespeichert ? [s.gespeichert] : []);
  A.push({
    id: "A7", teil: "A", titel: "Speichern unter – mit neuem Ordner",
    auftrag: [
      "Speichere das Dokument als <b>PDF</b> unter dem Namen <b>Bewerbung_Lagerist</b> im Ordner <b>Dokumente › Bewerbungen › 2026</b>. Den Ordner „2026“ gibt es noch nicht – lege ihn im Speichern-Dialog mit dem Knopf <b>Neuer Ordner</b> an.",
      "Speichere zusätzlich eine Kopie als <b>Word-Dokument (*.docx)</b> unter dem Namen <b>Bewerbung_Lagerist_Entwurf</b> im Ordner <b>Dokumente › Archiv</b>.",
    ],
    sim: { typ: "speichern", def: {
      dokName: "Dokument1",
      text: ["Bewerbung als Lagerist", "Sehr geehrte Damen und Herren,", "hiermit bewerbe ich mich bei Ihrer Spedition …"],
      fs: { dokumente: { Bewerbungen: { "Anschreiben_Spedition.docx": null }, Archiv: { "Alte_Bewerbung.docx": null }, Privat: {} }, desktop: {}, downloads: {} },
    } },
    kriterien: [
      { text: "Ordner Dokumente › Bewerbungen › 2026 angelegt", punkte: 1, pruefe: (s) => { const n = KL.fs.findPath(s.fs, "Dokumente/Bewerbungen/2026"); return !!n && n.typ === "ordner"; } },
      { text: "PDF im Ordner Bewerbungen › 2026 gespeichert", punkte: 1, pruefe: (s) => alle(s).some((r) => r.ordner === "Dokumente/Bewerbungen/2026" && /\*\.pdf/i.test(r.typ)) },
      { text: "PDF heißt Bewerbung_Lagerist", punkte: 1, pruefe: (s) => alle(s).some((r) => /\*\.pdf/i.test(r.typ) && r.name.replace(/\.pdf$/i, "").trim() === "Bewerbung_Lagerist") },
      { text: "Word-Kopie Bewerbung_Lagerist_Entwurf (*.docx) in Archiv", punkte: 1, pruefe: (s) => alle(s).some((r) => r.ordner === "Dokumente/Archiv" && /\*\.docx/i.test(r.typ) && r.name.replace(/\.docx$/i, "").trim() === "Bewerbung_Lagerist_Entwurf") },
    ],
  });

  A.push({
    id: "A8", teil: "A", titel: "Herunterladen und die richtige Version hochladen",
    auftrag: [
      "Lade die beiden Dateien <b>Arbeitsblatt_Kündigung.pdf</b> und <b>Musterbrief_Kündigung.docx</b> herunter.",
      "Lade bei „Abgabe“ die <b>neueste Version</b> deiner Präsentation hoch. Sie liegt im Ordner Dokumente › Kurs › Präsentation – achte im Dialog auf die Spalte „Änderungsdatum“.",
    ],
    sim: { typ: "browser", def: {
      url: "lernplattform.schule-beispiel.de/kurs/alltag-recht",
      kurs: "Alltag & Recht – Kurs 9b", aufgabeTitel: "Präsentation Mobilität",
      material: [
        { name: "Arbeitsblatt_Kündigung.pdf", groesse: "210 KB" },
        { name: "Checkliste_Umzug.pdf", groesse: "160 KB" },
        { name: "Musterbrief_Kündigung.docx", groesse: "45 KB" },
        { name: "Mietvertrag_Beispiel.pdf", groesse: "380 KB" },
      ],
      fs: {
        dokumente: {
          Kurs: { Präsentation: {
            "Präsentation_Mobilität.pdf": D(1800, "02.11.2026 19:10"),
            "Präsentation_Mobilität (1).pdf": D(1850, "06.11.2026 21:40"),
            "Präsentation_Mobilität_alt.pdf": D(1500, "20.10.2026 16:05"),
          }, "Notizen.docx": null },
          "Präsentation_Mobilität.pdf": D(1200, "15.10.2026 11:00"),
        },
        downloads: {},
      },
    } },
    kriterien: [
      { text: "Beide Kündigungs-Dateien heruntergeladen", punkte: 1, pruefe: (s) => ["Arbeitsblatt_Kündigung.pdf", "Musterbrief_Kündigung.docx"].every((n) => s.downloads.includes(n)) },
      { text: "Neueste Version (Präsentation_Mobilität (1).pdf, 06.11.2026) hochgeladen", punkte: 2, pruefe: (s) => !!s.hochgeladen && s.hochgeladen.pfad === "Dokumente/Kurs/Präsentation/Präsentation_Mobilität (1).pdf" },
    ],
  });

  const QUIZ = [
    { id: "q1", text: "Ein USB-Stick hat 16 GB freien Speicher. Passt ein Film mit 4 GB darauf?", richtig: "a", optionen: [
      { id: "a", text: "Ja, sogar mehrmals" }, { id: "b", text: "Nein, 4 GB sind mehr als 16 GB" }, { id: "c", text: "Nur, wenn man den Film umbenennt" }, { id: "d", text: "Nein, Filme passen nie auf USB-Sticks" }] },
    { id: "q2", text: "Du bekommst eine E-Mail von <code>service@sparkase-online.de</code> mit der Bitte, dein Konto zu bestätigen. Was fällt auf?", richtig: "a", optionen: [
      { id: "a", text: "Die Adresse ist falsch geschrieben – vermutlich ein Betrugsversuch" }, { id: "b", text: "Nichts, Banken schreiben oft solche Mails" },
      { id: "c", text: "Die Mail ist sicher, weil „service“ in der Adresse steht" }, { id: "d", text: "Die Mail ist sicher, weil sie auf Deutsch ist" }] },
    { id: "q3", text: "Warum ist ein Anhang mit dem Namen „Rechnung.pdf.exe“ gefährlich?", richtig: "a", optionen: [
      { id: "a", text: "Es ist ein Programm, das sich als PDF tarnt" }, { id: "b", text: "Die Datei ist zu groß" },
      { id: "c", text: "PDF-Dateien sind immer gefährlich" }, { id: "d", text: "Die Datei ist nicht gefährlich" }] },
    { id: "q4", text: "Welche Sicherung schützt deine Fotos am besten auch bei einem Wohnungsbrand?", richtig: "a", optionen: [
      { id: "a", text: "Eine zusätzliche Kopie an einem anderen Ort, z. B. in der Cloud oder bei Verwandten" }, { id: "b", text: "Eine zweite Kopie im gleichen Ordner" },
      { id: "c", text: "Die Fotos in eine ZIP-Datei packen" }, { id: "d", text: "Den Papierkorb nie leeren" }] },
    { id: "q5", text: "Mit welcher Tastenkombination wechselst du schnell zwischen geöffneten Fenstern?", richtig: "a", optionen: [
      { id: "a", text: "Alt + Tab" }, { id: "b", text: "Strg + Z" }, { id: "c", text: "Strg + A" }, { id: "d", text: "Umschalt + Ende" }] },
    { id: "q6", text: "Pfad: <code>C:\\Benutzer\\Ali\\Dokumente\\Kurs\\Woche3\\Aufgabe.docx</code> — Welcher Ordner ist der <b>übergeordnete</b> Ordner von „Woche3“?", richtig: "a", optionen: [
      { id: "a", text: "Kurs" }, { id: "b", text: "Aufgabe.docx" }, { id: "c", text: "Dokumente" }, { id: "d", text: "C:" }] },
  ];
  A.push({
    id: "A9", teil: "A", titel: "Wissensfragen",
    auftrag: ["Wähle bei jeder Frage die <b>eine</b> richtige Antwort aus."],
    sim: { typ: "quiz", def: { fragen: QUIZ } },
    kriterien: QUIZ.map((q, i) => ({ text: `Frage ${i + 1}: ${q.text.replace(/<[^>]+>/g, "")}`, punkte: 1, pruefe: (s) => s.antworten[q.id] === q.richtig })),
  });

  /* ================================================================
     TEIL B — WORD-TEXTBEARBEITUNG
     ================================================================ */

  const B1_TEXT = [
    "Protokoll der Teamsitzung vom 4. November",
    "Anwesend waren alle Kolleginnen und Kollegen der Frühschicht.",
    "Die neue Kaffeemaschine wird ab nächster Woche aufgestellt.",
    "Urlaubsanträge für Dezember bitte bis Freitag abgeben.",
    "Die nächste Sitzung findet am 2. Dezember statt.",
  ];
  B.push({
    id: "B1", teil: "B", titel: "Markieren mit Maus und Tastatur",
    auftrag: [
      "Markiere mit einem <b>Doppelklick</b> das Wort „Kaffeemaschine“.",
      "Markiere mit einem <b>Dreifachklick</b> den vierten Absatz.",
      "Setze den Cursor vor „ab nächster“. Markiere mit <b>Strg + Umschalt + Pfeil rechts</b> genau „ab nächster Woche“.",
      "Klicke ans Ende des zweiten Absatzes (hinter „Frühschicht.“). Markiere mit <b>Umschalt + Pos1</b> den ganzen zweiten Absatz. (Pos1 heißt auf manchen Tastaturen „Home“.)",
      "Klicke vor „Urlaubsanträge“. Markiere mit <b>Umschalt + Ende</b> die ganze Zeile.",
      "Markiere mit <b>Strg + A</b> den gesamten Text.",
    ],
    hinweis: "Den Cursor darfst du mit der Maus setzen. Der Text muss nicht verändert werden.",
    sim: { typ: "word", def: { dokName: "Protokoll Teamsitzung", absaetze: B1_TEXT } },
    kriterien: [
      { text: "„Kaffeemaschine“ mit der Maus markiert", punkte: 1, live: (c) => c.methode === "maus" && glatt(c.markiert) === "Kaffeemaschine" },
      { text: "Vierten Absatz mit der Maus markiert", punkte: 1, live: (c) => c.methode === "maus" && glatt(c.markiert) === glatt(B1_TEXT[3]) },
      { text: "„ab nächster Woche“ mit der Tastatur markiert", punkte: 1, live: (c) => c.methode === "tastatur" && glatt(c.markiert) === "ab nächster Woche" },
      { text: "Zweiten Absatz mit der Tastatur markiert", punkte: 1, live: (c) => c.methode === "tastatur" && glatt(c.markiert) === glatt(B1_TEXT[1]) },
      { text: "Zeile „Urlaubsanträge …“ mit Umschalt + Ende markiert", punkte: 1, live: (c) => c.methode === "tastatur" && glatt(c.markiert) === glatt(B1_TEXT[3]) },
      { text: "Gesamten Text mit der Tastatur markiert", punkte: 1, live: (c) => c.methode === "tastatur" && glatt(c.markiert) === glatt(c.text) && c.text.length > 40 },
    ],
  });

  B.push({
    id: "B2", teil: "B", titel: "Springen und ergänzen",
    auftrag: [
      "Springe mit <b>Strg + Pos1</b> an den Anfang des Dokuments (Pos1 heißt auf manchen Tastaturen „Home“). Schreibe <b>Betreff: Inventur</b> und drücke Enter. So entsteht eine neue erste Zeile.",
      "Springe mit <b>Strg + Ende</b> ans Ende des Dokuments und ergänze: <b>Die Liste hängt am Schwarzen Brett.</b> (mit einem Leerzeichen davor)",
      "Ergänze am Ende des Absatzes „am Montag …“ den Satz: <b>Sie dauert zwei Tage.</b> (mit einem Leerzeichen davor)",
    ],
    sim: { typ: "word", def: { dokName: "Rundmail Inventur", absaetze: ["Liebe Kolleginnen und Kollegen,", "am Montag beginnt die Inventur im Lager.", "Bitte tragt euch in die Liste ein."] } },
    kriterien: [
      { text: "Strg + Pos1 verwendet", punkte: 1, pruefe: (s) => s.tasten.includes("strg+home") },
      { text: "Neue erste Zeile „Betreff: Inventur“", punkte: 1, pruefe: (s) => { const z = zeilen(s); return z[0] === "Betreff: Inventur" && z[1] === "Liebe Kolleginnen und Kollegen,"; } },
      { text: "Strg + Ende verwendet", punkte: 1, pruefe: (s) => s.tasten.includes("strg+end") },
      { text: "Satz am Dokumentende ergänzt", punkte: 1, pruefe: (s) => hatZeile(s, "Bitte tragt euch in die Liste ein. Die Liste hängt am Schwarzen Brett.") },
      { text: "Satz im zweiten Absatz ergänzt", punkte: 1, pruefe: (s) => hatZeile(s, "am Montag beginnt die Inventur im Lager. Sie dauert zwei Tage.") },
    ],
  });

  const B3_ZIEL = [
    "Sehr geehrte Frau Demir,",
    "vielen Dank für die schnelle Rückmeldung zu unserer Wohnung.",
    "Wir können die Besichtigung gerne am Mittwoch um 17 Uhr machen.",
    "Bitte bringen Sie die Unterlagen für den Mietvertrag mit.",
    "Falls der Termin nicht passt, rufen Sie mich einfach an.",
    "Wir freuen uns auf das Kennenlernen und wünschen ein schönes Wochenende.",
    "Mit freundlichen Grüßen",
    "Lena Hoffmann",
  ].join("\n");
  B.push({
    id: "B3", teil: "B", titel: "Fehler korrigieren",
    auftrag: [
      "Korrigiere die vier falsch geschriebenen Wörter: <b>Wohnnung</b>, <b>Besichtigumg</b>, <b>Termiin</b> und <b>Wochende</b>.",
      "Im vierten Absatz steht ein Wort doppelt. Lösche es einmal.",
      "Der Brief geht nicht an Herrn Schulz, sondern an Frau Demir. Ändere die Anrede in <b>Sehr geehrte Frau Demir,</b>",
      "Alles andere soll unverändert bleiben.",
    ],
    sim: { typ: "word", def: { dokName: "Antwort Wohnungsbesichtigung", absaetze: [
      "Sehr geehrter Herr Schulz,",
      "vielen Dank für die schnelle Rückmeldung zu unserer Wohnnung.",
      "Wir können die Besichtigumg gerne am Mittwoch um 17 Uhr machen.",
      "Bitte bringen Sie die Unterlagen für den Mietvertrag mit mit.",
      "Falls der Termiin nicht passt, rufen Sie mich einfach an.",
      "Wir freuen uns auf das Kennenlernen und wünschen ein schönes Wochende.",
      "Mit freundlichen Grüßen",
      "Lena Hoffmann",
    ] } },
    kriterien: [
      { text: "Tippfehler „Wohnnung“ korrigiert", punkte: 1, pruefe: (s) => /unserer Wohnung\./.test(text(s)) },
      { text: "Tippfehler „Besichtigumg“ korrigiert", punkte: 1, pruefe: (s) => /die Besichtigung gerne/.test(text(s)) },
      { text: "Tippfehler „Termiin“ korrigiert", punkte: 1, pruefe: (s) => /der Termin nicht/.test(text(s)) },
      { text: "Tippfehler „Wochende“ korrigiert", punkte: 1, pruefe: (s) => /schönes Wochenende\./.test(text(s)) },
      { text: "Doppeltes „mit“ gelöscht", punkte: 1, pruefe: (s) => /Mietvertrag mit\./.test(text(s)) },
      { text: "Anrede „Sehr geehrte Frau Demir,“", punkte: 1, pruefe: (s) => hatZeile(s, "Sehr geehrte Frau Demir,") },
      { text: "Endfassung vollständig korrekt, nichts anderes verändert", punkte: 2, pruefe: (s) => gleich(s.absaetze.join("\n"), B3_ZIEL) },
    ],
  });

  const B4_START = ["Einkaufsliste für das Sommerfest", "Getränke: Wasser, Saft und Limonade", "Grillgut: Würstchen und Gemüse", "Nachtisch: Obstsalat", "Sonstiges: Servietten, Becher"];
  B.push({
    id: "B4", teil: "B", titel: "Rückgängig und Wiederholen",
    auftrag: [
      "Markiere den dritten Absatz („Grillgut: …“) mit einem Dreifachklick und lösche ihn.",
      "Mache das Löschen mit <b>Rückgängig</b> wieder rückgängig.",
      "Lösche stattdessen den Absatz „Nachtisch: Obstsalat“.",
      "Schreibe an das Ende des letzten Absatzes <b> und Teller</b>. Mache das mit <b>Strg + Z</b> rückgängig und stelle es mit <b>Strg + Y</b> wieder her.",
    ],
    sim: { typ: "word", def: { dokName: "Einkaufsliste", absaetze: B4_START } },
    kriterien: [
      { text: "Dritter Absatz war gelöscht", punkte: 1, pruefe: (s) => folge(s, (t) => !/Grillgut/.test(t) && /Nachtisch/.test(t)) },
      { text: "Löschen mit Rückgängig wiederhergestellt", punkte: 1, pruefe: (s) => s.zaehler.rueckgaengig > 0 && folge(s, (t) => !/Grillgut/.test(t) && /Nachtisch/.test(t), (t) => /Grillgut: Würstchen und Gemüse/.test(t)) },
      { text: "Wiederholen (Strg + Y) benutzt", punkte: 1, pruefe: (s) => s.zaehler.wiederholen > 0 },
      { text: "Endtext korrekt (Grillgut da, Nachtisch weg, „… Becher und Teller“)", punkte: 1, pruefe: (s) => gleich(s.absaetze.join("\n"), ["Einkaufsliste für das Sommerfest", "Getränke: Wasser, Saft und Limonade", "Grillgut: Würstchen und Gemüse", "Sonstiges: Servietten, Becher und Teller"].join("\n")) },
    ],
  });

  const B5_ZIEL = [
    "Anleitung: Drucker einrichten",
    "Schalte zuerst den Drucker ein.",
    "Verbinde danach das USB-Kabel mit dem Computer.",
    "Windows installiert dann automatisch den Treiber.",
    "Lege vorher Papier in das Fach ein. Drucke zum Schluss eine Testseite.",
  ];
  B.push({
    id: "B5", teil: "B", titel: "Sätze umstellen",
    auftrag: [
      "Verschiebe mit <b>Ausschneiden und Einfügen</b> das Wort „zuerst“ direkt hinter „Schalte“.",
      "Verschiebe ebenso das Wort „dann“ direkt hinter „installiert“.",
      "Verschiebe im letzten Absatz den Satz „Drucke zum Schluss eine Testseite.“ an das Ende des Absatzes.",
      `So soll es am Ende aussehen:<br>${B5_ZIEL[1]}<br>${B5_ZIEL[3]}<br>${B5_ZIEL[4]}`,
    ],
    sim: { typ: "word", def: { dokName: "Anleitung Drucker", absaetze: [
      "Anleitung: Drucker einrichten",
      "Schalte den Drucker zuerst ein.",
      "Verbinde danach das USB-Kabel mit dem Computer.",
      "Windows installiert automatisch dann den Treiber.",
      "Drucke zum Schluss eine Testseite. Lege vorher Papier in das Fach ein.",
    ] } },
    kriterien: [
      { text: "„Schalte zuerst den Drucker ein.“", punkte: 1, pruefe: (s) => hatZeile(s, B5_ZIEL[1]) },
      { text: "„Windows installiert dann automatisch den Treiber.“", punkte: 1, pruefe: (s) => hatZeile(s, B5_ZIEL[3]) },
      { text: "Reihenfolge der zwei Sätze im letzten Absatz getauscht", punkte: 1, pruefe: (s) => hatZeile(s, B5_ZIEL[4]) },
      { text: "Ausschneiden verwendet (mind. 3×)", punkte: 1, pruefe: (s) => s.zaehler.ausschneiden >= 3 },
      { text: "Einfügen verwendet (mind. 3×)", punkte: 1, pruefe: (s) => s.zaehler.einfuegen >= 3 },
      { text: "Endfassung vollständig korrekt", punkte: 1, pruefe: (s) => gleich(s.absaetze.join("\n"), B5_ZIEL.join("\n")) },
    ],
  });

  const KONTAKT = "Frau Yıldız, Telefon 02173 44 55 66";
  const NOTFALL = "0800 112 112 0";
  B.push({
    id: "B6", teil: "B", titel: "Kopieren und Einfügen",
    auftrag: [
      `Kopiere <b>${KONTAKT}</b> aus der ersten Zeile und füge es hinter den Doppelpunkt der Zeilen 2, 3 und 4 ein (jeweils mit einem Leerzeichen).`,
      `Kopiere dann die Notfallnummer <b>${NOTFALL}</b> aus der letzten Zeile und füge sie am Ende der vierten Zeile ein – mit <b> oder </b> davor.`,
      "Die erste und die letzte Zeile bleiben unverändert.",
    ],
    sim: { typ: "word", def: { dokName: "Kontaktliste", absaetze: [
      `Ansprechpartnerin: ${KONTAKT}`,
      "Fragen zur Rechnung – Kontakt:",
      "Fragen zum Vertrag – Kontakt:",
      "Störungen – Kontakt:",
      `Notfall außerhalb der Bürozeiten: ${NOTFALL}`,
    ] } },
    kriterien: [
      { text: "Zeile 2 ergänzt", punkte: 1, pruefe: (s) => s.absaetze.some((z) => ohneLeer(z) === ohneLeer(`Fragen zur Rechnung – Kontakt: ${KONTAKT}`)) },
      { text: "Zeile 3 ergänzt", punkte: 1, pruefe: (s) => s.absaetze.some((z) => ohneLeer(z) === ohneLeer(`Fragen zum Vertrag – Kontakt: ${KONTAKT}`)) },
      { text: "Zeile 4 mit Kontakt und Notfallnummer ergänzt", punkte: 1, pruefe: (s) => s.absaetze.some((z) => ohneLeer(z) === ohneLeer(`Störungen – Kontakt: ${KONTAKT} oder ${NOTFALL}`)) },
      { text: "Erste und letzte Zeile unverändert", punkte: 1, pruefe: (s) => hatZeile(s, `Ansprechpartnerin: ${KONTAKT}`) && hatZeile(s, `Notfall außerhalb der Bürozeiten: ${NOTFALL}`) },
      { text: "Kopieren (mind. 2×) und Einfügen (mind. 4×) verwendet", punkte: 1, pruefe: (s) => s.zaehler.kopieren >= 2 && s.zaehler.einfuegen >= 4 },
    ],
  });

  const B7_ZIEL = [
    "Bewerbung um einen Ausbildungsplatz als Fachkraft für Lagerlogistik",
    "Sehr geehrte Damen und Herren,",
    "mit großem Interesse habe ich Ihre Anzeige vom 7. Oktober gelesen.",
    "Zurzeit besuche ich das Weiterbildungskolleg und mache dort im Sommer meinen Abschluss.",
    "In einem Praktikum habe ich bereits erste Erfahrungen im Lager gesammelt. Dabei habe ich mit Scannern und Lagerprogrammen gearbeitet.",
    "Über eine Einladung zu einem Vorstellungsgespräch freue ich mich sehr.",
    "Mit freundlichen Grüßen",
    "Alex Beispiel",
  ].join("\n");
  B.push({
    id: "B7", teil: "B", titel: "Praxisaufgabe: Bewerbung überarbeiten",
    auftrag: [
      "Ändere das Datum der Anzeige von „3. Oktober“ in <b>7. Oktober</b>.",
      "Verschiebe „im Sommer“ so, dass der Satz lautet: <b>… und mache dort im Sommer meinen Abschluss.</b>",
      "Lösche den Satz „Ich arbeite gerne körperlich und im Team.“ – der ganze Absatz soll verschwinden.",
      "Ergänze am Ende des Absatzes „In einem Praktikum …“ den Satz: <b>Dabei habe ich mit Scannern und Lagerprogrammen gearbeitet.</b>",
      "Ergänze im Absatz „Über eine Einladung …“ vor dem Punkt das Wort <b>sehr</b>.",
      "Füge unter „Mit freundlichen Grüßen“ eine neue Zeile mit dem Namen <b>Alex Beispiel</b> ein.",
    ],
    sim: { typ: "word", def: { dokName: "Bewerbung Lagerlogistik", absaetze: [
      "Bewerbung um einen Ausbildungsplatz als Fachkraft für Lagerlogistik",
      "Sehr geehrte Damen und Herren,",
      "mit großem Interesse habe ich Ihre Anzeige vom 3. Oktober gelesen.",
      "Zurzeit besuche ich das Weiterbildungskolleg und mache dort meinen Abschluss im Sommer.",
      "In einem Praktikum habe ich bereits erste Erfahrungen im Lager gesammelt.",
      "Ich arbeite gerne körperlich und im Team.",
      "Über eine Einladung zu einem Vorstellungsgespräch freue ich mich.",
      "Mit freundlichen Grüßen",
    ] } },
    kriterien: [
      { text: "Datum 7. Oktober", punkte: 1, pruefe: (s) => /Anzeige vom 7\. Oktober gelesen/.test(text(s)) },
      { text: "„im Sommer“ richtig verschoben", punkte: 1, pruefe: (s) => /mache dort im Sommer meinen Abschluss\./.test(text(s)) },
      { text: "Satz „Ich arbeite gerne …“ samt Absatz gelöscht", punkte: 1, pruefe: (s) => !/körperlich/.test(text(s)) && !s.absaetze.some((a, i) => i > 0 && i < s.absaetze.length - 1 && !glatt(a)) },
      { text: "Satz über Scanner ergänzt", punkte: 1, pruefe: (s) => /gesammelt\. Dabei habe ich mit Scannern und Lagerprogrammen gearbeitet\./.test(text(s)) },
      { text: "„sehr“ ergänzt", punkte: 1, pruefe: (s) => /freue ich mich sehr\./.test(text(s)) },
      { text: "Neue Zeile „Alex Beispiel“ am Ende", punkte: 1, pruefe: (s) => { const z = zeilen(s); return z[z.length - 1] === "Alex Beispiel"; } },
      { text: "Endfassung vollständig korrekt", punkte: 2, pruefe: (s) => gleich(s.absaetze.join("\n"), B7_ZIEL) },
    ],
  });

  const B8_ZIEL = [
    "Protokoll Elternabend Klasse 9b vom 12. November 2026",
    "Datum: 12. November 2026",
    "Die Klassenfahrt geht im Mai nach Hamburg.",
    "Die Kosten betragen etwa 280 Euro pro Person.",
    "Der Elternbeirat wird im Januar neu gewählt.",
    "Protokoll: Herr Kaya",
  ].join("\n");
  B.push({
    id: "B8", teil: "B", titel: "Praxisaufgabe: Protokoll überarbeiten",
    auftrag: [
      "Teile den Absatz „Die Klassenfahrt …“ in <b>zwei Absätze</b>: Klicke hinter den ersten Satz („… nach Hamburg.“) und drücke Enter.",
      "Füge „Der Elternbeirat“ und „wird im Januar neu gewählt.“ zu <b>einem</b> Absatz zusammen: Klicke vor „wird“, drücke die Rücktaste und setze ein Leerzeichen.",
      "Kopiere „12. November 2026“ und füge es am Ende der Überschrift mit <b> vom </b> davor ein: <b>Protokoll Elternabend Klasse 9b vom 12. November 2026</b>",
      "Korrigiere die zwei Tippfehler <b>Hambrug</b> (richtig: Hamburg) und <b>Persson</b> (richtig: Person).",
    ],
    sim: { typ: "word", def: { dokName: "Protokoll Elternabend", absaetze: [
      "Protokoll Elternabend Klasse 9b",
      "Datum: 12. November 2026",
      "Die Klassenfahrt geht im Mai nach Hambrug. Die Kosten betragen etwa 280 Euro pro Persson.",
      "Der Elternbeirat",
      "wird im Januar neu gewählt.",
      "Protokoll: Herr Kaya",
    ] } },
    kriterien: [
      { text: "Absatz nach dem ersten Satz geteilt", punkte: 1, pruefe: (s) => zeilen(s).some((z) => /^Die Klassenfahrt geht im Mai nach \w+\.$/.test(z)) && zeilen(s).some((z) => /^Die Kosten betragen/.test(z)) },
      { text: "„Der Elternbeirat wird im Januar neu gewählt.“ ist ein Absatz", punkte: 1, pruefe: (s) => hatZeile(s, "Der Elternbeirat wird im Januar neu gewählt.") },
      { text: "Überschrift mit Datum ergänzt", punkte: 1, pruefe: (s) => hatZeile(s, "Protokoll Elternabend Klasse 9b vom 12. November 2026") },
      { text: "Kopieren und Einfügen verwendet", punkte: 1, pruefe: (s) => s.zaehler.kopieren >= 1 && s.zaehler.einfuegen >= 1 },
      { text: "Tippfehler „Hambrug“ korrigiert", punkte: 1, pruefe: (s) => /nach Hamburg\./.test(text(s)) },
      { text: "Tippfehler „Persson“ korrigiert", punkte: 1, pruefe: (s) => /pro Person\./.test(text(s)) },
      { text: "Endfassung vollständig korrekt", punkte: 2, pruefe: (s) => gleich(s.absaetze.join("\n"), B8_ZIEL) },
    ],
  });

  // Punkte je Aufgabe aus den Kriterien ableiten
  [...A, ...B].forEach((t) => (t.punkte = t.kriterien.reduce((s, k) => s + k.punkte, 0)));

  KL.AUFGABEN = [...A, ...B];
  KL.TEILE = [
    { id: "A", titel: "Teil A · Windows" },
    { id: "B", titel: "Teil B · Word-Textbearbeitung" },
  ];

  // Bewertung einer Aufgabe aus ihrem gespeicherten Zustand
  // Nie bearbeitete Aufgaben ergeben 0 Punkte (auch Kriterien wie „Zeile
  // bleibt unverändert“ zählen nur, wenn die Aufgabe bearbeitet wurde).
  KL.bewerte = function (task, zustand) {
    const sim = zustand && zustand.beruehrt ? zustand.sim : null;
    const antw = (zustand && zustand.antworten) || {};
    const kriterien = task.kriterien.map((k, i) => {
      let ok = false;
      if (sim) {
        try { ok = k.live ? !!(sim.erreicht && sim.erreicht[i]) : !!k.pruefe(sim, antw); } catch (e) { ok = false; }
      }
      return { text: k.text, max: k.punkte, punkte: ok ? k.punkte : 0, ok };
    });
    return { punkte: kriterien.reduce((s, k) => s + k.punkte, 0), max: task.punkte, kriterien };
  };
})();
