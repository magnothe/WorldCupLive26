/* ══════════════════════════════════════════════
   api.js — Camada de dados (ESPN)

   API escolhida: ESPN hidden/public soccer API.
     • Sem chave, sem cadastro, sem limite de requisições
     • Cobre Brasileirão Série A, B, C e D (bra.1 … bra.4)
     • Já devolve os ESCUDOS dos times na própria resposta
       (competitor.team.logo → https://a.espncdn.com/i/teamlogos/soccer/500/{id}.png)

   Endpoints usados:
     Jogos       {host}/apis/site/v2/sports/soccer/{slug}/scoreboard?dates=YYYYMMDD-YYYYMMDD
     Classific.  {host}/apis/v2/sports/soccer/{slug}/standings

   IMPORTANTE — host: use `site.web.api.espn.com`, e NÃO `site.api.espn.com`.
   Os dois servem exatamente os mesmos caminhos, mas `site.api.espn.com` não
   devolve `Access-Control-Allow-Origin` para requisições vindas do navegador,
   o que faz todo fetch falhar com erro de CORS.
   ══════════════════════════════════════════════ */

const ESPN_HOST       = 'https://site.web.api.espn.com';
const SCOREBOARD_BASE = `${ESPN_HOST}/apis/site/v2/sports/soccer`;
const STANDINGS_BASE  = `${ESPN_HOST}/apis/v2/sports/soccer`;

const TZ = 'America/Sao_Paulo';

/* Escudo genérico (SVG inline) para quando a API não devolve logo */
const CREST_FALLBACK =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
           <path d="M32 4 8 12v22c0 14 10 23 24 26 14-3 24-12 24-26V12L32 4z"
                 fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.30)" stroke-width="2"/>
           <text x="32" y="42" font-size="26" text-anchor="middle" fill="rgba(255,255,255,0.45)">⚽</text>
         </svg>`
    );

/* ── As quatro séries ── */
const LEAGUES = [
    {
        key: 'A', slug: 'bra.1', label: 'Série A', short: 'A',
        c1: '#22c55e', c2: '#16a34a', glow: 'rgba(34,197,94,0.40)',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-libertadores', label: 'Libertadores (fase de grupos)' },
            { from: 5,  to: 6,  cls: 'zone-prelib',       label: 'Pré-Libertadores'               },
            { from: 7,  to: 12, cls: 'zone-sudamericana', label: 'Sul-Americana'                  },
            { from: 17, to: 20, cls: 'zone-relegation',   label: 'Rebaixamento'                   },
        ],
    },
    {
        key: 'B', slug: 'bra.2', label: 'Série B', short: 'B',
        c1: '#3b82f6', c2: '#2563eb', glow: 'rgba(59,130,246,0.40)',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-promotion',  label: 'Acesso à Série A' },
            { from: 17, to: 20, cls: 'zone-relegation', label: 'Rebaixamento'     },
        ],
    },
    {
        key: 'C', slug: 'bra.3', label: 'Série C', short: 'C',
        c1: '#f59e0b', c2: '#f97316', glow: 'rgba(245,158,11,0.40)',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-playoff',    label: 'Classificado'  },
            { from: 17, to: 20, cls: 'zone-relegation', label: 'Rebaixamento'  },
        ],
        groupZones: [
            { from: 1, to: 2, cls: 'zone-playoff', label: 'Classificado' },
        ],
    },
    {
        key: 'D', slug: 'bra.4', label: 'Série D', short: 'D',
        c1: '#a78bfa', c2: '#8b5cf6', glow: 'rgba(139,92,246,0.40)',
        zones: [
            { from: 1, to: 2, cls: 'zone-playoff', label: 'Classificado' },
        ],
        groupZones: [
            { from: 1, to: 2, cls: 'zone-playoff', label: 'Classificado' },
        ],
    },
];

const LEAGUE_BY_KEY = Object.fromEntries(LEAGUES.map(l => [l.key, l]));

/* ══════════════════════════════
   Helpers de data (fuso de Brasília)
══════════════════════════════ */

/** "2026-08-11" na timezone de Brasília, a partir de um Date. */
function brDateKey(date) {
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const get = t => p.find(x => x.type === t).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "HH:MM" no fuso de Brasília. */
function brTime(date) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date);
}

/** "segunda-feira, 11 de agosto de 2026" a partir de uma chave "YYYY-MM-DD". */
function brDateLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('pt-BR', {
        timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

/** "YYYYMMDD" — formato aceito pelo parâmetro `dates` da ESPN. */
function espnDate(key) {
    return key.replace(/-/g, '');
}

/* ══════════════════════════════
   Normalização das partidas
══════════════════════════════ */

function normalizeGoals(competition) {
    return (competition.details || [])
        .filter(d => d.scoringPlay && !d.shootout)
        .map(d => ({
            teamId:   String(d.team && d.team.id || ''),
            player:   (d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].displayName) || 'Gol',
            playerId: (d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].id) || null,
            minute:   (d.clock && d.clock.displayValue) || '',
            ownGoal:  !!d.ownGoal,
            penalty:  !!d.penaltyKick,
        }));
}

function normalizeSide(competitor) {
    const t = competitor.team || {};
    return {
        id:     String(t.id || ''),
        name:   t.displayName || t.name || 'A definir',
        short:  t.shortDisplayName || t.name || '',
        abbr:   t.abbreviation || '',
        crest:  t.logo || (t.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${t.id}.png` : CREST_FALLBACK),
        score:  competitor.score != null && competitor.score !== '' ? Number(competitor.score) : null,
        pens:   competitor.shootoutScore != null ? Number(competitor.shootoutScore) : null,
        winner: !!competitor.winner,
    };
}

