/* ══════════════════════════════════════════════
   ui.js — Renderização (cards, tabelas, notificações)
   Depende de: api.js
   ══════════════════════════════════════════════ */

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CREST_ONERROR = `this.onerror=null;this.src='${CREST_FALLBACK}'`;

/* ══════════════════════════════
   Card de partida
══════════════════════════════ */

function goalsSideHTML(game, teamId) {
    const list = game.goals.filter(g => g.teamId === teamId);
    if (!list.length) {
        return game.state === 'pre'
            ? '<span class="no-goals">—</span>'
            : '<span class="no-goals">Sem gols</span>';
    }
    return list.map(g => {
        const tags = [g.penalty ? 'pên' : '', g.ownGoal ? 'gc' : ''].filter(Boolean).join(', ');
        return `⚽ ${esc(g.player)} ${esc(g.minute)}` +
               (tags ? ` <span class="goal-tag">(${tags})</span>` : '');
    }).join('<br>');
}

function teamBlockHTML(side) {
    return `
        <div class="team-box">
            <div class="crest-ring">
                <img class="crest" src="${esc(side.crest)}" onerror="${CREST_ONERROR}" alt="${esc(side.name)}">
            </div>
            <div class="team-name">${esc(side.name)}</div>
            ${side.abbr ? `<div class="team-code">${esc(side.abbr)}</div>` : ''}
        </div>`;
}

function statusHTML(game) {
    if (game.live)     return `<span class="status live">🔴 ${esc(game.clock || 'AO VIVO')}</span>`;
    if (game.finished) return `<span class="status">Encerrado</span>`;
    return `<span class="status scheduled">Agendado</span>`;
}

function scoreHTML(game) {
    if (game.state === 'pre') {
        return `<div class="score-display pending">VS</div>`;
    }
    const h = game.home.score != null ? game.home.score : 0;
    const a = game.away.score != null ? game.away.score : 0;
    const pens = (game.home.pens != null && game.away.pens != null)
        ? `<div class="score-pens">pên. ${game.home.pens} – ${game.away.pens}</div>`
        : '';
    return `<div class="score-display">${h}&nbsp;–&nbsp;${a}</div>${pens}`;
}

function buildCard(game, syncTime) {
    const league = LEAGUE_BY_KEY[game.league];
    const card = document.createElement('div');
    card.className = 'scoreboard-card' + (game.live ? ' is-live' : '');
    card.dataset.gameId = game.id;

    const stadium = game.venue
        ? `<div class="card-stadium">
               🏟️ <strong>${esc(game.venue)}</strong>
               ${game.city ? `<span class="stadium-sep">·</span> ${esc(game.city)}` : ''}
           </div>`
        : '';

    card.innerHTML = `
        <div class="card-header">
            <div class="title">${esc(game.note || `Brasileirão · ${league.label}`)}</div>
            <div class="match-time">🕐 ${esc(game.time)} (BRT)</div>
        </div>

        <div class="match-container">
            ${teamBlockHTML(game.home)}
            <div class="score-wrapper">${scoreHTML(game)}</div>
            ${teamBlockHTML(game.away)}
        </div>

        <div class="scorers-container">
            <div class="scorers-side">${goalsSideHTML(game, game.home.id)}</div>
            <div class="scorers-side away">${goalsSideHTML(game, game.away.id)}</div>
        </div>

        ${stadium}

        <div class="card-footer">
            ${statusHTML(game)}
            <div class="update-time">sync ${esc(syncTime)}</div>
        </div>`;

    return card;
}

/* ══════════════════════════════
   Listas de partidas agrupadas por data
══════════════════════════════ */

function renderCardGrid(games, container, syncTime, emptyMsg) {
    container.innerHTML = '';
    if (!games.length) {
        container.innerHTML = `<div class="no-games">${esc(emptyMsg)}</div>`;
        return;
    }
    games.forEach(g => container.appendChild(buildCard(g, syncTime)));
}

