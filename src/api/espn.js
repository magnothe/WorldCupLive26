/* ──────────────────────────────────────────────
   espn.js — Camada de dados (ESPN)

   API escolhida: ESPN hidden/public soccer API.
     • Sem chave, sem cadastro, sem limite de requisições
     • Cobre Brasileirão A/B/C e as cinco grandes ligas europeias
     • Já devolve os ESCUDOS dos times na própria resposta
     • Traz os lances da partida em `competitions[0].details`

   IMPORTANTE — host: use `site.web.api.espn.com`, e NÃO `site.api.espn.com`.
   Os dois servem exatamente os mesmos caminhos, mas `site.api.espn.com` não
   devolve `Access-Control-Allow-Origin` para requisições vindas do navegador,
   o que faz todo fetch falhar com erro de CORS.
   ────────────────────────────────────────────── */

import { CREST_FALLBACK, LEAGUE_BY_KEY } from './leagues.js';
import { brDateKey, brTime, espnDate, seasonWindow } from './dates.js';

const ESPN_HOST       = 'https://site.web.api.espn.com';
const SCOREBOARD_BASE = `${ESPN_HOST}/apis/site/v2/sports/soccer`;
const STANDINGS_BASE  = `${ESPN_HOST}/apis/v2/sports/soccer`;

/* ──────────────────────────────
   Lances da partida (details)

   Cada item de `competitions[0].details` é um lance:
     scoringPlay  → gol            ownGoal / penaltyKick qualificam
     yellowCard   → amarelo        amarelo + vermelho = segundo amarelo
     redCard      → vermelho
     substitution → substituição
────────────────────────────── */

/** "45+2" vira 45.02, para ordenar a linha do tempo sem perder os acréscimos. */
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
        teamId: String((detail.team && detail.team.id) || ''),
        minute: (detail.clock && detail.clock.displayValue) || '',
        order:  minuteValue(detail.clock && detail.clock.displayValue),
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

/* ──────────────────────────────
   Normalização das partidas
────────────────────────────── */

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
        referee:  (ref && (ref.displayName || ref.fullName)) || '',
        home:     normalizeSide(home),
        away:     normalizeSide(away),
        goals:    normalizeGoals(comp),
        cards:    normalizeCards(comp),
        subs:     normalizeSubs(comp),
        // A linha do tempo só aparece quando o usuário abre "Lances". Ordenar
        // 380 partidas × N lances no carregamento era trabalho jogado fora.
        timeline: null,
    };
}

/** Lances da partida em ordem cronológica. Montada na primeira chamada. */
export function matchTimeline(game) {
    if (!game.timeline) {
        game.timeline = [...game.goals, ...game.cards, ...game.subs]
            .sort((a, b) => a.order - b.order);
    }
    return game.timeline;
}

/** Há algo para mostrar no painel de detalhe? */
export function hasMatchDetail(game) {
    return game.goals.length > 0 || game.cards.length > 0 || game.subs.length > 0
        || !!game.venue || !!game.referee;
}

