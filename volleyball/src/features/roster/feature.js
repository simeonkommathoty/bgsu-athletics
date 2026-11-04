import metadata from './registration.js';
import template from './roster.html?raw';
import styles from './roster.css?inline';
import {createModule} from './roster.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initRoster'});
