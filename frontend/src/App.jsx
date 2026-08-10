import React, { useState, Suspense, lazy } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { useTrackerWebSocket } from './hooks/useTrackerWebSocket';
import { useAutoUpdate } from './hooks/useAutoUpdate';
import TopBar from './components/TopBar';
import NoConnectionPanel from './components/NoConnectionPanel';
import ServerPanel from './components/ServerPanel';
import PlayerTable from './components/PlayerTable';
import RaidCalculator from './components/RaidCalculator';
import SettingsPanel from './components/SettingsPanel';
import UpdateModal from './components/UpdateModal';

const BaseBuilder = lazy(() => import('./components/BaseBuilder'));

function AppContent() {
  const [activeTab, setActiveTab] = useState('server');
  const [refreshing, setRefreshing] = useState(false);

  const { connected, serverState, trackerStatus, requestRefresh } = useTrackerWebSocket();
  const {
    releaseInfo,
    checking,
    error,
    downloadProgress,
    updateState,
    remindLater,
    skipVersion,
    downloadUpdate,
    installUpdate,
  } = useAutoUpdate();

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    requestRefresh();
    setTimeout(() => setRefreshing(false), 900);
  };

  const handleInstall = async () => {
    await downloadUpdate();
    await installUpdate();
  };

  const server = serverState?.server;
  const players = serverState?.players || [];

  const renderContent = () => {
    if (!connected || !server) {
      if (activeTab === 'raid' || activeTab === 'build') {
        return renderOfflineTab();
      }
      return <NoConnectionPanel onRefresh={handleRefresh} refreshing={refreshing} />;
    }

    switch (activeTab) {
      case 'players':
        return <PlayerTable serverState={serverState} />;
      case 'raid':
        return <RaidCalculator />;
      case 'build':
        return <BaseBuilder />;
      case 'settings':
        return <SettingsPanel trackerStatus={trackerStatus} connected={connected} />;
      case 'server':
      default:
        return <ServerPanel server={server} players={players} />;
    }
  };

  const renderOfflineTab = () => {
    if (activeTab === 'raid') return <RaidCalculator />;
    if (activeTab === 'build') return <BaseBuilder />;
    return null;
  };

  return (
    <div className="shell">
      <div className="fog" aria-hidden="true">
        <div className="fog__blob fog__blob--a" />
        <div className="fog__blob fog__blob--b" />
      </div>

      <TopBar
        connected={connected}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="content">
        <Suspense fallback={<div className="build__loading">Cargando constructor 3D...</div>}>
          {renderContent()}
        </Suspense>
      </div>

      {checking && (
        <div className="update-status update-status--info" style={{ position: 'fixed', top: 60, right: 14, zIndex: 50 }}>
          Comprobando actualizaciones...
        </div>
      )}

      {error && (
        <div className="update-status update-status--error" style={{ position: 'fixed', top: 60, right: 14, zIndex: 50 }}>
          {error}
        </div>
      )}

      {releaseInfo && (
        <UpdateModal
          release={releaseInfo}
          progress={downloadProgress}
          state={updateState}
          onInstall={handleInstall}
          onSkip={skipVersion}
          onRemindLater={remindLater}
          onClose={remindLater}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
