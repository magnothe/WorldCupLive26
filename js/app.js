/* ══════════════════════════════════════════════
   app.js — Estado, abas e atualização automática
   Depende de: api.js, ui.js
   ══════════════════════════════════════════════ */

const LIVE_INTERVAL   = 25 * 1000;        // placares ao vivo
const SEASON_TTL      = 10 * 60 * 1000;   // temporada + classificação
const LIVE_WINDOW_DAY = 2;                // dias antes/depois de hoje

const STORAGE_KEY = 'brasileirao.serie';

/* Cache por série */
const store = Object.fromEntries(LEAGUES.map(l => [l.key, {
    games:       new Map(),   // id -> jogo normalizado
    standings:   null,
    seasonAt:    0,
    standingsAt: 0,
    loading:     false,
    error:       null,
}]));

let activeSerie  = localStorage.getItem(STORAGE_KEY) || 'A';
if (!LEAGUE_BY_KEY[activeSerie]) activeSerie = 'A';

let knownGoals = new Map();   // gameId -> Set(chave do gol)
let seeded     = false;       // evita disparar notificações no 1º carregamento

const el = {
    serieBar:      document.getElementById('serie-bar'),
    displayDate:   document.getElementById('display-date'),
    todaySerie:    document.getElementById('today-serie-label'),
    today:         document.getElementById('today-dashboard'),
    toggleBar:     document.getElementById('toggle-bar'),
    past:          document.getElementById('past-dashboard'),
    upcoming:      document.getElementById('upcoming-dashboard'),
    standings:     document.getElementById('standings-container'),
    standingsLeg:  document.getElementById('standings-legend'),
    scorers:       document.getElementById('scorers-container'),
    countPast:     document.getElementById('count-past'),
    countUpcoming: document.getElementById('count-upcoming'),
    btnPast:       document.getElementById('btn-past'),
    btnUpcoming:   document.getElementById('btn-upcoming'),
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

/** Janela curta (±2 dias) — barata, usada no polling de todas as séries. */
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

/** Temporada completa + classificação da série (com TTL). */
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
        s.standings   = standings;
        s.seasonAt    = Date.now();
        s.standingsAt = Date.now();
        s.error       = null;
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
                        player:    goal.player + (goal.ownGoal ? ' (gol contra)' : ''),
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
   Seletor de série
══════════════════════════════ */

function liveCount(leagueKey) {
    return gamesOf(leagueKey).filter(g => g.live).length;
}

function renderSerieBar() {
    el.serieBar.innerHTML = '';
    LEAGUES.forEach(league => {
        const live = liveCount(league.key);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'serie-btn' + (league.key === activeSerie ? ' active' : '');
        btn.style.setProperty('--btn-c1', league.c1);
        btn.style.setProperty('--btn-c2', league.c2);
        btn.style.setProperty('--btn-glow', league.glow);
        btn.innerHTML =
            `<span class="serie-dot"></span>${esc(league.label)}` +
            (live ? `<span class="serie-live">${live} AO VIVO</span>` : '');
        btn.addEventListener('click', () => selectSerie(league.key));
        el.serieBar.appendChild(btn);
    });
}

function applySerieTheme(league) {
    document.documentElement.style.setProperty('--serie', league.c1);
    document.documentElement.style.setProperty('--serie-soft', league.glow);
}

async function selectSerie(key) {
    if (!LEAGUE_BY_KEY[key]) return;
    activeSerie = key;
    localStorage.setItem(STORAGE_KEY, key);

    renderSerieBar();
    applySerieTheme(LEAGUE_BY_KEY[key]);
    el.today.innerHTML = '<div class="loading">Carregando jogos...</div>';

    await loadSeason(key);
    render();
}

/* ══════════════════════════════
   Abas de seção
══════════════════════════════ */

function toggleSection(key) {
    const section = document.getElementById(`${key}-section`);
    const btn = document.getElementById(`btn-${key}`);
    const visible = section.style.display !== 'none';
    section.style.display = visible ? 'none' : 'block';
    btn.classList.toggle('active', !visible);
}

['past', 'upcoming', 'standings', 'scorers'].forEach(key => {
    document.getElementById(`btn-${key}`).addEventListener('click', () => toggleSection(key));
});

/* ══════════════════════════════
   Render
══════════════════════════════ */

function render() {
    const league = LEAGUE_BY_KEY[activeSerie];
    const s      = store[activeSerie];
    const games  = gamesOf(activeSerie);
    const today  = todayKey();
    const sync   = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    el.todaySerie.textContent = league.label;

    /* Hoje */
    const todays = games.filter(g => g.dateKey === today);
    if (!games.length && s.error) {
        el.today.innerHTML = `<div class="error">Erro ao carregar a ${esc(league.label)}: ${esc(s.error)}</div>`;
    } else if (!games.length && (s.loading || !s.seasonAt)) {
        el.today.innerHTML = '<div class="loading">Carregando jogos...</div>';
    } else if (!games.length) {
        el.today.innerHTML =
            `<div class="no-games">A ESPN não publica partidas da ${esc(league.label)} no momento.<br>
             As demais séries continuam funcionando normalmente.</div>`;
    } else {
        renderCardGrid(todays, el.today, sync, `Nenhum jogo da ${league.label} hoje.`);
    }

    /* Anteriores / próximos */
    const past     = games.filter(g => g.dateKey <  today);
    const upcoming = games.filter(g => g.dateKey >  today);

    el.toggleBar.style.display = 'flex';
    el.countPast.textContent     = past.length;
    el.countUpcoming.textContent = upcoming.length;
    el.btnPast.disabled     = past.length === 0;
    el.btnUpcoming.disabled = upcoming.length === 0;

    renderGroupedByDate(past, el.past, sync, false);
    renderGroupedByDate(upcoming, el.upcoming, sync, true);

    /* Classificação */
    renderStandings(s.standings || [], league, el.standings, el.standingsLeg);

    /* Artilheiros */
    const scorers = computeTopScorers(games);
    const played  = games.some(g => g.state !== 'pre');
    renderTopScorers(scorers, el.scorers, played
        ? `A ESPN não publica os autores dos gols da ${league.label}.`
        : `Nenhum gol registrado ainda na ${league.label}.`);

    renderSerieBar();
}

/* ══════════════════════════════
   Ciclo de vida
══════════════════════════════ */

async function tick() {
    const results = await Promise.allSettled(LEAGUES.map(l => loadLiveWindow(l.key)));
    results.forEach((r, i) => {
        if (r.status === 'rejected') store[LEAGUES[i].key].error = String(r.reason && r.reason.message || r.reason);
    });
    checkGoals();
    render();
}

async function init() {
    el.displayDate.textContent = new Date()
        .toLocaleDateString('pt-BR', {
            timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        .toUpperCase();

    applySerieTheme(LEAGUE_BY_KEY[activeSerie]);
    renderSerieBar();

    await tick();                                   // jogos de hoje das 4 séries
    await loadSeason(activeSerie);                  // temporada da série ativa
    render();

    // demais séries em segundo plano, para trocar de aba sem espera
    LEAGUES.filter(l => l.key !== activeSerie)
           .forEach(l => loadSeason(l.key).then(() => renderSerieBar()));

    setInterval(tick, LIVE_INTERVAL);
    setInterval(() => loadSeason(activeSerie, true).then(render), SEASON_TTL);
}

init();
