import metadata from './registration.js';
import template from './jumping.html?raw';
import styles from './jumping.css?inline';
import {createModule} from './jumping.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initJumping'});
