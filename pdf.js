/* =====================================================================
   MINI-PDF-WRITER — erzeugt den Bericht direkt im Browser, ohne externe
   Bibliothek. Nutzt die drei PDF-Standardschriften (Helvetica,
   Helvetica-Bold, Courier) mit WinAnsi-Kodierung, damit Umlaute, ß und
   deutsche Anführungszeichen korrekt erscheinen. Inhalte werden — falls
   der Browser es kann — komprimiert, damit der Text nicht einfach in
   einem Texteditor geändert werden kann.
   ===================================================================== */
window.KL = window.KL || {};

KL.PDF = (() => {
  "use strict";

  const PAGE_W = 595.28, PAGE_H = 841.89;

  // Zeichenbreiten (1/1000 em) für Zeichen 32–126
  const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  // Unicode → WinAnsi (nur Zeichen außerhalb von Latin-1 nötig)
  const WIN = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "›": 0x9b, "‹": 0x8b };
  const BASE = { "ä": "a", "ö": "o", "ü": "u", "Ä": "A", "Ö": "O", "Ü": "U", "é": "e", "è": "e", "á": "a", "à": "a", "ó": "o", "ñ": "n", "ç": "c", "É": "E" };

  function charWidth(ch, font) {
    if (font === "M") return 600;
    const bold = font === "B";
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) return (bold ? W_BOLD : W_REG)[code - 32];
    if (BASE[ch]) return charWidth(BASE[ch], font);
    if (ch === "ß") return 611;
    if ("„“”‚‘’".includes(ch)) return bold ? 500 : 333;
    if (ch === "–") return 556;
    if (ch === "—" || ch === "…") return 1000;
    if (ch === "•") return 350;
    if (ch === "€") return 556;
    if (ch === "°") return 400;
    if (ch === "×") return 584;
    return 556;
  }

  function textWidth(str, font, size) {
    let w = 0;
    for (const ch of str) w += charWidth(ch, font);
    return (w * size) / 1000;
  }

  // Wandelt einen JS-String in einen PDF-Literal-String (WinAnsi-Bytes als
  // Latin-1-Zeichen)
  function pdfString(str) {
    let out = "";
    for (const ch of str) {
      let code = ch.charCodeAt(0);
      if (WIN[ch]) code = WIN[ch];
      else if (code > 255) code = 63; // "?"
      if (code === 40 || code === 41 || code === 92) out += "\\" + String.fromCharCode(code);
      else if (code < 32) out += " ";
      else out += String.fromCharCode(code);
    }
    return "(" + out + ")";
  }

  function num(n) { return (Math.round(n * 100) / 100).toString(); }

  class Doc {
    constructor() {
      this.pages = [];
      this.info = {};
      this.addPage();
    }
    addPage() {
      this.cur = [];
      this.pages.push(this.cur);
    }
    // Koordinaten: x/y in pt, y von OBEN gemessen
    text(x, y, str, { font = "R", size = 10, color = [0, 0, 0] } = {}) {
      const f = font === "B" ? "F2" : font === "M" ? "F3" : "F1";
      this.cur.push(`BT ${color.map(num).join(" ")} rg /${f} ${size} Tf 1 0 0 1 ${num(x)} ${num(PAGE_H - y)} Tm ${pdfString(str)} Tj ET`);
    }
    line(x1, y1, x2, y2, { width = 0.6, color = [0.75, 0.78, 0.8] } = {}) {
      this.cur.push(`${color.map(num).join(" ")} RG ${width} w ${num(x1)} ${num(PAGE_H - y1)} m ${num(x2)} ${num(PAGE_H - y2)} l S`);
    }
    rect(x, y, w, h, { fill = [0.95, 0.96, 0.97] } = {}) {
      this.cur.push(`${fill.map(num).join(" ")} rg ${num(x)} ${num(PAGE_H - y - h)} ${num(w)} ${num(h)} re f`);
    }
    width(str, font = "R", size = 10) { return textWidth(str, font, size); }

    // Bricht Text in Zeilen um, die maxW nicht überschreiten
    wrap(str, maxW, font = "R", size = 10) {
      const words = String(str).split(/\s+/);
      const lines = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (textWidth(test, font, size) <= maxW || !line) line = test;
        else { lines.push(line); line = w; }
      }
      if (line) lines.push(line);
      return lines;
    }

    async output() {
      const enc = (s) => {
        const b = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
        return b;
      };
      const chunks = [];
      let offset = 0;
      const offsets = [];
      const push = (bytes) => { chunks.push(bytes); offset += bytes.length; };
      push(enc("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"));

      const objects = []; // Funktionen, die Bytes liefern
      const nPages = this.pages.length;
      // Objektnummern: 1 Katalog, 2 Seitenbaum, 3–5 Schriften, 6 Info,
      // danach je Seite: Seite + Inhalt
      const firstPage = 7;
      const pageIds = [], contentIds = [];
      for (let i = 0; i < nPages; i++) { pageIds.push(firstPage + i * 2); contentIds.push(firstPage + i * 2 + 1); }

      objects[1] = enc(`<< /Type /Catalog /Pages 2 0 R >>`);
      objects[2] = enc(`<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${nPages} >>`);
      objects[3] = enc(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
      objects[4] = enc(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
      objects[5] = enc(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`);
      const infoParts = Object.entries(this.info).map(([k, v]) => `/${k} ${pdfString(v)}`);
      objects[6] = enc(`<< ${infoParts.join(" ")} /Producer (Klausur Windows & Word) >>`);

      for (let i = 0; i < nPages; i++) {
        objects[pageIds[i]] = enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);
        const raw = enc(this.pages[i].join("\n"));
        let data = raw, filter = "";
        if (typeof CompressionStream !== "undefined") {
          try {
            const cs = new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"));
            data = new Uint8Array(await new Response(cs).arrayBuffer());
            filter = " /Filter /FlateDecode";
          } catch (e) { data = raw; filter = ""; }
        }
        const head = enc(`<< /Length ${data.length}${filter} >>\nstream\n`);
        const tail = enc(`\nendstream`);
        const merged = new Uint8Array(head.length + data.length + tail.length);
        merged.set(head, 0); merged.set(data, head.length); merged.set(tail, head.length + data.length);
        objects[contentIds[i]] = merged;
      }

      const count = objects.length - 1;
      for (let id = 1; id <= count; id++) {
        offsets[id] = offset;
        push(enc(`${id} 0 obj\n`));
        push(objects[id]);
        push(enc(`\nendobj\n`));
      }
      const xrefStart = offset;
      let xref = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
      for (let id = 1; id <= count; id++) xref += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
      push(enc(xref));
      push(enc(`trailer\n<< /Size ${count + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));
      return new Blob(chunks, { type: "application/pdf" });
    }
  }

  return { Doc, PAGE_W, PAGE_H, textWidth };
})();
