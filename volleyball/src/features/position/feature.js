import metadata from './registration.js';
import template from './position.html?raw';
import styles from './position.css?inline';
import {createModule} from './position.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initPos'});
