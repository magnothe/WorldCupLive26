import { MatchGrid } from '../components/MatchGrid.jsx';
import { todayKey } from '../api/dates.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';

export default function TodayPage() {
    const { league, state, games } = useLeagueData();
    const today  = todayKey();
    const todays = games.filter(g => g.dateKey === today);
    const busy   = state.seasonLoading || state.standingsLoading;

    if (!games.length && state.error) {
        return (
            <p className="empty is-error">
                Erro ao carregar {league.label}: {state.error}
            </p>
        );
    }
    if (!games.length && busy) return <p className="empty">Carregando…</p>;

    return <MatchGrid games={todays} emptyMessage={`Nenhum jogo de ${league.label} hoje.`} />;
}
