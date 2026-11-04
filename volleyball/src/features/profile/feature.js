import metadata from './registration.js';
import template from './profile.html?raw';
import styles from './profile.css?inline';
import {createModule} from './profile.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initProfile'});
