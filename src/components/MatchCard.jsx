import { Link } from 'react-router-dom';
import { LEAGUE_BY_KEY } from '../api/leagues.js';
import { hasMatchDetail } from '../api/espn.js';
import Crest from './Crest.jsx';
import { CardIcon, ChevronIcon, ShirtIcon } from './Icons.jsx';
import './MatchCard.css';

/* ──────────────────────────────
   Peças do cartão
────────────────────────────── */

function ScoreCell({ game, side }) {
    if (game.state === 'pre') return <span className="t-score pending">—</span>;
    return (
        <>
            <span className="t-score">{side.score != null ? side.score : 0}</span>
            {side.pens != null && <span className="t-pens">({side.pens})</span>}
        </>
    );
}

/** Gols do time, em uma linha curta sob o nome. */
function GoalLine({ game, teamId }) {
    const list = game.goals.filter(g => g.teamId === teamId);
    if (!list.length) return null;

    return (
        <div className="t-goals">
            {list.map((g, i) => (
                <span key={`${g.player}-${g.minute}-${i}`}>
                    {i > 0 && <span className="dot">·</span>}
                    {g.player}{g.ownGoal ? ' (gc)' : g.penalty ? ' (p)' : ''}{' '}
                    <span className="min">{g.minute}</span>
                </span>
            ))}
        </div>
    );
}

function TeamRow({ game, side, other }) {
    const decided = game.state === 'post' && side.score != null && other.score != null;
    const cls = [
        't-row',
        decided && side.score > other.score ? 'won'  : '',
        decided && side.score < other.score ? 'lost' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cls}>
            <Crest className="t-badge" src={side.crest} size={26} />
            <div className="t-main">
                <div className="t-name">{side.name}</div>
                <GoalLine game={game} teamId={side.id} />
            </div>
            <ScoreCell game={game} side={side} />
        </div>
    );
}

/** Contadores de cartão da partida, mostrados no rodapé do cartão. */
function CardTally({ game }) {
    const yellow = game.cards.filter(c => c.kind === 'yellow').length;
    const red    = game.cards.filter(c => c.kind !== 'yellow').length;
    if (!yellow && !red) return null;

    return (
        <span className="tally">
            {yellow > 0 && <span className="tally-item yellow"><CardIcon />{yellow}</span>}
            {red    > 0 && <span className="tally-item red"><CardIcon />{red}</span>}
        </span>
    );
}

function MatchState({ game }) {
    if (game.live)     return <span className="state live"><i />{game.clock || 'ao vivo'}</span>;
    if (game.finished) return <span className="state">Encerrado</span>;
    return <span className="state">{game.time}</span>;
}

/* ──────────────────────────────
   Cartão

   Os botões do rodapé são links: levam para a TELA da partida, com o painel
   pedido já aberto (/bra1/partida/12345/escalacao).
────────────────────────────── */

export default function MatchCard({ game }) {
    const league = LEAGUE_BY_KEY[game.league];
    const base   = `/${game.league}/partida/${game.id}`;

    return (
        <article
            className={'match' + (game.live ? ' is-live' : '')}
            style={{ '--accent': league.accent }}
        >
            <div className="match-top">
                <span className="match-comp">{league.short}</span>
                {game.note && <span className="match-note">{game.note}</span>}
                <span className="match-when">{game.time}</span>
            </div>

            <Link className="match-rows" to={base} aria-label={`Abrir ${game.home.name} x ${game.away.name}`}>
                <TeamRow game={game} side={game.home} other={game.away} />
                <TeamRow game={game} side={game.away} other={game.home} />
            </Link>

            <div className="match-bot">
                <MatchState game={game} />
                <CardTally game={game} />
                <div className="match-actions">
                    <Link className="match-more" to={`${base}/escalacao`}>
                        <ShirtIcon /><span>Escalação</span><ChevronIcon />
                    </Link>
                    {hasMatchDetail(game) && (
                        <Link className="match-more" to={`${base}/lances`}>
                            <span>Lances</span><ChevronIcon />
                        </Link>
                    )}
                </div>
            </div>
        </article>
    );
}
