const JUMPY_EMPTY = 0;
const JUMPY_WHITE = 1;
const JUMPY_BLACK = 2;
const JUMPY_BOARD_SIZE = 8;
const JUMPY_PIECES_PER_SIDE = 2;

// This repetition/move-cap rule must stay consistent across every mode that plays this game.
const JUMPY_REPETITION_LIMIT = 3;
const JUMPY_MOVE_CAP = 60;

function jumpySquareSymbol(value) {
  if (value === JUMPY_WHITE) return 'W';
  if (value === JUMPY_BLACK) return 'B';
  return '';
}

function jumpyInitialBoard() {
  let board = 0;
  board = jumpySetSquare(board, 0, JUMPY_WHITE);
  board = jumpySetSquare(board, 1, JUMPY_WHITE);
  board = jumpySetSquare(board, 6, JUMPY_BLACK);
  board = jumpySetSquare(board, 7, JUMPY_BLACK);
  return board;
}

function jumpyGetSquare(board, index) {
  return (board >> (2 * index)) & 0b11;
}

function jumpySetSquare(board, index, value) {
  const cleared = board & ~(0b11 << (2 * index));
  return cleared | (value << (2 * index));
}

function jumpyDirection(player) {
  return player === JUMPY_WHITE ? 1 : -1;
}

function jumpyOpponent(player) {
  return player === JUMPY_WHITE ? JUMPY_BLACK : JUMPY_WHITE;
}

function jumpyPiecesOnBoard(board, player) {
  const positions = [];
  for (let i = 0; i < JUMPY_BOARD_SIZE; i++) {
    if (jumpyGetSquare(board, i) === player) {
      positions.push(i);
    }
  }
  return positions;
}

function jumpyLegalMoves(board, player) {
  return jumpyPiecesOnBoard(board, player);
}

function jumpyGameStatus(board) {
  if (jumpyPiecesOnBoard(board, JUMPY_WHITE).length === 0) {
    return JUMPY_WHITE;
  }
  if (jumpyPiecesOnBoard(board, JUMPY_BLACK).length === 0) {
    return JUMPY_BLACK;
  }
  return JUMPY_EMPTY;
}

function jumpyApplyMove(board, player, fromIndex) {
  const dir = jumpyDirection(player);
  const opp = jumpyOpponent(player);

  let jumpedCount = 0;
  let jumpedOpponentSquare = -1;
  let landing = fromIndex + dir;

  while (landing >= 0 && landing < JUMPY_BOARD_SIZE && jumpyGetSquare(board, landing) !== JUMPY_EMPTY) {
    if (jumpyGetSquare(board, landing) === opp) {
      jumpedOpponentSquare = landing;
    }
    jumpedCount++;
    landing += dir;
  }

  let newBoard = jumpySetSquare(board, fromIndex, JUMPY_EMPTY);

  if (landing >= 0 && landing < JUMPY_BOARD_SIZE) {
    newBoard = jumpySetSquare(newBoard, landing, player);
  }
  // else: landing is off-board -> the piece has exited

  if (jumpedCount === 1 && jumpedOpponentSquare !== -1) {
    newBoard = jumpySetSquare(newBoard, jumpedOpponentSquare, JUMPY_EMPTY);

    let bumpTo = dir === 1 ? JUMPY_BOARD_SIZE - 1 : 0;
    while (bumpTo >= 0 && bumpTo < JUMPY_BOARD_SIZE && jumpyGetSquare(newBoard, bumpTo) !== JUMPY_EMPTY) {
      bumpTo -= dir;
    }
    if (bumpTo >= 0 && bumpTo < JUMPY_BOARD_SIZE) {
      newBoard = jumpySetSquare(newBoard, bumpTo, opp);
    }
  }

  return newBoard;
}

