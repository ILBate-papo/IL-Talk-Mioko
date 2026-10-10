import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const start=source.indexOf('  async function startVideo()');
const end=source.indexOf('  $("#videoCall").onclick',start);
assert(start>=0&&end>start);
const elements=new Map();
const element=selector=>{
  if(!elements.has(selector))elements.set(selector,{textContent:'',hidden:false,classList:{add(){},remove(){}},play:async()=>{}});
  return elements.get(selector);
};
let requested, greeting=0, stopped=0, mode='success';
const media={getTracks:()=>[{stop:()=>{stopped++;}}]};
const context=vm.createContext({
  callMode:null,conversationGeneration:0,voiceInputBlocked:false,stream:null,$:element,
  navigator:{mediaDevices:{getUserMedia:async constraints=>{
    requested=constraints;
    if(mode==='denied')throw Object.assign(Error('Permission denied'),{name:'NotAllowedError'});
    if(mode==='cancelled')context.conversationGeneration++;
    return media;
  }}},
  stopMedia:()=>{context.callMode=null;context.conversationGeneration++;context.notice='';},
  add:()=>{},greetCall:()=>{greeting++;},callStatus:s=>{context.notice=s;}
});
vm.runInContext(source.slice(start,end),context);
await vm.runInContext('startVideo()',context);
assert.equal(requested.audio,false,'camera preview never captures a second microphone');
assert.equal(requested.video.facingMode,'user');
assert.equal(context.callMode,'video');
assert.equal(element('#userVideo').srcObject,media);
assert.equal(element('#userVideo').playsInline,true);
assert.equal(greeting,1);
context.callMode=null;mode='denied';
await vm.runInContext('startVideo()',context);
assert.match(context.notice,/Câmera sem permissão/,'permission error remains visible after cleanup');
assert.match(element('#cameraStatus').textContent,/Permissões/);
assert.equal(greeting,1,'failed video does not announce a successful call');
mode='cancelled';
await vm.runInContext('startVideo()',context);
assert.equal(stopped,1,'late stream from a cancelled call is released');
console.log('Passed: independent camera permission, one microphone owner, inline preview, visible errors and cancelled stream cleanup.');
