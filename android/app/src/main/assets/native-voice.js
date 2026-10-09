(() => {
  if (window.top !== window || !window.MiokoVoiceBridge || window.__miokoNativeInstalled) return;
  window.__miokoNativeInstalled = true;
  let voices = [], active = null, counter = 0;
  const listeners = new Map();
  function post(value) { window.MiokoVoiceBridge.postMessage(JSON.stringify(value)); }
  class NativeUtterance {
    constructor(text = '') { this.text = String(text); this.lang = 'pt-BR'; this.rate = 1; this.pitch = 1; this.voice = null; }
  }
  const synth = {
    getVoices: () => voices.slice(),
    get speaking() { return !!active; },
    get pending() { return !!active; },
    get paused() { return false; },
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    cancel() { const old = active; active = null; post({action:'cancel'}); old?.utterance.onend?.({type:'end'}); },
    speak(utterance) {
      if (active) this.cancel();
      const id = 'mioko-' + (++counter);
      active = {id, utterance};
      post({action:'speak', id, text:utterance.text, lang:utterance.lang, rate:utterance.rate, pitch:utterance.pitch, voice:utterance.voice?.voiceURI || ''});
    }
  };
  window.__miokoNativeEvent = event => {
    if (event.type === 'voices') {
      voices = event.voices || [];
      listeners.get('voiceschanged')?.forEach(fn => fn({type:'voiceschanged'}));
      synth.onvoiceschanged?.({type:'voiceschanged'});
      return;
    }
    if (!active || event.id !== active.id) return;
    const utterance = active.utterance;
    if (event.type === 'start') utterance.onstart?.({type:'start'});
    else if (event.type === 'boundary') utterance.onboundary?.({type:'boundary', charIndex:event.start});
    else if (event.type === 'end') { active = null; utterance.onend?.({type:'end'}); }
    else if (event.type === 'error') { active = null; utterance.onerror?.({type:'error', error:event.error || 'Falha na voz do Android'}); }
  };
  Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:synth});
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {configurable:true, value:NativeUtterance});
  post({action:'voices'});
})();
