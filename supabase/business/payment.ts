import {preflight,body,json,rest,authenticated,reference} from './common.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 try{
  const user=await authenticated(req);if(!user)return json({error:'Entre com sua conta e confirme seu e-mail antes de informar o pagamento.'},401);
  const b=await body(req);if(!['pix','mercadopago'].includes(b.method))return json({error:'Forma de pagamento inválida'},400);
  const ref=reference(b.reference);
  const pending=await rest('mioko_payment_requests?select=id&status=eq.pending&user_id=eq.'+user.id);
  if(pending.length>=5)return json({error:'Você já tem pagamentos aguardando conferência.'},429);
  await rest('mioko_payment_requests?on_conflict=user_id,reference',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,reference:ref,method:b.method})});
  return json({ok:true,message:'Pagamento informado. O administrador precisa confirmar o recebimento para liberar o acesso.'});
 }catch(e){return json({error:e instanceof Error?e.message:'Não foi possível registrar.'},400)}
});
