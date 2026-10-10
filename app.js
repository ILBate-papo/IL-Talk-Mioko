// Payment, leads and access statistics for IL Talk Mioko.
{
 const script=document.createElement("script");script.src="business.js?v=20261009-seo1";document.head.appendChild(script);
 const style=document.createElement("link");style.rel="stylesheet";style.href="business.css?v=20261009-1";document.head.appendChild(style);
}
// Download the signed Android app from the public login page.
{
  const installScript = document.createElement("script");
  installScript.src = "instalar.js?v=1.0.0";
  document.head.appendChild(installScript);
}
// Load access controls before allowing any course entry.
{
  const authScript = document.createElement("script");
  authScript.src = "auth.js?v=20261009-negocio1";
  document.head.appendChild(authScript);
  const authStyle = document.createElement("link");
  authStyle.rel = "stylesheet";
  authStyle.href = "auth.css?v=20261009-acesso1";
  document.head.appendChild(authStyle);
}
// IL TALK MIOKO — serviço de voz com alternativa do navegador.
{
  const script = document.createElement("script");
  script.src = "mioko-avatar.js?v=20261009-inicio";
  document.head.appendChild(script);
}

(() => {
  const $ = s => document.querySelector(s);
  const config = () => window.IL_TALK_CONFIG || {};

  let lang = localStorage.ilLang || "Português";
  const locales = { Português: "pt-BR", Japonês: "ja-JP", Inglês: "en-US", Espanhol: "es-ES", Francês: "fr-FR", Coreano: "ko-KR", Italiano: "it-IT" };
  const locale = () => locales[lang] || "pt-BR";
  const legacyAdvancedLanguage = localStorage.ilBeginnerSupport === "off" ? lang : null;
  const levelStorageKey = () => "ilMiokoCourseLevels:" + (window.MiokoAuth?.userId() || "guest");
  function readCourseLevel() {
    try {
      const saved = JSON.parse(localStorage.getItem(levelStorageKey()) || "{}")[lang];
      if (["beginner", "intermediate", "advanced"].includes(saved)) return saved;
    } catch {}
    return lang === legacyAdvancedLanguage ? "advanced" : "beginner";
  }
  let lessonLevel = readCourseLevel();
  const beginnerLesson = () => lang !== "Português" && !!locales[lang] && lessonLevel === "beginner";
  const inputLocale = () => beginnerLesson() ? "pt-BR" : locale();
  const spokenLocale = () => beginnerLesson() ? "pt-BR" : locale();
  const greetingForLesson = () => beginnerLesson()
    ? "Olá! Vamos aprender " + lang.toLowerCase() + ". Vou conversar em português e explicar as frases que você pedir. O que gostaria de aprender?"
    : (greetings[lang] || greetings.Português);
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
  let historyKey = "";
  function loadUserHistory() {
  history = [];
  historyKey = "ilMiokoHistory:" + window.MiokoAuth.userId();
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
    if (Array.isArray(saved)) history = saved;
  } catch {}
  }

  let stream = null;
  let callMode = null;
  let recognition = null;
  let listening = false;
  let voiceInputBlocked = false;
  let aiCooldownUntil = 0;
  let cooldownTicker = null;
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
  let recorderSubmit = null;
  let recordingGeneration = 0;
  const preferRecorder = /Android/i.test(navigator.userAgent || "") || !(window.SpeechRecognition || window.webkitSpeechRecognition);
  let useRecorder = preferRecorder;

  // Keep the current turn visible beside Mioko, even when the tools are below the screen.
  const turnStatus = document.createElement("span");
  turnStatus.id = "miokoTurnStatus";
  turnStatus.setAttribute("role", "status");
  turnStatus.style.cssText = "display:block;color:#9fe9d5;font-size:14px;padding:8px 4px;text-align:center";
  $("#miokoVideo").append(turnStatus);
  const finishTurnButton = document.createElement("button");
  finishTurnButton.type = "button";
  finishTurnButton.className = "nb";
  finishTurnButton.textContent = "Terminei de falar";
  finishTurnButton.hidden = true;
  finishTurnButton.onclick = () => {
    if (recorderSubmit) recorderSubmit();
    else if (recognition) { try { recognition.stop(); } catch {} }
  };
  $("#miokoVideo").append(finishTurnButton);
  const callStatus = text => { turnStatus.textContent = text; };

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
    const greeting = greetingForLesson();
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
        if (historyKey) localStorage.setItem(historyKey, JSON.stringify(history));
      } catch {}
    }
    return d;
  }

  function cleanSpeech(text) {
    return String(text)
      .replace(/^\s*(?:Leitura|Romanização|Romaji)\s*:[^\n]*$/gim, " ")
      .replace(/[*#_`~]+/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function headers() {
    const c = config();
    const result = { "Content-Type": "application/json" };
    if (c.SUPABASE_PUBLISHABLE_KEY) {
      result.apikey = c.SUPABASE_PUBLISHABLE_KEY;
    } else if (c.SUPABASE_ANON_KEY) {
      result.apikey = c.SUPABASE_ANON_KEY;
      result.Authorization = "Bearer " + c.SUPABASE_ANON_KEY;
    }
    const token = await window.MiokoAuth?.requireAccess();
    if (!token) throw Error("Entre com seu e-mail e senha.");
    result.Authorization = "Bearer " + token;
    return result;
  }

  function stopListening() {
    clearTimeout(listenTimer);
    recordingGeneration++;
    recorderStop?.();
    recorderStop = null;
    recorderSubmit = null;
    finishTurnButton.hidden = true;
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

  function showCooldown(seconds) {
    aiCooldownUntil = Date.now() + Math.max(1, seconds) * 1000;
    clearInterval(cooldownTicker);
    const refresh = () => {
      const remaining = Math.ceil((aiCooldownUntil - Date.now()) / 1000);
      if (remaining > 0) callStatus("O serviço está no limite de uso. Nova tentativa disponível em " + remaining + " segundos.");
      else { clearInterval(cooldownTicker); cooldownTicker = null; callStatus("Pode falar novamente."); resumeListening(); }
    };
    refresh(); cooldownTicker = setInterval(refresh, 1000);
  }

  function resumeListening(delay = 400) {
    clearTimeout(listenTimer);
    if (callMode && !micPaused && !voiceInputBlocked) {
      listenTimer = setTimeout(startListening, Math.max(delay, aiCooldownUntil - Date.now()));
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
    callStatus("");
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

  function selectNativeVoice(requestedLocale = spokenLocale()) {
    const voices = window.speechSynthesis.getVoices();
    const code = requestedLocale.toLowerCase();
    const exact = voices.filter(v => v.lang.replace("_", "-").toLowerCase() === code);
    const compatible = voices.filter(v => v.lang.toLowerCase().split("-")[0] === code.split("-")[0]);
    const matching = exact.length ? exact : compatible;
    // Android lists network voices alongside installed voices. Prefer an
    // installed voice so a stalled network engine cannot silence the lesson.
    const installed = matching.filter(v => v.localService);
    const candidates = installed.length ? installed : matching;
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
      timer = setTimeout(finish, window.__miokoNativeInstalled ? 5000 : 1000);
    });
  }

  function speechChunks(text) {
    // Short utterances keep mobile speech engines from holding one long response.
    const chunks = [];
    let remaining = text.trim();
    while (remaining.length > 120) {
      const portion = remaining.slice(0, 120);
      let cut = Math.max(portion.lastIndexOf(". "), portion.lastIndexOf("? "), portion.lastIndexOf("! "), portion.lastIndexOf("。"), portion.lastIndexOf("？"), portion.lastIndexOf("！"));
      cut = cut >= 40 ? cut + 1 : Math.max(60, portion.lastIndexOf(" "));
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  // Speech plan: keep Japanese script on a Japanese voice inside Portuguese explanations.
  function speechSegments(text, defaultLocale) {
    const pattern = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー][\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー\s。、！？「」『』（）・…0-9０-９]*|\p{Script=Hangul}[\p{Script=Hangul}\s.,!?…0-9]*/gu;
    const parts = []; let position = 0;
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(position, match.index).trim();
      if (before) parts.push({text: before, locale: defaultLocale});
      parts.push({text: match[0].trim(), locale: /\p{Script=Hangul}/u.test(match[0]) ? "ko-KR" : "ja-JP"});
      position = match.index + match[0].length;
    }
    const after = text.slice(position).trim();
    if (after) parts.push({text: after, locale: defaultLocale});
    return parts;
  }
  // End speech plan.

  async function nativeSay(text, generation, segments = null) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      throw Error("O navegador não oferece voz alternativa");
    }
    await waitForNativeVoices();
    const synth = window.speechSynthesis;
    const validLocales = new Set(Object.values(locales));
    const parts = segments
      ? segments.map(part => {
          if (!validLocales.has(part.locale) || typeof part.text !== "string") throw Error("Idioma da fala não reconhecido.");
          return {text: cleanSpeech(part.text), locale: part.locale};
        }).filter(part => part.text).flatMap(part => speechSegments(part.text,
          spokenLocale() === "pt-BR" && ["ja-JP", "ko-KR"].includes(part.locale) ? "pt-BR" : part.locale))
      : speechSegments(text, spokenLocale());
    const chunks = parts.flatMap(part => speechChunks(part.text).map(text => ({text, locale: part.locale})));
    const selectedVoices = new Map();
    for (const part of parts) {
      const selected = selectNativeVoice(part.locale);
      if (!selected) throw Error("Este aparelho não tem voz de " + part.locale + ". Instale a voz desse idioma nas configurações de fala do aparelho para ouvir a pronúncia correta.");
      selectedVoices.set(part.locale, selected);
    }
    try {
      for (const part of chunks) {
        const chunk = part.text;
        const selected = selectedVoices.get(part.locale);
        if (generation !== voiceGeneration || !voice) return;
        await new Promise((resolve, reject) => {
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = selected.lang;
          u.rate = part.locale !== "pt-BR" && spokenLocale() === "pt-BR" ? 0.85 : 1.05;
          u.pitch = 1;
          if (selected) u.voice = selected;
          nativeUtterance = u;
          let done = false, started = 0, deadline;
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
            finish(Error("O aparelho não iniciou a voz. Toque em Testar voz para tentar novamente."));
            synth.cancel();
          }, 8000);
          u.onboundary = e => {
            if (done || generation !== voiceGeneration) return;
            // The final word boundary occurs before its audio finishes.
            // Close only on end, pause or cancel.
          };
          u.onstart = () => {
            if (generation !== voiceGeneration || nativeUtterance !== u) return;
            started = performance.now();
            callStatus("Mioko está falando…");
            closeMouth();
            $("#miokoVideo").classList.add("speaking");
            window.MiokoAvatar?.setMouth(0.45, true);
            clearTimeout(deadline);
            deadline = setTimeout(() => {
              finish(Error("A voz do aparelho parou de responder. Toque em Testar voz para tentar novamente."));
              synth.cancel();
            }, Math.max(15000, chunk.length * 180));
            function tick(now) {
              if (done || nativeUtterance !== u || generation !== voiceGeneration) return;
              if (!synth.speaking && now - started > 500) {
                closeMouth();
                // Some engines omit onend. Stop the animation and release the turn.
                if (now - started > 500) { finish(); return; }
              } else if (synth.paused) {
                window.MiokoAvatar?.closeMouth();
                $("#miokoVideo")?.classList.remove("speaking");
              } else {
                $("#miokoVideo").classList.add("speaking");
                const phase = (now - started) / 1000 + 0.04;
                // Android often omits boundary events. This is an estimated articulation
                // while synthesis is active; onend/cancel still close the mouth immediately.
                const syllable = Math.abs(Math.sin(phase * 12.5));
                const opening = 0.12 + syllable * 0.78;
                window.MiokoAvatar?.setMouth(opening);
              }
              audioFrame = requestAnimationFrame(tick);
            }
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
        callStatus("Fala concluída.");
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
        headers: await headers(),
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

  async function say(value, segments = null) {
    if (!voice) return;
    const text = cleanSpeech(value);
    if (!text) return;
    stopListening();
    stopSpeech();
    const generation = voiceGeneration;
    speechPending = true;
    callStatus("Preparando a voz…");

    try {
      await nativeSay(text, generation, segments);
    } catch (e) {
      if (generation !== voiceGeneration) return;
      speechPending = false;
      closeMouth();
      voiceInputBlocked = true;
      const notice = "Não consegui iniciar a voz: " + e.message + ". Confira o volume de mídia e a voz instalada no Android.";
      turnStatus.textContent = notice;
      add("ai", notice + " A conversa por texto continua disponível.");
    }
  }

  const testVoiceButton = document.createElement("button");
  testVoiceButton.type = "button";
  testVoiceButton.className = "nb";
  testVoiceButton.id = "testMiokoVoice";
  testVoiceButton.textContent = "🔊 Testar voz";
  testVoiceButton.onclick = () => {
    enableVoice();
    voiceInputBlocked = false;
    const text = greetingForLesson();
    say(text, [{text, locale: spokenLocale()}]);
  };
  $("#voice").insertAdjacentElement("afterend", testVoiceButton);

  $("#enter").onclick = async () => {
    if (!await window.MiokoAuth?.signIn()) return;
    loadUserHistory();
    lessonLevel = readCourseLevel();
    updateLessonMode();
    $("#login").classList.add("hide");
    $("#app").classList.remove("hide");
    prepareAudio();
  };

  $("#exitCourse").onclick = () => {
    stopMedia();
    window.MiokoAuth?.signOut();
    history = []; historyKey = "";
    $("#chat").replaceChildren();
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
  }

  const levelBox = document.createElement("label");
  levelBox.style.cssText = "display:block;margin:10px 0;font-size:14px";
  levelBox.append(document.createTextNode("Seu nível: "));
  const levelSelect = document.createElement("select");
  levelSelect.setAttribute("aria-label", "Seu nível no idioma");
  levelSelect.style.cssText = "padding:9px;border-radius:8px;background:#111b2b;color:#fff;border:1px solid #6684a6;max-width:100%";
  for (const [value, label] of [["beginner", "Iniciante — apoio em português"], ["intermediate", "Intermediário — prática com apoio"], ["advanced", "Avançado — conversar no idioma"]]) {
    const option = document.createElement("option");
    option.value = value; option.textContent = label; levelSelect.append(option);
  }
  levelBox.append(levelSelect);
  $("#status").insertAdjacentElement("afterend", levelBox);
  const updateLessonMode = () => {
    levelSelect.value = lessonLevel;
    const labels = {beginner:"iniciante", intermediate:"intermediário", advanced:"avançado"};
    $("#status").textContent = lang + " • " + labels[lessonLevel] + (beginnerLesson() ? " • apoio em português" : " • conversação em " + lang.toLowerCase());
    $("#level").textContent = labels[lessonLevel];
  };
  levelSelect.onchange = () => {
    stopListening(); stopSpeech();
    replyController?.abort(); conversationGeneration++; replyPending = false;
    lessonLevel = levelSelect.value;
    try {
      const saved = JSON.parse(localStorage.getItem(levelStorageKey()) || "{}");
      saved[lang] = lessonLevel; localStorage.setItem(levelStorageKey(), JSON.stringify(saved));
    } catch {}
    recognitionFailures = 0; voiceInputBlocked = false;
    updateLessonMode(); resumeListening();
  };

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
      lessonLevel = readCourseLevel();
      replyController?.abort(); conversationGeneration++; replyPending = false;
      recognitionFailures = 0;
      voiceInputBlocked = false;
      useRecorder = preferRecorder;
      localStorage.ilLang = lang;
      updateLessonMode();
      resumeListening();
    };
  });
  updateLessonMode();

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

  $("#begin").onclick = async () => {
    enableVoice();
    voiceInputBlocked = false;
    micPaused = false;
    recognitionFailures = 0;
    if (!callMode) {
      callMode = "voice";
      $("#miokoVideo").classList.add("calling");
      $("#voiceCall").textContent = "⏹ Encerrar chamada";
    }
    const session = conversationGeneration;
    try {
      const permission = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      permission.getTracks().forEach(track => track.stop());
    } catch (e) {
      if (session !== conversationGeneration) return;
      voiceInputBlocked = true;
      add("ai", "Permita o microfone para conversar por voz. Toque no botão do microfone para tentar novamente.");
    }
    if (session !== conversationGeneration) return;
    const text = greetingForLesson();
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
    if (Date.now() < aiCooldownUntil) { callStatus("Serviço temporariamente ocupado. Aguarde " + Math.ceil((aiCooldownUntil-Date.now())/1000) + " segundos."); return; }
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
    if (Date.now() < aiCooldownUntil) return;
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
    callStatus("Preparando sua resposta…");
    const controller = new AbortController();
    replyController = controller;
    const requestLanguage = lang;
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: await headers(),
        signal: controller.signal,
        body: JSON.stringify({
          message,
          teaching_mode: beginnerLesson() ? "foreign_beginner_pt" : lessonLevel === "intermediate" ? "foreign_intermediate" : "conversation",
          learner_level: lessonLevel,
          voice_conversation: !!callMode,
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
        const error = Error("HTTP " + r.status + ": " + (data.error || data.message || "Falha"));
        error.retryAfter = Number(data.retry_after) || 60;
        throw error;
      }
      const answer =
        data.answer || data.reply || data.output_text ||
        data.target || data.japanese;
      if (!answer) throw Error("A função respondeu sem texto");
      waiting.remove();
      add("ai", String(answer), true);
      if (generation === voiceGeneration && requestLanguage === lang) say(String(answer), data.speech_segments || null);
    } catch (e) {
      waiting.remove();
      if (conversation !== conversationGeneration) return;
      const limited = /429|rate.?limit|too many requests/i.test(e.message);
      const quota = /insufficient_quota|exceeded your current quota/i.test(e.message);
      const notice = e.name === "AbortError"
        ? "A resposta demorou demais. Toque em Microfone para tentar novamente."
        : quota ? "O serviço de IA está sem cota. O administrador precisa verificar a conta."
        : limited ? "Serviço temporariamente ocupado. Aguarde " + Math.ceil(e.retryAfter || 60) + " segundos para falar novamente."
        : "Não consegui responder. Toque em Microfone para tentar novamente.";
      if (limited && !quota) showCooldown(e.retryAfter || 60);
      else voiceInputBlocked = true;
      if (!limited || quota) callStatus(notice);
      add("ai", notice + (!limited && !quota ? " Detalhe: " + e.message : ""));
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


  // A pause ends a turn; a short pause inside a sentence does not.
  function createTurnDetector() {
    const levels = [];
    let heard = false, quietSince = null, voicedFrames = 0;
    return (rms, now) => {
      levels.push(rms);
      if (levels.length > 40) levels.shift();
      const ordered = [...levels].sort((a, b) => a - b);
      const floor = Math.min(0.012, ordered[Math.floor((ordered.length - 1) * 0.2)]);
      const threshold = Math.max(0.008, floor * 1.8);
      if (rms > threshold) {
        voicedFrames++;
        if (voicedFrames >= 2) heard = true;
        quietSince = null;
      } else {
        voicedFrames = 0;
        if (heard && quietSince === null) quietSince = now;
      }
      return {heard, finished: heard && quietSince !== null && now - quietSince >= 650};
    };
  }

  async function startRecordedListening() {
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      voiceInputBlocked = true;
      add("ai", "Este navegador não permite gravar o microfone. Use Chrome ou Edge.");
      return;
    }
    const token = ++recordingGeneration;
    listening = true;
    callStatus("Abrindo o microfone…");
    let mic, rec, node, meter, timer, submitted = false;
    const cleanup = () => {
      clearInterval(timer);
      recorderSubmit = null;
      finishTurnButton.hidden = true;
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
      let heard=false, began=performance.now();
      const detectTurn = createTurnDetector();
      const finish = () => { if(submitted) return; submitted=true; clearInterval(timer); rec.stop(); };
      recorderSubmit = () => { heard = true; finish(); };
      rec.onstop = async () => {
        cleanup();
        if(token !== recordingGeneration) return;
        recorderStop=null;
        if (!heard) { listening=false; resumeListening(500); return; }
        $("#mic").textContent="🎙️ Entendendo sua fala...";
        callStatus("Entendendo sua fala…");
        try {
          const form = new FormData();
          const type=rec.mimeType || "audio/webm";
          form.append("file",new Blob(chunks,{type}),type.includes("mp4")?"fala.mp4":type.includes("ogg")?"fala.ogg":"fala.webm");
          // Omit the language hint: students may switch languages in the same course.
          const h=await headers(); delete h["Content-Type"];
          const response=await fetch(config().VOICE_ENDPOINT,{method:"POST",headers:h,body:form,signal:AbortSignal.timeout(30000)});
          const data=await response.json();
          if(token !== recordingGeneration) return;
          if(!response.ok) throw Error(data.error || "Falha ao entender a fala");
          listening=false;
          if(data.text?.trim()) send(data.text); else { $("#mic").textContent="🎙️ Não entendi. Fale novamente e faça uma pausa."; resumeListening(1000); }
        } catch(e) {
          if(token !== recordingGeneration) return;
          listening=false; voiceInputBlocked=true;
          callStatus("Não consegui entender a fala. Toque em Microfone para tentar novamente.");
          add("ai","Microfone: " + e.message + ". Toque no microfone para tentar novamente.");
        }
      };
      rec.start();
      finishTurnButton.hidden = false;
      callStatus("Ouvindo você — faça uma pausa quando terminar.");
      $("#mic").textContent="🎙️ Ouvindo sua voz em " + (inputLocale() === "pt-BR" ? "português" : lang.toLowerCase()) + "... fale e faça uma pausa";
      timer=setInterval(() => {
        if(token !== recordingGeneration) { cleanup(); return; }
        meter.getFloatTimeDomainData(samples);
        const rms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);
        const now=performance.now();
        const turn = detectTurn(rms, now);
        heard = turn.heard;
        if (turn.finished) finish();
        if(now-began>20000) finish();
      },100);
    } catch(e) {
      cleanup();
      if(token !== recordingGeneration) return;
      listening=false; recorderStop=null; voiceInputBlocked=true;
      callStatus("Não consegui abrir o microfone. Toque em Microfone para tentar novamente.");
      add("ai","Não consegui abrir o microfone: " + e.message);
    }
  }

  function startListening() {
    if (
      !window.MiokoAuth?.hasAccess() || !callMode || recognition || listening ||
      currentAudio || nativeUtterance || speechPending ||
      replyPending || voiceInputBlocked || micPaused || Date.now() < aiCooldownUntil
    ) return;

    if (!SR || useRecorder || (lang !== "Português" && window.MediaRecorder)) { startRecordedListening(); return; }
    const r = new SR();
    recognition = r;
    r.lang = inputLocale();
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      if (recognition !== r) return;
      listening = true;
      callStatus("Ouvindo você…");
      finishTurnButton.hidden = false;
      $("#mic").textContent = "🎙️ Ouvindo sua voz em " + (inputLocale() === "pt-BR" ? "português" : lang.toLowerCase()) + "...";
    };
    r.onspeechend = () => {
      if (recognition === r) { try { r.stop(); } catch {} }
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
      callStatus("Microfone pausado — toque nele para falar.");
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




