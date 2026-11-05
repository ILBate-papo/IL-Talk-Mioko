import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {speechStyle} from './supabase/ai/speech-style.ts';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const c=vm.createContext({spokenLocale:()=> 'pt-BR'});
vm.runInContext(app.slice(app.indexOf('  function naturalTimeSpeech('),app.indexOf('  async function headers()')),c);
const lesson=message=>{c.message=message;return vm.runInContext('punctuationLesson(message)',c);};
const speak=(text,explain=false)=>{c.text=text;c.explain=explain;return vm.runInContext('cleanSpeech(text, "pt-BR", explain)',c);};
assert.equal(speak('Ela disse: “bom dia”; depois saiu.'),'Ela disse: bom dia, depois saiu.');
assert.equal(speak('Abre aspas bom dia fecha aspas. Ponto e vírgula vamos continuar.'),'bom dia. vamos continuar.');
assert.equal(speak('O ponto e vírgula separa orações relacionadas.',true),'O ponto e vírgula separa orações relacionadas.');
assert.equal(speak('O ponto principal é conversar. A vírgula pode esperar.'),'O ponto principal é conversar. A vírgula pode esperar.');
assert.equal(speak("L'heure est arrivée.").includes("L'heure"),true,'apostrophes inside words are retained');
assert(lesson('Quando devo usar ponto e vírgula numa redação?'));
assert(lesson('Por que se usam aspas?'));
assert(lesson('How do I use a semicolon?'));
assert(!lesson('Qual é a hora em Brasília?'));
assert(!lesson('Conte uma história curta.'));

// Exercise the exact pending deployment when provided, or the checked-in AI entrypoint.
const path=process.env.IL_MIOKO_LIVE_AI_DIR ? process.env.IL_MIOKO_LIVE_AI_DIR+'/index.ts' : new URL('./supabase/ai/index.ts',import.meta.url);
const source=readFileSync(path,'utf8').replace(/^import .*;\n/gm,'');
let handler,prompt,calls=0,allowed=true;
vm.runInNewContext(source,{
  Deno:{env:{get:k=>k==='GROQ_API_KEY'?'test-key':undefined}},serveWithOrigins:fn=>{handler=fn;},
  checkAccess:async()=>({allowed,status:403,reason:'Sem acesso',role:'member'}),
  everydayPhrase:()=>null,subjectInstructions:()=>'',examInstructions:()=>'',profileInstructions:()=>'',
  needsResearch:()=>false,researchCurrent:async()=>null,speechStyle,
  crypto:{randomUUID:()=> 'test'},Response,AbortSignal,console:{info(){},warn(){},error(){}},
  fetch:async(_url,options)=>{calls++;prompt=JSON.parse(options.body).messages[0].content;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'pt-BR',text:'Resposta de teste.'}]})}}]});}
});
for(const message of ['Que horas são em Brasília?','Quando devo usar ponto e vírgula numa redação?']){
  const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({message,language:'Português',learner_level:'advanced'})}));
  assert.equal(response.status,200);assert(prompt.includes(speechStyle));
  assert(prompt.includes('por que usar'));assert(prompt.includes('Não recite siglas UTC'));
}
allowed=false;const before=calls;
assert.equal((await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({message:'Olá'})}))).status,403);
assert.equal(calls,before,'access checks still precede generation');
console.log('PASS: punctuation as pauses, explicit writing explanations, preserved words/apostrophes, live prompt integration and access checks.');
