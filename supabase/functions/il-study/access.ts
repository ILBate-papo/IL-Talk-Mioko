export async function checkAccess(req: Request) {
  const header = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(header)) return {allowed:false,status:401,reason:'Entre com seu e-mail e senha.'};
  const base = Deno.env.get('SUPABASE_URL') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!base || !anon || !service) return {allowed:false,status:503,reason:'Acesso temporariamente indisponível.'};
  try {
    const auth = await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:header},signal:AbortSignal.timeout(10000)});
    if (!auth.ok) return {allowed:false,status:401,reason:'Sua sessão expirou. Entre novamente.'};
    const user = await auth.json();
    if (!user.id || !user.email || !user.email_confirmed_at || user.is_anonymous) return {allowed:false,status:403,reason:'Confirme seu e-mail antes de entrar.'};
    const h={apikey:service,Authorization:'Bearer '+service};
    const email=String(user.email).toLowerCase();
    const admin = await fetch(base+'/rest/v1/mioko_admin_accounts?select=email&email=eq.'+encodeURIComponent(email),{headers:h,signal:AbortSignal.timeout(10000)});
    if(!admin.ok) return {allowed:false,status:503,reason:'Não foi possível verificar seu acesso.'};
    if((await admin.json()).length) return {allowed:true,status:200,role:'admin',user_id:user.id,email};
    const sub=await fetch(base+'/rest/v1/mioko_subscriptions?select=status,paid_until,payment_reference&user_id=eq.'+encodeURIComponent(user.id),{headers:h,signal:AbortSignal.timeout(10000)});
    if(!sub.ok) return {allowed:false,status:503,reason:'Não foi possível verificar sua assinatura.'};
    const row=(await sub.json())[0];
    const allowed=row?.status==='paid' && !!row.payment_reference && Date.parse(row.paid_until)>Date.now();
    return {allowed,status:allowed?200:403,role:'member',user_id:user.id,email,paid_until:row?.paid_until || null,reason:allowed?'':'Seu acesso aguarda confirmação de pagamento ou renovação.'};
  } catch { return {allowed:false,status:503,reason:'Não foi possível verificar seu acesso. Tente novamente.'}; }
}


