import {createModule as service0} from '../services/scoring/composite.js';
import {createModule as service1} from '../services/data/roster.js';
import {createModule as service2} from '../services/data/charts.js';
import {createModule as service3} from '../services/data/presentation.js';
import {createModule as service4} from '../services/data/interactions.js';
import {createModule as service5} from '../services/export/csv.js';
import {createModule as service6} from '../services/scoring/radar.js';
import {createModule as service7} from '../services/scoring/outliers.js';
import {createModule as service8} from '../services/data/session-values.js';
import {createModule as service9} from '../services/data/metric-select.js';
import {createModule as service10} from '../services/data/workload.js';
import {createModule as service11} from '../services/import/import.js';
import {createModule as service12} from '../services/data/identity.js';
import {createModule as service13} from '../services/data/notifications.js';
import {createModule as service14} from '../services/data/sessions.js';
import {createModule as service15} from '../services/scoring/readiness.js';
import {createModule as service16} from '../services/export/readiness-pdf.js';
import {createModule as service17} from '../services/data/session-persistence.js';
import {createModule as service18} from '../services/authentication/authentication.js';
import {createModule as service19} from '../services/data/enrichment.js';
import {createModule as service20} from '../services/data/persistence.js';
import {createModule as service21} from '../services/data/photos.js';
import {createModule as service22} from '../services/demo/demo.js';
export const serviceFactories=[{id:'services/scoring/composite',create:service0},
{id:'services/data/roster',create:service1},
{id:'services/data/charts',create:service2},
{id:'services/data/presentation',create:service3},
{id:'services/data/interactions',create:service4},
{id:'services/export/csv',create:service5},
{id:'services/scoring/radar',create:service6},
{id:'services/scoring/outliers',create:service7},
{id:'services/data/session-values',create:service8},
{id:'services/data/metric-select',create:service9},
{id:'services/data/workload',create:service10},
{id:'services/import/import',create:service11},
{id:'services/data/identity',create:service12},
{id:'services/data/notifications',create:service13},
{id:'services/data/sessions',create:service14},
{id:'services/scoring/readiness',create:service15},
{id:'services/export/readiness-pdf',create:service16},
{id:'services/data/session-persistence',create:service17},
{id:'services/authentication/authentication',create:service18},
{id:'services/data/enrichment',create:service19},
{id:'services/data/persistence',create:service20},
{id:'services/data/photos',create:service21},
{id:'services/demo/demo',create:service22}];
