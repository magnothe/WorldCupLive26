/* ══════════════════════════════════════════════
   ui.js — Renderização (partidas, tabelas, notificações)
   Depende de: api.js
   ══════════════════════════════════════════════ */

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CREST_ONERROR = `this.onerror=null;this.src='${CREST_FALLBACK}'`;

/* ══════════════════════════════
   Ícones (SVG inline — nada de emoji)
══════════════════════════════ */

const ICON = {
    ball: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">
             <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.5"/>
             <path d="M8 4.2 10.6 6.1 9.6 9.2H6.4L5.4 6.1z" fill="currentColor"/>
           </svg>`,
    card: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">
             <rect x="4.5" y="2.5" width="7" height="11" rx="1.2" fill="currentColor"/>
           </svg>`,
    doubleCard: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">
             <rect x="2" y="3" width="6" height="10" rx="1.1" fill="var(--yellow)"/>
             <rect x="8" y="3" width="6" height="10" rx="1.1" fill="var(--red)"/>
           </svg>`,
    sub: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 5.5h8.5m0 0L8.6 3.2M11 5.5 8.6 7.8" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.5 10.5H5m0 0 2.4-2.3M5 10.5l2.4 2.3" fill="none" stroke="var(--red)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`,
    chevron: `<svg class="chev" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>`,
    shirt: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 2 2.5 4l1.2 3L5 6.5V14h6V6.5L12.3 7l1.2-3L10 2a2 2 0 0 1-4 0z"
                    fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            </svg>`,
    arrowIn: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8h8m0 0L8.3 5.3M11 8l-2.7 2.7" fill="none" stroke="currentColor"
                      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>`,
};

/* ══════════════════════════════
   Partida — cabeçalho, linhas de time, resumo
══════════════════════════════ */

function scoreCellHTML(game, side) {
    if (game.state === 'pre') return `<span class="t-score pending">–</span>`;
    const value = side.score != null ? side.score : 0;
    const pens  = side.pens != null ? `<span class="t-pens">(${side.pens})</span>` : '';
    return `<span class="t-score">${value}</span>${pens}`;
}

/** Gols do time, em uma linha curta sob o nome. */
function goalLineHTML(game, teamId) {
    const list = game.goals.filter(g => g.teamId === teamId);
    if (!list.length) return '';
    const names = list.map(g => {
        const tag = g.ownGoal ? ' (gc)' : g.penalty ? ' (p)' : '';
        return `${esc(g.player)}${esc(tag)} <span class="min">${esc(g.minute)}</span>`;
    }).join('<span class="dot">·</span>');
    return `<div class="t-goals">${names}</div>`;
}

function teamRowHTML(game, side, other) {
    const decided = game.state === 'post' && side.score != null && other.score != null;
    const cls = [
        't-row',
        decided && side.score > other.score ? 'won'  : '',
        decided && side.score < other.score ? 'lost' : '',
    ].filter(Boolean).join(' ');

    return `
        <div class="${cls}">
            <img class="t-badge" src="${esc(side.crest)}" onerror="${CREST_ONERROR}" alt=""
                 loading="lazy" decoding="async" width="26" height="26">
            <div class="t-main">
                <div class="t-name">${esc(side.name)}</div>
                ${goalLineHTML(game, side.id)}
            </div>
            ${scoreCellHTML(game, side)}
        </div>`;
}

/** Contadores de cartão por time, mostrados no rodapé da partida. */
function cardTallyHTML(game) {
    const count = (teamId, kinds) =>
        game.cards.filter(c => c.teamId === teamId && kinds.includes(c.kind)).length;

    const yellow = count(game.home.id, ['yellow']) + count(game.away.id, ['yellow']);
    const red    = game.cards.filter(c => c.kind !== 'yellow').length;
    if (!yellow && !red) return '';

    return `
        <span class="tally">
            ${yellow ? `<span class="tally-item yellow">${ICON.card}${yellow}</span>` : ''}
            ${red    ? `<span class="tally-item red">${ICON.card}${red}</span>`       : ''}
        </span>`;
}

