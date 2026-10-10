(() => {
  const url='https://ilbate-papo.github.io/IL-Talk-Mioko/';
  const title='IL Talk Mioko';
  const text='Aprenda sete idiomas com a professora virtual Mioko, com apoio em português para iniciantes.';
  const status=document.getElementById('shareStatus');
  async function copy(){
    try{await navigator.clipboard.writeText(url);status.textContent='Link copiado. Cole na rede em que deseja compartilhar.';}
    catch{status.textContent='Copie este endereço: '+url;}
  }
  document.getElementById('shareInstagram')?.addEventListener('click',copy);
  document.getElementById('shareOther')?.addEventListener('click',async()=>{
    if(navigator.share){try{await navigator.share({title,text,url});return;}catch(e){if(e.name==='AbortError')return;}}
    await copy();
  });
})();
