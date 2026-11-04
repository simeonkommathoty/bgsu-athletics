import metadata from './registration.js';
import template from './progress.html?raw';
import styles from './progress.css?inline';
import {createModule} from './progress.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initProgress'});
