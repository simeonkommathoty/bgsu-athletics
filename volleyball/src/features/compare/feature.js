import metadata from './registration.js';
import template from './compare.html?raw';
import styles from './compare.css?inline';
import {createModule} from './compare.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initCmp'});
