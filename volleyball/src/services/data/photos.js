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

    // Get public URL
    const {data:urlData} = context.api.sb.storage.from('athlete-photos').getPublicUrl(filename);
    const publicUrl = urlData.publicUrl;

    // Delete old photo if exists (cleanup)
    if(athlete.photo_url){
      const oldPath=athlete.photo_url.split('/athlete-photos/')[1];
      if(oldPath) context.api.sb.storage.from('athlete-photos').remove([oldPath]).catch(()=>{});
    }

    // Update local + queue sync
    athlete.photo_url=publicUrl;
    context.api.queueSave(athlete);
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
    const oldPath=athlete.photo_url.split('/athlete-photos/')[1];
    if(oldPath){
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
  removeAthletePhoto: {enumerable:true, configurable:true, get:()=>removeAthletePhoto}
});
}
