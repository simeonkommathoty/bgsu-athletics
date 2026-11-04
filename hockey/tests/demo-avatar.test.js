import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {services} from './support.js';
import {buildDemoTables} from '../src/services/demo/demo-data.js';
import {DEMO_AVATAR} from '../src/services/demo/demo-avatar.js';

test('every synthetic athlete shares one embedded avatar (no URL, no request)',()=>{
  const {athletes}=buildDemoTables(new Date('2026-03-01'));
  assert.ok(athletes.length>=10);
  for(const a of athletes) assert.equal(a.photo_url,DEMO_AVATAR);
  assert.match(DEMO_AVATAR,/^data:image\/svg\+xml;charset=utf-8,/);
  assert.doesNotMatch(decodeURIComponent(DEMO_AVATAR).replace('xmlns="http://www.w3.org/2000/svg"',''),/https?:|<script|<image|href=/i);
});
test('avatar module and demo data make no network or storage calls',()=>{
  const src=fs.readFileSync(new URL('../src/services/demo/demo-avatar.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
  assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|import\.meta\.env|localStorage|https?:\/\/(?!www\.w3\.org)/);
});
test('Demo Mode renders the avatar; missing photo falls back to initials; the data URI is ignored outside Demo Mode',()=>{
  const demo=services({window:{location:{hash:'#demo'}}}).api;
  const a={id:0,name:'Demo One',photo_url:DEMO_AVATAR,av:'a1',initials:'DO'};
  assert.match(demo.ava(a),/av-photo.*data:image\/svg\+xml/);
  assert.match(demo.ava({...a,photo_url:null}),/>DO</);
  const live=services().api;           // not Demo Mode: production photo path (signed URLs) is used
  assert.doesNotMatch(live.ava(a),/data:image|av-photo/);assert.match(live.ava(a),/>DO</);
});
