import React from 'react';
import { useSettings } from '../context/SettingsContext';

/* Letras del letrero: cada una con un "estado de tubo" distinto
   - flick    : parpadeo errático (caídas de voltaje)
   - soft     : apenas oscila (tubo casi estable)
   - hard     : mayormente apagado, enciende a ráfagas
   - dead     : tubo fundido, completamente oscuro (sin brillo)
   - space    : separador entre palabras                      */
const LETTERS = [
  { ch: 'S', kind: 'flick', delay: 0.0 },
  { ch: 'I', kind: 'flick', delay: 0.9 },
  { ch: 'N', kind: 'dead', delay: 0 },
  { ch: ' ', kind: 'space' },
  { ch: 'C', kind: 'soft', delay: 2.2 },
  { ch: 'O', kind: 'flick', delay: 0.4 },
  { ch: 'N', kind: 'dead', delay: 0 },
  { ch: 'E', kind: 'flick', delay: 1.7 },
  { ch: 'X', kind: 'hard', delay: 0.6 },
  { ch: 'I', kind: 'flick', delay: 1.1 },
  { ch: 'Ó', kind: 'flick', delay: 2.6 },
  { ch: 'N', kind: 'flick', delay: 0.2 },
];

const KIND_CLASS = {
  flick: 'nc-let--flick',
  soft: 'nc-let--soft',
  hard: 'nc-let--hard',
  dead: 'nc-let--dead',
  space: 'nc-let--space',
};

export default function NoConnectionPanel() {
  const { t, opacity } = useSettings();

  return (
    <div
      className="nc"
      /* Fondo con alpha dinámico: respeta la opacidad del overlay */
      style={{ backgroundColor: `rgba(11, 14, 20, ${opacity})` }}
    >
      <style>{NC_CSS}</style>

      {/* Luz del neón proyectada sobre la "pared" oscura */}
      <div className="nc-halo" aria-hidden="true" />

      {/* Letrero de neón dañado */}
      <h1 className="nc-neon">
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className={`nc-let ${KIND_CLASS[l.kind]}`}
            style={{ '--d': `${l.delay}s` }}
          >
            {l.ch === ' ' ? '\u00A0' : l.ch}
          </span>
        ))}
      </h1>

      <p className="nc-sub">{t('noConnectionSub')}</p>

      {/* Escaneo activo: barrido de radar */}
      <div className="nc-scan" aria-hidden="true">
        <span className="nc-scan__beam" />
        <span className="nc-scan__dot" />
      </div>
    </div>
  );
}

/* ============================================================
   Estilos locales (scoped por prefijo nc-) — reutiliza las
   variables de diseño globales. Solo los keyframes del neón
   dañado, el radar y las texturas de fondo viven aquí.
   ============================================================ */
