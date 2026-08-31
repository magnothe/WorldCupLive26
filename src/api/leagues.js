/* ──────────────────────────────────────────────
   leagues.js — Catálogo de campeonatos

   `season: 'year'`  → temporada = ano civil (Brasil, jan–dez)
   `season: 'cross'` → temporada cruza o ano (Europa, ago–mai)

   As zonas de rebaixamento são declaradas pelo tamanho (`from`/`to` a partir
   do topo), mas ancoradas no FIM da tabela na hora de pintar — assim a mesma
   configuração serve para tabelas de 18 e de 20 times.
   ────────────────────────────────────────────── */

/* Escudo genérico (SVG inline) para quando a API não devolve logo */
export const CREST_FALLBACK =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
           <path d="M32 5 9 13v20c0 13.5 9.4 22.3 23 25 13.6-2.7 23-11.5 23-25V13L32 5z"
                 fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
         </svg>`
    );

export const LEAGUES = [
    /* ── Brasil ── */
    {
        key: 'bra1', slug: 'bra.1', group: 'Brasil',
        label: 'Brasileirão Série A', short: 'Série A',
        accent: '#29c46a', season: 'year',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-champions',  label: 'Libertadores (fase de grupos)' },
            { from: 5,  to: 6,  cls: 'zone-prelib',     label: 'Pré-Libertadores'              },
            { from: 7,  to: 12, cls: 'zone-secondary',  label: 'Sul-Americana'                 },
            { from: 17, to: 20, cls: 'zone-relegation', label: 'Rebaixamento'                  },
        ],
    },
    {
        key: 'bra2', slug: 'bra.2', group: 'Brasil',
        label: 'Brasileirão Série B', short: 'Série B',
        accent: '#4d8df6', season: 'year',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-champions',  label: 'Acesso à Série A' },
            { from: 17, to: 20, cls: 'zone-relegation', label: 'Rebaixamento'     },
        ],
    },
    {
        key: 'bra3', slug: 'bra.3', group: 'Brasil',
        label: 'Brasileirão Série C', short: 'Série C',
        accent: '#e0a33a', season: 'year',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-champions',  label: 'Classificado' },
            { from: 17, to: 20, cls: 'zone-relegation', label: 'Rebaixamento' },
        ],
        groupZones: [
            { from: 1, to: 2, cls: 'zone-champions', label: 'Classificado' },
        ],
    },

    /* ── Europa ── */
    {
        key: 'eng1', slug: 'eng.1', group: 'Europa',
        label: 'Premier League', short: 'Premier',
        accent: '#8b5cf6', season: 'cross',
        zones: [
            { from: 1,  to: 5,  cls: 'zone-champions',  label: 'Champions League' },
            { from: 6,  to: 7,  cls: 'zone-secondary',  label: 'Europa League'    },
            { from: 18, to: 20, cls: 'zone-relegation', label: 'Rebaixamento'     },
        ],
    },
    {
        key: 'esp1', slug: 'esp.1', group: 'Europa',
        label: 'La Liga', short: 'La Liga',
        accent: '#e4572e', season: 'cross',
        zones: [
            { from: 1,  to: 5,  cls: 'zone-champions',  label: 'Champions League' },
            { from: 6,  to: 7,  cls: 'zone-secondary',  label: 'Europa League'    },
            { from: 18, to: 20, cls: 'zone-relegation', label: 'Rebaixamento'     },
        ],
    },
    {
        key: 'ita1', slug: 'ita.1', group: 'Europa',
        label: 'Serie A', short: 'Serie A',
        accent: '#2bb3a3', season: 'cross',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-champions',  label: 'Champions League' },
            { from: 5,  to: 6,  cls: 'zone-secondary',  label: 'Europa League'    },
            { from: 18, to: 20, cls: 'zone-relegation', label: 'Rebaixamento'     },
        ],
    },
    {
        key: 'ger1', slug: 'ger.1', group: 'Europa',
        label: 'Bundesliga', short: 'Bundesliga',
        accent: '#e03131', season: 'cross',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-champions',  label: 'Champions League' },
            { from: 5,  to: 6,  cls: 'zone-secondary',  label: 'Europa League'    },
            { from: 17, to: 18, cls: 'zone-relegation', label: 'Rebaixamento'     },
        ],
    },
    {
        key: 'fra1', slug: 'fra.1', group: 'Europa',
        label: 'Ligue 1', short: 'Ligue 1',
        accent: '#4361ee', season: 'cross',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-champions',  label: 'Champions League' },
            { from: 5,  to: 6,  cls: 'zone-secondary',  label: 'Europa League'    },
            { from: 17, to: 18, cls: 'zone-relegation', label: 'Rebaixamento'     },
        ],
    },
];

export const LEAGUE_BY_KEY = Object.fromEntries(LEAGUES.map(l => [l.key, l]));

/** [{ name: 'Brasil', leagues: [...] }, { name: 'Europa', leagues: [...] }] */
export const LEAGUE_GROUPS = LEAGUES.reduce((acc, league) => {
    let g = acc.find(x => x.name === league.group);
    if (!g) acc.push(g = { name: league.group, leagues: [] });
    g.leagues.push(league);
    return acc;
}, []);
