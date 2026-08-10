import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { getRiskConfig } from '../utils/risk';
import { formatKDA, formatHours } from '../utils/format';

export default function PlayerTable({ serverState }) {
  const { t } = useSettings();
  const { server, players } = serverState;

  return (
    <div className="player-table">
      <div className="player-table__header">
        <span>{t('player')}</span>
        <span style={{ textAlign: 'center' }}>{t('kills')}</span>
        <span style={{ textAlign: 'center' }}>{t('deaths')}</span>
        <span style={{ textAlign: 'center' }}>{t('kd')}</span>
        <span style={{ textAlign: 'center' }}>{t('hs')}</span>
        <span style={{ textAlign: 'center' }}>{t('accuracy')}</span>
        <span style={{ textAlign: 'center' }}>{t('hours')}</span>
        <span style={{ textAlign: 'center' }}>{t('risk')}</span>
      </div>

      {players.map((player, i) => (
        <PlayerRow key={`${player.steamid}-${player.name}-${i}`} player={player} />
      ))}

      {players.length === 0 && (
        <div className="empty-state">
          <p>{t('no_players')}</p>
          <p className="empty-state__hint">{server?.name || `${server?.ip}:${server?.port}`}</p>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player }) {
  const risk = getRiskConfig(player.risk_level);
  const stats = player.rust_stats;
  const kda = stats?.kda;
  const kdaClass = kda === undefined || kda === null ? '' : kda >= 3 ? 'kda--high' : kda >= 1.5 ? 'kda--mid' : 'kda--low';
  const infoLines = [
    `ID: ${player.steamid}`,
    player.account_age_days ? `Cuenta: ${Math.round(player.account_age_days / 365.25)} años` : null,
    player.ping != null ? `Ping: ${player.ping}` : null,
  ].filter(Boolean);

  return (
    <div className="player-row" style={{ borderLeftColor: risk.color }}>
      <div className="player-row__identity">
        <img
          className="player-row__avatar"
          src={player.avatar_medium || player.avatar || 'https://avatars.steamstatic.com/fef49e7da7e0d2d2f3a1d6e4e1a1c0f1.jpg'}
          alt=""
          loading="lazy"
        />
        <div style={{ minWidth: 0 }}>
          <div className="player-row__name" title={infoLines.join(' · ')}>{player.name}</div>
          {(player.vac_banned || player.game_bans > 0 || player.is_private) && (
            <div className="player-row__flags">
              {player.vac_banned && <span style={{ color: 'var(--red)' }}>VAC BAN</span>}
              {player.game_bans > 0 && <span style={{ color: 'var(--sky)' }}>{player.game_bans} GAME BAN</span>}
              {player.is_private && <span>PRIVADO</span>}
            </div>
          )}
        </div>
      </div>

      <div className="player-row__cell">
        {stats ? (stats.kills ?? '—') : <span className="player-row__cell--muted">—</span>}
      </div>

      <div className="player-row__cell">
        {stats ? (stats.deaths ?? '—') : <span className="player-row__cell--muted">—</span>}
      </div>

      <div className={`player-row__cell ${kdaClass}`}>
        {stats ? formatKDA(kda) : <span className="player-row__cell--muted">—</span>}
      </div>

      <div className="player-row__cell hs">
        {stats ? `${stats.hs_ratio?.toFixed(1) ?? '—'}%` : <span className="player-row__cell--muted">—</span>}
      </div>

      <div className="player-row__cell">
        {stats ? `${stats.accuracy_percent?.toFixed(1) ?? '—'}%` : <span className="player-row__cell--muted">—</span>}
      </div>

      <div className="player-row__cell">{formatHours(player.rust_playtime_hours)}</div>

      <div style={{ textAlign: 'center' }}>
        <span className={`risk-badge risk-badge--${player.risk_level}`} title={player.risk_reasons.join(', ')}>
          {risk.label}
        </span>
      </div>
    </div>
  );
}
