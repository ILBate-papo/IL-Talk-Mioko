const origins = new Set(['https://ilbate-papo.github.io', 'https://mioko.il-talk.com.br']);
export function serveWithOrigins(handler: (req: Request) => Response | Promise<Response>) {
  return Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin');
    const headers = new Headers({
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store', 'Vary': 'Origin'
    });
    if (origin && !origins.has(origin)) {
      return new Response(JSON.stringify({error:'Origem não autorizada'}), {status:403,headers:{'Content-Type':'application/json','Vary':'Origin'}});
    }
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') return new Response(null, {status:204,headers});
    // Existing handlers validate the legacy origin. Normalize only after the exact allowlist check.
    const forwarded = new Headers(req.headers);
    if (origin) forwarded.set('origin', 'https://ilbate-papo.github.io');
    const response = await handler(new Request(req, {headers:forwarded}));
    const outgoing = new Headers(response.headers);
    outgoing.delete('Access-Control-Allow-Origin');
    headers.forEach((value,key)=>outgoing.set(key,value));
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:outgoing});
  });
}

