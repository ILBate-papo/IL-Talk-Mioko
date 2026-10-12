import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({URL,Response,Request,AbortSignal,Date,console,crypto,
 Deno:{env:{get:k=>k==='GROQ_API_KEY'?'test-key':undefined},serve:fn=>context.handler=fn},
 checkAccess:async()=>({allowed:true,role:'member'}),profileInstructions:()=> 'CREATOR BIOGRAPHY'});
for(const name of ['research','exams']) vm.runInContext(readFileSync('supabase/ai/'+name+'.ts','utf8').replace(/export /g,''),context);
assert(vm.runInContext('needsResearch("salário e custo de vida no Japão")',context));
assert(!vm.runInContext('needsResearch("こんにちは、元気ですか？")',context));
assert(vm.runInContext('examInstructions("portugal_entry").toLowerCase().includes("antes do estágio")',context));
assert(vm.runInContext('examInstructions("portugal_oral").includes("estimativa")',context));
assert.equal(vm.runInContext('examInstructions("fake")',context),'');
context.fetch=async()=>Response.json({choices:[{message:{content:'Invented https://not-real.example/article'}}]});
assert.equal((await vm.runInContext('researchCurrent("notícias", "test")',context)).ok,false,'final prose alone never establishes sources');
context.fetch=async()=>Response.json({choices:[{message:{content:'Current primary evidence, dated.',executed_tools:[{type:'browser_search',output:{url:'https://portal.oa.pt/example'}}]}}]});
const researched=await vm.runInContext('researchCurrent("edital", "test")',context);
assert.equal(researched.ok,true);assert.equal(researched.sources[0],'https://portal.oa.pt/example');
context.fetch=async()=>Response.json({error:'denied'},{status:403});
assert.equal((await vm.runInContext('researchCurrent("edital", "test")',context)).ok,false);
let providerRequests=[];
context.fetch=async(url,args)=>{
 const body=JSON.parse(args.body);providerRequests.push(body);
 if(body.tools)return Response.json({choices:[{message:{content:'Verified observation.',executed_tools:[{output:{url:'https://portal.oa.pt/example'}}]}}]});
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'pt-BR',text:'Vamos preparar a prova oral.'}]})}}]});
};
vm.runInContext(readFileSync('supabase/ai/index.ts','utf8').replace(/^import .*;\n/gm,''),context);
const response=await context.handler(new Request('https://test',{method:'POST',body:JSON.stringify({message:'Qual edital?',exam_mode:'portugal_oral',language:'Português',learner_level:'advanced'})}));
assert.equal(response.status,200);const result=await response.json();assert.equal(result.research_status,'verified');assert.equal(result.sources[0],'https://portal.oa.pt/example');
assert(providerRequests[1].messages[0].content.includes('PROVA ORAL'));
assert.equal((await context.handler(new Request('https://test',{method:'POST',headers:{origin:'https://untrusted.example'},body:'{}'}))).status,403);
console.log('Passed: research trigger, verified tool evidence, unavailable-source handling, exam routes, sourced response contract and origin protection (mocked upstream).');

const posts=[],clockWindow={top:null,MiokoVoiceBridge:{postMessage:x=>posts.push(JSON.parse(x))},MiokoAvatar:{closeMouth(){}},addEventListener(){}};clockWindow.top=clockWindow;
vm.runInNewContext(readFileSync('android/app/src/main/assets/native-voice.js','utf8'),{window:clockWindow,setTimeout,clearTimeout,setInterval,clearInterval,Blob,Uint8Array,atob,performance});
await assert.rejects(clockWindow.MiokoNativeClock.setAlarm(25,0),/inválido/);
const alarm=clockWindow.MiokoNativeClock.setAlarm(7,30);assert.equal(posts.at(-1).action,'clock-set');
clockWindow.__miokoNativeEvent({id:posts.at(-1).id,type:'clock-opened'});assert.equal((await alarm).opened,true);
const failed=clockWindow.MiokoNativeClock.setAlarm(8,0);clockWindow.__miokoNativeEvent({id:posts.at(-1).id,type:'clock-error',error:'No clock app'});await assert.rejects(failed,/No clock/);
console.log('Passed: native Clock request, valid times, UI-open acknowledgement and error handling.');
let attempts=0;
context.fetch=async()=>{attempts++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:attempts===1?'en-US':'ja-JP',text:attempts===1?'Hello.':'こんにちは。'}]})}}]});};
const immersion=await context.handler(new Request('https://test',{method:'POST',body:JSON.stringify({message:'こんにちは',language:'Japonês',learner_level:'advanced'})}));
assert.equal(immersion.status,200);assert.equal((await immersion.json()).speech_segments[0].locale,'ja-JP');assert.equal(attempts,2);
console.log('Passed: advanced Japanese rejects an English response and recovers in Japanese.');
