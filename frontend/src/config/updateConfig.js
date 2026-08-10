export const UPDATE_CONFIG = {
  githubOwner: import.meta.env.VITE_GITHUB_OWNER || 'GITHUB_OWNER',
  githubRepo: import.meta.env.VITE_GITHUB_REPO || 'GITHUB_REPO',
  releaseChannel: 'latest',
  fallbackReleaseJsonUrl: import.meta.env.VITE_GITHUB_FALLBACK_RELEASE_JSON || null,
  githubApiBase: 'https://api.github.com',
};

export const isUpdateConfigured = () => {
  const hasGitHub =
    UPDATE_CONFIG.githubOwner &&
    UPDATE_CONFIG.githubOwner !== 'GITHUB_OWNER' &&
    UPDATE_CONFIG.githubRepo &&
    UPDATE_CONFIG.githubRepo !== 'GITHUB_REPO';

  return hasGitHub || Boolean(UPDATE_CONFIG.fallbackReleaseJsonUrl);
};

export const PUBLISHER_CONFIG = {
  defaultTargetBranch: 'main',
  githubOwner: import.meta.env.VITE_GITHUB_OWNER || 'GITHUB_OWNER',
  githubRepo: import.meta.env.VITE_GITHUB_REPO || 'GITHUB_REPO',
};
