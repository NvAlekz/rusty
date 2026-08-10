import React from 'react';
import { useSettings } from '../context/SettingsContext';

export default function NoConnectionPanel({ onRefresh, refreshing }) {
  const { t } = useSettings();

  return (
    <div className="noconnection">
      <h1 className="noconnection__title">{t('noConnectionTitle')}</h1>
      <p className="noconnection__sub">{t('noConnectionSub')}</p>
      <button
        className="btn-cyan"
        onClick={onRefresh}
        disabled={refreshing}
        style={{ padding: '11px 24px', fontSize: '11px' }}
      >
        <svg
          className={`btn-cyan__icon ${refreshing ? 'spinner' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
        </svg>
        {refreshing ? t('syncing') : t('syncNow')}
      </button>
    </div>
  );
}
