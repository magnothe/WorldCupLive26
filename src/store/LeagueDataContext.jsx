/* ──────────────────────────────────────────────
   LeagueDataContext.jsx — Estado global e atualização automática

   Estratégia de carga — a resposta de temporada da ESPN passa de 4 MB por
   liga, contra 1 KB da janela ao vivo. Então:

     • abrir o site busca só a janela ao vivo (±2 dias) da liga ativa;
     • a temporada só é baixada quando você abre uma tela que precisa dela
       (Resultados, Próximos, Artilharia, Cartões) e nunca é rebaixada em
       segundo plano — jogo passado não muda;
     • a classificação vem separada, só na tela dela;
     • o polling ao vivo cobre a liga ativa a cada 30 s e varre as outras a
       cada 3 min, apenas para o pontinho vermelho da barra;
     • com a aba do navegador em segundo plano, o polling para.
   ────────────────────────────────────────────── */

import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { LEAGUES, LEAGUE_BY_KEY } from '../api/leagues.js';
import { shiftDateKey, todayKey } from '../api/dates.js';
import { fetchGames, fetchSeason, fetchStandings, fetchLineup } from '../api/espn.js';
import { derivedOf, gamesOf, knownGoals, mergeGames, NEEDS_SEASON, store } from './gameStore.js';

const LIVE_INTERVAL   = 30 * 1000;        // liga ativa
const SWEEP_INTERVAL  = 3 * 60 * 1000;    // demais ligas (só o indicador ao vivo)
const SEASON_TTL      = 30 * 60 * 1000;
const STANDINGS_TTL   = 5 * 60 * 1000;
const LIVE_WINDOW_DAY = 2;                // dias antes/depois de hoje

const LeagueDataContext = createContext(null);