const NC_CSS = `
/* El contenedor padre (.content) pierde su padding SOLO cuando este
   componente está montado (:has): así .nc ocupa la pantalla completa
   borde a borde y el fondo (alpha dinámico + gradiente + ruido) se
   funde sin cortes horizontales ni bordes duros. */
.content:has(.nc) {
  padding: 0;
}

.nc {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 32px;
  text-align: center;
  overflow: hidden;
  /* El color base con alpha dinámico viene por inline style.
     El gradiente radial naranja va encima y se funde a transparente. */
  background-image: radial-gradient(ellipse at 50% 44%, rgba(249, 115, 22, 0.07), transparent 62%);
}

/* ---------- Textura de ruido EXTREMADAMENTE sutil (anti-plano) ---------- */

.nc::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---------- Halo del neón sobre la pared ---------- */

.nc-halo {
  position: absolute;
  z-index: 0;
  top: 50%;
  left: 50%;
  width: min(720px, 90vmin);
  height: min(320px, 42vmin);
  transform: translate(-50%, -50%);
  background: radial-gradient(ellipse, rgba(249, 115, 22, 0.13), rgba(217, 119, 54, 0.05) 55%, transparent 75%);
  filter: blur(14px);
  pointer-events: none;
  animation: nc-halo-pulse 6s ease-in-out infinite;
}

@keyframes nc-halo-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}

/* ---------- Letrero de neón ---------- */

.nc-neon {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
  font-weight: 900;
  font-size: clamp(30px, 6.5vh, 52px);
  letter-spacing: 0.18em;
  line-height: 1.15;
  text-transform: uppercase;
  color: #ffe3c8;
  user-select: none;
  --glow: 0 0 6px rgba(255, 173, 107, 0.95), 0 0 18px rgba(249, 115, 22, 0.6), 0 0 44px rgba(217, 119, 54, 0.35);
  --glow-dim: 0 0 3px rgba(255, 173, 107, 0.4), 0 0 10px rgba(249, 115, 22, 0.25);
  --glow-off: 0 0 2px rgba(249, 115, 22, 0.15);
}

.nc-let {
  display: inline-block;
  text-shadow: var(--glow);
}

.nc-let--space {
  width: 0.42em;
}

.nc-let--flick { animation: nc-flick 4.6s linear infinite; animation-delay: var(--d, 0s); }
.nc-let--soft  { animation: nc-soft 6.4s linear infinite; animation-delay: var(--d, 0s); }
.nc-let--hard  { animation: nc-hard 3.4s linear infinite; animation-delay: var(--d, 0s); }

/* Tubo fundido: gris oscuro, sin brillo */
.nc-let--dead {
  color: #4a4540;
  text-shadow: none;
}

/* Parpadeo errático: caídas de voltaje + apagones breves */
@keyframes nc-flick {
  0%, 100% { opacity: 1; text-shadow: var(--glow); }
  6%       { opacity: 1; text-shadow: var(--glow); }
  8%       { opacity: 0.3; text-shadow: var(--glow-dim); }
  10%      { opacity: 1; text-shadow: var(--glow); }
  21%      { opacity: 0.9; }
  23%      { opacity: 0.2; text-shadow: var(--glow-off); }
  25%      { opacity: 1; text-shadow: var(--glow); }
  38%      { opacity: 0.85; }
  40%      { opacity: 0.45; text-shadow: var(--glow-dim); }
  42%      { opacity: 1; text-shadow: var(--glow); }
  59%      { opacity: 0.95; }
  61%      { opacity: 0.15; text-shadow: var(--glow-off); }
  63%      { opacity: 1; text-shadow: var(--glow); }
  78%      { opacity: 0.8; }
  80%      { opacity: 0.5; text-shadow: var(--glow-dim); }
  82%      { opacity: 1; text-shadow: var(--glow); }
  92%      { opacity: 0.85; }
  94%      { opacity: 0.35; text-shadow: var(--glow-dim); }
  96%      { opacity: 1; text-shadow: var(--glow); }
}

/* Casi estable: apenas respira */
@keyframes nc-soft {
  0%, 100% { opacity: 1; text-shadow: var(--glow); }
  30%      { opacity: 0.9; }
  32%      { opacity: 0.65; text-shadow: var(--glow-dim); }
  34%      { opacity: 1; text-shadow: var(--glow); }
  68%      { opacity: 0.95; }
  70%      { opacity: 0.7; text-shadow: var(--glow-dim); }
  72%      { opacity: 1; text-shadow: var(--glow); }
}

/* Mayormente muerto: se enciende a ráfagas (la "X") */
@keyframes nc-hard {
  0%, 100% { opacity: 0.12; text-shadow: var(--glow-off); }
  7%       { opacity: 1; text-shadow: var(--glow); }
  11%      { opacity: 0.1; text-shadow: var(--glow-off); }
  13%      { opacity: 0.85; text-shadow: var(--glow-dim); }
  15%      { opacity: 0.08; text-shadow: var(--glow-off); }
  28%      { opacity: 1; text-shadow: var(--glow); }
  31%      { opacity: 0.1; text-shadow: var(--glow-off); }
  55%      { opacity: 0.95; text-shadow: var(--glow-dim); }
  58%      { opacity: 0.1; text-shadow: var(--glow-off); }
  86%      { opacity: 0.7; text-shadow: var(--glow-dim); }
  89%      { opacity: 0.12; text-shadow: var(--glow-off); }
}

/* ---------- Subtexto ---------- */

.nc-sub {
  position: relative;
  z-index: 1;
  max-width: 400px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-muted);
}

/* ---------- Indicador de escaneo (radar) ---------- */

.nc-scan {
  position: relative;
  z-index: 1;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(249, 115, 22, 0.4);
  background: rgba(249, 115, 22, 0.06);
  overflow: hidden;
  box-shadow: 0 0 12px rgba(249, 115, 22, 0.25), inset 0 0 6px rgba(249, 115, 22, 0.2);
}

.nc-scan__beam {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(249, 115, 22, 0.55), transparent 70deg);
  animation: nc-radar 2.2s linear infinite;
}

.nc-scan__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: #fdba74;
  box-shadow: 0 0 8px rgba(249, 115, 22, 0.9);
  animation: nc-ping 2.2s ease-in-out infinite;
}

@keyframes nc-radar {
  to { transform: rotate(360deg); }
}

@keyframes nc-ping {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.7); }
}

@media (max-width: 640px) {
  .nc-neon {
    font-size: clamp(24px, 8vw, 34px);
    letter-spacing: 0.1em;
  }
}
`;