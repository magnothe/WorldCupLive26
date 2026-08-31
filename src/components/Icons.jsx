import './Icons.css';

/* Ícones em SVG inline — nada de emoji. */

export function BallIcon() {
    return (
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.2 10.6 6.1 9.6 9.2H6.4L5.4 6.1z" fill="currentColor" />
        </svg>
    );
}

export function CardIcon() {
    return (
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="4.5" y="2.5" width="7" height="11" rx="1.2" fill="currentColor" />
        </svg>
    );
}

export function DoubleCardIcon() {
    return (
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="3" width="6" height="10" rx="1.1" fill="var(--yellow)" />
            <rect x="8" y="3" width="6" height="10" rx="1.1" fill="var(--red)" />
        </svg>
    );
}

export function SubIcon() {
    return (
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 5.5h8.5m0 0L8.6 3.2M11 5.5 8.6 7.8" fill="none" stroke="var(--green)"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.5 10.5H5m0 0 2.4-2.3M5 10.5l2.4 2.3" fill="none" stroke="var(--red)"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ChevronIcon() {
    return (
        <svg className="chev" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ShirtIcon() {
    return (
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 2 2.5 4l1.2 3L5 6.5V14h6V6.5L12.3 7l1.2-3L10 2a2 2 0 0 1-4 0z"
                  fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
    );
}

export function ArrowInIcon() {
    return (
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h8m0 0L8.3 5.3M11 8l-2.7 2.7" fill="none" stroke="currentColor"
                  strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
