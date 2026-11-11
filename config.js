/* =====================================================================
   KONFIGURATION — alles, was die Lehrkraft anpassen kann, steht hier.
   ===================================================================== */
window.KL = window.KL || {};

KL.CONFIG = {
  // Titel auf Startseite, Kopfzeile und im PDF-Bericht
  TITEL: "Klausur 2: Digitale Grundkompetenzen",

  // Kennung dieser Klausur im Prüfcode (Lehrkraft-Seite und Übungsbaukasten erkennen sie daran)
  KENNUNG: "K2",
  UNTERTITEL: "Windows und Word-Textbearbeitung – Aufbaustufe",

  // Bearbeitungszeit in Minuten. Nach Ablauf wird automatisch abgegeben.
  DAUER_MINUTEN: 120,

  // Notenschlüssel: [Mindestprozent, Note], von oben nach unten geprüft.
  // 50 % = 4,0 (Vorgabe). Alles darunter: 5,0, unter 20 %: 6,0.
  NOTENSCHLUESSEL: [
    [95, "1,0"], [90, "1,3"], [85, "1,7"], [80, "2,0"], [75, "2,3"],
    [70, "2,7"], [65, "3,0"], [60, "3,3"], [55, "3,7"], [50, "4,0"],
    [20, "5,0"], [0, "6,0"],
  ],

  // true: Punkte, Kriterien und Note stehen lesbar im PDF-Bericht.
  // false: Der Bericht enthält nur die Liste der bearbeiteten Aufgaben und
  //        den Prüfcode — die Punkte sieht dann nur die Lehrkraft auf
  //        lehrkraft.html.
  ERGEBNIS_IM_BERICHT: true,

  // Hinweis auf dem Abgabebildschirm
  ABGABE_HINWEIS:
    "Speichere den PDF-Bericht und sende ihn als Anhang per E-Mail an deine Lehrkraft. Ändere die Datei nicht.",

  // Geheimer Schlüssel für den Prüfcode. VOR JEDER KLAUSUR ÄNDERN
  // (beliebige Zeichenfolge). lehrkraft.html nutzt denselben Wert.
  GEHEIMNIS: "Klausur2-Monheim-2026-bitte-aendern",

  // Speicherschlüssel im Browser — bei einer neuen Klausur ändern, damit
  // alte Stände nicht weiterverwendet werden.
  SPEICHER_SCHLUESSEL: "klausur2-windows-word-v1",
};