function renderGroupedByDate(games, container, syncTime, ascending) {
    container.innerHTML = '';
    if (!games.length) {
        container.innerHTML = `<div class="no-games">Nada por aqui.</div>`;
        return;
    }

    const byDate = new Map();
    games.forEach(g => {
        if (!byDate.has(g.dateKey)) byDate.set(g.dateKey, []);
        byDate.get(g.dateKey).push(g);
    });

    [...byDate.keys()]
        .sort((a, b) => (ascending ? a.localeCompare(b) : b.localeCompare(a)))
        .forEach(dateKey => {
            const group = document.createElement('div');
            group.className = 'date-group';
            group.innerHTML = `<div class="date-group-header">${esc(brDateLabel(dateKey))}</div>`;

            const grid = document.createElement('div');
            grid.className = 'dashboard';
            byDate.get(dateKey)
                .sort((a, b) => a.date - b.date)
                .forEach(g => grid.appendChild(buildCard(g, syncTime)));

            group.appendChild(grid);
            container.appendChild(group);
        });
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
                <div class="st-team-cell">
                    <img class="st-crest" src="${esc(team.crest)}" onerror="${CREST_ONERROR}" alt="${esc(team.name)}">
                    <span class="st-name">${esc(team.name)}</span>
                    ${team.abbr ? `<span class="st-abbr">${esc(team.abbr)}</span>` : ''}
                </div>
            </td>
            <td class="st-pts">${team.pts}</td>
            <td>${team.mp}</td>
            <td>${team.w}</td>
            <td>${team.d}</td>
            <td>${team.l}</td>
            <td>${team.gf}</td>
            <td>${team.ga}</td>
            <td class="st-gd ${gdCls}">${gdStr}</td>
        </tr>`;
}

function renderStandings(tables, league, container, legendEl) {
    container.innerHTML = '';
    legendEl.innerHTML = '';

    if (!tables.length) {
        container.innerHTML =
            `<div class="no-games">A ESPN ainda não publicou a classificação da ${esc(league.label)}.</div>`;
        return;
    }

    const isGroup = tables.length > 1;
    const grid = document.createElement('div');
    grid.className = 'standings-grid' + (isGroup ? '' : ' single');

    tables.forEach(table => {
        const rows = table.teams
            .map((t, i) => standingsRowHTML(t, i + 1, zoneClassFor(i + 1, table.teams.length, league, isGroup)))
            .join('');

        const card = document.createElement('div');
        card.className = 'group-table';
        card.innerHTML = `
            <div class="group-table-header">${esc(isGroup && table.name ? table.name : league.label)}</div>
            <div class="table-scroll-wrap">
                <table class="standings-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th class="col-team">Time</th>
                            <th title="Pontos">Pts</th>
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
        grid.appendChild(card);
    });

    container.appendChild(grid);

    const zones = (isGroup && league.groupZones) ? league.groupZones : league.zones;
    legendEl.innerHTML = (zones || [])
        .map(z => `<div class="legend-item"><div class="legend-dot ${z.cls}"></div> ${esc(z.label)}</div>`)
        .join('');
}

/* ══════════════════════════════
   Artilheiros
══════════════════════════════ */

function renderTopScorers(list, container, emptyMsg) {
    if (!list.length) {
        container.innerHTML =
            `<div class="no-games" style="border:none;">${esc(emptyMsg || 'Nenhum gol registrado ainda nesta série.')}</div>`;
        return;
    }

    let prevGoals = -1, position = 0, shown = 0;
    const rows = list.map((s, i) => {
        position = i + 1;
        if (s.goals !== prevGoals) { shown = position; prevGoals = s.goals; }
        const cls = shown === 1 ? 'gold' : shown === 2 ? 'silver' : shown === 3 ? 'bronze' : '';
        return `
            <tr>
                <td class="sc-rank ${cls}">${shown}º</td>
                <td class="col-player">
                    <div class="sc-player-cell">
                        <img class="sc-crest" src="${esc(s.crest)}" onerror="${CREST_ONERROR}" alt="${esc(s.team)}">
                        <div class="sc-player-info">
                            <span class="sc-name">${esc(s.name)}</span>
                            <span class="sc-team">${esc(s.team)}${s.pens ? ` · ${s.pens} de pênalti` : ''}</span>
                        </div>
                    </div>
                </td>
                <td class="sc-goals">${s.goals}</td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <table class="scorers-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th class="col-player">Jogador</th>
                    <th title="Gols">⚽</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

/* ══════════════════════════════
   Notificação de gol
══════════════════════════════ */

function dismissNotif(el) {
    if (!el || el.classList.contains('leaving')) return;
    clearTimeout(el._timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 280);
}

function showGoalNotif({ player, teamName, crest, leagueKey }) {
    const wrap = document.getElementById('goal-notif-wrap');
    const league = LEAGUE_BY_KEY[leagueKey];

    const el = document.createElement('div');
    el.className = 'goal-notif';
    el.innerHTML = `
        <div class="notif-ball">⚽</div>
        <div class="notif-body">
            <div class="notif-label">Goool!</div>
            <div class="notif-player">${esc(player)}</div>
            <div class="notif-team">
                <img src="${esc(crest)}" onerror="${CREST_ONERROR}" alt="">
                ${esc(teamName)}
                <span class="notif-serie">${esc(league ? league.label : '')}</span>
            </div>
        </div>
        <button class="notif-close" type="button" aria-label="Fechar">✕</button>`;

    el.querySelector('.notif-close').addEventListener('click', () => dismissNotif(el));
    wrap.appendChild(el);
    el._timer = setTimeout(() => dismissNotif(el), 6000);
}
