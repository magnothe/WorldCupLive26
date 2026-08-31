import Crest from './Crest.jsx';
import './PlayerTables.css';

/** Numera a lista respeitando empates (1º, 2º, 2º, 4º…). */
function ranked(list, sameAs) {
    let prev = null, shown = 0;
    return list.map((item, i) => {
        if (prev === null || !sameAs(item, prev)) shown = i + 1;
        prev = item;
        return { item, pos: shown };
    });
}

function PlayerCell({ player, sub }) {
    return (
        <td className="col-player">
            <div className="pl">
                <Crest className="pl-badge" src={player.crest} size={22} />
                <span className="pl-info">
                    <span className="pl-name">{player.name}</span>
                    <span className="pl-team">{sub}</span>
                </span>
            </div>
        </td>
    );
}

export function TopScorersTable({ list, emptyMessage }) {
    if (!list.length) return <p className="empty">{emptyMessage}</p>;

    return (
        <div className="scroll-x">
            <table className="table">
                <thead>
                    <tr><th>#</th><th className="col-player">Jogador</th><th title="Gols">G</th></tr>
                </thead>
                <tbody>
                    {ranked(list, (a, b) => a.goals === b.goals).map(({ item: s, pos }) => (
                        <tr key={s.key}>
                            <td className={`rk ${pos === 1 ? 'first' : ''}`}>{pos}</td>
                            <PlayerCell player={s} sub={s.team + (s.pens ? ` · ${s.pens} de pênalti` : '')} />
                            <td className="pl-num">{s.goals}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function CardLeadersTable({ list, emptyMessage }) {
    if (!list.length) return <p className="empty">{emptyMessage}</p>;

    const weight = p => p.red * 2 + p.yellow;

    return (
        <div className="scroll-x">
            <table className="table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th className="col-player">Jogador</th>
                        <th title="Amarelos">A</th>
                        <th title="Vermelhos (inclui segundo amarelo)">V</th>
                    </tr>
                </thead>
                <tbody>
                    {ranked(list, (a, b) => weight(a) === weight(b)).map(({ item: p, pos }) => (
                        <tr key={p.key}>
                            <td className="rk">{pos}</td>
                            <PlayerCell player={p} sub={p.team} />
                            <td className="pl-num card-y">{p.yellow || '—'}</td>
                            <td className="pl-num card-r">{p.red || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
