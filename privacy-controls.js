(() => {
  const reset = document.getElementById('resetGeo');
  if (reset) reset.onclick = () => {
    try { localStorage.removeItem('mioko_geo_consent'); document.getElementById('privacyStatus').textContent = 'Preferência removida. Ao voltar à Mioko, você poderá escolher novamente.'; }
    catch { document.getElementById('privacyStatus').textContent = 'Não foi possível alterar a preferência neste navegador.'; }
  };
  const form = document.getElementById('deletionForm');
  if (form) form.onsubmit = event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const email = document.getElementById('accountEmail').value.trim();
    const scope = document.getElementById('deletionScope').value;
    const body = 'Olá, Professor Ildebrando Leandro.\n\nSolicito ' + scope + ' no IL Talk Mioko.\nE-mail cadastrado: ' + email + '\n\nPeço orientações para confirmar minha identidade e a confirmação da conclusão, indicando eventual retenção obrigatória de dados e seu prazo.\n';
    const link = document.getElementById('sendDeletionEmail');
    link.href = 'mailto:bate.papo@ilchatsmail.com.br?subject=' + encodeURIComponent('IL Talk Mioko — solicitação de exclusão') + '&body=' + encodeURIComponent(body);
    document.getElementById('deletionMessage').value = body;
    document.getElementById('deletionDraft').hidden = false;
    document.getElementById('deletionStatus').textContent = 'Pedido preparado. Toque em “Abrir meu e-mail” e envie a mensagem. Nada foi enviado por esta página.';
  };
  const copy = document.getElementById('copyDeletion');
  if (copy) copy.onclick = async () => {
    const message = document.getElementById('deletionMessage');
    try { await navigator.clipboard.writeText(message.value); document.getElementById('deletionStatus').textContent = 'Texto copiado. Envie para bate.papo@ilchatsmail.com.br a partir do e-mail da sua conta.'; }
    catch { message.focus(); message.select(); document.getElementById('deletionStatus').textContent = 'Selecione e copie a mensagem. Envie para bate.papo@ilchatsmail.com.br.'; }
  };
  const clear = document.getElementById('clearLocalMioko');
  if (clear) clear.onclick = () => {
    const status = document.getElementById('localDeletionStatus');
    if (!document.getElementById('confirmLocalClear').checked) { status.textContent = 'Marque a confirmação para apagar os dados locais da Mioko neste navegador.'; return; }
    try {
      const prefixes = ['ilMiokoHistory:', 'ilMiokoCourseLevels:', 'ilMiokoPortal:'];
      const exact = ['mioko_geo_consent', 'ilLang', 'ilVoice', 'ilBeginnerSupport'];
      Object.keys(localStorage).filter(key => prefixes.some(prefix => key.startsWith(prefix)) || exact.includes(key)).forEach(key => localStorage.removeItem(key));
      sessionStorage.removeItem('mioko_auth_session_v1'); sessionStorage.removeItem('mioko_visitor_session');
      status.textContent = 'Dados locais da Mioko removidos deste navegador. Isso não exclui sua conta nem os registros no servidor. Para isso, envie o pedido acima.';
    } catch { status.textContent = 'Não foi possível remover todos os dados. Use as configurações de dados do site no navegador.'; }
  };
})();
