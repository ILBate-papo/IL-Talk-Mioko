const $=id=>document.getElementById(id);
let pdf=null, pdfModule=null, images=[], prepared=false, busy=false;
const tell=text=>{$('status').textContent=text;};
const limits={file:20*1024*1024,images:3,maxSide:1800};
function lock(value){busy=value;for(const id of ['upload','purpose','firstPage','lastPage','prepare','analyze','clear','question','material'])$(id).disabled=value; if(!value)$('prepare').disabled=!$('upload').files.length;}
function resetPrepared(){images=[];prepared=false;$('preview').replaceChildren();$('answerSection').hidden=true;}
function preview(){for(const item of images){const image=document.createElement('img');image.src=item.url;image.alt=item.label;$('preview').append(image);}}
function canvasImage(canvas,label){const url=canvas.toDataURL('image/jpeg',.9);if(url.length>1900000)throw Error('A imagem ficou muito grande. Recorte a área importante e tente novamente.');return {label,url};}
async function photo(file){const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,limits.maxSide/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvasImage(canvas,file.name);}finally{URL.revokeObjectURL(url);}}
async function loadPDF(file){
 if(!pdfModule){pdfModule=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfModule.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';}
 const task=pdfModule.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/',cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',cMapPacked:true});
 task.onPassword=(_update,reason)=>{task.destroy();tell('Este PDF pede senha. Envie uma cópia desbloqueada ou fotos das páginas.');};
 return task.promise;
}
$('enter').onclick=async()=>{if(await window.MiokoAuth.signIn()){$('login').classList.add('hide');$('app').classList.remove('hide');}};
$('signOut').onclick=async()=>{await window.MiokoAuth.signOut();resetPrepared();$('material').value='';$('upload').value='';pdf?.destroy();pdf=null;$('app').classList.add('hide');$('login').classList.remove('hide');};
$('purpose').onchange=()=>{const exam=$('purpose').value==='exam';$('purposeHint').textContent=exam?'A Mioko explica os termos, valores e referências do laboratório. A explicação não fecha diagnóstico nem substitui avaliação de um profissional de saúde.':'Envie o trecho desejado. Para corrigir uma prova com gabarito oficial, inclua o gabarito.';$('question').value=exam?'Explique este exame em linguagem simples. Mostre os valores e as referências que aparecem no laudo, sinalize o que está fora dessas referências e sugira perguntas para levar ao profissional de saúde. Não faça diagnóstico nem indique remédios.':$('purpose').value==='study'?'Explique as questões enviadas. Compare minhas respostas com o gabarito, se ele estiver no material, e mostre como resolver.':'Explique o documento enviado em linguagem simples, indicando quais páginas foram analisadas.';};
$('upload').onchange=async()=>{
 resetPrepared();pdf?.destroy();pdf=null;$('pdfPages').hidden=true;
 const files=[...$('upload').files];if(!files.length){$('prepare').disabled=true;return;}
 lock(true);
 try{
  if(files.some(f=>!f.size||f.size>limits.file))throw Error('Envie arquivos de até 20 MB cada.');
  const pdfFiles=files.filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));
  if(pdfFiles.length){if(files.length!==1)throw Error('Selecione um PDF por vez. Para incluir o gabarito, cole o texto abaixo.');tell('Abrindo PDF…');pdf=await loadPDF(files[0]);$('pdfPages').hidden=false;$('firstPage').max=$('lastPage').max=pdf.numPages;$('firstPage').value=1;$('lastPage').value=Math.min(3,pdf.numPages);$('pageCount').textContent=pdf.numPages+' páginas no arquivo. Escolha até 3 por análise.';}
  else if(files.length>3||files.some(f=>!/^image\/(jpeg|png|webp)$/.test(f.type)))throw Error('Selecione até três fotos JPEG, PNG ou WebP, ou um PDF.');
  tell('Toque em Preparar material para conferir as páginas ou fotos antes de enviar.');
 }catch(e){$('upload').value='';tell(e.message);}
 finally{lock(false);}
};
for(const id of ['firstPage','lastPage'])$(id).oninput=resetPrepared;
$('prepare').onclick=async()=>{
 resetPrepared();lock(true);
 try{
  if(pdf){const first=Number($('firstPage').value),last=Number($('lastPage').value);if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last<first||last>pdf.numPages||last-first+1>3)throw Error('Escolha de uma a três páginas consecutivas válidas.');
   for(let n=first;n<=last;n++){tell('Preparando página '+n+'…');const page=await pdf.getPage(n);const original=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,limits.maxSide/Math.max(original.width,original.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;images.push(canvasImage(canvas,$('upload').files[0].name+' — página '+n));page.cleanup();}
  }else{for(const file of $('upload').files){tell('Preparando '+file.name+'…');images.push(await photo(file));}}
  if(!images.length)throw Error('Selecione um PDF ou uma foto.');preview();prepared=true;tell('Material preparado. Confira as imagens e toque em Analisar.');
 }catch(e){resetPrepared();tell(e.message);}finally{lock(false);}
};
$('clear').onclick=()=>{resetPrepared();pdf?.destroy();pdf=null;$('pdfPages').hidden=true;$('upload').value='';$('material').value='';$('prepare').disabled=true;tell('Material removido.');};
$('analyze').onclick=async()=>{
 if(busy)return;
 if($('upload').files.length&&!prepared){await $('prepare').onclick();if(!prepared)return;}
 const message=$('question').value.trim(),material=$('material').value.trim();
 if(!message||(!material&&!images.length)){tell('Informe o pedido e prepare um arquivo, ou cole o material.');return;}
 lock(true);$('answerSection').hidden=true;tell('Mioko está analisando o material…');
 try{
  const token=await window.MiokoAuth.requireAccess(),config=window.IL_TALK_CONFIG;
  const response=await fetch('https://'+config.SUPABASE_PROJECT_REF+'.supabase.co/functions/v1/il-study',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.SUPABASE_PUBLISHABLE_KEY||config.SUPABASE_ANON_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000),body:JSON.stringify({message,material,images,purpose:$('purpose').value})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível analisar.');if(!data.answer)throw Error('A análise voltou vazia.');
  $('result').textContent=data.answer;$('scope').textContent=images.length?'Material enviado: '+images.map(x=>x.label).join('; '):'Material enviado: texto colado.';$('answerSection').hidden=false;tell(data.incomplete?'A explicação ficou incompleta. Divida as questões e envie um trecho menor.':'Explicação disponível abaixo.');$('answerSection').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){tell(/Timeout|Abort/.test(e.name)?'A análise demorou demais. Tente menos páginas.':e.message);}finally{lock(false);}
};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([$('scope').textContent+'\n\n'+$('result').textContent],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Mioko-explicacao.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
