import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const edge=readFileSync(new URL('./ai/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
let handler,body,limited=false;
vm.runInNewContext(edge,{Deno:{env:{get:k=>k==='GROQ_API_KEY'?'test':undefined},serve:f=>handler=f},checkAccess:async()=>({allowed:true,role:'member'}),profileInstructions:()=>'',crypto:{randomUUID:()=> 'test'},Response,AbortSignal,console:{error:()=>{},warn:()=>{},info:()=>{}},fetch:async(u,o)=>{body=JSON.parse(o.body);return limited?Response.json({error:{code:'rate_limit_exceeded',message:'Try again in 1m2.5s'}},{status:429}):Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'ja-JP',text:'こんにちは。今日はどうですか？'}]})}}]});}});
for(const level of ['beginner','intermediate','advanced']){
 for(const message of ['今日は元気ですか？','Como você está hoje?']){
 const r=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({message,language:'Japonês',learner_level:level,teaching_mode:level==='beginner'?'foreign_beginner_pt':'conversation',voice_conversation:true})}));
 assert.equal(r.status,200);assert.equal(body.response_format.json_schema.strict,true);
 assert.equal(body.messages.at(-1).content,message);
 assert.match(body.messages[0].content,/Pergunta em japonês recebe resposta em japonês/);
 assert.match(body.messages[0].content,/pergunta em português recebe resposta em português, inclusive no avançado/);
 }
}
limited=true;
const limitedResponse=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({message:'Olá'})}));
assert.equal(limitedResponse.status,429);assert.equal((await limitedResponse.json()).retry_after,63);
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const section=app.slice(app.indexOf('  async function sendMessage('),app.indexOf('\n  $("#send").onclick'));
let requests=0,scheduled=0,notice='',clock=1000;
const c=vm.createContext({Date:{now:()=>clock},aiCooldownUntil:0,replyPending:false,voiceInputBlocked:false,stopListening:()=>{},voiceGeneration:1,conversationGeneration:1,add:()=>({remove:()=>{}}),endpoint:()=> 'https://example.test',callStatus:t=>notice=t,AbortController,setTimeout:()=>1,clearTimeout:()=>{},replyController:null,lang:'Japonês',headers:async()=>({}),beginnerLesson:()=>true,lessonLevel:'beginner',callMode:'voice',history:[],fetch:async()=>{requests++;return Response.json({error:'rate_limit_exceeded',retry_after:63},{status:429});},speechPending:false,currentAudio:null,nativeUtterance:null,resumeListening:()=>scheduled++,cooldownTicker:null,setInterval:()=>1,clearInterval:()=>{}});
vm.runInContext(app.slice(app.indexOf('  function showCooldown('),app.indexOf('  function resumeListening(')),c);
vm.runInContext(section,c);
await vm.runInContext('sendMessage("こんにちは",1)',c);
assert.equal(requests,1);assert.equal(c.aiCooldownUntil,64000);assert.match(notice,/63 segundos/);
await vm.runInContext('sendMessage("Olá",1)',c);
assert.equal(requests,1,'no extra API requests during provider cooldown');
const resume=app.slice(app.indexOf('  function resumeListening('),app.indexOf('  function closeMouth('));
let delay;
vm.runInNewContext(resume+'\nresumeListening(500)',{clearTimeout:()=>{},listenTimer:0,callMode:'voice',micPaused:false,voiceInputBlocked:false,setTimeout:(fn,ms)=>delay=ms,startListening:()=>{},aiCooldownUntil:64000,Date:{now:()=>1000}});
assert.equal(delay,63000,'automatic listening waits until retry-after expires');
console.log('Passed: bilingual questions at every level, strict speech schema, upstream cooldown propagation and no repeated AI calls during cooldown.');
