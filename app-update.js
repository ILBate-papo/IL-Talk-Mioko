(() => {
  const build = '20261016-arquivos4';
  const label = document.createElement('small');
  label.textContent = 'PDFs e fotos · revisão 16/10–4';
  label.style.cssText = 'display:block;text-align:center;color:#bdcde2;margin:8px';
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'nb'; button.textContent = '↻ Atualizar Mioko';
  button.style.cssText = 'display:block;margin:8px auto';
  function reload(version) {
    const url = new URL(location.href);
    url.searchParams.set('mioko_atualizar', version + '-' + Date.now());
    location.replace(url.href);
  }
  button.onclick = () => reload(build);
  document.querySelector('footer')?.append(label, button);
  let checking = false;
  async function check() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const response = await fetch('./app-version.json?t=' + Date.now(), {cache:'no-store', signal:AbortSignal.timeout(8000)});
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data.build !== 'string' || !/^\d{8}-[a-z0-9-]+$/.test(data.build) || data.build === build) return;
      const key = 'mioko-build-reload:' + data.build;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      // Offer the update without interrupting an active lesson.
      button.textContent = '↻ Nova atualização disponível — tocar para atualizar';
      button.onclick = () => reload(data.build);
    } catch {} finally { checking = false; }
  }
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', check);
  check();
})();
