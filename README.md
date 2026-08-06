# Prospecção ZEU

Triagem, pontuação e due diligence de terrenos em **Zona Eixo de Estruturação da
Transformação Urbana (ZEU)** na cidade de São Paulo, sob a Lei Municipal
16.402/2016 (LPUOS), alterada pelas Leis 18.081/2024 e 18.177/2024.

App privado, para um time de 3 a 6 pessoas. Entrada por link mágico no e-mail,
sem senha, e só para quem foi convidado.

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
| Autenticação | Auth.js (NextAuth v5) — link mágico por e-mail, sessão em banco |
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
npm run db:seed      # cria a configuração, o admin e 5 terrenos de exemplo
```

Para subir sem os exemplos: `SEED_EXEMPLOS=false npm run db:seed`.

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

## Configurando o envio de e-mail

Para os outros membros entrarem, o app precisa mandar e-mail de verdade.
Qualquer SMTP serve; o mais rápido é o [Resend](https://resend.com) (gratuito
até 3.000 e-mails/mês):

1. Crie a conta e gere uma API key.
2. No `.env`:
   ```env
   EMAIL_SERVER="smtp://resend:SUA_API_KEY@smtp.resend.com:587"
   EMAIL_FROM="Prospecção ZEU <onboarding@resend.dev>"
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

**Por que busca em vez de raspagem direta?** Os portais não têm API pública e
seus termos de uso proíbem raspagem automatizada. Consultar um provedor de
busca e ler o que ele já indexou é o caminho que funciona e não passa por cima
disso. O app nunca abre o portal fingindo ser um navegador.

### Geocodificação

O endereço extraído do anúncio é geocodificado pelo Nominatim (OpenStreetMap),
que é gratuito mas **exige identificação**:

```env
NOMINATIM_USER_AGENT="prospeccao-zeu/1.0 (voce@exemplo.com)"
```

Sem isso o Nominatim responde 403, nenhum endereço é localizado e todas as
zonas ficam "a verificar" — o app avisa na tela quando isso acontece. As
consultas são serializadas com 1,1 s de intervalo (política do serviço) e ficam
em cache no banco, inclusive as que não acharam nada.

### Confirmando a ZEU automaticamente

Esta é a parte que transforma "bairro de eixo" em "está na ZEU mesmo".

1. No [GeoSampa](https://geosampa.prefeitura.sp.gov.br), baixe a camada de
   **Zoneamento (LPUOS)**.
2. Converta para GeoJSON em EPSG:4326, **filtrando só as zonas de eixo** — o
   arquivo da cidade inteira é grande demais para carregar a cada requisição:
   ```bash
   ogr2ogr -f GeoJSON data/zoneamento.geojson zoneamento.shp \
     -t_srs EPSG:4326 -where "zl_zona LIKE 'ZEU%' OR zl_zona LIKE 'ZEM%'"
   ```
3. Aponte a variável:
   ```env
   ZONEAMENTO_GEOJSON="data/zoneamento.geojson"
   ```

Com a camada carregada, a coordenada de cada anúncio passa por *point-in-polygon*
e a zona vira **confirmada** — e o filtro "só aceitar zona confirmada" fica
disponível na busca. Sem ela, o app é honesto: marca "a verificar" e põe o link
do GeoSampa do lado.

Para volume grande de polígonos, o certo é PostGIS com `ST_Contains` em vez do
GeoJSON em memória. O ponto de troca é a função `resolverZona` em
`src/lib/geo/zoneamento.ts` — só ela sabe como a zona é resolvida.

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
   | `ADMIN_EMAILS` | seu e-mail |
   | `EMAIL_SERVER` | SMTP do Resend |
   | `EMAIL_FROM` | remetente verificado |
   | `SERPER_API_KEY` | chave da busca |
   | `NOMINATIM_USER_AGENT` | `prospeccao-zeu/1.0 (seu@email)` |

   Não precisa definir `AUTH_URL`: a Vercel injeta a URL sozinha e o app está
   com `trustHost` ligado.

3. Faça o deploy.

### 3. Preparar o banco de produção

Rode uma vez, da sua máquina, com o `.env` apontando para o Neon:

```bash
npm run db:deploy   # aplica as migrations
npm run db:seed     # cria configuração e admin
```

Para produção sem os terrenos de exemplo: `SEED_EXEMPLOS=false npm run db:seed`.

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
npm run build       # build de produção
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
