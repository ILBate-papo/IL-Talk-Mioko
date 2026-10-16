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
  const register=document.createElement('button');register.type='button';register.className='nb';register.id='openRegistration';register.textContent='Criar minha conta';register.setAttribute('aria-expanded','false');register.setAttribute('aria-controls','miokoRegistration');
  buttons.append(register);status.after(buttons);
  const registration=document.createElement('form');registration.id='miokoRegistration';registration.hidden=true;
  const heading=document.createElement('h2');heading.textContent='Crie sua conta na Mioko';heading.tabIndex=-1;
  const help=document.createElement('p');help.textContent='Use seu e-mail e escolha uma senha. Esta é a conta das aulas, separada da conta Mercado Pago.';
  registration.append(heading,help);
  function field(id,label,type,autocomplete){const l=document.createElement('label');l.htmlFor=id;l.textContent=label;const input=document.createElement('input');input.id=id;input.type=type;input.autocomplete=autocomplete;input.required=true;registration.append(l,input);return input;}
  const signupEmail=field('signupEmail','Seu e-mail','email','email');signupEmail.maxLength=254;
  const signupPassword=field('signupPassword','Crie uma senha (mínimo 8 caracteres)','password','new-password');signupPassword.minLength=8;
  const signupConfirm=field('signupConfirm','Repita a senha','password','new-password');signupConfirm.minLength=8;
  const create=document.createElement('button');create.type='submit';create.className='nb';create.textContent='Cadastrar e confirmar e-mail';
  const back=document.createElement('button');back.type='button';back.className='nb';back.textContent='Voltar para entrar';
  const signupStatus=document.createElement('p');signupStatus.setAttribute('role','status');signupStatus.setAttribute('aria-live','polite');
  registration.append(create,back,signupStatus);buttons.after(registration);
  const loginFields=[document.querySelector('#email'),document.querySelector('.miokoPasswordField')||document.querySelector('#pass'),enter,buttons,document.querySelector('.seoAccess')].filter(Boolean);
  function showRegistration(show){registration.hidden=!show;register.setAttribute('aria-expanded',String(show));loginFields.forEach(e=>e.hidden=show);status.textContent='';if(show){signupEmail.value=document.querySelector('#email').value;heading.focus();}else{signupPassword.value=signupConfirm.value='';document.querySelector('#email').focus();}}
  register.onclick=()=>showRegistration(true);back.onclick=()=>showRegistration(false);
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
    window.dispatchEvent(new CustomEvent('mioko-auth',{detail:{role:access.role}}));
    document.querySelectorAll('[data-mode="Administração"],[data-mode="Professor"]').forEach(b=>{b.hidden=access.role!=='admin';});
    return access;
  }
  async function signIn() {
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
  registration.onsubmit=async e=>{
    e.preventDefault();
    const email=signupEmail.value.trim().toLowerCase(),password=signupPassword.value;
    if(!registration.reportValidity())return;
    if(password!==signupConfirm.value){signupStatus.textContent='As senhas estão diferentes. Digite a mesma senha nos dois campos.';signupConfirm.focus();return;}
    create.disabled=true;signupStatus.textContent='Criando sua conta…';
    try{
      await request('/auth/v1/signup',{email,password});
      document.querySelector('#email').value=email;document.querySelector('#pass').value='';showRegistration(false);
      tell('Cadastro enviado. Abra seu e-mail e confirme o cadastro (confira também o spam). Depois volte, entre e escolha como pagar. As aulas são liberadas após a conferência do pagamento.');
    }catch(e){signupStatus.textContent=e.message;}
    finally{create.disabled=false;}
  };
  async function signOut() {
    const old=session;session=null;access=null;accessChecked=0;save();
    if(old?.access_token)fetch(base+'/auth/v1/logout',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+old.access_token},signal:AbortSignal.timeout(10000)}).catch(()=>{});
    tell('Sessão encerrada.');
  }
  window.MiokoAuth={signIn,signOut,getToken:token,userId:()=>access?.user_id || "",hasAccess:()=>!!access?.allowed,role:()=>access?.role||'',requireAccess:async()=>{if(!access?.allowed||Date.now()-accessChecked>60000)await verify();return token();}};
  // Always show the login screen; a stored session alone never opens the course.
  document.querySelector('#app').classList.add('hide');document.querySelector('#login').classList.remove('hide');
})();

