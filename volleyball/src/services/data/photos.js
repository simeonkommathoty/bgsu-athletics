// Extracted from the authoritative reference; see source line annotations.
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {
const document=context.document;
const window=context.window;
const Chart=context.Chart;
const XLSX=context.XLSX;
const setTimeout=context.setTimeout;
const clearTimeout=context.clearTimeout;
const requestAnimationFrame=context.requestAnimationFrame;

// ── Private photo storage: short-lived signed URLs ───────────────
// photo_url may hold a storage object path (new uploads) or a legacy public URL.
// The stored value is never replaced by a signed URL, so signed URLs are never persisted.
const PHOTO_BUCKET='athlete-photos', SIGNED_URL_SECONDS=900;
const photoCache=new Map(); // storage path -> {url, expires}
let photoResolveQueued=false;
function photoPath(value){
  if(!value||typeof value!=='string') return null;
  if(!/^https?:\/\//i.test(value)) return value;
  const marker='/'+PHOTO_BUCKET+'/', i=value.indexOf(marker);
  if(i<0) return null;
  try{return decodeURIComponent(value.slice(i+marker.length).split('?')[0]);}catch(e){return null;}
}
// Synchronous, render-safe: a usable signed URL, or '' (caller shows initials) while one is fetched or if signing failed.
function photoSrc(athlete){
  const path=photoPath(athlete&&athlete.photo_url);
  if(!path) return '';
  const hit=photoCache.get(path);
  if(hit&&hit.expires>Date.now()) return hit.url;
  if(!photoResolveQueued){photoResolveQueued=true;Promise.resolve().then(()=>resolvePhotoUrls());}
  return '';
}
let photoResolveInflight=null;
// One request at a time: concurrent callers share the in-flight call.
function resolvePhotoUrls(){
  photoResolveQueued=false;
  if(photoResolveInflight) return photoResolveInflight;
  photoResolveInflight=resolvePhotoUrlsNow().finally(()=>{photoResolveInflight=null;});
  return photoResolveInflight;
}
async function resolvePhotoUrlsNow(){
  const sb=context.api.sb, storage=sb&&sb.storage;
  if(!sb||!context.api.currentUser||!storage||typeof storage.from!=='function') return 0;
  const bucket=storage.from(PHOTO_BUCKET);
  if(!bucket||typeof bucket.createSignedUrls!=='function') return 0;
  const now=Date.now(), paths=[];
  for(const a of context.api.ATHLETES||[]){
    const p=photoPath(a.photo_url);
    if(!p) continue;
    const hit=photoCache.get(p);
    if(hit&&hit.expires>now) continue;
    if(!paths.includes(p)) paths.push(p);
  }
  if(!paths.length) return 0;
  let resolved=0;
  try{
    const {data,error}=await bucket.createSignedUrls(paths,SIGNED_URL_SECONDS);
    if(error) throw error;
    for(const row of data||[]){
      if(row&&row.signedUrl&&!row.error){photoCache.set(row.path,{url:row.signedUrl,expires:now+(SIGNED_URL_SECONDS-60)*1000});resolved++;}
    }
  }catch(e){console.warn('Signed photo URLs unavailable:',e&&e.message||e);}
  for(const p of paths){
    const hit=photoCache.get(p);
    if(hit&&hit.expires>now) continue;
    // Signing failed for this file: never fall back to a public URL; show initials and retry later.
    photoCache.set(p,{url:'',expires:now+60000});
  }
  if(resolved){try{context.api.refreshAll();}catch(e){console.error('Photo refresh failed:',e);}}
  return resolved;
}
// ── Athlete Photo Upload ─────────────────────────────────────────
// Reference: originals/volleyball.html:6230
async function handlePhotoUpload(event, athleteId){
  const file=event.target.files[0];
  if(!file) return;
  if(!context.api.sb||!context.api.currentUser){context.api.toast('⚠ Sign in to upload photos');return;}
  if(file.size>5*1024*1024){context.api.toast('⚠ Photo must be under 5MB');return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){context.api.toast('⚠ Use JPG, PNG, or WebP');return;}

  const athlete=context.api.ATHLETES.find(a=>a.id===athleteId);
  if(!athlete){context.api.toast('⚠ Athlete not found');return;}

  context.api.setSyncStatus('syncing','UPLOADING');
  try{
    // Use canonical name + timestamp for unique filename
    const ext=file.name.split('.').pop().toLowerCase();
    const cleanName=(athlete._canonicalName||athlete.name).toLowerCase().replace(/[^a-z0-9]/g,'-');
    const filename=`${cleanName}-${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const {data:uploadData, error:uploadErr} = await context.api.sb.storage
      .from('athlete-photos')
      .upload(filename, file, {cacheControl:'3600', upsert:false});
    if(uploadErr) throw uploadErr;

    // The bucket may be private: store the object path; display uses short-lived signed URLs.
    const storedPhoto = filename;

    // Delete old photo if exists (cleanup)
    if(athlete.photo_url){
      const oldPath=photoPath(athlete.photo_url);
      if(oldPath){photoCache.delete(oldPath);context.api.sb.storage.from('athlete-photos').remove([oldPath]).catch(()=>{});}
    }

    // Update local + queue sync
    athlete.photo_url=storedPhoto;
    context.api.queueSave(athlete);
    await resolvePhotoUrls();
    context.api.refreshAll();
    context.refreshFeature('profile');
    context.api.toast('✓ Photo uploaded');
    context.api.setSyncStatus('online','SYNCED');
  } catch(e){
    console.error('Photo upload failed:',e);
    context.api.setSyncStatus('error','UPLOAD FAILED');
    context.api.toast('⚠ Upload failed: '+(e.message||'unknown'));
  }
  // Reset file input
  event.target.value='';
}


// Reference: originals/volleyball.html:6279
async function removeAthletePhoto(athleteId){
  if(!confirm('Remove this athlete\'s photo?')) return;
  if(!context.api.sb||!context.api.currentUser){context.api.toast('⚠ Sign in required');return;}
  const athlete=context.api.ATHLETES.find(a=>a.id===athleteId);
  if(!athlete||!athlete.photo_url) return;

  context.api.setSyncStatus('syncing','REMOVING');
  try{
    const oldPath=photoPath(athlete.photo_url);
    if(oldPath){
      photoCache.delete(oldPath);
      await context.api.sb.storage.from('athlete-photos').remove([oldPath]);
    }
    athlete.photo_url=null;
    context.api.queueSave(athlete);
    context.api.refreshAll();
    context.refreshFeature('profile');
    context.api.toast('✓ Photo removed');
    context.api.setSyncStatus('online','SYNCED');
  } catch(e){
    console.error('Photo removal failed:',e);
    context.api.toast('⚠ Remove failed: '+(e.message||'unknown'));
  }
}

return Object.defineProperties({}, {
  handlePhotoUpload: {enumerable:true, configurable:true, get:()=>handlePhotoUpload},
  removeAthletePhoto: {enumerable:true, configurable:true, get:()=>removeAthletePhoto},
  photoSrc: {enumerable:true, configurable:true, get:()=>photoSrc},
  resolvePhotoUrls: {enumerable:true, configurable:true, get:()=>resolvePhotoUrls},
  photoPath: {enumerable:true, configurable:true, get:()=>photoPath}
});
}
