import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { formatDuration } from '../utils/format';

export default function ServerPanel({ server, players }) {
  const { t } = useSettings();
  const highRisk = players.filter((p) => p.risk_level === 'high').length;
  const privateCount = players.filter((p) => p.is_private).length;

  const uptime = server.connected_since
    ? formatDuration((Date.now() - new Date(server.connected_since).getTime()) / 1000)
    : '—';

  return (
    <div>
      <div className="section-title">
        {t('tab_server')} <span>{t('server_current')}</span>
      </div>

      <div className="card server-hero">
        <div className="server-hero__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="7" rx="2" />
            <rect x="3" y="13" width="18" height="7" rx="2" />
            <circle cx="7" cy="7.5" r="0.8" fill="currentColor" />
            <circle cx="7" cy="16.5" r="0.8" fill="currentColor" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="server-hero__name">{server.name || `${server.ip}:${server.port}`}</div>
          <div className="server-hero__meta">
            {server.map || '—'} · {players.length}/{server.players_max || '?'} ·{' '}
            {uptime !== '—' && `${t('connected')} ${uptime}`}
          </div>
        </div>
      </div>

      <div className="server-grid">
        <div className="card server-stat">
          <p className="card__label">{t('player')}s</p>
          <p className="card__value card__value--cyan">{players.length}</p>
          <p className="card__sub">{t('connected_now')}</p>
        </div>
        <div className="card server-stat">
          <p className="card__label">{t('high_risk')}</p>
          <p className="card__value card__value--red">{highRisk}</p>
          <p className="card__sub">{t('possible_cheaters')}</p>
        </div>
        <div className="card server-stat">
          <p className="card__label">{t('private_profiles')}</p>
          <p className="card__value">{privateCount}</p>
          <p className="card__sub">{t('unverifiable')}</p>
        </div>
      </div>
    </div>
  );
}
