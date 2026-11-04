import metadata from './registration.js';
import template from './workload.html?raw';
import styles from './workload.css?inline';
import {createModule} from './workload.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initWL'});
