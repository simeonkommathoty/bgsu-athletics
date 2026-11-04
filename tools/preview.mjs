// Serves the unified dist/ build (portal + sports) exactly as a static host would.
import {preview} from 'vite';
import {root} from './sports.mjs';

const port=Number(process.env.PORT||5171);
const server=await preview({root,appType:'mpa',preview:{host:'127.0.0.1',port,strictPort:true}});
server.printUrls();
