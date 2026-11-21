# Controle de Produção 3D + pedidos Shopee pelo Bling

**Situação:** versão integrada preparada a partir do arquivo **`impressao3d-main.zip`** que você enviou. Não foi publicada na Vercel, não recebeu credenciais reais e não foi conectada à sua conta Bling. Faça primeiro um teste em uma branch/implantação de pré-visualização. **Não substitua seu repositório em produção sem backup.**

## O que muda em relação ao seu `index.html` original

- **Mantido:** o HTML e o estilo do Controle de Produção 3D, painel de pedidos/peças, agrupamento por SKU e variação, multiplicadores, controle de peças já impressas e pendentes, filtros, importação de exemplo, cadastro manual, CSV e armazenamento `localStorage` (`prod3d_records`).
- **Corrigido:** o script original acessava `imageFile`, `pasteArea`, `preview`, `reviewRows`, `confirmImport` e `cancelImport`, mas nenhum desses elementos existia no HTML: isso interrompia a execução final da página. Foram acrescentados controles de importação de print/OCR e revisão. Também foi corrigida a expressão regular dos multiplicadores e a quebra de linhas do CSV.
- **Novo:** seção "Pedidos Shopee via Bling", com autenticação no servidor, consulta paginada por data, seleção de pedidos e importação de seus itens/SKUs/quantidades para a mesma tabela de produção. A importação usa IDs estáveis `bling:ID_PEDIDO:ID_ITEM` para evitar duplicação de linhas já importadas, preservando o progresso de peças impressas.
- **PDF da UpSeller:** o código original tinha um campo de PDF sem função de leitura. Adicionei extração textual com PDF.js e pré-visualização/revisão. Essa extração é **heurística**, depende do formato do PDF e **não foi validada com um PDF real seu**; corrija os itens na tela de revisão antes de importar.

## Segurança / limitações

- A integração **só consulta** `GET /pedidos/vendas` e `GET /pedidos/vendas/{id}`. Não há APIs de gravação de pedidos, produtos, estoque ou NF-e. Chamadas POST na solução são **apenas** de autenticação OAuth e salvamento de tokens no Redis; o Bling receberá POST apenas para `/oauth/token`.
- Configure no aplicativo privado Bling **apenas o escopo de consulta de pedidos de venda**. O nome do escopo exibido na interface pode variar.
- O **Client ID, Client Secret, refresh/access tokens e chave do Redis nunca aparecem no HTML**. `APP_ADMIN_TOKEN` é digitado manualmente no painel e não é salvo em localStorage; deve ser forte e jamais incluído no GitHub.
- Os pedidos recebidos para produção **não contêm CPF, nome, endereço, telefone ou e-mail dos clientes**. A API é normalizada no servidor para retornar apenas informações necessárias de pedido e itens.
- A opção **Automática** consulta a API **a cada cinco minutos somente enquanto a aba estiver aberta e a chave tiver sido informada**. Ela também exige `BLING_SHOPEE_ID_LOJA` configurado e IDs de situações *com pagamento confirmado* conferidos manualmente. O sistema **não** sincroniza com o site fechado. Para isso será preciso adicionar rotina no servidor (cron/webhook verificado), persistência dos pedidos e acesso autenticado ao painel.
- O sistema ainda salva as peças produzidas no navegador, como antes. Em outro computador ou ao limpar os dados do navegador, os registros locais não aparecem. Exporte o CSV regularmente. O aplicativo não realiza backup online dos dados de produção.
- Alterar a configuração no Bling que envia estoque à Shopee ou ativa NF-e **é separado** deste projeto. Confirme nas configurações da integração Shopee do Bling que ambos continuam **desativados**.

## Como testar com segurança, passo a passo