function stateHTML(game) {
    if (game.live)     return `<span class="state live"><i></i>${esc(game.clock || 'ao vivo')}</span>`;
    if (game.finished) return `<span class="state">Encerrado</span>`;
    return `<span class="state">${esc(game.time)}</span>`;
}

/* ══════════════════════════════
   Partida — detalhe expandido
══════════════════════════════ */

function timelineItemHTML(game, item) {
    const side  = item.teamId === game.home.id ? game.home
                : item.teamId === game.away.id ? game.away : null;
    const away  = side === game.away;

    let icon = ICON.ball, cls = 'goal', text = esc(item.player), extra = '';

    if (item.kind === 'goal') {
        extra = item.ownGoal ? 'contra' : item.penalty ? 'pênalti' : '';
    } else if (item.kind === 'yellow') {
        icon = ICON.card; cls = 'yellow'; extra = 'amarelo';
    } else if (item.kind === 'red') {
        icon = ICON.card; cls = 'red'; extra = 'vermelho';
    } else if (item.kind === 'second-yellow') {
        icon = ICON.doubleCard; cls = 'red'; extra = 'segundo amarelo';
    } else if (item.kind === 'sub') {
        icon = ICON.sub; cls = 'sub';
        text = item.players.map(esc).join(' <span class="swap">⇄</span> ');
        extra = 'substituição';
    }

    return `
        <li class="tl-item ${cls}${away ? ' is-away' : ''}">
            <span class="tl-min">${esc(item.minute || '—')}</span>
            <span class="tl-ico">${icon}</span>
            <span class="tl-text">${text}${extra ? ` <span class="tl-extra">${esc(extra)}</span>` : ''}</span>
            ${side ? `<img class="tl-badge" src="${esc(side.crest)}" onerror="${CREST_ONERROR}"
                           alt="${esc(side.name)}" title="${esc(side.name)}"
                           loading="lazy" decoding="async" width="16" height="16">` : ''}
        </li>`;
}

function factsHTML(game) {
    const facts = [];
    if (game.venue)      facts.push(['Estádio', game.venue + (game.city ? `, ${game.city}` : '')]);
    if (game.referee)    facts.push(['Árbitro', game.referee]);
    if (game.attendance) facts.push(['Público', game.attendance.toLocaleString('pt-BR')]);
    if (game.home.form && game.away.form) {
        facts.push(['Campanha', `${game.home.abbr || game.home.short} ${game.home.form} · ${game.away.abbr || game.away.short} ${game.away.form}`]);
    }
    if (!facts.length) return '';

    return `<dl class="facts">${facts
        .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join('')}</dl>`;
}

function detailHTML(game) {
    const items = matchTimeline(game);
    const timeline = items.length
        ? `<ul class="timeline">${items.map(i => timelineItemHTML(game, i)).join('')}</ul>`
        : `<p class="detail-empty">${game.state === 'pre'
              ? 'A partida ainda não começou.'
              : 'A ESPN não publicou os lances desta partida.'}</p>`;

    return `<div class="match-detail">${timeline}${factsHTML(game)}</div>`;
}

/* ══════════════════════════════
   Partida — escalação

   Cada time ganha um campinho. As linhas vêm prontas da api (`side.rows`,
   índice 0 = goleiro) e o CSS inverte a coluna: o mandante ataca para cima,
   o visitante para baixo, como num gráfico de transmissão.
══════════════════════════════ */

function initials(name) {
    return String(name || '')
        .split(/\s+/).filter(Boolean).slice(0, 2)
        .map(w => w[0]).join('').toUpperCase();
}

