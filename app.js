// IL TALK MIOKO — serviço de voz com alternativa do navegador.
{
  const script = document.createElement("script");
  script.src = "mioko-avatar.js";
  document.head.appendChild(script);
}

(() => {
  const $ = s => document.querySelector(s);
  const config = () => window.IL_TALK_CONFIG || {};

  let lang = localStorage.ilLang || "Português";
  let voice = localStorage.ilVoice !== "off";
  let history = [];
  try {
    const saved = JSON.parse(localStorage.ilHistory || "[]");
    if (Array.isArray(saved)) history = saved;
  } catch {}

  let stream = null;
  let callMode = null;
  let recognition = null;
  let listening = false;
  let voiceInputBlocked = false;
  let replyPending = false;
  let speechPending = false;
  let currentAudio = null;
  let nativeUtterance = null;
  let audioContext = null;
  let analyser = null;
  let audioFrame = 0;
  let audioUrl = null;
  let audioCleanup = null;
  let voiceRequest = null;
  let voiceGeneration = 0;
  let voiceRetryAfter = 0;
  let listenTimer = 0;
  let replyQueue = Promise.resolve();

  function voiceLabel() {
    $("#voice").textContent =
      voice ? "🔊 Voz ligada" : "🔇 Voz desligada";
  }
  voiceLabel();

  function enableVoice() {
    voice = true;
    localStorage.ilVoice = "on";
    voiceLabel();
    prepareAudio();
  }

  function greetCall() {
    const greeting = "Olá! Sou a Mioko. Estou aqui para conversar com você. Como você está?";
    add("ai", greeting, true);
    say(greeting);
    if (!SR) add("ai", "Este navegador não oferece reconhecimento de voz. Você pode continuar digitando e ouvir minhas respostas.");
  }

  function add(type, text, save = false) {
    const d = document.createElement("div");
    d.className = "msg " + type;
    const name = document.createElement("b");
    name.textContent = type === "user" ? "Você" : "Mioko IA";
    const p = document.createElement("p");
    p.textContent = String(text);
    d.append(name, p);
    $("#chat").appendChild(d);
    $("#chat").scrollTop = $("#chat").scrollHeight;
    if (save) {
      history.push({
        role: type === "ai" ? "assistant" : "user",
        content: String(text)
      });
      history = history.slice(-30);
      try {
        localStorage.ilHistory = JSON.stringify(history);
      } catch {}
    }
    return d;
  }

  function cleanSpeech(text) {
    return String(text)
      .replace(/[*#_`~]+/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function headers() {
    const c = config();
    const result = { "Content-Type": "application/json" };
    if (c.SUPABASE_PUBLISHABLE_KEY) {
      result.apikey = c.SUPABASE_PUBLISHABLE_KEY;
    } else if (c.SUPABASE_ANON_KEY) {
      result.apikey = c.SUPABASE_ANON_KEY;
      result.Authorization = "Bearer " + c.SUPABASE_ANON_KEY;
    }
    return result;
  }

  function stopListening() {
    clearTimeout(listenTimer);
    listening = false;
    const old = recognition;
    recognition = null;
    if (old) {
      old.onend = null;
      old.onresult = null;
      old.onerror = null;
      old.onstart = null;
      try { old.abort(); } catch {}
    }
    $("#mic").textContent = "🎙️ Microfone opcional";
  }

  function resumeListening(delay = 400) {
    clearTimeout(listenTimer);
    if (callMode) {
      listenTimer = setTimeout(startListening, delay);
    }
  }

  function closeMouth() {
    cancelAnimationFrame(audioFrame);
    audioFrame = 0;
    window.MiokoAvatar?.closeMouth();
    $("#miokoVideo")?.classList.remove("speaking");
  }

  function releaseAudio() {
    const a = currentAudio;
    currentAudio = null;
    if (a) {
      a.onplaying = null;
      a.onpause = null;
      a.onwaiting = null;
      a.onstalled = null;
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    if (audioCleanup) {
      try { audioCleanup(); } catch {}
      audioCleanup = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    analyser = null;
    closeMouth();
  }

  function stopSpeech() {
    voiceGeneration++;
    voiceRequest?.abort();
    voiceRequest = null;
    speechPending = false;
    if (nativeUtterance) {
      nativeUtterance.onstart = null;
      nativeUtterance.onend = null;
      nativeUtterance.onerror = null;
      nativeUtterance = null;
      window.speechSynthesis?.cancel();
    }
    releaseAudio();
  }

  function stopMedia() {
    callMode = null;
    stopListening();
    stopSpeech();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    const v = $("#userVideo");
    v.srcObject = null;
    v.hidden = true;
    $("#userPlaceholder").hidden = false;
    $("#cameraStatus").textContent = "Câmera opcional";
    $("#videoRoom").classList.remove("in-call");
    $("#miokoVideo").classList.remove("calling", "speaking");
    $("#videoCall").textContent = "📹 Vídeo IA";
    $("#voiceCall").textContent = "📞 Chamada IA";
  }

  async function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw Error("Web Audio indisponível");
    if (!audioContext) {
      audioContext = new AC();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }

  function prepareAudio() {
    unlockAudio().catch(() => {});
  }

  function analyseAudio(a) {
    closeMouth();
    const samples = new Uint8Array(analyser.fftSize);
    function tick() {
      if (
        currentAudio !== a || a.paused || a.ended ||
        a.readyState < 3 || audioContext.state !== "running"
      ) {
        closeMouth();
        return;
      }
      $("#miokoVideo").classList.add("speaking");
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const value = (sample - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / samples.length);
      window.MiokoAvatar?.setMouth(
        rms < 0.012 ? 0 : Math.min(1, (rms - 0.012) * 7)
      );
      audioFrame = requestAnimationFrame(tick);
    }
    tick();
  }

  function selectNativeVoice() {
    const voices = window.speechSynthesis.getVoices();
    const brazilian = voices.filter(v =>
      v.lang.replace("_", "-").toLowerCase() === "pt-br"
    );
    const portuguese = voices.filter(v =>
      v.lang.toLowerCase().startsWith("pt")
    );
    const candidates = brazilian.length ? brazilian : portuguese;
    return candidates.find(v =>
      /female|feminina|maria|francisca|luciana|victoria|vitoria|vitória/i
        .test(v.name)
    ) || candidates[0] || null;
  }

  async function waitForNativeVoices() {
    if (window.speechSynthesis.getVoices().length) return;
    await new Promise(resolve => {
      const synth = window.speechSynthesis;
      let timer;
      const finish = () => {
        clearTimeout(timer);
        synth.removeEventListener("voiceschanged", finish);
        resolve();
      };
      synth.addEventListener("voiceschanged", finish);
      timer = setTimeout(finish, 1000);
    });
  }

  async function nativeSay(text, generation) {
    if (
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance === "undefined"
    ) {
      throw Error("O navegador não oferece voz alternativa");
    }
    await waitForNativeVoices();
    if (generation !== voiceGeneration || !voice) return;

    const u = new SpeechSynthesisUtterance(text);
    const selected = selectNativeVoice();
    u.lang = "pt-BR";
    u.rate = 1.05;
    u.pitch = 1;
    if (selected) {
      u.voice = selected;
      u.lang = selected.lang;
    }
    nativeUtterance = u;

    u.onstart = () => {
      if (generation !== voiceGeneration) return;
      const started = performance.now();
      function tick(now) {
        if (
          nativeUtterance !== u ||
          generation !== voiceGeneration
        ) {
          closeMouth();
          return;
        }
        const synth = window.speechSynthesis;
        if (synth.speaking && !synth.paused) {
          $("#miokoVideo").classList.add("speaking");
          const phase = (now - started) / 1000;
          const opening = Math.abs(
            Math.sin(phase * 13) * Math.sin(phase * 4.7)
          );
          window.MiokoAvatar?.setMouth(opening * 0.8);
        } else {
          window.MiokoAvatar?.closeMouth();
        }
        audioFrame = requestAnimationFrame(tick);
      }
      closeMouth();
      audioFrame = requestAnimationFrame(tick);
    };

    u.onend = () => {
      if (nativeUtterance !== u) return;
      nativeUtterance = null;
      speechPending = false;
      closeMouth();
      resumeListening();
    };

    u.onerror = e => {
      if (nativeUtterance !== u) return;
      nativeUtterance = null;
      speechPending = false;
      closeMouth();
      if (!["canceled", "interrupted"].includes(e.error)) {
        add("ai",
          "Não consegui reproduzir a voz do celular: " +
          e.error + ". Toque em COMEÇAR AULA para tentar novamente."
        );
      }
    };

    window.speechSynthesis.speak(u);
  }

  async function serviceSay(text, generation) {
    const c = config();
    if (!c.VOICE_ENDPOINT) {
      throw Error("Serviço de voz não configurado");
    }
    await unlockAudio();
    if (generation !== voiceGeneration) return;

    const controller = new AbortController();
    voiceRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    let blob;
    try {
      const r = await fetch(c.VOICE_ENDPOINT, {
        method: "POST",
        headers: headers(),
        signal: controller.signal,
        body: JSON.stringify({ text, language: lang })
      });
      if (!r.ok) throw Error("Serviço de voz HTTP " + r.status);
      blob = await r.blob();
      if (!blob.size || !blob.type.startsWith("audio/")) {
        throw Error("O serviço não devolveu áudio válido");
      }
    } finally {
      clearTimeout(timeout);
      if (voiceRequest === controller) voiceRequest = null;
    }
    if (generation !== voiceGeneration) return;

    audioUrl = URL.createObjectURL(blob);
    const a = new Audio(audioUrl);
    currentAudio = a;
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaElementSource(a);
    const node = analyser;
    source.connect(node);
    node.connect(audioContext.destination);
    audioCleanup = () => {
      source.disconnect();
      node.disconnect();
    };

    const quiet = () => {
      if (currentAudio === a) closeMouth();
    };
    a.onplaying = () => analyseAudio(a);
    a.onpause = quiet;
    a.onwaiting = quiet;
    a.onstalled = quiet;
    a.onended = () => {
      if (currentAudio !== a) return;
      releaseAudio();
      speechPending = false;
      resumeListening();
    };
    a.onerror = () => {
      if (currentAudio !== a || generation !== voiceGeneration) return;
      releaseAudio();
      voiceRetryAfter = Date.now() + 60000;
      nativeSay(text, generation).catch(e => {
        if (generation !== voiceGeneration) return;
        speechPending = false;
        closeMouth();
        add("ai", "Voz indisponível: " + e.message);
      });
    };

    await a.play();
    if (generation !== voiceGeneration) a.pause();
  }

  async function say(value) {
    if (!voice) return;
    const text = cleanSpeech(value);
    if (!text) return;
    stopListening();
    stopSpeech();
    const generation = voiceGeneration;
    speechPending = true;

    // Conversa ao vivo: use a voz nativa primeiro para começar a falar sem
    // esperar a função remota de áudio. O serviço remoto fica fora do caminho
    // crítico da conversa e não pode atrasar a resposta falada.
    try {
      await nativeSay(text, generation);
      return;
    } catch (e) {
      if (generation !== voiceGeneration) return;
      speechPending = false;
      closeMouth();
      add("ai",
        "Voz indisponível: " + e.message +
        ". A conversa por texto continua disponível."
      );
    }
  }

  $("#enter").onclick = () => {
    $("#login").classList.add("hide");
    $("#app").classList.remove("hide");
    prepareAudio();
  };

  $("#exitCourse").onclick = () => {
    stopMedia();
    $("#app").classList.add("hide");
    $("#login").classList.remove("hide");
    $("#pass").value = "";
    scrollTo(0, 0);
  };

  document.querySelectorAll("[data-mode]").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("[data-mode]").forEach(x =>
        x.classList.remove("active")
      );
      b.classList.add("active");
    };
  });

  // Italian replaces the former generic language option.
  const otherLanguage = document.querySelector('[data-lang="Outro"]');
  if (otherLanguage) {
    otherLanguage.dataset.lang = "Italiano";
    otherLanguage.textContent = "🇮🇹 Italiano";
  }
  if (lang === "Outro") {
    lang = "Italiano";
    localStorage.ilLang = lang;
    $("#status").textContent = lang + " • avaliação adaptativa";
  }

  document.querySelectorAll("[data-lang]").forEach(b => {
    b.classList.toggle("sel", b.dataset.lang === lang);
    b.onclick = () => {
      document.querySelectorAll("[data-lang]").forEach(x =>
        x.classList.remove("sel")
      );
      b.classList.add("sel");
      lang = b.dataset.lang;
      localStorage.ilLang = lang;
      $("#status").textContent = lang + " • avaliação adaptativa";
    };
  });
  $("#status").textContent = lang + " • avaliação adaptativa";

  $("#voice").onclick = () => {
    voice = !voice;
    localStorage.ilVoice = voice ? "on" : "off";
    voiceLabel();
    if (!voice) {
      stopSpeech();
      resumeListening();
    } else {
      prepareAudio();
    }
  };

  $("#begin").onclick = () => {
    enableVoice();
    const text =
      "Olá. Sou Mioko, Professora Virtual de Idiomas. " +
      "Podemos conversar sobre qualquer assunto e eu adapto " +
      "o ensino de " + lang + " ao seu nível. " +
      "O que você gostaria de conversar ou aprender?";
    add("ai", text, true);
    say(text);
  };

  function endpoint() {
    const c = config();
    return c.AI_ENDPOINT || (
      c.SUPABASE_PROJECT_REF
        ? "https://" + c.SUPABASE_PROJECT_REF +
          ".supabase.co/functions/v1/il-ai"
        : ""
    );
  }

  function send(value) {
    const message = String(value ?? $("#text").value).trim();
    if (!message) return;
    if (voice) prepareAudio();
    $("#text").value = "";
    stopListening();
    stopSpeech();
    replyQueue = replyQueue
      .catch(() => {})
      .then(() => sendMessage(message));
    return replyQueue;
  }

  async function sendMessage(message) {
    replyPending = true;
    stopListening();
    const generation = voiceGeneration;
    add("user", message, true);
    const ep = endpoint();
    if (!ep) {
      replyPending = false;
      add("ai", "Falta configurar a função il-ai em config.js.");
      return;
    }
    const waiting = add("ai", "🧠 Pensando...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: headers(),
        signal: controller.signal,
        body: JSON.stringify({
          message,
          language: lang,
          history: history.slice(0, -1).slice(-10)
        })
      });
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); }
      catch { throw Error("Resposta inválida do serviço de IA"); }
      if (!r.ok) {
        throw Error(
          "HTTP " + r.status + ": " +
          (data.error || data.message || "Falha")
        );
      }
      const answer =
        data.answer || data.reply || data.output_text ||
        data.target || data.japanese;
      if (!answer) throw Error("A função respondeu sem texto");
      waiting.remove();
      add("ai", String(answer), true);
      if (generation === voiceGeneration) say(String(answer));
    } catch (e) {
      waiting.remove();
      const limited = /429|rate.?limit|too many requests/i.test(e.message);
      const quota = /insufficient_quota|exceeded your current quota/i.test(e.message);
      const retry = e.message.match(/try again in ([0-9.hms ]+)/i)?.[1]?.trim();
      add("ai",
        e.name === "AbortError"
          ? "A resposta demorou demais. Tente enviar novamente."
          : quota
            ? "O serviço de IA informou falta de cota disponível. É necessário verificar a conta do serviço."
            : limited
              ? "A Mioko atingiu o limite temporário do serviço de IA. Aguarde " +
                (retry || "alguns minutos") +
                " antes de enviar outra pergunta. A resposta não foi gerada."
              : "❌ IA não conectou: " + e.message
      );
    } finally {
      clearTimeout(timeout);
      replyPending = false;
      if (!speechPending && !currentAudio && !nativeUtterance) {
        resumeListening(500);
      }
    }
  }

  $("#send").onclick = () => send();
  $("#text").onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  document.querySelectorAll("[data-q]").forEach(b => {
    b.onclick = () => send(b.dataset.q);
  });

  async function startVideo() {
    if (callMode === "video") {
      stopMedia();
      return;
    }
    stopMedia();
    voiceInputBlocked = false;
    try {
      const opened = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      stream = opened;
      callMode = "video";
      const v = $("#userVideo");
      v.srcObject = stream;
      v.hidden = false;
      $("#userPlaceholder").hidden = true;
      $("#cameraStatus").textContent = "Câmera e microfone ativos";
      $("#videoRoom").classList.add("in-call");
      $("#miokoVideo").classList.add("calling");
      $("#videoCall").textContent = "⏹ Encerrar vídeo";
      v.play().catch(() => {});
      add("ai",
        "Vídeo com a Mioko iniciado. Pode falar ou escrever."
      );
      greetCall();
    } catch (e) {
      stopMedia();
      add("ai",
        "Não consegui abrir câmera/microfone: " + e.message +
        ". Você pode continuar escrevendo."
      );
    }
  }

  $("#videoCall").onclick = () => {
    prepareAudio();
    voice = true;
    localStorage.ilVoice = "on";
    voiceLabel();
    startVideo();
  };

  $("#voiceCall").onclick = () => {
    if (callMode === "voice") {
      stopMedia();
      add("ai", "Chamada encerrada.");
      return;
    }
    stopMedia();
    voiceInputBlocked = false;
    prepareAudio();
    voice = true;
    localStorage.ilVoice = "on";
    voiceLabel();
    callMode = "voice";
    $("#miokoVideo").classList.add("calling");
    $("#voiceCall").textContent = "⏹ Encerrar chamada";
    add("ai",
      "Chamada com a Mioko iniciada. Pode falar ou escrever."
    );
    greetCall();
  };

  $("#photo").onclick = () => $("#photoIn").click();
  $("#file").onclick = () => $("#fileIn").click();
  ["#photoIn", "#fileIn"].forEach(id => {
    $(id).onchange = e => {
      const file = e.target.files[0];
      if (file) {
        add("user",
          "Arquivo selecionado: " + file.name +
          " (upload ainda não conectado ao serviço)."
        );
      }
    };
  });

  const SR =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  function startListening() {
    if (
      !callMode || !SR || recognition || listening ||
      currentAudio || nativeUtterance || speechPending ||
      replyPending || voiceInputBlocked
    ) return;

    const r = new SR();
    recognition = r;
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = false;

    r.onstart = () => {
      if (recognition !== r) return;
      listening = true;
      $("#mic").textContent = "🎙️ Ouvindo...";
    };
    r.onresult = e => {
      if (recognition !== r) return;
      const spoken =
        e.results[e.results.length - 1][0].transcript.trim();
      if (spoken) send(spoken);
    };
    r.onend = () => {
      if (recognition !== r) return;
      recognition = null;
      listening = false;
      $("#mic").textContent = "🎙️ Microfone opcional";
      resumeListening(250);
    };
    r.onerror = e => {
      if (recognition !== r) return;
      listening = false;
      if ([
        "not-allowed", "service-not-allowed", "audio-capture"
      ].includes(e.error)) {
        voiceInputBlocked = true;
      }
      $("#mic").textContent = "🎙️ Microfone opcional";
      if (!["no-speech", "aborted"].includes(e.error)) {
        add("ai",
          "Microfone: " + e.error +
          ". Você pode continuar digitando."
        );
      }
    };
    try { r.start(); }
    catch {
      recognition = null;
      listening = false;
    }
  }

  $("#mic").onclick = () => {
    if (!SR) {
      alert(
        "Este navegador não oferece reconhecimento de voz. " +
        "Você pode escrever para a Mioko."
      );
      return;
    }
    voiceInputBlocked = false;
    enableVoice();
    if (listening) {
      stopListening();
      return;
    }
    if (!callMode) {
      callMode = "voice";
      $("#miokoVideo").classList.add("calling");
      $("#voiceCall").textContent = "⏹ Encerrar chamada";
    }
    startListening();
  };

  window.addEventListener("pagehide", stopMedia);
})();