/* ──────────────────────────────
   Fetch
────────────────────────────── */

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
export async function fetchGames(leagueKey, from, to, bustSeconds) {
    const league = LEAGUE_BY_KEY[leagueKey];
    // `limit` é obrigatório: sem ele a ESPN corta a resposta em 100 partidas.
    let url = `${SCOREBOARD_BASE}/${league.slug}/scoreboard?limit=1000&${cacheBust(bustSeconds || 20)}`;
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
export async function fetchSeason(leagueKey) {
    const league = LEAGUE_BY_KEY[leagueKey];

    // A resposta passa de 4 MB. Cache-bust longo (10 min) para que recarregar
    // a página ou voltar para a liga reaproveite o cache do CDN e do navegador.
    const SEASON_BUST = 600;

    const now   = seasonWindow(league);
    const games = await fetchGames(leagueKey, now.from, now.to, SEASON_BUST);
    if (games.length) return games;

    const prev = seasonWindow(league, 1);
    try {
        return await fetchGames(leagueKey, prev.from, prev.to, SEASON_BUST);
    } catch {
        return games;
    }
}

/* ──────────────────────────────
   Escalação

   {host}/apis/site/v2/sports/soccer/{slug}/summary?event={id}
   devolve `rosters` — um por time — com formação, titulares, banco, número
   da camisa, posição, entradas/saídas, gols e cartões na partida.

   FOTO — `athlete.headshot` existe para uma minoria dos jogadores (~10% no
   Brasileirão). Para os demais entra `jerseyImages`, a camisa numerada que a
   ESPN gera para todo mundo. As duas passam pelo combiner: o PNG original
   tem 1440px e ~200 KB, e a 96px cai para ~5 KB.
────────────────────────────── */

const LINEUP_TTL = 90 * 1000;          // partida ao vivo troca jogador
const lineupCache = new Map();         // gameId -> { at, data }

/** Redimensiona uma imagem da ESPN pelo combiner dela. */
function espnThumb(url, width) {
    return `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(url)}&w=${width}`;
}

/**
 * Linha do jogador no campinho, do gol para o ataque:
 *   0 goleiro · 1 defesa · 2 meio · 3 meia-atacante · 4 ataque
 *
 * A ESPN não diz a que linha da formação o jogador pertence — então a linha
 * sai da sigla da posição. Quando a reconstrução não bate com a formação
 * declarada, o campinho continua correto e o rótulo é sempre o da ESPN.
 */
function pitchRow(abbr) {
    const a = String(abbr || '').toUpperCase();
    if (a === 'G' || a === 'GK')        return 0;
    if (a.startsWith('AM'))             return 3;
    if (a.includes('M'))                return 2;   // DM, CM, LM, RM, M
    if (/B$/.test(a) || /^C?D/.test(a)) return 1;   // LB, RB, WB, CD, D
    return 4;                                       // F, S, LF, RF, CF, W
}

/**
 * Abertura do jogador na linha, da esquerda para a direita.
 *
 * O prefixo (LB, RM) abre mais que o sufixo (CD-L, CM-R): sem isso, um LB e um
 * CD-L empatam e o lateral acaba desenhado por dentro do zagueiro.
 */
function pitchSide(abbr) {
    const a = String(abbr || '').toUpperCase();
    if (/-L$/.test(a)) return -1;
    if (/-R$/.test(a)) return  1;
    if (/^L/.test(a))  return -2;
    if (/^R/.test(a))  return  2;
    return 0;
}

/* A ESPN só tem o nome da posição em inglês ("Center Left Defender"), então o
   rótulo é montado aqui a partir da sigla, que é composicional. */
const POSITION_PT = {
    G:  'Goleiro',       GK: 'Goleiro',
    D:  'Zagueiro',      CD: 'Zagueiro',
    B:  'Lateral',       WB: 'Ala',
    DM: 'Volante',       CM: 'Meio-campista',  M: 'Meio-campista',
    AM: 'Meia-atacante',
    F:  'Atacante',      CF: 'Atacante',       S: 'Centroavante',  W: 'Ponta',
    SUB: 'Reserva',
};

function positionName(abbr) {
    const a = String(abbr || '').toUpperCase();
    if (a === 'LB') return 'Lateral-esquerdo';
    if (a === 'RB') return 'Lateral-direito';

    // tira o lado ("CD-L" vira "CD", "LWB" vira "WB") para achar a posição base
    const core = a.replace(/-[LR]$/, '').replace(/^[LR](?=[A-Z])/, '');
    const base = POSITION_PT[core];
    if (!base) return '';

    const side = pitchSide(a);
    if (core === a || !side) return base;
    return `${base} (${side < 0 ? 'esquerda' : 'direita'})`;
}

function playerStat(entry, name) {
    const s = (entry.stats || []).find(x => x.name === name);
    return s ? Number(s.value) || 0 : 0;
}

function normalizePlayer(entry) {
    const a = entry.athlete || {};
    const images = a.jerseyImages || [];
    const shirt  = images.find(j => (j.rel || []).includes('dark')) || images[0];
    const face   = a.headshot && a.headshot.href;

    return {
        id:        String(a.id || ''),
        name:      a.displayName || a.shortName || '—',
        short:     a.shortName || a.displayName || '—',
        jersey:    entry.jersey || '',
        pos:       (entry.position && entry.position.abbreviation) || '',
        posName:   positionName(entry.position && entry.position.abbreviation),
        row:       pitchRow(entry.position && entry.position.abbreviation),
        side:      pitchSide(entry.position && entry.position.abbreviation),
        starter:   !!entry.starter,
        subbedIn:  !!entry.subbedIn,
        subbedOut: !!entry.subbedOut,
        // `real` distingue retrato de camisa — a interface enquadra diferente
        photo:     face ? espnThumb(face, 120) : shirt ? espnThumb(shirt.href, 96) : '',
        real:      !!face,
        goals:     playerStat(entry, 'totalGoals'),
        assists:   playerStat(entry, 'goalAssists'),
        yellow:    playerStat(entry, 'yellowCards'),
        red:       playerStat(entry, 'redCards'),
    };
}

function normalizeRoster(node) {
    const t    = node.team || {};
    const list = (node.roster || []).map(normalizePlayer);

    // Titulares agrupados por linha; o índice 0 é sempre o goleiro.
    const lines = [];
    list.filter(p => p.starter).forEach(p => {
        (lines[p.row] || (lines[p.row] = [])).push(p);
    });

    return {
        teamId:    String(t.id || ''),
        name:      t.displayName || t.abbreviation || '—',
        abbr:      t.abbreviation || '',
        crest:     (t.logos && t.logos[0] && t.logos[0].href)
                   || (t.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${t.id}.png` : CREST_FALLBACK),
        color:     t.color ? `#${t.color}` : '',
        formation: node.formation || '',
        rows:      lines.filter(Boolean).map(line =>
                       line.sort((a, b) => a.side - b.side || a.name.localeCompare(b.name, 'pt-BR'))),
        bench:     list.filter(p => !p.starter),
    };
}

/**
 * Escalação das duas equipes. Devolve `null` quando a ESPN ainda não publicou
 * — o que é o normal em partidas que não começaram.
 */
export async function fetchLineup(leagueKey, gameId) {
    const cached = lineupCache.get(gameId);
    if (cached && Date.now() - cached.at < LINEUP_TTL) return cached.data;

    const league = LEAGUE_BY_KEY[leagueKey];
    const url = `${SCOREBOARD_BASE}/${league.slug}/summary`
              + `?event=${encodeURIComponent(gameId)}&${cacheBust(60)}`;

    const raw   = await getJSON(url);
    const sides = {};
    (raw.rosters || []).forEach(node => {
        sides[node.homeAway === 'away' ? 'away' : 'home'] = normalizeRoster(node);
    });

    const empty = !sides.home || !sides.away
        || (!sides.home.rows.length && !sides.home.bench.length);
    const data = empty ? null : sides;

    lineupCache.set(gameId, { at: Date.now(), data });
    return data;
}

/* ──────────────────────────────
   Classificação
────────────────────────────── */

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
        id:   String(t.id || ''),
        name: t.displayName || t.name || '—',
        abbr: t.abbreviation || '',
        crest,
        pts:  statValue(entry, 'points'),
        mp:   statValue(entry, 'gamesPlayed'),
        w:    statValue(entry, 'wins'),
        d:    statValue(entry, 'ties'),
        l:    statValue(entry, 'losses'),
        gf:   statValue(entry, 'pointsFor'),
        ga:   statValue(entry, 'pointsAgainst'),
        gd:   statValue(entry, 'pointDifferential'),
        rank: statValue(entry, 'rank'),
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
export async function fetchStandings(leagueKey) {
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
        } catch {
            /* tenta a próxima */
        }
    }
    return [];
}
