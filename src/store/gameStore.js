/* ──────────────────────────────────────────────
   gameStore.js — Cache de partidas, fora do React

   Fica fora dos componentes de propósito: trocar de tela não pode jogar fora
   o que já foi baixado (a temporada de uma liga passa de 4 MB).
   ────────────────────────────────────────────── */

import { LEAGUES } from '../api/leagues.js';
import { computeCardLeaders, computeTopScorers } from '../api/stats.js';

/** Telas que dependem da temporada inteira. */
export const NEEDS_SEASON = new Set(['past', 'upcoming', 'scorers', 'cards']);

export const store = Object.fromEntries(LEAGUES.map(l => [l.key, {
    games:   new Map(),   // id -> jogo normalizado
    sorted:  null,        // memo de gamesOf()
    version: 0,           // sobe quando algum jogo muda de verdade

    seasonAt: 0, seasonLoading: false,
    standings: null, standingsAt: 0, standingsLoading: false,

    derived: { version: -1, scorers: null, cards: null },
    error: null,
}]));

/** gameId -> Set(chave do gol) — base das notificações. */
export const knownGoals = new Map();

/** Só o que muda durante uma partida — usada para detectar atualização real. */
function gameSignature(g) {
    return `${g.state}|${g.clock}|${g.home.score}|${g.away.score}|${g.goals.length}|${g.cards.length}`;
}

/**
 * Funde as partidas recebidas no cache. Devolve `true` se alguma coisa mudou —
 * assim o polling não redesenha a tela quando a resposta veio idêntica.
 */
export function mergeGames(leagueKey, games) {
    const s = store[leagueKey];
    let changed = false;

    games.forEach(g => {
        const old = s.games.get(g.id);
        if (!old || gameSignature(old) !== gameSignature(g)) {
            s.games.set(g.id, g);
            changed = true;
        }
        // sem mudança: mantém o objeto antigo, preservando a linha do tempo
        // já montada por matchTimeline()
    });

    if (changed) {
        s.sorted = null;
        s.version++;
    }
    return changed;
}

export function gamesOf(leagueKey) {
    const s = store[leagueKey];
    if (!s.sorted) s.sorted = [...s.games.values()].sort((a, b) => a.date - b.date);
    return s.sorted;
}

/** Artilharia e cartões percorrem a temporada inteira — memorizados por versão. */
export function derivedOf(leagueKey, what) {
    const s = store[leagueKey];
    if (s.derived.version !== s.version) {
        s.derived = { version: s.version, scorers: null, cards: null };
    }
    if (!s.derived[what]) {
        s.derived[what] = what === 'scorers'
            ? computeTopScorers(gamesOf(leagueKey))
            : computeCardLeaders(gamesOf(leagueKey));
    }
    return s.derived[what];
}
