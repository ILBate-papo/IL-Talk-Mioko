// IL TALK MIOKO — voz alternativa quando o serviço falhar.
{
  const script = document.createElement("script");
  script.src = "mioko-avatar.js";
  document.head.appendChild(script);
}

(() => {
  const $ = s => document.querySelector(s);

  let lang = localStorage.ilLang || "Japonês";
  let voice = localStorage.ilVoice !== "off";
  let h;
  try {
    h = JSON.parse(localStorage.ilHistory || "[]");
    if (!Array.isArray(h)) h = [];
  } catch {
    h = [];
  }

  let stream = null;
  let currentAudio = null;
  let callMode = null;
  let recognition = null;
  let listening = false;
  let audioContext = null;
  let analyser = null;
  let audioFrame = 0;
  let voiceRequest = null;
  let voiceGeneration = 0;
  let audioUrl = null;
  let speechPending = false;
  let audioCleanup = null;
  let replyPending = false;
  let voiceInputBlocked = false;
  let nativeUtterance = null;
  let voiceRetryAfter = 0;

  $("#voice").textContent =
    voice ? "🔊 Voz ligada" : "🔇 Voz desligada";

  $("#enter").onclick = () => {
    $("#login").classList.add("hide");
    $("#app").classList.remove("hide");
  };

  function stopListening() {
    listening = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
  }

  function closeMouth() {
    cancelAnimationFrame(audioFrame);
    audioFrame = 0;
    window.MiokoAvatar?.closeMouth();
    $("#miokoVideo")?.classList.remove("speaking");
  }

  function stopSpeech() {
    voiceGeneration++;
    if (nativeUtterance) {
      nativeUtterance = null;
      window.speechSynthesis?.cancel();
    }
    voiceRequest?.abort();
    voiceRequest = null;
    speechPending = false;
    closeMouth();
    audioCleanup?.();
    audioCleanup = null;

    if (currentAudio) {
      const a = currentAudio;
      currentAudio = null;
      a.pause();
      a.removeAttribute("src");
      a.load();
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
  }

  function stopMedia() {
    callMode = null;
    stopSpeech();
    stopListening();

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }

    const v = $("#userVideo");
    if (v) {
      v.srcObject = null;
      v.hidden = true;
    }

    $("#userPlaceholder")?.removeAttribute("hidden");
    if ($("#cameraStatus")) {
      $("#cameraStatus").textContent = "Câmera opcional";
    }

    $("#videoRoom")?.classList.remove("in-call");
    $("#miokoVideo")?.classList.remove("calling", "speaking");
    $("#videoCall").textContent = "📹 Vídeo IA";
    $("#voiceCall").textContent = "📞 Chamada IA";
  }

  $("#exitCourse").onclick = () => {
    stopMedia();
    $("#app").classList.add("hide");
    $("#login").classList.remove("hide");
    $("#pass").value = "";
    scrollTo(0, 0);
  };

  document.querySelectorAll("[data-mode]").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("[data-mode]").forEach(x => {
        x.classList.remove("active");
      });
      b.classList.add("active");
    };
  });

  document.querySelectorAll("[data-lang]").forEach(b => {
    if (b.dataset.lang === lang) b.classList.add("sel");

    b.onclick = () => {
      document.querySelectorAll("[data-lang]").forEach(x => {
        x.classList.remove("sel");
      });
      b.classList.add("sel");
      lang = b.dataset.lang;
      localStorage.ilLang = lang;
      $("#status").textContent = lang + " • avaliação adaptativa";
    };
  });

  function add(c, t, save = false) {
    const d = document.createElement("div");
    d.className = "msg " + c;
    d.innerHTML =
      "<b>" + (c === "user" ? "Você" : "Mioko IA") + "</b><p></p>";
    d.querySelector("p").textContent = t;
    $("#chat").appendChild(d);
    $("#chat").scrollTop = $("#chat").scrollHeight;

    if (save) {
      h.push({
        role: c === "ai" ? "assistant" : "user",
        content: t
      });
      h = h.slice(-30);
      localStorage.ilHistory = JSON.stringify(h);
    }
  }

  function cleanSpeech(t) {
    return String(t)
      .replace(/[*#_`~]+/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function headers() {
    const c = window.IL_TALK_CONFIG || {};
    const x = { "Content-Type": "application/json" };

    if (c.SUPABASE_PUBLISHABLE_KEY) {
      x.apikey = c.SUPABASE_PUBLISHABLE_KEY;
      return x;
    }

    if (c.SUPABASE_ANON_KEY) {
      x.apikey =
