import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {needsResearch,prepareResearchQuestion} from './supabase/ai/research.ts';
import {parseHeadlines} from './supabase/ai/news.ts';
for(const question of ['Você sabe de empregos em Bragança, Portugal?','Há vagas para ajudante em Taboão da Serra?','Ofertas de trabalho em São Paulo','Últimas notícias do mundo','O que aconteceu em Bragança, Portugal, hoje?'])assert(needsResearch(question),question);
for(const question of ['Como se diz emprego em inglês?','O que é um verbo?','Bom dia, como você está?'])assert(!needsResearch(question),question);
const history=[{content:'Meu telefone é um dado privado.'},{content:'Moro em Bragança, Portugal.'}];
assert.equal(prepareResearchQuestion('Tem emprego em Bragança?',history),'Tem emprego em Bragança? Local desta pergunta: Bragança, Portugal.');
assert(!prepareResearchQuestion('Tem emprego em Bragança?',history).includes('telefone'));
assert.equal(prepareResearchQuestion('Tem emprego em Bragança, Pará?',history),'Tem emprego em Bragança, Pará?');
assert.equal(prepareResearchQuestion('Tem emprego em Bragança PA?',history),'Tem emprego em Bragança PA?');
assert.equal(prepareResearchQuestion('Tem emprego em Bragança?',[]),'Tem emprego em Bragança?');

const now=Date.now(),date=new Date(now-3600000).toUTCString();
const item=(title,days=0)=>'<item><title><![CDATA['+title+']]></title><link>https://news.google.com/rss/articles/test'+days+'</link><pubDate>'+new Date(now-days*86400000).toUTCString()+'</pubDate><source url="https://example.test">Jornal local</source></item>';
const xml='<rss><channel>'+item('Notícia em Bragança &amp; região')+item('Antiga',10)+'</channel></rss>';
const parsed=parseHeadlines(xml,true,now);assert.equal(parsed.length,1);assert.equal(parsed[0].publisher,'Jornal local');assert.equal(parsed[0].title,'Notícia em Bragança & região');
assert.equal(parseHeadlines(xml.replaceAll('https://news.google.com/rss/articles/','https://untrusted.example/'),true,now).length,0);

const source=readFileSync('supabase/ai/research.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
let request,fallbacks=0;
const c=vm.createContext({URL,Response,AbortSignal,Date,console:{info(){}},isNewsQuery:q=>/notícias/i.test(q),newsHeadlines:async()=>{fallbacks++;return {ok:true,evidence_level:'headlines_only',text:'Manchete publicada',sources:['https://news.google.com/rss/articles/test']};},
fetch:async(_url,options)=>{request=JSON.parse(options.body);return Response.json({choices:[{message:{content:'Uma oferta publicada hoje no portal oficial.',executed_tools:[{type:'browser_search',output:{url:'https://iefponline.iefp.pt/IEFP/pesquisas/search.do?cat=ofertaEmprego'}}]}}]});}});
vm.runInContext(source,c);
let result=await vm.runInContext('researchCurrent("Empregos em Bragança, Portugal", "test-key")',c);
assert(result.ok);assert.equal(request.tools[0].type,'browser_search');assert.equal(request.reasoning_effort,'low');assert(!request.response_format);
assert(request.messages[0].content.includes('IEFP/iefponline'));assert(request.messages[0].content.includes('Do not invent salary'));
assert.equal(result.sources[0].startsWith('https://iefponline.iefp.pt/'),true);
c.fetch=async()=>Response.json({choices:[{message:{content:'Invented job at https://fake.example/jobs'}}]});
assert.equal((await vm.runInContext('researchCurrent("Empregos em Bragança, Portugal", "test-key")',c)).ok,false,'model prose without tool evidence cannot establish a job listing');
c.fetch=async()=>Response.json({error:'quota'},{status:429});
assert.equal((await vm.runInContext('researchCurrent("Empregos em Bragança, Portugal", "test-key")',c)).ok,false);assert.equal(fallbacks,0,'news headlines must not be presented as verified jobs');
result=await vm.runInContext('researchCurrent("notícias de Taboão da Serra", "test-key")',c);assert(result.ok);assert.equal(result.evidence_level,'headlines_only');
c.fetch=async()=>{throw Object.assign(Error('timeout'),{name:'TimeoutError'});};
assert.equal((await vm.runInContext('researchCurrent("Empregos em Bragança, Portugal", "test-key")',c)).ok,false);
console.log('PASS: jobs/local news triggers, location context without private history, real RSS structure, source evidence, bounded failure and honest quota/timeout handling.');
