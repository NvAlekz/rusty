import React from 'react';
import { useSettings } from '../context/SettingsContext';

const TABS = [
  { id: 'server', key: 'tab_server', icon: ServerIcon },
  { id: 'players', key: 'tab_players', icon: UsersIcon },
  { id: 'raid', key: 'tab_raid', icon: RaidIcon },
  { id: 'build', key: 'tab_build', icon: BuildIcon },
  { id: 'settings', key: 'tab_settings', icon: GearIcon },
];

export default function TopBar({ connected, onRefresh, refreshing, activeTab, onTabChange }) {
  const { t } = useSettings();
  const win = window.electronAPI;

  return (
    <header className="topbar">
      <div className="topbar__left">
        <Logo />
        <StatusPill connected={connected} t={t} />
      </div>

      <nav className="navtabs">
        {TABS.map(({ id, key, icon: Icon }) => (
          <button
            key={id}
            className={`navtab ${activeTab === id ? 'navtab--active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            <Icon className="navtab__icon" />
            {t(key)}
          </button>
        ))}
      </nav>

      <div className="topbar__right">
        <button
          className="btn-cyan btn-cyan--icon"
          onClick={onRefresh}
          disabled={refreshing}
          title={refreshing ? t('syncing') : t('refresh')}
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
        </button>
        <div className="winctrl">
          <button
            className="winctrl__btn"
            title={t('minimize')}
            onClick={() => win && win.minimizeWindow && win.minimizeWindow()}
          >
            <MinimizeIcon className="winctrl__icon" />
          </button>
          <button
            className="winctrl__btn winctrl__btn--close"
            title={t('close')}
            onClick={() => win && win.closeApp && win.closeApp()}
          >
            <XIcon className="winctrl__icon" />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Subcomponentes ---------- */

function Logo() {
  return (
    <div className="logo">
      <svg className="logo__icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 2 L28 8 V24 L16 30 L4 24 V8 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M16 8 L16 24 M8 16 L24 16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
      </svg>
      <span className="logo__text">RUST TRACKER</span>
    </div>
  );
}

function StatusPill({ connected, t }) {
  return (
    <div className={`status-pill ${connected ? '' : 'status-pill--off'}`}>
      <span className={`status-pill__dot ${connected ? 'status-pill__dot--on' : 'status-pill__dot--off'}`} />
      <span className="status-pill__text">{connected ? t('connected') : t('disconnected')}</span>
    </div>
  );
}

/* ---------- Iconos SVG (minimalistas, cyan) ---------- */

function ServerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <circle cx="7" cy="7.5" r="0.8" fill="currentColor" />
      <circle cx="7" cy="16.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function UsersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M17.5 15.3c2 .7 3.5 2.3 3.5 4.7" />
    </svg>
  );
}

function GearIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </svg>
  );
}

function RaidIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 17 17 6" />
      <path d="m14 5 5 5" />
      <path d="M5 19h6" />
      <path d="M18 14c1.8 1.1 3 2.9 3 5" />
      <path d="M15 17c.9.6 1.5 1.6 1.5 2.8" />
    </svg>
  );
}

function BuildIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 21 1.5-1.5M17 21l1.5-1.5M3 15l8-8M17 6l4-1-1 4M13 3l8 8" />
      <rect x="3" y="17" width="8" height="4" />
      <path d="M6 21v-3" />
    </svg>
  );
}

function MinimizeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
