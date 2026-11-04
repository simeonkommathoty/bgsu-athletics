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
// ── Audit Log Page ───────────────────────────────────────────────
// Reference: originals/volleyball.html:6189
async function loadAuditLog(){
  const el=document.getElementById('audit-log-content');
  if(!context.api.sb||!context.api.currentUser){el.innerHTML='<div style="padding:20px;color:var(--text3);">Sign in to view history.</div>';return;}
  el.innerHTML='<div style="padding:20px;color:var(--text3);">Loading...</div>';
  try{
    const {data,error}=await context.api.sb.from('audit_log').select('*').order('changed_at',{ascending:false}).limit(200);
    if(error) throw error;
    if(!data||!data.length){el.innerHTML='<div style="padding:20px;color:var(--text3);">No changes recorded yet.</div>';return;}
    el.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr><th>WHEN</th><th>WHO</th><th>ATHLETE</th><th>ACTION</th><th>FIELDS</th></tr></thead>
      <tbody>${data.map(r=>{
        const d=new Date(r.changed_at);
        const when=d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
        const fields=r.changed_fields?.fields?.slice(0,5).join(', ')||'';
        const more=r.changed_fields?.fields?.length>5?` +${r.changed_fields.fields.length-5} more`:'';
        return`<tr><td style="font-family:var(--fm);font-size:10px;color:var(--text3);">${when}</td>
          <td style="font-size:11px;">${r.changed_by||'—'}</td>
          <td style="font-weight:500;">${r.athlete_name||'—'}</td>
          <td><span class="tier ${r.action==='delete'?'t-D':r.action==='insert'?'t-P':'t-A'}">${r.action}</span></td>
          <td style="font-size:10px;color:var(--text3);font-family:var(--fm);">${fields}${more}</td></tr>`;
      }).join('')}</tbody></table>`;
  } catch(e){
    el.innerHTML='<div style="padding:20px;color:var(--red);">Failed to load history: '+e.message+'</div>';
  }
}

return Object.defineProperties({}, {
  loadAuditLog: {enumerable:true, configurable:true, get:()=>loadAuditLog}
});
}
