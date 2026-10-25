/** Additive home integration. Every legacy path keeps its original Request/env/ctx. */
export function createRouter(legacy, landingHtml) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const isLanding = url.pathname === '/' || url.pathname === '/bodi' || url.pathname === '/bodi/';
      const isDocument = !request.headers.has('rsc') && !request.headers.has('next-router-state-tree');
      if (isLanding && isDocument && (request.method === 'GET' || request.method === 'HEAD')) {
        return new Response(request.method === 'HEAD' ? null : landingHtml, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
          },
        });
      }
      return legacy.fetch(request, env, ctx);
    },
  };
}
