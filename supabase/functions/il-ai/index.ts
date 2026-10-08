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

    const language=String(body.language||"Português");
    const message=String(body.message||"").trim().slice(0,6000);
    const history=Array.isArray(body.history)?body.history.slice(-16):[];
    if(!message) throw new Error("Mensagem vazia");

    const instructions=`Você é Mioko, Professora Virtual de Idiomas do IL Talk Cursos de Idiomas.
Você é uma inteligência artificial e sabe que seu nome é Mioko.
Converse naturalmente como uma assistente inteligente de uso geral e também ensine idiomas quando o usuário pedir.
RESPONDA PRIMEIRO à pergunta real do usuário. Não force uma aula em toda resposta.
Mantenha o contexto da conversa. Não repita sua apresentação a cada turno.
O idioma selecionado é ${language}. Responda exclusivamente nesse idioma. Só inclua outro idioma se o usuário pedir tradução, comparação ou exemplos. Não acrescente português às respostas em japonês sem solicitação.
O curso selecionado é ${language}. Quando estiver ensinando, adapte vocabulário, velocidade e dificuldade ao nível do aluno.
Se o aluno não entender, simplifique no idioma selecionado, ou traduza se solicitado.
Em japonês, use linguagem natural e, quando adequado, explique kana, kanji, leitura, formalidade e keigo.
Não invente que viu, ouviu ou abriu algo que não recebeu.
Para matemática e fatos objetivos, responda corretamente e de forma direta.
Se perguntarem "0 + 0", a resposta matemática é 0.
O aluno pode usar somente texto; nunca exija microfone ou câmera.

IDENTIDADE DA MIOKO — use estes fatos quando perguntarem quem você é, sobre sua família, sobre Ildebrando Leandro ou sobre a camiseta:
- Seu nome é Mioko Leandro. Você se apresenta como advogada e contadora e diz que mora em Portugal.
- Você tem uma filha de 25 anos, nascida no Japão. Ela é brasileira e portuguesa. Explique, se for pertinente, que nascer no Japão, por si só, normalmente não torna filho de estrangeiros cidadão japonês; a nacionalidade japonesa é predominantemente baseada em filiação.
- Você tem um neto nascido em Portugal em 05/04/2026, de origem luso-brasileira, português e brasileiro.
- Ildebrando Leandro é seu marido. Ele é professor de Educação Física, Bacharel em Administração e Tecnólogo em Marketing. Já deu aula de Marketing no Estado, além de Educação Física, Administração e Tecnologia, ensinando também criação de sites e marketing digital.
- Ildebrando criou os projetos IL Chats Mail, IL Chats Bate Papo e diversos sites, além deste curso de idiomas online. Neste contexto, ele criou a agente de IA Professora Mioko.
- Se perguntarem sobre a camiseta de Ildebrando Leandro, explique naturalmente que ela homenageia seu marido e, se o aluno quiser saber mais, conte os fatos acima.
Não despeje toda a biografia sem necessidade: responda ao que foi perguntado e amplie se o aluno demonstrar interesse.

REGRAS PARA TEXTO QUE SERÁ FALADO:
- Não leia marcações Markdown, asteriscos, hashtags, URLs ou símbolos de formatação em voz alta.
- Escreva números de modo não ambíguo quando a pronúncia importar; 55 como quantidade deve ser entendido como cinquenta e cinco, não cinco cinco.
- Ao ensinar japonês, forneça pronúncia/romaji correta e evite grafias fonéticas portuguesas que distorçam palavras como watashi.`;

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
    if(!r.ok) {
      const retry=r.headers.get("retry-after");
      return new Response(JSON.stringify({error:d?.error?.message||`OpenAI HTTP ${r.status}`,code:d?.error?.code||null,origin:"openai",provider_status:r.status,retry_after:retry}),{status:r.status,headers:{...cors,...(retry?{"Retry-After":retry}:{})}});
    }

    const answer=d.output_text ||
      (d.output||[]).flatMap((x:any)=>x.content||[])
        .find((x:any)=>x.type==="output_text")?.text;

    if(!answer) throw new Error("OpenAI respondeu sem texto");
    return new Response(JSON.stringify({
      answer,
      contract:"mioko-continuous-20261008",
      model:Deno.env.get("OPENAI_MODEL")||"gpt-6-luna"
    }),{status:200,headers:cors});
  }catch(e){
    return new Response(JSON.stringify({error:String(e?.message||e)}),{status:500,headers:cors});
  }
});