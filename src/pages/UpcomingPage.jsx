import { GroupedByDate } from '../components/MatchGrid.jsx';
import { todayKey } from '../api/dates.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';

export default function UpcomingPage() {
    const { state, games } = useLeagueData();
    const today = todayKey();

    if (state.seasonLoading && !state.seasonAt) return <p className="empty">Carregando…</p>;

    return <GroupedByDate games={games.filter(g => g.dateKey > today)} ascending />;
}
