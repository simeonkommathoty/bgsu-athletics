import metadata from './registration.js';
import template from './readiness.html?raw';
import styles from './readiness.css?inline';
import {createModule} from './readiness.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initReadiness'});
