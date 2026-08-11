/* ══════════════════════════════════════════════
   api.js — Camada de dados (ESPN)

   API escolhida: ESPN hidden/public soccer API.
     • Sem chave, sem cadastro, sem limite de requisições
     • Cobre Brasileirão A/B/C e as cinco grandes ligas europeias
     • Já devolve os ESCUDOS dos times na própria resposta
       (competitor.team.logo → https://a.espncdn.com/i/teamlogos/soccer/500/{id}.png)
     • Traz os lances da partida em `competitions[0].details`:
       gols, cartões e substituições, com jogador e minuto

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
           <path d="M32 5 9 13v20c0 13.5 9.4 22.3 23 25 13.6-2.7 23-11.5 23-25V13L32 5z"
                 fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
         </svg>`
    );

/* ══════════════════════════════
   Campeonatos

   `season: 'year'`  → temporada = ano civil (Brasil, jan–dez)
   `season: 'cross'` → temporada cruza o ano (Europa, ago–mai)

   As zonas de rebaixamento são declaradas pelo tamanho (`from`/`to` a partir
   do topo), mas ancoradas no FIM da tabela na hora de pintar — assim a mesma
   configuração serve para tabelas de 18 e de 20 times.
══════════════════════════════ */

const LEAGUES = [
    /* ── Brasil ── */
    {
        key: 'bra1', slug: 'bra.1', group: 'Brasil',
        label: 'Brasileirão Série A', short: 'Série A',
        accent: '#29c46a', season: 'year',
        zones: [
            { from: 1,  to: 4,  cls: 'zone-champions',    label: 'Libertadores (fase de grupos)' },
            { from: 5,  to: 6,  cls: 'zone-prelib',       label: 'Pré-Libertadores'              },
            { from: 7,  to: 12, cls: 'zone-secondary',    label: 'Sul-Americana'                 },
            { from: 17, to: 20, cls: 'zone-relegation',   label: 'Rebaixamento'                  },
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

const LEAGUE_BY_KEY = Object.fromEntries(LEAGUES.map(l => [l.key, l]));

/** [{ name: 'Brasil', leagues: [...] }, { name: 'Europa', leagues: [...] }] */
const LEAGUE_GROUPS = LEAGUES.reduce((acc, league) => {
    let g = acc.find(x => x.name === league.group);
    if (!g) acc.push(g = { name: league.group, leagues: [] });
    g.leagues.push(league);
    return acc;
}, []);

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

/**
 * Intervalo de datas da temporada. `back = 1` devolve a temporada anterior.
 * Ligas europeias começam em julho e terminam em junho do ano seguinte.
 */
function seasonWindow(league, back) {
    const now  = new Date();
    const step = back || 0;

    if (league.season === 'cross') {
        const startYear = (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1) - step;
        return { from: `${startYear}-07-01`, to: `${startYear + 1}-06-30`, year: startYear };
    }

    const y = now.getFullYear() - step;
    return { from: `${y}-01-01`, to: `${y}-12-31`, year: y };
}

/* ══════════════════════════════
   Lances da partida (details)

   Cada item de `competitions[0].details` é um lance. Os campos que interessam:
     scoringPlay  → gol            ownGoal / penaltyKick qualificam
     yellowCard   → amarelo        amarelo + vermelho = segundo amarelo
     redCard      → vermelho
     substitution → substituição
══════════════════════════════ */

/** "45'+2" → 45.02, para ordenar a linha do tempo sem perder os acréscimos. */
function minuteValue(text) {
    const m = String(text || '').match(/(\d+)(?:\s*\+\s*(\d+))?/);
    if (!m) return 999;
    return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
}

function athlete(detail, index) {
    const a = detail.athletesInvolved && detail.athletesInvolved[index];
    return a ? { name: a.displayName || a.shortName || '', id: a.id || null } : null;
}

function detailBase(detail) {
    return {
        teamId:  String((detail.team && detail.team.id) || ''),
        minute:  (detail.clock && detail.clock.displayValue) || '',
        order:   minuteValue(detail.clock && detail.clock.displayValue),
    };
}

function normalizeGoals(competition) {
    return (competition.details || [])
        .filter(d => d.scoringPlay && !d.shootout)
        .map(d => {
            const who = athlete(d, 0);
            return {
                ...detailBase(d),
                kind:     'goal',
                player:   (who && who.name) || 'Gol',
                playerId: who && who.id,
                ownGoal:  !!d.ownGoal,
                penalty:  !!d.penaltyKick,
            };
        });
}

function normalizeCards(competition) {
    return (competition.details || [])
        .filter(d => d.yellowCard || d.redCard)
        .map(d => {
            const who = athlete(d, 0);
            // ESPN marca o segundo amarelo com os dois campos ao mesmo tempo
            const kind = d.redCard ? (d.yellowCard ? 'second-yellow' : 'red') : 'yellow';
            return {
                ...detailBase(d),
                kind,
                player:   (who && who.name) || 'Jogador',
                playerId: who && who.id,
            };
        });
}

function normalizeSubs(competition) {
    return (competition.details || [])
        .filter(d => d.substitution)
        .map(d => {
            const a = athlete(d, 0);
            const b = athlete(d, 1);
            if (!a) return null;
            return { ...detailBase(d), kind: 'sub', players: [a.name, b && b.name].filter(Boolean) };
        })
        .filter(Boolean);
}

/* ══════════════════════════════
   Normalização das partidas
══════════════════════════════ */

function normalizeSide(competitor) {
    const t = competitor.team || {};
    const record = (competitor.records || []).find(r => r.type === 'total' || r.name === 'overall');
    return {
        id:     String(t.id || ''),
        name:   t.displayName || t.name || 'A definir',
        short:  t.shortDisplayName || t.name || '',
        abbr:   t.abbreviation || '',
        crest:  t.logo || (t.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${t.id}.png` : CREST_FALLBACK),
        score:  competitor.score != null && competitor.score !== '' ? Number(competitor.score) : null,
        pens:   competitor.shootoutScore != null ? Number(competitor.shootoutScore) : null,
        winner: !!competitor.winner,
        form:   (record && record.summary) || '',
    };
}

function normalizeEvent(ev, leagueKey) {
    const comp = (ev.competitions && ev.competitions[0]) || {};
    const competitors = comp.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
    if (!home || !away) return null;

    const status = (ev.status && ev.status.type) || {};
    const date   = new Date(ev.date);
    const venue  = comp.venue || {};
    const note   = (comp.notes && comp.notes[0] && comp.notes[0].headline) || '';
    const ref    = (comp.officials || []).find(o => !o.order || o.order === 1);

    const goals = normalizeGoals(comp);
    const cards = normalizeCards(comp);
    const subs  = normalizeSubs(comp);

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
        attendance: comp.attendance || 0,
        referee:  (ref && (ref.displayName || (ref.fullName))) || '',
        home:     normalizeSide(home),
        away:     normalizeSide(away),
        goals,
        cards,
        subs,
        timeline: [...goals, ...cards, ...subs].sort((a, b) => a.order - b.order),
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
 * Partidas de um campeonato num intervalo de datas (chaves "YYYY-MM-DD").
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
 * Temporada inteira. Quando a temporada corrente ainda não tem tabela
 * publicada (Série C fora de época, Europa em julho), cai para a anterior.
 */
async function fetchSeason(leagueKey) {
    const league = LEAGUE_BY_KEY[leagueKey];

    const now  = seasonWindow(league);
    const games = await fetchGames(leagueKey, now.from, now.to);
    if (games.length) return games;

    const prev = seasonWindow(league, 1);
    try {
        return await fetchGames(leagueKey, prev.from, prev.to);
    } catch (e) {
        return games;
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
 * Classificação de um campeonato. A ESPN às vezes só publica a tabela da
 * temporada anterior (fora de época) — por isso o fallback.
 */
async function fetchStandings(leagueKey) {
    const league = LEAGUE_BY_KEY[leagueKey];
    const bust   = cacheBust(120);

    for (const back of [0, 1]) {
        const { year } = seasonWindow(league, back);
        const url = back === 0
            ? `${STANDINGS_BASE}/${league.slug}/standings?${bust}`
            : `${STANDINGS_BASE}/${league.slug}/standings?season=${year}&${bust}`;
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

/* ══════════════════════════════
   Disciplina (derivada dos cartões das partidas)
══════════════════════════════ */

function computeCardLeaders(games) {
    const map = new Map();

    games.forEach(game => {
        if (game.state === 'pre') return;
        const teamById = { [game.home.id]: game.home, [game.away.id]: game.away };

        game.cards.forEach(card => {
            const team = teamById[card.teamId];
            if (!team) return;

            const key = card.playerId
                ? `id:${card.playerId}`
                : `n:${card.player.toLowerCase()}|${team.id}`;

            let cur = map.get(key);
            if (!cur) {
                cur = { name: card.player, team: team.name, crest: team.crest, yellow: 0, red: 0 };
                map.set(key, cur);
            }
            if (card.kind === 'yellow') cur.yellow++;
            else cur.red++;                            // vermelho direto ou segundo amarelo
        });
    });

    return [...map.values()]
        .sort((a, b) => (b.red * 2 + b.yellow) - (a.red * 2 + a.yellow)
            || b.red - a.red
            || a.name.localeCompare(b.name, 'pt-BR'));
}
