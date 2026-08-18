/* ──────────────────────────────────────────────
   dates.js — Helpers de data (fuso de Brasília)
   ────────────────────────────────────────────── */

export const TZ = 'America/Sao_Paulo';

/* Construir um Intl.DateTimeFormat é caro (~0,1 ms). Uma temporada tem 380
   partidas e cada uma precisa de data + hora — criar os formatadores dentro
   da função custava ~760 construções por liga carregada. Criados uma vez. */
const FMT_DATE_KEY = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const FMT_TIME = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});
const FMT_DATE_LABEL = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/** "2026-08-11" na timezone de Brasília, a partir de um Date. */
export function brDateKey(date) {
    // en-CA já formata como YYYY-MM-DD, então não é preciso remontar as partes
    return FMT_DATE_KEY.format(date);
}

/** "HH:MM" no fuso de Brasília. */
export function brTime(date) {
    return FMT_TIME.format(date);
}

/** "segunda-feira, 11 de agosto de 2026" a partir de uma chave "YYYY-MM-DD". */
const dateLabelCache = new Map();
export function brDateLabel(key) {
    let label = dateLabelCache.get(key);
    if (label) return label;

    const [y, m, d] = key.split('-').map(Number);
    label = FMT_DATE_LABEL.format(new Date(Date.UTC(y, m - 1, d, 12)));
    dateLabelCache.set(key, label);
    return label;
}

/** "YYYYMMDD" — formato aceito pelo parâmetro `dates` da ESPN. */
export function espnDate(key) {
    return key.replace(/-/g, '');
}

/** Chave de hoje no fuso de Brasília. */
export const todayKey = () => brDateKey(new Date());

/** Desloca uma chave "YYYY-MM-DD" em N dias. */
export function shiftDateKey(key, days) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

/**
 * Intervalo de datas da temporada. `back = 1` devolve a temporada anterior.
 * Ligas europeias começam em julho e terminam em junho do ano seguinte.
 */
export function seasonWindow(league, back) {
    const now  = new Date();
    const step = back || 0;

    if (league.season === 'cross') {
        const startYear = (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1) - step;
        return { from: `${startYear}-07-01`, to: `${startYear + 1}-06-30`, year: startYear };
    }

    const y = now.getFullYear() - step;
    return { from: `${y}-01-01`, to: `${y}-12-31`, year: y };
}
