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
    if(mode==='native-permission')vm.runInContext('handleMediaPageHide({isTrusted:false})',context);
    if(mode==='navigation')vm.runInContext('handleMediaPageHide({isTrusted:true})',context);
    return media;
  }}},
  stopMedia:()=>{context.callMode=null;context.conversationGeneration++;context.notice='';},
  add:()=>{},greetCall:()=>{greeting++;},callStatus:s=>{context.notice=s;}
});
const mediaStart=source.indexOf('  let pendingMediaRequests = 0;');
const mediaEnd=source.indexOf('  let lang =',mediaStart);
vm.runInContext(source.slice(mediaStart,mediaEnd)+source.slice(start,end),context);
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

mode='native-permission';context.callMode=null;
await vm.runInContext('startVideo()',context);
assert.equal(context.callMode,'video','native pause during permission does not cancel the call');
assert.equal(greeting,2);
vm.runInContext('handleMediaPageHide({isTrusted:false})',context);
assert.equal(context.callMode,null,'native pause outside permission still ends the call');
mode='navigation';
await vm.runInContext('startVideo()',context);
assert.equal(context.callMode,null,'real navigation during permission still ends the call');
assert.equal(stopped,2,'real navigation releases late camera stream');
mode='denied';
await vm.runInContext('startVideo()',context);
context.callMode='video';
vm.runInContext('handleMediaPageHide({isTrusted:false})',context);
assert.equal(context.callMode,null,'failed permission request clears pending counter');
console.log('Passed: native permission pause, real navigation cleanup and failed-request cleanup.');
