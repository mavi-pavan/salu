# Salu

Triagem, pontuação e due diligence de terrenos em **Zona Eixo de Estruturação da
Transformação Urbana (ZEU)** na cidade de São Paulo, sob a Lei Municipal
16.402/2016 (LPUOS), alterada pelas Leis 18.081/2024 e 18.177/2024.

App privado, para um time de 3 a 6 pessoas. Entrada por conta Google ou link
mágico no e-mail, sem senha, e só para quem foi convidado.

---

## O que o app faz

**1. Acha terrenos na internet.** Você escolhe as zonas de eixo e a faixa de
área; o app consulta os portais de imóveis, lê área, preço e endereço de cada
anúncio, geocodifica o endereço, cruza a coordenada com o zoneamento e devolve
só o que cabe no filtro — já com o **R$/m² de potencial construtivo** calculado.
Um clique manda o anúncio para o funil.

**2. Pontua com critério objetivo.** Dez critérios com nota de 0 a 10 e peso
configurável (preço por potencial, área, testada, restrições, distância do
transporte, situação documental…). Critério sem dado **não vira zero** — ele sai
da média e reduz a *cobertura*, que aparece junto do score. Score 82 com 40% de
cobertura é palpite; com 95% é decisão.

**3. Faz a conta que importa.** Estudo de massa expresso com outorga onerosa
(fórmula do art. 117 do PDE), VGV, custo de obra e, principalmente, o **preço
máximo que o terreno pode custar** para entregar a margem alvo. Comparar esse
número com o preço pedido é o que separa terreno caro de terreno viável.

**4. Controla a due diligence.** Checklist de 33 itens (cartorial, vendedor,
urbanístico, ambiental, infraestrutura, comercial, financeiro) instanciado
automaticamente em cada terreno, com responsável, prazo e status. Itens críticos
sinalizados. Problemas aparecem no painel.

Além disso: mapa dos terrenos, notas e visitas, documentos por link, trilha de
auditoria de quem mudou o quê, e controle de papéis (admin / membro / leitor).

---

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Estilo | Tailwind CSS v4 |
| Banco | PostgreSQL + Prisma 6 |
| Autenticação | Auth.js (NextAuth v5) — Google ou link mágico, sessão em banco |
| Testes | Vitest |
| Mapa | Leaflet + OpenStreetMap |
| Deploy | Vercel + Neon |

---

## Rodando local — passo a passo

### 1. Pré-requisitos

