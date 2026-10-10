import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL(existsSync(new URL('./ai/index.ts',import.meta.url))?'./ai/index.ts':'./supabase/functions/il-ai/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function setup(responses){let handler,requests=[];vm.runInNewContext(source,{Deno:{env:{get:k=>k==='GROQ_API_KEY'?'mock-key':undefined},serve:f=>handler=f},checkAccess:async()=>({allowed:true,role:'member'}),profileInstructions:()=>'',crypto:{randomUUID:()=> 'mock'},Response,AbortSignal,console:{warn:()=>{},info:()=>{},error:()=>{}},fetch:async(url,options)=>{requests.push(JSON.parse(options.body));const next=responses.shift();if(next instanceof Error)throw next;assert(next,'no unexpected extra upstream attempts');return next;}});return {handler,requests};}
const success=()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'ja-JP',text:'はい、元気です。あなたは？'}]})}}]});
const rate=(wait)=>Response.json({error:{code:'rate_limit_exceeded',message:'Rate limit'}},{status:429,headers:{'retry-after':String(wait)}});
const ask=()=>new Request('https://example.test',{method:'POST',body:JSON.stringify({message:'元気ですか？',language:'Japonês',learner_level:'advanced',voice_conversation:true,history:Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'長'.repeat(4000)}))})});
{
 const c=setup([rate(277),success(),success()]);
 const r=await c.handler(ask());assert.equal(r.status,200);const d=await r.json();assert.equal(d.model,'openai/gpt-oss-120b');assert.equal(d.speech_segments[0].locale,'ja-JP');
 assert.equal(c.requests[0].model,'qwen/qwen3.8-27b');assert.equal(c.requests[1].reasoning_effort,'low');assert.equal(c.requests[1].response_format.json_schema.strict,true);
 assert.equal(c.requests[1].messages.length,6);assert(c.requests[1].messages.slice(1,-1).every(x=>x.content.length<=360));
 assert.equal((await c.handler(ask())).status,200);assert.equal(c.requests[2].model,'openai/gpt-oss-120b','blocked primary is skipped while its cooldown lasts');
}
{
 const c=setup([rate(277),rate(30),rate(127)]);const r=await c.handler(ask());assert.equal(r.status,429);assert.equal((await r.json()).retry_after,30,'wait only for earliest available model');assert.equal(c.requests.length,3);
}
{
 const c=setup([Response.json({error:{message:'Invalid key'}},{status:401})]);assert.equal((await c.handler(ask())).status,502);assert.equal(c.requests.length,1,'invalid credentials must not trigger retries');
}
{
 const c=setup([Response.json({choices:[{finish_reason:'length',message:{content:'partial'}}]}),success()]);assert.equal((await c.handler(ask())).status,200);assert.equal(c.requests.length,2,'truncated output uses alternative instead of silence');
}
{
 const e=new Error('deadline');e.name='TimeoutError';const c=setup([e,success()]);assert.equal((await c.handler(ask())).status,200);assert.equal(c.requests.length,2);
}
console.log('Passed: same-question recovery from primary rate limit, Japanese speech preserved, bounded history, cooldown skip, all-model exhaustion, credential protection, truncation and timeout fallback.');
