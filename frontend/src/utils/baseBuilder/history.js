export function createHistory(limit = 100) {
  let undoStack = [];
  let redoStack = [];

  function snapshot(pieces) {
    return pieces.map((p) => ({ ...p }));
  }

  function push(snapshotPieces) {
    undoStack.push(snapshot(snapshotPieces));
    if (undoStack.length > limit) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return null;
    const prev = undoStack.pop();
    return prev;
  }

  function redo() {
    if (redoStack.length === 0) return null;
    const next = redoStack.pop();
    undoStack.push(next);
    return snapshot(next);
  }

  function pushRedo(snapshotPieces) {
    redoStack.push(snapshot(snapshotPieces));
  }

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function getState() {
    return { undoCount: undoStack.length, redoCount: redoStack.length };
  }

  return { push, undo, redo, pushRedo, clear, canUndo, canRedo, getState };
}
