/* ══════════════════════════════════════════════
   app.js — Estado, navegação e atualização automática
   Depende de: api.js, ui.js

   Estratégia de carga — a resposta de temporada da ESPN passa de 4 MB por
   liga, contra 1 KB da janela ao vivo. Então:

     • abrir o site busca só a janela ao vivo (±2 dias) da liga ativa;
     • a temporada só é baixada quando você abre uma aba que precisa dela
       (Resultados, Próximos, Artilharia, Cartões) e nunca é rebaixada em
       segundo plano — jogo passado não muda;
     • a classificação vem separada, só na aba dela;
     • o polling ao vivo cobre a liga ativa a cada 30 s e varre as outras a
       cada 3 min, apenas para o pontinho vermelho da barra;
     • com a aba do navegador em segundo plano, o polling para.
   ══════════════════════════════════════════════ */

const LIVE_INTERVAL  = 30 * 1000;        // liga ativa
const SWEEP_INTERVAL = 3 * 60 * 1000;    // demais ligas (só o indicador ao vivo)
const SEASON_TTL     = 30 * 60 * 1000;
const STANDINGS_TTL  = 5 * 60 * 1000;
const LIVE_WINDOW_DAY = 2;               // dias antes/depois de hoje
const PAGE_SIZE       = 40;              // partidas por página nas listas longas

const STORAGE_LEAGUE = 'footballlive.league';
const STORAGE_TAB    = 'footballlive.tab';

