import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {topicInstructions} from './supabase/ai/knowledge-topics.ts';
import {modeInstructions} from './supabase/ai/conversation-modes.ts';
import {speechStyle} from './supabase/ai/speech-style.ts';
import {needsResearch} from './supabase/ai/research.ts';
for(const country of ['portuguesa','italiana','espanhola','húngara','alemã']){
 const message='Como obter cidadania '+country+'?';assert(needsResearch(message));
 const instructions=topicInstructions(message);assert(instructions.includes('fontes oficiais atuais'));assert(instructions.includes('Não garanta concessão'));
}
assert(needsResearch('Como funciona a naturalização?'));
assert(needsResearch('Qual é o continente mais rico?'));
assert(needsResearch('Qual continente tem mais países de primeiro mundo?'));
assert(needsResearch('Qual é a origem do sobrenome Leandro?'));
assert(!needsResearch('Monte minha árvore genealógica: João é pai de Maria, nascida em 1920.'),'family-tree assembly should not automatically search private family details');
assert(topicInstructions('Qual é a origem do sobrenome Leandro?').includes('famílias sem parentesco'));
assert(topicInstructions('Monte uma árvore genealógica').includes('Nunca invente antepassados'));
assert(topicInstructions('O continente mais rico é a Ásia?').includes('renda por pessoa'));
assert(topicInstructions('Jesus Cristo era asiático?').includes('nacionalidade moderna'));
assert.equal(topicInstructions('Bom dia, como você está?'),'','unrelated turns keep their shorter prompt');

const path=process.env.IL_MIOKO_LIVE_AI_DIR ? process.env.IL_MIOKO_LIVE_AI_DIR+'/index.ts' : 'supabase/ai/index.ts';
const source=readFileSync(path,'utf8').replace(/^import .*;\n/gm,'');let handler,prompt;
vm.runInNewContext(source,{
 Deno:{env:{get:k=>k==='GROQ_API_KEY'?'test-key':undefined}},serveWithOrigins:fn=>handler=fn,
 checkAccess:async()=>({allowed:true,role:'member'}),everydayPhrase:()=>null,
 subjectInstructions:()=>'',examInstructions:()=>'',profileInstructions:()=>'',needsResearch:()=>false,prepareResearchQuestion:m=>m,
 researchCurrent:async()=>null,topicInstructions,modeInstructions,speechStyle,
 crypto:{randomUUID:()=> 'test'},Response,AbortSignal,console:{info(){},warn(){},error(){}},
 fetch:async(_url,options)=>{prompt=JSON.parse(options.body).messages[0].content;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'pt-BR',text:'Resposta de teste.'}]})}}]});}
});
for(const [message,marker] of [['Como obter cidadania húngara?','CIDADANIAS E NACIONALIDADES'],['Qual a origem do sobrenome Leandro?','ORIGEM DOS SOBRENOMES'],['Monte uma árvore genealógica','ÁRVORE GENEALÓGICA'],['Qual o continente mais rico?','GEOGRAFIA E COMPARAÇÕES ECONÔMICAS']]){
 const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({message,language:'Português',conversation_mode:'free',learner_level:'advanced'})}));
 assert.equal(response.status,200);assert(prompt.includes(marker));assert(prompt.includes(speechStyle));
}
console.log('PASS: citizenship/surname research routing, evidence-based eligibility guidance, non-invented genealogy, economic criteria, historical geography and targeted prompt integration.');
