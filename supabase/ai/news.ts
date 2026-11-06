// Public news index fallback: headlines and publication dates, never article-body evidence.
export function isNewsQuery(message) {
 return /not[ií]cia|atualidade|acontecid|aconteciment|guerra|conflito|cessar.fogo|bombarde|invas[aã]o|geopol[ií]tica|elei[çc][aã]o|news|headlines|\bwar\b|ceasefire|guerra|notizie|attualit[aà]|conflit|guerre|actualité|戦争|停戦|ニュース|전쟁|휴전|뉴스/i.test(message);
}
function text(value) {
 return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';})
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&amp;/g,'&').trim();
}
export function parseHeadlines(xml, recent, now=Date.now()) {
 const items=[],seen=new Set();
 if(typeof xml!=='string'||xml.length>600000)return items;
 for(const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const read=tag=>text(match[1].match(new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)</'+tag+'>','i'))?.[1]||'');
  const title=read('title'),link=read('link'),publisher=read('source'),published=Date.parse(read('pubDate'));
  let url;try{url=new URL(link)}catch{continue;}
  if(url.protocol!=='https:'||url.hostname!=='news.google.com'||!url.pathname.startsWith('/rss/articles/')||url.username||url.password||url.port)continue;
  if(!title||!publisher||!Number.isFinite(published)||published>now+300000||(recent&&now-published>48*3600000)||seen.has(title))continue;
  seen.add(title);items.push({title:title.slice(0,400),publisher:publisher.slice(0,120),published_at:new Date(published).toISOString(),url:url.href});
 }
 return items.sort((a,b)=>b.published_at.localeCompare(a.published_at)).slice(0,5);
}
export async function newsHeadlines(message, timeoutMs=5000) {
 const recent=/hoje|do dia|agora|[uú]ltim|today|latest|oggi|aujourd|今日|오늘/i.test(message);
 const url=new URL('https://news.google.com/rss/search');
 url.searchParams.set('q',String(message).slice(0,500)+(recent?' when:1d':''));
 const portugal=/portugal|lisboa|porto\b/i.test(message);
 url.searchParams.set('hl',portugal?'pt-PT':'pt-BR');url.searchParams.set('gl',portugal?'PT':'BR');url.searchParams.set('ceid',portugal?'PT:pt-150':'BR:pt-419');
 const response=await fetch(url.href,{signal:AbortSignal.timeout(Math.max(1,timeoutMs)),headers:{Accept:'application/rss+xml,application/xml,text/xml'}});
 if(!response.ok)return null;
 if(Number(response.headers.get('content-length')||0)>600000)return null;
 const items=parseHeadlines(await response.text(),recent);
 if(!items.length)return null;
 return {ok:true,evidence_level:'headlines_only',text:JSON.stringify({scope:'Published headlines only. Do not invent details, confirm events, or infer casualty counts from these titles. Attribute each reported headline to its publisher and publication date. Publication date does not prove the event occurred today. Invite the user to open the source for full context.',headlines:items}),sources:items.map(x=>x.url)};
}


