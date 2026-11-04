import {serviceFactories} from './modules.js';

export function createServices(dependencies) {
  const context={api:Object.create(null),...dependencies};
  for(const service of serviceFactories){
    try{Object.defineProperties(context.api,Object.getOwnPropertyDescriptors(service.create(context)));}
    catch(error){context.report(service.id,error);}
  }
  return context;
}
