// ============================================================
// САПЁР — игровая логика (чистые функции, без React)
// ------------------------------------------------------------
// Этот файл НЕ знает ничего про интерфейс: только данные и правила.
// В Python это был бы отдельный модуль minesweeper.py — те же идеи.
//
// Ключевая концепция (важно для React!): каждая функция принимает
// старое состояние игры и возвращает НОВОЕ состояние, не изменяя
// старое — это называется «иммутабельность». React сравнивает
// старое и новое состояние и перерисовывает только изменившееся.
// ============================================================

/** Одна клетка игрового поля */
export interface Cell {
  isMine: boolean;        // в клетке мина?
  isRevealed: boolean;    // клетка открыта?
  isFlagged: boolean;     // стоит флажок?
  adjacentMines: number;  // сколько мин среди 8 соседей
  exploded?: boolean;     // мина, на которую наступили (подсвечивается красным)
}

/** Стадии игры: idle — ещё не начали, playing — идёт, won/lost — финал */
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

/** Полное состояние игры — единый объект, который хранится в React */
export interface GameState {
  cells: Cell[][];       // поле: двумерный массив [строка][столбец]
  rows: number;
  cols: number;
  mineCount: number;
  status: GameStatus;
  minesPlaced: boolean;  // мины расставляются ПОСЛЕ первого клика — он всегда безопасен
  revealedCount: number; // сколько безопасных клеток открыто (для проверки победы)
}

/** Настройки сложности */
export const DIFFICULTIES = {
  easy:   { label: 'Легко',  rows: 9,  cols: 9,  mines: 10 },
  medium: { label: 'Средне', rows: 16, cols: 16, mines: 40 },
  hard:   { label: 'Сложно', rows: 16, cols: 30, mines: 99 },
} as const

export type Difficulty = keyof typeof DIFFICULTIES

// ------------------------------------------------------------
// Создание нового поля
// ------------------------------------------------------------

export function createGameState(difficulty: Difficulty): GameState {
  const { rows, cols, mines } = DIFFICULTIES[difficulty]
  return {
    rows,
    cols,
    mineCount: mines,
    status: 'idle',
    minesPlaced: false,
    revealedCount: 0,
    cells: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        adjacentMines: 0,
      })),
    ),
  }
}

// ------------------------------------------------------------
// Соседи клетки
// ------------------------------------------------------------
// Возвращает координаты всех клеток вокруг (row, col).
// В Python это выглядело бы как: for dr in (-1,0,1): for dc in (-1,0,1)

function getNeighbors(state: GameState, row: number, col: number): Array<[number, number]> {
  const result: Array<[number, number]> = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue // саму клетку не считаем
      const r = row + dr
      const c = col + dc
      // Проверяем границы поля, чтобы не выйти за массив
      if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
        result.push([r, c])
      }
    }
  }
  return result
}

// ------------------------------------------------------------
// Копия состояния (иммутабельность)
// ------------------------------------------------------------
// Клонируем «поверхностно»: сами клетки копируем по одной.
// Для поля из сотен клеток это дёшево, а код — простой и надёжный.

function cloneState(state: GameState): GameState {
  return {
    ...state,
    cells: state.cells.map((row) => row.map((cell) => ({ ...cell }))),
  }
}

// ------------------------------------------------------------
// Расстановка мин
// ------------------------------------------------------------
// Вызывается после ПЕРВОГО клика: клетка клика и все её соседи
// гарантированно свободны от мин (иначе первый клик мог бы
// мгновенно проиграть партию — так нечестно).

function placeMines(state: GameState, safeRow: number, safeCol: number): void {
  // Зона-запрет: первый клик + 8 соседей
  const forbidden = new Set<string>([`${safeRow}:${safeCol}`])
  for (const [r, c] of getNeighbors(state, safeRow, safeCol)) {
    forbidden.add(`${r}:${c}`)
  }

  // Собираем все клетки, где мина разрешена
  const candidates: Array<[number, number]> = []
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (!forbidden.has(`${r}:${c}`)) candidates.push([r, c])
    }
  }

  // Перемешивание Фишера—Йетса — честный случайный порядок.
  // Аналог random.shuffle(list) в Python.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  // Берём первые N перемешанных клеток — там будут мины
  for (let i = 0; i < state.mineCount && i < candidates.length; i++) {
    const [r, c] = candidates[i]
    state.cells[r][c].isMine = true
  }

  // Считаем для каждой клетки, сколько мин вокруг — эти числа
  // и подсвечиваются на открытом поле
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      state.cells[r][c].adjacentMines = getNeighbors(state, r, c).filter(
        ([nr, nc]) => state.cells[nr][nc].isMine,
      ).length
    }
  }

  state.minesPlaced = true
}

