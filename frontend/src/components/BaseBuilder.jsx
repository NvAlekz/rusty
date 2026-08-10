import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSettings } from '../context/SettingsContext';
import { createScene, getCentroid } from '../utils/baseBuilder/scene.js';
import { createGridHelper, createHoverHighlight, raycastGround, getGridPosition } from '../utils/baseBuilder/grid.js';
import { PIECE_CATEGORIES, PIECE_DEFINITIONS, getPieceDef, getPieceCost } from '../utils/baseBuilder/pieces.js';
import { MATERIAL_TIERS, TIER_ORDER, getTierColor } from '../utils/baseBuilder/materials.js';
import {
  computePlacement,
  createPieceMesh,
  createPreviewMesh,
  raycastToPiece,
  raycastPreview,
  getPieceKey,
  getPieceRotation,
  disposeGroup,
} from '../utils/baseBuilder/interaction.js';
import { computeAllValidPlacements } from '../utils/baseBuilder/prediction.js';
import { calculateTotalCost, RESOURCE_ORDER, getTotalHP } from '../utils/baseBuilder/costCalculator.js';
import { createHistory } from '../utils/baseBuilder/history.js';
import { saveDesign, loadDesign, importFromJSON, exportToJSON } from '../utils/baseBuilder/serializer.js';

const MATERIAL_ICON_LABEL = { wood: 'W', stone: 'S', metalFragments: 'M', hqm: 'H' };

