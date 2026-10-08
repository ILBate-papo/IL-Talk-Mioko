// Microphone capture with voice activity detection, for browsers without SpeechRecognition.
// No conversation/lesson duration limit. Only voiced utterances are sent for transcription.
export function wavFromSamples(chunks, sampleRate) {
  const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, Math.round(value * (value < 0 ? 32768 : 32767)), true); offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export class VoiceActivity {
  constructor(sampleRate, onUtterance) {
    this.sampleRate = sampleRate; this.onUtterance = onUtterance;
    this.preroll = []; this.chunks = []; this.started = false;
    this.noise = .002; this.voicedSamples = 0; this.quietSamples = 0; this.done = false;
  }
  process(input) {
    if (this.done) return;
    const samples = new Float32Array(input);
    const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
    const voiced = rms > Math.max(.012, this.noise * 3);
    if (!this.started) {
      this.preroll.push(samples);
      while (this.preroll.reduce((sum, x) => sum + x.length, 0) > this.sampleRate * .4) this.preroll.shift();
      if (!voiced) { this.noise = this.noise * .98 + rms * .02; return; }
      this.started = true; this.chunks = this.preroll; this.preroll = [];
    } else this.chunks.push(samples);
    if (voiced) { this.voicedSamples += samples.length; this.quietSamples = 0; }
    else this.quietSamples += samples.length;
    // Silence ends an utterance, not the call. Short clicks/noise never generate an API request.
    if (this.quietSamples >= this.sampleRate * .9) {
      if (this.voicedSamples < this.sampleRate * .22) {
        this.started = false; this.chunks = []; this.voicedSamples = 0; this.quietSamples = 0; return;
      }
      this.done = true;
      this.onUtterance(wavFromSamples(this.chunks, this.sampleRate));
    }
  }
}

export function createListener() {
  let epoch = 0, stream = null, context = null, source = null, processor = null, silent = null;
  const stop = () => {
    epoch++;
    if (processor) { processor.onaudioprocess = null; processor.disconnect(); processor = null; }
    source?.disconnect(); source = null; silent?.disconnect(); silent = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
  };
  return {
    stop,
    async start(onUtterance) {
      stop(); const session = epoch;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !navigator.mediaDevices?.getUserMedia) throw Error('Captura de áudio não disponível neste navegador');
      if (!context || context.state === 'closed') context = new AC();
      await context.resume();
      if (session !== epoch) return false;
      const opened = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (session !== epoch) { opened.getTracks().forEach(track => track.stop()); return false; }
      stream = opened;
      source = context.createMediaStreamSource(stream);
      // ScriptProcessor is retained for Firefox compatibility. This graph produces only silence.
      processor = context.createScriptProcessor(2048, 1, 1);
      silent = context.createGain(); silent.gain.value = 0;
      const vad = new VoiceActivity(context.sampleRate, onUtterance);
      processor.onaudioprocess = event => vad.process(event.inputBuffer.getChannelData(0));
      source.connect(processor); processor.connect(silent); silent.connect(context.destination);
      return true;
    },
    async destroy() { stop(); if (context) { await context.close(); context = null; } }
  };
}
