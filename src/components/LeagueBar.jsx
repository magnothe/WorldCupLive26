import { NavLink } from 'react-router-dom';
import { LEAGUE_GROUPS } from '../api/leagues.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';
import { pathFor } from '../routes.js';
import './LeagueBar.css';

/**
 * Barra de campeonatos. Cada botão é um link: clicar troca de tela mantendo
 * a seção aberta (Hoje, Classificação…).
 */
export default function LeagueBar() {
    const { activeTab, liveCountOf } = useLeagueData();

    return (
        <nav className="league-bar" aria-label="Selecionar campeonato">
            <div className="shell league-bar-inner">
                {LEAGUE_GROUPS.map(group => (
                    <div className="league-group" key={group.name}>
                        <span className="league-group-name">{group.name}</span>
                        {group.leagues.map(league => {
                            const live = liveCountOf(league.key);
                            return (
                                <NavLink
                                    key={league.key}
                                    to={pathFor(league.key, activeTab)}
                                    className={({ isActive }) => 'league-btn' + (isActive ? ' active' : '')}
                                    style={{ '--accent': league.accent }}
                                >
                                    {league.short}
                                    {live > 0 && <span className="live-dot" title={`${live} ao vivo`} />}
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
            </div>
        </nav>
    );
}
