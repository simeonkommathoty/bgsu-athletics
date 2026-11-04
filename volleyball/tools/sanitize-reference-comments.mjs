// One-time privacy cleanup; only comment tokens are changed.
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
const root=path.resolve(import.meta.dirname,'..');
const original=fs.readFileSync(path.join(root,'../originals/volleyball.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const ast=parse(original,{ecmaVersion:2022});
const value=name=>ast.body.find(n=>n.declarations?.[0].id.name===name).declarations[0].init;
const identities=[...new Set([...value('NICKNAME_ALIASES').properties.flatMap(p=>[p.key.value,p.value.value]),])].filter(v=>v.includes(' '));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
let changed=0;
for(const file of files(path.join(root,'src')).filter(file=>file.endsWith('.js'))){
  let source=fs.readFileSync(file,'utf8');const comments=[];
  parse(source,{sourceType:'module',ecmaVersion:2022,onComment:comments});
  let dirty=false;
  for(const comment of comments.reverse()){
    let text=source.slice(comment.start,comment.end);
    for(const identity of identities){
      const escaped=identity.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      text=text.replace(new RegExp(escaped,'gi'),'Synthetic Player');
    }
    if(text!==source.slice(comment.start,comment.end)){source=source.slice(0,comment.start)+text+source.slice(comment.end);dirty=true;}
  }
  if(dirty){fs.writeFileSync(file,source);changed++;console.log(path.relative(root,file));}
}
console.log(`Sanitized comments in ${changed} files. No runtime expressions changed.`);
