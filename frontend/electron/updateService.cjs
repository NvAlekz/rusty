const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

const USER_AGENT = 'RustTrackerAutoUpdater/1.0';

function safeFetch(...args) {
  if (typeof fetch === 'function') {
    return fetch(...args);
  }
  throw new Error('global fetch no disponible en este runtime');
}

function ensureHttpUrl(url) {
  if (!url) return url;
  return url.replace(/^git@github\.com:/, 'https://github.com/');
}

function request(urlString, options = {}) {
  const url = new URL(urlString);
  const requestOptions = {
    method: options.method || 'GET',
    headers: options.headers || {},
    timeout: options.timeout || 30000,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, requestOptions, async (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        try {
          const redirected = await request(new URL(res.headers.location, url).toString(), options);
          resolve(redirected);
        } catch (err) {
          reject(err);
        }
        return;
      }
      resolve(res);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function readResponseText(response) {
  return new Promise((resolve, reject) => {
    let data = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => resolve(data));
    response.on('error', reject);
  });
}

async function fetchJson(url, options = {}) {
  const response = await request(url, options);
  const text = await readResponseText(response);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Fetch failed: ${response.statusCode} ${response.statusMessage} ${text}`);
  }
  return JSON.parse(text);
}

async function fetchText(url, options = {}) {
  const response = await request(url, options);
  const text = await readResponseText(response);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Fetch failed: ${response.statusCode} ${response.statusMessage} ${text}`);
  }
  return text;
}

function parseChecksumText(text) {
  const normalized = text.trim().split(/\s+/)[0] || '';
  return normalized.toLowerCase();
}

function buildAssetName(filePath) {
  return path.basename(filePath);
}

function selectAsset(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const preferredExtensions = ['.exe', '.msi', '.zip'];
  for (const ext of preferredExtensions) {
    const match = assets.find((asset) => asset.name?.toLowerCase().endsWith(ext));
    if (match) return match;
  }
  return assets[0];
}

function getContentTypeForAsset(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.exe')) return 'application/octet-stream';
  if (lower.endsWith('.msi')) return 'application/octet-stream';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage';
  return 'application/octet-stream';
}

async function fetchLatestReleaseFromGithub(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  return fetchJson(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
    },
  });
}

async function downloadReleaseChecksum(checksumUrl, headers = {}) {
  const text = await fetchText(checksumUrl, { headers });
  return parseChecksumText(text);
}

function deriveChecksumAsset(assets, releaseAsset) {
  const baseName = releaseAsset?.name?.replace(/\.(exe|msi|zip)$/i, '');
  const candidateNames = [
    `${releaseAsset.name}.sha256`,
    `${releaseAsset.name}.sha256.txt`,
    `${baseName}.sha256`,
    `${baseName}.sha256.txt`,
    'checksums.txt',
    'sha256.txt',
  ];

  return assets.find((asset) => candidateNames.some((name) => asset.name?.toLowerCase() === name.toLowerCase()));
}

async function getLatestRelease(owner, repo, fallbackJsonUrl) {
  if (fallbackJsonUrl) {
    const data = await fetchJson(fallbackJsonUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!data.latestVersion || !data.downloadUrl) {
      throw new Error('Fallback JSON no contiene latestVersion o downloadUrl');
    }
    return {
      tagName: data.tagName || data.latestVersion,
      latestVersion: data.latestVersion,
      body: data.body || '',
      publishedAt: data.publishedAt || new Date().toISOString(),
      downloadUrl: data.downloadUrl,
      checksumUrl: data.checksumUrl || null,
    };
  }

  const release = await fetchLatestReleaseFromGithub(owner, repo);
  const asset = selectAsset(release.assets);
  if (!asset) {
    throw new Error('No se encontró un asset adecuado en el release');
  }

  const checksumAsset = deriveChecksumAsset(release.assets, asset);
  return {
    tagName: release.tag_name,
    latestVersion: release.tag_name,
    body: release.body || '',
    publishedAt: release.published_at || release.publishedAt || new Date().toISOString(),
    downloadUrl: asset.browser_download_url,
    checksumUrl: checksumAsset?.browser_download_url || null,
  };
}

function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function downloadFile(url, destinationPath, onProgress, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return resolve(downloadFile(response.headers.location, destinationPath, onProgress, headers));
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${response.statusCode}`));
      }

      const totalBytes = Number(response.headers['content-length'] || 0);
      let receivedBytes = 0;
      const fileStream = fs.createWriteStream(destinationPath);

      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (onProgress) {
          onProgress({ bytesReceived: receivedBytes, bytesTotal: totalBytes });
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => resolve({ bytesReceived: receivedBytes, bytesTotal: totalBytes }));
      fileStream.on('error', reject);
      response.on('error', reject);
    });

    request.on('error', reject);
  });
}

async function publishGithubRelease({ owner, repo, token, version, title, notes, targetBranch, filePath }) {
  const semverVersion = version.startsWith('v') ? version : `v${version}`;
  const apiBase = 'https://api.github.com';
  const authHeaders = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
  };

  const releaseByTagUrl = `${apiBase}/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(semverVersion)}`;
  try {
    const existingRelease = await fetchJson(releaseByTagUrl, { headers: authHeaders });
    throw new Error(`Ya existe un release para la etiqueta ${semverVersion}: ${existingRelease.html_url}`);
  } catch (error) {
    if (!error.message.includes('404')) {
      throw error;
    }
  }

  const releaseResponse = await fetchJson(`${apiBase}/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tag_name: semverVersion,
      target_commitish: targetBranch,
      name: title,
      body: notes,
      draft: false,
      prerelease: false,
    }),
  });

  const uploadUrl = releaseResponse.upload_url.replace(/\{.*$/, '');
  const assetName = buildAssetName(filePath);
  const assetUrl = `${uploadUrl}?name=${encodeURIComponent(assetName)}`;
  const assetType = getContentTypeForAsset(assetName);

  const fileBuffer = await fs.promises.readFile(filePath);
  const uploadRes = await safeFetch(assetUrl, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': assetType,
      'Content-Length': Buffer.byteLength(fileBuffer),
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const bodyText = await uploadRes.text();
    throw new Error(`Error al subir asset: ${uploadRes.status} ${uploadRes.statusText} ${bodyText}`);
  }

  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const checksumName = `${assetName}.sha256.txt`;
  const checksumAssetUrl = `${uploadUrl}?name=${encodeURIComponent(checksumName)}`;
  const checksumResponse = await safeFetch(checksumAssetUrl, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'text/plain;charset=utf-8',
      'Content-Length': Buffer.byteLength(`${checksum}  ${assetName}\n`),
    },
    body: `${checksum}  ${assetName}\n`,
  });

  if (!checksumResponse.ok) {
    const bodyText = await checksumResponse.text();
    throw new Error(`Error al subir checksum: ${checksumResponse.status} ${checksumResponse.statusText} ${bodyText}`);
  }

  return {
    releaseUrl: releaseResponse.html_url,
    assetUrl,
    checksumUrl: checksumAssetUrl,
  };
}

module.exports = {
  getLatestRelease,
  downloadFile,
  computeSha256,
  downloadReleaseChecksum,
  publishGithubRelease,
};
