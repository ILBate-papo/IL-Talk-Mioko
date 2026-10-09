# Cobrança e painel do IL Talk Mioko

O plano inicial cobra R$ 140 por 30 dias. Dados de recebimento são configurados no painel autenticado `admin.html`. O Pix usa a chave, favorecido e banco informados pelo administrador. Um link público oficial do Mercado Pago pode ser salvo no painel.

Pagamentos são conferidos manualmente pelo administrador no aplicativo do banco ou Mercado Pago. Informar uma transação como cliente apenas cria uma solicitação; não libera acesso. A confirmação autorizada registra recebimento e assinatura em uma única transação no banco. A referência é única para impedir duplicação do prazo. Não há integração bancária, webhook ou validação automática do pagamento nesta versão.

`il-admin` exige JWT válido e a conta verificada na tabela privada de administradores. As tabelas e funções de dados são acessíveis somente ao servidor. Não use metadados editáveis do usuário como autorização.

`il-public` valida a chave pública do projeto, origem quando presente, tamanho dos dados, tipo de ação e limites por chamada. Seus únicos dados de leitura são a configuração pública de recebimento. Escritas públicas são eventos de estatística e interesse voluntário. Campos geográficos só são gravados com autorização. A limitação de frequência em memória é por instância; não é uma proteção distribuída contra ataques.

`il-payment` exige uma conta autenticada com e-mail confirmado. O ID do usuário vem da autenticação do servidor; o cliente não escolhe a conta beneficiada. A solicitação não altera assinaturas.

Visitas são visualizações de páginas; visitantes estimados são sessões do navegador de 30 minutos. Dados começam na ativação e não recuperam visitas anteriores. Períodos: 7, 30 e 90 dias. Dados de cidade e país são aproximados pelo GeoJS, consultado diretamente pelo navegador somente após autorização. IP e coordenadas não são gravados na tabela de estatísticas. Leads são formulários voluntários; conversão corresponde ao mesmo e-mail com um recebimento confirmado. Contas de administrador são excluídas dos cadastros de clientes.

Servidor: `public.ts` vira `il-public/index.ts`, `admin.ts` vira `il-admin/index.ts` com `access.ts`, `payment.ts` vira `il-payment/index.ts`. Todos incluem `common.ts`. `verify_jwt` é falso somente em `il-public`, cuja API pública faz validação própria. As demais funções mantêm `verify_jwt=true`.

Validação: controle de acesso e solicitações testados com requisições simuladas. Contagens, conversão, prazo, pagamento e idempotência testados em PostgreSQL local isolado com PGlite 0.5.8. Na base em produção, os testes foram somente de leitura. A auditoria confirmou RLS e ausência de acesso direto de visitantes e membros. Nenhum pagamento real foi executado nos testes.
