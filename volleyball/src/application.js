import Chart from 'chart.js/auto';
import * as supabase from '@supabase/supabase-js';
import './styles/reference.css';
import {createLayout} from './layout/layout.js';
import {discoverFeatures} from './layout/feature-loader.js';
import {createServices} from './services/context.js';
import {serviceDocument} from './layout/dom-scope.js';
import {bindEvents} from './layout/events.js';
import {isDemoRequested} from './services/demo/demo.js';
import authenticationUI from './services/authentication/authentication.html?raw';
import importUI from './services/import/import.html?raw';

export async function startApplication({bootAuthentication=true,config}={}) {
const layout=createLayout(document.getElementById('volleyball-app'));
document.body.insertAdjacentHTML('beforeend',authenticationUI+importUI+'<div id="readiness-print"></div>');
const demoRequested=isDemoRequested(window.location);
const context=createServices({
  document:serviceDocument(document), window, Chart, supabase,
  config:config||(demoRequested?{}:{supabaseUrl:import.meta.env.VITE_SUPABASE_URL,supabaseKey:import.meta.env.VITE_SUPABASE_ANON_KEY,
    nicknameAliases:JSON.parse(import.meta.env.VITE_VOLLEYBALL_NICKNAME_ALIASES||'{}'),formerPlayers:JSON.parse(import.meta.env.VITE_VOLLEYBALL_FORMER_PLAYERS||'[]')}),
  navigate:layout.navigate, refreshFeature:layout.refreshFeature, report:layout.report,
  setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window),requestAnimationFrame:window.requestAnimationFrame.bind(window),
});
const controller=new AbortController();
context.onNavigation=()=>context.api.updateRosterBadge?.();
window.addEventListener('error',event=>layout.report(`${layout.activeId||'application'}:runtime`,event.error||new Error(event.message)),{signal:controller.signal});
window.addEventListener('unhandledrejection',event=>layout.report(`${layout.activeId||'application'}:async`,event.reason),{signal:controller.signal});
bindEvents(document,context,error=>layout.report('application:interaction',error),controller.signal);
const registrations=import.meta.glob('./features/*/registration.js');
const implementations=import.meta.glob('./features/*/feature.js');
const features=await discoverFeatures(registrations,implementations,layout.report);
await layout.start(features,context);
context.api.updateRosterBadge?.();
if(bootAuthentication)try{await (context.api.demoMode?context.api.startDemo():context.api.bootSupabase());}catch(error){layout.report(context.api.demoMode?'demo':'authentication',error);}

if(import.meta.hot)import.meta.hot.dispose(()=>{controller.abort();layout.destroy();});

return {context,layout,features};
}

