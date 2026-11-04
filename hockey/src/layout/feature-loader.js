export function validateMetadata(value) {
  if(!value || !/^[a-z][a-z0-9-]*$/.test(value.id) || typeof value.title!=='string' || !value.title.trim() || typeof value.icon!=='string' || !Number.isFinite(value.order)) {
    throw new Error('Invalid feature metadata: expected id, title, icon and numeric order');
  }
  return Object.freeze({...value});
}

// Metadata modules must contain data only. Feature implementations are separate chunks.
export async function discoverFeatures(registrations,implementations,onError=()=>{}) {
  const features=[];
  const entries=await Promise.all(Object.entries(registrations).map(async ([file,load])=>{
    try {
      const metadata=validateMetadata((await load()).default);
      const directory=file.slice(0,file.lastIndexOf('/'));
      if(directory.split('/').at(-1)!==metadata.id)throw new Error('Feature id must match its folder');
      const loader=implementations[`${directory}/feature.js`];
      if(!loader)throw new Error('Missing feature.js');
      return {...metadata,load:async()=>{
        const feature=(await loader()).default;
        if(feature?.id!==metadata.id || typeof feature.mount!=='function' || (feature.unmount && typeof feature.unmount!=='function'))throw new Error('Invalid feature mount/unmount contract');
        return feature;
      }};
    }catch(error){onError(file,error);return null;}
  }));
  for(const entry of entries.filter(Boolean).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))) {
    if(features.some(f=>f.id===entry.id)){onError(entry.id,new Error('Duplicate feature id'));continue;}
    features.push(entry);
  }
  return features;
}
