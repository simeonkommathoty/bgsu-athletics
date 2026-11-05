import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {services} from './support.js';
import {createModule as createReadiness} from '../src/features/readiness/readiness.js';

class StubChart{constructor(){}destroy(){}update(){}}
const SRC=new URL('../src/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const walk=(dir,ext,out=[])=>{for(const f of fs.readdirSync(dir)){const p=path.join(dir,f);fs.statSync(p).isDirectory()?walk(p,ext,out):p.endsWith(ext)&&out.push(p);}return out;};

test('regression: Readiness Hub renders an empty database (no sessions, no date to select) without throwing',async()=>{
  const c=services({Chart:StubChart});
  c.api.ATHLETES=[];c.api.SESSIONS=[];
  const mod=createReadiness(c);
  await mod.initReadiness();
  await mod.renderReadiness();
});
test('regression: every unguarded getElementById("literal-id") in app code exists in some page template',()=>{
  const ids=new Set();
  for(const f of walk(SRC,'.html')){for(const m of fs.readFileSync(f,'utf8').matchAll(/id=["']([^"']+)["']/g))ids.add(m[1]);}
  for(const m of fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').matchAll(/id=["']([^"']+)["']/g))ids.add(m[1]);
  const js=walk(SRC,'.js').filter(f=>!f.includes(`${path.sep}demo${path.sep}`));
  for(const f of js){for(const m of fs.readFileSync(f,'utf8').matchAll(/id=.?["']([A-Za-z0-9_-]+).?["']|\.id\s*=\s*['"]([^'"]+)['"]/g))ids.add(m[1]||m[2]);}
  const missing=[];
  for(const f of js){
    fs.readFileSync(f,'utf8').split('\n').forEach((line,i)=>{
      for(const m of line.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)\s*\.(?!\?)/g)){
        if(!ids.has(m[1]))missing.push(`${path.relative(SRC,f)}:${i+1} #${m[1]}`);
      }
    });
  }
  assert.deepEqual(missing,[],'unguarded access to an element that no template defines (throws at runtime)');
});
