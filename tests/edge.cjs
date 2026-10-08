const fs=require('fs'),vm=require('vm'),assert=require('assert');
async function check(file,body){
 let handler,payload;
 const source=fs.readFileSync(file,'utf8').replace(/:any\b/g,'');
 const context={Deno:{env:{get:k=>k==='OPENAI_API_KEY'?'test-not-a-real-key':undefined},serve:f=>handler=f},Response,fetch:async(url,opts)=>{payload=JSON.parse(opts.body);return new Response(JSON.stringify({error:{code:'insufficient_quota',message:'No credits remaining'}}),{status:429,headers:{'Retry-After':'3600'}})}};
 vm.runInNewContext(source,context);
 const result=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}));
 assert.equal(result.status,429);const data=await result.json();assert.equal(data.origin,'openai');assert.equal(data.code,'insufficient_quota');assert.equal(result.headers.get('retry-after'),'3600');
 if(payload.instructions)assert(payload.instructions.includes('Japonês'));
 console.log(file+': real status/code/retry preserved (simulated provider)');
}
(async()=>{await check('supabase/functions/il-ai/index.ts',{message:'Olá',language:'Japonês',history:[]});await check('supabase/functions/il-voice/index.ts',{text:'こんにちは',language:'Japonês'});})().catch(e=>{console.error(e);process.exit(1)});
