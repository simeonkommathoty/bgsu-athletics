import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {createServices} from '../src/services/context.js';

export {syntheticAthletes,syntheticSessions} from './fixtures.js';
export function fakeDocument(){
  const elements=new Map();
  const node=()=>({style:{},classList:{add(){},remove(){},contains(){return false;}},innerHTML:'',textContent:'',value:'',addEventListener(){},appendChild(){},click(){},scrollIntoView(){},querySelector(){return null;},querySelectorAll(){return [];}});
  return {getElementById:id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);},createElement:node,addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},body:node(),head:node()};
}
export function services(overrides={}) {
  return createServices({document:fakeDocument(),window:{},config:{},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},report:(_id,error)=>{throw error;},navigate(){},refreshFeature(){},...overrides});
}
export function referenceOracle(){
  const html=fs.readFileSync(new URL('../../originals/volleyball.html',import.meta.url),'utf8');
  const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const ast=parse(source,{ecmaVersion:2022});
  const declarations=ast.body.filter(n=>n.type==='FunctionDeclaration'||n.type==='VariableDeclaration').map(n=>source.slice(n.start,n.end)).join('\n');
  const sandbox=vm.createContext({document:fakeDocument(),window:{},console,Date,Math,setTimeout:()=>0,clearTimeout(){},Map,Set});
  vm.runInContext(declarations,sandbox);
  return {run:code=>vm.runInContext(code,sandbox),set:(key,value)=>{sandbox.__input=value;vm.runInContext(`${key}=__input`,sandbox);delete sandbox.__input;}};
}

