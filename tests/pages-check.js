// GitHub Pages simulation: serves dist/ under /bgsu-athletics/ exactly like a static host
// (no SPA fallback, directory index, 301 for missing trailing slash) and drives the portal
// and both synthetic Demo Modes through every sidebar feature. Uses no credentials.
// Usage: node tests/pages-check.js   (BGSU_BROWSER=path to Chrome; BASE=/other/ to change)
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const root=path.resolve(import.meta.dirname,'..','dist');
const BASE=(process.env.BASE||'/bgsu-athletics/').replace(/\/?$/,'/');
const PORT=Number(process.env.PORT||5172),ORIGIN=`http://127.0.0.1:${PORT}`;
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.map':'application/json'};
const avatarPages=[];
const SPORTS=[{id:'hockey',features:12},{id:'volleyball',features:11}];
const BACKEND=/\.supabase\.(co|in)|\/rest\/v1|\/auth\/v1|\/storage\/v1|\/realtime\/v1/i;

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,ORIGIN);
  if(url.pathname==='/bgsu-athletics'&&BASE==='/bgsu-athletics/'){res.writeHead(301,{location:BASE});return res.end();}
  if(!url.pathname.startsWith(BASE)){res.writeHead(404);return res.end('outside base');}
  let file=path.join(root,decodeURIComponent(url.pathname.slice(BASE.length)));
  if(!file.startsWith(root)){res.writeHead(403);return res.end();}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory()){
    if(!url.pathname.endsWith('/')){res.writeHead(301,{location:url.pathname+'/'+url.search});return res.end();}
    file=path.join(file,'index.html');
  }
  if(!fs.existsSync(file)){res.writeHead(404);return res.end('not found');}
  res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
