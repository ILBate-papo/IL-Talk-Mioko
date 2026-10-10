import {checkAccess} from "./access.ts";
import {profileInstructions} from "./profile.ts";
const cors={"Access-Control-Allow-Origin":"https://ilbate-papo.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};
Deno.serve(async(req)=>{
 const id=crypto.randomUUID();let key="";
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 const safe=(v)=>{let s=String(v);if(key)s=s.split(key).join("[credencial omitida]");return s.replace(/sk-[A-Za-z0-9_*.-]+/g,"[credencial omitida]").slice(0,2000)};
 const fail=(error,status,stage,code,retryAfter)=>{console.error(JSON.stringify({request_id:id,status,stage,code}));return json({error:safe(error),stage,code,retry_after:retryAfter,request_id:id},status)};
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
  const voiceTurn=b.voice_conversation===true;
  const h=(b.history||[]).slice(voiceTurn?-8:-30).filter(x=>x&&(x.role==="user"||x.role==="assistant")&&typeof x.content==="string"&&x.content.trim()).map(x=>({role:x.role,content:x.content.slice(0,6000)}));
  if(h.at(-1)?.role==="user"&&h.at(-1)?.content.trim()===m)h.pop();
  key=Deno.env.get("GROQ_API_KEY")||"";if(!key)return fail("GROQ_API_KEY não configurada no Supabase",503,"configuration");
  const language=typeof b.language==="string"?b.language.slice(0,80):"Japonês";
  const model=Deno.env.get("GROQ_MODEL")||"qwen/qwen3.8-27b";
  const learnerLevel=["beginner","intermediate","advanced"].includes(b.learner_level)?b.learner_level:(["foreign_beginner_pt","japanese_beginner_pt"].includes(b.teaching_mode)?"beginner":"advanced");
  const levelInstructions=" NÍVEL DO ALUNO: "+learnerLevel+". Adapte vocabulário e complexidade. No nível avançado, pratique conversação natural no idioma selecionado quando o aluno usar esse idioma; sem tradução automática. No intermediário, ofereça apoio quando solicitado. O nível não impede perguntas em outro idioma.";
  const beginnerSupport=["Japonês","Inglês","Espanhol","Francês","Coreano","Italiano"].includes(language) && ["foreign_beginner_pt","japanese_beginner_pt"].includes(b.teaching_mode);
  const instructions="Você é Mioko, professora virtual de IA do IL Talk. Responda naturalmente ao assunto, preservando o contexto, sem impor aulas ou repetir apresentações. Curso: "+JSON.stringify(language)+". REGRA BILÍNGUE PRIORITÁRIA EM TODOS OS NÍVEIS: identifique o idioma da pergunta atual e responda nesse idioma. Pergunta em japonês recebe resposta em japonês; pergunta em português recebe resposta em português, inclusive no avançado. Faça o mesmo nos demais idiomas. Se o aluno pedir tradução ou outro idioma, siga o pedido. Não traduza toda resposta automaticamente. Não invente acesso a dados atuais ou mídia não recebida.";
  const lessonInstructions=beginnerSupport ? " INICIANTE: quando a pergunta for em português, explique em português brasileiro. Só fale um exemplo no idioma estudado quando o aluno pedir uma frase, tradução, como se fala algo ou exercício. Perguntas no idioma estudado recebem resposta simples nesse idioma, mesmo no iniciante. Não repita exemplos automaticamente." : "";
  const speechFormat=" Return only JSON {\"segments\":[{\"locale\":\"pt-BR\",\"text\":\"texto\"}]}. Each segment contains ONE language, labeled with its correct locale: pt-BR, ja-JP, en-US, es-ES, fr-FR, ko-KR, it-IT. Separate foreign examples from Portuguese explanations. Japanese text must use correct kana/kanji. No romanization or Portuguese phonetic spelling. Segment text is displayed and spoken.";
  const turnInstructions=voiceTurn ? " CONVERSA DE VOZ: no máximo 45 palavras e 3 segmentos, uma ou duas frases. Responda ao assunto e permita continuar. Sem listas ou apresentações. Explicações longas em etapas se solicitadas." : "";
  const responseFormat=["qwen/qwen3.8-27b","openai/gpt-oss-20b","openai/gpt-oss-120b"].includes(model)?{type:"json_schema",json_schema:{name:"mioko_speech",strict:true,schema:{type:"object",properties:{segments:{type:"array",items:{type:"object",properties:{locale:{type:"string",enum:["pt-BR","ja-JP","en-US","es-ES","fr-FR","ko-KR","it-IT"]},text:{type:"string"}},required:["locale","text"],additionalProperties:false}}},required:["segments"],additionalProperties:false}}}:{type:"json_object"};
  const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},signal:AbortSignal.timeout(45000),body:JSON.stringify({model,messages:[{role:"system",content:instructions+levelInstructions+lessonInstructions+speechFormat+" "+profileInstructions(access.role==="admin")+turnInstructions},...h,{role:"user",content:m}],reasoning_effort:"none",response_format:responseFormat,max_tokens:voiceTurn?400:1200})});
  const rawResponse=await r.text();let d;try{d=JSON.parse(rawResponse)}catch{return fail("Groq HTTP "+r.status+": resposta não JSON",502,"groq")}
  if(!r.ok){
   const duration=String(d?.error?.message||"").match(/try again in ([0-9.hms ]+)/i)?.[1]||"";
   const seconds=[...duration.matchAll(/([0-9.]+)\s*(h|ms|m|s)/g)].reduce((n,x)=>n+Number(x[1])*(x[2]==="h"?3600:x[2]==="m"?60:x[2]==="ms"?.001:1),0);
   const retryAfter=r.status===429?Math.ceil(Number(r.headers.get("retry-after"))||seconds||60):undefined;
   return fail("Groq HTTP "+r.status+": "+(d?.error?.message||rawResponse),r.status===429?429:502,"groq",d?.error?.code,retryAfter);
  }
  const choice=d.choices?.[0];
  if(choice?.finish_reason==="length")return fail("Groq atingiu o limite de resposta; tente uma pergunta mais curta",502,"groq");
  const answer=choice?.message?.content;
  if(typeof answer!=="string"||!answer.trim())return fail("Groq respondeu sem texto",502,"groq");
  let spoken;try{spoken=JSON.parse(answer.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""))}catch{return fail("A resposta não veio no formato de fala. Tente novamente.",502,"speech_format")};
  const locales=new Set(["pt-BR","ja-JP","en-US","es-ES","fr-FR","ko-KR","it-IT"]);
  if(!Array.isArray(spoken?.segments)||!spoken.segments.length||spoken.segments.length>50||spoken.segments.some(x=>!x||!locales.has(x.locale)||typeof x.text!=="string"||!x.text.trim()||x.text.length>6000))return fail("A resposta veio com trechos de fala inválidos. Tente novamente.",502,"speech_format");
  const segments=spoken.segments.map(x=>({locale:x.locale,text:x.text.trim()}));
  return json({answer:segments.map(x=>x.text).join("\n"),speech_segments:segments,model,provider:"groq",contract:"mioko-groq-v2-segments",request_id:id});
 }catch(e){const timeout=e?.name==="TimeoutError"||e?.name==="AbortError";return fail(timeout?"Groq excedeu 45 segundos":e?.message||e,timeout?504:502,"upstream")}
});
