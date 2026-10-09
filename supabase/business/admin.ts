import {checkAccess} from './access.ts';
import {preflight,body,json,rest,paymentUrl,reference} from './common.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 const access=await checkAccess(req);
 if(!access.allowed||access.role!=='admin')return json({error:'Painel disponível somente para o administrador.'},access.allowed?403:access.status);
 try{
  const b=await body(req);
  if(b.action==='snapshot')return json(await rest('rpc/mioko_business_snapshot',{method:'POST',body:JSON.stringify({p_days:[7,30,90].includes(b.days)?b.days:30})}));
  if(b.action==='settings'){
   const price=Number(b.price_cents),days=Number(b.access_days);
   if(!Number.isInteger(price)||price<100||price>10000000||!Number.isInteger(days)||days<1||days>366)return json({error:'Valor ou prazo inválido.'},400);
   const pix=String(b.pix_key||'').trim(),owner=String(b.pix_owner||'').trim(),bank=String(b.pix_bank||'').trim();
   if(pix.length>77||owner.length>120||bank.length>80||(/^[0-9]{13,19}$/.test(pix)&&pix.length!==14))return json({error:'Informe uma chave Pix, não um número de cartão.'},400);
   await rest('mioko_billing_settings?id=eq.true',{method:'PATCH',body:JSON.stringify({price_cents:price,access_days:days,pix_key:pix,pix_owner:owner,pix_bank:bank,mercado_pago_url:paymentUrl(b.mercado_pago_url),updated_at:new Date().toISOString()})});return json({ok:true});
  }
  if(b.action==='confirm_payment'){
   if(b.received_confirmed!==true)return json({error:'Confira o crédito no banco ou no Mercado Pago antes de liberar.'},400);
   if(!/^[0-9a-f-]{36}$/i.test(b.user_id)||!['pix','mercadopago'].includes(b.method))return json({error:'Cliente ou forma de pagamento inválidos.'},400);
   return json(await rest('rpc/mioko_confirm_received_payment',{method:'POST',body:JSON.stringify({p_user_id:b.user_id,p_reference:reference(b.reference),p_method:b.method,p_admin_id:access.user_id})}));
  }
  return json({error:'Ação inválida'},400);
 }catch(e){return json({error:e instanceof Error?e.message:'Não foi possível concluir.'},400)}
});
