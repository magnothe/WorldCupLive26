/* ──────────────────────────────────────────────
   stats.js — Artilharia e cartões derivados das partidas
   ────────────────────────────────────────────── */

export function computeTopScorers(games) {
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
                    key,
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

export function computeCardLeaders(games) {
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
                cur = { key, name: card.player, team: team.name, crest: team.crest, yellow: 0, red: 0 };
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