let browser;
try{
  assert.ok(fs.existsSync(path.join(root,'index.html')),'run `npm run build` first');
  browser=await chromium.launch({executablePath:process.env.BGSU_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const all=[],external=[],failed=[],errors=[],sockets=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());all.push(u.href);
    if(u.hostname==='127.0.0.1'||u.protocol==='data:'||u.protocol==='blob:')return route.continue();
    external.push(u.href);return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('websocket',w=>sockets.push(w.url()));
  page.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url());});
  page.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|fonts\./.test(m.text())&&!/status of 404/.test(m.text()))errors.push('console: '+m.text());});
  const text=()=>page.evaluate(()=>{const r=document.querySelector('[data-feature-root]')?.shadowRoot;return r?.querySelector('[id^="page-"]')?.innerText.replace(/\s+/g,' ')||'';});

  // Portal: both cards, correct deployed links.
  await page.goto(ORIGIN+BASE);
  await page.waitForSelector('a[href="hockey/"]');await page.waitForSelector('a[href="volleyball/"]');
  assert.equal(await page.locator('a[href="hockey/"]').evaluate(a=>a.href),ORIGIN+BASE+'hockey/');
  console.log('PASS portal cards under',BASE);
  // Without the trailing slash the host redirects, as GitHub Pages does.
  await page.goto(ORIGIN+BASE+'hockey');assert.equal(new URL(page.url()).pathname,BASE+'hockey/');

  for(const sport of SPORTS){
    // Portal card -> sport login, then Explore Demo.
    await page.goto(ORIGIN+BASE);
    await page.locator(`a[href="${sport.id}/"]`).click();
    await page.waitForSelector('#demo-btn',{state:'visible'});
    assert.equal(new URL(page.url()).pathname,`${BASE}${sport.id}/`);
    await page.locator('#demo-btn').click();
    await page.waitForFunction(()=>document.getElementById('demo-banner'),null,{timeout:20000});
    assert.equal(new URL(page.url()).hash,'#demo');
    // Direct deep link + refresh keep demo.
    await page.goto(`${ORIGIN}${BASE}${sport.id}/#demo`);await page.reload();
    await page.waitForFunction(()=>document.getElementById('demo-banner'),null,{timeout:20000});
    await page.waitForFunction(()=>/Demo (Forward|Defense|Goalie|Setter|Outside|Middle|Libero|Opposite|Hitter|Athlete)/i.test(document.querySelector('[data-feature-root]')?.shadowRoot?.textContent||''),null,{timeout:20000});
    // Regression: a click made while the demo data is still loading must not be overridden by the
    // post-load re-render (it used to jump back to the dashboard), and all 14 players must be distinct.
    await page.goto(`${ORIGIN}${BASE}${sport.id}/#demo`);
    await page.waitForFunction(()=>document.getElementById('demo-banner'),null,{timeout:20000});
    await page.locator('#feature-nav [data-feature="profile"]').click();
    await page.waitForTimeout(1500);
    const early=await page.evaluate(()=>{const r=document.querySelector('[data-feature-root]')?.shadowRoot;const sel=r?.querySelector('#profile-sel');
      return {active:document.querySelector('#feature-nav .active')?.dataset.feature,options:sel?.options.length,selected:sel?.selectedOptions[0]?.textContent.replace(/\s*\(.*$/,'').trim(),hero:r?.querySelector('#prof-hero')?.innerText||''};});
    assert.equal(early.active,'profile',`${sport.id}: early click kept (not overridden by post-load dashboard navigation)`);
    assert.equal(early.options,14,`${sport.id}: all 14 synthetic players are distinct (none merged by dedupe)`);
    assert.ok(early.hero.toUpperCase().includes(early.selected.toUpperCase()),`${sport.id}: profile card "${early.hero.slice(0,30)}" matches dropdown "${early.selected}"`);
    const ids=await page.locator('#feature-nav [data-feature]').evaluateAll(n=>n.map(x=>x.dataset.feature));
    assert.equal(ids.length,sport.features,`${sport.id} feature count`);
    let charts=0;
    for(const id of ids){
      await page.locator(`#feature-nav [data-feature="${id}"]`).click();
      await page.waitForFunction(i=>document.querySelector('#feature-nav .active')?.dataset.feature===i&&document.querySelector('[data-feature-root]')?.shadowRoot?.querySelector('[id^="page-"]'),id,{timeout:15000});
      await page.waitForTimeout(400);
      assert.equal(await page.locator('#feature-errors').innerText(),'',`${sport.id}/${id} reported an error`);
      const t=await text();
      assert.ok(t.length>60,`${sport.id}/${id} rendered`);
      assert.doesNotMatch(t,/NaN|undefined|\[object|Infinity/,`${sport.id}/${id} invalid values`);
      assert.ok(await page.locator('#demo-banner').count(),`${sport.id}/${id} still in demo`);
      if(id==='roster'||id==='profile'){
        const av=await page.evaluate(async()=>{
          const els=[...document.querySelector('[data-feature-root]').shadowRoot.querySelectorAll('.av-photo')];
          const src=els[0]?.style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
          const ok=src?await new Promise(r=>{const i=new Image();i.onload=()=>r(i.naturalWidth>0);i.onerror=()=>r(false);i.src=src;}):false;
          return {count:els.length,initialsOnly:document.querySelector('[data-feature-root]').shadowRoot.querySelectorAll('.av:not(.av-photo)').length,decoded:ok,data:src?.startsWith('data:image/svg+xml')};
        });
        assert.ok(av.count>0&&av.decoded&&av.data,`${sport.id}/${id} shows the embedded demo avatar (${JSON.stringify(av)})`);
        assert.equal(av.initialsOnly,0,`${sport.id}/${id} every synthetic player has the avatar`);
        avatarPages.push(`${sport.id}/${id}:${av.count}`);
      }
      charts+=await page.evaluate(()=>[...document.querySelector('[data-feature-root]').shadowRoot.querySelectorAll('canvas')].filter(c=>c.width>0&&c.height>0).length);
    }
    assert.ok(charts>0,`${sport.id} charts render`);
    // Cross-feature correctness: every leaderboard metric sorts monotonically, and a row opens that athlete's profile.
    await page.locator('#feature-nav [data-feature="leaderboard"]').click();await page.waitForTimeout(500);
    const chips=await page.evaluate(()=>[...document.querySelector('[data-feature-root]').shadowRoot.querySelectorAll('#metric-chips .chip')].map(c=>c.textContent.trim()).filter(t=>!/no data/i.test(t)));
    let sortedChips=0;
    for(const label of chips){
      const col=await page.evaluate(l=>{const r=document.querySelector('[data-feature-root]').shadowRoot;[...r.querySelectorAll('#metric-chips .chip')].find(c=>c.textContent.trim()===l)?.click();
        return [...r.querySelectorAll('#lb-tbody tr')].map(tr=>parseFloat((tr.children[3]?.innerText||'').split(',').join('').replace(/[^0-9.-]/g,' ').trim().split(' ')[0]));},label);
      const v=col.filter(x=>!Number.isNaN(x));if(v.length<2)continue;
      assert.ok(v.every((x,i)=>i===0||x>=v[i-1])||v.every((x,i)=>i===0||x<=v[i-1]),`${sport.id} leaderboard "${label}" is sorted: ${v.join(',')}`);sortedChips++;
    }
    assert.ok(sortedChips>=10,`${sport.id}: leaderboard metrics checked (${sortedChips})`);
    for(const i of [0,3,7]){
      await page.locator('#feature-nav [data-feature="leaderboard"]').click();await page.waitForTimeout(300);
      const rowName=await page.evaluate(i=>{const tr=document.querySelector('[data-feature-root]').shadowRoot.querySelectorAll('#lb-tbody tr')[i];const n=tr.children[1].innerText.split(String.fromCharCode(10))[0].trim();tr.click();return n;},i);
      await page.waitForFunction(()=>document.querySelector('#feature-nav .active')?.dataset.feature==='profile'&&document.querySelector('[data-feature-root]')?.shadowRoot?.querySelector('#profile-sel'),null,{timeout:8000});
      await page.waitForTimeout(300);
      const hero=await page.evaluate(()=>document.querySelector('[data-feature-root]').shadowRoot.querySelector('#prof-hero').innerText.toUpperCase());
      assert.ok(hero.includes(rowName.toUpperCase()),`${sport.id}: leaderboard row "${rowName}" opened that athlete's profile`);
    }
    // Back/Forward and Sports Home from inside the demo.
    await page.locator('#feature-nav [data-feature="roster"]').click();
    await page.goBack().catch(()=>{});
    await page.goto(`${ORIGIN}${BASE}${sport.id}/#demo`);
    await page.waitForFunction(()=>document.getElementById('demo-banner'),null,{timeout:20000});
    await page.locator('#shell-sports-home').click();
    await page.waitForSelector('a[href="hockey/"]');
    assert.equal(new URL(page.url()).pathname,BASE);
    console.log(`PASS ${sport.id} demo under ${BASE} (${ids.length}/${sport.features} features, ${charts} chart canvases)`);
  }

  // Volleyball sign-in: "Forgot password?" is present and wired through the real event system
  // (empty email -> instruction, no network); the reset screen exists and stays hidden.
  await page.goto(`${ORIGIN}${BASE}volleyball/`);
  await page.waitForSelector('#forgot-password-link',{state:'visible',timeout:20000});
  await page.locator('#login-email').fill('');
  await page.locator('#forgot-password-link').click();
  await page.waitForFunction(()=>/Enter your email/.test(document.getElementById('login-msg').textContent),null,{timeout:5000});
  assert.equal(await page.locator('#reset-password-overlay').evaluate(e=>getComputedStyle(e).display),'none');
  assert.equal(await page.locator('#reset-password-confirm').count(),1);
  console.log('PASS volleyball sign-in shows Forgot password? (reset screen hidden until a recovery link)');

  assert.equal(avatarPages.length,4,'avatar verified on roster and profile of both sports');console.log('PASS demo avatar rendered:',avatarPages.join(', '));
  assert.deepEqual(all.filter(u=>BACKEND.test(u)),[],'no Supabase request');
  assert.deepEqual(sockets.filter(u=>!u.startsWith('ws://127.0.0.1')),[],'no remote websocket');
  assert.deepEqual(external.filter(u=>!/fonts\.(googleapis|gstatic)\.com/.test(u)),[],'only fonts requested externally');
  assert.deepEqual(failed,[],'no 4xx/5xx asset responses');
  assert.deepEqual(errors,[],'no page or console errors');
  console.log(`PASS no Supabase traffic, no failed assets, no console errors (${all.length} requests)`);
}finally{await browser?.close();server.close();}
process.exit(0);