1. **Salve o ZIP original** como backup. Na sua conta GitHub, crie uma branch `teste-integracao-bling` e envie **o conteúdo deste ZIP** para essa branch, sem substituir as credenciais/configurações do projeto. Os arquivos precisam ficar na raiz do repositório, com `index.html`, `api/`, `lib/`, `bling-integracao.js` e `production-map.js` no mesmo nível. A Vercel poderá criar um deploy de pré-visualização.
2. No Bling, abra **Central de Extensões → Área do Integrador → Criar aplicativo → Privado**. Dê um nome como "Controle de Produção 3D", e selecione **somente consulta de pedidos de venda** entre os escopos. Registre como **Link de redirecionamento** a URL exata do ambiente onde será feito o teste: `https://SEU-DOMINIO/api/bling/callback`. O `APP_PUBLIC_URL` deve ser a mesma origem, sem barra final. Leia https://developer.bling.com.br/aplicativos.
3. Configure uma instância **Upstash Redis** para guardar os tokens criptografados. Na Vercel, em **Project → Settings → Environment Variables**, crie as variáveis listadas em `.env.example`. Escolha **Preview** ao testar numa URL de pré-visualização. Refaça deploy depois de alterar as variáveis. `APP_PUBLIC_URL` deve corresponder à URL real de teste; use preferencialmente a URL estável da branch de pré-visualização (`...-git-teste-integracao-bling-...vercel.app`), que aponta para o commit mais recente da branch. O callback deve corresponder EXATAMENTE a essa origem.
4. Gere duas chaves diferentes de 32 bytes pelo terminal (não compartilhe as saídas):

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"   # APP_ADMIN_TOKEN
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))" # BLING_TOKEN_ENCRYPTION_KEY
   ```

5. Abra a página de teste. Na nova seção **Pedidos Shopee via Bling**, digite a chave administrativa, clique em **Autorizar Bling** e conclua a autorização no site oficial. Ao retornar à página inicial do Controle de Produção 3D, digite novamente a chave e clique em **Verificar conexão**. A autorização e os tokens são tratados por funções de servidor no diretório `/api/bling`.
6. Escolha um intervalo de datas e clique em **Consultar pedidos**. A situação aparece pelo seu **ID numérico**, porque a API não retorna necessariamente o texto "Em andamento". Confira a situação do pedido na tela do Bling ou na Shopee antes de selecionar.
7. Comece marcando **um pedido já pago**. Clique **Adicionar pedidos selecionados à produção** e confirme. Confira SKU, quantidade, multiplicador do kit, total necessário e progresso de impressão. Repetir a importação não duplica o mesmo item; o número "Já impresso" é preservado.
8. **Somente após validar** os IDs das situações e o `BLING_SHOPEE_ID_LOJA` interno da loja, você pode ativar a opção de atualização enquanto a aba estiver aberta. Não use o Shop ID da Shopee no lugar do ID interno de loja do Bling. A lista de pedidos mostra o ID da loja para facilitar a identificação. Consulte os IDs com o administrador da conta, sempre sem compartilhá-los como segredos.
9. Quando os testes forem satisfatórios, mescle a branch no GitHub que a Vercel já usa. Não há necessidade de desconectar o repositório da Vercel.

## Variáveis de ambiente

| Variável | Exemplo/orientação |
| --- | --- |
| `BLING_CLIENT_ID` | Copiar do aplicativo privado Bling; guardar apenas na Vercel |
| `BLING_CLIENT_SECRET` | Copiar do aplicativo privado Bling; **não publicar** |
| `APP_PUBLIC_URL` | `https://impressao3d-rho.vercel.app` se for produção; use a URL exata de preview se for teste |
| `APP_ADMIN_TOKEN` | Chave forte aleatória em hex |
| `BLING_TOKEN_ENCRYPTION_KEY` | Chave aleatória em base64 de 32 bytes |
| `UPSTASH_REDIS_REST_URL` | URL HTTPS REST do seu Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Token secreto REST do Redis |
| `BLING_SHOPEE_ID_LOJA` | Recomendado; obrigatório para ativar auto-importação desta versão, ID **interno** da loja Bling |

Não suba `.env`, `.env.local` ou chaves. O arquivo `.env.example` deve continuar **sem valores**.

## Arquivos principais

- `index.html`: seu controle original com a seção Bling adicionada e controles OCR/PDF recuperados.
- `production-map.js`: traduz pedidos e itens para linhas de produção com deduplicação.
- `bling-integracao.js`: painel para consultar pedidos, importar para produção e opcionalmente acompanhar novos pedidos enquanto aberto.
- `api/bling/*.js`: funções da Vercel para autenticação e consultas protegidas.
- `lib/bling-core.js`: OAuth 2.0, JWT `enable-jwt: 1`, criptografia AES-256-GCM e acesso controlado ao Redis.
- `tests/*.test.js`: testes automatizados para cálculos, proteção de dados, OAuth, criptografia e deduplicação.

## Execução de testes locais

Com o Node.js instalado, na pasta do projeto:

```bash
node --test tests/*.test.js
```

A execução de HTML estático em `python -m http.server` permite visualizar a interface, mas **não executa as funções serverless** em `/api`. Para testar OAuth e API, use um **deployment de Preview na Vercel** (ou `vercel dev` devidamente configurado) e as credenciais privadas na plataforma.

## Documentação oficial

- [Aplicativos privados e OAuth Bling](https://developer.bling.com.br/aplicativos)
- [Migração JWT / header `enable-jwt: 1`](https://developer.bling.com.br/migracao-jwt)
- [Limites 3 requisições por segundo](https://developer.bling.com.br/limites)
- [Vercel Functions com `/api`](https://vercel.com/docs/functions/runtimes/node-js)

**Ajuste realizado nesta versão:** o callback OAuth retorna para `/` (página inicial real do sistema), não para um arquivo HTML inexistente. **Não testado com sua conta real e não publicado no GitHub/Vercel.**
