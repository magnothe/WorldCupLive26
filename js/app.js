/* ══════════════════════════════════════════════
   app.js — Estado, navegação e atualização automática
   Depende de: api.js, ui.js
   ══════════════════════════════════════════════ */

const LIVE_INTERVAL   = 30 * 1000;        // placares ao vivo
const SEASON_TTL      = 10 * 60 * 1000;   // temporada + classificação
const LIVE_WINDOW_DAY = 2;                // dias antes/depois de hoje

const STORAGE_LEAGUE = 'footballlive.league';
const STORAGE_TAB    = 'footballlive.tab';

/* Cache por campeonato */
const store = Object.fromEntries(LEAGUES.map(l => [l.key, {
    games:    new Map(),   // id -> jogo normalizado
    standings: null,
    seasonAt:  0,
    loading:   false,
    error:     null,
}]));

let activeLeague = localStorage.getItem(STORAGE_LEAGUE) || 'bra1';
if (!LEAGUE_BY_KEY[activeLeague]) activeLeague = 'bra1';

const TABS = [
    { id: 'today',     label: 'Hoje'          },
    { id: 'past',      label: 'Resultados'    },
    { id: 'upcoming',  label: 'Próximos'      },
    { id: 'standings', label: 'Classificação' },
    { id: 'scorers',   label: 'Artilharia'    },
    { id: 'cards',     label: 'Cartões'       },
];

let activeTab = localStorage.getItem(STORAGE_TAB) || 'today';
if (!TABS.some(t => t.id === activeTab)) activeTab = 'today';

const expanded   = new Set();   // ids de partidas com os lances abertos
let   knownGoals = new Map();   // gameId -> Set(chave do gol)
let   seeded     = false;       // evita disparar notificações no 1º carregamento

const el = {
    leagueNav:    document.getElementById('league-nav'),
    tabs:         document.getElementById('tabs'),
    todayLabel:   document.getElementById('today-label'),
    syncLabel:    document.getElementById('sync-label'),
    leadTitle:    document.getElementById('lead-title'),
    leadSub:      document.getElementById('lead-sub'),
    today:        document.getElementById('view-today'),
    past:         document.getElementById('view-past'),
    upcoming:     document.getElementById('view-upcoming'),
    standings:    document.getElementById('standings-container'),
    standingsLeg: document.getElementById('standings-legend'),
    scorers:      document.getElementById('scorers-container'),
    cards:        document.getElementById('cards-container'),
};

/* ══════════════════════════════
   Datas
══════════════════════════════ */

function shiftDateKey(key, days) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

const todayKey = () => brDateKey(new Date());

/* ══════════════════════════════
   Carregamento
══════════════════════════════ */

function mergeGames(leagueKey, games) {
    const bucket = store[leagueKey].games;
    games.forEach(g => bucket.set(g.id, g));
}

function gamesOf(leagueKey) {
    return [...store[leagueKey].games.values()].sort((a, b) => a.date - b.date);
}

/** Janela curta (±2 dias) — barata, usada no polling de todos os campeonatos. */
async function loadLiveWindow(leagueKey) {
    const today = todayKey();
    const games = await fetchGames(
        leagueKey,
        shiftDateKey(today, -LIVE_WINDOW_DAY),
        shiftDateKey(today, +LIVE_WINDOW_DAY),
    );
    mergeGames(leagueKey, games);
    return games;
}

/** Temporada completa + classificação do campeonato (com TTL). */
async function loadSeason(leagueKey, force) {
    const s = store[leagueKey];
    const fresh = Date.now() - s.seasonAt < SEASON_TTL;
    if (s.loading || (fresh && !force)) return;

    s.loading = true;
    try {
        const [season, standings] = await Promise.all([
            fetchSeason(leagueKey),
            fetchStandings(leagueKey),
        ]);
        mergeGames(leagueKey, season);
        s.standings = standings;
        s.seasonAt  = Date.now();
        s.error     = null;
    } catch (err) {
        s.error = err.message || String(err);
    } finally {
        s.loading = false;
    }
}

/* ══════════════════════════════
   Notificações de gol
══════════════════════════════ */

function checkGoals() {
    LEAGUES.forEach(league => {
        gamesOf(league.key).forEach(game => {
            if (game.state === 'pre') return;

            const seen = knownGoals.get(game.id) || new Set();
            const teamById = { [game.home.id]: game.home, [game.away.id]: game.away };

            game.goals.forEach((goal, i) => {
                const key = `${goal.teamId}|${goal.minute}|${goal.player}|${i}`;
                if (seen.has(key)) return;
                seen.add(key);

                const team = teamById[goal.teamId];
                if (seeded && game.live && team) {
                    showGoalNotif({
                        player:    goal.player + (goal.ownGoal ? ' (contra)' : ''),
                        teamName:  team.name,
                        crest:     team.crest,
                        leagueKey: league.key,
                    });
                }
            });

            knownGoals.set(game.id, seen);
        });
    });
    seeded = true;
}

/* ══════════════════════════════
   Navegação — campeonatos
══════════════════════════════ */

function liveCount(leagueKey) {
    return gamesOf(leagueKey).filter(g => g.live).length;
}

function renderLeagueNav() {
    el.leagueNav.innerHTML = '';

    LEAGUE_GROUPS.forEach(group => {
        const wrap = document.createElement('div');
        wrap.className = 'league-group';
        wrap.innerHTML = `<span class="league-group-name">${esc(group.name)}</span>`;

        group.leagues.forEach(league => {
            const live = liveCount(league.key);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'league-btn' + (league.key === activeLeague ? ' active' : '');
            btn.style.setProperty('--accent', league.accent);
            btn.innerHTML = esc(league.short) + (live ? `<span class="live-dot" title="${live} ao vivo"></span>` : '');
            btn.addEventListener('click', () => selectLeague(league.key));
            wrap.appendChild(btn);
        });

        el.leagueNav.appendChild(wrap);
    });
}

