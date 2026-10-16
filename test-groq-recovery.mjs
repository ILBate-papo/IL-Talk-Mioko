import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const source=readFileSync('supabase/ai/index.ts','utf8').replace(/^import .*;\n/gm,'');
function setup(responses){
  let handler;const requests=[];
  vm.runInNewContext(source,{
    Response,Request,AbortSignal,crypto:webcrypto,
    console:{warn(){},info(){},error(){}},
    Deno:{env:{get:k=>k==='GROQ_API_KEY'?'test-only':undefined}},
    serveWithOrigins:fn=>handler=fn,
    checkAccess:async()=>({allowed:true,role:'member'}),
    profileInstructions:()=>'',subjectInstructions:()=>'',examInstructions:()=>'',needsResearch:()=>false,
    fetch:async(url,options)=>{
      assert.equal(new URL(url).hostname,'api.groq.com','all attempts stay on Groq');
      requests.push(JSON.parse(options.body));
      assert(responses.length,'unexpected extra provider attempt');
      return responses.shift();
    }
  });
  return {requests,ask:()=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({message:'こんにちは',language:'Japonês',learner_level:'advanced',voice_conversation:true})}))};
}
const rate=seconds=>Response.json({error:{code:'rate_limit_exceeded',message:'Limit'}},{status:429,headers:{'retry-after':String(seconds)}});
const format=code=>Response.json({error:{code,message:'Generation failed'}},{status:400});
const success=()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'ja-JP',text:'こんにちは。'}]})}}]});

{
  const s=setup([rate(476),format('json_validate_failed'),success()]);
  const r=await s.ask(),body=await r.json();
  assert.equal(r.status,200);assert.equal(body.provider,'groq');assert.equal(body.speech_segments[0].locale,'ja-JP');
  assert.equal(s.requests.length,3);assert.equal(s.requests[1].response_format.type,'json_schema');assert.equal(s.requests[2].response_format.type,'json_object');
  assert.equal(s.requests[1].model,s.requests[2].model,'recover the available fallback before trying another');
}
{
  const s=setup([rate(476),format('tool_use_failed'),format('json_validate_failed'),format('json_validate_failed'),format('json_validate_failed')]);
  const r=await s.ask(),body=await r.json();
  assert.equal(r.status,502,'mixed quota and format failures must not claim every model is limited');
  assert.notEqual(body.code,'rate_limit_exceeded');assert(!('retry_after' in body));assert.equal(s.requests.length,5);
}
{
  const s=setup([rate(476),rate(30),rate(90)]);const r=await s.ask(),body=await r.json();
  assert.equal(r.status,429);assert.equal(body.retry_after,30,'a real all-model limit keeps the earliest provider retry');
  assert.equal(s.requests.length,3,'rate limits never trigger JSON-mode retries');
}
{
  const invalid=Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'en-US',text:'Hello'}]})}}]});
  const s=setup([rate(476),format('json_validate_failed'),invalid,success()]);const r=await s.ask();
  assert.equal(r.status,200);assert.equal((await r.json()).speech_segments[0].locale,'ja-JP','JSON recovery must still validate the selected language');
}
{
  const s=setup([Response.json({error:{code:'invalid_api_key',message:'Invalid key'}},{status:401})]);
  assert.equal((await s.ask()).status,502);assert.equal(s.requests.length,1,'credential failures are not retried');
}
console.log('Passed: Groq-only routing, schema recovery, no false quota timer, genuine rate-limit handling, language validation and credential protection.');