- Node.js 20.11 ou superior
- Um PostgreSQL. Se não tiver, suba um com Docker:
  ```bash
  docker run --name zeu-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
  docker exec -it zeu-db createdb -U postgres zeu
  ```
  Ou crie um banco grátis no [Neon](https://neon.tech) e use a string dele.

### 2. Instalar e configurar

```bash
npm install
cp .env.example .env
```

Abra o `.env` e preencha, no mínimo:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zeu?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/zeu?schema=public"
AUTH_SECRET="cole-aqui"          # gere com: npx auth secret
ADMIN_EMAILS="voce@exemplo.com"  # seu e-mail vira admin no primeiro login
```

### 3. Criar as tabelas e os dados iniciais

```bash
npm run db:migrate   # aplica as migrations
npm run db:seed      # opcional: 5 terrenos de exemplo para explorar
```

O seed é opcional. Sem ele o app funciona igual, só começa vazio — o primeiro
login com um e-mail de `ADMIN_EMAILS` já cria o usuário como administrador.
Para os exemplos sem sobrescrever nada: `SEED_EXEMPLOS=false npm run db:seed`.

### 4. Subir

```bash
npm run dev
```

Abra <http://localhost:3000>, digite o e-mail que você colocou em
`ADMIN_EMAILS` e clique em "Receber link de acesso".

> **Sem servidor de e-mail configurado, o link aparece no terminal**, dentro de
> uma caixa. Copie e cole no navegador. É proposital: dá para rodar o app
> inteiro localmente sem criar conta em serviço nenhum.

---

## Login com Google (recomendado)

Com o Google configurado, ninguém depende de e-mail para entrar — some toda a
dor de entrega de link mágico. A lista de convidados continua valendo: só entra
quem está em `ADMIN_EMAILS` ou foi convidado dentro do app.

1. Vá em <https://console.cloud.google.com> e crie (ou escolha) um projeto.
2. **APIs e Serviços → Tela de permissão OAuth**: tipo **Externo**, preencha
   nome do app e e-mail de contato. Em *Usuários de teste*, adicione os e-mails
   da equipe — assim não precisa publicar o app para verificação.
3. **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**,
   tipo **Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, adicione:
   ```
   https://SEU-SITE.vercel.app/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
   O caminho `/api/auth/callback/google` tem que ser exato.
5. Copie o **ID do cliente** e a **Chave secreta** para as variáveis:
   ```env
   AUTH_GOOGLE_ID="...apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="..."
   ```

O botão "Entrar com Google" aparece sozinho quando as duas existem. Sem elas, a
tela mostra só o link por e-mail.

**Sobre juntar as duas formas de entrar:** quem já entrou pelo link mágico e
depois usa o Google cairia em `OAuthAccountNotLinked`, porque o Auth.js não
junta métodos no mesmo e-mail por padrão. O app liga
`allowDangerousEmailAccountLinking` no provedor do Google — seguro aqui porque o
Google verifica a posse do endereço, o app recusa conta com e-mail não
verificado, e nada entra sem estar na lista de convidados.

---

## Configurando o envio de e-mail

Opcional se você já configurou o Google acima. Serve como caminho alternativo
ou para quem não tem conta Google.
Qualquer SMTP serve; o mais rápido é o [Resend](https://resend.com) (gratuito
até 3.000 e-mails/mês):

1. Crie a conta e gere uma API key.
2. No `.env`:
   ```env
   EMAIL_SERVER="smtp://resend:SUA_API_KEY@smtp.resend.com:587"
   EMAIL_FROM="Salu <onboarding@resend.dev>"
   ```
3. Para usar seu próprio domínio no remetente, verifique o domínio no Resend e
   troque o `EMAIL_FROM`.

Com Gmail, use uma **senha de app** (não a senha da conta):
`EMAIL_SERVER="smtp://voce@gmail.com:senha_de_app@smtp.gmail.com:587"`.

---

## Ligando a busca na internet

Sem chave de API o app funciona em **modo demonstração**: devolve anúncios
fictícios, com URL terminada em `.invalid` e aviso na tela. Serve para conhecer
o fluxo, não para prospectar.

Para buscar de verdade, escolha **um** provedor e coloque a chave no `.env`:

| Provedor | Cota gratuita | Variável |
| --- | --- | --- |
| [Serper](https://serper.dev) (resultados do Google) | 2.500 buscas | `SERPER_API_KEY` |
| [Brave Search](https://api-dashboard.search.brave.com) | 2.000/mês | `BRAVE_API_KEY` |
| [Tavily](https://tavily.com) | 1.000/mês | `TAVILY_API_KEY` |

O app detecta sozinho qual está configurada. Recomendo o Serper: os portais
brasileiros de imóvel são muito melhor indexados pelo Google.

**Uma limitação que só aparece rodando:** o plano gratuito do Serper recusa
operadores de busca — a consulta com `(site:vivareal.com.br OR ...)` volta
`400 Query pattern not allowed for free accounts`. O app percebe isso na
primeira consulta, desliga o filtro de portais para o resto da busca (em vez de
insistir e gastar duas chamadas por região) e avisa na tela. Os resultados que
não vieram de portal conhecido aparecem marcados como "fora dos portais".

Quem precisa do filtro de portais funcionando na cota gratuita: use o **Tavily**,
que restringe domínios por parâmetro (`include_domains`) em vez de operador. O
app já faz isso sozinho quando a chave do Tavily é a configurada.

**Por que busca em vez de raspagem direta?** Os portais não têm API pública e
seus termos de uso proíbem raspagem automatizada. Consultar um provedor de
busca e ler o que ele já indexou é o caminho que funciona e não passa por cima
disso. O app nunca abre o portal fingindo ser um navegador.

### Como a busca mira no eixo

A ZEU não é o bairro: é uma faixa em torno da estação. Por isso a busca pergunta
de três formas, combináveis na tela:

- **pelas estações do eixo** — `terreno à venda estação Praça da Árvore`, que é
  como o anúncio de terreno para incorporação se descreve, porque a estação é o
  argumento de venda dele;
- **pelo bairro inteiro** — a rede mais larga, que traz também o que está longe
  do eixo;
- **por termo de incorporação** — `área para incorporação`, o vocabulário de
  quem já sabe o que tem em mãos.

Cada região marcada rende mais de uma consulta, então a cota é repartida em
rodadas: toda região recebe a primeira consulta antes de qualquer uma receber a
segunda.

Do texto do anúncio saem também a **estação citada** e a **distância declarada
até ela** — que é o melhor indício de eixo que um anúncio oferece e já vai
preenchido quando o resultado vira terreno no funil. Nome de bairro não conta
como estação: metade das estações de São Paulo se chama como o bairro, então sem
uma palavra de transporte no texto o campo fica vazio.

### O veredito na lista

A coluna **"cabe na conta"** compara o preço pedido com o preço máximo que fecha
a margem alvo, usando a mesma função da ficha do terreno e as premissas de
Configurações. Folga positiva é oportunidade; negativa é quanto seria preciso
negociar.

Sem zona confirmada não há veredito — os coeficientes mudam tudo, e supor ZEU
transformaria um lote de ZM num falso achado. E quando as premissas são tais que
obra e custos já passam do VGV, a tela diz isso com todas as letras em vez de
mostrar um traço: o problema está na conta, não no anúncio.

### Geocodificação

O endereço extraído do anúncio é geocodificado pelo Nominatim (OpenStreetMap),
que é gratuito mas **exige identificação**:

```env
NOMINATIM_USER_AGENT="salu/1.0 (voce@exemplo.com)"
```

Sem isso o Nominatim responde 403, nenhum endereço é localizado e todas as
zonas ficam "a verificar" — o app avisa na tela quando isso acontece. As
consultas são serializadas com 1,1 s de intervalo (política do serviço) e ficam
em cache no banco, inclusive as que não acharam nada.

### Confirmando a ZEU automaticamente (GeoSampa)

Esta é a parte que transforma "bairro de eixo" em "está na ZEU mesmo". **Não
precisa configurar nada**: o app consulta o WFS público da Prefeitura a cada
coordenada e confirma a zona na hora.

Como funciona, em uma linha por etapa:

1. O endereço do anúncio é geocodificado (Nominatim) e vira latitude/longitude.
2. A coordenada é reprojetada para **EPSG:31983** (SIRGAS 2000 / UTM 23S), que é
   o sistema nativo das camadas do GeoSampa.
3. O app pede ao WFS as feições numa caixa de poucos metros em volta do ponto,
   na camada `geoportal:perimetro_zona_lei_18177_24` — "Perímetro de Zonas,
   Lei 18.177/24", ou seja, a LPUOS vigente.
4. O *point-in-polygon* é feito localmente sobre o que voltou, e a zona aparece
   na tela como **confirmada no GeoSampa**.

Duas decisões que valem a explicação, porque não são óbvias:

- **Por que UTM e não latitude/longitude.** Em EPSG:4326, a ordem dos eixos
  depende de como o código do CRS é escrito na requisição, e quando o serviço
  entende ao contrário ele não reclama: devolve zero feição. Zero feição é
  indistinguível de "aqui não tem zona nenhuma" — o app afirmaria, com toda a
  confiança, que a cidade inteira não é ZEU. Em UTM não existe essa ambiguidade.
- **Por que uma caixa e não um ponto.** A consulta por caixa é aplicada pelo
  GeoServer na geometria padrão da camada, sem precisar adivinhar o nome da
  coluna geométrica (`the_geom`, `geom`, `shape`… varia). E a coordenada do
  Nominatim tem incerteza de dezenas de metros, então alguns metros de folga são
  honestos.

Falha nunca vira "não é ZEU": se o serviço não responder, o resultado fica
**a verificar**, o motivo aparece no aviso da busca e o link do GeoSampa
continua do lado de cada anúncio para conferência manual.

Variáveis, para o dia em que a Prefeitura mudar algo de lugar:

```env
GEOSAMPA_WFS="off"                                  # desliga a consulta
GEOSAMPA_WFS_CAMADA="geoportal:zoneamento_2016_map1" # outra camada
GEOSAMPA_WFS_URL="https://.../geoserver/geoportal/wfs"
```

#### Alternativa offline: GeoJSON local

Se preferir não depender do serviço (ou quiser velocidade máxima), aponte um
arquivo — ele **tem precedência** sobre o GeoSampa:

1. No [GeoSampa](https://geosampa.prefeitura.sp.gov.br), baixe a camada de
   **Zoneamento (LPUOS)**.
2. Converta para GeoJSON em EPSG:4326, filtrando só as zonas que interessam:
   ```bash
   ogr2ogr -f GeoJSON data/zoneamento.geojson zoneamento.shp \
     -t_srs EPSG:4326 -where "zl_zona LIKE 'ZEU%' OR zl_zona LIKE 'ZEM%'"
   ```
3. Aponte a variável:
   ```env
   ZONEAMENTO_GEOJSON="data/zoneamento.geojson"
   ```

O preço é que o arquivo congela na data em que foi gerado — a tela de busca
avisa isso.

Para volume grande de polígonos, o certo é PostGIS com `ST_Contains`. O ponto de
troca é a função `resolverZona` em `src/lib/geo/zoneamento.ts` — só ela sabe
como a zona é resolvida.

---

## Deploy na Vercel + Neon

### 1. Banco no Neon

1. Crie um projeto em <https://neon.tech>.
2. Em **Connection Details**, copie as duas strings:
   - **Pooled connection** (tem `-pooler` no host) → `DATABASE_URL`
   - **Direct connection** (sem `-pooler`) → `DIRECT_URL`

   As migrations precisam da conexão direta; a aplicação usa a com pool.

### 2. Projeto na Vercel

1. Importe o repositório em <https://vercel.com/new>.
2. Em **Environment Variables**, adicione:

   | Variável | Valor |
   | --- | --- |
   | `DATABASE_URL` | string *pooled* do Neon |
   | `DIRECT_URL` | string *direct* do Neon |
   | `AUTH_SECRET` | saída de `npx auth secret` |
   | `AUTH_GOOGLE_ID` | ID do cliente OAuth |
   | `AUTH_GOOGLE_SECRET` | chave secreta do cliente OAuth |
   | `ADMIN_EMAILS` | seu e-mail |
   | `EMAIL_SERVER` | SMTP do Resend |
   | `EMAIL_FROM` | remetente verificado |
   | `SERPER_API_KEY` | chave da busca |
   | `NOMINATIM_USER_AGENT` | `salu/1.0 (seu@email)` |

   Não precisa definir `AUTH_URL`: a Vercel injeta a URL sozinha e o app está
   com `trustHost` ligado.

3. Faça o deploy.

**Não precisa rodar nada da sua máquina.** O `npm run build` executa
`prisma migrate deploy` antes de compilar, então a Vercel cria as tabelas no
Neon sozinha, a cada deploy. E o banco não precisa de seed: o primeiro login
com um endereço listado em `ADMIN_EMAILS` cria o usuário já como administrador,
e as configurações caem no padrão até alguém mudá-las na tela.

> Consequência: se o banco estiver fora do ar, o build falha em vez de subir
> uma versão que quebraria em produção. É proposital.

Se você esquecer a `DIRECT_URL`, o build não quebra: ele avisa no log e usa a
`DATABASE_URL` também para as migrations. Funciona, mas defina as duas — é o
que separa a conexão com pool (aplicação) da direta (migrations).

Quer os 5 terrenos de exemplo em produção? Rode `npm run db:seed` da sua
máquina, com o `.env` apontando para o Neon. É opcional.

### 4. Convidar o time

Entre com seu e-mail, vá em **Configurações → Convites**, adicione os e-mails
dos sócios e escolha o papel:

- **Administrador** — mexe em pesos, premissas e equipe
- **Membro** — cadastra e edita terrenos
- **Leitor** — só consulta

Quem não estiver na lista **não recebe link nenhum** — a checagem acontece antes
do envio do e-mail.

---

## Comandos

```bash
npm run dev         # desenvolvimento
npm run build       # build de produção (aplica as migrations antes de compilar)
npm run start       # servidor de produção
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Vitest
npm run db:migrate  # cria/aplica migration (dev)
npm run db:deploy   # aplica migrations (produção)
npm run db:seed     # popula o banco
npm run db:studio   # Prisma Studio
npm run db:reset    # apaga tudo e refaz (cuidado)
```

---

## Como o código está organizado

```
prisma/
  schema.prisma          modelo de dados
  seed.ts                configuração, admin e terrenos de exemplo
src/
  auth.ts                Auth.js: link mágico + lista de convidados
  lib/
    zeu.ts               parâmetros urbanísticos por zona (CA, TO, cota-parte…)
    scoring.ts           pontuação: critérios, pesos, alertas, cobertura
    viabilidade.ts       estudo de massa, outorga, preço máximo do terreno
    due-diligence.ts     checklist padrão de 33 itens
    busca/
      provedores.ts      Serper / Brave / Tavily / demo
      extrair.ts         lê área, preço e endereço do texto do anúncio
      regioes.ts         bairros de São Paulo por corredor de eixo
    geo/
      geocodificar.ts    Nominatim, com fila e cache em banco
      zoneamento.ts      point-in-polygon contra a camada de zoneamento
  server/
    queries.ts           leituras
    actions.ts           server actions de terreno, DD, notas, config
    busca.ts             orquestra a busca ponta a ponta
  app/(app)/             páginas autenticadas
  components/            UI
```

### Decisões que valem explicação

**Sem middleware de autenticação.** A sessão fica no banco, e middleware roda no
edge, sem Prisma. Em vez de trocar por JWT só para agradar o middleware, a
verificação mora onde os dados são lidos: no layout protegido e no começo de
toda server action. Menos mágica, mais difícil de furar.

**Números em `Float`, não `Decimal`.** Tudo aqui é estimativa de prospecção —
área, VGV, custo de obra, outorga. Nenhum valor é registro contábil. `Float`
evita a classe de bugs de serialização do `Prisma.Decimal` na fronteira Server →
Client Component. Se um dia entrar contas a pagar de verdade, esses campos viram
`Decimal(14,2)`.

**Score em cache na tabela.** Permite ordenar e filtrar no banco. Como pesos
mudam o ranking de todo mundo, salvar a configuração **repontua todos os
terrenos** na mesma transação.

**PostgreSQL também em desenvolvimento.** O SQLite não suporta `enum` nem
arrays, que o schema usa bastante. Manter os dois exigiria abrir mão da
modelagem ou manter dois schemas. Um container Postgres resolve em uma linha.

**Documentos são links.** Não há upload: cada documento é uma URL (Drive,
Dropbox, portal da prefeitura). Para upload de verdade, o lugar de mexer é o
modelo `Documento` e o formulário em `components/terreno/formularios.tsx` —
Vercel Blob resolve com poucas linhas.

---

## Sobre os parâmetros urbanísticos

Os valores em `src/lib/zeu.ts` (CA básico 1,0 e máximo 4,0 na ZEU, TO de 85%/70%,
cota-parte de 20 m²/unidade, gabarito livre) são **referência para triagem
rápida** — não substituem consulta oficial. Coeficientes variam por perímetro,
por quadro anexo e por data de protocolo, e a revisão de 2024 mexeu em parte
deles.

Antes de assinar qualquer coisa:

1. Confirme a zona no GeoSampa pelo número do contribuinte (SQL).
2. Confira os Quadros 2, 2A, 3 e 4 da Lei 16.402/2016 na redação vigente.
3. Peça Certidão de Zoneamento à SMUL para o lote específico.

Todo terreno permite sobrescrever CA básico e CA máximo, justamente para quando
a certidão divergir do padrão da zona. O aviso aparece na ficha de cada terreno.

O mesmo vale para a viabilidade: as premissas padrão foram calibradas para uma
incorporação de médio padrão em eixo (obra ~50% do VGV, margem alvo 18%), mas
são o seu produto e o seu custo que mandam. Ajuste em **Configurações**.
