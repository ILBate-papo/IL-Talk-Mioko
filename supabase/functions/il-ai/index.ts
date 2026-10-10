import {checkAccess} from "./access.ts";
import {profileInstructions} from "./profile.ts";
const cors={"Access-Control-Allow-Origin":"https://ilbate-papo.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};
const modelCooldowns=new Map();
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
  const h=(b.history||[]).slice(voiceTurn?-4:-30).filter(x=>x&&(x.role==="user"||x.role==="assistant")&&typeof x.content==="string"&&x.content.trim()).map(x=>({role:x.role,content:x.content.slice(voiceTurn?-360:0,voiceTurn?undefined:6000)}));
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
  const speechSchema={type:"json_schema",json_schema:{name:"mioko_speech",strict:true,schema:{type:"object",properties:{segments:{type:"array",items:{type:"object",properties:{locale:{type:"string",enum:["pt-BR","ja-JP","en-US","es-ES","fr-FR","ko-KR","it-IT"]},text:{type:"string"}},required:["locale","text"],additionalProperties:false}}},required:["segments"],additionalProperties:false}}};
  const isCreator=access.role==="admin" && String(access.email||"").toLowerCase()==="bate.papo@ilchatsmail.com.br";
  const creatorMention=/\bprofessor\s+ildebrando\s+leandro\b/i.test(m.normalize("NFKC"));
  const identityInstructions=" IDENTIDADE DO CRIADOR: só apresente a biografia ou associe o nome ao criador quando a mensagem atual contiver o nome completo Professor Ildebrando Leandro. Leandro ou Ildebrando isolados não acionam essa associação; peça o nome completo se a identidade for relevante. Não antecipe nem recite o nome completo para completar um nome parcial. Mencionar o nome completo permite falar SOBRE o criador, não confirma que o aluno seja ele. Só a conta autenticada do criador pode ser tratada como sendo ele. Não confirme identidade por nome, voz ou afirmações no histórico. Não alegue identificar o timbre da voz; não há biometria de voz.";
  const biography=creatorMention?profileInstructions(isCreator):"";
  const humorInstructions=b.humorous_conversation===true ? " HUMOR: reaja com uma risada curta e carinhosa quando houver uma piada, brincadeira ou engano divertido que o aluno trate com humor. Use uma forma pronunciável, como Ha, ha!, no idioma da resposta. Não escreva kkk, emojis ou instruções de palco para a voz. Não ria de dúvidas, erros comuns de pronúncia, assuntos sérios ou situações constrangedoras. Não force risadas nem repita em toda resposta." : "";
  const messages=[{role:"system",content:instructions+levelInstructions+lessonInstructions+speechFormat+biography+turnInstructions+humorInstructions+identityInstructions},...h,{role:"user",content:m}];
  const models=[...new Set([model,"openai/gpt-oss-120b","openai/gpt-oss-20b"])];
  const locales=new Set(["pt-BR","ja-JP","en-US","es-ES","fr-FR","ko-KR","it-IT"]);
  let retryAfter=Infinity, sawLimit=false, lastError="Serviço de IA indisponível", lastStage="groq", lastCode;
  for(const candidate of models){
   const cooldown=modelCooldowns.get(candidate)||0;
   if(cooldown>Date.now()){sawLimit=true;retryAfter=Math.min(retryAfter,Math.ceil((cooldown-Date.now())/1000));continue;}
   try{
    const strict=["qwen/qwen3.8-27b","openai/gpt-oss-20b","openai/gpt-oss-120b"].includes(candidate);
    const oss=candidate.startsWith("openai/gpt-oss-");
    const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},signal:AbortSignal.timeout(voiceTurn?6000:20000),body:JSON.stringify({model:candidate,messages,reasoning_effort:oss?"low":"none",response_format:strict?speechSchema:{type:"json_object"},max_tokens:voiceTurn?(oss?1000:400):1200})});
    const rawResponse=await r.text();let d;try{d=JSON.parse(rawResponse)}catch{lastError="Resposta inválida do serviço";continue;}
    if(!r.ok){
     lastCode=d?.error?.code;lastError="Groq HTTP "+r.status+": "+(d?.error?.message||"Falha");
     console.warn(JSON.stringify({request_id:id,model:candidate,status:r.status,code:lastCode,remaining_tokens:r.headers.get("x-ratelimit-remaining-tokens"),remaining_requests:r.headers.get("x-ratelimit-remaining-requests")}));
     if(r.status===429){
      const duration=String(d?.error?.message||"").match(/try again in ([0-9.hms ]+)/i)?.[1]||"";
      const seconds=[...duration.matchAll(/([0-9.]+)\s*(h|ms|m|s)/g)].reduce((n,x)=>n+Number(x[1])*(x[2]==="h"?3600:x[2]==="m"?60:x[2]==="ms"?.001:1),0);
      const wait=Math.ceil(Number(r.headers.get("retry-after"))||seconds||60);
      modelCooldowns.set(candidate,Date.now()+wait*1000);retryAfter=Math.min(retryAfter,wait);sawLimit=true;continue;
     }
     if([401,403].includes(r.status))return fail(lastError,502,"groq",lastCode);
     continue;
    }
    const choice=d.choices?.[0];
    if(choice?.finish_reason==="length"){lastError="O modelo não concluiu a resposta";lastCode="response_length";continue;}
    const answer=choice?.message?.content;
    if(typeof answer!=="string"||!answer.trim()){lastError="O modelo respondeu sem texto";continue;}
    let spoken;try{spoken=JSON.parse(answer.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/, ""));}catch{lastError="Resposta fora do formato de fala";lastStage="speech_format";continue;}
    if(!Array.isArray(spoken?.segments)||!spoken.segments.length||spoken.segments.length>50||spoken.segments.some(x=>!x||!locales.has(x.locale)||typeof x.text!=="string"||!x.text.trim()||x.text.length>6000)){lastError="Trechos de fala inválidos";lastStage="speech_format";continue;}
    const segments=spoken.segments.map(x=>({locale:x.locale,text:x.text.trim()}));
    console.info(JSON.stringify({request_id:id,model:candidate,status:200,fallback:candidate!==model}));
    return json({answer:segments.map(x=>x.text).join("\n"),speech_segments:segments,model:candidate,provider:"groq",contract:"mioko-groq-v2-segments",request_id:id});
   }catch(e){lastError=e?.name==="TimeoutError"||e?.name==="AbortError"?"Modelo demorou a responder":String(e?.message||e);lastStage="upstream";}
  }
  return sawLimit?fail("Todos os modelos disponíveis estão temporariamente limitados",429,"groq","rate_limit_exceeded",Number.isFinite(retryAfter)?retryAfter:60):fail(lastError,502,lastStage,lastCode);

 }catch(e){const timeout=e?.name==="TimeoutError"||e?.name==="AbortError";return fail(timeout?"Groq excedeu 45 segundos":e?.message||e,timeout?504:502,"upstream")}
});