function jumpyEvaluate(board, perspective) {
  const opp = jumpyOpponent(perspective);
  const myPieces = jumpyPiecesOnBoard(board, perspective);
  const oppPieces = jumpyPiecesOnBoard(board, opp);
  const myDir = jumpyDirection(perspective);
  const oppDir = jumpyDirection(opp);

  let score = 0;
  score += (JUMPY_PIECES_PER_SIDE - myPieces.length) * 100;
  score -= (JUMPY_PIECES_PER_SIDE - oppPieces.length) * 100;

  myPieces.forEach((pos) => {
    score += myDir === 1 ? pos : JUMPY_BOARD_SIZE - 1 - pos;
  });
  oppPieces.forEach((pos) => {
    score -= oppDir === 1 ? pos : JUMPY_BOARD_SIZE - 1 - pos;
  });

  return score;
}

function jumpyMinimax(board, player, perspective, depth, alpha, beta) {
  const status = jumpyGameStatus(board);
  if (status !== JUMPY_EMPTY) {
    const win = status === perspective ? 100000 : -100000;
    return win - depth * Math.sign(win);
  }
  if (depth === 0) {
    return jumpyEvaluate(board, perspective);
  }

  const moves = jumpyLegalMoves(board, player);
  const maximizing = player === perspective;
  let best = maximizing ? -Infinity : Infinity;

  for (const pos of moves) {
    const child = jumpyApplyMove(board, player, pos);
    const value = jumpyMinimax(child, jumpyOpponent(player), perspective, depth - 1, alpha, beta);

    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, value);
    }

    if (beta <= alpha) {
      break;
    }
  }

  return best;
}

// Depth-limited heuristic only for the "watch it think" log -- real move
// selection uses the exact solver below, since the bump rule makes the
// state graph cyclic and a depth cutoff can't guarantee correctness.
function jumpyFindBestMove(board, player, maxDepth = 12) {
  const moves = jumpyLegalMoves(board, player);
  const log = [];
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (let depth = 1; depth <= maxDepth; depth++) {
    let depthBestMove = null;
    let depthBestScore = -Infinity;

    for (const pos of moves) {
      const child = jumpyApplyMove(board, player, pos);
      const value = jumpyMinimax(child, jumpyOpponent(player), player, depth - 1, -Infinity, Infinity);

      if (value > depthBestScore) {
        depthBestScore = value;
        depthBestMove = pos;
      }
    }

    bestMove = depthBestMove;
    bestScore = depthBestScore;
    log.push({ depth, move: bestMove, score: bestScore });

    if (Math.abs(bestScore) > 50000) {
      break;
    }
  }

  return { move: bestMove, score: bestScore, log };
}

function jumpyStateKey(board, player) {
  return board * 4 + player;
}

// Mutates state in place (board/player/moveCount/status/visited).
function jumpyAdvanceState(state, move) {
  state.board = jumpyApplyMove(state.board, state.player, move);
  state.player = jumpyOpponent(state.player);
  state.moveCount++;

  const result = jumpyGameStatus(state.board);
  if (result === JUMPY_WHITE) { state.status = 'white'; return; }
  if (result === JUMPY_BLACK) { state.status = 'black'; return; }
  if (state.moveCount >= JUMPY_MOVE_CAP) { state.status = 'draw'; return; }

  const key = jumpyStateKey(state.board, state.player);
  const count = (state.visited.get(key) || 0) + 1;
  state.visited.set(key, count);
  if (count >= JUMPY_REPETITION_LIMIT) {
    state.status = 'draw';
  }
}

