import { TopScorersTable } from '../components/PlayerTables.jsx';
import { useLeagueData } from '../store/LeagueDataContext.jsx';

export default function ScorersPage() {
    const { league, state, activeLeague, derivedOf } = useLeagueData();

    if (state.seasonLoading && !state.seasonAt) return <p className="empty">Carregando…</p>;

    return (
        <div className="panel narrow">
            <h3 className="panel-head">Artilharia</h3>
            <TopScorersTable
                list={derivedOf(activeLeague, 'scorers')}
                emptyMessage={`A ESPN não publica os autores dos gols de ${league.label}.`}
            />
        </div>
    );
}
