import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const piece=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function harness({auth,fetcher}={}) {
  const messages=[],requests=[],timers=new Map(),elements=new Map();let timer=0,authReads=0,accessReads=0;
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,append(){}});return elements.get(id);};
  const c=vm.createContext({
    window:{MiokoAuth:{getToken:async()=>{authReads++;return auth?auth():'test-jwt';},requireAccess:async()=>{accessReads++;throw Error('duplicate verification');}}},
    document:{createElement:()=>({hidden:true})},$:element,
    replyQueue:Promise.resolve(),replyReservation:0,replySequence:0,replyPending:false,replyController:null,
    conversationGeneration:0,voiceGeneration:0,voice:false,history:[],lang:'Português',lessonLevel:'advanced',
    researchMode:false,examMode:'',callMode:null,aiCooldownUntil:0,
    speechPending:false,currentAudio:null,nativeUtterance:null,voiceInputBlocked:false,
    stopListening(){},stopSpeech(){c.voiceGeneration++;},resumeListening(){},prepareAudio(){},
    add(type,text,save){const node={type,text,removed:false,remove(){this.removed=true;}};messages.push(node);if(save)c.history.push({role:type==='ai'?'assistant':'user',content:text});return node;},
    callStatus:text=>{c.notice=text;},endpoint:()=> 'https://test.invalid/il-ai',
    config:()=>({SUPABASE_PUBLISHABLE_KEY:'publishable-test'}),beginnerLesson:()=>false,
    showCooldown:seconds=>{c.aiCooldownUntil=Date.now()+seconds*1000;},
    fetch:async(url,options)=>{requests.push(options);return fetcher?fetcher(options):{ok:true,text:async()=>JSON.stringify({answer:'Resposta pronta',speech_segments:[]})};},
    setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),
    AbortController,Promise,Date,Intl,URL,Error,
  });
  vm.runInContext(piece('  const cancelReplyButton =','  function voiceLabel()')+piece('  async function headers()','  function stopListening()')+piece('  function send(value)','  $("#send").onclick'),c);
  return {c,messages,requests,timers,element,authReads:()=>authReads,accessReads:()=>accessReads,
    send:value=>{c.message=value;return vm.runInContext('send(message)',c);},
    cancel:()=>vm.runInContext('cancelReplyButton.onclick()',c),
    cancelHidden:()=>vm.runInContext('cancelReplyButton.hidden',c)};
}

// A stalled token refresh must not hold the conversation queue after timeout.
const token=deferred();let first=true;
const a=harness({auth:()=>{if(first){first=false;return token.promise;}return 'new-jwt';}});
const stuck=a.send('Primeira pergunta');await tick();
assert.equal(a.c.replyPending,true);assert.equal(a.cancelHidden(),false);
for(const callback of [...a.timers.values()])callback();
await stuck;assert.equal(a.c.replyPending,false);assert.equal(a.cancelHidden(),true);
await a.send('Nova pergunta');assert.equal(a.requests.length,1);assert(a.messages.some(x=>x.text==='Resposta pronta'));
token.resolve('late-jwt');await tick();assert.equal(a.requests.length,1,'late credentials cannot send the old question');
assert.equal(a.requests[0].headers.Authorization,'Bearer new-jwt');assert.equal(a.accessReads(),0);

// A new question must keep its draft instead of silently joining a long queue.
const body=deferred();let reads=0;
const b=harness({fetcher:async()=>({ok:true,text:()=>++reads===1?body.promise:Promise.resolve(JSON.stringify({answer:'Segunda resposta'}))})});
const pending=b.send('Pergunta antiga');await tick();
b.element('#text').value='Meu rascunho';
assert.equal(b.send(undefined),undefined);assert.equal(b.element('#text').value,'Meu rascunho');assert.equal(b.requests.length,1);
b.cancel();const next=b.send('Pergunta nova');await Promise.all([pending,next]);
assert.equal(b.requests.length,2);assert(b.messages.some(x=>x.text==='Segunda resposta'));
body.resolve(JSON.stringify({answer:'Resposta antiga atrasada'}));await tick();
assert(!b.messages.some(x=>x.text==='Resposta antiga atrasada'),'cancelled response must not reappear');
assert(b.messages.filter(x=>x.text==='🧠 Pensando...').every(x=>x.removed));

// Two clicks before the queue starts still reserve just one request.
const d=harness();const once=d.send('Um');assert.equal(d.send('Dois'),undefined);await once;assert.equal(d.requests.length,1);
const missing=harness({auth:async()=>null});await missing.send('Olá');assert.equal(missing.requests.length,0);assert.equal(missing.c.replyPending,false);
const limited=harness({fetcher:async()=>({ok:false,status:429,text:async()=>JSON.stringify({error:'rate limit',retry_after:10})})});
await limited.send('Olá');assert(limited.c.aiCooldownUntil>Date.now());assert.equal(limited.c.replyPending,false);assert.equal(limited.requests.length,1);
console.log('PASS: stalled authentication, response-body timeout/cancel, queue recovery, stale-response isolation, draft preservation, duplicate clicks, bearer token and rate-limit handling.');
