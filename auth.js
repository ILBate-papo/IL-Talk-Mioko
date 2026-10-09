(() => {
  const c=window.IL_TALK_CONFIG || {};
  const base='https://'+c.SUPABASE_PROJECT_REF+'.supabase.co';
  const key=c.SUPABASE_PUBLISHABLE_KEY || c.SUPABASE_ANON_KEY;
  const store='mioko_auth_session_v1';
  let session=null, access=null, refreshPromise=null, accessChecked=0;
  try {session=JSON.parse(sessionStorage.getItem(store)||'null');} catch {}
  const status=document.createElement('p');status.id='authStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const enter=document.querySelector('#enter');
  enter.after(status);
  const buttons=document.createElement('div');buttons.className='authActions';
  const register=document.createElement('button');register.type='button';register.className='nb';register.textContent='Criar conta';
  buttons.append(register);status.after(buttons);
  document.querySelector('#email').type='email';
  document.querySelector('#email').autocomplete='username';
  document.querySelector('#email').setAttribute('aria-label','E-mail');
  document.querySelector('#pass').autocomplete='current-password';
  document.querySelector('#pass').setAttribute('aria-label','Senha');
  const save=()=>{if(session)sessionStorage.setItem(store,JSON.stringify(session));else sessionStorage.removeItem(store);};
  const tell=text=>{status.textContent=text;};
  async function request(path,body,token) {
    const r=await fetch(base+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const d=await r.json();
    if(!r.ok) throw Error(d.reason||d.msg||d.error_description||d.error||'Não foi possível entrar.');
    return d;
  }
  async function token() {
    if(!session?.access_token)throw Error('Entre com seu e-mail e senha.');
    if((session.expires_at||0)*1000<Date.now()+60000){
      if(!refreshPromise)refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(d=>{session={...d,expires_at:Math.floor(Date.now()/1000)+d.expires_in};save();}).finally(()=>{refreshPromise=null;});
      await refreshPromise;
    }
    return session.access_token;
  }
  async function verify() {
    const t=await token();
    access=await request('/functions/v1/il-access',{},t);
    if(!access.allowed)throw Error(access.reason||'Acesso não liberado.');
    accessChecked=Date.now();
    document.querySelectorAll('[data-mode="Administração"],[data-mode="Professor"]').forEach(b=>{b.hidden=access.role!=='admin';});
    return access;
  }
  async function signIn() {
    const email=document.querySelector('#email').value.trim().toLowerCase();
    const password=document.querySelector('#pass').value;
    if(!email||!password){tell('Informe seu e-mail e senha.');return false;}
    access=null;accessChecked=0;enter.disabled=true;tell('Conferindo seu acesso…');
    try {
      const d=await request('/auth/v1/token?grant_type=password',{email,password});
      session={...d,expires_at:Math.floor(Date.now()/1000)+d.expires_in};save();
      await verify();document.querySelector('#pass').value='';tell('');return true;
    } catch(e){tell(e.message==='Invalid login credentials'?'E-mail ou senha incorretos.':e.message);return false;}
    finally{enter.disabled=false;}
  }
  register.onclick=async()=>{
    const email=document.querySelector('#email').value.trim().toLowerCase();
    const password=document.querySelector('#pass').value;
    if(!email||password.length<8){tell('Informe seu e-mail e escolha uma senha com pelo menos 8 caracteres.');return;}
    register.disabled=true;
    try{
      await request('/auth/v1/signup',{email,password});
      tell('Confira seu e-mail para confirmar o cadastro. Depois volte e entre. Criar conta não libera acesso sem pagamento; o administrador tem acesso próprio.');
      document.querySelector('#pass').value='';
    }catch(e){tell(e.message);}
    finally{register.disabled=false;}
  };
  async function signOut() {
    const old=session;session=null;access=null;accessChecked=0;save();
    if(old?.access_token)fetch(base+'/auth/v1/logout',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+old.access_token},signal:AbortSignal.timeout(10000)}).catch(()=>{});
    tell('Sessão encerrada.');
  }
  window.MiokoAuth={signIn,signOut,getToken:token,userId:()=>access?.user_id || "",hasAccess:()=>!!access?.allowed,requireAccess:async()=>{if(!access?.allowed||Date.now()-accessChecked>60000)await verify();return token();}};
  // Always show the login screen; a stored session alone never opens the course.
  document.querySelector('#app').classList.add('hide');document.querySelector('#login').classList.remove('hide');
})();
