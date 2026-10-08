# Teste real Supabase — 08/10/2026

Projeto exclusivo: lxjbpklzrhylmlyepdkc (IL Talk Cursos de Idiomas).

Cópia das funções anteriores preservada na branch backup/supabase-live-before-transcription-20261008.

il-transcribe foi implantada, versão 1, ACTIVE, verify_jwt=true, CORS restrito ao domínio do site.

Teste real: arquivo WAV sintético em inglês, enviado por multipart com a chave pública do site. A função foi alcançada e chamou o provedor. Resultado HTTP 429, code credit_balance_exhausted, origin openai: saldo de créditos esgotado. Nenhuma retentativa automática para contornar a cota.

Testes simulados aprovados: cinco trechos consecutivos, uma transcrição por trecho, silêncio sem requisições, liberação do microfone ao cancelar, WAV válido; sete idiomas e preservação do erro externo. Não substituem testes físicos.

Vídeo do usuário 20261008-0431-13.0123642.mp4 confirma câmera local funcionando e Firefox sem SpeechRecognition. A correção WebAudio para Firefox está preparada nesta branch, mas não foi publicada no site: a transcrição real depende de créditos no provedor.

Próximo requisito externo: regularizar faturamento/créditos da conta OpenAI proprietária da OPENAI_API_KEY configurada no projeto. ChatGPT Plus não confirma saldo desta chave de API. Após regularização, repetir testes de transcrição, resposta e voz antes da publicação. Não alterar outros projetos.
