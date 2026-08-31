import { Link } from 'react-router-dom';
import { TZ } from '../api/dates.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';
import './Masthead.css';

export default function Masthead() {
    const { activeLeague, syncLabel } = useLeagueData();

    const today = new Date().toLocaleDateString('pt-BR', {
        timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    return (
        <header className="masthead">
            <div className="shell mast-inner">
                {/* o logo leva de volta para a tela de hoje do campeonato ativo */}
                <Link className="wordmark-link" to={`/${activeLeague}/hoje`}>
                    <h1 className="wordmark">Football<em>Live</em></h1>
                </Link>
                <p className="mast-meta">
                    <span>{today}</span>
                    <span className="sep" />
                    <span>{syncLabel}</span>
                </p>
            </div>
        </header>
    );
}
