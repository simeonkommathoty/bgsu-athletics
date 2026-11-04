import metadata from './registration.js';
import template from './leaderboard.html?raw';
import styles from './leaderboard.css?inline';
import {createModule} from './leaderboard.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initLB'});
