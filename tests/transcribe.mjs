import assert from 'node:assert/strict';
let handler, submitted, responseStatus=200;
globalThis.Deno={env:{get:key=>key==='OPENAI_API_KEY'?'test-key-not-a-secret':undefined},serve:fn=>handler=fn};
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');submitted=options.body;
 return new Response(JSON.stringify(responseStatus===200?{text:'pergunta de teste'}:{error:{code:'insufficient_quota',message:'No credits remaining'}}),{status:responseStatus,headers:{'Retry-After':'3600'}});
};
await import('../supabase/functions/il-transcribe/index.ts');
assert.equal((await handler(new Request('https://test.invalid',{method:'GET'}))).status,405);
assert.equal((await handler(new Request('https://test.invalid',{method:'OPTIONS'}))).status,200);
assert.equal((await handler(new Request('https://test.invalid',{method:'POST',body:new FormData()}))).status,400);
for(const [name,code]of Object.entries({Português:'pt',Japonês:'ja',Inglês:'en',Espanhol:'es',Francês:'fr',Coreano:'ko',Italiano:'it'})){
 const form=new FormData();form.set('language',name);form.set('file',new Blob([new Uint8Array(100)],{type:'audio/wav'}),'test.wav');
 const r=await handler(new Request('https://test.invalid',{method:'POST',body:form}));assert.equal(r.status,200);assert.equal((await r.json()).text,'pergunta de teste');assert.equal(submitted.get('language'),code);
}
responseStatus=429;
const form=new FormData();form.set('language','Português');form.set('file',new Blob(['test'],{type:'audio/wav'}),'test.wav');
const r=await handler(new Request('https://test.invalid',{method:'POST',body:form}));assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'3600');assert.equal((await r.json()).code,'insufficient_quota');
console.log('PASS: real TS source, multipart file and seven language codes, method validation, provider status/code/retry preserved. Provider responses simulated.');
