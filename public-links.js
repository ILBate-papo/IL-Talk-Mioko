(() => {
  const allowed = new Set(['privacidade.html', 'exclusao-conta.html', 'sobre-o-professor.html']);
  let modal, frame, opener;
  function close() {
    if (!modal) return;
    modal.close(); modal.remove(); modal = frame = null;
    opener?.focus();
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !allowed.has(url.pathname.split('/').pop())) return;
    const app = document.getElementById('app');
    if (!app || app.classList.contains('hide') || !app.contains(link)) return;
    if (typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function') return;
    event.preventDefault(); opener = link;
    window.dispatchEvent(new Event('mioko-leave-lesson'));
    modal = document.createElement('dialog'); modal.className = 'miokoInfoDialog';
    modal.setAttribute('aria-label', 'Informações da IL Talk Mioko');
    const back = document.createElement('button'); back.type = 'button'; back.className = 'nb'; back.textContent = '← Voltar à Mioko'; back.onclick = close;
    frame = document.createElement('iframe'); frame.title = link.textContent.trim(); frame.src = url.href;
    modal.append(back, frame); document.body.append(modal);
    modal.addEventListener('cancel', event => { event.preventDefault(); close(); });
    modal.showModal(); back.focus();
  });
  window.addEventListener('message', event => {
    if (event.origin === location.origin && frame && event.source === frame.contentWindow && event.data?.type === 'mioko-public-return') close();
  });
})();
