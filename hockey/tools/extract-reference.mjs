// One-time, scope-aware extraction. Production code never reads the reference.
// Do not rerun after hand edits without reviewing the diff.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'acorn';
import { analyze } from 'eslint-scope';
import { parse as parseHtml } from 'parse5';

const root = path.resolve(import.meta.dirname, '..');
const original = fs.readFileSync(path.join(root, '../originals/hockey.html'), 'utf8');
const source = original.match(/<script>([\s\S]*?)<\/script>/)[1];
const offset = original.slice(0, original.indexOf(source)).split('\n').length - 1;
const ast = parse(source, {ecmaVersion:2022, ranges:true, locations:true});
const scopes = analyze(ast, {ecmaVersion:2022, sourceType:'script', optimistic:true, ignoreEval:true});
function write(file, contents) {
  const dest=path.join(root,file); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,contents);
}
function owner(node) {
  const line=node.loc.start.line+offset;
  if(line<1380) return 'services/scoring/composite';
  if(line<1384) return 'services/data/charts';
  if(line<1408) return 'skip';
  if(line<1474) return 'services/data/presentation';
  if(line<1519) return 'services/data/interactions';
  if(line<1525) return 'services/export/csv';
  if(line<1867) return 'features/roster/roster';
  if(line<2207) return 'features/dashboard/dashboard';
  if(line<2316) return 'features/profile/profile';
  if(line<2368) return 'features/jumping/jumping';
  if(line<2470) return 'services/scoring/outliers';
  if(line<2537) return 'services/data/session-values';
  if(line<2572) return 'services/data/metric-select';
  if(line<2803) return 'features/forceplate/forceplate';
  if(line<2844) return 'services/data/workload';
  if(line<3390) return 'features/workload/workload';
  if(line<3470) return 'features/leaderboard/leaderboard';
  if(line<3514) return 'features/position/position';
  if(line<3557) return 'features/compare/compare';
  if(line<5930) return 'services/import/import';
  if(line<6050) return 'services/data/roster';
  if(line<6055) return 'services/data/notifications';
  if(line<6085) return 'features/readiness/readiness';
  if(line<6165) return 'services/data/sessions';
  if(line<6271) return 'features/progress/progress';
  if(line<6765) return 'features/readiness/readiness';
  if(line<6926) return 'services/data/session-persistence';
  if(line<7065) return 'services/authentication/authentication';
  if(line<7187) return 'services/data/enrichment';
  if(line<7415) return 'services/data/persistence';
  if(line<7442) return 'features/audit/audit';
  if(line<7456) return 'skip';
  if(line<7543) return 'services/data/photos';
  if(line<7555) return 'services/authentication/authentication';
  return 'skip';
}
const moves = {
  ATHLETES:'services/data/roster', SESSIONS:'services/data/sessions', SESSION_DRILLS:'services/data/sessions', KPI_HISTORY:'services/data/sessions',
  posIsSet:'services/data/roster', unsetCount:'services/data/roster', postImportPositionCheck:'services/data/roster',
  updateRosterBadge:'services/data/interactions',
  VB_RADAR:'services/scoring/radar', radarNorm:'services/scoring/radar', athleteRadarDataFiltered:'services/scoring/radar',
  athleteRadarData:'services/scoring/radar', groupRadarFiltered:'services/scoring/radar', groupRadarData:'services/scoring/radar',
  RADAR_LABELS:'services/scoring/radar', VB_RADAR_LEGEND_HTML:'services/scoring/radar', RADAR_OPTIONS:'services/scoring/radar',
  renderProfileRadar:'features/profile/profile', renderPositionRadar:'features/position/position', renderCompareRadar:'features/compare/compare',
  KPI_SORT_KEYS:'features/dashboard/dashboard', populateKpiSort:'features/dashboard/dashboard',
  WL_SORT_KEYS:'features/workload/workload', populateWLSort:'features/workload/workload',
  logSource:'services/data/identity', sourceForKey:'services/data/identity', mergeAthleteRecords:'services/data/identity',
  normName:'services/data/identity', firstName:'services/data/identity', lastName:'services/data/identity', nameSimilarity:'services/data/identity',
  NICKNAME_ALIASES:'services/data/identity', FORMER_PLAYERS:'services/data/identity', resolveNickname:'services/data/identity',
  isFormerPlayer:'services/data/identity', _nameKeyMemo:'services/data/identity', nameKey:'services/data/identity',
  athleteKey:'services/data/identity', histFor:'services/data/identity', isSeptDate:'services/data/identity', officialHist:'services/data/identity',
  findBestMatch:'services/data/identity',
  READINESS_METRICS:'services/scoring/readiness', TEAM_STRIP_METRICS:'services/scoring/readiness', READINESS_Z:'services/scoring/readiness',
  ASYM_FLAG_THRESHOLD:'services/scoring/readiness', READINESS_RED_PENALTY:'services/scoring/readiness',
  READINESS_MAX_PENALTY_PER_ATHLETE:'services/scoring/readiness', READINESS_BREADTH_WEIGHT:'services/scoring/readiness',
  READINESS_SINGLE_FLAG_PENALTY:'services/scoring/readiness', READINESS_TREND_WEIGHT:'services/scoring/readiness',
  READINESS_TREND_CAP:'services/scoring/readiness', READINESS_TIERS:'services/scoring/readiness',
  computeTeamReadiness:'services/scoring/readiness', readinessTrendLine:'services/scoring/readiness', PR_METRICS:'services/scoring/readiness',
  exportReadinessPdf:'services/export/readiness-pdf',
  prHardOk:'services/scoring/readiness', computeReadinessPRs:'services/scoring/readiness', isValdSession:'services/data/sessions',
};
const nodes=new Map(), bindings=new Map();
for(const node of ast.body) {
  const names=node.type==='FunctionDeclaration'?[node.id.name]:node.type==='VariableDeclaration'?node.declarations.map(d=>d.id.name):[];
  const mod=moves[names[0]]||owner(node);
  nodes.set(node,mod);
  for(const name of names) bindings.set(name,{node,mod,mutable:node.type==='VariableDeclaration'&&node.kind!=='const'});
}
// The original wrapper was installed globally at boot. Fold it into its owner.
bindings.set('_cloudDataLoaded',{mod:'services/data/persistence',mutable:true});
bindings.set('nav',{mod:'context',mutable:false});
const replacements=[];
for(const variable of scopes.globalScope.variables) {
  const binding=bindings.get(variable.name); if(!binding)continue;
  for(const ref of variable.references) {
    if(ref.init) continue;
    const id=ref.identifier;
    const top=ast.body.find(n=>n.start<=id.start&&n.end>=id.end);
    const mod=nodes.get(top);
    if(mod==='skip'||mod===binding.mod)continue;
    let value=variable.name==='nav'?'context.navigate':`context.api.${variable.name}`;
    // Preserve object shorthand keys (the reference includes {ATHLETES}-style fields).
    const before=source.slice(Math.max(top.start,id.start-3),id.start);
    const after=source.slice(id.end,id.end+3);
    if(/[,{]\s*$/.test(before)&&/^\s*[,}]/.test(after)) value=`${variable.name}: ${value}`;
    replacements.push({start:id.start,end:id.end,value});
  }
}
const groups=new Map(), deps={};
let previousEnd=0;
for(const node of ast.body) {
  const mod=nodes.get(node);
  const comment=source.slice(previousEnd,node.start); previousEnd=node.end;
  if(mod==='skip')continue;
  let text=source.slice(node.start,node.end);
  for(const r of replacements.filter(r=>r.start>=node.start&&r.end<=node.end).sort((a,b)=>b.start-a.start)) {
    text=text.slice(0,r.start-node.start)+r.value+text.slice(r.end-node.start);
  }
  if(text.includes('const SUPABASE_URL'))text='const SUPABASE_URL = context.config.supabaseUrl;';
  if(text.includes('const SUPABASE_ANON_KEY'))text='const SUPABASE_ANON_KEY = context.config.supabaseKey;';
  if(node.type==='VariableDeclaration' && node.declarations[0].id.name==='NICKNAME_ALIASES')text='const NICKNAME_ALIASES = context.config.nicknameAliases || {};';
  if(node.type==='VariableDeclaration' && node.declarations[0].id.name==='FORMER_PLAYERS')text='const FORMER_PLAYERS = new Set(context.config.formerPlayers || []);';
  // Bind bundled Supabase without adding a mutable window global.
  text=text.replaceAll("typeof window.supabase==='undefined'",'!context.supabase')
    .replaceAll('window.supabase.createClient','context.supabase.createClient');
  if(node.type==='FunctionDeclaration'&&node.id.name==='initSupabase') {
    text=text.replace('if(!context.supabase){', 'if(!context.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY){')
      .replace('Supabase library failed to load. Check your internet connection.','Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart Vite.');
  }
  if(node.type==='FunctionDeclaration'&&node.id.name==='refreshAll') {
    text=text.replace(/\n}$/, '\n  if(context.api.sb && context.api.currentUser && context.api._cloudDataLoaded) context.api.queueSaveAll();\n}');
  }
  if(node.type==='FunctionDeclaration'&&node.id.name==='openAth') {
    text=`async function openAth(id){\n  document.getElementById('sdrop').style.display='none';\n  document.getElementById('gsearch').value='';\n  if(await context.navigate('profile')) {\n    document.getElementById('profile-sel').value=id;\n    context.api.renderProfile();\n  }\n}`;
  }
  if(mod==='services/data/photos') text=text.replaceAll('context.api.renderProfile();',"context.refreshFeature('profile');");
  if(mod==='services/import/import') text=text.replaceAll('context.api.initFP();',"context.refreshFeature('forceplate');").replaceAll('context.api.initReadiness();',"context.refreshFeature('readiness');");
  text=text.replace(/\bon(click|change|input|keydown|mouseover|mouseout|mouseenter|mouseleave|blur|focus|drop|dragover|dragenter|dragleave)=(?=")/g,'data-on$1=');
  if(!groups.has(mod))groups.set(mod,[]);
  groups.get(mod).push(`${comment.trim()}\n// Reference: originals/hockey.html:${node.loc.start.line+offset}\n${text}`);
}
const manifest={referenceSha256:crypto.createHash('sha256').update(original).digest('hex'),modules:{}};
for(const [mod,parts] of groups) {
  const symbols=[...bindings].filter(([,b])=>b.mod===mod);
  const properties=symbols.map(([name,b])=>b.mutable?`  ${name}: {enumerable:true, configurable:true, get:()=>${name}, set:value=>{${name}=value;}}`:`  ${name}: {enumerable:true, configurable:true, get:()=>${name}}`).join(',\n');
  const prelude=mod==='services/data/persistence'?'let _cloudDataLoaded=false;\n':'';
  const output=`// Extracted from the authoritative reference; see source line annotations.\n// Dependencies are supplied per application instance, never through window.\nexport function createModule(context) {\nconst document=context.document;\nconst window=context.window;\nconst Chart=context.Chart;\nconst XLSX=context.XLSX;\nconst setTimeout=context.setTimeout;\nconst clearTimeout=context.clearTimeout;\nconst requestAnimationFrame=context.requestAnimationFrame;\n${prelude}${parts.join('\n\n')}\n\nreturn Object.defineProperties({}, {\n${properties}\n});\n}\n`;
  write(`src/${mod}.js`,output);
  manifest.modules[mod]={symbols:symbols.map(([name])=>name),dependencies:[...new Set([...output.matchAll(/context\.api\.(\w+)/g)].map(m=>m[1]))]};
}
// Parse locations to preserve exactly the original page and shell markup.
const dom=parseHtml(original,{sourceCodeLocationInfo:true});
function walk(n,fn){fn(n); for(const c of n.childNodes||[])walk(c,fn);}
const all=[]; walk(dom,n=>{if(n.sourceCodeLocation)all.push(n);});
function attr(n,key){return n.attrs?.find(a=>a.name===key)?.value;}
function htmlOf(n){return original.slice(n.sourceCodeLocation.startOffset,n.sourceCodeLocation.endOffset);}
function handlers(s){return s.replace(/\bon(click|change|input|keydown|mouseover|mouseout|mouseenter|mouseleave|blur|focus|drop|dragover|dragenter|dragleave)=/g,'data-on$1=');}
const pageNodes=all.filter(n=>(attr(n,'id')||'').startsWith('page-'));
const nav=all.find(n=>n.tagName==='nav');
const titles=Object.fromEntries(ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='PAGE_TITLES').declarations[0].init.properties.map(p=>[p.key.name,p.value.value]));
let section='Overview', order=0;
const entryNames={dashboard:'initDash',roster:'initRoster',profile:'initProfile',jumping:'initJumping',forceplate:'initFP',readiness:'initReadiness',workload:'initWL',leaderboard:'initLB',position:'initPos',progress:'initProgress',compare:'initCmp',audit:'loadAuditLog'};
for(const n of nav.childNodes.filter(n=>n.tagName==='div')) {
  if(attr(n,'class')==='nav-sec'){section=n.childNodes[0].value;continue;}
  const id=attr(n,'onclick').match(/nav\('(.+)'\)/)[1];
  const svg=n.childNodes.find(n=>n.tagName==='svg');
  const label=n.childNodes.filter(n=>n.nodeName==='#text').map(n=>n.value.trim()).join('').trim();
  const metadata={id,title:titles[id],label,icon:htmlOf(svg),order:order++,section};
  write(`src/features/${id}/registration.js`,`// Metadata only: no feature code is executed during discovery.\nexport default ${JSON.stringify(metadata,null,2)};\n`);
  const page=pageNodes.find(p=>attr(p,'id')==='page-'+id);
  let ui=htmlOf(page).replace('page active','page').replace('class="content page"','class="content page active"');
  if(id==='roster') ui+=htmlOf(all.find(n=>attr(n,'id')==='merge-overlay'));
  write(`src/features/${id}/${id}.html`,handlers(ui)+'\n');
  write(`src/features/${id}/${id}.css`,`/* ${metadata.title}: this stylesheet lives inside the feature's ShadowRoot. */\n:host { display: block; min-width: 0; }\n`);
  write(`src/features/${id}/feature.js`,`import metadata from './registration.js';\nimport template from './${id}.html?raw';\nimport styles from './${id}.css?inline';\nimport {createModule} from './${id}.js';\nimport {createFeature} from '../../layout/feature-runtime.js';\nexport default createFeature(metadata, {template, styles, createModule, initialize:'${entryNames[id]}'${id==='forceplate'?", beforeMount:context=>context.api.loadAllSessions()":''}});\n`);
}
// Shell template retains reference chrome; the nav list and pages are shell owned slots.
const app=all.find(n=>attr(n,'class')==='app');
let shell=htmlOf(app);
const removed=[...pageNodes,...all.filter(n=>['merge-overlay','sprint-audit-overlay'].includes(attr(n,'id')))];
for(const n of removed)shell=shell.replace(htmlOf(n),'');
shell=shell.replace(htmlOf(nav),'<nav class="nav" id="feature-nav" aria-label="Hockey features"></nav>');
shell=shell.replace('<!-- ═══════════════════════════════ DASHBOARD ═══════════════════════════════ -->','<div id="feature-errors" role="status" aria-live="polite"></div><main id="feature-content"></main>');
write('src/layout/shell.html',handlers(shell));
const login=all.find(n=>attr(n,'id')==='login-overlay');
const reset=all.find(n=>attr(n,'id')==='reset-password-overlay');
const imp=all.find(n=>attr(n,'id')==='imp-overlay');
write('src/services/authentication/authentication.html',handlers(htmlOf(login)+'\n'+htmlOf(reset)));
write('src/services/import/import.html',handlers(htmlOf(imp)+'\n'+htmlOf(all.find(n=>attr(n,'id')==='sprint-audit-overlay'))));
const css=original.match(/<style>([\s\S]*?)<\/style>/)[1];
write('src/styles/reference.css',css+'\n@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}\n');
write('reference-manifest.json',JSON.stringify(manifest,null,2)+'\n');
// Keep reference-specific identities local; never commit athlete names/config.
if(!fs.existsSync(path.join(root,'.env.local'))) {
  const aliases=ast.body.find(n=>n.declarations?.[0].id.name==='NICKNAME_ALIASES').declarations[0].init;
  const former=ast.body.find(n=>n.declarations?.[0].id.name==='FORMER_PLAYERS').declarations[0].init.arguments[0];
  const aliasMap=Object.fromEntries(aliases.properties.map(p=>[p.key.value,p.value.value]));
  write('.env.local',`# Reference-specific identity rules; do not commit. Backend configuration is intentionally unset.\nVITE_HOCKEY_NICKNAME_ALIASES='${JSON.stringify(aliasMap)}'\nVITE_HOCKEY_FORMER_PLAYERS='${JSON.stringify(former.elements.map(n=>n.value))}'\n`);
}
const serviceModules=[...groups.keys()].filter(k=>k.startsWith('services/'));
// Only the scoring constants have top-level dependencies; composition order is explicit.
serviceModules.sort((a,b)=>(a==='services/scoring/composite'?-1:b==='services/scoring/composite'?1:0));
write('src/services/modules.js',serviceModules.map((m,i)=>`import {createModule as service${i}} from '../${m}.js';`).join('\n')+'\nexport const serviceFactories=['+serviceModules.map((m,i)=>`{id:'${m}',create:service${i}}`).join(',\n')+'];\n');
const crossFeatures=[];
for(const [m,info] of Object.entries(manifest.modules))for(const dep of info.dependencies){const target=bindings.get(dep)?.mod;if(target?.startsWith('features/')&&target!==m)crossFeatures.push(`${m} -> ${target}: ${dep}`);}
console.log(JSON.stringify({pages:pageNodes.length,modules:groups.size,crossFeatures},null,2));
await import('./sanitize-reference-comments.mjs');
