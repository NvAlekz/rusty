import { useEffect, useMemo, useState } from 'react';
import { UPDATE_CONFIG, isUpdateConfigured } from '../config/updateConfig';
import { isSemVerGreater } from '../utils/semver';

const STORAGE_KEYS = {
  ignoredVersion: 'autoUpdate:ignoredVersion',
  lastCheckedAt: 'autoUpdate:lastCheckedAt',
};

export function useAutoUpdate() {
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [releaseInfo, setReleaseInfo] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [updateState, setUpdateState] = useState('idle');
  const [downloadedFilePath, setDownloadedFilePath] = useState(null);

  useEffect(() => {
    window.electronAPI?.getAppVersion()?.then(setCurrentVersion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentVersion || !isUpdateConfigured()) return;
    checkForUpdate();
  }, [currentVersion]);

  useEffect(() => {
    const handleProgress = (_, progress) => {
      setDownloadProgress(progress);
    };

    window.electronAPI?.onUpdateProgress(handleProgress);
    return () => window.electronAPI?.removeUpdateProgress(handleProgress);
  }, []);

  const ignoredVersion = useMemo(() => localStorage.getItem(STORAGE_KEYS.ignoredVersion), []);

  async function checkForUpdate() {
    if (!isUpdateConfigured()) {
      setChecking(false);
      setReleaseInfo(null);
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const result = await window.electronAPI?.checkForUpdate({
        owner: UPDATE_CONFIG.githubOwner,
        repo: UPDATE_CONFIG.githubRepo,
        fallbackJsonUrl: UPDATE_CONFIG.fallbackReleaseJsonUrl,
      });

      if (!result || !result.latestVersion) {
        setReleaseInfo(null);
        return;
      }

      const normalizedLatest = result.latestVersion.replace(/^v/i, '');
      const normalizedCurrent = currentVersion.replace(/^v/i, '');
      if (!isSemVerGreater(normalizedLatest, normalizedCurrent)) {
        setReleaseInfo(null);
        return;
      }

      if (ignoredVersion === normalizedLatest) {
        setReleaseInfo(null);
        return;
      }

      setReleaseInfo(result);
    } catch (err) {
      setError(err?.message || 'Update check failed');
    } finally {
      setChecking(false);
    }
  }

  const remindLater = () => {
    localStorage.removeItem(STORAGE_KEYS.ignoredVersion);
    checkForUpdate();
  };

  const skipVersion = () => {
    if (releaseInfo?.latestVersion) {
      localStorage.setItem(STORAGE_KEYS.ignoredVersion, releaseInfo.latestVersion.replace(/^v/i, ''));
    }
    setReleaseInfo(null);
  };

  const downloadUpdate = async () => {
    if (!releaseInfo) return null;
    setUpdateState('downloading');
    setDownloadProgress({ percent: 0, bytesReceived: 0, bytesTotal: 0, speed: 0 });

    try {
      const result = await window.electronAPI.downloadUpdate({
        downloadUrl: releaseInfo.downloadUrl,
        checksumUrl: releaseInfo.checksumUrl,
      });
      setDownloadedFilePath(result.downloadedFilePath);
      setUpdateState('downloaded');
      return result;
    } catch (err) {
      setError(err?.message || 'Download failed');
      setUpdateState('error');
      throw err;
    }
  };

  const installUpdate = async () => {
    if (!releaseInfo && !downloadedFilePath) return null;
    setUpdateState('installing');
    return window.electronAPI.installUpdate({
      filePath: downloadedFilePath,
    });
  };

  return {
    currentVersion,
    releaseInfo,
    checking,
    error,
    downloadProgress,
    updateState,
    checkForUpdate,
    remindLater,
    skipVersion,
    downloadUpdate,
    installUpdate,
  };
}
