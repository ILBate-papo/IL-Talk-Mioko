import assert from 'node:assert/strict';
import {VoiceActivity, wavFromSamples, createListener} from '../mioko-listener.mjs';
const rate=16000, block=800;
const silence=new Float32Array(block);
const speech=Float32Array.from({length:block},(_,i)=>Math.sin(i*.2)*.12);
const output=[];
for(let turn=0;turn<5;turn++){
 const vad=new VoiceActivity(rate,blob=>output.push(blob));
 for(let i=0;i<200;i++)vad.process(silence);
 assert.equal(output.length,turn,'idle must not trigger requests');
 for(let i=0;i<12;i++)vad.process(speech);
 for(let i=0;i<19;i++)vad.process(silence);
 assert.equal(output.length,turn+1);
 for(let i=0;i<10;i++)vad.process(speech);
 assert.equal(output.length,turn+1,'one request per utterance');
}
const wav=new DataView(await output[0].arrayBuffer());
assert.equal(String.fromCharCode(...new Uint8Array(wav.buffer,0,4)),'RIFF');
assert.equal(wav.getUint32(24,true),rate);assert.equal(wav.getUint16(22,true),1);
const click=[];const vad=new VoiceActivity(rate,blob=>click.push(blob));vad.process(speech);for(let i=0;i<22;i++)vad.process(silence);assert.equal(click.length,0);
const clipping=new DataView(await wavFromSamples([new Float32Array([-2,2])],rate).arrayBuffer());assert.equal(clipping.getInt16(44,true),-32768);assert.equal(clipping.getInt16(46,true),32767);
let resolveMedia,stops=0;
globalThis.window={AudioContext:class {
 state='running'; sampleRate=rate;
 async resume(){} async close(){}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 createScriptProcessor(){return {connect(){},disconnect(){}};}
 createGain(){return {gain:{},connect(){},disconnect(){}};}
}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveMedia=r)}},configurable:true});
const listener=createListener();const opening=listener.start(()=>{});await new Promise(r=>setImmediate(r));listener.stop();resolveMedia({getTracks:()=>[{stop(){stops++}}]});assert.equal(await opening,false);assert.equal(stops,1,'cancel during permission closes late microphone');await listener.destroy();
console.log('PASS: five utterances; no requests during idle; one transcript per utterance; WAV header/clipping; cancellation releases microphone. Audio input simulated, not hardware.');
