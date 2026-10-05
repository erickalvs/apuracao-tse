# Apuracao Brasil

Aplicacao web independente para acompanhar arquivos oficiais de divulgacao de resultados do TSE, com mapa interativo do Brasil como interface principal.

## Como executar

```bash
npm install
npm run dev
```

Frontend: <http://localhost:5173>  
Backend: <http://localhost:3333>

Requisitos:

- Node.js 22 ou superior.
- npm 9 ou superior.

Build e testes:

```bash
npm test
npm run build
```

## Fontes validadas em 2026-10-04

- Documentacao tecnica 2026 do TSE: `https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados`
- Portal oficial Resultados: `https://resultados.tse.jus.br/oficial/app/index.html`
- EA20 Presidente Brasil: `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json` respondeu 200 com `ETag` e `Last-Modified`.
- EA20 Presidente SP: `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/sp/sp-c0001-e006257-u.json` respondeu 200.
- EA20 Governador SP: `https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json` respondeu 200.
- EA12 Municipios: `https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json` respondeu 200.
- Malha UF IBGE: `https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF` respondeu 200 via GET.
- Caminho `https://resultados.tse.jus.br/oficial/ele2026/comum/config/ele-c.json` retornou 404 no ambiente oficial durante a validacao; por isso a app usa como fallback conservador os codigos publicados na pagina tecnica 2026.

## Cobertura implementada

- Eleicoes 2026, primeiro turno: `6257` federal e `6259` estaduais, conforme pagina tecnica do TSE e arquivos EA20 validados.
- Cargos modelados: presidente, governador, senador, deputado federal, deputado estadual e deputado distrital.
- A eleicao/cargo de conselho distrital (`6261`/cargo `13`) foi verificada em 2026-10-04, mas o EA20 retornou 404 no ambiente oficial. Por isso nao e exibida como cobertura ativa.
- Resultado nacional, estadual e municipal quando o arquivo oficial existir.
- Consulta municipal por codigo interno do TSE obtido no EA12. O codigo IBGE, quando presente, e apenas metadado.
- Malha de 27 UFs pelo IBGE. O exterior nao e representado como UF.

## Arquitetura

- `server/index.ts`: API Fastify, CORS, rotas e tratamento de erro.
- `server/tse.ts`: construcao de URLs oficiais, validacao Zod e normalizacao EA20.
- `server/cache.ts`: cache em memoria com deduplicacao, ETag, Last-Modified, timeout e preservacao do ultimo valor valido.
- `src/ui/BrazilMap.tsx`: mapa SVG com D3 Geo, selecao por mouse, toque e teclado.
- `src/ui/App.tsx`: controles flutuantes, painel responsivo, busca, polling e estado na URL.

## Limites e interpretacao

A aplicacao nao faz projecoes. Lideranca parcial nao e vitoria oficial. A condicao de eleito ou segundo turno so aparece quando sustentada pelo campo oficial `e` no candidato. Campos ausentes sao exibidos como "Nao disponivel na fonte" e nao viram zero.

O intervalo inicial de polling e configuravel por `TSE_POLL_MS` e vem em 30 segundos por padrao. Esse valor e conservador para a aplicacao, nao uma recomendacao oficial do TSE. Requisicoes 304 tambem contam para rate limit, conforme FAQ tecnica do TSE.

Dados simulados nao sao consumidos por padrao. Ambientes simulado e oficial devem permanecer separados por configuracao de base URL.

## Preparacao para GitHub

Arquivos incluidos para publicacao:

- `.gitignore` para excluir `node_modules`, `dist`, caches, logs e `.env` local.
- `.env.example` com variaveis documentadas.
- `.nvmrc` com Node 22.
- `.github/workflows/ci.yml` rodando install, testes e build em pull requests e pushes para `main`.

Fluxo sugerido:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

## Deploy na Vercel

O projeto esta preparado para Vercel com:

- `vercel.json` apontando `npm run build` e saida `dist`.
- `api/*.ts` e `api/geo/states.ts` como funcoes serverless explicitas para as rotas usadas pelo frontend.
- `server/app.ts` compartilhando a configuracao Fastify entre desenvolvimento local e Vercel.

Passo a passo:

1. Suba o projeto para um repositorio no GitHub.
2. Acesse `https://vercel.com` e entre com sua conta GitHub.
3. Clique em `Add New...` e depois em `Project`.
4. Importe o repositorio.
5. Em `Framework Preset`, deixe `Vite`.
6. Confira:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci`
7. Adicione as variaveis de ambiente:

```env
TSE_OFFICIAL_BASE=https://resultados.tse.jus.br/oficial
TSE_POLL_MS=30000
CACHE_TTL_MS=25000
IBGE_GEO_URL=https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF
```

8. Clique em `Deploy`.
9. Depois do deploy, valide:
   - `/api/health`
   - `/api/elections`
   - carregamento do mapa
   - selecao de UF e cargo

Observacao: o cache em memoria funciona por instancia serverless e pode ser reiniciado pela plataforma. Para alto trafego, use cache externo, como Redis/KV.
