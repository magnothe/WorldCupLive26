import Crest from './Crest.jsx';
import './StandingsTable.css';

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

function Row({ team, pos, zoneCls }) {
    const gdStr = team.gd > 0 ? `+${team.gd}` : String(team.gd);
    const gdCls = team.gd > 0 ? 'pos' : team.gd < 0 ? 'neg' : '';

    return (
        <tr>
            <td className={`st-pos ${zoneCls}`}>{pos}</td>
            <td className="col-team">
                <div className="st-team">
                    <Crest className="st-badge" src={team.crest} size={20} />
                    <span className="st-name">{team.name}</span>
                </div>
            </td>
            <td className="st-pts">{team.pts}</td>
            <td>{team.mp}</td>
            <td>{team.w}</td>
            <td>{team.d}</td>
            <td>{team.l}</td>
            <td className="num-soft">{team.gf}</td>
            <td className="num-soft">{team.ga}</td>
            <td className={`st-gd ${gdCls}`}>{gdStr}</td>
        </tr>
    );
}

export default function StandingsTable({ tables, league }) {
    if (!tables.length) {
        return <p className="empty">A ESPN ainda não publicou a classificação de {league.label}.</p>;
    }

    const isGroup = tables.length > 1;
    const zones   = (isGroup && league.groupZones) ? league.groupZones : league.zones;

    return (
        <>
            <div className={'standings-grid' + (isGroup ? '' : ' single')}>
                {tables.map((table, i) => (
                    <div className="panel" key={table.name || i}>
                        <h3 className="panel-head">
                            {isGroup && table.name ? table.name : league.label}
                        </h3>
                        <div className="scroll-x">
                            <table className="table standings-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th className="col-team">Time</th>
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
                                <tbody>
                                    {table.teams.map((t, idx) => (
                                        <Row
                                            key={t.id || t.name}
                                            team={t}
                                            pos={idx + 1}
                                            zoneCls={zoneClassFor(idx + 1, table.teams.length, league, isGroup)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            <div className="legend">
                {(zones || []).map(z => (
                    <span className="legend-item" key={z.cls}>
                        <i className={z.cls} />{z.label}
                    </span>
                ))}
            </div>
        </>
    );
}
