import {startApplication} from '../src/application.js';
import {syntheticAthletes,syntheticSessions,syntheticHistory} from './fixtures.js';
const application=await startApplication({bootAuthentication:false,config:{}});
const {api}=application.context;
api.ATHLETES=syntheticAthletes();api.SESSIONS=syntheticSessions(api.ATHLETES);
api.KPI_HISTORY=syntheticHistory(api.ATHLETES);
api.refreshApproachJumpFreshness();api.rescoreAllAthletes();
document.getElementById('login-overlay').style.display='none';
await application.layout.navigate('dashboard');
// Test-only entry, excluded from the production Vite graph.
window.hockeyTest=application;