/* Cache por campeonato */
const store = Object.fromEntries(LEAGUES.map(l => [l.key, {
    games:   new Map(),   // id -> jogo normalizado
    sorted:  null,        // memo de gamesOf()
    version: 0,           // sobe quando algum jogo muda de verdade

    seasonAt:  0, seasonLoading:  false,
    standings: null, standingsAt: 0, standingsLoading: false,

    derived: { version: -1, scorers: null, cards: null },
    error:   null,
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

/** Abas que dependem da temporada inteira. */
const NEEDS_SEASON = new Set(['past', 'upcoming', 'scorers', 'cards']);

let activeTab = localStorage.getItem(STORAGE_TAB) || 'today';
if (!TABS.some(t => t.id === activeTab)) activeTab = 'today';

let pageLimit = PAGE_SIZE;

const openPanel  = new Map();   // gameId -> 'detail' | 'lineup'
const lineups    = new Map();   // gameId -> { loading } | { error } | { data }
const knownGoals = new Map();   // gameId -> Set(chave do gol)
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
   Cache de partidas
══════════════════════════════ */

/** Só o que muda durante uma partida — usada para detectar atualização real. */
function gameSignature(g) {
    return `${g.state}|${g.clock}|${g.home.score}|${g.away.score}|${g.goals.length}|${g.cards.length}`;
}

/**
 * Funde as partidas recebidas no cache. Devolve `true` se alguma coisa mudou —
 * assim o polling não redesenha a tela quando a resposta veio idêntica.
 */
function mergeGames(leagueKey, games) {
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

function gamesOf(leagueKey) {
    const s = store[leagueKey];
    if (!s.sorted) s.sorted = [...s.games.values()].sort((a, b) => a.date - b.date);
    return s.sorted;
}

/** Artilharia e cartões percorrem a temporada inteira — memorizados por versão. */
function derivedOf(leagueKey, what) {
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

/* ══════════════════════════════
   Carregamento
══════════════════════════════ */

/** Janela curta (±2 dias) — ~1 KB, é o que roda no polling. */
async function loadLiveWindow(leagueKey) {
    const today = todayKey();
    const games = await fetchGames(
        leagueKey,
        shiftDateKey(today, -LIVE_WINDOW_DAY),
        shiftDateKey(today, +LIVE_WINDOW_DAY),
    );
    return mergeGames(leagueKey, games);
}

/** Temporada inteira (~4 MB). Só sob demanda, e sem recarga em segundo plano. */
async function ensureSeason(leagueKey) {
    const s = store[leagueKey];
    if (s.seasonLoading || Date.now() - s.seasonAt < SEASON_TTL) return;

    s.seasonLoading = true;
    scheduleRender();
    try {
        mergeGames(leagueKey, await fetchSeason(leagueKey));
        s.seasonAt = Date.now();
        s.error = null;
    } catch (err) {
        s.error = err.message || String(err);
    } finally {
        s.seasonLoading = false;
        scheduleRender();
    }
}

/** Classificação (~30 KB). Independente da temporada. */
async function ensureStandings(leagueKey) {
    const s = store[leagueKey];
    if (s.standingsLoading || (s.standings && Date.now() - s.standingsAt < STANDINGS_TTL)) return;

    s.standingsLoading = true;
    scheduleRender();
    try {
        s.standings   = await fetchStandings(leagueKey);
        s.standingsAt = Date.now();
    } catch (err) {
        s.error = err.message || String(err);
    } finally {
        s.standingsLoading = false;
        scheduleRender();
    }
}

/** Busca o que a aba atual precisa — e nada além disso. */
function ensureDataForTab(leagueKey, tab) {
    if (NEEDS_SEASON.has(tab))   return ensureSeason(leagueKey);
    if (tab === 'standings')     return ensureStandings(leagueKey);
    return Promise.resolve();
}

/* ══════════════════════════════
   Notificações de gol
══════════════════════════════ */

/** Só as partidas em andamento interessam — não vale varrer a temporada. */
function checkGoals(leagueKeys) {
    leagueKeys.forEach(key => {
        gamesOf(key).filter(g => g.live).forEach(game => {
            const seen = knownGoals.get(game.id) || new Set();
            const teamById = { [game.home.id]: game.home, [game.away.id]: game.away };

            game.goals.forEach((goal, i) => {
                const gk = `${goal.teamId}|${goal.minute}|${goal.player}|${i}`;
                if (seen.has(gk)) return;
                seen.add(gk);

                const team = teamById[goal.teamId];
                if (seeded && team) {
                    showGoalNotif({
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
    seeded = true;
}

/* ══════════════════════════════
   Navegação — campeonatos
══════════════════════════════ */

function liveCount(leagueKey) {
    return gamesOf(leagueKey).filter(g => g.live).length;
}

/* A barra só é remontada quando muda de verdade — ela é redesenhada em todo
   render, e recriar 8 botões a cada 30 s é desperdício puro. */
let navSignature = '';

function renderLeagueNav() {
    const signature = activeLeague + '|' + LEAGUES.map(l => liveCount(l.key)).join(',');
    if (signature === navSignature) return;
    navSignature = signature;

    el.leagueNav.innerHTML = '';
    const frag = document.createDocumentFragment();

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

        frag.appendChild(wrap);
    });

    el.leagueNav.appendChild(frag);
}

async function selectLeague(key) {
    if (!LEAGUE_BY_KEY[key] || key === activeLeague) return;
    activeLeague = key;
    localStorage.setItem(STORAGE_LEAGUE, key);
    openPanel.clear();
    pageLimit = PAGE_SIZE;

    document.documentElement.style.setProperty('--accent', LEAGUE_BY_KEY[key].accent);
    render();

    await Promise.all([tick([key]), ensureDataForTab(key, activeTab)]);
    scheduleRender();
}

/* ══════════════════════════════
   Navegação — abas
══════════════════════════════ */

function renderTabs() {
    const s     = store[activeLeague];
    const games = gamesOf(activeLeague);
    const today = todayKey();

    // Sem a temporada carregada, os totais de Resultados/Próximos seriam
    // apenas o que veio na janela ao vivo — melhor não mostrar número algum.
    const hasSeason = s.seasonAt > 0;
    const count = {
        today:    games.filter(g => g.dateKey === today).length,
        past:     hasSeason ? games.filter(g => g.dateKey < today).length : null,
        upcoming: hasSeason ? games.filter(g => g.dateKey > today).length : null,
    };

    el.tabs.innerHTML = '';
    const frag = document.createDocumentFragment();

    TABS.forEach(tab => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab' + (tab.id === activeTab ? ' active' : '');
        btn.setAttribute('aria-selected', tab.id === activeTab);
        btn.innerHTML = esc(tab.label) +
            (count[tab.id] != null ? `<span class="tab-count">${count[tab.id]}</span>` : '');
        btn.addEventListener('click', () => selectTab(tab.id));
        frag.appendChild(btn);
    });

    el.tabs.appendChild(frag);
}

async function selectTab(id) {
    if (id === activeTab) return;
    activeTab = id;
    pageLimit = PAGE_SIZE;
    localStorage.setItem(STORAGE_TAB, id);
    render();

    await ensureDataForTab(activeLeague, id);
    scheduleRender();
}

function showActiveView() {
    document.querySelectorAll('.view').forEach(view => {
        view.hidden = view.dataset.tab !== activeTab;
    });
}

/* ══════════════════════════════
   Render
══════════════════════════════ */

/**
 * A escalação é um fetch por partida (~200 KB), então só sai quando o painel
 * é aberto. O cache fica em api.js; aqui guardamos apenas o estado da tela.
 */
async function loadLineup(game) {
    const cur = lineups.get(game.id);
    if (cur && (cur.loading || (cur.data && !game.live))) return;

    lineups.set(game.id, { loading: true });
    scheduleRender();
    try {
        lineups.set(game.id, { data: await fetchLineup(game.league, game.id) });
    } catch (err) {
        lineups.set(game.id, { error: err.message || String(err) });
    }
    scheduleRender();
}

/** Abre o painel pedido; clicar no botão do painel aberto fecha a partida. */
function togglePanel(game, mode) {
    if (openPanel.get(game.id) === mode) {
        openPanel.delete(game.id);
    } else {
        openPanel.set(game.id, mode);
        if (mode === 'lineup') loadLineup(game);
    }
    render();
}

const ctx = {
    panelOf:  id => openPanel.get(id) || null,
    lineupOf: id => lineups.get(id) || null,
    onToggle: togglePanel,
    pageSize: PAGE_SIZE,
    get limit() { return pageLimit; },
    onMore() { pageLimit += PAGE_SIZE; render(); },
};

/* Um render por quadro, no máximo. Vários caminhos (polling, fim de fetch,
   clique) podem pedir redesenho ao mesmo tempo. */
let renderQueued = false;
function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
}

function renderLead(league, games, todays) {
    const live = todays.filter(g => g.live).length;
    el.leadTitle.textContent = league.label;

    const parts = [];
    if (live) parts.push(`${live} ${live === 1 ? 'jogo' : 'jogos'} ao vivo`);
    parts.push(todays.length
        ? `${todays.length} ${todays.length === 1 ? 'jogo hoje' : 'jogos hoje'}`
        : 'nenhum jogo hoje');
    if (store[league.key].seasonAt) parts.push(`${games.length} na temporada`);

    el.leadSub.textContent = parts.join(' · ');
    el.leadSub.classList.toggle('has-live', live > 0);
}

function render() {
    const league = LEAGUE_BY_KEY[activeLeague];
    const s      = store[activeLeague];
    const games  = gamesOf(activeLeague);
    const today  = todayKey();
    const todays = games.filter(g => g.dateKey === today);

    const busy    = s.seasonLoading || s.standingsLoading;
    const loading = `<p class="empty">Carregando…</p>`;

    renderLead(league, games, todays);
    renderTabs();
    showActiveView();

    switch (activeTab) {
        case 'today':
            if (!games.length && s.error) {
                el.today.innerHTML = `<p class="empty is-error">Erro ao carregar ${esc(league.label)}: ${esc(s.error)}</p>`;
            } else if (!games.length && busy) {
                el.today.innerHTML = loading;
            } else {
                renderMatchGrid(todays, el.today, ctx, `Nenhum jogo de ${league.label} hoje.`);
            }
            break;

        case 'past':
            if (busy && !s.seasonAt) el.past.innerHTML = loading;
            else renderGroupedByDate(games.filter(g => g.dateKey < today), el.past, ctx, false);
            break;

        case 'upcoming':
            if (busy && !s.seasonAt) el.upcoming.innerHTML = loading;
            else renderGroupedByDate(games.filter(g => g.dateKey > today), el.upcoming, ctx, true);
            break;

        case 'standings':
            if (s.standingsLoading && !s.standings) el.standings.innerHTML = loading;
            else renderStandings(s.standings || [], league, el.standings, el.standingsLeg);
            break;

        case 'scorers':
            if (busy && !s.seasonAt) el.scorers.innerHTML = loading;
            else renderTopScorers(derivedOf(activeLeague, 'scorers'), el.scorers,
                `A ESPN não publica os autores dos gols de ${league.label}.`);
            break;

        case 'cards':
            if (busy && !s.seasonAt) el.cards.innerHTML = loading;
            else renderCardLeaders(derivedOf(activeLeague, 'cards'), el.cards,
                `A ESPN não publica os cartões de ${league.label}.`);
            break;
    }

    renderLeagueNav();
}

/* ══════════════════════════════
   Ciclo de vida
══════════════════════════════ */

/** Atualiza a janela ao vivo das ligas pedidas. Redesenha só se mudou algo. */
async function tick(leagueKeys) {
    const keys = leagueKeys || [activeLeague];
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
    el.syncLabel.textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR', { hour12: false });
    if (changed) scheduleRender();
    return changed;
}

const allKeys = () => LEAGUES.map(l => l.key);

async function init() {
    el.todayLabel.textContent = new Date().toLocaleDateString('pt-BR', {
        timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    document.documentElement.style.setProperty('--accent', LEAGUE_BY_KEY[activeLeague].accent);
    render();

    // 1. liga ativa primeiro — é o que aparece na tela
    await tick([activeLeague]);
    // 2. o que a aba aberta precisa
    await ensureDataForTab(activeLeague, activeTab);
    scheduleRender();
    // 3. as outras ligas, só para o indicador ao vivo da barra
    tick(allKeys());

    // Aba em segundo plano não precisa de polling.
    setInterval(() => { if (!document.hidden) tick([activeLeague]); }, LIVE_INTERVAL);
    setInterval(() => { if (!document.hidden) tick(allKeys()); },      SWEEP_INTERVAL);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) tick([activeLeague]);
    });
}

init();
