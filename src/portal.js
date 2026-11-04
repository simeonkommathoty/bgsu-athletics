// Renders the sport selection page from the registry. No authentication happens here:
// each sport application keeps its own sign-in and authorization.
const escapeHtml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function selectableSports(registry){
  return registry.filter(s=>s&&s.enabled===true&&s.id&&s.name&&s.path).slice().sort((a,b)=>(a.order??0)-(b.order??0));
}
// A sport is valid when its path returns an HTML page that is not the portal itself.
export async function isApplicationAvailable(sport,fetchFn=fetch,base=document.baseURI){
  try{
    const response=await fetchFn(new URL(sport.path,base).href,{headers:{Accept:'text/html'}});
    if(!response.ok)return false;
    const html=await response.text();
    return /<html/i.test(html)&&!html.includes('id="portal-root"');
  }catch{return false;}
}
export async function availableSports(registry,fetchFn,base){
  const candidates=selectableSports(registry);
  const checks=await Promise.all(candidates.map(s=>isApplicationAvailable(s,fetchFn,base)));
  candidates.forEach((s,i)=>{if(!checks[i])console.warn(`[Portal] "${s.id}" is registered but no application responds at ${s.path}; hidden.`);});
  return candidates.filter((_,i)=>checks[i]);
}
export function renderCards(sports){
  return sports.map(s=>`<a class="sport-card" href="${escapeHtml(s.path)}" data-sport="${escapeHtml(s.id)}" aria-label="Open ${escapeHtml(s.name)} dashboard">
      <span class="sport-icon">${s.icon||''}</span>
      <span class="sport-name">${escapeHtml(s.name)}</span>
      <span class="sport-desc">${escapeHtml(s.description||'')}</span>
      <span class="sport-action">Open dashboard <span aria-hidden="true">→</span></span>
    </a>`).join('');
}
export async function startPortal(root,registry,{fetchFn=(...a)=>fetch(...a)}={}){
  root.innerHTML=`<main class="portal"><header class="portal-head"><div class="portal-mark">BGSU</div><div><h1>Athletics Performance</h1><p>Select a sport to open its dashboard. Sign-in is handled by each sport.</p></div></header>
    <section class="sport-grid" id="sport-grid" aria-live="polite"><p class="portal-status">Loading sports…</p></section>
    <footer class="portal-foot">Bowling Green State University · Strength &amp; Conditioning</footer></main>`;
  const grid=root.querySelector('#sport-grid');
  const sports=await availableSports(registry,fetchFn);
  grid.innerHTML=sports.length?renderCards(sports):'<p class="portal-status">No sport dashboards are currently available.</p>';
  return sports;
}
