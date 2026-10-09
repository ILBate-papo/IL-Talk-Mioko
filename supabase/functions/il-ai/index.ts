import {checkAccess} from "../_shared/access.ts";
const cors={"Access-Control-Allow-Origin":"https://ilbate-papo.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};
Deno.serve(async(req)=>{
 const id=crypto.randomUUID();let key="";
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 const safe=(v)=>{let s=String(v);if(key)s=s.split(key).join("[credencial omitida]");return s.replace(/sk-[A-Za-z0-9_*.-]+/g,"[credencial omitida]").slice(0,2000)};
 const fail=(error,status,stage,code)=>{console.error(JSON.stringify({request_id:id,status,stage,code}));return json({error:safe(error),stage,code,request_id:id},status)};
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({error:"Use POST",stage:"request"},405);
 const origin=req.headers.get("origin");if(origin&&origin!==cors["Access-Control-Allow-Origin"])return fail("Origem não autorizada",403,"request");
 const access=await checkAccess(req); if(!access.allowed)return json({error:access.reason},access.status);
 try{
  const raw=await req.text();if(raw.length>100000)return fail("Solicitação muito grande",413,"request");
  let b;try{b=JSON.parse(raw)}catch{return fail("JSON inválido",400,"request")}
  if(!b||typeof b!=="object"||Array.isArray(b))return fail("Envie um objeto JSON",400,"request");
  const m=typeof b.message==="string"?b.message.trim():"";
  if(!m||m.length>6000)return fail("message deve conter de 1 a 6000 caracteres",400,"request");
  if(b.history!==undefined&&!Array.isArray(b.history))return fail("history deve ser uma lista",400,"request");
  const h=(b.history||[]).slice(-30).filter(x=>x&&(x.role==="user"||x.role==="assistant")&&typeof x.content==="string"&&x.content.trim()).map(x=>({role:x.role,content:x.content.slice(0,6000)}));
  if(h.at(-1)?.role==="user"&&h.at(-1)?.content.trim()===m)h.pop();
  key=Deno.env.get("GROQ_API_KEY")||"";if(!key)return fail("GROQ_API_KEY não configurada no Supabase",503,"configuration");
  const language=typeof b.language==="string"?b.language.slice(0,80):"Japonês";
  const model=Deno.env.get("GROQ_MODEL")||"qwen/qwen3.8-27b";
  const instructions="Você é Mioko, professora virtual de idiomas baseada em IA do IL Talk. Converse naturalmente sobre o assunto pedido e preserve o contexto do histórico. Não imponha uma aula nem repita sua apresentação. Você é uma personagem virtual com inteligência artificial, não uma pessoa humana. Em contas aritméticas simples, responda com o resultado, salvo se pedirem explicação. O idioma selecionado é "+JSON.stringify(language)+". Use exclusivamente esse idioma, exceto quando o aluno pedir traduções ou exemplos em outro idioma. Ao ensinar, adapte explicações e vocabulário ao nível solicitado. Não invente acesso a informações atuais, arquivos, imagens ou sons não recebidos.";
  const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},signal:AbortSignal.timeout(45000),body:JSON.stringify({model,messages:[{role:"system",content:instructions+" Em chamadas de voz, responda em poucas frases naturais e permita que o aluno continue."},...h,{role:"user",content:m}],reasoning_effort:"none",max_tokens:1200})});
  const rawResponse=await r.text();let d;try{d=JSON.parse(rawResponse)}catch{return fail("Groq HTTP "+r.status+": resposta não JSON",502,"groq")}
  if(!r.ok)return fail("Groq HTTP "+r.status+": "+(d?.error?.message||rawResponse),r.status===429?429:502,"groq",d?.error?.code);
  const choice=d.choices?.[0];
  if(choice?.finish_reason==="length")return fail("Groq atingiu o limite de resposta; tente uma pergunta mais curta",502,"groq");
  const answer=choice?.message?.content;
  if(typeof answer!=="string"||!answer.trim())return fail("Groq respondeu sem texto",502,"groq");
  return json({answer:answer.trim(),model,provider:"groq",contract:"mioko-groq-v1",request_id:id});
 }catch(e){const timeout=e?.name==="TimeoutError"||e?.name==="AbortError";return fail(timeout?"Groq excedeu 45 segundos":e?.message||e,timeout?504:502,"upstream")}
});