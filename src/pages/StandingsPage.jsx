import StandingsTable from '../components/StandingsTable.jsx';
import { useLeagueData } from '../store/LeagueDataContext.jsx';

export default function StandingsPage() {
    const { league, state } = useLeagueData();

    if (state.standingsLoading && !state.standings) return <p className="empty">Carregando…</p>;

    return <StandingsTable tables={state.standings || []} league={league} />;
}
