const JUMPY_HUMAN = JUMPY_WHITE;
const JUMPY_AI = JUMPY_BLACK;
const JUMPY_THINK_STEP_MS = 180;

let jumpyState = null;

function jumpyNewState() {
  return {
    board: jumpyInitialBoard(),
    player: JUMPY_WHITE,
    visited: new Map([[jumpyStateKey(jumpyInitialBoard(), JUMPY_WHITE), 1]]),
    moveCount: 0,
    status: "ongoing", // 'ongoing' | 'white' | 'black' | 'draw'
    thinking: false,
    watchMode: false,
    log: [],
  };
}

function jumpyStatusText(state) {
  if (state.status === "white") return "White wins! (you)";
  if (state.status === "black") return "Black wins. (the bot)";
  if (state.status === "draw") return "Draw by repetition.";
  if (state.thinking) return "Black is thinking...";
  return state.player === JUMPY_HUMAN ? "Your move (White) - click a highlighted piece." : "Black's move...";
}

function jumpyRender() {
  const root = document.getElementById("jumpy-demo");
  if (!root || !jumpyState) {
    return;
  }

  const boardEl = root.querySelector("#jumpy-board");
  const statusEl = root.querySelector("#jumpy-status");
  const thinkBtn = root.querySelector("#jumpy-think-toggle");
  const logEl = root.querySelector("#jumpy-think-log");

  const clickable =
    !jumpyState.thinking &&
    jumpyState.status === "ongoing" &&
    jumpyState.player === JUMPY_HUMAN;
  const movablePieces = clickable ? jumpyLegalMoves(jumpyState.board, JUMPY_HUMAN) : [];

  boardEl.innerHTML = "";
  for (let i = 0; i < JUMPY_BOARD_SIZE; i++) {
    const value = jumpyGetSquare(jumpyState.board, i);
    const cell = document.createElement("div");
    cell.classList.add("jumpy-square");
    cell.textContent = `[${jumpySquareSymbol(value)}]`.replace("[]", "[ ]");

    if (value === JUMPY_WHITE) {
      cell.classList.add("text-blue");
    } else if (value === JUMPY_BLACK) {
      cell.classList.add("text-green");
    }

    if (movablePieces.includes(i)) {
      cell.classList.add("jumpy-clickable");
      cell.addEventListener("click", () => jumpyHandleHumanMove(i));
    }

    boardEl.appendChild(cell);
  }

  statusEl.textContent = jumpyStatusText(jumpyState);

  if (thinkBtn) {
    thinkBtn.textContent = `watch it think: ${jumpyState.watchMode ? "on" : "off"}`;
  }

  logEl.classList.toggle("active", jumpyState.watchMode);
  if (!jumpyState.watchMode || jumpyState.log.length === 0) {
    logEl.innerHTML = "";
  }
}

function jumpyHandleHumanMove(index) {
  if (!jumpyState || jumpyState.thinking || jumpyState.status !== "ongoing" || jumpyState.player !== JUMPY_HUMAN) {
    return;
  }

  jumpyAdvanceState(jumpyState, index);

  if (jumpyState.status === "ongoing") {
    jumpyState.thinking = true;
    jumpyRender();
    setTimeout(jumpyRunAiTurn, 350);
  } else {
    jumpyRender();
  }
}

function jumpyRunAiTurn() {
  if (!jumpyState || jumpyState.status !== "ongoing") {
    return;
  }

  if (jumpyState.watchMode) {
    const { log } = jumpyFindBestMove(jumpyState.board, JUMPY_AI, 10);
    jumpyState.log = [];
    jumpyAnimateThinkLog(log, 0);
  } else {
    jumpyFinishAiTurn();
  }
}

function jumpyAnimateThinkLog(log, i) {
  if (!jumpyState || jumpyState.status !== "ongoing") {
    return;
  }

  const root = document.getElementById("jumpy-demo");
  const logEl = root?.querySelector("#jumpy-think-log");

  if (i >= log.length) {
    setTimeout(jumpyFinishAiTurn, JUMPY_THINK_STEP_MS);
    return;
  }

  const entry = log[i];
  jumpyState.log.push(entry);
  if (logEl) {
    logEl.innerHTML = jumpyState.log
      .map((e) => `depth ${e.depth}: considering square ${e.move + 1} (eval ${e.score})`)
      .join("<br>");
  }

  setTimeout(() => jumpyAnimateThinkLog(log, i + 1), JUMPY_THINK_STEP_MS);
}

function jumpyFinishAiTurn() {
  if (!jumpyState || jumpyState.status !== "ongoing") {
    return;
  }

  const move = jumpyGetBestMoveAvoidingRepeat(jumpyState.board, JUMPY_AI, jumpyState.visited);
  jumpyAdvanceState(jumpyState, move);
  jumpyState.thinking = false;
  jumpyRender();
}

function jumpyReset() {
  jumpyState = jumpyNewState();
  jumpyRender();
}

function jumpyToggleThink() {
  if (!jumpyState) {
    return;
  }
  jumpyState.watchMode = !jumpyState.watchMode;
  jumpyRender();
}

function initJumpyDemo() {
  if (!document.getElementById("jumpy-demo")) {
    return;
  }
  jumpyReset();
}
