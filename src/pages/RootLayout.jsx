import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Masthead from '../components/Masthead.jsx';
import LeagueBar from '../components/LeagueBar.jsx';
import GoalNotifications from '../components/GoalNotifications.jsx';
import { LEAGUE_BY_KEY, LEAGUES } from '../api/leagues.js';
import { TAB_BY_PATH } from '../routes.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';
import './RootLayout.css';

/**
 * Casca do site: cabeçalho, barra de campeonatos, rodapé e as notificações.
 *
 * É aqui também que a URL vira estado — o endereço é a fonte da verdade sobre
 * qual campeonato e qual seção estão abertos, e o store apenas segue.
 */
export default function RootLayout() {
    const location = useLocation();
    const { setActiveLeague, setActiveTab } = useLeagueData();

    const [leagueKey, section] = location.pathname.split('/').filter(Boolean);
    const validLeague = !!LEAGUE_BY_KEY[leagueKey];

    useEffect(() => {
        if (!validLeague) return;
        setActiveLeague(leagueKey);

        // a tela de uma partida não muda a seção aberta nas abas
        if (section === 'partida') return;
        const tab = TAB_BY_PATH[section];
        if (tab) setActiveTab(tab.id);
    }, [leagueKey, section, validLeague, setActiveLeague, setActiveTab]);

    if (!validLeague) return <Navigate to={`/${LEAGUES[0].key}/hoje`} replace />;

    return (
        <>
            <GoalNotifications />
            <Masthead />
            <LeagueBar />

            <main className="shell">
                <Outlet />
            </main>

            <footer className="site-footer">
                <div className="shell">
                    Dados de <strong>ESPN</strong> — placares, escalações, cartões, tabelas e
                    escudos. Sem chave de API.
                </div>
            </footer>
        </>
    );
}
