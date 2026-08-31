import { useEffect } from 'react';
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { LEAGUE_BY_KEY } from '../api/leagues.js';
import { hasMatchDetail } from '../api/espn.js';
import { brDateLabel } from '../api/dates.js';
import { useLeagueData } from '../store/LeagueDataContext.jsx';
import Crest from '../components/Crest.jsx';
import Lineup from '../components/Lineup.jsx';
import MatchTimelinePanel from '../components/MatchTimeline.jsx';
import { ChevronIcon, ShirtIcon } from '../components/Icons.jsx';
import { pathFor } from '../routes.js';
import '../styles/tabs.css';
import './MatchPage.css';

/**
 * Tela de uma partida: /:leagueKey/partida/:gameId/(lances|escalacao)
 *
 * Chegar aqui por link direto é normal (o usuário pode colar a URL), então a
 * tela sabe se virar: se a partida não está no cache, pede a temporada.
 */
export default function MatchPage() {
    const { leagueKey, gameId, panel = 'lances' } = useParams();
    const navigate = useNavigate();
    const { gamesOf, state, ensureSeason, lineups, loadLineup } = useLeagueData();

    const league = LEAGUE_BY_KEY[leagueKey];
    const game   = gamesOf(leagueKey).find(g => g.id === gameId);

    // partida fora da janela ao vivo: só a temporada inteira tem ela
    useEffect(() => {
        if (!game && league) ensureSeason(leagueKey);
    }, [game, league, leagueKey, ensureSeason]);

    // a escalação é um fetch por partida — só sai quando a tela dela é aberta
    useEffect(() => {
        if (game && panel === 'escalacao') loadLineup(game);
    }, [game, panel, loadLineup]);

    if (!league) return <Navigate to="/" replace />;

    if (!game) {
        return (
            <div className="match-page">
                <button type="button" className="back-link" onClick={() => navigate(-1)}>
                    <ChevronIcon /> Voltar
                </button>
                <p className="empty">
                    {state.seasonLoading ? 'Carregando a partida…' : 'Partida não encontrada.'}
                </p>
            </div>
        );
    }

    const decided = game.state === 'post';
    const base    = `/${leagueKey}/partida/${game.id}`;

    return (
        <div className="match-page">
            <div className="match-page-nav">
                <button type="button" className="back-link" onClick={() => navigate(-1)}>
                    <ChevronIcon /> Voltar
                </button>
                <Link className="back-link" to={pathFor(leagueKey, 'today')}>
                    {league.label}
                </Link>
            </div>

            <header className="match-hero" style={{ '--accent': league.accent }}>
                <p className="match-hero-meta">
                    <span className="match-comp">{league.short}</span>
                    <span>{brDateLabel(game.dateKey)}</span>
                    <span>{game.time}</span>
                    {game.live && <span className="state live"><i />{game.clock || 'ao vivo'}</span>}
                    {game.finished && <span className="state">Encerrado</span>}
                </p>

                <div className="match-hero-teams">
                    <div className="hero-team">
                        <Crest src={game.home.crest} size={54} />
                        <span className="hero-name">{game.home.name}</span>
                    </div>
                    <div className="hero-score">
                        {game.state === 'pre'
                            ? <span className="hero-vs">×</span>
                            : (
                                <>
                                    <span className={decided && game.home.score < game.away.score ? 'dim' : ''}>
                                        {game.home.score ?? 0}
                                    </span>
                                    <span className="hero-dash">–</span>
                                    <span className={decided && game.away.score < game.home.score ? 'dim' : ''}>
                                        {game.away.score ?? 0}
                                    </span>
                                </>
                            )}
                        {game.home.pens != null && game.away.pens != null && (
                            <span className="hero-pens">
                                pênaltis {game.home.pens}–{game.away.pens}
                            </span>
                        )}
                    </div>
                    <div className="hero-team">
                        <Crest src={game.away.crest} size={54} />
                        <span className="hero-name">{game.away.name}</span>
                    </div>
                </div>

                {game.note && <p className="match-hero-note">{game.note}</p>}
            </header>

            <nav className="tabs sub-tabs" aria-label="Painéis da partida">
                <NavLink to={`${base}/lances`} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
                    Lances
                </NavLink>
                <NavLink to={`${base}/escalacao`} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
                    <ShirtIcon /> Escalação
                </NavLink>
            </nav>

            {panel === 'escalacao'
                ? <Lineup game={game} state={lineups.get(game.id)} />
                : hasMatchDetail(game)
                    ? <MatchTimelinePanel game={game} />
                    : (
                        <div className="match-detail">
                            <p className="detail-empty">A ESPN não publicou os lances desta partida.</p>
                        </div>
                    )}
        </div>
    );
}