// Solves the whole game via backward induction (retrograde analysis);
// states with no forced win/loss are left undetermined. Reachable state
// space is small, so this runs instantly and is cached for the page's
// lifetime.
function jumpySolveGame() {
  const initialBoard = jumpyInitialBoard();
  const forwardEdges = new Map();
  const reverseEdges = new Map();
  const remainingChildren = new Map();
  const visited = new Set();
  const queue = [[initialBoard, JUMPY_WHITE]];
  visited.add(jumpyStateKey(initialBoard, JUMPY_WHITE));

  while (queue.length > 0) {
    const [board, player] = queue.shift();
    const key = jumpyStateKey(board, player);
    const moves = jumpyLegalMoves(board, player);
    const edges = [];
    let stateChildren = 0;

    for (const move of moves) {
      const child = jumpyApplyMove(board, player, move);
      if (jumpyGameStatus(child) === player) {
        edges.push({ move, terminal: true });
        continue;
      }

      const opp = jumpyOpponent(player);
      const childKey = jumpyStateKey(child, opp);
      edges.push({ move, terminal: false, childKey });
      stateChildren++;

      if (!reverseEdges.has(childKey)) {
        reverseEdges.set(childKey, []);
      }
      reverseEdges.get(childKey).push(key);

      if (!visited.has(childKey)) {
        visited.add(childKey);
        queue.push([child, opp]);
      }
    }

    forwardEdges.set(key, edges);
    remainingChildren.set(key, stateChildren);
  }

  const result = new Map();
  const bestMoveFor = new Map();
  const solveQueue = [];

  for (const [key, edges] of forwardEdges) {
    const terminalEdge = edges.find((e) => e.terminal);
    if (terminalEdge) {
      result.set(key, 'WIN');
      bestMoveFor.set(key, terminalEdge.move);
      solveQueue.push(key);
    }
  }

  let head = 0;
  while (head < solveQueue.length) {
    const key = solveQueue[head++];
    const label = result.get(key);
    const preds = reverseEdges.get(key) || [];

    for (const predKey of preds) {
      if (result.has(predKey)) {
        continue;
      }

      if (label === 'LOSS') {
        result.set(predKey, 'WIN');
        const moveToHere = forwardEdges.get(predKey).find((e) => !e.terminal && e.childKey === key);
        bestMoveFor.set(predKey, moveToHere.move);
        solveQueue.push(predKey);
      } else {
        remainingChildren.set(predKey, remainingChildren.get(predKey) - 1);
        if (remainingChildren.get(predKey) === 0 && !result.has(predKey)) {
          result.set(predKey, 'LOSS');
          const anyMove = forwardEdges.get(predKey).find((e) => !e.terminal);
          bestMoveFor.set(predKey, anyMove ? anyMove.move : forwardEdges.get(predKey)[0].move);
          solveQueue.push(predKey);
        }
      }
    }
  }

  return { result, bestMoveFor, forwardEdges };
}

let jumpySolvedGameCache = null;

function jumpyGetSolvedGame() {
  if (!jumpySolvedGameCache) {
    jumpySolvedGameCache = jumpySolveGame();
  }
  return jumpySolvedGameCache;
}

// Authoritative move selection for actual gameplay -- always correct,
// never loops, falls back to the heuristic search only for states the
// exact solver left undetermined (a true draw-by-repetition position).
function jumpyGetBestMoveExact(board, player) {
  const { bestMoveFor } = jumpyGetSolvedGame();
  const key = jumpyStateKey(board, player);

  if (bestMoveFor.has(key)) {
    return bestMoveFor.get(key);
  }

  return jumpyFindBestMove(board, player, 8).move;
}

// Prefers an alternative move if the solver's choice would revisit an
// already-seen state (relevant only in undetermined/drawish positions).
// `visited` accumulates "board:player" keys across the game.
function jumpyGetBestMoveAvoidingRepeat(board, player, visited) {
  const moves = jumpyLegalMoves(board, player);
  const preferred = jumpyGetBestMoveExact(board, player);

  const wouldRepeat = (move) => {
    const child = jumpyApplyMove(board, player, move);
    if (jumpyGameStatus(child) === player) {
      return false;
    }
    return visited.has(jumpyStateKey(child, jumpyOpponent(player)));
  };

  if (!wouldRepeat(preferred)) {
    return preferred;
  }

  const alternative = moves.find((m) => m !== preferred && !wouldRepeat(m));
  return alternative !== undefined ? alternative : preferred;
}
