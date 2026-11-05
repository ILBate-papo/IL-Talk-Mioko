import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const part=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function harness({credentials,fetcher}={}){
 const timers=new Map(),requests=[],notices=[],resumed=[];let n=0,reads=0;
 const c=vm.createContext({
  transcriptionController:null,transcriptionPending:false,recordingGeneration:0,listening:true,
  recorderStop:null,recorderSubmit:null,finishTurnButton:{hidden:false},recognition:null,listenTimer:0,
  voiceInputBlocked:false,micPaused:true,
  document:{createElement:()=>({hidden:true})},$:()=>({append(){},textContent:''}),
  callStatus:text=>notices.push(text),add(){},resumeListening:delay=>resumed.push(delay),
  setTimeout(fn,ms){timers.set(++n,{fn,ms});return n;},clearTimeout:id=>timers.delete(id),
  headers:async()=>{reads++;return credentials?credentials():{'Content-Type':'application/json',Authorization:'Bearer test'};},
  config:()=>({VOICE_ENDPOINT:'https://test.invalid/voice'}),
  fetch:async(_url,options)=>{requests.push(options);return fetcher?fetcher(options):{ok:true,json:async()=>({text:'Olá, Mioko'})};},
  AbortController,FormData,Blob
 });
 vm.runInContext(part('  const retryListeningButton =','  // Include token refresh')+part('  function abortableReply(','  function voiceLabel()')+part('  function stopListening()','  function showCooldown(')+part('  async function transcribeSpeech(','  function createTurnDetector()'),c);
 return {c,requests,notices,resumed,timers,reads:()=>reads,
  start:()=>vm.runInContext('transcribeSpeech(new Blob(["sample"],{type:"audio/mp4"}),"fala.m4a")',c),
  retry:()=>vm.runInContext('retryListeningButton.onclick()',c),
  visible:()=>!vm.runInContext('retryListeningButton.hidden',c)};
}

const auth=deferred();let first=true;
const a=harness({credentials:()=>first?(first=false,auth.promise):{Authorization:'Bearer fresh'}});
const pending=a.start();await tick();assert(a.c.transcriptionPending);assert(a.visible());
assert.equal(a.timers.size,1);const deadline=[...a.timers.values()][0];assert.equal(deadline.ms,20000);
deadline.fn();let timedOut;
await assert.rejects(pending,error=>{timedOut=error;return error.name==='AbortError';});
assert.equal(a.c.transcriptionPending,false);a.c.error=timedOut;vm.runInContext('transcriptionFailure(error)',a.c);
assert.equal(a.c.listening,false);assert(a.visible());assert(a.notices.at(-1).includes('demorou demais'));
a.retry();assert.equal(a.c.voiceInputBlocked,false);assert.equal(a.c.micPaused,false);assert.equal(a.resumed.at(-1),0);
assert.equal(await a.start(),'Olá, Mioko');
auth.resolve({Authorization:'Bearer stale'});await tick();assert.equal(a.requests.length,1,'expired authorization cannot upload old audio');
assert.equal(a.requests[0].headers['Content-Type'],undefined);assert.equal(a.requests[0].body.has('language'),false);

// The response body can stall even after HTTP headers arrive. The retry must
// cancel that wait and permit a fresh recording without restarting the app.
const body=deferred();let call=0;
const b=harness({fetcher:async()=>({ok:true,json:()=>++call===1?body.promise:Promise.resolve({text:'Nova fala'})})});
const old=b.start();await tick();b.retry();await assert.rejects(old,{name:'AbortError'});
assert.equal(b.c.transcriptionPending,false);assert.equal(b.c.listening,false);
assert.equal(await b.start(),'Nova fala');body.resolve({text:'Áudio antigo'});await tick();assert.equal(b.c.transcriptionPending,false);
const denied=harness({fetcher:async()=>({ok:false,json:async()=>({error:'Sessão expirada'})})});
await assert.rejects(denied.start(),/Sessão expirada/);assert.equal(denied.c.transcriptionPending,false);
// Whisper may return punctuation rather than an empty string for a silent clip.
// It must produce a recoverable status, never leave "Entendendo sua fala" behind.
const sent=[];b.c.send=text=>sent.push(text);b.c.composerBusy=()=>false;
vm.runInContext(part('  function sendVoice(value)','  function pauseForTyping()'),b.c);
assert.equal(vm.runInContext('sendVoice("...")',b.c),false);
assert(b.notices.at(-1).includes('Não entendi nenhuma palavra'));assert(b.visible());
assert.equal(sent.length,0);b.retry();vm.runInContext('sendVoice("Pode me ouvir?")',b.c);assert.deepEqual(sent,['Pode me ouvir?']);
b.c.composerBusy=()=>true;vm.runInContext('sendVoice("Não apagar o rascunho")',b.c);
assert.equal(sent.length,1);assert(b.notices.at(-1).includes('rascunho'));
console.log('PASS: whole-transcription deadline, stalled credentials/body, visible retry, recovery without restart, stale-audio isolation, session errors and multipart headers.');
