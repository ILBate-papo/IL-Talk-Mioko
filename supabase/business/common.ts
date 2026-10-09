export const cors={"Access-Control-Allow-Origin":"https://ilbate-papo.github.io","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};
export const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:cors});
export function preflight(req:Request){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Use POST'},405);
 if(req.headers.get('origin')&&req.headers.get('origin')!==cors['Access-Control-Allow-Origin'])return json({error:'Origem não autorizada'},403);
 return null;
}
export async function body(req:Request){const raw=await req.text();if(raw.length>5000)throw Error('Solicitação muito grande');const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Solicitação inválida');return b;}
export async function rest(path:string,options:RequestInit={}){
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';const base=Deno.env.get('SUPABASE_URL')||'';
 if(!service||!base)throw Error('Serviço indisponível');
 const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Não foi possível salvar ou consultar os dados. Confira a transação e tente novamente.');
 const raw=await r.text();return raw?JSON.parse(raw):null;
}
export async function authenticated(req:Request){
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(bearer))return null;
 const r=await fetch((Deno.env.get('SUPABASE_URL')||'')+'/auth/v1/user',{headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')||'',Authorization:bearer},signal:AbortSignal.timeout(10000)});
 if(!r.ok)return null;const u=await r.json();return u.id&&u.email&&u.email_confirmed_at&&!u.is_anonymous?u:null;
}
export function paymentUrl(value:unknown){
 const s=String(value||'').trim();if(!s)return '';
 const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!['mpago.la','mercadopago.com.br','www.mercadopago.com.br','link.mercadopago.com.br'].includes(u.hostname))throw Error('Use um link HTTPS oficial do Mercado Pago.');
 if(s.length>500)throw Error('Link muito longo');return u.href;
}
export function reference(value:unknown){const s=String(value||'').trim();if(s.length<6||s.length>120||/^[0-9\s-]{13,24}$/.test(s))throw Error('Informe o ID da transação/E2E, não o número do cartão.');return s;}
