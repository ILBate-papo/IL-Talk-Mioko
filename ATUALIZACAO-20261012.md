# Mioko — pesquisa, preparação jurídica e relógio

O site oferece seleção de preparação OA/OAB e pesquisa atual com links de fontes. O servidor mantém a resposta no idioma do curso no nível avançado, salvo pedido de tradução/ajuda. A voz existente foi preservada.

## Preparação jurídica

- Portugal: prova escrita antes do estágio, estágio e prova oral final. Essa sequência foi informada pelo utilizador; o aviso da OA precisa confirmar elegibilidade, programa e calendário. A duração do estágio permanece desconhecida.
- Brasil: OAB primeira fase e segunda fase; na segunda, perguntar a área escolhida. Questões geradas são simuladas; gabaritos e notas oficiais exigem o material original.
- Instruções específicas para diagnóstico, plano, revisão e feedback. Não é curso oficial da OA/OAB nem garantia de aprovação.

## Pesquisa atual

A pesquisa usa browser_search na conta Groq já configurada, seguida da geração da resposta nos segmentos de idioma existentes. Só apresenta links recuperados na evidência de ferramentas executadas. Se houver erro, restrição do serviço ou falta de fontes, informa que não verificou dados atuais. As cotas e recursos da conta continuam aplicáveis; nenhum plano foi contratado ou modificado. A validação feita aqui usou respostas simuladas do fornecedor, não uma sessão paga de aluno.

## Relógio

O código Android 1.0.4 abre ACTION_SET_ALARM com hora/minuto e tela do Relógio visível. O aluno deve conferir e confirmar o alarme no Relógio; a Mioko não afirma que agendou apenas por abrir a tela. O Relógio administra o toque com tela apagada. No navegador e APK antigo há orientação manual e lembrete em primeiro plano.

## Verificação e pendências

- Testes: pesquisa com evidência, erro/ausência de fonte, modos de provas, proteção de origem, resposta no idioma avançado, ponte do Relógio, idiomas/vozes, microfone e níveis por conta.
- A classe Android foi compilada contra as APIs Android 36 e AndroidX WebKit 1.14.0; teste no aparelho continua necessário.
- Gradle/lint completo não concluído neste ambiente por falha na resolução do plugin Android. A compilação isolada não equivale a um APK validado.
- O APK instalado 1.0.3 usa certificado SHA-256 470c6bcd4a56d8f43344de66c77a9da2c5400443a8b6da87852bd53f1403e510. A chave privada original não foi localizada. Sem ela não há atualização assinada compatível; o download permanece em 1.0.3.
- Canto natural com melodia não implementado. A síntese de fala existente não é um motor de canto; não foram substituídas as vozes por uma imitação de baixa qualidade nem adicionados serviços pagos.

Fontes oficiais para pesquisa e preparação: https://portal.oa.pt/ ; https://examedeordem.oab.org.br/ ; https://oab.fgv.br/ ; https://diariodarepublica.pt/ .