/** Rosto do jogador: retrato quando existe, senão a camisa numerada. */
function faceHTML(player) {
    const cls = 'lu-face' + (player.real ? ' is-photo' : ' is-shirt');
    // Sem a imagem sobram as iniciais — e o selo do número volta a aparecer,
    // já que a camisa que o trazia não carregou.
    const img = player.photo
        ? `<img src="${esc(player.photo)}" alt="" loading="lazy" decoding="async"
                onerror="var a=this.closest('.lu-avatar'); if(a) a.classList.add('is-bare'); this.remove()">`
        : '';
    return `<span class="${cls}"><i>${esc(initials(player.name))}</i>${img}</span>`;
}

/** Gols e cartões do jogador na partida, em cima da foto. */
function playerMarksHTML(player) {
    const marks = [];
    for (let i = 0; i < player.goals; i++) marks.push(`<span class="lu-mark goal">${ICON.ball}</span>`);
    if (player.yellow) marks.push(`<span class="lu-mark yellow">${ICON.card}</span>`);
    if (player.red)    marks.push(`<span class="lu-mark red">${ICON.card}</span>`);
    if (player.subbedOut) marks.push(`<span class="lu-mark out">${ICON.arrowIn}</span>`);
    return marks.length ? `<span class="lu-marks">${marks.join('')}</span>` : '';
}

function pitchPlayerHTML(player) {
    return `
        <div class="lu-p" title="${esc(player.name)}${player.posName ? ` · ${esc(player.posName)}` : ''}">
            <span class="lu-avatar">
                ${faceHTML(player)}
                ${player.jersey ? `<span class="lu-num">${esc(player.jersey)}</span>` : ''}
                ${playerMarksHTML(player)}
            </span>
            <span class="lu-pname">${esc(player.short)}</span>
        </div>`;
}

function benchPlayerHTML(player) {
    return `
        <li class="lu-sub${player.subbedIn ? ' is-in' : ''}" title="${esc(player.name)}">
            ${faceHTML(player)}
            <span class="lu-sub-num">${esc(player.jersey || '–')}</span>
            <span class="lu-sub-name">${esc(player.short)}</span>
            ${player.subbedIn ? `<span class="lu-in">${ICON.arrowIn}</span>` : ''}
            ${playerMarksHTML(player)}
        </li>`;
}

function pitchHTML(side, isAway) {
    if (!side.rows.length) return '';
    const lines = side.rows
        .map(line => `<div class="lu-line">${line.map(pitchPlayerHTML).join('')}</div>`)
        .join('');
    return `<div class="pitch${isAway ? ' is-away' : ''}">${lines}</div>`;
}

function lineupTeamHTML(side, isAway) {
    const bench = side.bench.length
        ? `<div class="lu-bench">
               <h4 class="lu-bench-head">Banco</h4>
               <ul class="lu-bench-list">${side.bench.map(benchPlayerHTML).join('')}</ul>
           </div>`
        : '';

    return `
        <section class="lu-team"${side.color ? ` style="--team:${esc(side.color)}"` : ''}>
            <div class="lu-head">
                <img class="lu-crest" src="${esc(side.crest)}" onerror="${CREST_ONERROR}" alt=""
                     loading="lazy" decoding="async" width="18" height="18">
                <span class="lu-team-name">${esc(side.name)}</span>
                ${side.formation ? `<span class="lu-form">${esc(side.formation)}</span>` : ''}
            </div>
            ${pitchHTML(side, isAway)}
            ${bench}
        </section>`;
}

/** `state` vem do app: { loading } | { error } | { data } — `data` pode ser null. */
function lineupHTML(game, state) {
    if (!state || state.loading) {
        return `<div class="match-detail"><p class="detail-empty">Carregando escalação…</p></div>`;
    }
    if (state.error) {
        return `<div class="match-detail">
                    <p class="detail-empty is-error">Não deu para carregar a escalação: ${esc(state.error)}</p>
                </div>`;
    }
    if (!state.data) {
        return `<div class="match-detail"><p class="detail-empty">${
            game.state === 'pre'
                ? 'A escalação costuma sair cerca de uma hora antes do apito inicial.'
                : 'A ESPN não publicou a escalação desta partida.'
        }</p></div>`;
    }

    return `
        <div class="match-detail">
            <div class="lineup">
                ${lineupTeamHTML(state.data.home, false)}
                ${lineupTeamHTML(state.data.away, true)}
            </div>
        </div>`;
}

