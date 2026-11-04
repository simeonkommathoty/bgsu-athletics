// One command, one port: portal at /, each sport's Vite dev server mounted at /<sport>/.
import http from 'node:http';
import {createServer} from 'vite';
import {root,sportApplications} from './sports.mjs';

const port=Number(process.env.PORT||5170);
const mounts=[];
for(const app of sportApplications()){
  const server=await createServer({root:app.dir,base:`/${app.folder}/`,appType:'spa',server:{middlewareMode:true,hmr:false,ws:false}});
  mounts.push({prefix:`/${app.folder}`,server});
}
const portal=await createServer({root,appType:'mpa',server:{middlewareMode:true,hmr:false,ws:false}});
http.createServer((req,res)=>{
  const url=req.url||'/';
  const mount=mounts.find(m=>url===m.prefix||url.startsWith(m.prefix+'/')||url.startsWith(m.prefix+'?'));
  if(mount&&url===mount.prefix){res.writeHead(301,{Location:mount.prefix+'/'});return res.end();}
  (mount?mount.server:portal).middlewares(req,res,()=>{res.statusCode=404;res.end('Not found');});
}).listen(port,'127.0.0.1',()=>console.log(`BGSU Athletics portal: http://127.0.0.1:${port}/  (${mounts.map(m=>m.prefix+'/').join(', ')})`));
