(() => {
  if (window.top !== window || !window.MiokoVoiceBridge || window.__miokoNativeInstalled) return;
  window.__miokoNativeInstalled = true;
  let voices = [], active = null, counter = 0;
  const listeners = new Map();
  let mic = null, mouthTimer = null;
  function stopMouth() { clearInterval(mouthTimer); mouthTimer = null; window.MiokoAvatar?.closeMouth(); }
  function animateMouth() {
    stopMouth();
    const began = performance.now();
    mouthTimer = setInterval(() => {
      if (!active?.started) { stopMouth(); return; }
      const t = (performance.now() - began) / 1000;
      window.MiokoAvatar?.setMouth(0.18 + 0.52 * Math.abs(Math.sin(t * 13)), true);
    }, 80);
  }
  window.MiokoNativeMicrophone = {
    start(onLevel) {
      this.cancel();
      const id = 'mic-' + (++counter);
      let resolve, reject;
      const result = new Promise((ok, fail) => { resolve = ok; reject = fail; });
      mic = {id, resolve, reject, onLevel};
      post({action:'mic-start', id});
      return result;
    },
    finish() { if (mic) post({action:'mic-stop', id:mic.id}); },
    cancel() {
      if (!mic) return;
      const old = mic; mic = null;
      post({action:'mic-cancel', id:old.id});
      old.resolve(null);
    }
  };
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
    cancel() { stopMouth(); const old = active; active = null; post({action:'cancel'}); old?.utterance.onend?.({type:'end'}); },
    speak(utterance) {
      if (active) this.cancel();
      const id = 'mioko-' + (++counter);
      active = {id, utterance};
      post({action:'speak', id, text:utterance.text, lang:utterance.lang, rate:utterance.rate, pitch:utterance.pitch, voice:utterance.voice?.voiceURI || ''});
    }
  };
  window.__miokoNativeEvent = event => {
    if (event.type.startsWith('mic-')) {
      if (!mic || event.id !== mic.id) return;
      if (event.type === 'mic-level') mic.onLevel?.(event.level);
      else if (event.type === 'mic-error') { const old = mic; mic = null; old.reject(Error(event.error)); }
      else if (event.type === 'mic-data') {
        const old = mic; mic = null;
        try {
          const bytes = Uint8Array.from(atob(event.audio), char => char.charCodeAt(0));
          old.resolve(new Blob([bytes], {type:event.mime || 'audio/mp4'}));
        } catch (error) { old.reject(error); }
      }
      return;
    }
    if (event.type === 'voices') {
      voices = event.voices || [];
      listeners.get('voiceschanged')?.forEach(fn => fn({type:'voiceschanged'}));
      synth.onvoiceschanged?.({type:'voiceschanged'});
      return;
    }
    if (!active || event.id !== active.id) return;
    const utterance = active.utterance;
    if (event.type === 'start') { active.started = true; utterance.onstart?.({type:'start'}); animateMouth(); }
    else if (event.type === 'boundary') utterance.onboundary?.({type:'boundary', charIndex:event.start});
    else if (event.type === 'end') { stopMouth(); active = null; utterance.onend?.({type:'end'}); }
    else if (event.type === 'error') { stopMouth(); active = null; utterance.onerror?.({type:'error', error:event.error || 'Falha na voz do Android'}); }
  };
  Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:synth});
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {configurable:true, value:NativeUtterance});
  window.addEventListener('pagehide', () => { stopMouth(); window.MiokoNativeMicrophone.cancel(); });
  post({action:'voices'});
})();