/* ══════════════════════════════
   Partida — montagem
══════════════════════════════ */

/** Botão de painel — `mode` é 'detail' (Lances) ou 'lineup' (Escalação). */
function panelButtonHTML(mode, label, icon, isOpen) {
    return `
        <button class="match-more${isOpen ? ' is-on' : ''}" type="button"
                data-mode="${mode}" aria-expanded="${isOpen}">
            ${icon}<span>${esc(label)}</span>${ICON.chevron}
        </button>`;
}

/**
 * `ctx.panelOf(id)` devolve 'detail', 'lineup' ou null — só um painel por
 * partida fica aberto, o mesmo botão fecha o que abriu.
 */
function buildMatch(game, ctx) {
    const league = LEAGUE_BY_KEY[game.league];
    const panel  = ctx.panelOf(game.id);

    const node = document.createElement('article');
    node.className = 'match' + (game.live ? ' is-live' : '') + (panel ? ' is-open' : '');
    node.style.setProperty('--accent', league.accent);
    node.dataset.gameId = game.id;

    const hasDetail = hasMatchDetail(game);

    node.innerHTML = `
        <div class="match-top">
            <span class="match-comp">${esc(league.short)}</span>
            ${game.note ? `<span class="match-note">${esc(game.note)}</span>` : ''}
            <span class="match-when">${esc(game.time)}</span>
        </div>

        <div class="match-rows">
            ${teamRowHTML(game, game.home, game.away)}
            ${teamRowHTML(game, game.away, game.home)}
        </div>

        <div class="match-bot">
            ${stateHTML(game)}
            ${cardTallyHTML(game)}
            <div class="match-actions">
                ${panelButtonHTML('lineup', 'Escalação', ICON.shirt, panel === 'lineup')}
                ${hasDetail ? panelButtonHTML('detail', 'Lances', '', panel === 'detail') : ''}
            </div>
        </div>

        ${panel === 'detail' ? detailHTML(game) : ''}
        ${panel === 'lineup' ? lineupHTML(game, ctx.lineupOf(game.id)) : ''}`;

    node.querySelectorAll('.match-more').forEach(btn => {
        btn.addEventListener('click', () => ctx.onToggle(game, btn.dataset.mode));
    });

    return node;
}

/* ══════════════════════════════
   Listas de partidas
══════════════════════════════ */

function renderMatchGrid(games, container, ctx, emptyMsg) {
    container.innerHTML = '';
    if (!games.length) {
        container.innerHTML = `<p class="empty">${esc(emptyMsg)}</p>`;
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'match-grid';
    games.forEach(g => grid.appendChild(buildMatch(g, ctx)));
    container.appendChild(grid);
}

/**
 * Lista agrupada por data, paginada.
 *
 * Uma temporada tem ~380 partidas. Montar todas de uma vez são milhares de nós
 * no DOM e centenas de imagens — o que travava a aba "Resultados". `ctx.limit`
 * corta a lista; o resto entra sob demanda pelo botão do rodapé.
 */
function renderGroupedByDate(games, container, ctx, ascending) {
    container.innerHTML = '';
    if (!games.length) {
        container.innerHTML = `<p class="empty">Nada por aqui.</p>`;
        return;
    }

    const ordered = games.slice().sort((a, b) => (ascending ? a.date - b.date : b.date - a.date));
    const limit   = ctx.limit || ordered.length;
    const page    = ordered.slice(0, limit);

    const byDate = new Map();
    page.forEach(g => {
        if (!byDate.has(g.dateKey)) byDate.set(g.dateKey, []);
        byDate.get(g.dateKey).push(g);
    });

    const frag = document.createDocumentFragment();

    byDate.forEach((dayGames, dateKey) => {
        const group = document.createElement('section');
        group.className = 'date-group';
        group.innerHTML = `<h3 class="date-head">${esc(brDateLabel(dateKey))}</h3>`;

        const grid = document.createElement('div');
        grid.className = 'match-grid';
        dayGames
            .sort((a, b) => a.date - b.date)
            .forEach(g => grid.appendChild(buildMatch(g, ctx)));

        group.appendChild(grid);
        frag.appendChild(group);
    });

    const rest = ordered.length - page.length;
    if (rest > 0) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'load-more';
        more.textContent = `Mostrar mais ${Math.min(rest, ctx.pageSize || 40)} de ${rest}`;
        more.addEventListener('click', ctx.onMore);
        frag.appendChild(more);
    }

    container.appendChild(frag);
}

