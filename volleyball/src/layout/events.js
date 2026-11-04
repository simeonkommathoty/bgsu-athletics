import {parse} from 'acorn';

// Compatibility for the reference's small inline-handler language, without eval
// or global functions. The DOM stores inert data attributes. Only known actions
// and the feature's scoped document are available to an event expression.
const cache=new Map();
const blocked=new Set(['__proto__','prototype','constructor']);
function member(node,scope) {
  const object=evaluate(node.object,scope);
  const key=node.computed?evaluate(node.property,scope):node.property.name;
  if(blocked.has(key))throw new Error('Unsupported event property');
  return {object,key};
}
function evaluate(node,scope) {
  switch(node.type){
    case 'Program':case 'BlockStatement':{let result;for(const statement of node.body)result=evaluate(statement,scope);return result;}
    case 'ExpressionStatement':return evaluate(node.expression,scope);
    case 'Literal':return node.value;
    case 'ThisExpression':return scope.element;
    case 'Identifier':{
      if(Object.hasOwn(scope.locals,node.name))return scope.locals[node.name];
      if(Object.hasOwn(scope.actions,node.name))return scope.actions[node.name];
      throw new Error(`Unknown event action: ${node.name}`);
    }
    case 'MemberExpression':{const {object,key}=member(node,scope);return object[key];}
    case 'CallExpression':{
      const args=node.arguments.map(arg=>evaluate(arg,scope));
      if(node.callee.type==='MemberExpression'){const {object,key}=member(node.callee,scope);return object[key](...args);}
      return evaluate(node.callee,scope)(...args);
    }
    case 'AssignmentExpression':{
      if(node.operator!=='='||node.left.type!=='MemberExpression')throw new Error('Unsupported event assignment');
      const {object,key}=member(node.left,scope);return object[key]=evaluate(node.right,scope);
    }
    case 'IfStatement':return evaluate(node.test,scope)?evaluate(node.consequent,scope):node.alternate?evaluate(node.alternate,scope):undefined;
    case 'BinaryExpression':{
      const left=evaluate(node.left,scope),right=evaluate(node.right,scope);
      if(node.operator==='===')return left===right;
      if(node.operator==='!==')return left!==right;
      throw new Error(`Unsupported event operator: ${node.operator}`);
    }
    default:throw new Error(`Unsupported event expression: ${node.type}`);
  }
}
export function runHandler(code,{element,event,document,actions,navigate}) {
  if(!cache.has(code)){if(cache.size>1000)cache.clear();cache.set(code,parse(code,{ecmaVersion:2022}));}
  return evaluate(cache.get(code),{element,actions,locals:{event,document,nav:navigate}});
}
export function bindEvents(root,context,onError,signal) {
  for(const name of ['click','change','input','keydown','mouseover','mouseout','mouseenter','mouseleave','blur','focus']){
    const capture=['mouseenter','mouseleave','blur','focus'].includes(name);
    root.addEventListener(name,event=>{
      const path=event.composedPath();
      for(const element of path){
        if(element===root)break;
        // A document-level binding must never process a feature's handlers.
        if(element.getRootNode?.()!==root && root.nodeType===9)continue;
        if(capture && element!==event.target)continue;
        const code=element.getAttribute?.(`data-on${name}`);
        if(!code)continue;
        try{Promise.resolve(runHandler(code,{element,event,document:context.document,actions:context.api,navigate:context.navigate})).catch(onError);}catch(error){onError(error);}
        if(event.cancelBubble)break;
      }
    },{capture,signal});
  }
}
