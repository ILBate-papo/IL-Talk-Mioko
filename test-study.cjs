const fs=require('fs');const vm=require('vm');const assert=require('assert/strict');
let allowed=true,upstreamCalls=0,captured;
const context={Response,AbortSignal,console,checkAccess:async()=>({allowed,status:403,reason:'Acesso não liberado.'}),Deno:{env:{get:()=> 'test-key'},serve:()=>{}},fetch:async(_url,opts)=>{upstreamCalls++;captured=JSON.parse(opts.body);return Response.json({choices:[{message:{content:'Explicação de teste'},finish_reason:'stop'}]});}};
vm.createContext(context);let code=fs.readFileSync(__dirname+'/supabase/functions/il-study/index.ts','utf8').replace(/^import[^\n]*\n/,'').replace('export async function','async function');vm.runInContext(code,context);
const req=body=>new Request('https://example.test',{method:'POST',body:JSON.stringify(body)});
(async()=>{
 assert.equal((await context.handleStudy(new Request('https://example.test',{method:'OPTIONS'}))).status,204);
 allowed=false;assert.equal((await context.handleStudy(req({message:'Olá'}))).status,403);assert.equal(upstreamCalls,0);allowed=true;
 assert.equal((await context.handleStudy(req({message:'x',images:[{label:'x',url:'https://example.test/private'}]}))).status,400);assert.equal(upstreamCalls,0);
 assert.equal((await context.handleStudy(req({message:'x',images:Array(4).fill({label:'p',url:'data:image/jpeg;base64,AAAA'})}))).status,400);
 assert.equal((await context.handleStudy(req({message:'x',material:'x'.repeat(18001)}))).status,400);
 const response=await context.handleStudy(req({message:'Explique',purpose:'exam',images:[{label:'Laudo — página 2',url:'data:image/jpeg;base64,AAAA'}]}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.answer,'Explicação de teste');assert.equal(data.pages[0],'Laudo — página 2');assert.equal(captured.model,'qwen/qwen3.8-27b');assert.match(captured.messages[0].content,/Não diagnostique/);assert.equal(captured.messages[1].content[2].image_url.url,'data:image/jpeg;base64,AAAA');assert.match(captured.messages[0].content,/gabarito/);
 context.fetch=async()=>Response.json({error:{code:'rate_limit'}},{status:429,headers:{'retry-after':'12'}});const limited=await context.handleStudy(req({message:'Explique',material:'questão'}));assert.equal(limited.status,429);assert.equal((await limited.json()).retry_after,12);
 context.fetch=async()=>Response.json({choices:[{message:{content:'Parcial'},finish_reason:'length'}]});assert.equal((await (await context.handleStudy(req({message:'Explique',material:'questão'}))).json()).incomplete,true);
 console.log('Study endpoint: auth, input limits, images, medical instructions, rate limit and partial output passed.');
})();
