import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';

const BUCKET='athlete-photos';
function setup({signed,throwSign=false,rowError=false}={}){
  const {api}=services();const calls={sign:[],remove:[],upload:[],publicUrl:0};
  api.currentUser={id:'synthetic-coach'};
  api.sb={storage:{from(name){assert.equal(name,BUCKET);return {
    async createSignedUrls(paths,ttl){calls.sign.push({paths:[...paths],ttl});if(throwSign)throw new Error('storage unavailable');
      return {data:paths.map(path=>rowError?{path,error:'not found',signedUrl:null}:{path,signedUrl:`https://signed.invalid/${path}?token=t`}),error:null};},
    async upload(file,body){calls.upload.push(file);return {data:{path:file},error:null};},
    async remove(paths){calls.remove.push(...paths);return {data:[],error:null};},
    getPublicUrl(){calls.publicUrl++;return {data:{publicUrl:'https://public.invalid/x'}};}};}}};
  api.ATHLETES=signed||[];
  return {api,calls};
}
test('photoPath accepts storage paths, legacy public URLs (with query) and rejects other values',()=>{
  const {api}=setup();
  assert.equal(api.photoPath('synthetic-a-1.png'),'synthetic-a-1.png');
  assert.equal(api.photoPath('https://x.invalid/storage/v1/object/public/athlete-photos/synthetic-a-1.png'),'synthetic-a-1.png');
  assert.equal(api.photoPath('https://x.invalid/storage/v1/object/public/athlete-photos/a%20b.png?t=1'),'a b.png');
  assert.equal(api.photoPath('https://x.invalid/other/file.png'),null);
  assert.equal(api.photoPath(null),null);assert.equal(api.photoPath(''),null);
});
test('signed URLs are batched, deduplicated, short-lived, and never written back to the athlete',async()=>{
  const athletes=[{id:0,name:'Synthetic One',photo_url:'one.png'},{id:1,name:'Synthetic Two',photo_url:'https://x.invalid/object/public/athlete-photos/two.png'},{id:2,name:'Synthetic Three',photo_url:'one.png'},{id:3,name:'No Photo',photo_url:null}];
  const {api,calls}=setup({signed:athletes});
  assert.equal(api.photoSrc(athletes[0]),'');                      // not resolved yet: caller shows initials
  assert.equal(await api.resolvePhotoUrls(),2);
  assert.equal(calls.sign.length,1);assert.deepEqual(calls.sign[0].paths.sort(),['one.png','two.png']);assert.ok(calls.sign[0].ttl<=900);
  assert.match(api.photoSrc(athletes[0]),/^https:\/\/signed\.invalid\/one\.png\?token=/);
  assert.match(api.photoSrc(athletes[1]),/two\.png/);
  assert.equal(api.photoSrc(athletes[3]),'');
  assert.equal(athletes[0].photo_url,'one.png');assert.match(athletes[1].photo_url,/^https:\/\/x\.invalid/); // stored values untouched
  assert.equal(await api.resolvePhotoUrls(),0);assert.equal(calls.sign.length,1); // cached, no second request
});
test('a public URL is never displayed: failed or per-file-failed signing shows initials, and retries later',async()=>{
  const legacy='https://x.invalid/object/public/athlete-photos/old.png';
  for(const opts of [{throwSign:true},{rowError:true}]){
    const a={id:0,name:'S',photo_url:legacy,av:'a1',initials:'SO'};
    const t=setup({signed:[a],...opts});
    assert.equal(await t.api.resolvePhotoUrls(),0);
    assert.equal(t.api.photoSrc(a),'');
    assert.doesNotMatch(t.api.ava(a),/x\.invalid|av-photo/);assert.match(t.api.ava(a),/>SO</);
    assert.equal(a.photo_url,legacy);               // stored value untouched, still convertible
  }
});
test('nothing is requested when signed out or when the backend has no storage (Demo Mode)',async()=>{
  const t=setup({signed:[{id:0,name:'S',photo_url:'a.png'}]});
  t.api.currentUser=null;assert.equal(await t.api.resolvePhotoUrls(),0);assert.equal(t.calls.sign.length,0);
  t.api.currentUser={id:'x'};t.api.sb={};assert.equal(await t.api.resolvePhotoUrls(),0);
});
test('avatars show initials until a signed URL exists, then the photo',async()=>{
  const a={id:0,name:'Synthetic One',photo_url:'one.png',av:'a1',initials:'SO'};
  const {api}=setup({signed:[a]});
  assert.match(api.ava(a),/>SO</);await api.resolvePhotoUrls();
  assert.match(api.ava(a),/av-photo.*signed\.invalid\/one\.png/);
});
test('upload stores the object path (no public URL); removal deletes by path',async()=>{
  const a={id:0,name:'Synthetic One',_canonicalName:'Synthetic One',photo_url:'https://x.invalid/object/public/athlete-photos/prev.png'};
  const {api,calls}=setup({signed:[a]});
  await api.handlePhotoUpload({target:{files:[{name:'p.png',size:10,type:'image/png'}],value:'x'}},0);
  assert.equal(calls.publicUrl,0);assert.match(api.ATHLETES[0].photo_url,/^synthetic-one-\d+\.png$/);
  assert.deepEqual(calls.remove,['prev.png']);assert.match(api.photoSrc(a),/signed\.invalid/);
  globalThis.confirm=()=>true;await api.removeAthletePhoto(0);
  assert.equal(api.ATHLETES[0].photo_url,null);assert.equal(calls.remove.at(-1).startsWith('synthetic-one-'),true);
});
