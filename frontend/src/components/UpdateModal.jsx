import React from 'react';

function renderMarkdown(markdown) {
  if (!markdown) return null;
  let html = markdown
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^-\s(.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>');

  html = `<p>${html}</p>`
    .replace(/<p><h/g, '<h')
    .replace(/<\/p>$/g, '')
    .replace(/<li>(.+?)<\/li>/g, '<ul><li>$1</li></ul>');

  return html;
}

export default function UpdateModal({ release, progress, state, onInstall, onSkip, onRemindLater, onClose }) {
  if (!release) return null;

  return (
    <div className="update-modal-overlay">
      <div className="update-modal-card">
        <div className="update-modal-header">
          <div>
            <div className="update-badge">Nueva versión {release.latestVersion}</div>
            <div className="update-title">Actualización disponible</div>
            <div className="update-meta">Publicado el {new Date(release.publishedAt).toLocaleDateString()}</div>
          </div>
          <button className="button button--ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <div className="update-body">
          <div className="update-section">
            <strong>Notas de la versión</strong>
            <div className="update-notes" dangerouslySetInnerHTML={{ __html: renderMarkdown(release.body) }} />
          </div>

          {state === 'downloading' && progress ? (
            <div className="update-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.round((progress.percent || 0) * 100)}%` }} />
              </div>
              <div className="progress-meta">
                {Math.round((progress.percent || 0) * 100)}% · {Math.round(progress.speed / 1024 / 1024 * 100) / 100} MB/s · {Math.round(progress.timeRemaining || 0)}s restantes
              </div>
            </div>
          ) : null}
        </div>

        <div className="update-actions">
          <button className="button button--primary" type="button" onClick={onInstall}>
            {state === 'downloading' ? 'Descargar...' : 'Actualizar ahora'}
          </button>
          <button className="button button--secondary" type="button" onClick={onRemindLater}>Recordar más tarde</button>
          <button className="button button--ghost" type="button" onClick={onSkip}>Omitir esta versión</button>
        </div>
      </div>
    </div>
  );
}
