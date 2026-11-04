// Shadow DOM isolates CSS and accidental selectors, not malicious JavaScript.
export function scopedDocument(root,ownerDocument) {
  return Object.freeze({
    getElementById:id=>root.getElementById(id),
    querySelector:selector=>root.querySelector(selector),
    querySelectorAll:selector=>root.querySelectorAll(selector),
    createElement:ownerDocument.createElement.bind(ownerDocument),
    createTextNode:ownerDocument.createTextNode.bind(ownerDocument),
    addEventListener:root.addEventListener.bind(root),
    removeEventListener:root.removeEventListener.bind(root),
    // Existing roster dialogs only need scroll locking; no shell DOM is exposed.
    body:Object.freeze({style:new Proxy({}, {
      get:(_,key)=>key==='overflow'?ownerDocument.body.style.overflow:undefined,
      set:(_,key,value)=>{if(key!=='overflow')throw new Error('Feature cannot modify document body');ownerDocument.body.style.overflow=value;return true;},
    })}),
  });
}

export function serviceDocument(document) {
  const roots=()=>[document,...[...document.querySelectorAll('#feature-content [data-feature-root]')].map(el=>el.shadowRoot).filter(Boolean)];
  return new Proxy(document, {get(target,key){
    if(key==='getElementById')return id=>roots().map(r=>r.getElementById(id)).find(Boolean)||null;
    if(key==='querySelector')return selector=>roots().map(r=>r.querySelector(selector)).find(Boolean)||null;
    if(key==='querySelectorAll')return selector=>roots().flatMap(r=>[...r.querySelectorAll(selector)]);
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
}
