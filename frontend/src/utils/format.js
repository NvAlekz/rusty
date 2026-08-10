// Utilidades para formatear datos de jugadores

export function formatKDA(kda) {
  if (kda === null || kda === undefined) return '—';
  return Number(kda).toFixed(2);
}

export function formatHours(hours) {
  if (!hours || hours === 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${hours.toFixed(1)}h`;
}

export function formatAccuracy(accuracy) {
  if (accuracy === null || accuracy === undefined) return '—';
  return `${accuracy.toFixed(1)}%`;
}

export function formatDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}