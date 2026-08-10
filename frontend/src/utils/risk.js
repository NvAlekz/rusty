// Configuración de niveles de riesgo para la UI
// Estilo: similar a Valorant Tracker

export const RISK_CONFIG = {
  low: {
    label: 'Seguro',
    color: '#2dd36f',
    background: 'rgba(45, 211, 111, 0.12)',
    border: 'rgba(45, 211, 111, 0.3)',
    icon: '🟢',
  },
  medium: {
    label: 'Sospechoso',
    color: '#f5c518',
    background: 'rgba(245, 197, 24, 0.12)',
    border: 'rgba(245, 197, 24, 0.3)',
    icon: '🟡',
  },
  high: {
    label: 'Peligro',
    color: '#ff4655',
    background: 'rgba(255, 70, 85, 0.12)',
    border: 'rgba(255, 70, 85, 0.3)',
    icon: '🔴',
  },
  private: {
    label: 'Privado',
    color: '#8e8e8e',
    background: 'rgba(142, 142, 142, 0.12)',
    border: 'rgba(142, 142, 142, 0.3)',
    icon: '⚪',
  },
};

export function getRiskConfig(riskLevel) {
  return RISK_CONFIG[riskLevel] || RISK_CONFIG.private;
}