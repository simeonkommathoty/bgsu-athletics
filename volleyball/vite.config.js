import {defineConfig} from 'vite';
export default defineConfig({
  base:'./',
  server:{host:'127.0.0.1',hmr:{overlay:false}},
  build:{target:'es2022'},
});
