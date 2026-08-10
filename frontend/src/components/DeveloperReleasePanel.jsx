import React, { useEffect, useState } from 'react';
import { PUBLISHER_CONFIG, UPDATE_CONFIG } from '../config/updateConfig';

const EMPTY_STATUS = { message: '', type: 'info' };

export default function DeveloperReleasePanel() {
  const [owner, setOwner] = useState(PUBLISHER_CONFIG.githubOwner || UPDATE_CONFIG.githubOwner || 'GITHUB_OWNER');
  const [repo, setRepo] = useState(PUBLISHER_CONFIG.githubRepo || UPDATE_CONFIG.githubRepo || 'GITHUB_REPO');
  const [version, setVersion] = useState('1.0.0');
  const [title, setTitle] = useState('Release title');
  const [notes, setNotes] = useState('- Release notes here');
  const [token, setToken] = useState('');
  const [binaryPath, setBinaryPath] = useState('');
  const [status, setStatus] = useState(EMPTY_STATUS);

  useEffect(() => {
    setOwner(UPDATE_CONFIG.githubOwner || 'GITHUB_OWNER');
    setRepo(UPDATE_CONFIG.githubRepo || 'GITHUB_REPO');
  }, []);

  const chooseBinary = async () => {
    const result = await window.electronAPI.selectReleaseBinary();
    if (result?.canceled) return;
    if (result?.filePaths && result.filePaths[0]) {
      setBinaryPath(result.filePaths[0]);
    }
  };

  const publishRelease = async () => {
    if (!version || !binaryPath || !token || !owner || !repo) {
      setStatus({ message: 'Todos los campos son obligatorios.', type: 'error' });
      return;
    }

    setStatus({ message: 'Iniciando publicación...', type: 'info' });

    try {
      const result = await window.electronAPI.publishRelease({
        owner,
        repo,
        version,
        title,
        notes,
        token,
        filePath: binaryPath,
        targetBranch: PUBLISHER_CONFIG.defaultTargetBranch,
      });

      setStatus({ message: `Publicado: ${result.releaseUrl}`, type: 'success' });
    } catch (error) {
      setStatus({ message: error?.message || 'Error al publicar release.', type: 'error' });
    }
  };

  return (
    <div className="card" style={{ marginTop: 14, padding: 16 }}>
      <div className="section-title">Developer Release Panel</div>
      <p style={{ color: '#b9d9ff', marginBottom: 12 }}>
        Usa este panel con un token de GitHub válido y el binario compilado actual.
      </p>

      <label className="field-label">Owner del repositorio</label>
      <input value={owner} onChange={(e) => setOwner(e.target.value)} />

      <label className="field-label">Repositorio</label>
      <input value={repo} onChange={(e) => setRepo(e.target.value)} />

      <label className="field-label">Token de GitHub</label>
      <input type="password" value={token} onChange={(e) => setToken(e.target.value)} />

      <label className="field-label">Versión SemVer</label>
      <input value={version} onChange={(e) => setVersion(e.target.value)} />

      <label className="field-label">Título de Release</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />

      <label className="field-label">Notas de la versión (Markdown)</label>
      <textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="row" style={{ gap: 12, marginTop: 12 }}>
        <button className="button button--secondary" type="button" onClick={chooseBinary}>
          Seleccionar binario
        </button>
        <span className="mono" style={{ flexGrow: 1, overflowWrap: 'anywhere' }}>
          {binaryPath || 'Ningún binario seleccionado'}
        </span>
      </div>

      <div className="row" style={{ gap: 12, marginTop: 14 }}>
        <button className="button button--primary" type="button" onClick={publishRelease}>
          Publicar actualización a todos
        </button>
      </div>

      {status.message ? (
        <div className={`update-status update-status--${status.type}`}>
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
