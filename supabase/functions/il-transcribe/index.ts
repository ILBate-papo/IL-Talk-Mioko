const cors = {
  'Access-Control-Allow-Origin': 'https://ilbate-papo.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
};
const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...cors, ...headers } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  const origin = req.headers.get('origin');
  if (origin && origin !== cors['Access-Control-Allow-Origin']) return json({error: 'Origem não autorizada'}, 403);
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return json({ error: 'Áudio ausente' }, 400);
    // This is the provider's file upload bound, not a call/lesson timer.
    if (file.size > 25 * 1024 * 1024) return json({ error: 'Este trecho de áudio excedeu o limite de arquivo do serviço de transcrição', origin: 'upload' }, 413);
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return json({ error: 'Serviço de transcrição não configurado', origin: 'configuration' }, 503);
    const languages: Record<string, string> = { Português: 'pt', Japonês: 'ja', Inglês: 'en', Espanhol: 'es', Francês: 'fr', Coreano: 'ko', Italiano: 'it' };
    const language = languages[String(form.get('language'))];
    if (!language) return json({ error: 'Idioma não suportado' }, 400);
    const input = new FormData();
    input.set('file', file, 'fala.wav');
    input.set('model', Deno.env.get('OPENAI_STT_MODEL') || 'whisper-1');
    input.set('language', language);
    input.set('response_format', 'json');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: input, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) {
        const retry = response.headers.get('retry-after');
        return json({ error: data?.error?.message || `OpenAI HTTP ${response.status}`, code: data?.error?.code || null, origin: 'openai', provider_status: response.status }, response.status, retry ? { 'Retry-After': retry } : {});
      }
      return json({ text: String(data.text || '').trim(), language, contract: 'mioko-transcription-20261008' });
    } finally { clearTimeout(timeout); }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
