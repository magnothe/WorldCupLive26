import { matchTimeline } from '../api/espn.js';
import { BallIcon, CardIcon, DoubleCardIcon, SubIcon } from './Icons.jsx';
import Crest from './Crest.jsx';
import '../styles/detail.css';
import './MatchTimeline.css';

function itemLook(item) {
    switch (item.kind) {
        case 'yellow':        return { icon: <CardIcon />,       cls: 'yellow', extra: 'amarelo' };
        case 'red':           return { icon: <CardIcon />,       cls: 'red',    extra: 'vermelho' };
        case 'second-yellow': return { icon: <DoubleCardIcon />, cls: 'red',    extra: 'segundo amarelo' };
        case 'sub':           return { icon: <SubIcon />,        cls: 'sub',    extra: 'substituição' };
        default:
            return {
                icon: <BallIcon />,
                cls: 'goal',
                extra: item.ownGoal ? 'contra' : item.penalty ? 'pênalti' : '',
            };
    }
}

function TimelineItem({ game, item }) {
    const side = item.teamId === game.home.id ? game.home
               : item.teamId === game.away.id ? game.away : null;
    const { icon, cls, extra } = itemLook(item);

    const text = item.kind === 'sub'
        ? item.players.map((p, i) => (
            <span key={p + i}>
                {i > 0 && <span className="swap"> → </span>}
                {p}
            </span>
        ))
        : item.player;

    return (
        <li className={`tl-item ${cls}${side === game.away ? ' is-away' : ''}`}>
            <span className="tl-min">{item.minute || '—'}</span>
            <span className="tl-ico">{icon}</span>
            <span className="tl-text">
                {text}
                {extra && <span className="tl-extra">{extra}</span>}
            </span>
            {side && (
                <Crest className="tl-badge" src={side.crest} size={16}
                       alt={side.name} title={side.name} />
            )}
        </li>
    );
}

function Facts({ game }) {
    const facts = [];
    if (game.venue)      facts.push(['Estádio', game.venue + (game.city ? `, ${game.city}` : '')]);
    if (game.referee)    facts.push(['Árbitro', game.referee]);
    if (game.attendance) facts.push(['Público', game.attendance.toLocaleString('pt-BR')]);
    if (game.home.form && game.away.form) {
        facts.push(['Campanha',
            `${game.home.abbr || game.home.short} ${game.home.form} · ${game.away.abbr || game.away.short} ${game.away.form}`]);
    }
    if (!facts.length) return null;

    return (
        <dl className="facts">
            {facts.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
        </dl>
    );
}

/** Painel "Lances": linha do tempo + ficha da partida. */
export default function MatchTimelinePanel({ game }) {
    const items = matchTimeline(game);

    return (
        <div className="match-detail">
            {items.length ? (
                <ul className="timeline">
                    {items.map((item, i) => (
                        <TimelineItem key={`${item.kind}-${item.order}-${i}`} game={game} item={item} />
                    ))}
                </ul>
            ) : (
                <p className="detail-empty">
                    {game.state === 'pre'
                        ? 'A partida ainda não começou.'
                        : 'A ESPN não publicou os lances desta partida.'}
                </p>
            )}
            <Facts game={game} />
        </div>
    );
}
