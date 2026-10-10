import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const start=app.indexOf('  function createTurnDetector()');
const end=app.indexOf('  async function startRecordedListening()',start);
const context=vm.createContext({});
vm.runInContext(app.slice(start,end),context);
function checkPause(noise,speech) {
  const detector=vm.runInContext('createTurnDetector()',context);
  let now=0;
  const frames=(level,n)=>{let result;for(let i=0;i<n;i++){result=detector(level,now);now+=100;}return result;};
  assert.equal(frames(noise,12).heard,false,'background alone is not speech');
  assert.equal(frames(speech,20).finished,false,'continuous speech is preserved');
  assert.equal(frames(noise,3).finished,false,'brief sentence pause is preserved');
  assert.equal(frames(speech,12).finished,false);
  assert.equal(frames(noise,8).finished,true,'turn ends after a short real pause, including ambient noise');
}
checkPause(0.002,0.025);checkPause(0.014,0.06);
const immediate=vm.runInContext('createTurnDetector()',context);
for(let i=0;i<30;i++) assert.equal(immediate(0.025,i*100).finished,false,'speech from first frame is not mistaken for silence');

const localEdge=new URL('./ai/index.ts',import.meta.url);
const edge=readFileSync(existsSync(localEdge)?localEdge:new URL('./supabase/functions/il-ai/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
let handler, requestBody, paid=true, upstreamCalls=0;
vm.runInNewContext(edge,{
  Deno:{env:{get:key=>key==='GROQ_API_KEY'?'test-key':undefined},serve:fn=>{handler=fn;}},
  checkAccess:async()=>paid?{allowed:true,role:'member'}:{allowed:false,status:403,reason:'Pagamento necessário'},
  profileInstructions:()=>'',crypto:{randomUUID:()=> 'test'},Response,AbortSignal,console:{error:()=>{},warn:()=>{},info:()=>{}},
  fetch:async(url,options)=>{upstreamCalls++;requestBody=JSON.parse(options.body);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'pt-BR',text:'Olá! Como posso ajudar?'}]})}}]});}
});
const req=voice=>new Request('https://example.test/il-ai',{method:'POST',body:JSON.stringify({message:'Olá',language:'Português',voice_conversation:voice,history:Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'Turno '+i}))})});
assert.equal((await handler(req(true))).status,200);
assert.equal(requestBody.max_tokens,400);
assert.equal(requestBody.messages.length,6);
assert.match(requestBody.messages[0].content,/no máximo 45 palavras/);
assert.equal((await handler(req(false))).status,200);
assert.equal(requestBody.max_tokens,1200);
paid=false;const before=upstreamCalls;
assert.equal((await handler(req(true))).status,403);
assert.equal(upstreamCalls,before,'unpaid access cannot invoke AI');
console.log('Passed: quiet/noisy pauses, continuous speech, short voice replies, text replies and paid-access guard.');
paid=true;
for(const language of ['Português','Japonês','Inglês','Espanhol','Francês','Coreano','Italiano']){
  for(const level of ['beginner','intermediate','advanced']){
    const request=new Request('https://example.test/il-ai',{method:'POST',body:JSON.stringify({message:'Vamos conversar',language,learner_level:level,teaching_mode:language!=='Português'&&level==='beginner'?'foreign_beginner_pt':level==='intermediate'?'foreign_intermediate':'conversation',voice_conversation:true})});
    assert.equal((await handler(request)).status,200);
    const prompt=requestBody.messages[0].content;
    assert(prompt.includes('NÍVEL DO ALUNO: '+level));
    if(level==='beginner'&&language!=='Português') assert.match(prompt,/Só fale um exemplo no idioma estudado quando o aluno pedir/);
    if(level==='advanced') assert.match(prompt,/No nível avançado, pratique conversação natural no idioma selecionado/);
  }
}
console.log('Passed: beginner, intermediate and advanced instructions across all seven courses.');
