# Verificação — IL Talk Mioko — 08/10/2026

Escopo exclusivo: ILBate-papo/IL-Talk-Mioko e projeto lxjbpklzrhylmlyepdkc.
Backup anterior às mudanças: branch backup/pre-continuous-anime-20261008, commit 40f3fef82bc8cf4bbbdefb3b81711d1b0f38429c. Nenhuma restauração realizada.

## Implementado no frontend
- Anime derivada da imagem aprovada, cabeça ereta e braços abaixados. A referência original e a versão gerada permanecem preservadas. Identificação Professor Ildebrando Leandro em HTML.
- Boca e pálpebras desenhadas sobre a anime, sem deformação da fotografia ou das bochechas. Áudio remoto controla abertura por RMS. Voz do navegador usa animação aproximada durante os eventos de fala: não há acesso ao áudio dessa voz para sincronizar fonemas ou pausas internas com precisão.
- Reconhecimento e voz alternativa seguem os sete idiomas. Saudação localizada, botão Português e solicitação explícita do idioma à IA.
- Voz principal remota, com fallback ao navegador. Falhas externas são mostradas; intervalo de 60 segundos evita repetir chamadas ao serviço de voz que acaba de falhar. Esse intervalo não impede perguntas, texto ou voz alternativa.
- Escuta interrompida durante resposta e reiniciada após fala, incluindo falha de reprodução. Histórico limitado aos dez turnos anteriores, até 2000 caracteres por turno. Requisições serializadas; encerrar aborta resposta e descarta itens pendentes da sessão.
- Reinicialização de reconhecimento com recuo após falhas; câmera mostra prévia local, não é enviada à IA.
- Não foi encontrado cronômetro de aula nem bloqueio de três horas implementado no aplicativo. Timeouts de rede são proteção contra chamadas travadas, não duração máxima da conversa.

## Executado
- node --check app.js e mioko-avatar.js; git diff --check: passaram.
- node tests/conversation.cjs: cinco perguntas consecutivas em cada um dos sete idiomas; contexto, retorno à escuta, reconhecimento suspenso durante fala e início/encerramento da câmera passaram COM SIMULAÇÃO das APIs. Não validam hardware, serviço de reconhecimento ou pronúncia real.
- node tests/edge.cjs: preservação de HTTP 429, código insufficient_quota e Retry-After passou COM PROVEDOR SIMULADO.
- Requisição REAL à il-ai: HTTP 200, pergunta Quanto é 37 vezes 19?, resposta 703, contrato publicado mioko-v52.
- Teste REAL no site anterior pelo Chrome: mesma pergunta exibiu limite temporário de 3h11m22.56s. Não repetimos automaticamente para contornar o limite. Há limitação externa de IA, mas conta, orçamento e limite específico de tokens/requisições não puderam ser inspecionados sem acesso ao painel/provedor.
- Requisição REAL à il-voice: HTTP 429, mensagem OpenAI informando ausência de créditos. Solução legítima: verificar orçamento/créditos do projeto correto no provedor; nenhum faturamento alterado.

## Pendências e limites
- As duas Edge Functions do repositório foram ajustadas para idioma e propagação de erros. Alterar o repositório não as implanta no Supabase. Sem login administrativo validado, essas alterações de servidor NÃO foram implantadas.
- Reconhecimento de voz real, cinco turnos por microfone físico, câmera física no computador/celular, voz natural e pronúncia nos sete idiomas NÃO aprovados: não executados.
- O navegador deve disponibilizar SpeechRecognition e uma voz no idioma desejado. Sem reconhecimento disponível, a interface informa a limitação e mantém texto; não há transcrição alternativa implantada para navegadores incompatíveis.
- Boca no silêncio total e fim da fala é encerrada por eventos; sincronização fonética e pausas internas da voz nativa não estão garantidas.
- Para liberar o resultado integral: autenticar o Supabase, implantar as funções somente no projeto autorizado, regularizar créditos/limites externos e concluir testes reais em computador e celular.
