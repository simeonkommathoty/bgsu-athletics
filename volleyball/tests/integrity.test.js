import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'acorn';

const root=path.resolve(import.meta.dirname,'..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'reference-manifest.json'),'utf8'));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
test('both original references remain byte-for-byte unchanged',()=>{
  assert.equal(hash(path.join(root,'../originals/volleyball.html')),manifest.referenceSha256);
  assert.equal(hash(path.join(root,'../originals/hockey.html')),'004e83e3bf2917511c4c7cd442af4da0b67b67910104c51327b006c970c0e63d');
  assert.equal(hash(path.join(root,'../originals/volleyball.html')),'3d0f5e2bb14e277116ac4665d231545c1c1aced6c8200b3bd89ed14f3e81a0b0');
});
test('all original sidebar entries have feature-owned UI, logic, CSS and tests',()=>{
  const source=fs.readFileSync(path.join(root,'../originals/volleyball.html'),'utf8');
  const ids=[...source.matchAll(/class="nav-item(?: active)?" onclick="nav\('([^']+)'\)"/g)].map(m=>m[1]);
  assert.equal(ids.length,11);
  for(const id of ids){
    const dir=path.join(root,'src/features',id);
    for(const file of ['registration.js','feature.js',`${id}.js`,`${id}.html`,`${id}.css`,`${id}.test.js`])assert.ok(fs.existsSync(path.join(dir,file)),`${id}/${file}`);
    const ast=parse(fs.readFileSync(path.join(dir,'registration.js'),'utf8'),{sourceType:'module',ecmaVersion:2022});
    assert.equal(ast.body.length,1,`${id}: metadata must have no startup logic`);
    assert.equal(ast.body[0].type,'ExportDefaultDeclaration');assert.equal(ast.body[0].declaration.type,'ObjectExpression');
    assert.ok(ast.body[0].declaration.properties.every(property=>property.value.type==='Literal'),`${id}: metadata contains only literal values`);
  }
});
test('source excludes the reference backend configuration and private identity constants',()=>{
  const original=fs.readFileSync(path.join(root,'../originals/volleyball.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const ast=parse(original,{ecmaVersion:2022});
  const value=name=>ast.body.find(n=>n.declarations?.[0].id.name===name).declarations[0].init;
  const text=node=>node.type==='Literal'?node.value:text(node.left)+text(node.right);
  const backend=[text(value('SUPABASE_URL')),text(value('SUPABASE_ANON_KEY'))];
  const identities=[...value('NICKNAME_ALIASES').properties.flatMap(p=>[p.key.value,p.value.value])].filter(v=>v.includes(' '));
  const sourceFiles=files(path.join(root,'src')).filter(f=>!f.endsWith('.test.js')).map(file=>({file,contents:fs.readFileSync(file,'utf8').toLowerCase()}));
  const source=sourceFiles.map(item=>item.contents).join('\n');
  for(const literal of backend)assert.equal(source.includes(literal.toLowerCase()),false,'Reference backend configuration must remain outside source');
  for(const identity of identities)assert.equal(source.includes(identity.toLowerCase()),false,`Reference identity rules must remain in ignored local configuration; matching files: ${sourceFiles.filter(item=>item.contents.includes(identity.toLowerCase())).map(item=>path.relative(root,item.file)).join(', ')}`);
});
