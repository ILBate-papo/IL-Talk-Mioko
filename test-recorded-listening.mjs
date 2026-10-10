import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const preference=source.match(/const preferRecorder = ([^;]+);/)[1];
assert.equal(vm.runInNewContext(preference,{navigator:{userAgent:'Android Chrome'},window:{SpeechRecognition:class{}}}),true,'Android uses the recorder even when an unreliable recognizer is advertised');
const start=source.indexOf('  function createTurnDetector()');
const end=source.indexOf('  function startListening()',start);
let now=0,level=0,interval,requests=0,released=0;
const messages=[],status=[];let transcript='Como se diz bom dia?';
const mic={getTracks:()=>[{stop:()=>released++}]};
const meter={fftSize:1024,getFloatTimeDomainData:array=>array.fill(level),disconnect:()=>{}};
const button={hidden:true};
class Recorder {
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['microphone sample'],{type:this.mimeType})});queueMicrotask(()=>this.onstop?.());}
}
const c=vm.createContext({window:{MediaRecorder:Recorder},MediaRecorder:Recorder,navigator:{mediaDevices:{getUserMedia:async()=>mic}},
 recordingGeneration:0,listening:false,recorderStop:null,recorderSubmit:null,audioContext:{createMediaStreamSource:()=>({connect:()=>{},disconnect:()=>{}}),createAnalyser:()=>meter},
 requestMedia:async()=>mic,microphoneFailure:error=>{throw error;},unlockAudio:async()=>{},performance:{now:()=>now},setInterval:fn=>{interval=fn;return 1;},clearInterval:()=>{},
 $:()=>({textContent:''}),finishTurnButton:button,callStatus:t=>status.push(t),voiceInputBlocked:false,
 inputLocale:()=> 'pt-BR',lang:'Japonês',headers:async()=>({Authorization:'Bearer test'}),config:()=>({VOICE_ENDPOINT:'https://example.test/voice'}),
 fetch:async(u,o)=>{requests++;assert.equal(o.body.has('language'),false,'no forced Portuguese hint for Japanese speech');return Response.json({text:transcript});},
 send:t=>messages.push(t),resumeListening:()=>{},add:()=>{},FormData,Blob,Response,AbortSignal,Float32Array,queueMicrotask
});
vm.runInContext(source.slice(start,end),c);
await vm.runInContext('startRecordedListening()',c);
assert.equal(button.hidden,false);
for(let i=0;i<10;i++){now+=100;level=.002;interval();}
for(let i=0;i<15;i++){now+=100;level=.04;interval();}
for(let i=0;i<8;i++){now+=100;level=.002;interval();}
for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(requests,1,'a paused microphone turn must reach transcription');
assert.deepEqual(messages,['Como se diz bom dia?'],'recognized text must reach AI send');
assert.equal(button.hidden,true,'finish button is hidden after recording');
assert.equal(released,1,'microphone track is released');
assert(status.some(t=>t.includes('Ouvindo você')));
// Manual completion also handles speech too quiet for the energy threshold.
transcript='今日は元気ですか？';now=0;await vm.runInContext('startRecordedListening()',c);
vm.runInContext('recorderSubmit()',c);
for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(requests,2);
assert.equal(messages.length,2);assert.equal(messages[1],'今日は元気ですか？','Japanese transcript reaches AI unchanged');
console.log('Passed: Android recorder selection, pause-to-transcription-to-AI pipeline, manual completion and microphone cleanup.');
