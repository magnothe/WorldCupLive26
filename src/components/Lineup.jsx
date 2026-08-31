/* ──────────────────────────────────────────────
   Lineup.jsx — Escalação

   Cada time ganha um campinho. As linhas vêm prontas da api (side.rows,
   índice 0 = goleiro) e o CSS inverte a coluna: o mandante ataca para cima,
   o visitante para baixo, como num gráfico de transmissão.
   ────────────────────────────────────────────── */

import { useState } from 'react';
import Crest from './Crest.jsx';
import { ArrowInIcon, BallIcon, CardIcon } from './Icons.jsx';
import '../styles/detail.css';
import './Lineup.css';

function initials(name) {
    return String(name || '')
        .split(/\s+/).filter(Boolean).slice(0, 2)
        .map(w => w[0]).join('').toUpperCase();
}

/** Rosto do jogador: retrato quando existe, senão a camisa numerada. */
function Face({ player, onBare }) {
    const [broken, setBroken] = useState(false);
    const cls = 'lu-face' + (player.real ? ' is-photo' : ' is-shirt');

    // Sem a imagem sobram as iniciais — e o selo do número volta a aparecer,
    // já que a camisa que o trazia não carregou.
    return (
        <span className={cls}>
            <i>{initials(player.name)}</i>
            {player.photo && !broken && (
                <img src={player.photo} alt="" loading="lazy" decoding="async"
                     onError={() => { setBroken(true); if (onBare) onBare(); }} />
            )}
        </span>
    );
}

/** Gols e cartões do jogador na partida, em cima da foto. */
function PlayerMarks({ player }) {
    const marks = [];
    for (let i = 0; i < player.goals; i++) {
        marks.push(<span className="lu-mark goal" key={`g${i}`}><BallIcon /></span>);
    }
    if (player.yellow)    marks.push(<span className="lu-mark yellow" key="y"><CardIcon /></span>);
    if (player.red)       marks.push(<span className="lu-mark red" key="r"><CardIcon /></span>);
    if (player.subbedOut) marks.push(<span className="lu-mark out" key="o"><ArrowInIcon /></span>);

    if (!marks.length) return null;
    return <span className="lu-marks">{marks}</span>;
}

function PitchPlayer({ player }) {
    const [bare, setBare] = useState(false);

    return (
        <div className="lu-p" title={player.name + (player.posName ? ` · ${player.posName}` : '')}>
            <span className={'lu-avatar' + (bare ? ' is-bare' : '')}>
                <Face player={player} onBare={() => setBare(true)} />
                {player.jersey && <span className="lu-num">{player.jersey}</span>}
                <PlayerMarks player={player} />
            </span>
            <span className="lu-pname">{player.short}</span>
        </div>
    );
}

function BenchPlayer({ player }) {
    return (
        <li className={'lu-sub' + (player.subbedIn ? ' is-in' : '')} title={player.name}>
            <Face player={player} />
            <span className="lu-sub-num">{player.jersey || '—'}</span>
            <span className="lu-sub-name">{player.short}</span>
            {player.subbedIn && <span className="lu-in"><ArrowInIcon /></span>}
            <PlayerMarks player={player} />
        </li>
    );
}

function TeamLineup({ side, isAway }) {
    return (
        <section className="lu-team" style={side.color ? { '--team': side.color } : undefined}>
            <div className="lu-head">
                <Crest className="lu-crest" src={side.crest} size={18} />
                <span className="lu-team-name">{side.name}</span>
                {side.formation && <span className="lu-form">{side.formation}</span>}
            </div>

            {side.rows.length > 0 && (
                <div className={'pitch' + (isAway ? ' is-away' : '')}>
                    {side.rows.map((line, i) => (
                        <div className="lu-line" key={i}>
                            {line.map(p => <PitchPlayer key={p.id || p.name} player={p} />)}
                        </div>
                    ))}
                </div>
            )}

            {side.bench.length > 0 && (
                <div className="lu-bench">
                    <h4 className="lu-bench-head">Banco</h4>
                    <ul className="lu-bench-list">
                        {side.bench.map(p => <BenchPlayer key={p.id || p.name} player={p} />)}
                    </ul>
                </div>
            )}
        </section>
    );
}

/** `state` vem do store: { loading } | { error } | { data } — `data` pode ser null. */
export default function Lineup({ game, state }) {
    if (!state || state.loading) {
        return <div className="match-detail"><p className="detail-empty">Carregando escalação…</p></div>;
    }
    if (state.error) {
        return (
            <div className="match-detail">
                <p className="detail-empty is-error">Não deu para carregar a escalação: {state.error}</p>
            </div>
        );
    }
    if (!state.data) {
        return (
            <div className="match-detail">
                <p className="detail-empty">
                    {game.state === 'pre'
                        ? 'A escalação costuma sair cerca de uma hora antes do apito inicial.'
                        : 'A ESPN não publicou a escalação desta partida.'}
                </p>
            </div>
        );
    }

    return (
        <div className="match-detail">
            <div className="lineup">
                <TeamLineup side={state.data.home} isAway={false} />
                <TeamLineup side={state.data.away} isAway />
            </div>
        </div>
    );
}
