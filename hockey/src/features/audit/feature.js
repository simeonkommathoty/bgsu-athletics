import metadata from './registration.js';
import template from './audit.html?raw';
import styles from './audit.css?inline';
import {createModule} from './audit.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'loadAuditLog'});
