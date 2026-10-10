(() => {
  if (/ILTalkMioko\//.test(navigator.userAgent) || document.getElementById('miokoAndroidDownload')) return;
  function mount() {
    const card = document.querySelector('#login .loginCard');
    if (!card) return;
    const box = document.createElement('section');
    box.id = 'miokoAndroidDownload';
    box.setAttribute('aria-label', 'Instalar IL Talk Mioko no Android');
    box.style.cssText = 'margin-top:22px;padding:18px;border:1px solid #4b5677;border-radius:16px;background:#18243b;text-align:center;color:#fff';
    const title = document.createElement('strong');
    title.textContent = 'Leve a Mioko no seu celular';
    title.style.cssText = 'display:block;font-size:18px;margin-bottom:12px';
    const download = document.createElement('a');
    download.href = 'downloads/IL-Talk-Mioko-1.0.3.apk';
    download.download = 'IL-Talk-Mioko-1.0.3.apk';
    download.textContent = '⬇ Baixar aplicativo Android (APK)';
    download.style.cssText = 'display:block;padding:14px 18px;border-radius:12px;background:#79e3cd;color:#10293a;text-decoration:none;font-weight:700';
    const note = document.createElement('p');
    note.textContent = 'Android 8 ou superior. Acesso com conta confirmada e assinatura paga, ou conta de administrador.';
    note.style.cssText = 'font-size:13px;line-height:1.5;margin:12px 0 8px';
    const help = document.createElement('a');
    help.href = 'baixar.html';
    help.textContent = 'Como instalar';
    help.style.color = '#b9dfff';
    box.append(title, download, note, help);
    card.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})();
