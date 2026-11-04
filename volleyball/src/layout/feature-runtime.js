import commonStyles from '../styles/reference.css?inline';
import {scopedDocument} from './dom-scope.js';
import {bindEvents} from './events.js';

export function createFeature(metadata,definition) {
  let element,root,context,module,controller,active=false,registered=false,generation=0;
  const timers=new Set(),frames=new Set();
  function clearResources(){
    controller?.abort();
    for(const timer of timers)globalThis.clearTimeout(timer);timers.clear();
    for(const frame of frames)globalThis.cancelAnimationFrame(frame);frames.clear();
    if(root)for(const canvas of root.querySelectorAll('canvas')){
      try{context.api.kc(canvas.id);}catch(error){delete context.api.CH[canvas.id];context.report(`${metadata.id}:chart-cleanup`,error);}
    }
    if(registered){for(const key of Object.keys(module))delete context.api[key];registered=false;}
    if(context?.document.body)context.document.body.style.overflow='';
  }
  async function initialize(version=generation){
    if(definition.beforeMount)await definition.beforeMount(context);
    if(!active||version!==generation)return;
    return module[definition.initialize]();
  }
  return {
    ...metadata,
    async mount(container,appContext){
      if(context && context.api!==appContext.api){
        clearResources();element=undefined;root=undefined;module=undefined;context=undefined;
      }
      const version=++generation;
      active=true;controller=new AbortController();
      if(!element){
        element=container.ownerDocument.createElement('div');element.dataset.featureRoot=metadata.id;
        root=element.attachShadow({mode:'open'});
        root.innerHTML=`<style>${commonStyles}\n${definition.styles}</style>${definition.template}`;
        context={...appContext,window:Object.freeze({}),document:scopedDocument(root,container.ownerDocument),
          get signal(){return controller.signal;},
          setTimeout:(callback,delay,...args)=>{const timer=globalThis.setTimeout(()=>{timers.delete(timer);if(active){try{Promise.resolve(callback(...args)).catch(error=>context.report(`${metadata.id}:timer`,error));}catch(error){context.report(`${metadata.id}:timer`,error);}}},delay);timers.add(timer);return timer;},
          clearTimeout:timer=>{timers.delete(timer);globalThis.clearTimeout(timer);},
          requestAnimationFrame:callback=>{const frame=globalThis.requestAnimationFrame(time=>{frames.delete(frame);if(active)callback(time);});frames.add(frame);return frame;},
        };
        module=definition.createModule(context);
      }
      for(const key of Object.keys(module))if(Object.hasOwn(context.api,key))throw new Error(`Feature action collides with an existing service: ${key}`);
      Object.defineProperties(context.api,Object.getOwnPropertyDescriptors(module));
      registered=true;
      container.append(element);
      bindEvents(root,context,error=>context.report(`${metadata.id}:interaction`,error),controller.signal);
      try{await initialize(version);}catch(error){if(version===generation){active=false;clearResources();}throw error;}
    },
    async refresh(){if(active){try{await initialize();}catch(error){context.report(`${metadata.id}:refresh`,error);}}},
    unmount(){++generation;active=false;clearResources();element?.remove();if(!module){element=undefined;root=undefined;context=undefined;}},
  };
}
