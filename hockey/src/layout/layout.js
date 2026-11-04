import template from './shell.html?raw';
import {createErrorHandler} from './error-handler.js';
import './layout.css';

export function createLayout(root) {
  root.innerHTML=template;
  const sidebar=root.querySelector('#feature-nav');
  const main=root.querySelector('#feature-content');
  const title=root.querySelector('#tb-title');
  const errors=root.querySelector('#feature-errors');
  const report=createErrorHandler(errors);
  let active=null, features=[], context, requested=0, queue=Promise.resolve();
  const cancelled=Symbol('cancelled');
  const pending=(operation,record)=>Promise.race([Promise.resolve(operation),record.cancelled.then(()=>cancelled)]);

  async function dispose(record) {
    if(!record)return;
    try{await record.feature?.unmount?.();}catch(error){report(`${record.id}:cleanup`,error);}
    finally{record.host.remove();}
  }
  async function navigateTo(id,version) {
    if(version!==requested)return false;
    const registration=features.find(f=>f.id===id);
    if(!registration){report('navigation',new Error(`Unknown feature: ${id}`));return false;}
    await dispose(active); active=null;
    if(version!==requested)return false;
    errors.replaceChildren();
    title.textContent=registration.title;
    sidebar.querySelectorAll('[data-feature]').forEach(el=>el.classList.toggle('active',el.dataset.feature===id));
    const host=document.createElement('section');host.dataset.feature=id;main.replaceChildren(host);
    const record={id,host,feature:null};
    record.cancelled=new Promise(resolve=>{record.cancel=resolve;});
    active=record;
    try {
      const feature=await pending(registration.load(),record);
      if(feature===cancelled){await dispose(record);if(active===record)active=null;return false;}
      record.feature=feature;
      if(version!==requested){await dispose(record);if(active===record)active=null;return false;}
      const mounted=await pending(record.feature.mount(host,context),record);
      if(mounted===cancelled){await dispose(record);if(active===record)active=null;return false;}
      if(version!==requested){await dispose(record);if(active===record)active=null;return false;}
      context.onNavigation?.(id);
      return true;
    }catch(error){
      await dispose(record);if(active===record)active=null;
      report(id,error,()=>navigate(id));return false;
    }
  }
  function navigate(id) {
    const version=++requested;
    active?.cancel?.();
    const operation=queue.then(()=>navigateTo(id,version));
    queue=operation.catch(error=>report('navigation',error));
    return operation;
  }
  function refreshFeature(id) {
    if(active?.id===id)return active.feature?.refresh?.();
  }
  return {
    report,navigate,refreshFeature,
    get activeId(){return active?.id;},
    async start(registry,appContext) {
      features=registry;context=appContext;
      let lastSection;
      for(const feature of features){
        if(feature.section && feature.section!==lastSection){const section=document.createElement('div');section.className='nav-sec';section.textContent=feature.section;sidebar.append(section);lastSection=feature.section;}
        const item=document.createElement('button');item.className='nav-item';item.dataset.feature=feature.id;item.type='button';
        // Icons are local source modules, not user/server-provided markup.
        item.innerHTML=feature.icon;
        item.append(document.createTextNode(feature.label||feature.title));
        if(feature.badgeId){const badge=document.createElement('span');badge.id=feature.badgeId;badge.className='nav-badge';item.append(badge);}
        item.addEventListener('click',()=>navigate(feature.id));sidebar.append(item);
      }
      if(features.length)await navigate(features[0].id);
    },
    async destroy(){++requested;active?.cancel?.();await queue;await dispose(active);active=null;root.replaceChildren();},
  };
}