async function selectLeague(key) {
    if (!LEAGUE_BY_KEY[key] || key === activeLeague) return;
    activeLeague = key;
    localStorage.setItem(STORAGE_LEAGUE, key);
    expanded.clear();

    document.documentElement.style.setProperty('--accent', LEAGUE_BY_KEY[key].accent);
    renderLeagueNav();
    render();

    await loadSeason(key);
    render();
}

/* ══════════════════════════════
   Navegação — abas
══════════════════════════════ */

function renderTabs() {
    const games = gamesOf(activeLeague);
    const today = todayKey();
    const count = {
        today:    games.filter(g => g.dateKey === today).length,
        past:     games.filter(g => g.dateKey <   today).length,
        upcoming: games.filter(g => g.dateKey >   today).length,
    };

    el.tabs.innerHTML = '';
    TABS.forEach(tab => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab' + (tab.id === activeTab ? ' active' : '');
        btn.setAttribute('aria-selected', tab.id === activeTab);
        btn.innerHTML = esc(tab.label) +
            (count[tab.id] != null ? `<span class="tab-count">${count[tab.id]}</span>` : '');
        btn.addEventListener('click', () => selectTab(tab.id));
        el.tabs.appendChild(btn);
    });
}

function selectTab(id) {
    activeTab = id;
    localStorage.setItem(STORAGE_TAB, id);
    render();
}

function showActiveView() {
    document.querySelectorAll('.view').forEach(view => {
        view.hidden = view.dataset.tab !== activeTab;
    });
}

/* ══════════════════════════════
   Render
══════════════════════════════ */

function toggleMatch(id) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    render();
}

const ctx = { expanded, onToggle: toggleMatch };

function renderLead(league, games, todays) {
    const live = todays.filter(g => g.live).length;
    el.leadTitle.textContent = league.label;

    const parts = [];
    if (live) parts.push(`${live} ${live === 1 ? 'jogo' : 'jogos'} ao vivo`);
    parts.push(todays.length
        ? `${todays.length} ${todays.length === 1 ? 'jogo hoje' : 'jogos hoje'}`
        : 'nenhum jogo hoje');
    if (games.length) parts.push(`${games.length} na temporada`);

    el.leadSub.textContent = parts.join(' · ');
    el.leadSub.classList.toggle('has-live', live > 0);
}

function render() {
    const league = LEAGUE_BY_KEY[activeLeague];
    const s      = store[activeLeague];
    const games  = gamesOf(activeLeague);
    const today  = todayKey();
    const todays = games.filter(g => g.dateKey === today);

    renderLead(league, games, todays);
    renderTabs();
    showActiveView();

    switch (activeTab) {
        case 'today':
            if (!games.length && s.error) {
                el.today.innerHTML = `<p class="empty is-error">Erro ao carregar ${esc(league.label)}: ${esc(s.error)}</p>`;
            } else if (!games.length && (s.loading || !s.seasonAt)) {
                el.today.innerHTML = `<p class="empty">Carregando…</p>`;
            } else if (!games.length) {
                el.today.innerHTML = `<p class="empty">A ESPN não publica partidas de ${esc(league.label)} no momento.</p>`;
            } else {
                renderMatchGrid(todays, el.today, ctx, `Nenhum jogo de ${league.label} hoje.`);
            }
            break;

        case 'past':
            renderGroupedByDate(games.filter(g => g.dateKey < today), el.past, ctx, false);
            break;

        case 'upcoming':
            renderGroupedByDate(games.filter(g => g.dateKey > today), el.upcoming, ctx, true);
            break;

        case 'standings':
            renderStandings(s.standings || [], league, el.standings, el.standingsLeg);
            break;

        case 'scorers': {
            const played = games.some(g => g.state !== 'pre');
            renderTopScorers(computeTopScorers(games), el.scorers, played
                ? `A ESPN não publica os autores dos gols de ${league.label}.`
                : `Nenhum gol registrado ainda em ${league.label}.`);
            break;
        }

        case 'cards': {
            const played = games.some(g => g.state !== 'pre');
            renderCardLeaders(computeCardLeaders(games), el.cards, played
                ? `A ESPN não publica os cartões de ${league.label}.`
                : `Nenhum cartão registrado ainda em ${league.label}.`);
            break;
        }
    }

    renderLeagueNav();
}

/* ══════════════════════════════
   Ciclo de vida
══════════════════════════════ */

async function tick() {
    const results = await Promise.allSettled(LEAGUES.map(l => loadLiveWindow(l.key)));
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            store[LEAGUES[i].key].error = String((r.reason && r.reason.message) || r.reason);
        }
    });
    checkGoals();
    el.syncLabel.textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR', { hour12: false });
    render();
}

async function init() {
    el.todayLabel.textContent = new Date().toLocaleDateString('pt-BR', {
        timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    document.documentElement.style.setProperty('--accent', LEAGUE_BY_KEY[activeLeague].accent);
    renderLeagueNav();
    render();

    await tick();                        // janela ao vivo de todos os campeonatos
    await loadSeason(activeLeague);      // temporada do campeonato ativo
    render();

    setInterval(tick, LIVE_INTERVAL);
    setInterval(() => loadSeason(activeLeague, true).then(render), SEASON_TTL);
}

init();
