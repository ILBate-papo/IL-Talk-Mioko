import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

let handler;const requests=[],queue=[];
vm.runInNewContext(readFileSync('supabase/ai/index.ts','utf8').replace(/^import .*;\n/gm,''),{
 Response,Request,AbortSignal,crypto:webcrypto,console:{info(){},warn(){},error(){}},
 Deno:{env:{get:key=>key==='GROQ_API_KEY'?'test-only':undefined}},serveWithOrigins:fn=>handler=fn,
 checkAccess:async()=>({allowed:true,role:'member'}),profileInstructions:()=>'',subjectInstructions:()=>'',examInstructions:()=>'',needsResearch:()=>false,
 fetch:async(url,options)=>{assert.equal(new URL(url).hostname,'api.groq.com');requests.push(JSON.parse(options.body));assert(queue.length);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:queue.shift()})}}]});}
});
const lesson=[{locale:'pt-BR',text:'Para dizer sua idade em inglês, use esta frase.'},{locale:'en-US',text:'I am fifty-five years old.'},{locale:'pt-BR',text:'Agora tente repetir.'}];
const ask=()=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({message:'Como digo tenho 55 anos?',language:'Inglês',learner_level:'beginner',teaching_mode:'foreign_beginner_pt',voice_conversation:true})}));
queue.push([{locale:'en-US',text:'I am fifty-five years old.'}],lesson);
let r=await ask();assert.equal(r.status,200);let body=await r.json();assert.deepEqual(body.speech_segments.map(x=>x.locale),['pt-BR','en-US','pt-BR']);assert.equal(requests.length,2,'beginner teaching must explain first in Portuguese');
assert(requests[0].messages[0].content.includes('Nunca escreva aproximação fonética'));
assert(requests[0].messages[0].content.includes('I am fifty-five years old.'));
queue.push([{locale:'pt-BR',text:'Para dizer sua idade, diga ai em.'}],lesson);
r=await ask();assert.equal(r.status,200);body=await r.json();assert(body.speech_segments.some(x=>x.locale==='en-US'),'a requested phrase must be returned in a separate original-language segment');
const speech=readFileSync('app.js','utf8');
const start=speech.indexOf('  function cleanSpeech('),end=speech.indexOf('  async function headers()',start);
const c=vm.createContext({});vm.runInContext(speech.slice(start,end),c);
assert.equal(vm.runInContext('cleanSpeech("Pronúncia aproximada: ai em fifti faiv\\nI am fifty-five years old.")',c),'I am fifty-five years old.');
assert.equal(vm.runInContext('cleanSpeech("en-US: I am fifty-five years old.")',c),'I am fifty-five years old.');
assert.equal(vm.runInContext('cleanSpeech("IPA: /aɪ/\\nAgora repita.")',c),'Agora repita.');
console.log('Passed: Portuguese-first teaching, distinct English example, missing-example recovery and no spoken pronunciation labels or locale codes.');
