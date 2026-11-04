// Starts the unified dev server on a spare port, checks the mounted paths, and stops it.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port=5174;
const child=spawn(process.execPath,['tools/dev.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
try{
  await new Promise((resolve,reject)=>{child.stdout.on('data',d=>String(d).includes('http://')&&resolve());child.on('exit',()=>reject(new Error('dev server exited')));setTimeout(()=>reject(new Error('dev server timeout')),30000);});
  const get=async p=>{const r=await fetch(`http://127.0.0.1:${port}${p}`,{redirect:'manual'});return {status:r.status,body:await r.text(),location:r.headers.get('location')};};
  assert.match((await get('/')).body,/portal-root/);
  assert.equal((await get('/hockey')).location,'/hockey/');
  assert.match((await get('/hockey/')).body,/hockey-app/);
  assert.match((await get('/volleyball/')).body,/volleyball-app/);
  console.log('PASS dev server serves portal, /hockey/ and /volleyball/');
}finally{child.kill();}
process.exit(0);
