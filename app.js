// IL TALK MIOKO — serviço de voz com alternativa do navegador.
{
  const script = document.createElement("script");
  script.src = "mioko-avatar.js?v=20261009-voz2";
  document.head.appendChild(script);
}

(() => {
  const $ = s => document.querySelector(s);
  const config = () => window.IL_TALK_CONFIG || {};

  let lang = localStorage.ilLang || "Português";
  const locales = { Português: "pt-BR", Japonês: "ja-JP", Inglês: "en-US", Espanhol: "es-ES", Francês: "fr-FR", Coreano: "ko-KR", Italiano: "it-IT" };
  const locale = () => locales[lang] || "pt-BR";
  const greetings = {
    Português: "Olá! Sou a Mioko. O que você gostaria de conversar?",
    Japonês: "こんにちは、ミオコです。何について話しましょうか？",
    Inglês: "Hello! I'm Mioko. What would you like to talk about?",
    Espanhol: "¡Hola! Soy Mioko. ¿De qué te gustaría hablar?",
    Francês: "Bonjour ! Je suis Mioko. De quoi aimeriez-vous parler ?",
    Coreano: "안녕하세요! 저는 미오코입니다. 어떤 이야기를 나누고 싶으세요?",
    Italiano: "Ciao! Sono Mioko. Di cosa vorresti parlare?"
  };
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
  let micPaused = false;
  let replyPending = false;
  let speechPending = false;
  let currentAudio = null;
  let nativeUtterance = null;
  let nativeCancel = null;
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
  let conversationGeneration = 0;
  let replyController = null;
  let recognitionFailures = 0;
  let recorderStop = null;
  let recordingGeneration = 0;
  let useRecorder = false;

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
    const greeting = greetings[lang] || greetings.Português;
    add("ai", greeting, true);
    say(greeting);
    
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
    recordingGeneration++;
    recorderStop?.();
    recorderStop = null;
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
    if (callMode && !micPaused && !voiceInputBlocked) {
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
    nativeCancel?.();
    nativeCancel = null;
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
    micPaused = false;
    conversationGeneration++;
    replyController?.abort();
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
    const code = locale().toLowerCase();
    const exact = voices.filter(v => v.lang.replace("_", "-").toLowerCase() === code);
    const compatible = voices.filter(v => v.lang.toLowerCase().split("-")[0] === code.split("-")[0]);
    const candidates = exact.length ? exact : compatible;
    return candidates.find(v => /female|feminina|maria|francisca|luciana|victoria|vitoria|vitória|samantha|zira|kyoko|haruka|nanami|yuna|heami|amelie|audrey|monica|paulina|elsa|isabella/i.test(v.name)) || candidates[0] || null;
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

  function speechChunks(text) {
    // Short utterances keep mobile speech engines from holding one long response.
    const chunks = [];
    let remaining = text.trim();
    while (remaining.length > 240) {
      const portion = remaining.slice(0, 240);
      let cut = Math.max(portion.lastIndexOf(". "), portion.lastIndexOf("? "), portion.lastIndexOf("! "), portion.lastIndexOf("。"), portion.lastIndexOf("？"), portion.lastIndexOf("！"));
      cut = cut >= 60 ? cut + 1 : Math.max(120, portion.lastIndexOf(" "));
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  async function nativeSay(text, generation) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      throw Error("O navegador não oferece voz alternativa");
    }
    await waitForNativeVoices();
    const synth = window.speechSynthesis;
    const selected = selectNativeVoice();
    if (!selected) throw Error("Este aparelho não tem voz de " + lang + ". Instale a voz desse idioma nas configurações de fala do aparelho ou teste no Chrome/Edge com essa voz disponível.");
    try {
      for (const chunk of speechChunks(text)) {
        if (generation !== voiceGeneration || !voice) return;
        await new Promise((resolve, reject) => {
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = selected?.lang || locale();
          u.rate = 1.05;
          u.pitch = 1;
          if (selected) u.voice = selected;
          nativeUtterance = u;
          let done = false, started = 0, deadline, boundaryUntil = 0;
          const finish = error => {
            if (done) return;
            done = true;
            clearTimeout(deadline);
            u.onstart = u.onend = u.onerror = u.onboundary = null;
            if (nativeUtterance === u) {
              nativeUtterance = null;
              nativeCancel = null;
              closeMouth();
            }
            if (error) reject(error); else resolve();
          };
          nativeCancel = () => {
            // Cancel before detaching so the browser cannot continue the old audio.
            finish();
            synth.cancel();
          };
          deadline = setTimeout(() => {
            finish(Error("O aparelho não iniciou a voz. Toque no microfone para continuar."));
            synth.cancel();
          }, 8000);
          u.onboundary = e => {
            if (done || generation !== voiceGeneration) return;
            if (e.charIndex >= chunk.trimEnd().length - 1) { closeMouth(); return; }
            boundaryUntil = performance.now() + 180;
          };
          u.onstart = () => {
            if (generation !== voiceGeneration || nativeUtterance !== u) return;
            started = performance.now();
            clearTimeout(deadline);
            deadline = setTimeout(() => {
              finish(Error("A voz do aparelho parou de responder. Toque no microfone para continuar."));
              synth.cancel();
            }, Math.max(15000, chunk.length * 180));
            function tick(now) {
              if (done || nativeUtterance !== u || generation !== voiceGeneration) return;
              if (!synth.speaking) {
                closeMouth();
                // Some engines omit onend. Stop the animation and release the turn.
                if (now - started > 500) { finish(); return; }
              } else if (synth.paused) {
                window.MiokoAvatar?.closeMouth();
                $("#miokoVideo")?.classList.remove("speaking");
              } else {
                $("#miokoVideo").classList.add("speaking");
                const phase = (now - started) / 1000;
                // Native speech exposes no audio samples. Animate only brief real speech boundaries.
                window.MiokoAvatar?.setMouth(now < boundaryUntil ? Math.abs(Math.sin(phase * 13)) * 0.8 : 0);
              }
              audioFrame = requestAnimationFrame(tick);
            }
            closeMouth();
            audioFrame = requestAnimationFrame(tick);
          };
          u.onend = () => finish();
          u.onerror = e => finish(Error(e.error || "Falha na voz do aparelho"));
          try { synth.speak(u); } catch (e) { finish(e); }
        });
      }
    } finally {
      if (generation === voiceGeneration) {
        speechPending = false;
        closeMouth();
        resumeListening();
      }
    }
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
      if (!r.ok) {
        const detail = await r.text();
        const error = Error("Serviço de voz HTTP " + r.status + ": " + detail.slice(0,600));
        error.status = r.status;
        throw error;
      }
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

    try {
      await nativeSay(text, generation);
    } catch (e) {
      if (generation !== voiceGeneration) return;
      speechPending = false;
      closeMouth();
      add("ai", "Voz indisponível: " + e.message + ". A conversa por texto continua disponível.");
      resumeListening();
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
      stopListening();
      stopSpeech();
      lang = b.dataset.lang;
      localStorage.ilLang = lang;
      $("#status").textContent = lang + " • avaliação adaptativa";
      resumeListening();
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
    const text = greetings[lang] || greetings.Português;
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
    const conversation = conversationGeneration;
    replyQueue = replyQueue
      .catch(() => {})
      .then(() => { if (conversation === conversationGeneration) return sendMessage(message, conversation); });
    return replyQueue;
  }

  async function sendMessage(message, conversation) {
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
    replyController = controller;
    const requestLanguage = lang;
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: headers(),
        signal: controller.signal,
        body: JSON.stringify({
          message: message + "\n\n[Idioma da resposta: " + lang + ". Use exclusivamente esse idioma, exceto traduções ou exemplos solicitados. Converse sobre o assunto pedido; não imponha uma aula. Adapte explicações e vocabulário ao nível solicitado, do básico ao avançado." + (callMode ? " Esta é uma conversa por voz: responda em turnos curtos e naturais, sem listas longas, e mantenha o contexto." : "") + "]",
          language: lang,
          history: history.slice(0, -1).slice(-10).map(x => ({role: x.role, content: String(x.content).slice(0,2000)}))
        })
      });
      const raw = await r.text();
      if (conversation !== conversationGeneration) { waiting.remove(); return; }
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
      if (generation === voiceGeneration && requestLanguage === lang) say(String(answer));
    } catch (e) {
      waiting.remove();
      if (conversation !== conversationGeneration) return;
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
      if (replyController === controller) replyController = null;
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
      const session = conversationGeneration;
      const opened = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      if (session !== conversationGeneration) { opened.getTracks().forEach(track => track.stop()); return; }
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
      v.muted = true;
      v.play().catch(() => {});
      add("ai",
        "Vídeo iniciado. A câmera mostra sua prévia; imagens não são enviadas à IA. Pode falar ou escrever."
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

  $("#voiceCall").onclick = async () => {
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
    const session = conversationGeneration;
    $("#voiceCall").textContent = "⏹ Encerrar chamada";
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        // Ask on the call gesture, rather than after the greeting has finished.
        const permission = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        permission.getTracks().forEach(track => track.stop());
      } catch {
        if (session !== conversationGeneration) return;
        voiceInputBlocked = true;
        add("ai", "Não consegui acessar o microfone. Permita o microfone nas configurações do site e toque nele para tentar novamente.");
      }
    }
    if (session !== conversationGeneration) return;
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


  async function startRecordedListening() {
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      voiceInputBlocked = true;
      add("ai", "Este navegador não permite gravar o microfone. Use Chrome ou Edge.");
      return;
    }
    const token = ++recordingGeneration;
    listening = true;
    let mic, rec, node, meter, timer, submitted = false;
    const cleanup = () => {
      clearInterval(timer);
      if (rec?.state === "recording") { rec.onstop = null; rec.stop(); }
      node?.disconnect(); meter?.disconnect();
      mic?.getTracks().forEach(t => t.stop());
    };
    recorderStop = cleanup;
    try {
      await unlockAudio();
      mic = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if (token !== recordingGeneration) { cleanup(); return; }
      const mime = ["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus"].find(x => MediaRecorder.isTypeSupported(x));
      rec = new MediaRecorder(mic, mime ? {mimeType:mime} : undefined);
      const chunks = [];
      rec.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
      node = audioContext.createMediaStreamSource(mic);
      meter = audioContext.createAnalyser(); meter.fftSize=1024; node.connect(meter);
      const samples = new Float32Array(meter.fftSize);
      let heard=false, quietSince=0, began=performance.now();
      const finish = () => { if(submitted) return; submitted=true; clearInterval(timer); rec.stop(); };
      rec.onstop = async () => {
        cleanup();
        if(token !== recordingGeneration) return;
        recorderStop=null;
        if (!heard) { listening=false; resumeListening(500); return; }
        $("#mic").textContent="🎙️ Entendendo sua fala...";
        try {
          const form = new FormData();
          const type=rec.mimeType || "audio/webm";
          form.append("file",new Blob(chunks,{type}),type.includes("mp4")?"fala.mp4":type.includes("ogg")?"fala.ogg":"fala.webm");
          form.append("language",locale().split("-")[0]);
          const h=headers(); delete h["Content-Type"];
          const response=await fetch(config().VOICE_ENDPOINT,{method:"POST",headers:h,body:form,signal:AbortSignal.timeout(30000)});
          const data=await response.json();
          if(token !== recordingGeneration) return;
          if(!response.ok) throw Error(data.error || "Falha ao entender a fala");
          listening=false;
          if(data.text?.trim()) send(data.text); else resumeListening();
        } catch(e) {
          if(token !== recordingGeneration) return;
          listening=false; voiceInputBlocked=true;
          add("ai","Microfone: " + e.message + ". Toque no microfone para tentar novamente.");
        }
      };
      rec.start();
      $("#mic").textContent="🎙️ Ouvindo... fale e faça uma pausa";
      timer=setInterval(() => {
        if(token !== recordingGeneration) { cleanup(); return; }
        meter.getFloatTimeDomainData(samples);
        const rms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);
        const now=performance.now();
        if(rms>0.018) { heard=true; quietSince=0; }
        else if(heard) { if(!quietSince) quietSince=now; if(now-quietSince>1000) finish(); }
        if(now-began>20000) finish();
      },100);
    } catch(e) {
      cleanup();
      if(token !== recordingGeneration) return;
      listening=false; recorderStop=null; voiceInputBlocked=true;
      add("ai","Não consegui abrir o microfone: " + e.message);
    }
  }

  function startListening() {
    if (
      !callMode || recognition || listening ||
      currentAudio || nativeUtterance || speechPending ||
      replyPending || voiceInputBlocked || micPaused
    ) return;

    if (!SR || useRecorder) { startRecordedListening(); return; }
    const r = new SR();
    recognition = r;
    r.lang = locale();
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      if (recognition !== r) return;
      listening = true;
      $("#mic").textContent = "🎙️ Ouvindo...";
    };
    r.onresult = e => {
      if (recognition !== r) return;
      const results = Array.from(e.results);
      const final = results.filter(result => result.isFinal);
      const preview = results.map(result => result[0].transcript).join(" ").trim();
      $("#mic").textContent = preview ? "🎙️ " + preview.slice(0, 80) : "🎙️ Ouvindo...";
      const spoken = final.map(result => result[0].transcript).join(" ").trim();
      if (spoken) recognitionFailures = 0;
      if (spoken && !replyPending && !speechPending && !nativeUtterance && !currentAudio) send(spoken);
    };
    r.onend = () => {
      if (recognition !== r) return;
      recognition = null;
      listening = false;
      $("#mic").textContent = "🎙️ Microfone opcional";
      resumeListening(Math.min(10000, 250 * 2 ** recognitionFailures));
    };
    r.onerror = e => {
      if (recognition !== r) return;
      listening = false;
      if (["network", "language-not-supported", "service-not-allowed"].includes(e.error) && window.MediaRecorder) {
        useRecorder = true; stopListening(); resumeListening(); return;
      }
      if ([
        "not-allowed", "audio-capture"
      ].includes(e.error)) {
        voiceInputBlocked = true;
      }
      if (!["no-speech", "aborted"].includes(e.error)) {
        recognitionFailures++;
        if (recognitionFailures >= 5) voiceInputBlocked = true;
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
    catch (e) {
      recognition = null;
      listening = false;
      recognitionFailures++;
      if (recognitionFailures <= 3) resumeListening(1000 * recognitionFailures);
      else { voiceInputBlocked = true; add("ai", "Não consegui iniciar a escuta: " + e.message + ". Toque no microfone para tentar novamente."); }
    }
  }

  $("#mic").onclick = () => {

    const interrupted = speechPending || currentAudio || nativeUtterance || replyPending;
    if (listening && !interrupted) {
      micPaused = true;
      stopListening();
      $("#mic").textContent = "🎙️ Microfone pausado — toque para falar";
      return;
    }
    voiceInputBlocked = false;
    recognitionFailures = 0;
    micPaused = false;
    enableVoice();
    if (interrupted) {
      stopSpeech();
      if (replyPending) {
        conversationGeneration++;
        replyController?.abort();
        // The current queue entry settles before another message is sent.
        replyPending = false;
      }
    }
    if (!callMode) {
      callMode = "voice";
      $("#miokoVideo").classList.add("calling");
      $("#voiceCall").textContent = "⏹ Encerrar chamada";
    }
    startListening();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopListening(); stopSpeech(); }
    else if (callMode && !voiceInputBlocked) resumeListening();
  });
  window.addEventListener("pagehide", stopMedia);
})();

