/* ──────────────────────────────────────────────
   routes.js — As telas do site e seus endereços

   Cada aba do projeto original virou uma tela com URL própria:
     /bra1/hoje  /bra1/resultados  /eng1/classificacao ...
   ────────────────────────────────────────────── */

export const TABS = [
    { id: 'today',     path: 'hoje',          label: 'Hoje'          },
    { id: 'past',      path: 'resultados',    label: 'Resultados'    },
    { id: 'upcoming',  path: 'proximos',      label: 'Próximos'      },
    { id: 'standings', path: 'classificacao', label: 'Classificação' },
    { id: 'scorers',   path: 'artilharia',    label: 'Artilharia'    },
    { id: 'cards',     path: 'cartoes',       label: 'Cartões'       },
];

export const TAB_BY_PATH = Object.fromEntries(TABS.map(t => [t.path, t]));
export const TAB_BY_ID   = Object.fromEntries(TABS.map(t => [t.id, t]));

/** Endereço de uma tela: pathFor('bra1', 'standings') → '/bra1/classificacao' */
export function pathFor(leagueKey, tabId) {
    const tab = TAB_BY_ID[tabId] || TABS[0];
    return `/${leagueKey}/${tab.path}`;
}
