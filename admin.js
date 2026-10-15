(() => {
  const $=s=>document.querySelector(s),c=window.IL_TALK_CONFIG||{};
  const base='https://'+c.SUPABASE_PROJECT_REF+'.supabase.co',key=c.SUPABASE_PUBLISHABLE_KEY||c.SUPABASE_ANON_KEY;
  let session=null,snapshot=null;
  function lock(){session=null;snapshot=null;$('#adminApp').hidden=true;$('#adminLogin').hidden=false;for(const sel of ['#metrics','#clients','#requests','#leads','#countries','#cities','#chart','#paymentUser'])$(sel).replaceChildren();$('#paymentReference').value='';$('#receivedConfirmed').checked=false;}
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100);
  const number=v=>new Intl.NumberFormat('pt-BR').format(v||0);
  const date=v=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'—';
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e;};
  const flag=code=>/^[A-Z]{2}$/.test(code||'')?String.fromCodePoint(...[...code].map(x=>127397+x.charCodeAt(0))):'🌐';
  function country(code){try{return new Intl.DisplayNames(['pt-BR'],{type:'region'}).of(code)||code;}catch{return code||'Não informado';}}
  async function authRequest(path,body,token){
    const r=await fetch(base+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const d=await r.json();if(!r.ok)throw Error(d.error_description||d.msg||d.error||'Não foi possível entrar.');return d;
  }
  async function token(){
    if(!session)throw Error('Entre novamente no painel.');
    if(session.expires_at*1000<Date.now()+60000){const d=await authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});session={...d,expires_at:Math.floor(Date.now()/1000)+d.expires_in};}
    return session.access_token;
  }
  async function api(payload){
    const r=await fetch(base+'/functions/v1/il-admin',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
    const d=await r.json();if(!r.ok){if([401,403].includes(r.status)){lock();$('#loginStatus').textContent=d.error||'Entre novamente no painel.';}throw Error(d.error||'Não foi possível consultar o painel.');}return d;
  }
  function table(target,headers,rows){
    const area=$(target);area.replaceChildren();if(!rows.length){area.append(node('p','Nenhum registro neste período.','empty'));return;}
    const t=node('table'),head=node('thead'),tr=node('tr');headers.forEach(x=>tr.append(node('th',x)));head.append(tr);t.append(head);
    const body=node('tbody');rows.forEach(row=>{const tr=node('tr');row.forEach(value=>{const td=node('td');td.append(value instanceof Node?value:document.createTextNode(String(value??'—')));tr.append(td)});body.append(tr)});t.append(body);area.append(t);
  }
  function geoLabel(code,city){const e=node('span');e.append(node('span',flag(code),'flag'),document.createTextNode(city?city+' · '+country(code):country(code)));return e;}
  function accessLabel(account){
    if(!account.email_confirmed_at)return 'E-mail não confirmado';
    if(account.status==='paid'&&new Date(account.paid_until)>new Date())return 'Pagante ativo';
    if(account.status==='paid')return 'Expirado';
    if(account.status==='blocked')return 'Bloqueado';
    if(account.status==='cancelled')return 'Cancelado';return 'Aguardando pagamento';
  }
  function chart(rows){
    const area=$('#chart');area.replaceChildren();if(!rows.length){area.append(node('p','As visitas aparecerão aqui a partir da publicação.','empty'));return;}
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 180');svg.setAttribute('role','img');svg.setAttribute('aria-label','Visitas por dia');svg.classList.add('chart');
    const max=Math.max(1,...rows.map(x=>Number(x.visits))),step=960/rows.length;
    rows.forEach((r,i)=>{const bar=document.createElementNS(ns,'rect');const h=Number(r.visits)/max*135;bar.setAttribute('x',String(20+i*step));bar.setAttribute('y',String(145-h));bar.setAttribute('width',String(Math.max(2,step-3)));bar.setAttribute('height',String(h));bar.setAttribute('rx','3');bar.setAttribute('fill','#79e2ce');const title=document.createElementNS(ns,'title');title.textContent=r.day+': '+number(r.visits)+' visitas';bar.append(title);svg.append(bar);});
    for(const [x,text] of [[20,rows[0].day],[800,rows.at(-1).day]]){const label=document.createElementNS(ns,'text');label.setAttribute('x',String(x));label.setAttribute('y','175');label.setAttribute('fill','#adc4dd');label.setAttribute('font-size','14');label.textContent=text;svg.append(label)}area.append(svg);
  }
  function tab(name){document.querySelectorAll('[data-panel]').forEach(x=>x.hidden=x.dataset.panel!==name);document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));}
  document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>tab(x.dataset.tab));
  function render(d){
    snapshot=d;const m=d.metrics;const conversion=m.leads?100*m.converted_leads/m.leads:0;
    const cards=[['Visitas',number(m.visits),'no período'],['Visitantes estimados',number(m.visitor_sessions),'sessões do navegador'],['Cadastros',number(m.registrations),number(m.registered_total)+' no total'],['Pagantes ativos',number(m.active_paid),'acesso vigente'],['Leads',number(m.leads),'interessados no período'],['Leads que viraram clientes',number(m.converted_leads),conversion.toFixed(1).replace('.',',')+'% dos leads do período'],['Cliques em pagamento',number(m.checkout_clicks),'interesse em pagar'],['Recebimentos confirmados',money(m.revenue_cents),'confirmados por você no período']];
    $('#metrics').replaceChildren(...cards.map(([label,value,detail],i)=>{const e=node('div',null,'metric'+([3,7].includes(i)?' highlight':''));e.append(node('span',label),node('strong',value),node('span',detail));return e;}));
    chart(d.daily);$('#trackingNote').textContent=d.tracking_started_at?'Primeiro acesso registrado: '+date(d.tracking_started_at)+'. Cadastros e pagamentos usam os registros do servidor.':'Ainda não há visitas registradas. Não recuperamos visitas anteriores à ativação das estatísticas.';
    table('#countries',['País','Visitas'],d.countries.map(x=>[geoLabel(x.country_code),number(x.visits)]));
    table('#cities',['Cidade / país','Visitas'],d.cities.map(x=>[geoLabel(x.country_code,x.city),number(x.visits)]));
    table('#clients',['E-mail','Cadastro','Situação','Acesso até'],d.accounts.map(x=>[x.email,date(x.created_at),accessLabel(x),date(x.paid_until)]));
    const confirmed=d.accounts.filter(x=>x.email_confirmed_at);
    $('#paymentUser').replaceChildren(new Option('Selecione o cliente',''),...confirmed.map(x=>new Option(x.email,x.id)));$('#confirmPayment').disabled=!confirmed.length;
    table('#requests',['Cliente','Forma','Transação','Informado em','Conferência'],d.payment_requests.map(x=>{const button=node('button','Conferir','secondary');button.type='button';button.onclick=()=>{$('#paymentUser').value=x.user_id;$('#paymentMethod').value=x.method;$('#paymentReference').value=x.reference;$('#receivedConfirmed').checked=false;tab('payments');$('#confirmForm').scrollIntoView({behavior:'smooth',block:'center'});};return[x.email,x.method==='pix'?'Pix':'Mercado Pago',x.reference,date(x.created_at),button];}));
    table('#leads',['Nome','E-mail','Interesse em','Conversão'],d.leads.map(x=>[x.name,x.email,date(x.created_at),x.converted?'Cliente com recebimento confirmado':'Interessado']));
    const s=d.settings;$('#price').value=(s.price_cents/100).toFixed(2);$('#accessDays').value=s.access_days;$('#pixKey').value=s.pix_key;$('#pixOwner').value=s.pix_owner;$('#pixBank').value=s.pix_bank;$('#mercadoPagoUrl').value=s.mercado_pago_url;
    $('#receivedText').textContent='Conferi no banco ou Mercado Pago que '+money(s.price_cents)+' foi creditado na minha conta para este cliente. Liberar '+s.access_days+' dias de acesso.';
  }
  async function refresh(){ $('#refresh').disabled=true;try{const d=await api({action:'snapshot',days:Number($('#period').value)});render(d);$('#adminStatus').textContent='Atualizado em '+date(new Date().toISOString());}catch(e){$('#adminStatus').textContent=e.message;}finally{$('#refresh').disabled=false;}}
  $('#adminLoginForm').onsubmit=async e=>{e.preventDefault();$('#adminEnter').disabled=true;$('#loginStatus').textContent='Conferindo acesso…';session=null;try{const d=await authRequest('/auth/v1/token?grant_type=password',{email:$('#adminEmail').value.trim().toLowerCase(),password:$('#adminPassword').value});session={...d,expires_at:Math.floor(Date.now()/1000)+d.expires_in};const data=await api({action:'snapshot',days:30});render(data);$('#adminLogin').hidden=true;$('#adminApp').hidden=false;$('#loginStatus').textContent='';}catch(e){session=null;$('#loginStatus').textContent=e.message==='Invalid login credentials'?'E-mail ou senha incorretos.':e.message;}finally{$('#adminPassword').value='';$('#adminEnter').disabled=false;}};
  $('#refresh').onclick=refresh;$('#period').onchange=refresh;
  $('#logout').onclick=()=>{const old=session;lock();if(old?.access_token)authRequest('/auth/v1/logout?scope=local',{},old.access_token).catch(()=>{});};
  $('#confirmForm').onsubmit=async e=>{e.preventDefault();$('#confirmPayment').disabled=true;$('#paymentStatus').textContent='Conferindo registro…';try{const d=await api({action:'confirm_payment',user_id:$('#paymentUser').value,method:$('#paymentMethod').value,reference:$('#paymentReference').value,received_confirmed:$('#receivedConfirmed').checked});$('#paymentStatus').textContent=d.already_confirmed?'Esta transação já estava confirmada. O prazo não foi duplicado.':'Recebimento registrado. Acesso liberado até '+date(d.paid_until)+'.';$('#paymentReference').value='';$('#receivedConfirmed').checked=false;await refresh();}catch(e){$('#paymentStatus').textContent=e.message;}finally{$('#confirmPayment').disabled=false;}};
  $('#settingsForm').onsubmit=async e=>{e.preventDefault();$('#saveSettings').disabled=true;try{await api({action:'settings',price_cents:Math.round(Number($('#price').value)*100),access_days:Number($('#accessDays').value),pix_key:$('#pixKey').value,pix_owner:$('#pixOwner').value,pix_bank:$('#pixBank').value,mercado_pago_url:$('#mercadoPagoUrl').value});$('#settingsStatus').textContent='Cobrança salva. Os dados atualizados aparecerão no site.';await refresh();}catch(e){$('#settingsStatus').textContent=e.message;}finally{$('#saveSettings').disabled=false;}};
})();
