import {defineConfig} from 'vite';
// Relative base: the portal works at "/" or under any deployment sub-path.
export default defineConfig({base:'./',appType:'mpa',build:{target:'es2022'}});