// ------------------------------------------------------------
// Открытие клетки — главное действие игры
// ------------------------------------------------------------

export function revealCell(state: GameState, row: number, col: number): GameState {
  // Игра окончена — ничего не делаем
  if (state.status === 'won' || state.status === 'lost') return state
  const original = state.cells[row][col]
  if (original.isRevealed || original.isFlagged) return state

  const next = cloneState(state)

  // Первый клик партии: сначала расставляем мины вдали от него
  if (!next.minesPlaced) {
    placeMines(next, row, col)
    next.status = 'playing'
  }

  const target = next.cells[row][col]

  // Наступили на мину — поражение. Показываем всё поле.
  if (target.isMine) {
    target.isRevealed = true
    target.exploded = true
    for (const rowCells of next.cells) {
      for (const c of rowCells) {
        if (c.isMine) c.isRevealed = true
      }
    }
    next.status = 'lost'
    return next
  }

  // «Заливка» (flood fill): открываем клетку; если она ПУСТАЯ
  // (0 мин рядом) — открываем её соседей, и так волной, пока
  // не упрёмся в клетки с числами. Это очередь BFS — в Python
  // то же самое делают через collections.deque.
  const queue: Array<[number, number]> = [[row, col]]
  while (queue.length > 0) {
    const [r, c] = queue.shift()! // достаём клетку из начала очереди
    const current = next.cells[r][c]
    if (current.isRevealed || current.isFlagged || current.isMine) continue
    current.isRevealed = true
    next.revealedCount += 1
    if (current.adjacentMines === 0) {
      // Пустая клетка — её соседи тоже безопасны, ставим их в очередь
      for (const [nr, nc] of getNeighbors(next, r, c)) {
        if (!next.cells[nr][nc].isRevealed && !next.cells[nr][nc].isFlagged) {
          queue.push([nr, nc])
        }
      }
    }
  }

  // Победа: открыты все клетки, КРОМЕ мин
  if (next.revealedCount === next.rows * next.cols - next.mineCount) {
    next.status = 'won'
  }
  return next
}

// ------------------------------------------------------------
// Флажок
// ------------------------------------------------------------

export function toggleFlag(state: GameState, row: number, col: number): GameState {
  if (state.status === 'won' || state.status === 'lost') return state
  const cell = state.cells[row][col]
  if (cell.isRevealed) return state // на открытую клетку флажок не ставят

  const next = cloneState(state)
  next.cells[row][col].isFlagged = !next.cells[row][col].isFlagged
  return next
}

// ------------------------------------------------------------
// «Аккорд» — быстрое открытие для опытных игроков
// ------------------------------------------------------------
// Клик по ОТКРЫТОЙ клетке с числом: если рядом уже стоит ровно
// столько флажков, сколько показывает число, — открываем все
// остальные соседние клетки. Если где-то ошиблись флажком — взрыв.

export function chordCell(state: GameState, row: number, col: number): GameState {
  if (state.status === 'won' || state.status === 'lost') return state
  const origin = state.cells[row][col]
  if (!origin.isRevealed || origin.adjacentMines === 0) return state

  const neighbors = getNeighbors(state, row, col)
  const flagsAround = neighbors.filter(([r, c]) => state.cells[r][c].isFlagged).length
  if (flagsAround !== origin.adjacentMines) return state

  // Открываем каждую закрытую (не помеченную флажком) клетку по очереди.
  // revealCell сам разберётся с заливкой и поражением.
  let next = state
  for (const [r, c] of neighbors) {
    const n = next.cells[r][c]
    if (!n.isFlagged && !n.isRevealed) {
      next = revealCell(next, r, c)
    }
    if (next.status === 'lost') break
  }
  return next
}

// ------------------------------------------------------------
// Вспомогательное: сколько флажков на поле (для счётчика мин)
// ------------------------------------------------------------

export function countFlags(state: GameState): number {
  return state.cells.flat().filter((c) => c.isFlagged).length
}
