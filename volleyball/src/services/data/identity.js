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
// ── Data Source Log ─────────────────────────────────────────────
// Reference: originals/volleyball.html:3241
function logSource(athlete, fname, keys){
  if(!athlete._sources) athlete._sources=[];
  const dateStr=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});
  athlete._sources=athlete._sources.filter(s=>s.file!==fname);
  athlete._sources.push({file:fname, date:dateStr, keys:[...keys]});
  return athlete;
}


// Reference: originals/volleyball.html:3248
function sourceForKey(athlete, key){
  if(!athlete._sources) return null;
  for(let i=athlete._sources.length-1;i>=0;i--){
    if(athlete._sources[i].keys.includes(key)) return athlete._sources[i];
  }
  return null;
}


// Reference: originals/volleyball.html:3307
function mergeAthleteRecords(existing, incoming, presentKeys, fname){
  const merged={...existing};
  const actuallyAppliedKeys=[];
  for(const key of presentKeys){
    if(incoming[key]===undefined||incoming[key]===null) continue;
    if(key==='approachJump'){
      // Approach jump leaderboards/rankings should reflect an athlete's
      // all-time PR, not whichever test happened to be imported most
      // recently — a lower or average test result should never erase a
      // real best. Only take the incoming value if it's actually higher.
      if(merged.approachJump!=null && incoming.approachJump<=merged.approachJump) continue;
      merged.approachJumpDate=incoming.approachJumpDate||merged.approachJumpDate||null;
    }
    merged[key]=incoming[key];
    actuallyAppliedKeys.push(key);
  }
  if(incoming._hasPos) merged.pos=incoming.pos;
  // Never overwrite a locked canonical name
  if(!merged._nameLocked){
    merged._canonicalName=merged._canonicalName||merged.name;
  }
  merged.acwr=context.api.calcACWR(merged);
  merged.composite=context.api.calcCompositeVB(merged);
  merged.tier=context.api.calcTier(merged.composite);
  merged.trend=[...(existing.trend||context.api.TEST_BLOCKS.map(()=>merged.composite))];
  merged.trend[merged.trend.length-1]=merged.composite;
  if(actuallyAppliedKeys.length) logSource(merged, fname, actuallyAppliedKeys);
  return merged;
}

// ── Name normalization for matching ─────────────────────────────
// Reference: originals/volleyball.html:3338
function normName(n){
  return (n||'').toLowerCase().trim()
    .replace(/[''`]/g,'')        // strip apostrophes (O'Brien → obrien)
    .replace(/[^a-z\s\-]/g,'')  // strip other punctuation except hyphens
    .replace(/\s+/g,' ')
    .trim();
}


// Reference: originals/volleyball.html:3346
function firstName(n){const p=normName(n).split(' ');return p[0]||'';}


// Reference: originals/volleyball.html:3347
function lastName(n){const p=normName(n).split(' ');return p[p.length-1]||'';}

// Comprehensive similarity — handles full name, last-name-only, first initial + last, hyphenated
// Reference: originals/volleyball.html:3350
function nameSimilarity(incoming, canonical){
  const a=normName(incoming), b=normName(canonical);
  if(!a||!b) return 0;
  if(a===b) return 1.0;

  const aParts=a.split(' '), bParts=b.split(' ');
  const aFirst=aParts[0], aLast=aParts[aParts.length-1];
  const bFirst=bParts[0], bLast=bParts[bParts.length-1];

  // Last name only (single token incoming, matches canonical last name)
  if(aParts.length===1 && aLast===bLast && bLast.length>2) return 0.88;

  // First initial + last  (e.g. "S. Miller" → "Sarah Miller")
  if(aParts.length===2 && aFirst.length===1 && aFirst===bFirst[0] && aLast===bLast) return 0.95;

  // Full last name matches, first names start same letter
  if(aLast===bLast && aLast.length>2 && aFirst[0]===bFirst[0]) return 0.92;

  // Full last name matches, first name differs (transfer / data entry inconsistency)
  if(aLast===bLast && aLast.length>3) return 0.82;

  // One name is contained in the other (e.g. "Sarah" matching "Sarah Miller")
  if(b.includes(a)||a.includes(b)) return 0.87;

  // Hyphenated last name — try both parts  (e.g. "Smith" matching "Jones-Smith")
  if(bLast.includes('-')){
    const parts=bLast.split('-');
    if(parts.includes(aLast)&&aLast.length>2) return 0.84;
  }

  return 0;
}

// Find best matching locked-in athlete for an incoming name string.
// Nickname / alias → canonical first name mapping
// Add entries here whenever an athlete goes by a different name in a data source
// Reference: originals/volleyball.html:3386
const NICKNAME_ALIASES = context.config.nicknameAliases || {};

// Resolve any known nickname to its canonical form before matching
// Reference: originals/volleyball.html:3393
function resolveNickname(name){
  const norm=normName(name);
  return NICKNAME_ALIASES[norm] || name;
}

// Uses _canonicalName if set, falls back to .name.
// Returns {athlete, score, exact, matchType} or null.
// Reference: originals/volleyball.html:3400
function findBestMatch(incomingName){
  // Resolve nickname first
  const resolved=resolveNickname(incomingName);
  const norm=normName(resolved);
  let best=null, bestScore=0, bestType='';

  for(const a of context.api.ATHLETES){
    const canon=normName(a._canonicalName||a.name);
    const s=nameSimilarity(norm, canon);
    if(s>bestScore){
      bestScore=s;best=a;
      if(s===1.0) bestType='exact';
      else if(normName(resolved).split(' ').length===1) bestType='last-name-only';
      else if(norm.split(' ')[0].length===1) bestType='initial+last';
      else bestType='fuzzy';
    }
  }
  if(bestScore<0.8) return null;

  // Guard: if last-name-only and multiple athletes share that last name, don't auto-match
  if(bestType==='last-name-only'){
    const ln=lastName(resolved);
    const conflicts=context.api.ATHLETES.filter(a=>lastName(a._canonicalName||a.name)===ln);
    if(conflicts.length>1) return {athlete:best,score:bestScore,exact:false,matchType:'ambiguous-last-name',conflicts};
  }

  return {athlete:best,score:bestScore,exact:bestScore===1.0,matchType:bestType};
}

return Object.defineProperties({}, {
  logSource: {enumerable:true, configurable:true, get:()=>logSource},
  sourceForKey: {enumerable:true, configurable:true, get:()=>sourceForKey},
  mergeAthleteRecords: {enumerable:true, configurable:true, get:()=>mergeAthleteRecords},
  normName: {enumerable:true, configurable:true, get:()=>normName},
  firstName: {enumerable:true, configurable:true, get:()=>firstName},
  lastName: {enumerable:true, configurable:true, get:()=>lastName},
  nameSimilarity: {enumerable:true, configurable:true, get:()=>nameSimilarity},
  NICKNAME_ALIASES: {enumerable:true, configurable:true, get:()=>NICKNAME_ALIASES},
  resolveNickname: {enumerable:true, configurable:true, get:()=>resolveNickname},
  findBestMatch: {enumerable:true, configurable:true, get:()=>findBestMatch}
});
}
