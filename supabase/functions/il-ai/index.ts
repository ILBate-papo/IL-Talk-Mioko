import {checkAccess} from "./access.ts";
import {profileInstructions} from "./profile.ts";
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
  const voiceTurn=b.voice_conversation===true;
  const h=(b.history||[]).slice(voiceTurn?-8:-30).filter(x=>x&&(x.role==="user"||x.role==="assistant")&&typeof x.content==="string"&&x.content.trim()).map(x=>({role:x.role,content:x.content.slice(0,6000)}));
  if(h.at(-1)?.role==="user"&&h.at(-1)?.content.trim()===m)h.pop();
  key=Deno.env.get("GROQ_API_KEY")||"";if(!key)return fail("GROQ_API_KEY não configurada no Supabase",503,"configuration");
  const language=typeof b.language==="string"?b.language.slice(0,80):"Japonês";
  const model=Deno.env.get("GROQ_MODEL")||"qwen/qwen3.8-27b";
  const learnerLevel=["beginner","intermediate","advanced"].includes(b.learner_level)?b.learner_level:(["foreign_beginner_pt","japanese_beginner_pt"].includes(b.teaching_mode)?"beginner":"advanced");
  const levelInstructions=" NÍVEL DO ALUNO: "+learnerLevel+". Adapte o vocabulário, a complexidade e as correções a esse nível e ao que o aluno demonstra. No nível avançado, pratique conversação natural no idioma selecionado; não traduza tudo para português. Só mude o idioma quando o aluno pedir tradução ou explicação. No intermediário, use frases acessíveis no idioma estudado e apoio em português quando solicitado ou quando o aluno demonstrar dificuldade. No curso de português, use português brasileiro em todos os níveis.";
  const beginnerSupport=["Japonês","Inglês","Espanhol","Francês","Coreano","Italiano"].includes(language) && ["foreign_beginner_pt","japanese_beginner_pt"].includes(b.teaching_mode);
  const instructions="Você é Mioko, professora virtual de idiomas baseada em IA do IL Talk. Converse naturalmente sobre o assunto pedido e preserve o contexto do histórico. Não imponha uma aula nem repita sua apresentação. Você é uma personagem virtual com inteligência artificial, não uma pessoa humana. Em contas aritméticas simples, responda com o resultado, salvo se pedirem explicação. O idioma selecionado é "+JSON.stringify(language)+". Em conversação normal, use esse idioma, exceto traduções ou exemplos pedidos. Quando ensinar japonês para quem conversa em português, explique em português e escreva os exemplos com kana ou kanji corretos, acompanhados de tradução. Nunca use grafia aportuguesada como substituto da escrita japonesa. Não presuma conhecimento prévio; adapte o nível às respostas do aluno. Não invente acesso a informações atuais, arquivos, imagens ou sons não recebidos.";
  const lessonInstructions=beginnerSupport ? " MODO IDIOMAS PARA INICIANTES: o idioma de estudo é "+language+". explique em português brasileiro e use o idioma de estudo apenas nos exemplos e exercícios. O aluno pode perguntar em português. Converse em português brasileiro. Só fale um exemplo no idioma estudado quando o aluno pedir uma frase, tradução, como se fala algo ou um exercício. Não repita exemplos automaticamente em toda resposta. Quando solicitado, ensine uma expressão curta por vez, com significado e uso. Não responda totalmente no idioma estrangeiro neste modo. No japonês, escreva os exemplos em kana/kanji; não apresente aproximações portuguesas de pronúncia. Não inclua romanização na fala; pronuncie o exemplo apenas no idioma original. Não imponha uma aula se o aluno pedir outro assunto." : "";
  const speechFormat=" FORMATO OBRIGATÓRIO: responda apenas com um objeto JSON válido {\"segments\":[{\"locale\":\"pt-BR\",\"text\":\"texto\"}]}, sem cercas Markdown. Cada segmento deve conter fala em UM idioma. Locales permitidos: pt-BR, ja-JP, en-US, es-ES, fr-FR, ko-KR, it-IT. Separe cada exemplo estrangeiro da explicação portuguesa: inglês deve usar en-US e japonês deve usar ja-JP, nunca pt-BR. Não traduza nem altere o exemplo ao separar. Preserve a ordem natural. Em conversação no idioma selecionado, use os segmentos daquele idioma. Não inclua romanização ou pronúncia aportuguesada no campo text. Em japonês, use escrita japonesa correta. O texto dos segmentos será exibido e falado.";
  const turnInstructions=voiceTurn ? " CONVERSA DE VOZ: responda imediatamente ao assunto em um turno curto de no máximo 45 palavras e 3 segmentos. Use uma ou duas frases naturais; permita que o aluno continue. No modo iniciante, responda em português; inclua apenas um exemplo estrangeiro curto se o aluno pedir uma frase, tradução ou exercício. Não faça listas nem repita apresentações ou o mesmo exemplo em romanização. Se pedirem explicação longa, divida em etapas e ofereça continuar." : "";
  const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},signal:AbortSignal.timeout(45000),body:JSON.stringify({model,messages:[{role:"system",content:instructions+levelInstructions+lessonInstructions+speechFormat+" "+profileInstructions(access.role==="admin")+turnInstructions},...h,{role:"user",content:m}],reasoning_effort:"none",max_tokens:voiceTurn?400:1200})});
  const rawResponse=await r.text();let d;try{d=JSON.parse(rawResponse)}catch{return fail("Groq HTTP "+r.status+": resposta não JSON",502,"groq")}
  if(!r.ok)return fail("Groq HTTP "+r.status+": "+(d?.error?.message||rawResponse),r.status===429?429:502,"groq",d?.error?.code);
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
