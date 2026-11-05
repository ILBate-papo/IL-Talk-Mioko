import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const start=app.indexOf('  function naturalTimeSpeech(');
const end=app.indexOf('  async function headers()',start);
const c=vm.createContext({spokenLocale:()=> 'pt-BR'});
vm.runInContext(app.slice(start,end),c);
const speak=(text,locale='pt-BR')=>{c.text=text;c.locale=locale;return vm.runInContext('cleanSpeech(text, locale)',c);};
for(const suffix of [' (UTC-3)',' (UTC−03:00)',', UTC -03:00',' GMT-0300']){
  assert.equal(speak('São 14h30 no horário de Brasília'+suffix+'.'),'São 14h30 no horário de Brasília.');
}
assert.equal(speak('Em America/Sao_Paulo (UTC-3), são 14h30.'),'Em horário de Brasília, são 14h30.');
assert.equal(speak('Fuso: UTC-03:00.'),'Fuso: 3 horas atrás do horário universal coordenado.');
assert.equal(speak('UTC+05:30'),'5 horas e 30 minutos à frente do horário universal coordenado');
assert.equal(speak('UTC+00:00'),'horário universal coordenado');
assert.equal(speak('UTC-00:30'),'30 minutos atrás do horário universal coordenado');
assert.equal(speak('GMT+1'),'1 hora à frente do horário de Greenwich');
assert.equal(speak('A temperatura é -3 graus, e 3 menos 1 são 2.'),'A temperatura é -3 graus, e 3 menos 1 são 2.');
assert.equal(speak('Agora são 14h30 em Brasília.'),'Agora são 14h30 em Brasília.');
for(const [locale,reference,expected] of [
  ['en-US','Brasília time','3 hours behind coordinated universal time'],
  ['es-ES','hora de Brasilia','3 horas detrás del tiempo universal coordinado'],
  ['fr-FR','heure de Brasilia','3 heures de retard sur le temps universel coordonné'],
  ['it-IT','ora di Brasilia','3 ore indietro rispetto al tempo universale coordinato'],
  ['ja-JP','ブラジリア時間','協定世界時より3時間遅い時間'],
  ['ko-KR','브라질리아 시간','협정 세계시보다 3시간 느린 시간']
]){
  assert.equal(speak(reference+' (UTC-3)',locale),reference);
  assert.equal(speak('UTC-3',locale),expected);
}

// Exercise the actual path used by per-language speech segments, not only cleanup.
const spoken=[];
Object.assign(c,{
  window:{speechSynthesis:{getVoices:()=>[{name:'Maria',lang:'pt-BR'},{name:'English',lang:'en-US'}],speak:u=>{spoken.push({text:u.text,locale:u.lang});queueMicrotask(()=>{u.onstart?.();u.onend?.();});},cancel(){}}},
  SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},
  voiceGeneration:1,voice:true,locales:{Português:'pt-BR',Inglês:'en-US'},
  nativeUtterance:null,nativeCancel:null,audioFrame:0,speechPending:true,voiceInputBlocked:false,micPaused:false,
  closeMouth(){},callStatus(){},resumeListening(){},$:()=>({classList:{add(){},remove(){}}}),
  requestAnimationFrame:()=>0,performance,setTimeout,clearTimeout,queueMicrotask
});
c.window.SpeechSynthesisUtterance=c.SpeechSynthesisUtterance;
vm.runInContext(app.slice(app.indexOf('  function selectNativeVoice('),app.indexOf('  async function serviceSay(')),c);
c.segments=[{text:'São 14h30 no horário de Brasília (UTC-3).',locale:'pt-BR'}, {text:'UTC-3',locale:'en-US'}];
const original=JSON.stringify(c.segments);
await vm.runInContext('nativeSay("horas",1,segments)',c);
assert.deepEqual(spoken,[{text:'São 14h30 no horário de Brasília.',locale:'pt-BR'}, {text:'3 hours behind coordinated universal time',locale:'en-US'}]);
assert.equal(JSON.stringify(c.segments),original,'displayed/history segments remain unchanged');
console.log('PASS: natural Brasília time, offset meaning and minutes, all seven speech languages, native voice delivery, unchanged times/numbers and original text.');