function normalizeEvent(ev, leagueKey) {
    const comp = (ev.competitions && ev.competitions[0]) || {};
    const competitors = comp.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
    if (!home || !away) return null;

    const status = (ev.status && ev.status.type) || {};
    const date = new Date(ev.date);
    const venue = comp.venue || {};
    const note = (comp.notes && comp.notes[0] && comp.notes[0].headline) || '';

    return {
        id:       String(ev.id),
        league:   leagueKey,
        date,
        dateKey:  brDateKey(date),
        time:     brTime(date),
        state:    status.state || 'pre',          // pre | in | post
        finished: status.state === 'post',
        live:     status.state === 'in',
        clock:    (ev.status && ev.status.displayClock) || '',
        detail:   status.shortDetail || status.description || '',
        note,
        venue:    venue.fullName || '',
        city:     (venue.address && venue.address.city) || '',
        home:     normalizeSide(home),
        away:     normalizeSide(away),
        goals:    normalizeGoals(comp),
    };
}

/* ══════════════════════════════
   Fetch
══════════════════════════════ */

/** Faz a URL variar a cada N segundos, evitando resposta cacheada pelo CDN. */
function cacheBust(seconds) {
    return `_=${Math.floor(Date.now() / (seconds * 1000))}`;
}

async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/**
 * Partidas de uma série num intervalo de datas (chaves "YYYY-MM-DD").
 * Sem `from`/`to` a ESPN devolve apenas a rodada corrente.
 */
async function fetchGames(leagueKey, from, to) {
    const league = LEAGUE_BY_KEY[leagueKey];
    // `limit` é obrigatório: sem ele a ESPN corta a resposta em 100 partidas.
    let url = `${SCOREBOARD_BASE}/${league.slug}/scoreboard?limit=1000&${cacheBust(20)}`;
    if (from && to) url += `&dates=${espnDate(from)}-${espnDate(to)}`;

    const data = await getJSON(url);
    return (data.events || [])
        .map(ev => normalizeEvent(ev, leagueKey))
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
}

/**
 * Temporada inteira de uma série. Séries C e D só acontecem em parte do ano;
 * quando o ano corrente ainda não tem tabela publicada, cai para o anterior.
 */
