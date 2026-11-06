import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {modeInstructions} from './supabase/ai/conversation-modes.ts';
import {speechStyle} from './supabase/ai/speech-style.ts';
import {topicInstructions} from './supabase/ai/knowledge-topics.ts';
const app=readFileSync('app.js','utf8');
const piece=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
function boot(language){
 const storage={ilLang:language,getItem:()=>null},elements=new Map(),lessonButtons=[{hidden:false}];
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id);};
 const c=vm.createContext({localStorage:storage,window:{MiokoAuth:{userId:()=> 'test'}},document:{querySelectorAll:()=>lessonButtons},$:element,levelSelect:{},levelBox:{hidden:false,style:{}}});
 vm.runInContext(piece('  let lang =','  let voice =')+piece('  const updateLessonMode =','  levelSelect.onchange ='),c);
 return {c,storage,element,lessonButtons,get:expr=>vm.runInContext(expr,c),update:()=>vm.runInContext('updateLessonMode()',c)};
}
for(const old of ['Italiano','Outro','Conversa livre']){
 const b=boot(old);assert.equal(b.storage.ilLang,'Conversa livre');assert.equal(b.get('conversationMode()'),'free');assert.equal(b.get('courseRequestLanguage()'),'Português');
 assert.equal(b.get('spokenLocale()'),'pt-BR');assert.equal(b.get('inputLocale()'),'pt-BR');assert.equal(b.get('beginnerLesson()'),false);
 assert(!/estudar|aprender/.test(b.get('greetingForLesson()')));b.update();assert(b.c.levelBox.hidden);assert(b.lessonButtons[0].hidden);assert(b.element('#begin').textContent.includes('INICIAR CONVERSA'));
}
const pt=boot('Português');assert.equal(pt.get('conversationMode()'),'portuguese_lesson');assert.equal(pt.get('courseRequestLanguage()'),'Português');
assert(pt.get('greetingForLesson()').includes('estudar português'));pt.update();assert(!pt.c.levelBox.hidden);assert(!pt.lessonButtons[0].hidden);assert(pt.element('#status').textContent.includes('aula de português'));
for(const language of ['Japonês','Inglês','Espanhol','Francês','Coreano']){const b=boot(language);assert.equal(b.get('conversationMode()'),'language_lesson');assert.equal(b.get('courseRequestLanguage()'),language);}
const html=readFileSync('index.html','utf8'),portal=readFileSync('portal.js','utf8');
assert(html.includes('data-lang="Conversa livre"'));assert(html.includes('data-lang="Português"'));assert(!/data-lang="(?:Italiano|Outro)"/.test(html));
assert(!portal.match(/const languages = \[[^\]]*Italiano/));
assert(modeInstructions('free','Português').includes('sem impor aula'));
assert(modeInstructions('portuguese_lesson','Português').includes('leitura'));assert.equal(modeInstructions(undefined,'Português'),'');

const path=process.env.IL_MIOKO_LIVE_AI_DIR ? process.env.IL_MIOKO_LIVE_AI_DIR+'/index.ts' : 'supabase/ai/index.ts';
const source=readFileSync(path,'utf8').replace(/^import .*;\n/gm,'');
let handler,prompt,allowed=true,calls=0;
vm.runInNewContext(source,{
 Deno:{env:{get:k=>k==='GROQ_API_KEY'?'test-key':undefined}},serveWithOrigins:fn=>handler=fn,
 checkAccess:async()=>({allowed,status:403,reason:'Sem acesso',role:'member'}),
 everydayPhrase:()=>null,subjectInstructions:()=>'',examInstructions:()=>'',profileInstructions:()=>'',needsResearch:()=>false,
 researchCurrent:async()=>null,prepareResearchQuestion:m=>m,speechStyle,modeInstructions,topicInstructions,
 crypto:{randomUUID:()=> 'test'},Response,AbortSignal,console:{info(){},warn(){},error(){}},
 fetch:async(_url,options)=>{calls++;prompt=JSON.parse(options.body).messages[0].content;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({segments:[{locale:'pt-BR',text:'Resposta de teste.'}]})}}]});}
});
for(const [mode,message,marker] of [['free','Vamos conversar sobre música','CONVERSA LIVRE'],['portuguese_lesson','Quando usar ponto e vírgula?','AULA DE PORTUGUÊS']]){
 const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({message,language:'Português',conversation_mode:mode,learner_level:'advanced'})}));
 assert.equal(response.status,200);assert(prompt.includes('MODO ESCOLHIDO: '+marker));assert(prompt.includes(speechStyle));
}
allowed=false;const before=calls;assert.equal((await handler(new Request('https://test.invalid',{method:'POST',body:'{}'}))).status,403);assert.equal(calls,before);
console.log('PASS: Italian migration, separate free/Portuguese modes, native Portuguese voice, course controls, remaining language lessons, backend prompt routing and access checks.');
