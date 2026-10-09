import {preflight,body,json,rest} from './common.ts';
const limits=new Map<string,{count:number,until:number}>();
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 let keys:Record<string,string>={};try{keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')}catch{}
 const allowed=[...Object.values(keys),'sb_publishable_MhhBeH3lNORWekimUWuvRA_sW_ZWOUF'];
 if(!allowed.includes(req.headers.get('apikey')||''))return json({error:'Chave pública inválida'},401);
 try{
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const bytes=new TextEncoder().encode((Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'')+ip);
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);
  const current=limits.get(fingerprint)||{count:0,until:now+60000};current.count++;limits.set(fingerprint,current);
  if(current.count>45)return json({error:'Aguarde um minuto antes de tentar novamente.'},429);
  const b=await body(req);
  if(b.action==='settings'){
   const cfg=(await rest('mioko_billing_settings?id=eq.true&select=price_cents,access_days,pix_key,pix_owner,pix_bank,mercado_pago_url'))[0];return json(cfg);
  }
  if(b.action==='lead'){
   const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||name.length<1||name.length>120||b.consent!==true)return json({error:'Informe nome, e-mail e autorização para receber informações.'},400);
   await rest('mioko_leads?on_conflict=email',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({email,name,consent:true})});return json({ok:true});
  }
  if(b.action==='event'){
   const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   if(!uuid.test(b.id)||!uuid.test(b.session_id)||!['visit','checkout','apk'].includes(b.kind))return json({error:'Evento inválido'},400);
   const geo=b.geo_consent===true;
   const country=geo&&/^[A-Z]{2}$/.test(String(b.country_code||''))?b.country_code:null;
   const city=geo&&typeof b.city==='string'&&b.city.trim()?b.city.trim().slice(0,100):null;
   const path=['/','/baixar.html'].includes(b.path)?b.path:'/';
   await rest('mioko_visits?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({id:b.id,session_id:b.session_id,kind:b.kind,path,country_code:country,city,geo_consent:geo})});
   return json({ok:true});
  }
  if(b.action==='geo_update'){
   if(!uuidValue(b.id)||!uuidValue(b.session_id)||b.geo_consent!==true)return json({error:'Evento inválido'},400);
   const cc=/^[A-Z]{2}$/.test(String(b.country_code||''))?b.country_code:null;
   const city=typeof b.city==='string'&&b.city.trim()?b.city.trim().slice(0,100):null;
   await rest('mioko_visits?id=eq.'+b.id+'&session_id=eq.'+b.session_id,{method:'PATCH',body:JSON.stringify({geo_consent:true,country_code:cc,city})});return json({ok:true});
  }
  return json({error:'Ação inválida'},400);
 }catch{return json({error:'Não foi possível concluir. Tente novamente.'},503)}
});
function uuidValue(value:unknown){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