async function fetchSeason(leagueKey, year) {
    const y = year || new Date().getFullYear();
    const current = await fetchGames(leagueKey, `${y}-01-01`, `${y}-12-31`);
    if (current.length || year) return current;

    try {
        return await fetchGames(leagueKey, `${y - 1}-01-01`, `${y - 1}-12-31`);
    } catch (e) {
        return current;
    }
}

/* ══════════════════════════════
   Classificação
══════════════════════════════ */

function statValue(entry, name) {
    const s = (entry.stats || []).find(x => x.name === name);
    if (!s) return 0;
    const v = s.value != null ? s.value : s.displayValue;
    return Number(v) || 0;
}

function normalizeEntry(entry) {
    const t = entry.team || {};
    const crest = (t.logos && t.logos[0] && t.logos[0].href)
        || (t.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${t.id}.png` : CREST_FALLBACK);
    return {
        id:    String(t.id || ''),
        name:  t.displayName || t.name || '—',
        abbr:  t.abbreviation || '',
        crest,
        pts:   statValue(entry, 'points'),
        mp:    statValue(entry, 'gamesPlayed'),
        w:     statValue(entry, 'wins'),
        d:     statValue(entry, 'ties'),
        l:     statValue(entry, 'losses'),
        gf:    statValue(entry, 'pointsFor'),
        ga:    statValue(entry, 'pointsAgainst'),
        gd:    statValue(entry, 'pointDifferential'),
        rank:  statValue(entry, 'rank'),
    };
}

/** Achata a árvore da ESPN em uma lista de tabelas: [{ name, teams[] }]. */
function flattenStandings(node, out, inheritedName) {
    const name = node.name || inheritedName || '';
    if (node.standings && node.standings.entries && node.standings.entries.length) {
        const teams = node.standings.entries
            .map(normalizeEntry)
            .sort((a, b) => (a.rank || 999) - (b.rank || 999)
                || b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
                || a.name.localeCompare(b.name, 'pt-BR'));
        out.push({ name, teams });
    }
    (node.children || []).forEach(child => flattenStandings(child, out, name));
    return out;
}

/**
 * Classificação de uma série. A ESPN às vezes só publica a tabela da
 * temporada anterior (Série C/D fora de época) — por isso o fallback.
 */
async function fetchStandings(leagueKey) {
    const league = LEAGUE_BY_KEY[leagueKey];
    const year = new Date().getFullYear();

    const bust = cacheBust(120);
    for (const url of [
        `${STANDINGS_BASE}/${league.slug}/standings?${bust}`,
        `${STANDINGS_BASE}/${league.slug}/standings?season=${year - 1}&${bust}`,
    ]) {
        try {
            const tables = flattenStandings(await getJSON(url), []);
            if (tables.length) return tables;
        } catch (e) {
            /* tenta a próxima */
        }
    }
    return [];
}

/* ══════════════════════════════
   Artilharia (derivada dos gols das partidas)
══════════════════════════════ */

function computeTopScorers(games) {
    const map = new Map();

    games.forEach(game => {
        if (game.state === 'pre') return;
        const teamById = { [game.home.id]: game.home, [game.away.id]: game.away };

        game.goals.forEach(goal => {
            if (goal.ownGoal) return;                 // gol contra não conta para o artilheiro
            const team = teamById[goal.teamId];
            if (!team) return;

            const key = goal.playerId
                ? `id:${goal.playerId}`
                : `n:${goal.player.toLowerCase()}|${team.id}`;

            const cur = map.get(key);
            if (cur) {
                cur.goals++;
                cur.pens += goal.penalty ? 1 : 0;
            } else {
                map.set(key, {
                    name:  goal.player,
                    team:  team.name,
                    crest: team.crest,
                    goals: 1,
                    pens:  goal.penalty ? 1 : 0,
                });
            }
        });
    });

    return [...map.values()]
        .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'pt-BR'));
}
