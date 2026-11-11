/* =====================================================================
   SIMULATION: WISSENSFRAGEN (Einfachauswahl). Die gewählte Antwort ist
   sichtbar und kann bis zur Abgabe geändert werden. Antwortreihenfolge
   wird pro Person zufällig gemischt.
   ===================================================================== */
window.KL = window.KL || {};
KL.sims = KL.sims || {};

KL.sims.quiz = (() => {
  "use strict";
  const { esc, shuffle } = KL.util;

  // def: { fragen: [{id, text, visual?, optionen:[{id,text}], richtig}] }
  function init(def, rand) {
    const reihenfolge = {};
    def.fragen.forEach((f) => (reihenfolge[f.id] = shuffle(f.optionen.map((o) => o.id), rand)));
    return { reihenfolge, antworten: {} };
  }

  function mount(host, S, ctx) {
    const fragen = ctx.task.sim.def.fragen;
    host.innerHTML = `<div class="qz">${fragen.map((f, i) => `
      <fieldset class="qz-q" data-q="${f.id}">
        <legend><span class="qz-nr">${i + 1}</span> ${f.text}</legend>
        ${f.visual ? `<div class="qz-visual">${f.visual}</div>` : ""}
        <div class="qz-opts">${S.reihenfolge[f.id].map((oid) => {
          const o = f.optionen.find((x) => x.id === oid);
          return `<label class="qz-opt"><input type="radio" name="qz-${esc(ctx.task.id)}-${f.id}" value="${oid}" ${S.antworten[f.id] === oid ? "checked" : ""}/><span>${esc(o.text)}</span></label>`;
        }).join("")}</div>
      </fieldset>`).join("")}</div>`;
    host.querySelector(".qz").addEventListener("change", (e) => {
      const inp = e.target.closest("input[type=radio]");
      if (!inp) return;
      const q = inp.closest(".qz-q").dataset.q;
      S.antworten[q] = inp.value;
      ctx.save();
    });
    return function destroy() {};
  }

  return { init, mount };
})();
