import { Navigate, Route, Routes } from 'react-router-dom';
import { LEAGUES } from './api/leagues.js';
import { LeagueDataProvider } from './store/LeagueDataContext.jsx';

import RootLayout from './pages/RootLayout.jsx';
import LeagueLayout from './pages/LeagueLayout.jsx';
import TodayPage from './pages/TodayPage.jsx';
import PastPage from './pages/PastPage.jsx';
import UpcomingPage from './pages/UpcomingPage.jsx';
import StandingsPage from './pages/StandingsPage.jsx';
import ScorersPage from './pages/ScorersPage.jsx';
import CardsPage from './pages/CardsPage.jsx';
import MatchPage from './pages/MatchPage.jsx';

const HOME = `/${LEAGUES[0].key}/hoje`;

/**
 * Mapa de telas
 *
 *   /                                   → redireciona para o Brasileirão, hoje
 *   /:liga/hoje                         → jogos do dia
 *   /:liga/resultados                   → partidas já disputadas
 *   /:liga/proximos                     → próximas partidas
 *   /:liga/classificacao                → tabela
 *   /:liga/artilharia                   → artilheiros
 *   /:liga/cartoes                      → cartões
 *   /:liga/partida/:id/lances           → lances de uma partida
 *   /:liga/partida/:id/escalacao        → escalação das duas equipes
 */
export default function App() {
    return (
        <LeagueDataProvider>
            <Routes>
                <Route path="/" element={<Navigate to={HOME} replace />} />

                <Route element={<RootLayout />}>
                    <Route path="/:leagueKey" element={<LeagueLayout />}>
                        <Route index element={<Navigate to="hoje" replace />} />
                        <Route path="hoje"          element={<TodayPage />} />
                        <Route path="resultados"    element={<PastPage />} />
                        <Route path="proximos"      element={<UpcomingPage />} />
                        <Route path="classificacao" element={<StandingsPage />} />
                        <Route path="artilharia"    element={<ScorersPage />} />
                        <Route path="cartoes"       element={<CardsPage />} />
                    </Route>

                    <Route path="/:leagueKey/partida/:gameId">
                        <Route index element={<Navigate to="lances" replace />} />
                        <Route path=":panel" element={<MatchPage />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to={HOME} replace />} />
            </Routes>
        </LeagueDataProvider>
    );
}
