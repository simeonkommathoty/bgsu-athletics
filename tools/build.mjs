// Builds the portal into dist/ and each sport into dist/<sport>/ (relative asset base,
// so the whole dist/ folder can be hosted at any path). Sports stay independently buildable
// with their own `npm run build`; this only redirects their output.
import path from 'node:path';
import {build} from 'vite';
import {root,sportApplications} from './sports.mjs';

const dist=path.join(root,'dist');
await build({root,configFile:path.join(root,'vite.config.js'),build:{outDir:dist,emptyOutDir:true}});
for(const app of sportApplications()){
  console.log(`\nBuilding ${app.id}...`);
  await build({root:app.dir,base:'./',build:{outDir:path.join(dist,app.folder),emptyOutDir:true}});
}
