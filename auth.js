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
  async function request(path,body,token,method='POST') {
    const r=await fetch(base+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
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
    window.dispatchEvent(new CustomEvent('mioko-auth',{detail:{role:access.role}}));
    document.querySelectorAll('[data-mode="Administração"],[data-mode="Professor"]').forEach(b=>{b.hidden=access.role!=='admin';});
    return access;
  }
  async function signIn() {
    if(recoveryToken || recoveryPending){tell('Salve a nova senha ou volte para entrar.');return false;}
    const email=document.querySelector('#email').value.trim().toLowerCase();
    const password=document.querySelector('#pass').value;
    if(!email||!password){tell('Informe seu e-mail e senha.');return false;}
    session=null;save();access=null;accessChecked=0;enter.disabled=true;tell('Conferindo seu acesso…');
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

  // Recovery tokens stay only in memory and are removed from the address bar.
  let recoveryToken='', recoveryPending=false;
  const forgot=document.createElement('button');forgot.type='button';forgot.className='nb';forgot.textContent='Esqueci minha senha';
  buttons.append(forgot);
  const recovery=document.createElement('fieldset');recovery.hidden=true;
  const title=document.createElement('legend');title.textContent='Salvar nova senha';
  const newPass=document.createElement('input');newPass.type='password';newPass.autocomplete='new-password';newPass.placeholder='Nova senha (mínimo 8 caracteres)';newPass.setAttribute('aria-label','Nova senha');
  const confirm=document.createElement('input');confirm.type='password';confirm.autocomplete='new-password';confirm.placeholder='Repita a nova senha';confirm.setAttribute('aria-label','Repita a nova senha');
  const update=document.createElement('button');update.type='button';update.className='nb';update.textContent='Salvar nova senha';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='nb';cancel.textContent='Voltar para entrar';
  recovery.append(title,newPass,confirm,update,cancel);buttons.after(recovery);
  function recoveryMode(active) {
    recovery.hidden=!active;buttons.hidden=active;buttons.style.display=active?'none':'';enter.hidden=active;
    document.querySelector('#email').disabled=active;
    document.querySelector('#pass').hidden=active;
    document.querySelector('#pass').value='';
  }
  cancel.onclick=()=>{recoveryToken='';recoveryPending=false;newPass.value='';confirm.value='';recoveryMode(false);tell('Entre com seu e-mail e senha.');};
  forgot.onclick=async()=>{
    const email=document.querySelector('#email').value.trim().toLowerCase();
    if(!email || !document.querySelector('#email').checkValidity()){tell('Informe seu e-mail no campo acima.');return;}
    forgot.disabled=true;tell('Solicitando o link…');
    try {
      const redirect=location.origin+location.pathname;
      await request('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{email});
      tell('Se houver uma conta com esse e-mail, você receberá um link. Abra apenas o e-mail mais recente para salvar uma nova senha.');
    } catch(e){tell('Não foi possível solicitar o link: '+e.message);}
    finally{forgot.disabled=false;}
  };
  update.onclick=async()=>{
    if(!recoveryToken || recoveryPending)return;
    if(newPass.value.length<8){tell('Escolha uma senha com pelo menos 8 caracteres.');return;}
    if(newPass.value!==confirm.value){tell('As duas senhas precisam ser iguais.');return;}
    update.disabled=true;cancel.disabled=true;tell('Salvando a nova senha…');
    try {
      await request('/auth/v1/user',{password:newPass.value},recoveryToken,'PUT');
      recoveryToken='';session=null;access=null;accessChecked=0;save();
      newPass.value='';confirm.value='';recoveryMode(false);
      tell('Nova senha salva. Entre agora com seu e-mail e a nova senha.');
      document.querySelector('#pass').focus();
    } catch(e){tell('Não foi possível salvar a senha. '+e.message+' Se o link expirou, volte e solicite outro.');}
    finally{update.disabled=false;cancel.disabled=false;}
  };
  async function receiveRecovery() {
    const params=new URLSearchParams(location.hash.slice(1));
    if(!params.has('access_token') && !params.has('error'))return;
    history.replaceState(null,'',location.pathname+location.search);
    if(params.has('error')){tell('O link de recuperação é inválido ou expirou. Use “Esqueci minha senha” para solicitar outro.');return;}
    if(params.get('type')!=='recovery')return;
    const candidate=params.get('access_token');
    session=null;access=null;accessChecked=0;save();
    recoveryPending=true;recoveryMode(true);update.disabled=true;
    tell('Verificando o link de recuperação…');
    try {
      const user=await request('/auth/v1/user',undefined,candidate,'GET');
      if(!user.id)throw Error('Link inválido.');
      recoveryToken=candidate;
      document.querySelector('#email').value=user.email||'';
      tell('Escolha e confirme sua nova senha. O link sozinho não altera a senha.');
      newPass.focus();
    } catch(e){recoveryMode(false);tell('Este link não pôde ser validado. Solicite outro em “Esqueci minha senha”.');}
    finally{recoveryPending=false;update.disabled=false;}
  }
  void receiveRecovery();
  window.MiokoAuth={signIn,signOut,getToken:token,userId:()=>access?.user_id || "",hasAccess:()=>!!access?.allowed,role:()=>access?.role||'',requireAccess:async()=>{if(!access?.allowed||Date.now()-accessChecked>60000)await verify();return token();}};
  // Always show the login screen; a stored session alone never opens the course.
  document.querySelector('#app').classList.add('hide');document.querySelector('#login').classList.remove('hide');
})();

