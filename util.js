/* =====================================================================
   HILFSFUNKTIONEN — Zufall, Text, Hash, Kodierung, Prüfcode
   ===================================================================== */
window.KL = window.KL || {};

KL.util = (() => {
  "use strict";

  // Reproduzierbarer Zufallsgenerator (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Textvergleich: tolerant gegenüber geschützten Leerzeichen, doppelten
  // Leerzeichen und Leerzeichen am Rand (entstehen leicht beim Einfügen).
  function norm(t) {
    return String(t == null ? "" : t)
      .replace(/ /g, " ")
      .replace(/​/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n+/g, "\n")
      .trim();
  }

  // Für Antwortfelder: Groß/Klein und Leerzeichen egal
  function simple(t) {
    return norm(t).toLowerCase().replace(/\s+/g, " ");
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function fmtDatum(ms) {
    const d = new Date(ms);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  function fmtZeit(ms) {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDauer(sek) {
    sek = Math.max(0, Math.round(sek));
    const m = Math.floor(sek / 60), s = sek % 60;
    return `${m} min ${pad(s)} s`;
  }
  function fmtPunkte(p) {
    return (Math.round(p * 10) / 10).toString().replace(".", ",");
  }

  function note(prozent) {
    for (const [min, n] of KL.CONFIG.NOTENSCHLUESSEL) if (prozent >= min) return n;
    return "6,0";
  }

  // ---------------- SHA-256 (kompakt, ohne externe Bibliothek) -------
  function sha256(str) {
    const bytes = new TextEncoder().encode(str);
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = bytes.length;
    const withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    withPad.set(bytes);
    withPad[l] = 0x80;
    const bitLen = l * 8;
    const dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 4, bitLen >>> 0);
    dv.setUint32(withPad.length - 8, Math.floor(bitLen / 4294967296));
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < withPad.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map((x) => x.toString(16).padStart(8, "0")).join("");
  }

  // ---------------- Base64url (UTF-8) --------------------------------
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---------------- Prüfcode -----------------------------------------
  // Format: K1.<Base64url(JSON)>.<12 Hex-Zeichen Signatur>
  // Die Signatur ist ein SHA-256 über Geheimnis + Nutzdaten. Wer Punkte im
  // PDF ändert, ändert nicht den Code; wer den Code ändert, zerstört die
  // Signatur.
  function makeCode(payload) {
    const body = b64urlEncode(JSON.stringify(payload));
    const sig = sha256(KL.CONFIG.GEHEIMNIS + "|" + body).slice(0, 12);
    return `K1.${body}.${sig}`;
  }
  function findCodes(text) {
    const flat = String(text).replace(/\s+/g, "");
    const out = [];
    const re = /K1\.([A-Za-z0-9_-]+)\.([0-9a-f]{12})/g;
    let m;
    while ((m = re.exec(flat))) out.push({ code: m[0], body: m[1], sig: m[2] });
    return out;
  }
  function readCode(found) {
    const expected = sha256(KL.CONFIG.GEHEIMNIS + "|" + found.body).slice(0, 12);
    let payload = null;
    try { payload = JSON.parse(b64urlDecode(found.body)); } catch (e) { payload = null; }
    return { payload, gueltig: !!payload && expected === found.sig };
  }

  return {
    rng, shuffle, esc, norm, simple, pad, fmtDatum, fmtZeit, fmtDauer, fmtPunkte, note,
    sha256, b64urlEncode, b64urlDecode, makeCode, findCodes, readCode,
  };
})();
