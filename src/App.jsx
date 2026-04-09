import { useCallback, useEffect, useMemo, useState } from 'react';

const SIDE = 18;
const BLOCK_ROWS = 3;
const BLOCK_COLS = 6;
const SYMBOLS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I'
];
const SYMBOL_SET = new Set(SYMBOLS);
const LOCK_AFTER = 3;
const LOCK_SECONDS = 30;

const pattern = (row, col) =>
  (BLOCK_COLS * (row % BLOCK_ROWS) + Math.floor(row / BLOCK_ROWS) + col) % SIDE;

const createRng = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const shuffle = (items, rand) => {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const range = (size) => Array.from({ length: size }, (_, index) => index);

const makeRandomSolution = (seed) => {
  const rand = createRng(seed);
  const rowBands = SIDE / BLOCK_ROWS;
  const colStacks = SIDE / BLOCK_COLS;
  const rows = shuffle(range(rowBands), rand).flatMap((band) =>
    shuffle(range(BLOCK_ROWS), rand).map((row) => band * BLOCK_ROWS + row)
  );
  const cols = shuffle(range(colStacks), rand).flatMap((stack) =>
    shuffle(range(BLOCK_COLS), rand).map((col) => stack * BLOCK_COLS + col)
  );
  const symbols = shuffle(SYMBOLS, rand);

  return rows.map((row) => cols.map((col) => symbols[pattern(row, col)]));
};

const makePuzzle = (solved, seed, hideRatio = 0.75) => {
  const rand = createRng(seed);
  return solved.map((row) => row.map((value) => (rand() < hideRatio ? '' : value)));
};

const RANDOM_SEED = Date.now();
const SOLUTION = makeRandomSolution(RANDOM_SEED);
const INITIAL_PUZZLE = makePuzzle(SOLUTION, RANDOM_SEED + 1, 0.75);
const INITIAL_FIXED = INITIAL_PUZZLE.map((row) => row.map((cell) => cell !== ''));

const cloneGrid = (grid) => grid.map((row) => row.slice());
const toKey = (row, col) => `${row}-${col}`;

const sameBlock = (a, b) =>
  Math.floor(a.row / BLOCK_ROWS) === Math.floor(b.row / BLOCK_ROWS) &&
  Math.floor(a.col / BLOCK_COLS) === Math.floor(b.col / BLOCK_COLS);

const findMistakes = (board) => {
  const mistakes = new Set();
  for (let row = 0; row < SIDE; row += 1) {
    for (let col = 0; col < SIDE; col += 1) {
      const value = board[row][col];
      if (!value) continue;
      if (value !== SOLUTION[row][col]) {
        mistakes.add(toKey(row, col));
      }
    }
  }
  return mistakes;
};

const normalizeSymbol = (key) => {
  if (!key || key.length !== 1) return null;
  const value = key.toUpperCase();
  return SYMBOL_SET.has(value) ? value : null;
};

const isSolved = (board, mistakes) => {
  if (mistakes.size > 0) return false;
  for (let row = 0; row < SIDE; row += 1) {
    for (let col = 0; col < SIDE; col += 1) {
      if (board[row][col] !== SOLUTION[row][col]) return false;
    }
  }
  return true;
};

export default function App() {
  const [board, setBoard] = useState(() => cloneGrid(INITIAL_PUZZLE));
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [mistakeCount, setMistakeCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);
  const isLocked = lockUntil > Date.now();

  const mistakes = useMemo(() => findMistakes(board), [board]);
  const solved = useMemo(() => isSolved(board, mistakes), [board, mistakes]);

  const startLock = useCallback(() => {
    const until = Date.now() + LOCK_SECONDS * 1000;
    setLockUntil(until);
    setLockSeconds(LOCK_SECONDS);
  }, []);

  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockSeconds(remaining);
      if (remaining === 0) {
        setLockUntil(0);
        setMistakeCount(0);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [lockUntil]);

  const recordMistake = useCallback(() => {
    setMistakeCount((prev) => {
      if (prev >= LOCK_AFTER) return prev;
      const next = prev + 1;
      if (next >= LOCK_AFTER) {
        startLock();
        return LOCK_AFTER;
      }
      return next;
    });
  }, [startLock]);

  const updateCell = useCallback(
    (row, col, value) => {
      if (isLocked) return;
      if (INITIAL_FIXED[row][col]) return;
      const previousValue = board[row][col];
      if (value && value !== previousValue && value !== SOLUTION[row][col]) {
        recordMistake();
      }
      setBoard((prev) => {
        if (prev[row][col] === value) return prev;
        const next = cloneGrid(prev);
        next[row][col] = value;
        return next;
      });
    },
    [board, isLocked, recordMistake]
  );

  const handleErase = useCallback(() => {
    if (!selected) return;
    updateCell(selected.row, selected.col, '');
  }, [selected, updateCell]);

  const handleReset = useCallback(() => {
    setBoard(cloneGrid(INITIAL_PUZZLE));
    setMistakeCount(0);
    setLockUntil(0);
    setLockSeconds(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!selected) return;

      const { row, col } = selected;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setSelected({ row: (row + SIDE - 1) % SIDE, col });
          return;
        case 'ArrowDown':
          event.preventDefault();
          setSelected({ row: (row + 1) % SIDE, col });
          return;
        case 'ArrowLeft':
          event.preventDefault();
          setSelected({ row, col: (col + SIDE - 1) % SIDE });
          return;
        case 'ArrowRight':
          event.preventDefault();
          setSelected({ row, col: (col + 1) % SIDE });
          return;
        case 'Backspace':
        case 'Delete':
        case '0':
          if (isLocked) return;
          event.preventDefault();
          updateCell(row, col, '');
          return;
        default: {
          if (isLocked) return;
          const symbol = normalizeSymbol(event.key);
          if (!symbol) return;
          event.preventDefault();
          updateCell(row, col, symbol);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, selected, updateCell]);

  const filledCount = useMemo(
    () => board.reduce((count, row) => count + row.filter(Boolean).length, 0),
    [board]
  );

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">18x18 Sudoku</p>
          <h1>Granite Grid</h1>
          <p className="subtitle">
            Blocks are 3x6. Symbols are 1-9 and A-I. Pick a cell, type, and race your
            friend later.
          </p>
        </div>
        <div className="status">
          <div>
            <span className="label">Filled</span>
            <span className="value">
              {filledCount}/{SIDE * SIDE}
            </span>
          </div>
          <div>
            <span className="label">Mistakes</span>
            <span className={`value ${mistakeCount ? 'danger' : 'ok'}`}>
              {mistakeCount}/{LOCK_AFTER}
            </span>
          </div>
          <div>
            <span className="label">Cooldown</span>
            <span className={`value ${isLocked ? 'danger' : 'ok'}`}>
              {isLocked ? `${lockSeconds}s` : 'Ready'}
            </span>
          </div>
          <div>
            <span className="label">State</span>
            <span className={`value ${solved ? 'solved' : ''}`}>
              {solved ? 'Solved' : 'In progress'}
            </span>
          </div>
        </div>
      </header>

      <section className="board-wrap">
        <div className="board" role="grid" aria-label="18x18 Sudoku board">
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const key = toKey(rowIndex, colIndex);
              const isFixed = INITIAL_FIXED[rowIndex][colIndex];
              const isSelected =
                selected?.row === rowIndex && selected?.col === colIndex;
              const isRelated =
                selected &&
                (selected.row === rowIndex ||
                  selected.col === colIndex ||
                  sameBlock(selected, { row: rowIndex, col: colIndex }));
              const isConflict = mistakes.has(key);

              const classes = ['cell'];
              if (isFixed) classes.push('fixed');
              if (isSelected) classes.push('selected');
              if (isRelated) classes.push('related');
              if (isConflict) classes.push('conflict');
              if (rowIndex % BLOCK_ROWS === 0) classes.push('thick-top');
              if (colIndex % BLOCK_COLS === 0) classes.push('thick-left');
              if ((rowIndex + 1) % BLOCK_ROWS === 0) classes.push('thick-bottom');
              if ((colIndex + 1) % BLOCK_COLS === 0) classes.push('thick-right');

              return (
                <button
                  key={key}
                  type="button"
                  className={classes.join(' ')}
                  onClick={() => setSelected({ row: rowIndex, col: colIndex })}
                  aria-label={`Row ${rowIndex + 1}, Column ${colIndex + 1}`}
                  aria-selected={isSelected}
                >
                  {cell}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="controls">
        <div className="palette">
          {SYMBOLS.map((symbol) => {
            const activeSymbol =
              selected && board[selected.row][selected.col] === symbol;
            return (
              <button
                key={symbol}
                type="button"
                className={`palette-item ${activeSymbol ? 'active' : ''}`}
                onClick={() =>
                  selected && updateCell(selected.row, selected.col, symbol)
                }
                disabled={isLocked}
              >
                {symbol}
              </button>
            );
          })}
        </div>
        <div className="actions">
          <button
            type="button"
            className="action"
            onClick={handleErase}
            disabled={isLocked}
          >
            CLEAR
          </button>
        </div>
      </section>

      <footer className="footer">
        <div>
          <span className="mono">Tips:</span> Use arrow keys to move. Backspace or
          Delete clears a cell.
        </div>
      </footer>
    </div>
  );
}
