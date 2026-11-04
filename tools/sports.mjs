// Shared by dev/build/preview: which registered sports have a real application folder.
import fs from 'node:fs';
import path from 'node:path';
import {sports} from '../src/sports.js';

export const root=path.resolve(import.meta.dirname,'..');
export function sportApplications(){
  return sports.filter(s=>s.enabled&&s.path).map(s=>{
    const folder=s.path.replace(/\/+$/,'');
    return {id:s.id,folder,dir:path.join(root,folder),valid:/^[\w-]+$/.test(folder)&&fs.existsSync(path.join(root,folder,'index.html'))&&fs.existsSync(path.join(root,folder,'package.json'))};
  }).filter(app=>{if(!app.valid)console.warn(`[Portal] skipping "${app.id}": no application at ${app.folder}/`);return app.valid;});
}
