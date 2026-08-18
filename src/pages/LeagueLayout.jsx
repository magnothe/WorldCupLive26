import { Outlet } from 'react-router-dom';
import TabsNav from '../components/TabsNav.jsx';
import { todayKey } from '../api/dates.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';
import './LeagueLayout.css';

/** Chamada da seção + abas. Vale para todas as telas de um campeonato. */
export default function LeagueLayout() {
    const { league, state, games } = useLeagueData();

    const today  = todayKey();
    const todays = games.filter(g => g.dateKey === today);
    const live   = todays.filter(g => g.live).length;

    const parts = [];
    if (live) parts.push(`${live} ${live === 1 ? 'jogo' : 'jogos'} ao vivo`);
    parts.push(todays.length
        ? `${todays.length} ${todays.length === 1 ? 'jogo hoje' : 'jogos hoje'}`
        : 'nenhum jogo hoje');
    if (state.seasonAt) parts.push(`${games.length} na temporada`);

    return (
        <>
            <div className="lead">
                <h2 className="lead-title">{league.label}</h2>
                <p className={'lead-sub' + (live > 0 ? ' has-live' : '')}>{parts.join(' · ')}</p>
            </div>

            <TabsNav />

            <section className="view">
                <Outlet />
            </section>
        </>
    );
}
