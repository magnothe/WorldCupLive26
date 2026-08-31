import { CardLeadersTable } from '../components/PlayerTables.jsx';
import { useLeagueData } from '../store/LeagueDataContext.jsx';

export default function CardsPage() {
    const { league, state, activeLeague, derivedOf } = useLeagueData();

    if (state.seasonLoading && !state.seasonAt) return <p className="empty">Carregando…</p>;

    return (
        <>
            <div className="panel narrow">
                <h3 className="panel-head">Cartões</h3>
                <CardLeadersTable
                    list={derivedOf(activeLeague, 'cards')}
                    emptyMessage={`A ESPN não publica os cartões de ${league.label}.`}
                />
            </div>
            <p className="note">
                Somados a partir dos lances de cada partida publicados pela ESPN. A coluna V
                inclui vermelho direto e segundo amarelo.
            </p>
        </>
    );
}
