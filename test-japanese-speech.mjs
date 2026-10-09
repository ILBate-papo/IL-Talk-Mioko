import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const start=source.indexOf('  function selectNativeVoice(');
const end=source.indexOf('  async function serviceSay(',start);
assert(start>=0&&end>start);
const spoken=[];
let resumed=0;
const voices=[{name:'Maria',lang:'pt-BR'},{name:'Haruka',lang:'ja-JP'}];
const context=vm.createContext({
  window:{speechSynthesis:{getVoices:()=>voices,speak:u=>{spoken.push({text:u.text,locale:u.lang,rate:u.rate});queueMicrotask(()=>{u.onstart?.();u.onend?.();});},cancel:()=>{}},MiokoAvatar:{setMouth:()=>{},closeMouth:()=>{}}},
  SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},
  spokenLocale:()=> 'pt-BR',voiceGeneration:1,voice:true,
  locales:{Português:'pt-BR',Japonês:'ja-JP',Inglês:'en-US',Espanhol:'es-ES',Francês:'fr-FR',Coreano:'ko-KR',Italiano:'it-IT'},cleanSpeech:t=>t,
  nativeUtterance:null,nativeCancel:null,audioFrame:0,speechPending:true,
  closeMouth:()=>{},resumeListening:()=>{resumed++;},
  $:()=>({classList:{add:()=>{},remove:()=>{}}}),
  requestAnimationFrame:()=>0,performance,setTimeout,clearTimeout,queueMicrotask
});
context.window.SpeechSynthesisUtterance=context.SpeechSynthesisUtterance;
vm.runInContext(source.slice(start,end),context);
await vm.runInContext('nativeSay("Diga こんにちは。 Isso significa olá. 日本語 significa japonês.",1)',context);
assert.deepEqual(spoken.map(x=>x.locale),['pt-BR','ja-JP','pt-BR','ja-JP','pt-BR']);
assert.equal(spoken[1].text,'こんにちは。');
assert.equal(spoken[3].text,'日本語');
assert.equal(spoken[1].rate,0.85);
assert.equal(resumed,1,'microphone resumes only after the entire bilingual turn');
voices.pop();spoken.length=0;
await assert.rejects(vm.runInContext('nativeSay("Olá. こんにちは。",1)',context),/ja-JP/);
assert.equal(spoken.length,0,'missing Japanese voice must not fall back to Portuguese pronunciation');
context.spokenLocale=()=> 'ja-JP';voices.push({name:'Haruka',lang:'ja-JP'});
await vm.runInContext('nativeSay("こんにちは。",1)',context);
assert.equal(spoken[0].locale,'ja-JP');
assert.equal(spoken[0].rate,1.05);
spoken.length=0;context.spokenLocale=()=> 'pt-BR';voices.push({name:'Samantha',lang:'en-US'});
context.englishPlan=[{locale:'pt-BR',text:'Em inglês, diga:'},{locale:'en-US',text:'Good morning.'},{locale:'pt-BR',text:'Isso significa bom dia.'}];
await vm.runInContext('nativeSay("aula",1,englishPlan)',context);
assert.deepEqual(spoken.map(x=>x.locale),['pt-BR','en-US','pt-BR']);
assert.equal(spoken[1].text,'Good morning.');assert.equal(spoken[1].rate,0.85);
for(const [locale,text] of [['es-ES','Buenos días.'],['fr-FR','Bonjour.'],['ko-KR','안녕하세요.'],['it-IT','Buongiorno.']]){
  spoken.length=0;voices.push({name:locale,lang:locale});
  context.lessonPlan=[{locale:'pt-BR',text:'Exemplo:'},{locale,text},{locale:'pt-BR',text:'Agora tente repetir.'}];
  await vm.runInContext('nativeSay("aula",1,lessonPlan)',context);
  assert.deepEqual(spoken.map(x=>x.locale),['pt-BR',locale,'pt-BR']);
  assert.equal(spoken[1].text,text);assert.equal(spoken[1].rate,0.85);
}
console.log('Passed: all seven voice locales, bilingual order, slower examples, microphone sequencing, missing-voice protection and immersion.');
