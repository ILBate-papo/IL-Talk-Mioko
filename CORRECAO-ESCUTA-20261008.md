# Correção da escuta — IL Talk Mioko

## Estado
Implementação preparada e testada em simulação, ainda não publicada no site. Depende da implantação de il-transcribe no projeto lxjbpklzrhylmlyepdkc e da validação real de áudio/IA. Não declarar concluída.

Backup da versão anterior: backup/pre-transcription-20261008.

## Diagnóstico confirmado
O vídeo 20261008-0330-40.0827943.mp4 mostra Firefox, mensagem de ausência de reconhecimento de voz, câmera física funcionando como prévia local, e pergunta escrita recusada com espera de 5h0m40.32s. A voz não chega à IA pelo reconhecimento nativo nesse navegador.

Na sessão anterior, il-voice retornou 429 por ausência de créditos. A conversa escrita no site também recebeu limitação do provedor. O limite específico de requisições/tokens, orçamento e origem da cota precisam ser examinados na conta autenticada; não foi possível acessar esse painel. Não atribuir o limite à frequência de aulas do usuário.

Nesta sessão, uma consulta real à nova rota il-transcribe retornou HTTP 404, NOT_FOUND. A função ainda não está implantada.

## Implementação
- app.js usa reconhecimento nativo quando disponível, ou captura e transcrição quando não disponível. Falha persistente do serviço de reconhecimento nativo também permite a alternativa de captura.
- mioko-listener.mjs captura áudio PCM por Web Audio, detecta voz, mantém cerca de 400 ms de prévia, fecha o trecho após cerca de 900 ms de silêncio e produz WAV mono. Esse silêncio separa perguntas; não limita a duração da chamada.
- Silêncio e ruídos breves não fazem solicitações à IA. A captura é desligada durante transcrição e resposta; após a fala da Mioko, retorna automaticamente à escuta.
- Cancelar a chamada aborta a transcrição, libera os microfones e descarta respostas tardias. Permissões negadas continuam sendo respeitadas.
- supabase/functions/il-transcribe/index.ts recebe WAV, define o idioma de transcrição, usa a chave somente no servidor e preserva erros reais, HTTP 429 e Retry-After. Modelo padrão whisper-1, configurável por OPENAI_STT_MODEL.
- O limite de arquivo de áudio de 25 MiB protege a entrada da transcrição; não encerra a chamada por tempo. Limites reais do provedor não foram contornados.
- A mensagem de espera da IA passa a identificar que o prazo vem do provedor, não de um cronômetro de aula. A resposta não é substituída por conteúdo pronto.

## Testes executados
- node --check app.js e mioko-listener.mjs; git diff --check: passaram.
- node tests/listener.mjs: cinco trechos de fala, nenhuma requisição durante silêncio prolongado, uma entrega por trecho, descarte de clique breve, cabeçalho WAV, limitação de amplitude e liberação de microfone aberto após cancelamento: passaram com áudio e hardware simulados.
- node tests/transcribe.mjs: execução do TypeScript real, multipart, validação de métodos, sete idiomas e preservação de 429/código/Retry-After: passaram com respostas do provedor simuladas.
- node tests/conversation.cjs: cinco perguntas nos sete idiomas, contexto e retorno à escuta: passaram com reconhecimento, voz, IA e câmera simulados.
- node tests/edge.cjs: preservação de erros das funções IA/voz: passou com provedor simulado.
- Consulta real a il-transcribe: FALHOU, HTTP 404, função não encontrada.
- Login seguro para implantação: não concluído. Nenhuma função, faturamento ou configuração de outro projeto alterado.

## Próximo passo necessário
Concluir acesso autenticado ao Supabase autorizado, implantar il-transcribe, conferir a política de invocação compatível com a configuração deste projeto e regularizar os limites externos da IA/voz. Só então testar microfone real, transcrição, cinco turnos completos, pronúncia nos sete idiomas e interrupção/retorno à escuta no computador e celular, antes de publicar o frontend.

A câmera permanece uma prévia local: esta correção não implementa visão pela IA. Não alegar que Mioko enxerga o usuário.
