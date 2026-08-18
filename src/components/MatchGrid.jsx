import { useEffect, useState } from 'react';
import MatchCard from './MatchCard.jsx';
import { brDateLabel } from '../api/dates.js';
import './MatchGrid.css';

export const PAGE_SIZE = 40;   // partidas por página nas listas longas

/** Grade simples, usada na tela "Hoje". */
export function MatchGrid({ games, emptyMessage }) {
    if (!games.length) return <p className="empty">{emptyMessage}</p>;

    return (
        <div className="match-grid">
            {games.map(g => <MatchCard key={g.id} game={g} />)}
        </div>
    );
}

/**
 * Lista agrupada por data, paginada.
 *
 * Uma temporada tem ~380 partidas. Montar todas de uma vez são milhares de nós
 * no DOM e centenas de imagens — o que travava a tela "Resultados". O limite
 * corta a lista; o resto entra sob demanda pelo botão do rodapé.
 */
export function GroupedByDate({ games, ascending }) {
    const [limit, setLimit] = useState(PAGE_SIZE);

    // trocar de tela/campeonato (ou terminar de baixar a temporada) recomeça
    // a paginação; o tamanho da lista é a assinatura estável disso
    useEffect(() => { setLimit(PAGE_SIZE); }, [games.length]);

    if (!games.length) return <p className="empty">Nada por aqui.</p>;

    const ordered = games.slice().sort((a, b) => (ascending ? a.date - b.date : b.date - a.date));
    const page    = ordered.slice(0, limit);

    const byDate = new Map();
    page.forEach(g => {
        if (!byDate.has(g.dateKey)) byDate.set(g.dateKey, []);
        byDate.get(g.dateKey).push(g);
    });

    const rest = ordered.length - page.length;

    return (
        <>
            {[...byDate].map(([dateKey, dayGames]) => (
                <section className="date-group" key={dateKey}>
                    <h3 className="date-head">{brDateLabel(dateKey)}</h3>
                    <div className="match-grid">
                        {dayGames
                            .sort((a, b) => a.date - b.date)
                            .map(g => <MatchCard key={g.id} game={g} />)}
                    </div>
                </section>
            ))}

            {rest > 0 && (
                <button type="button" className="load-more" onClick={() => setLimit(l => l + PAGE_SIZE)}>
                    Mostrar mais {Math.min(rest, PAGE_SIZE)} de {rest}
                </button>
            )}
        </>
    );
}
