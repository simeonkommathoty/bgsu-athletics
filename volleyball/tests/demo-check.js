// Synthetic Demo Mode browser checks. All non-local network traffic is blocked,
// and any request that looks like the backend fails the run. Uses no credentials.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';

const EXPECTED_FEATURES=11, PORT=5182, ORIGIN=`http://127.0.0.1:${PORT}`;
const SPARSE=/(Outside 03|Middle 03|Libero 02|DefSpec 02)/;
const server=await createServer({server:{port:PORT,strictPort:true,host:'127.0.0.1',hmr:false,watch:null}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.BGSU_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const external=[],all=[],sockets=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    all.push(u.href);
    if(u.hostname==='127.0.0.1'||u.protocol==='data:'||u.protocol==='blob:')return route.continue();
    external.push(u.href);return route.abort();
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('websocket',w=>sockets.push(w.url()));
  const text=()=>page.evaluate(()=>{const r=document.querySelector('[data-feature-root]')?.shadowRoot;return r?.querySelector('[id^="page-"]')?.innerText.replace(/\s+/g,' ')||'';});
  const onLogin=()=>page.waitForFunction(()=>!document.getElementById('demo-banner')&&document.getElementById('login-overlay')&&getComputedStyle(document.getElementById('login-overlay')).display!=='none',null,{timeout:20000});
  const inDemo=()=>page.waitForFunction(()=>document.getElementById('demo-banner'),null,{timeout:20000});

  // 1. Login screen keeps Coach Login, gains Explore Demo and Sports Home.
  await page.goto(ORIGIN+'/');
  await page.waitForSelector('#login-overlay',{state:'visible'});
  assert.equal(await page.locator('#login-btn').isVisible(),true,'coach login unchanged');
  assert.equal(await page.locator('#demo-btn').isVisible(),true);
  assert.equal(await page.locator('#demo-banner').count(),0,'no demo banner outside demo');
  const home=await page.locator('#login-sports-home').evaluate(a=>[a.getAttribute('href'),a.href]);
  assert.equal(home[0],'../');assert.equal(home[1],new URL('../',ORIGIN+'/').href);

  // 2. Enter demo from the login screen.
  await page.locator('#demo-btn').click();
  await inDemo();
  assert.equal(new URL(page.url()).hash,'#demo');
  assert.match(await page.locator('#demo-banner').innerText(),/DEMO — SYNTHETIC DATA/);
  assert.equal(await page.locator('#login-overlay').isVisible(),false);
  assert.equal(await page.locator('#shell-sports-home').isVisible(),true,'Sports Home inside dashboard');
  await page.waitForFunction(()=>/Demo (Outside|Middle|Setter|RightSide|Opposite|Libero|DefSpec)/.test(document.querySelector('[data-feature-root]')?.shadowRoot?.textContent||''),null,{timeout:20000});
  const ids=await page.locator('#feature-nav [data-feature]').evaluateAll(n=>n.map(x=>x.dataset.feature));
  assert.equal(ids.length,EXPECTED_FEATURES);

  // 3. Every sidebar feature must actually render with synthetic data.
  const verified=[];
  for(const id of ids){
    await page.locator(`#feature-nav [data-feature="${id}"]`).click();
    await page.waitForFunction(i=>document.querySelector("#feature-nav .active")?.dataset.feature===i&&document.querySelector('[data-feature-root]')?.shadowRoot?.querySelector('[id^="page-"]'),id,{timeout:15000}).catch(e=>{throw new Error("feature "+id+" did not render: "+e.message)});
    await page.waitForTimeout(450);
    const t=await text();
    {const fe=await page.locator('#feature-errors').innerText();assert.equal(fe,'',`${id} reported an error: ${fe}`);}
    assert.ok(t.length>60,`${id} rendered content`);
    assert.doesNotMatch(t,/NaN|undefined|\[object|Infinity/,`${id} shows invalid values: ${t.match(/.{30}(NaN|undefined|\[object|Infinity).{20}/)?.[0]}`);
    const canvases=await page.evaluate(()=>[...document.querySelector('[data-feature-root]').shadowRoot.querySelectorAll('canvas')].filter(c=>c.width>0&&c.height>0).length);
    verified.push(`${id}${canvases?`(${canvases} charts)`:''}`);
  }
  console.log('features rendered:',verified.join(', '));
  assert.ok(verified.some(v=>/charts/.test(v)),'charts render');

  // 4. Profile + missing measurements: the deliberately sparse athletes.
  await page.locator('#feature-nav [data-feature="profile"]').click();
  await page.waitForSelector('#profile-sel');
  let checked=0;
  for(const label of await page.locator('#profile-sel option').allInnerTexts()){
    if(!SPARSE.test(label))continue;
    await page.locator('#profile-sel').selectOption({label});await page.waitForTimeout(300);
    assert.equal(await page.locator('#feature-errors').innerText(),'');
    {const pt=await text();assert.doesNotMatch(pt,/NaN|undefined/,`profile ${label}: ${pt.match(/.{40}(NaN|undefined).{20}/)?.[0]}`)};checked++;
  }
  assert.ok(checked>=3,'incomplete athletes rendered in profile');
  await page.locator('#feature-nav [data-feature="compare"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#feature-errors').innerText(),'');

  // 5. No backend traffic, no websocket, no stored session.
  const storage=await page.evaluate(()=>({local:Object.keys(localStorage),cookie:document.cookie}));
  assert.deepEqual(storage.local.filter(k=>/^sb-|supabase/i.test(k)),[]);
  assert.equal(storage.cookie,'');
  assert.deepEqual(all.filter(u=>/\.supabase\.(co|in)|\/rest\/v1|\/auth\/v1|\/storage\/v1|\/realtime\/v1/i.test(u)),[],'no backend URL contacted');
  assert.deepEqual(sockets.filter(u=>!u.startsWith('ws://127.0.0.1')),[],'no remote websocket (realtime)');
  assert.deepEqual(external.filter(u=>!/fonts\.(googleapis|gstatic)\.com/.test(u)),[],'only fonts attempted externally (blocked)');

  // 6. Demo -> login: nothing demo survives.
  await page.locator('#demo-exit').click();
  await onLogin();
  assert.equal(new URL(page.url()).hash,'');
  assert.doesNotMatch(await page.evaluate(()=>document.body.innerText+(document.querySelector('[data-feature-root]')?.shadowRoot?.textContent||'')),/Demo (Outside|Middle|Setter|RightSide|Opposite|Libero|DefSpec)/,'no demo records after leaving demo');

  // 7. Login -> demo again, then browser Back/Forward.
  await page.locator('#demo-btn').click();
  await inDemo();
  await page.goBack();await onLogin();
  await page.goForward();await inDemo();

  // 8. Refresh keeps demo; plain URL shows the login screen, never a dashboard.
  await page.reload();await inDemo();
  await page.goto(ORIGIN+'/');await onLogin();
  assert.equal(await page.locator('#demo-banner').count(),0);

  assert.deepEqual(errors,[],'no page errors');
  console.log(`PASS volleyball demo (${ids.length}/${EXPECTED_FEATURES} features rendered, ${all.length} requests, all local)`);
}finally{await browser?.close();await server.close();}
process.exit(0);
