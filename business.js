(() => {
  const c=window.IL_TALK_CONFIG||{};
  const base='https://'+c.SUPABASE_PROJECT_REF+'.supabase.co';
  const key=c.SUPABASE_PUBLISHABLE_KEY||c.SUPABASE_ANON_KEY;
  if(!key)return;
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  async function call(fn,payload,token){
    const r=await fetch(base+'/functions/v1/'+fn,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload),keepalive:true,signal:AbortSignal.timeout(15000)});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível concluir.');return d;
  }
  let visitor;
  try{visitor=JSON.parse(sessionStorage.getItem('mioko_visitor_session')||'null')}catch{}
  if(!visitor||!visitor.id||Date.now()-visitor.last>30*60*1000)visitor={id:crypto.randomUUID(),last:Date.now()};
  visitor.last=Date.now();try{sessionStorage.setItem('mioko_visitor_session',JSON.stringify(visitor))}catch{}
  const visitId=crypto.randomUUID(),path=location.pathname.endsWith('/baixar.html')?'/baixar.html':'/';
  let geo=null;
  async function event(kind){
    return call('il-public',{action:'event',id:kind==='visit'?visitId:crypto.randomUUID(),session_id:visitor.id,kind,path,geo_consent:!!geo,country_code:geo?.country_code,city:geo?.city});
  }
  const visitSent=event('visit').catch(()=>{});
  async function locate(){
    try{
      const r=await fetch('https://get.geojs.io/v1/ip/geo.json',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});
      if(!r.ok)return;const d=await r.json();
      geo={country_code:/^[A-Z]{2}$/.test(d.country_code)?d.country_code:null,city:typeof d.city==='string'?d.city.slice(0,100):null};
      await visitSent;
      await call('il-public',{action:'geo_update',id:visitId,session_id:visitor.id,geo_consent:true,...geo});
    }catch{}
  }
  function geoChoice(){
    if(document.getElementById('miokoGeoChoice'))return;
    const box=node('aside',null,'miokoGeoChoice');box.id='miokoGeoChoice';box.setAttribute('aria-label','Preferência de localização aproximada');
    const text=node('p','Contamos os acessos ao IL Talk Mioko. Você permite consultar o GeoJS para estimar sua cidade e país pelo endereço IP? Guardamos apenas cidade e país, sem o IP ou coordenadas. Isso é opcional.');
    const policy=node('a','Privacidade');policy.href='privacidade.html';
    const yes=node('button','Permitir cidade e país'),no=node('button','Não permitir');
    yes.type=no.type='button';
    yes.onclick=()=>{try{localStorage.setItem('mioko_geo_consent','yes')}catch{}box.remove();locate();};
    no.onclick=()=>{try{localStorage.setItem('mioko_geo_consent','no')}catch{}box.remove();};
    box.append(text,policy,node('br'),yes,no);document.body.append(box);
  }
  let choice='';try{choice=localStorage.getItem('mioko_geo_consent')||''}catch{}
  if(choice==='yes')locate();else if(!choice)geoChoice();
  document.addEventListener('click',e=>{if(e.target.closest?.('a[href$=".apk"]'))event('apk').catch(()=>{});});
  const card=document.querySelector('#login .loginCard');
  if(!card)return;
  const box=node('section',null,'miokoCommerce');box.id='miokoCommerce';
  const status=node('p',null,'commerceStatus');status.setAttribute('role','status');
  box.append(node('h2','Comece a conversar com a Mioko'),node('p','Crie sua conta, confirme o e-mail e pague para liberar seu acesso.'));
  const billing=node('div');box.append(billing);
  card.insertBefore(box,document.getElementById("miokoPublicInfo"));
  call('il-public',{action:'settings'}).then(cfg=>{
    const price=node('p',money(cfg.price_cents),'price');
    const duration=node('p','Pagamento único para '+cfg.access_days+' dias de acesso. Para renovar, faça um novo pagamento.','subtle');
    billing.append(price,duration);
    if(cfg.mercado_pago_url){
      try{const u=new URL(cfg.mercado_pago_url);if(u.protocol==='https:'&&['mpago.la','mercadopago.com.br','www.mercadopago.com.br','link.mercadopago.com.br'].includes(u.hostname)){
        const link=node('a','Pagar pelo Mercado Pago','payLink');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';link.onclick=()=>event('checkout').catch(()=>{});billing.append(link);
      }}catch{}
    }
    if(cfg.pix_key){
      billing.append(node('h3','Pagar por Pix'),node('p','Favorecido: '+cfg.pix_owner+' · '+cfg.pix_bank));
      const label=node('label','Chave Pix');label.htmlFor='miokoPixKey';const pix=node('input');pix.id='miokoPixKey';pix.value=cfg.pix_key;pix.readOnly=true;
      const copy=node('button','Copiar chave Pix');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(cfg.pix_key);status.textContent='Chave copiada. Faça um Pix de '+money(cfg.price_cents)+' e confira o favorecido no seu banco.';event('checkout').catch(()=>{});}catch{pix.focus();pix.select();status.textContent='Selecione e copie a chave Pix acima.';}};
      billing.append(label,pix,copy,node('p','Confira o favorecido no aplicativo do banco antes de confirmar o Pix. Depois informe o ID da transação abaixo.','subtle'));
    }
    const details=node('details'),summary=node('summary','Já paguei — informar transação');
    const explanation=node('p','Entre com sua conta no botão ENTRAR, mesmo se o acesso ainda estiver aguardando pagamento. Depois informe a transação. O acesso será liberado após a conferência do recebimento.','subtle');
    const method=node('select');method.id='miokoPaymentMethod';method.append(new Option('Pix','pix'),new Option('Mercado Pago','mercadopago'));
    const ml=node('label','Forma de pagamento');ml.htmlFor=method.id;
    const ref=node('input');ref.id='miokoPaymentReference';ref.maxLength=120;ref.placeholder='ID da transação/E2E (não número de cartão)';
    const rl=node('label','ID da transação');rl.htmlFor=ref.id;
    const submit=node('button','Enviar para conferência');submit.type='button';
    submit.onclick=async()=>{submit.disabled=true;try{const token=await window.MiokoAuth?.getToken();if(!token)throw Error('Entre com seu e-mail e senha antes de informar o pagamento.');const result=await call('il-payment',{method:method.value,reference:ref.value},token);status.textContent=result.message;ref.value='';}catch(e){status.textContent=e.message;}finally{submit.disabled=false;}};
    details.append(summary,explanation,ml,method,rl,ref,submit);billing.append(details,status);
  }).catch(()=>{box.append(node('p','Não foi possível carregar as formas de pagamento. Atualize a página para tentar novamente.'));});
  const leads=node('details'),ls=node('summary','Quero receber informações sobre o IL Talk Mioko');
  const name=node('input');name.id='miokoLeadName';name.placeholder='Seu nome';name.maxLength=120;name.autocomplete='name';
  const email=node('input');email.id='miokoLeadEmail';email.type='email';email.placeholder='Seu e-mail';email.autocomplete='email';email.maxLength=254;
  const consent=node('input');consent.id='miokoLeadConsent';consent.type='checkbox';
  const nl=node('label','Nome');nl.htmlFor=name.id;const el=node('label','E-mail');el.htmlFor=email.id;
  const cl=node('label');cl.htmlFor=consent.id;cl.append(consent,document.createTextNode('Autorizo receber informações sobre o IL Talk Mioko.'));
  const save=node('button','Registrar interesse');save.type='button';const leadStatus=node('p',null,'commerceStatus');leadStatus.setAttribute('role','status');
  save.onclick=async()=>{save.disabled=true;try{await call('il-public',{action:'lead',name:name.value,email:email.value,consent:consent.checked});leadStatus.textContent='Interesse registrado. Obrigado!';name.value=email.value='';consent.checked=false;}catch(e){leadStatus.textContent=e.message;}finally{save.disabled=false;}};
  leads.append(ls,nl,name,el,email,cl,save,leadStatus);box.append(leads);
  const admin=node('a','Painel do administrador','miokoAdminLink');admin.href='admin.html';
  const privacy=node('a','Privacidade e estatísticas','miokoAdminLink');privacy.href='privacidade.html';privacy.style.marginLeft='14px';box.append(admin,privacy);
  const header=document.querySelector('#app header');
  if(header){const link=node('a','Painel do administrador','miokoAdminLink');link.href='admin.html';link.hidden=true;header.append(link);const update=()=>{link.hidden=window.MiokoAuth?.role?.()!=='admin';};window.addEventListener('mioko-auth',update);update();}
})();