/* ══════════════════════════════
   Classificação
══════════════════════════════ */

function zoneClassFor(pos, total, league, isGroup) {
    const zones = (isGroup && league.groupZones) ? league.groupZones : league.zones;
    for (const z of zones || []) {
        // zonas de rebaixamento são ancoradas no fim da tabela
        if (z.cls === 'zone-relegation') {
            const span = z.to - z.from;
            if (total < 2 * (span + 1)) continue;   // tabela curta: não marca rebaixamento
            if (pos > total - 1 - span) return z.cls;
        } else if (pos >= z.from && pos <= z.to) {
            return z.cls;
        }
    }
    return '';
}

function standingsRowHTML(team, pos, zoneCls) {
    const gdStr = team.gd > 0 ? `+${team.gd}` : String(team.gd);
    const gdCls = team.gd > 0 ? 'pos' : team.gd < 0 ? 'neg' : '';
    return `
        <tr>
            <td class="st-pos ${zoneCls}">${pos}</td>
            <td class="col-team">
                <div class="st-team">
                    <img class="st-badge" src="${esc(team.crest)}" onerror="${CREST_ONERROR}" alt=""
                         loading="lazy" decoding="async" width="20" height="20">
                    <span class="st-name">${esc(team.name)}</span>
                </div>
            </td>
            <td class="st-pts">${team.pts}</td>
            <td>${team.mp}</td>
            <td>${team.w}</td>
            <td>${team.d}</td>
            <td>${team.l}</td>
            <td class="num-soft">${team.gf}</td>
            <td class="num-soft">${team.ga}</td>
            <td class="st-gd ${gdCls}">${gdStr}</td>
        </tr>`;
}

