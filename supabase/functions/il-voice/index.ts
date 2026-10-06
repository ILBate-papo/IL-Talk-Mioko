const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const {text,language}=await req.json();
    const key=Deno.env.get("OPENAI_API_KEY");
    if(!key) throw new Error("OPENAI_API_KEY não configurada");
    const input=String(text||"").replace(/[*#_`~]+/g," ").replace(/https?:\/\/\S+/g," ").replace(/\s+/g," ").trim().slice(0,3500);
    if(!input) throw new Error("Texto vazio");
    const lang=String(language||"Português");
    const instructions=`Fale com voz feminina adulta, natural, acolhedora e didática. Pronuncie corretamente o idioma ${lang}. Em japonês, respeite a pronúncia japonesa nativa. Em português, use português brasileiro natural. Leia números pelo seu valor normal quando forem quantidades. Não verbalize símbolos de Markdown.`;
    const r=await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_TTS_MODEL")||"gpt-4o-mini-tts",voice:Deno.env.get("OPENAI_TTS_VOICE")||"coral",input,instructions,response_format:"mp3"})});
    if(!r.ok) throw new Error(`OpenAI áudio HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
    return new Response(await r.arrayBuffer(),{status:200,headers:{...cors,"Content-Type":"audio/mpeg","Cache-Control":"no-store"}});
  }catch(e){return new Response(JSON.stringify({error:String(e?.message||e)}),{status:500,headers:{...cors,"Content-Type":"application/json"}})}
});
