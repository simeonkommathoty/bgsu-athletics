// Extracted from the authoritative reference; see source line annotations.
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {
const document=context.document;
const window=context.window;
const Chart=context.Chart;
const XLSX=context.XLSX;
const setTimeout=context.setTimeout;
const clearTimeout=context.clearTimeout;
const requestAnimationFrame=context.requestAnimationFrame;
/* ─── Chart registry ─── */
// Reference: originals/hockey.html:1381
const CH={};


// Reference: originals/hockey.html:1382
function kc(id){if(CH[id]){CH[id].destroy();delete CH[id];}}

return Object.defineProperties({}, {
  CH: {enumerable:true, configurable:true, get:()=>CH},
  kc: {enumerable:true, configurable:true, get:()=>kc}
});
}
