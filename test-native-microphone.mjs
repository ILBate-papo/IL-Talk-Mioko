import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const posts=[], timers=new Map(), mouth=[];
let timerId=0;
const window={MiokoVoiceBridge:{postMessage:text=>posts.push(JSON.parse(text))},
  MiokoAvatar:{setMouth:value=>mouth.push(value),closeMouth:()=>mouth.push(0)},addEventListener:()=>{}};
window.top=window;
const context=vm.createContext({window,performance:{now:()=>1000},setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),Blob,Uint8Array,atob});
vm.runInContext(readFileSync('android/app/src/main/assets/native-voice.js','utf8'),context);
let levels=[];
const capture=window.MiokoNativeMicrophone.start(level=>levels.push(level));
const id=posts.at(-1).id;
window.__miokoNativeEvent({type:'mic-level',id,level:.1});
assert.deepEqual(levels,[.1]);
window.MiokoNativeMicrophone.finish();
assert.equal(posts.at(-1).action,'mic-stop');
window.__miokoNativeEvent({type:'mic-data',id,audio:btoa('sample'),mime:'audio/mp4'});
assert.equal(await (await capture).text(),'sample');
const cancelled=window.MiokoNativeMicrophone.start(()=>{});
window.MiokoNativeMicrophone.cancel();
assert.equal(await cancelled,null);
const failed=window.MiokoNativeMicrophone.start(()=>{});
window.__miokoNativeEvent({type:'mic-error',id:posts.at(-1).id,error:'Permission denied'});
await assert.rejects(failed,/Permission denied/);
const utterance=new window.SpeechSynthesisUtterance('Olá');
window.speechSynthesis.speak(utterance);
const speechId=posts.at(-1).id;
window.__miokoNativeEvent({type:'start',id:speechId});
assert.equal(timers.size,1);
for(const tick of timers.values())tick();
assert(mouth.some(value=>value>0));
window.__miokoNativeEvent({type:'end',id:speechId});
assert.equal(timers.size,0);
assert.equal(mouth.at(-1),0);

const app=readFileSync('app.js','utf8');
const detector=app.slice(app.indexOf('  function createTurnDetector()'),app.indexOf('  async function startNativeListening()'));
const native=app.slice(app.indexOf('  async function startNativeListening()'),app.indexOf('  async function startRecordedListening()'));
let now=0, releaseCapture, onLevel, sent=[], requestCount=0, cancelledCount=0;
const button={hidden:true};
const c=vm.createContext({window:{MiokoNativeMicrophone:{start:fn=>{onLevel=fn;return new Promise(resolve=>{releaseCapture=resolve;});},finish:()=>releaseCapture(new Blob(['sample'],{type:'audio/mp4'})),cancel:()=>{cancelledCount++;releaseCapture(null);}}},
recordingGeneration:0,listening:false,recorderStop:null,recorderSubmit:null,pendingMediaRequests:0,finishTurnButton:button,
performance:{now:()=>now},setTimeout:()=>1,clearTimeout:()=>{},callStatus:()=>{},$:()=>({textContent:''}),
headers:async()=>({'Content-Type':'application/json',Authorization:'Bearer test'}),config:()=>({VOICE_ENDPOINT:'https://test.invalid'}),
fetch:async(url,args)=>{requestCount++;assert.equal(args.body.get('file').type,'audio/mp4');assert.equal(args.headers['Content-Type'],undefined);return Response.json({text:'Olá, Mioko'});},
send:text=>sent.push(text),resumeListening:()=>{},microphoneFailure:error=>{throw error;},Blob,FormData,Response,AbortSignal});
vm.runInContext(detector+native,c);
const turn=vm.runInContext('startNativeListening()',c);
for(let i=0;i<10;i++){now+=100;onLevel(.002);}
for(let i=0;i<12;i++){now+=100;onLevel(.08);}
for(let i=0;i<8;i++){now+=100;onLevel(.002);}
await turn;
assert.deepEqual(sent,['Olá, Mioko']);
assert.equal(requestCount,1);
assert.equal(button.hidden,true);
const oldTurn=vm.runInContext('startNativeListening()',c);
vm.runInContext('recordingGeneration++;recorderStop()',c);
await oldTurn;
assert.equal(cancelledCount,1);
assert.equal(requestCount,1,'cancelled capture must never upload');
console.log('Passed: native capture, silence-to-transcription-to-AI turn, cancellation, permission errors and mouth start/end events.');
