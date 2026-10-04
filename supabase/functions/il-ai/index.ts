const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json"
};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const body=await req.json();
    const key=Deno.env.get("OPENAI_API_KEY");
    if(!key) throw new Error("OPENAI_API_KEY não configurada no Supabase");

    const language=String(body.language||"Japonês");
    const message=String(body.message||"").trim().slice(0,6000);
    const history=Array.isArray(body.history)?body.history.slice(-16):[];
    if(!message) throw new Error("Mensagem vazia");

    const instructions=`Você é Mioko, Professora Virtual de Idiomas do IL Talk Cursos de Idiomas.
Você é uma inteligência artificial e sabe que seu nome é Mioko.
Converse naturalmente como uma assistente inteligente de uso geral e também ensine idiomas quando o usuário pedir.
RESPONDA PRIMEIRO à pergunta real do usuário. Não force uma aula em toda resposta.
Mantenha o contexto da conversa. Não repita sua apresentação a cada turno.
O curso selecionado é ${language}. Quando estiver ensinando, adapte vocabulário, velocidade e dificuldade ao nível do aluno.
Se o aluno não entender, explique brevemente em português e depois repita no idioma estudado.
Em japonês, use linguagem natural e, quando adequado, explique kana, kanji, leitura, formalidade e keigo.
Não invente que viu, ouviu ou abriu algo que não recebeu.
Para matemática e fatos objetivos, responda corretamente e de forma direta.
Se perguntarem "0 + 0", a resposta matemática é 0.
O aluno pode usar somente texto; nunca exija microfone ou câmera.`;

    const input=[
      ...history.map((x:any)=>({
        role:x?.role==="assistant"?"assistant":"user",
        content:String(x?.content||"").slice(0,3000)
      })),
      {role:"user",content:message}
    ];

    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:Deno.env.get("OPENAI_MODEL")||"gpt-6-luna",
        instructions,
        input,
        reasoning:{effort:"medium"},
        max_output_tokens:1200
      })
    });

    const d=await r.json();
    if(!r.ok) throw new Error(d?.error?.message||`OpenAI HTTP ${r.status}`);

    const answer=d.output_text ||
      (d.output||[]).flatMap((x:any)=>x.content||[])
        .find((x:any)=>x.type==="output_text")?.text;

    if(!answer) throw new Error("OpenAI respondeu sem texto");
    return new Response(JSON.stringify({
      answer,
      contract:"mioko-v51",
      model:Deno.env.get("OPENAI_MODEL")||"gpt-6-luna"
    }),{status:200,headers:cors});
  }catch(e){
    return new Response(JSON.stringify({error:String(e?.message||e)}),{status:500,headers:cors});
  }
});