export function LeagueDataProvider({ children }) {
    const [, bump] = useReducer(x => x + 1, 0);

    const [activeLeague, setActiveLeague] = useState(LEAGUES[0].key);
    const [activeTab,    setActiveTab]    = useState('today');
    const [syncLabel,    setSyncLabel]    = useState('sincronizando');
    const [lineups,      setLineups]      = useState(() => new Map());
    const [notifications, setNotifications] = useState([]);

    const seeded  = useRef(false);   // evita disparar notificações no 1º carregamento
    const leagueRef = useRef(activeLeague);
    leagueRef.current = activeLeague;

    /* ── Notificações de gol ── */

    const dismissNotification = useCallback(id => {
        setNotifications(list => list.filter(n => n.id !== id));
    }, []);

    const pushNotification = useCallback(notif => {
        setNotifications(list => [...list, { ...notif, id: `${Date.now()}-${Math.random()}` }]);
    }, []);

    /** Só as partidas em andamento interessam — não vale varrer a temporada. */
    const checkGoals = useCallback(keys => {
        keys.forEach(key => {
            gamesOf(key).filter(g => g.live).forEach(game => {
                const seen = knownGoals.get(game.id) || new Set();
                const teamById = { [game.home.id]: game.home, [game.away.id]: game.away };

                game.goals.forEach((goal, i) => {
                    const gk = `${goal.teamId}|${goal.minute}|${goal.player}|${i}`;
                    if (seen.has(gk)) return;
                    seen.add(gk);

                    const team = teamById[goal.teamId];
                    if (seeded.current && team) {
                        pushNotification({
                            player:    goal.player + (goal.ownGoal ? ' (contra)' : ''),
                            teamName:  team.name,
                            crest:     team.crest,
                            leagueKey: key,
                        });
                    }
                });

                knownGoals.set(game.id, seen);
            });
        });
        seeded.current = true;
    }, [pushNotification]);

    /* ── Carregamento ── */

    /** Janela curta (±2 dias) — ~1 KB, é o que roda no polling. */
    const loadLiveWindow = useCallback(async leagueKey => {
        const today = todayKey();
        const games = await fetchGames(
            leagueKey,
            shiftDateKey(today, -LIVE_WINDOW_DAY),
            shiftDateKey(today, +LIVE_WINDOW_DAY),
        );
        return mergeGames(leagueKey, games);
    }, []);

    /** Temporada inteira (~4 MB). Só sob demanda, e sem recarga em segundo plano. */
    const ensureSeason = useCallback(async leagueKey => {
        const s = store[leagueKey];
        if (s.seasonLoading || Date.now() - s.seasonAt < SEASON_TTL) return;

        s.seasonLoading = true;
        bump();
        try {
            mergeGames(leagueKey, await fetchSeason(leagueKey));
            s.seasonAt = Date.now();
            s.error = null;
        } catch (err) {
            s.error = err.message || String(err);
        } finally {
            s.seasonLoading = false;
            bump();
        }
    }, []);

    /** Classificação (~30 KB). Independente da temporada. */
    const ensureStandings = useCallback(async leagueKey => {
        const s = store[leagueKey];
        if (s.standingsLoading || (s.standings && Date.now() - s.standingsAt < STANDINGS_TTL)) return;

        s.standingsLoading = true;
        bump();
        try {
            s.standings   = await fetchStandings(leagueKey);
            s.standingsAt = Date.now();
        } catch (err) {
            s.error = err.message || String(err);
        } finally {
            s.standingsLoading = false;
            bump();
        }
    }, []);

    /** Busca o que a tela atual precisa — e nada além disso. */
    const ensureDataForTab = useCallback((leagueKey, tab) => {
        if (NEEDS_SEASON.has(tab)) return ensureSeason(leagueKey);
        if (tab === 'standings')   return ensureStandings(leagueKey);
        return Promise.resolve();
    }, [ensureSeason, ensureStandings]);

    /** Atualiza a janela ao vivo das ligas pedidas. Redesenha só se mudou algo. */
    const tick = useCallback(async keys => {
        const results = await Promise.allSettled(keys.map(k => loadLiveWindow(k)));

        let changed = false;
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                store[keys[i]].error = String((r.reason && r.reason.message) || r.reason);
                changed = true;
            } else if (r.value) {
                changed = true;
            }
        });

        checkGoals(keys);
        setSyncLabel('atualizado ' + new Date().toLocaleTimeString('pt-BR', { hour12: false }));
        if (changed) bump();
        return changed;
    }, [checkGoals, loadLiveWindow]);

    /* ── Escalação (um fetch por partida, ~200 KB) ── */

    const loadLineup = useCallback(async game => {
        setLineups(prev => {
            const cur = prev.get(game.id);
            if (cur && (cur.loading || (cur.data && !game.live))) return prev;
            const next = new Map(prev);
            next.set(game.id, { loading: true });
            return next;
        });

        try {
            const data = await fetchLineup(game.league, game.id);
            setLineups(prev => new Map(prev).set(game.id, { data }));
        } catch (err) {
            setLineups(prev => new Map(prev).set(game.id, { error: err.message || String(err) }));
        }
    }, []);

    /* ── Ciclo de vida ── */

    // A tela aberta manda no que é buscado.
    useEffect(() => {
        let alive = true;
        (async () => {
            await tick([activeLeague]);
            if (!alive) return;
            await ensureDataForTab(activeLeague, activeTab);
        })();
        return () => { alive = false; };
    }, [activeLeague, activeTab, tick, ensureDataForTab]);

    // As outras ligas, só para o indicador ao vivo da barra, e o polling.
    useEffect(() => {
        const allKeys = () => LEAGUES.map(l => l.key);
        tick(allKeys());

        // Aba em segundo plano não precisa de polling.
        const live  = setInterval(() => { if (!document.hidden) tick([leagueRef.current]); }, LIVE_INTERVAL);
        const sweep = setInterval(() => { if (!document.hidden) tick(allKeys()); }, SWEEP_INTERVAL);

        const onVisible = () => { if (!document.hidden) tick([leagueRef.current]); };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearInterval(live);
            clearInterval(sweep);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [tick]);

    // Cor de acento do campeonato ativo.
    useEffect(() => {
        const league = LEAGUE_BY_KEY[activeLeague];
        if (league) document.documentElement.style.setProperty('--accent', league.accent);
    }, [activeLeague]);

    const value = {
        activeLeague, setActiveLeague,
        activeTab, setActiveTab,
        league: LEAGUE_BY_KEY[activeLeague],
        state: store[activeLeague],
        games: gamesOf(activeLeague),
        gamesOf,
        derivedOf,
        liveCountOf: key => gamesOf(key).filter(g => g.live).length,
        syncLabel,
        ensureSeason,
        lineups,
        loadLineup,
        notifications,
        dismissNotification,
        refresh: () => tick([activeLeague]),
    };

    return <LeagueDataContext.Provider value={value}>{children}</LeagueDataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLeagueData() {
    const ctx = useContext(LeagueDataContext);
    if (!ctx) throw new Error('useLeagueData precisa estar dentro de <LeagueDataProvider>');
    return ctx;
}
