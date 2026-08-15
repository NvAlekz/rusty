import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'rust-tracker-settings';
const MIN_OPACITY = 0.1;
const MAX_OPACITY = 1.0;

const DEFAULT_SETTINGS = { opacity: 1, language: 'es' };

const translations = {
  es: {
    connected: 'Conectado',
    disconnected: 'Desconectado',
    refresh: 'ACTUALIZAR',
    syncing: 'SINCRONIZANDO...',
    syncNow: 'ACTUALIZAR',
    tab_server: 'SERVIDOR',
    tab_players: 'JUGADORES',
    tab_raid: 'RAID',
    tab_build: 'CONSTRUIR',
    tab_settings: 'AJUSTES',
    build_tiers: 'Materiales',
    build_pieces: 'Piezas',
    build_undo: 'Deshacer',
    build_redo: 'Rehacer',
    build_clear: 'Limpiar',
    build_save: 'Guardar',
    build_load: 'Cargar',
    build_export: 'Exportar',
    build_import: 'Importar',
    build_name: 'Nombre de la base',
    build_cost: 'Costo',
    build_rotation: 'Rotación',
    build_rotate: 'Rotar',
    build_hp: 'Vida total',
    build_help_title: 'Controles',
    build_help_place: 'Clic izquierdo: colocar pieza',
    build_help_remove: 'Clic derecho: eliminar pieza',
    build_help_rotate: 'R: rotar pieza',
    build_help_zoom: 'Rueda: zoom · Arrastrar: rotar vista',
    build_help_undo: 'Ctrl+Z: deshacer · Ctrl+Y: rehacer',
    build_help_delete: 'Supr: limpiar todo',
    build_reason_occupied: 'Lugar ocupado',
    build_reason_support: 'Sin soporte (coloca un cimiento/piso debajo)',
    build_previews: 'Válidos',
    noConnectionTitle: 'SIN CONEXIÓN',
    noConnectionSub: 'Esperando detectar el servidor de Rust...',
    settings_title: 'AJUSTES',
    settings_sub: 'DEL TRACKER',
    opacity_label: 'Opacidad del overlay',
    opacity_desc: 'Transparencia de toda la ventana en tiempo real',
    language_label: 'Idioma de la interfaz',
    language_desc: 'Cambia el idioma de toda la app',
    lang_es: 'Español',
    lang_en: 'Inglés',
    tracker_status: 'Estado del tracker',
    log_monitoring: 'Monitoreo de logs',
    active: 'ACTIVO',
    inactive: 'INACTIVO',
    tracker_connection: 'Conexión al tracker',
    connected_txt: 'CONECTADO',
    disconnected_txt: 'DESCONECTADO',
    server_status: 'Servidor',
    detected: 'DETECTADO',
    none: '—',
    server_current: 'ACTUAL',
    players_count_title: 'JUGADORES',
    no_players: 'No hay jugadores en el servidor',
    player: 'Jugador',
    kills: 'Kills',
    deaths: 'Muertes',
    kd: 'K/D',
    hs: 'HS %',
    accuracy: 'Precisión',
    hours: 'Horas',
    risk: 'Riesgo',
    connected_now: 'conectados ahora',
    high_risk: 'En Riesgo Alto',
    possible_cheaters: 'posibles cheaters',
    private_profiles: 'Perfiles Privados',
    unverifiable: 'datos no verificables',
    raid_title: 'CALCULADORA RAID',
    raid_subtitle: 'VANILLA',
    raid_verified: 'Datos verificados:',
    raid_targets: 'objetivos',
    raid_methods: 'metodos',
    raid_search: 'Buscar pared, puerta, trampa...',
    raid_all: 'Todo',
    raid_target: 'Objetivo',
    raid_quantity: 'Cantidad',
    raid_health: 'Vida',
    raid_raiders: 'Raideadores',
    raid_side: 'Lado',
    raid_hard: 'Duro',
    raid_soft: 'Blando',
    raid_method: 'Metodo seleccionado',
    raid_selected: 'Seleccionado',
    raid_fastest: 'Mas rapido',
    raid_mixed: 'Mixto rapido',
    raid_cheapest: 'Mas barato',
    raid_custom: 'Personalizado',
    raid_recommended: 'Recomendacion',
    raid_savings: 'Ahorras',
    raid_damage: 'daño',
    raid_wasted: 'desperdiciado',
    raid_clear: 'Limpiar',
    raid_alternatives: 'Alternativas por sulfur',
    raid_time: 'tiempo aprox',
    raid_no_method: 'Sin metodo compatible',
    minimize: 'Minimizar',
    close: 'Cerrar',
  },
  en: {
    connected: 'Connected',
    disconnected: 'Disconnected',
    refresh: 'REFRESH',
    syncing: 'SYNCING...',
    syncNow: 'REFRESH',
    tab_server: 'SERVER',
    tab_players: 'PLAYERS',
    tab_raid: 'RAID',
    tab_build: 'BUILD',
    tab_settings: 'SETTINGS',
    build_tiers: 'Materials',
    build_pieces: 'Pieces',
    build_undo: 'Undo',
    build_redo: 'Redo',
    build_clear: 'Clear',
    build_save: 'Save',
    build_load: 'Load',
    build_export: 'Export',
    build_import: 'Import',
    build_name: 'Base name',
    build_cost: 'Cost',
    build_rotation: 'Rotation',
    build_rotate: 'Rotate',
    build_hp: 'Total HP',
    build_help_title: 'Controls',
    build_help_place: 'Left click: place piece',
    build_help_remove: 'Right click: remove piece',
    build_help_rotate: 'R: rotate piece',
    build_help_zoom: 'Wheel: zoom · Drag: rotate view',
    build_help_undo: 'Ctrl+Z: undo · Ctrl+Y: redo',
    build_help_delete: 'Del: clear all',
    build_reason_occupied: 'Spot occupied',
    build_reason_support: 'No support (place a foundation/floor below)',
    build_previews: 'Valid spots',
    noConnectionTitle: 'NO CONNECTION',
    noConnectionSub: 'Waiting to detect the Rust server...',
    settings_title: 'SETTINGS',
    settings_sub: 'TRACKER',
    opacity_label: 'Overlay opacity',
    opacity_desc: 'Transparency of the whole window in real time',
    language_label: 'Interface language',
    language_desc: 'Switch the language of the whole app',
    lang_es: 'Spanish',
    lang_en: 'English',
    tracker_status: 'Tracker status',
    log_monitoring: 'Log monitoring',
    active: 'ON',
    inactive: 'OFF',
    tracker_connection: 'Tracker connection',
    connected_txt: 'CONNECTED',
    disconnected_txt: 'DISCONNECTED',
    server_status: 'Server',
    detected: 'DETECTED',
    none: '—',
    server_current: 'CURRENT',
    players_count_title: 'PLAYERS',
    no_players: 'No players on the server',
    player: 'Player',
    kills: 'Kills',
    deaths: 'Deaths',
    kd: 'K/D',
    hs: 'HS %',
    accuracy: 'Accuracy',
    hours: 'Hours',
    risk: 'Risk',
    connected_now: 'connected now',
    high_risk: 'High Risk',
    possible_cheaters: 'possible cheaters',
    private_profiles: 'Private Profiles',
    unverifiable: 'unverifiable data',
    raid_title: 'RAID CALCULATOR',
    raid_subtitle: 'VANILLA',
    raid_verified: 'Data verified:',
    raid_targets: 'targets',
    raid_methods: 'methods',
    raid_search: 'Search wall, door, trap...',
    raid_all: 'All',
    raid_target: 'Target',
    raid_quantity: 'Quantity',
    raid_health: 'Health',
    raid_raiders: 'Raiders',
    raid_side: 'Side',
    raid_hard: 'Hard',
    raid_soft: 'Soft',
    raid_method: 'Selected method',
    raid_selected: 'Selected',
    raid_fastest: 'Fastest',
    raid_mixed: 'Fast mix',
    raid_cheapest: 'Cheapest',
    raid_custom: 'Custom',
    raid_recommended: 'Recommendation',
    raid_savings: 'You save',
    raid_damage: 'damage',
    raid_wasted: 'wasted',
    raid_clear: 'Clear',
    raid_alternatives: 'Alternatives by sulfur',
    raid_time: 'approx time',
    raid_no_method: 'No compatible method',
    minimize: 'Minimize',
    close: 'Close',
  },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const opacity = Number(parsed.opacity);
    return {
      opacity: Number.isFinite(opacity)
        ? Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, opacity))
        : DEFAULT_SETTINGS.opacity,
      language: parsed.language === 'en' ? 'en' : 'es',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  /* Opacidad del overlay publicada como variable CSS global:
     solo los fondos grandes la consumen (el chrome de UI se mantiene sólido) */
  useEffect(() => {
    document.documentElement.style.setProperty('--overlay-alpha', String(settings.opacity));
  }, [settings.opacity]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [settings]);

  const setOpacity = useCallback((value) => {
    setSettings((s) => ({
      ...s,
      opacity: Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, Number(value) || s.opacity)),
    }));
  }, []);

  const setLanguage = useCallback((language) => {
    setSettings((s) => ({ ...s, language: language === 'en' ? 'en' : 'es' }));
  }, []);

  const t = useCallback(
    (key) => translations[settings.language][key] ?? translations.es[key] ?? key,
    [settings.language]
  );

  const value = useMemo(
    () => ({ ...settings, setOpacity, setLanguage, t }),
    [settings, setOpacity, setLanguage, t]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>');
  return ctx;
}
