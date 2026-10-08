// Somente lxjbpklzrhylmlyepdkc. il-ai permanece intacta.
const cors = {
  'Access-Control-Allow-Origin': 'https://ilbate-papo.github.io',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store', Vary: 'Origin',
};
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
  const id = crypto.randomUUID();
  let key = '';
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: {...cors, 'Content-Type': 'application/json; charset=utf-8'},
  });
  const fail = (message: string, status: number, stage: string) => {
    const safe = (key ? String(message).split(key).join('[credencial omitida]') : String(message))
      .replace(/sk-[A-Za-z0-9_*.-]+/g, '[credencial omitida]').slice(0, 1500);
    console.error(JSON.stringify({request_id: id, status, stage}));
    return json({error: safe, stage, request_id: id}, status);
  };
  if (req.method !== 'POST') return fail('Use POST', 405, 'request');
  const origin = req.headers.get('origin');
  if (origin && origin !== cors['Access-Control-Allow-Origin']) return fail('Origem não autorizada', 403, 'request');
  try {
    key = Deno.env.get('OPENAI_API_KEY') || '';
    if (!key) return fail('OPENAI_API_KEY não configurada', 503, 'configuration');
    const auth = {Authorization: 'Bearer ' + key};
    let response: Response;
    let speech = false;
    if (req.headers.get('content-type')?.startsWith('multipart/form-data')) {
      // Trechos de microfone explicitamente ativado. Nunca recebe vídeo.
      if (Number(req.headers.get('content-length')) > 6_000_000) return fail('Áudio excede 6 MB', 413, 'request');
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File) || !file.size || file.size > 6_000_000)
        return fail('Envie um áudio de até 6 MB', 400, 'request');
      if (!/^audio\/(webm|mp4|mpeg|wav|x-wav|ogg)(;|$)/.test(file.type))
        return fail('Formato de áudio não suportado', 400, 'request');
      const upstream = new FormData();
      upstream.append('file', file, file.name);
      upstream.append('model', 'gpt-transcribe');
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: auth, body: upstream, signal: AbortSignal.timeout(45_000),
      });
    } else {
      const raw = await req.text();
      if (raw.length > 20_000) return fail('Solicitação muito grande', 413, 'request');
      let body;
      try { body = JSON.parse(raw); } catch { return fail('JSON inválido', 400, 'request'); }
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 1800) return fail('text deve conter de 1 a 1800 caracteres', 400, 'request');
      const speed = Number(body.speed);
      speech = true;
      response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST', headers: {...auth, 'Content-Type': 'application/json'},
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({model: 'gpt-4o-mini-tts', voice: 'coral', input: text,
          response_format: 'mp3', speed: [0.8, 1, 1.15].includes(speed) ? speed : 1,
          instructions: 'Use a warm, feminine teaching voice. Pronounce each language naturally, including Japanese and Brazilian Portuguese. Read only the supplied text; do not add introductions or commentary.'}),
      });
    }
    if (!response.ok) {
      const raw = await response.text();
      let message = raw;
      try { message = JSON.parse(raw)?.error?.message || raw; } catch { /* preserve upstream status */ }
      return fail('OpenAI HTTP ' + response.status + ': ' + message, response.status === 429 ? 429 : 502, 'openai');
    }
    if (speech) return new Response(response.body, {headers: {...cors, 'Content-Type': 'audio/mpeg', 'x-request-id': id}});
    const data = await response.json();
    if (typeof data.text !== 'string') return fail('Transcrição sem texto', 502, 'openai');
    return json({text: data.text.trim(), request_id: id});
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502, 'voice');
  }
}
Deno.serve(handler);
