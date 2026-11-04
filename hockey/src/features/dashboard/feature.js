import metadata from './registration.js';
import template from './dashboard.html?raw';
import styles from './dashboard.css?inline';
import {createModule} from './dashboard.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initDash'});
