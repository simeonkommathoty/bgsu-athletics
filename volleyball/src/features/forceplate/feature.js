import metadata from './registration.js';
import template from './forceplate.html?raw';
import styles from './forceplate.css?inline';
import {createModule} from './forceplate.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initFP', beforeMount:context=>context.api.loadAllSessions()});
