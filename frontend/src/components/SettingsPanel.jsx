import React from 'react';
import { useSettings } from '../context/SettingsContext';
import DeveloperReleasePanel from './DeveloperReleasePanel';

export default function SettingsPanel({ trackerStatus, connected }) {
  const { opacity, setOpacity, language, setLanguage, t } = useSettings();

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="section-title">
        {t('settings_title')} <span>{t('settings_sub')}</span>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="settings-group">
          <div className="setting-row">
            <div>
              <div className="setting-row__label">{t('opacity_label')}</div>
              <div className="setting-row__desc">{t('opacity_desc')}</div>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(e.target.value / 100)}
            />
            <span className="setting-row__value">{Math.round(opacity * 100)}%</span>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-row__label">{t('language_label')}</div>
              <div className="setting-row__desc">{t('language_desc')}</div>
            </div>
            <select
              className="select-cyan"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="es">{t('lang_es')}</option>
              <option value="en">{t('lang_en')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="card__label" style={{ marginBottom: 10 }}>{t('tracker_status')}</p>
        <div className="status-block">
          <span>
            {t('log_monitoring')}:{' '}
            <strong style={{ color: trackerStatus?.tracking ? 'var(--green)' : 'var(--red)' }}>
              {trackerStatus?.tracking ? t('active') : t('inactive')}
            </strong>
          </span>
          {trackerStatus?.log_file && <span className="mono">{trackerStatus.log_file}</span>}
          <span>
            {t('tracker_connection')}:{' '}
            <strong style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
              {connected ? t('connected_txt') : t('disconnected_txt')}
            </strong>
          </span>
          <span>
            {t('server_status')}:{' '}
            <strong style={{ color: trackerStatus?.connected_to_server ? 'var(--green)' : 'var(--text-muted)' }}>
              {trackerStatus?.connected_to_server ? t('detected') : t('none')}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
