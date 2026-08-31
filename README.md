# FootballLive

Placares ao vivo, resultados, classificação, artilharia e cartões do Brasileirão
Séries A, B e C e das cinco grandes ligas europeias. Dados da API pública da ESPN
— sem chave, sem cadastro.

Esta é a versão em **React**: o mesmo site que antes era HTML, CSS e JavaScript
puro (ainda no histórico deste repositório), agora dividido em componentes, com
navegação por rotas e uma folha de estilo por componente.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
```

Outros comandos: `npm run build` (gera `dist/`), `npm run preview` (serve o
build) e `npm run lint`.

## Telas

Cada seção tem endereço próprio, então dá para linkar e recarregar em qualquer
uma delas:

| Rota | Tela |
| --- | --- |
| `/:liga/hoje` | jogos do dia |
| `/:liga/resultados` | partidas já disputadas |
| `/:liga/proximos` | próximas partidas |
| `/:liga/classificacao` | tabela, com as zonas pintadas |
| `/:liga/artilharia` | artilheiros |
| `/:liga/cartoes` | cartões |
| `/:liga/partida/:id/lances` | linha do tempo e ficha da partida |
| `/:liga/partida/:id/escalacao` | escalação das duas equipes |

`:liga` é uma das chaves de `src/api/leagues.js`: `bra1`, `bra2`, `bra3`,
`eng1`, `esp1`, `ita1`, `ger1`, `fra1`.

## Organização

```
src/
├─ api/          dados da ESPN: partidas, escalação, classificação, estatísticas
├─ store/        cache das partidas e o contexto que alimenta as telas
├─ components/   um componente por peça, cada um com o próprio .css
├─ pages/        uma tela por rota
├─ styles/       reset, variáveis e o que é usado por mais de um componente
└─ routes.js     o mapa das telas
```

## Como os dados são carregados

A resposta de temporada da ESPN passa de 4 MB por liga, contra ~1 KB da janela
ao vivo. Por isso:

- abrir o site busca só a janela ao vivo (±2 dias) da liga aberta;
- a temporada inteira só é baixada quando você abre uma tela que precisa dela
  (Resultados, Próximos, Artilharia, Cartões);
- a classificação vem separada, só na tela dela;
- a escalação é um fetch por partida, feito ao abrir a tela da partida;
- o placar ao vivo é atualizado a cada 30 s na liga aberta e a cada 3 min nas
  demais (só para o indicador da barra), e o polling para quando a aba do
  navegador vai para segundo plano.