export default function BaseBuilder() {
  const { t } = useSettings();
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  const [pieces, setPieces] = useState([]);
  const [selectedPieceId, setSelectedPieceId] = useState('square_foundation');
  const [selectedTier, setSelectedTier] = useState('wood');
  const [rotation, setRotation] = useState(0);
  const [hoverPos, setHoverPos] = useState(null);
  const [hoverValid, setHoverValid] = useState(false);
  const [hoverReason, setHoverReason] = useState('');
  const [previewCount, setPreviewCount] = useState(0);
  const [history] = useState(() => createHistory());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [baseName, setBaseName] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  const selectionRef = useRef({ pieceId: selectedPieceId, tier: selectedTier, rotation });
  const hoverPosRef = useRef(null);
  const lastCursorCellRef = useRef('');

  const totalCost = useMemo(() => calculateTotalCost(pieces), [pieces]);
  const totalPieces = useMemo(() => pieces.length, [pieces]);
  const totalHP = useMemo(() => getTotalHP(pieces), [pieces]);

  /* ---------- Escena ---------- */
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = {
      scene: null,
      camera: null,
      renderer: null,
      pieceGroup: null,
      ghostGroup: null,
      ghostMesh: null,
      hoverHighlight: null,
      hoverShape: 'square',
      previewGroup: null,
      previews: [],
      pieceMeshes: new Map(),
    };

    const { scene, camera, renderer, setTarget, dispose } = createScene(containerRef.current);
    engine.scene = scene;
    engine.camera = camera;
    engine.renderer = renderer;
    engine.setTarget = setTarget;

    scene.add(createGridHelper());

    engine.pieceGroup = new THREE.Group();
    scene.add(engine.pieceGroup);

    engine.ghostGroup = new THREE.Group();
    scene.add(engine.ghostGroup);

    engine.hoverHighlight = createHoverHighlight();
    scene.add(engine.hoverHighlight);

    engine.previewGroup = new THREE.Group();
    scene.add(engine.previewGroup);

    engine.dispose = dispose;
    engineRef.current = engine;
    window.__buildEngine = engine;

    return () => {
      engineRef.current = null;
      dispose();
    };
  }, []);

  /* ---------- Sync piezas a la escena ---------- */
  const rebuildPieces = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    while (engine.pieceGroup.children.length) {
      const child = engine.pieceGroup.children[0];
      engine.pieceGroup.remove(child);
      disposeGroup(child);
    }
    engine.pieceMeshes.clear();

    for (const piece of piecesRef.current) {
      const group = createPieceMesh(piece, piece.tier);
      const key = getPieceKey(piece);
      group.userData.pieceKey = key;
      group.children.forEach((child) => {
        child.userData.pieceKey = key;
      });
      engine.pieceGroup.add(group);
      engine.pieceMeshes.set(key, group);
    }
  }, []);

  useEffect(() => {
    rebuildPieces();
  }, [pieces, rebuildPieces]);

  /* ---------- Previews (predicción) ---------- */
  const rebuildPreviews = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const sel = selectionRef.current;
    const cursor = hoverPosRef.current;
    const placements = computeAllValidPlacements(
      piecesRef.current,
      sel.pieceId,
      sel.tier,
      sel.rotation,
      cursor
    );

    while (engine.previewGroup.children.length) {
      const child = engine.previewGroup.children[0];
      engine.previewGroup.remove(child);
      disposeGroup(child);
    }
    engine.previews = [];

    for (const pl of placements) {
      const group = createPreviewMesh(pl);
      if (group) {
        engine.previewGroup.add(group);
        engine.previews.push(group);
      }
    }
    setPreviewCount(placements.length);
  }, []);

  const commitPieces = useCallback(
    (next) => {
      piecesRef.current = next;
      setPieces(next);
      rebuildPreviews();
    },
    [rebuildPreviews]
  );

  /* Recalcula previews y ajusta la forma del highlight al cambiar selección. */
  useEffect(() => {
    selectionRef.current = { pieceId: selectedPieceId, tier: selectedTier, rotation };
    rebuildPreviews();

    const engine = engineRef.current;
    if (!engine) return;
    const def = getPieceDef(selectedPieceId);
    const shape = (def && def.shape === 'triangle') ? 'triangle' : 'square';
    const pType = def?.type || '';
    if (engine.hoverShape !== shape || engine.hoverPieceType !== pType) {
      if (engine.hoverHighlight) {
        engine.scene.remove(engine.hoverHighlight);
        engine.hoverHighlight.geometry?.dispose?.();
      }
      engine.hoverHighlight = createHoverHighlight(shape, pType);
      engine.scene.add(engine.hoverHighlight);
      engine.hoverShape = shape;
      engine.hoverPieceType = pType;
    }
  }, [selectedPieceId, selectedTier, rotation, rebuildPreviews]);

  /* ---------- Ghost + hover ---------- */
  const updateHover = useCallback(
    (gridPos) => {
      const engine = engineRef.current;
      if (!engine) return;
      const pieceId = selectedPieceId;
      const tier = selectedTier;

      const result = computePlacement(piecesRef.current, pieceId, tier, gridPos, rotation);
      setHoverValid(result.valid);
      setHoverReason(result.valid ? '' : result.reason);

      const def = getPieceDef(pieceId);
      const isWall = def.type === 'wall' || def.type === 'frame';
      const hx = isWall && rotation % 2 === 1 ? gridPos.x : gridPos.x + 0.5;
      const hz = isWall && rotation % 2 === 0 ? gridPos.z : gridPos.z + 0.5;
      const y = result.valid ? result.y : 0;

      engine.hoverHighlight.visible = result.valid || gridPos.x !== null;
      if (gridPos.x !== null) {
        engine.hoverHighlight.position.set(hx, y + 0.02, hz);
        engine.hoverHighlight.rotation.y = getPieceRotation({ id: pieceId, rotation }, def);
      }

      hoverPosRef.current = gridPos;

      /* Sin piezas: la predicción sigue al cursor. */
      if (piecesRef.current.length === 0) {
        const cellKey = `${gridPos.x},${gridPos.z}`;
        if (cellKey !== lastCursorCellRef.current) {
          lastCursorCellRef.current = cellKey;
          rebuildPreviews();
        }
      }

      if (!result.valid) {
        engine.ghostGroup.visible = false;
        setHoverPos({ ...gridPos, valid: false });
        return;
      }

      if (!engine.ghostMesh || engine.ghostMesh.userData.pieceId !== pieceId || engine.ghostMesh.userData.tier !== tier) {
        if (engine.ghostMesh) {
          engine.ghostGroup.remove(engine.ghostMesh);
          engine.ghostMesh = null;
        }
        const ghost = createPieceMesh({ id: pieceId, x: 0, z: 0, y: 0, rotation }, tier);
        ghost.traverse((obj) => {
          if (obj.isMesh) {
            obj.material.transparent = true;
            obj.material.opacity = 0.45;
            obj.material.depthWrite = false;
          }
        });
        ghost.userData.pieceId = pieceId;
        ghost.userData.tier = tier;
        engine.ghostGroup.add(ghost);
        engine.ghostMesh = ghost;
      }

      engine.ghostMesh.visible = true;
      engine.ghostMesh.position.set(hx, y, hz);
      engine.ghostMesh.rotation.y = getPieceRotation({ id: pieceId, rotation }, def);
      setHoverPos({ ...gridPos, valid: true });
    },
    [selectedPieceId, selectedTier, rotation, rebuildPreviews]
  );

  /* ---------- Eventos ratón ---------- */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.renderer) return;

    const onMouseMove = (e) => {
      const world = raycastGround(engine.camera, engine.renderer, e.clientX, e.clientY);
      if (!world || world.x === undefined) return;
      const def = getPieceDef(selectedPieceId);
      const gridPos = getGridPosition(world, def.shape, def.type);
      updateHover(gridPos);
    };

    const onMouseLeave = () => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.hoverHighlight.visible = false;
      if (eng.ghostGroup) eng.ghostGroup.visible = false;
      hoverPosRef.current = null;
      lastCursorCellRef.current = '';
      if (piecesRef.current.length === 0) rebuildPreviews();
      setHoverPos(null);
    };

    const onClick = (e) => {
      if (e.button !== 0) return;
      placeAtMouse(e);
    };

    const onContextMenu = (e) => {
      e.preventDefault();
      removeAtMouse(e);
    };

    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'r' || e.key === 'R') {
        setRotation((r) => (r + 1) % 4);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        doUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        doRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        clearAll();
      } else if (e.key === 'Escape') {
        setShowHelp(false);
      }
    };

    const canvas = engine.renderer.domElement;
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedPieceId, selectedTier, rotation, updateHover, rebuildPreviews]);

  /* ---------- Acciones ---------- */
  const placeAtMouse = useCallback(
    (e) => {
      const engine = engineRef.current;
      if (!engine) return;

      /* Si se hace clic sobre un preview azul, se coloca exactamente ahí. */
      const placement = raycastPreview(engine.camera, engine.renderer, e, engine.previews);
      if (placement) {
        history.push(piecesRef.current);
        commitPieces([...piecesRef.current, placement]);
        setCanUndo(history.canUndo());
        setCanRedo(false);
        return;
      }

      const world = raycastGround(engine.camera, engine.renderer, e.clientX, e.clientY);
      if (!world || world.x === undefined) return;
      const def = getPieceDef(selectedPieceId);
      const gridPos = getGridPosition(world, def.shape, def.type);
      const result = computePlacement(piecesRef.current, selectedPieceId, selectedTier, gridPos, rotation);
      if (!result.valid) return;

      history.push(piecesRef.current);
      commitPieces([...piecesRef.current, result]);
      setCanUndo(history.canUndo());
      setCanRedo(false);
    },
    [selectedPieceId, selectedTier, rotation, history, commitPieces]
  );

  const removeAtMouse = useCallback(
    (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      const key = raycastToPiece(engine.camera, engine.renderer, e, Array.from(engine.pieceMeshes.values()));
      if (!key) return;

      const idx = piecesRef.current.findIndex((p) => getPieceKey(p) === key);
      if (idx === -1) return;

      history.push(piecesRef.current);
      commitPieces([...piecesRef.current.slice(0, idx), ...piecesRef.current.slice(idx + 1)]);
      setCanUndo(history.canUndo());
      setCanRedo(false);
    },
    [history, commitPieces]
  );

  const doUndo = useCallback(() => {
    if (!history.canUndo()) return;
    history.pushRedo(piecesRef.current);
    const restored = history.undo();
    if (restored === null) return;
    commitPieces(restored);
    setCanUndo(history.canUndo());
    setCanRedo(history.canRedo());
  }, [history, commitPieces]);

  const doRedo = useCallback(() => {
    if (!history.canRedo()) return;
    const restored = history.redo();
    if (restored === null) return;
    commitPieces(restored);
    setCanUndo(history.canUndo());
    setCanRedo(history.canRedo());
  }, [history, commitPieces]);

  const clearAll = useCallback(() => {
    if (piecesRef.current.length === 0) return;
    history.push(piecesRef.current);
    commitPieces([]);
    setCanUndo(history.canUndo());
    setCanRedo(false);
  }, [history, commitPieces]);

  /* Recentra la cámara en el centroide de la base. */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.setTarget) return;
    const c = getCentroid(pieces);
    engine.setTarget(c.x, c.y, c.z);
  }, [pieces]);

  const handleSave = useCallback(() => {
    saveDesign(piecesRef.current, baseName);
  }, [baseName]);

  const handleLoad = useCallback(() => {
    const data = loadDesign();
    if (!data) return;
    const loaded = data.placements
      .filter((p) => getPieceDef(p.id))
      .map((p) => ({ id: p.id, tier: p.tier, rotation: p.rotation || 0, x: p.x, z: p.z, y: p.y }));
    if (loaded.length === 0) return;
    history.push(piecesRef.current);
    commitPieces(loaded);
    if (data.name) setBaseName(data.name);
    setCanUndo(history.canUndo());
    setCanRedo(false);
  }, [history, commitPieces]);

  const handleExport = useCallback(() => {
    const json = exportToJSON(piecesRef.current, baseName);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName || 'base'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [baseName]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = importFromJSON(String(reader.result));
        if (!data) return;
        const loaded = data.placements
          .filter((p) => getPieceDef(p.id))
          .map((p) => ({ id: p.id, tier: p.tier, rotation: p.rotation || 0, x: p.x, z: p.z, y: p.y }));
        if (loaded.length === 0) return;
        history.push(piecesRef.current);
        commitPieces(loaded);
        if (data.name) setBaseName(data.name);
        setCanUndo(history.canUndo());
        setCanRedo(false);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [history, commitPieces]);

  const selectedDef = getPieceDef(selectedPieceId);
  const selectedCost = getPieceCost(selectedPieceId, selectedTier);

  return (
    <div className="build">
      <aside className="build__sidebar">
        <div className="build__panel build__panel--tiers">
          <div className="build__panel-title">{t('build_tiers')}</div>
          <div className="build__tiers">
            {TIER_ORDER.map((tierId) => (
              <button
                key={tierId}
                className={`build__tier ${selectedTier === tierId ? 'build__tier--active' : ''}`}
                style={{ '--tier-color': `#${getTierColor(tierId).toString(16).padStart(6, '0')}` }}
                onClick={() => setSelectedTier(tierId)}
              >
                <span className="build__tier-dot" />
                <span className="build__tier-name">{MATERIAL_TIERS[tierId].name}</span>
                <span className="build__tier-hp">{MATERIAL_TIERS[tierId].hp}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="build__panel">
          <div className="build__panel-title">{t('build_pieces')}</div>
          <div className="build__categories">
            {PIECE_CATEGORIES.map((cat) => (
              <div className="build__category" key={cat.id}>
                <div className="build__category-label">{cat.name}</div>
                <div className="build__piece-grid">
                  {cat.pieces.map((pieceId) => {
                    const def = PIECE_DEFINITIONS[pieceId];
                    return (
                      <button
                        key={pieceId}
                        className={`build__piece ${selectedPieceId === pieceId ? 'build__piece--active' : ''}`}
                        onClick={() => {
                          setSelectedPieceId(pieceId);
                          setRotation(0);
                        }}
                        title={def.name}
                      >
                        <span className="build__piece-name">{def.name}</span>
                        <span className="build__piece-icon">{getPieceIcon(pieceId)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="build__panel build__panel--actions">
          <div className="build__btn-row">
            <button className="build__btn" onClick={doUndo} disabled={!canUndo} title="Ctrl+Z">
              ↩ {t('build_undo')}
            </button>
            <button className="build__btn" onClick={doRedo} disabled={!canRedo} title="Ctrl+Y">
              ↪ {t('build_redo')}
            </button>
          </div>
          <div className="build__btn-row">
            <button className="build__btn build__btn--danger" onClick={clearAll} disabled={pieces.length === 0}>
              {t('build_clear')}
            </button>
            <button className="build__btn" onClick={() => setShowHelp((v) => !v)}>
              ?
            </button>
          </div>
          <div className="build__save-row">
            <input
              className="build__name-input"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder={t('build_name')}
            />
          </div>
          <div className="build__btn-row">
            <button className="build__btn" onClick={handleSave}>
              {t('build_save')}
            </button>
            <button className="build__btn" onClick={handleLoad}>
              {t('build_load')}
            </button>
          </div>
          <div className="build__btn-row">
            <button className="build__btn" onClick={handleExport}>
              {t('build_export')}
            </button>
            <button className="build__btn" onClick={handleImport}>
              {t('build_import')}
            </button>
          </div>
        </div>
      </aside>

      <div className="build__main">
        <div className="build__canvas" ref={containerRef}>
          <div className="build__hud build__hud--top">
            <div className="build__selection">
              <span className="build__selection-name">{selectedDef?.name}</span>
              <span className="build__selection-tier">{MATERIAL_TIERS[selectedTier].name}</span>
              <span className="build__selection-cost">
                {t('build_cost')}: {selectedCost}
              </span>
              <span className="build__selection-rotation">
                {t('build_rotation')}: {rotation * 90}°
              </span>
              <span className="build__selection-valid">
                {t('build_previews')}: {previewCount}
              </span>
            </div>
            <button
              className="build__rotate-btn"
              onClick={() => setRotation((r) => (r + 1) % 4)}
              title="R"
            >
              ↻ {t('build_rotate')}
            </button>
          </div>

          {hoverPos && !hoverValid && (
            <div className="build__hud build__hud--invalid">
              {t(hoverReason === 'occupied' ? 'build_reason_occupied' : 'build_reason_support')}
            </div>
          )}

          {showHelp && (
            <div className="build__help">
              <div className="build__help-title">{t('build_help_title')}</div>
              <ul>
                <li>{t('build_help_place')}</li>
                <li>{t('build_help_remove')}</li>
                <li>{t('build_help_rotate')}</li>
                <li>{t('build_help_zoom')}</li>
                <li>{t('build_help_undo')}</li>
                <li>{t('build_help_delete')}</li>
              </ul>
              <button className="build__btn" onClick={() => setShowHelp(false)}>
                {t('raid_clear')}
              </button>
            </div>
          )}
        </div>

        <div className="build__footer">
          <div className="build__stats">
            <span className="build__stat">
              {t('build_pieces')}: <strong>{totalPieces}</strong>
            </span>
            <span className="build__stat">
              {t('build_previews')}: <strong>{previewCount}</strong>
            </span>
            <span className="build__stat">
              {t('build_hp')}: <strong>{totalHP.toLocaleString()}</strong>
            </span>
          </div>
          <div className="build__resources">
            {RESOURCE_ORDER.map((res) => (
              <span className="build__resource" key={res}>
                <span className="build__resource-icon">{MATERIAL_ICON_LABEL[res]}</span>
                <span className="build__resource-name">{resourceLabel(t, res)}</span>
                <span className="build__resource-amount">{totalCost[res]?.toLocaleString() ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helper: icono de pieza ---------- */

function getPieceIcon(pieceId) {
  const map = {
    square_foundation: '▦',
    triangle_foundation: '△',
    wall: '▭',
    half_wall: '▭',
    low_wall: '▬',
    door_frame: '▣',
    window_frame: '▥',
    frame: '▢',
    square_floor: '▦',
    triangle_floor: '△',
    square_floor_frame: '▢',
    triangle_floor_frame: '△',
    stairs: '⤢',
    lstair: '⤡',
    ustair: '⤴',
    ramp: '⤡',
    triangle_roof: '▲',
  };
  return map[pieceId] || '▦';
}

function resourceLabel(t, res) {
  const map = {
    wood: 'Madera',
    stone: 'Piedra',
    metalFragments: 'Metal',
    hqm: 'HDQ',
  };
  return map[res] || res;
}
