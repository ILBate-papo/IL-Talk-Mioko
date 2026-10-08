const vm=require('vm'),fs=require('fs'),assert=require('assert');
const source=fs.readFileSync('app.js','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(language,code){
 const elements=new Map(), requests=[], spoken=[], recognitions=[];let mouth=0,active=0,echo=false;
 function el(id){if(!elements.has(id))elements.set(id,{textContent:'',value:'',hidden:false,children:[],classList:{add(){},remove(){},toggle(){}},appendChild(c){this.children.push(c)},append(...c){this.children.push(...c)},remove(){},click(){},srcObject:null,play:async()=>{}});return elements.get(id)}
 const languages=['Português','Japonês','Inglês','Espanhol','Francês','Coreano','Italiano'].map(l=>({...el('lang'+l),dataset:{lang:l}}));
 const storage={ilLang:language,ilVoice:'on'};
 class SR{constructor(){recognitions.push(this)}start(){active++;this.active=true;this.onstart?.()}abort(){if(this.active)active--;this.active=false;}emit(t){this.onresult?.({results:[[{transcript:t}]]})}}
 class Utterance{constructor(t){this.text=t}}
 const synth={getVoices:()=>[{name:'Female Test',lang:code}],speaking:false,paused:false,addEventListener(){},removeEventListener(){},cancel(){this.speaking=false},speak(u){assert.equal(active,0,'recognizer must stop before voice');assert.equal(u.lang,code);spoken.push(u.text);this.speaking=true;u.onstart?.();setTimeout(()=>{this.speaking=false;u.onend?.()},12)}};
 const window={IL_TALK_CONFIG:{AI_ENDPOINT:'test-ai',VOICE_ENDPOINT:'test-voice'},SpeechRecognition:SR,SpeechSynthesisUtterance:Utterance,speechSynthesis:synth,MiokoAvatar:{closeMouth(){mouth=0},setMouth(v){mouth=v}},addEventListener(){}};
 const document={querySelector:q=>q==='[data-lang="Outro"]'?null:el(q),querySelectorAll:q=>q==='[data-lang]'?languages:[],createElement:()=>({append(){},className:'',remove(){}}),head:{appendChild(){}},addEventListener(){}};
 const context={window,document,localStorage:storage,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},SpeechSynthesisUtterance:Utterance,AbortController,URL,console:{warn(){}},performance,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},scrollTo(){},alert(){},fetch:async(u,opts)=>{
 const data=JSON.parse(opts.body);assert.equal(data.language,language);assert.equal(active,0,'recognition stopped during AI request');requests.push(data);return{ok:true,text:async()=>JSON.stringify({answer:requests.length===1?'703':'Resposta '+requests.length})};}};
 vm.runInNewContext(source,context);
 el('#voiceCall').onclick();await sleep(450);assert(recognitions.length,'auto listens after greeting');
 for(let i=0;i<5;i++){
  recognitions.at(-1).emit(i===0?'Quanto é 37 vezes 19?':'Pergunta '+i);
  await sleep(550);assert.equal(active,1,'auto listening resumes');assert.equal(mouth,0,'closed after speech');
 }
 assert.equal(requests.length,5);assert.equal(spoken.length,6);assert(requests[1].history.some(x=>x.content==='703'),'follow-up keeps context');
 el('#voiceCall').onclick();assert.equal(active,0,'end stops recognition');
 await el('#videoCall').onclick();await sleep(450);assert.equal(el('#userVideo').hidden,false);el('#videoCall').onclick();assert.equal(el('#userVideo').hidden,true);
 assert.equal(active,0);
 return {language,turns:5,context:true,autoResume:true,noEcho:true,video:'simulated only'};
}
(async()=>{for(const [l,c]of Object.entries({Português:'pt-BR',Japonês:'ja-JP',Inglês:'en-US',Espanhol:'es-ES',Francês:'fr-FR',Coreano:'ko-KR',Italiano:'it-IT'}))console.log(JSON.stringify(await run(l,c)));})().catch(e=>{console.error(e);process.exit(1)});
