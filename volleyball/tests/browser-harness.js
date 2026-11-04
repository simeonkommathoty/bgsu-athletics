import {startApplication} from '../src/application.js';
import {syntheticAthletes,syntheticSessions} from './fixtures.js';
const application=await startApplication({bootAuthentication:false,config:{}});
const {api}=application.context;
api.ATHLETES=syntheticAthletes();api.SESSIONS=syntheticSessions(api.ATHLETES);
api.refreshApproachJumpFreshness();
document.getElementById('login-overlay').style.display='none';
await application.layout.navigate('dashboard');
// Test-only entry, excluded from the production Vite graph.
window.volleyballTest=application;
