import { NavLink } from 'react-router-dom';
import { TABS } from '../routes.js';
import { todayKey } from '../api/dates.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';
import '../styles/tabs.css';

/** Abas de seção — cada uma navega para a tela correspondente. */
export default function TabsNav() {
    const { activeLeague, state, games } = useLeagueData();
    const today = todayKey();

    // Sem a temporada carregada, os totais de Resultados/Próximos seriam
    // apenas o que veio na janela ao vivo — melhor não mostrar número algum.
    const hasSeason = state.seasonAt > 0;
    const count = {
        today:    games.filter(g => g.dateKey === today).length,
        past:     hasSeason ? games.filter(g => g.dateKey < today).length : null,
        upcoming: hasSeason ? games.filter(g => g.dateKey > today).length : null,
    };

    return (
        <nav className="tabs" aria-label="Seções">
            {TABS.map(tab => (
                <NavLink
                    key={tab.id}
                    to={`/${activeLeague}/${tab.path}`}
                    className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
                >
                    {tab.label}
                    {count[tab.id] != null && <span className="tab-count">{count[tab.id]}</span>}
                </NavLink>
            ))}
        </nav>
    );
}
