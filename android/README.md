# IL Talk Mioko — Android

Aplicativo Android nativo que abre exclusivamente o IL Talk Mioko em uma WebView e integra a voz do Android. Conversas precisam de internet, conta confirmada e acesso autorizado pelo servidor (administrador ou assinatura paga vigente).

- Pacote: `com.iltalk.mioko`
- Android mínimo: 8.0 (API 26)
- Versão preparada: 1.0.4 (código 5); download atual continua 1.0.3 até gerar o APK com a assinatura original.
- A voz usa os idiomas disponíveis no mecanismo de texto para fala do aparelho. Câmera e microfone pedem permissão quando utilizados.
- A câmera mostra a prévia do usuário; o serviço atual não recebe imagens do vídeo.
- O APK é o instalador para download direto. O AAB é o pacote para envio à Google Play.

## Compilar

Use JDK 17, Gradle 8.13, SDK Android 36 e Android Build Tools 35.0.0. Configure `sdk.dir` no arquivo local e ignorado `local.properties`.

Defina `MIOKO_SIGNING_STORE` com o caminho da chave privada e `MIOKO_SIGNING_PASSWORD` no ambiente seguro. A chave e a senha nunca devem entrar no repositório público. O alias é `mioko-release`.

Execute `gradle :app:assembleRelease :app:bundleRelease :app:lintRelease`.

Saídas: `app/build/outputs/apk/release/app-release.apk` e `app/build/outputs/bundle/release/app-release.aab`.

Guarde a assinatura original para atualizações futuras. Incremente `versionCode` e `versionName` ao publicar uma atualização.

## Validação no aparelho

A versão 1.0.1 deixa de encerrar a conversa quando o diálogo Android de
permissão pausa a Activity. A interrupção de mídia ocorre apenas ao sair
realmente do aplicativo, sem pedido de permissão ou seletor de arquivo pendente.

Instale o APK e teste login, bloqueio de contas sem assinatura, texto, câmera, microfone e a voz em cada idioma instalado no Android. Validação de compilação e assinatura não substitui teste de áudio e câmera em um aparelho físico.

A versão 1.0.3 usa captura AAC nativa do Android para as conversas, com envio ao mesmo serviço autenticado de transcrição. A gravação temporária é apagada após envio ou cancelamento. Eventos da voz nativa acionam a animação da boca, e o retorno à Activity reinicia a animação do retrato. Compilação, lint e testes simulados não substituem o teste no aparelho.

## Despertador 1.0.4

O botão Abrir despertador do celular envia ACTION_SET_ALARM ao aplicativo Relógio. A tela do Relógio permanece visível para conferência/confirmacão e escolha do toque. O retorno significa apenas que a tela foi aberta, não que o alarme foi confirmado. O Relógio controla o disparo com a tela apagada. No site ou APK antigo a Mioko apresenta a alternativa manual, sem afirmar que agendou um alarme.
