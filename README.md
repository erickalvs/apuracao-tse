# Apuracao TSE

Aplicacao web independente para acompanhar resultados eleitorais brasileiros em um mapa interativo do Brasil.

Projeto publicado em: https://apuracao-tse.vercel.app/

## Situacao atual

Esta versao usa a interface visual do projeto `open-apuracao-brazil`, mas a camada de dados foi alterada para consultar arquivos oficiais do Tribunal Superior Eleitoral.

Os dados mockados nao sao usados pela aplicacao principal. Eles permanecem apenas em arquivos herdados/testes da base original enquanto a integracao oficial e ampliada.

## Fontes oficiais

- Portal oficial de resultados do TSE: https://resultados.tse.jus.br/oficial/app/index.html
- Arquivos EA20 de resultado unificado do ambiente oficial.
- Arquivo EA12 de municipios para mapear codigo IBGE para codigo municipal do TSE.
- Malha geografica municipal em TopoJSON herdada da interface base.

## Cobertura implementada

- Eleicao geral 2026, primeiro turno.
- Presidente com resultado nacional e por UF.
- Governador, Senado, deputado federal, deputado estadual e deputado distrital por UF, conforme disponibilidade oficial.
- Consulta municipal carregada por UF em background, preenchendo o mapa nacional de municipios com dados oficiais.
- Atualizacao automatica conservadora a cada 30 segundos no frontend.
- Painel de andamento com participacao, serie temporal, ultimas atualizacoes, viradas, fonte e lista de candidatos.

Quando um arquivo oficial nao existe para o recorte selecionado, a interface mostra que o dado nao esta disponivel na fonte.

## Arquitetura

- Frontend: Preact, htm, Vite, Canvas 2D.
- API serverless Vercel:
  - `api/snapshot.js`: consulta resultados oficiais por cargo e UF.
  - `api/result.js`: consulta resultado oficial de um recorte especifico, incluindo municipio.
  - `api/_tse.js`: construcao das URLs oficiais, cache em memoria e normalizacao EA20.
- Frontend oficial:
  - `src/data/official.js`: adapta os dados oficiais ao formato usado pelo mapa.

## Limitacoes conhecidas

- A visualizacao por zona eleitoral ainda nao foi integrada aos arquivos oficiais.
- A consulta municipal e feita por UF, com carregamento progressivo em background para evitar uma unica requisicao nacional massiva ao TSE.
- A serie temporal e as ultimas atualizacoes sao formadas por snapshots oficiais coletados enquanto a aplicacao esta aberta; a aplicacao nao reconstroi parciais antigas quando a fonte oficial nao fornece esse historico no endpoint consumido.
- O cache em memoria da Vercel e por instancia serverless.
- O app nao faz projecoes: lideranca, eleito e situacoes oficiais dependem dos campos publicados pelo TSE.

## Desenvolvimento

```sh
npm install
npm run build
npm test
```

O deploy principal e feito pela Vercel a partir da branch `main`.
