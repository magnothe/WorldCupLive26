import { CREST_FALLBACK } from '../api/leagues.js';

/** Escudo do time — cai no brasão genérico quando a imagem da ESPN falha. */
export default function Crest({ src, size = 26, className = '', alt = '', title }) {
    return (
        <img
            className={className}
            src={src || CREST_FALLBACK}
            alt={alt}
            title={title}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            onError={e => {
                if (e.currentTarget.src === CREST_FALLBACK) return;
                e.currentTarget.src = CREST_FALLBACK;
            }}
        />
    );
}
