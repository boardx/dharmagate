import {createFilmLibrary} from './film-library.mjs';

// Update the catalogue above an already deployed Worker without repeating its
// navigation transforms or changing its other routes, bindings or assets.
export function withFilmCatalogue(currentWorker) {
 if(typeof currentWorker?.fetch!=='function')throw new TypeError('A current Worker is required');
 const library=createFilmLibrary();
 return {async fetch(request,env,ctx){
  const response=library.fetch(request);
  return response??currentWorker.fetch(request,env,ctx);
 }};
}