function renderStandings(tables, league, container, legendEl) {
    container.innerHTML = '';
    legendEl.innerHTML = '';

    if (!tables.length) {
        container.innerHTML =
            `<p class="empty">A ESPN ainda não publicou a classificação de ${esc(league.label)}.</p>`;
        return;
    }

    const isGroup = tables.length > 1;
    const grid = document.createElement('div');
    grid.className = 'standings-grid' + (isGroup ? '' : ' single');

    tables.forEach(table => {
        const rows = table.teams
            .map((t, i) => standingsRowHTML(t, i + 1, zoneClassFor(i + 1, table.teams.length, league, isGroup)))
            .join('');

        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.innerHTML = `
            <h3 class="panel-head">${esc(isGroup && table.name ? table.name : league.label)}</h3>
            <div class="scroll-x">
                <table class="table standings-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th class="col-team">Time</th>
                            <th title="Pontos">P</th>
                            <th title="Jogos">J</th>
                            <th title="Vitórias">V</th>
                            <th title="Empates">E</th>
                            <th title="Derrotas">D</th>
                            <th title="Gols pró">GP</th>
                            <th title="Gols contra">GC</th>
                            <th title="Saldo de gols">SG</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        grid.appendChild(panel);
    });

    container.appendChild(grid);

    const zones = (isGroup && league.groupZones) ? league.groupZones : league.zones;
    legendEl.innerHTML = (zones || [])
        .map(z => `<span class="legend-item"><i class="${z.cls}"></i>${esc(z.label)}</span>`)
        .join('');
}

/* ══════════════════════════════
   Artilheiros
══════════════════════════════ */

/** Numera a lista respeitando empates (1º, 2º, 2º, 4º…). */
function rankedRows(list, sameAs, rowHTML) {
    let prev = null, shown = 0;
    return list.map((item, i) => {
        if (prev === null || !sameAs(item, prev)) shown = i + 1;
        prev = item;
        return rowHTML(item, shown);
    }).join('');
}

function renderTopScorers(list, container, emptyMsg) {
    if (!list.length) {
        container.innerHTML = `<p class="empty">${esc(emptyMsg)}</p>`;
        return;
    }

    const rows = rankedRows(list, (a, b) => a.goals === b.goals, (s, pos) => `
        <tr>
            <td class="rk ${pos === 1 ? 'first' : ''}">${pos}</td>
            <td class="col-player">
                <div class="pl">
                    <img class="pl-badge" src="${esc(s.crest)}" onerror="${CREST_ONERROR}" alt=""
                         loading="lazy" decoding="async" width="22" height="22">
                    <span class="pl-info">
                        <span class="pl-name">${esc(s.name)}</span>
                        <span class="pl-team">${esc(s.team)}${s.pens ? ` · ${s.pens} de pênalti` : ''}</span>
                    </span>
                </div>
            </td>
            <td class="pl-num">${s.goals}</td>
        </tr>`);

    container.innerHTML = `
        <div class="scroll-x">
            <table class="table">
                <thead>
                    <tr><th>#</th><th class="col-player">Jogador</th><th title="Gols">G</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

/* ══════════════════════════════
   Cartões
══════════════════════════════ */

function renderCardLeaders(list, container, emptyMsg) {
    if (!list.length) {
        container.innerHTML = `<p class="empty">${esc(emptyMsg)}</p>`;
        return;
    }

    const weight = p => p.red * 2 + p.yellow;
    const rows = rankedRows(list, (a, b) => weight(a) === weight(b), (p, pos) => `
        <tr>
            <td class="rk">${pos}</td>
            <td class="col-player">
                <div class="pl">
                    <img class="pl-badge" src="${esc(p.crest)}" onerror="${CREST_ONERROR}" alt=""
                         loading="lazy" decoding="async" width="22" height="22">
                    <span class="pl-info">
                        <span class="pl-name">${esc(p.name)}</span>
                        <span class="pl-team">${esc(p.team)}</span>
                    </span>
                </div>
            </td>
            <td class="pl-num card-y">${p.yellow || '–'}</td>
            <td class="pl-num card-r">${p.red || '–'}</td>
        </tr>`);

    container.innerHTML = `
        <div class="scroll-x">
            <table class="table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th class="col-player">Jogador</th>
                        <th title="Amarelos">A</th>
                        <th title="Vermelhos (inclui segundo amarelo)">V</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

/* ══════════════════════════════
   Notificação de gol
══════════════════════════════ */

function dismissNotif(el) {
    if (!el || el.classList.contains('leaving')) return;
    clearTimeout(el._timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
}

function showGoalNotif({ player, teamName, crest, leagueKey }) {
    const wrap = document.getElementById('notif-wrap');
    const league = LEAGUE_BY_KEY[leagueKey];

    const el = document.createElement('div');
    el.className = 'notif';
    if (league) el.style.setProperty('--accent', league.accent);
    el.innerHTML = `
        <span class="notif-ico">${ICON.ball}</span>
        <div class="notif-body">
            <div class="notif-label">Gol · ${esc(league ? league.short : '')}</div>
            <div class="notif-player">${esc(player)}</div>
            <div class="notif-team">
                <img src="${esc(crest)}" onerror="${CREST_ONERROR}" alt="">${esc(teamName)}
            </div>
        </div>
        <button class="notif-close" type="button" aria-label="Fechar">×</button>`;

    el.querySelector('.notif-close').addEventListener('click', () => dismissNotif(el));
    wrap.appendChild(el);
    el._timer = setTimeout(() => dismissNotif(el), 6500);
}
