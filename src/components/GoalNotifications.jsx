import { useEffect, useState } from 'react';
import { LEAGUE_BY_KEY } from '../api/leagues.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';
import { BallIcon } from './Icons.jsx';
import Crest from './Crest.jsx';
import './GoalNotifications.css';

const LIFETIME = 6500;
const LEAVE_MS = 260;

function Notification({ notif, onDismiss }) {
    const [leaving, setLeaving] = useState(false);
    const league = LEAGUE_BY_KEY[notif.leagueKey];

    useEffect(() => {
        const hide = setTimeout(() => setLeaving(true), LIFETIME);
        const kill = setTimeout(() => onDismiss(notif.id), LIFETIME + LEAVE_MS);
        return () => { clearTimeout(hide); clearTimeout(kill); };
    }, [notif.id, onDismiss]);

    return (
        <div
            className={'notif' + (leaving ? ' leaving' : '')}
            style={league ? { '--accent': league.accent } : undefined}
        >
            <span className="notif-ico"><BallIcon /></span>
            <div className="notif-body">
                <div className="notif-label">Gol · {league ? league.short : ''}</div>
                <div className="notif-player">{notif.player}</div>
                <div className="notif-team">
                    <Crest src={notif.crest} size={15} />{notif.teamName}
                </div>
            </div>
            <button className="notif-close" type="button" aria-label="Fechar"
                    onClick={() => onDismiss(notif.id)}>
                ×
            </button>
        </div>
    );
}

export default function GoalNotifications() {
    const { notifications, dismissNotification } = useLeagueData();

    return (
        <div className="notif-wrap">
            {notifications.map(n => (
                <Notification key={n.id} notif={n} onDismiss={dismissNotification} />
            ))}
        </div>
    );
}
