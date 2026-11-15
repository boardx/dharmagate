import { createEvidenceSearchHandler } from './http.mjs';

/** Compose an admitted source service without replacing any legacy routes/assets.
 * No configuration is inferred from env, filesystem, display grants or private data.
 */
export function createRetainedSearchWorker({ currentWorker, admittedSearch, scopeLabel } = {}) {
  if (typeof currentWorker?.fetch !== 'function') throw Error('RETAINED_WORKER_REQUIRED');
  if (admittedSearch && (admittedSearch.scope?.kind !== 'explicit-public-canon-subset' || admittedSearch.scope?.rag !== false || admittedSearch.scope?.embedding !== false || admittedSearch.service?.capabilities?.keyword !== true)) throw Error('ADMITTED_SEARCH_REQUIRED');
  const owned = admittedSearch ? createEvidenceSearchHandler({service:admittedSearch.service,enabled:true,scopeLabel}) : null;
  return Object.freeze({async fetch(request, env, ctx) {
    if (owned) { const response=await owned.fetch(request); if(response!==null)return response; }
    return currentWorker.fetch(request,env,ctx);
  }});
}
