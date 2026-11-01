'use client'

// ============================================================
// САПЁР — интерфейс (React-компоненты)
// ------------------------------------------------------------
// Здесь логика из src/lib/minesweeper.ts «оживает»:
//  - useState хранит состояние игры и заставляет React перерисовывать экран
//  - клики вызывают функции логики и сохраняют новое состояние
//  - useEffect запускает таймер и сохраняет рекорды
// ============================================================

import { useEffect, useRef, useState } from 'react'
import {
  chordCell,
  countFlags,
  createGameState,
  revealCell,
  toggleFlag,
  DIFFICULTIES,
  type Cell,
  type Difficulty,
  type GameState,
} from '@/lib/minesweeper'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// --- Константы внешнего вида ---------------------------------

// Цвета цифр: сколько мин вокруг клетки (классическая палитра Сапёра)
const NUMBER_COLORS: Record<number, string> = {
  1: 'text-teal-600',
  2: 'text-emerald-700',
  3: 'text-orange-600',
  4: 'text-rose-700',
  5: 'text-red-700',
  6: 'text-fuchsia-600',
  7: 'text-stone-900',
  8: 'text-stone-500',
}

// Размер клеток: на «Сложно» 30 столбцов — клетки мельче, чтобы влезали
const CELL_SIZE: Record<Difficulty, string> = {
  easy: 'size-9 sm:size-10 text-sm sm:text-base',
  medium: 'size-7 sm:size-9 text-xs sm:text-sm',
  hard: 'size-6 sm:size-8 text-[10px] sm:text-sm',
}

const BEST_KEY = 'minesweeper-best-times' // ключ в localStorage браузера

// ============================================================
// Клетка поля — кнопка
// ============================================================

interface CellButtonProps {
  cell: Cell
  gameStatus: GameState['status']
  sizeClass: string
  row: number
  col: number
  onReveal: () => void
  onFlag: () => void
}

function CellButton({ cell, gameStatus, sizeClass, row, col, onReveal, onFlag }: CellButtonProps) {
  // --- Долгое нажатие на телефоне = флажок ---
  // Игра отслеживает удержание сама и гасит «хвост» системных событий
  // (contextmenu и click), которые телефон досылает после удержания.
  // Раньше contextmenu переключал флажок ОБРАТНО — он исчезал, игрок
  // тапал снова и подрывался на мине.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const suppressRef = useRef(false) // гасим click/contextmenu ПОСЛЕ долгого нажатия
  const pointerTypeRef = useRef<string>('')
  const [holding, setHolding] = useState(false) // подсветка клетки при удержании

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  // Палец отпущен/уехал до срабатывания — флажок не ставим
  const endHold = () => {
    clearTimer()
    startPosRef.current = null
    setHolding(false)
  }

  // При уходе со страницы не оставляем висящий таймер
  useEffect(() => {
    return () => clearTimer()
  }, [])

  const startLongPress = (e: React.PointerEvent) => {
    pointerTypeRef.current = e.pointerType
    suppressRef.current = false // новое касание — новый жест
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return // у мыши правый клик и так работает
    startPosRef.current = { x: e.clientX, y: e.clientY }
    setHolding(true)
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      suppressRef.current = true
      startPosRef.current = null
      setHolding(false)
      onFlag()
      if ('vibrate' in navigator) navigator.vibrate(50) // лёгкая вибрация
    }, 400)
  }
  // Палец «уехал» при скролле — отменяем флажок и гасим досланный клик
  const handlePointerMove = (e: React.PointerEvent) => {
    const s = startPosRef.current
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) {
      endHold()
      suppressRef.current = true
    }
  }

  const handleClick = () => {
    // suppress сбрасывается при СЛЕДУЮЩЕМ касании (startLongPress),
    // чтобы пара «contextmenu + click» не проскочила дважды
    if (pointerTypeRef.current === 'touch' && suppressRef.current) return
    onReveal()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault() // убираем системное меню браузера
    if (pointerTypeRef.current === 'touch' && suppressRef.current) return
    onFlag()
  }

  // --- Что показывать в клетке? ---
  const isHiddenStyle =
    'bg-stone-300 hover:bg-stone-200 shadow-[inset_2px_2px_0_rgba(255,255,255,0.65),inset_-2px_-2px_0_rgba(0,0,0,0.12)] cursor-pointer'

  let content: React.ReactNode = null
  let style = isHiddenStyle

  if (gameStatus === 'won' && cell.isMine && !cell.isFlagged) {
    // Победа: непомеченные мины «закрываются» флажками автоматически
    content = '🚩'
  } else if (cell.isFlagged) {
    content = '🚩'
    if (gameStatus === 'lost' && !cell.isMine) {
      // После поражения видно, где флажок стоял ОШИБОЧНО
      content = (
        <>
          <span>🚩</span>
          <span className="absolute inset-0 grid place-items-center text-base font-black text-red-600">
            ✕
          </span>
        </>
      )
    }
  } else if (cell.isRevealed) {
    if (cell.isMine) {
      style = cell.exploded ? 'bg-red-500' : 'bg-red-300/80'
      content = '💣'
    } else {
      style = 'bg-stone-100/90 shadow-inner cursor-default'
      if (cell.adjacentMines > 0) {
        content = (
          <span className={`font-mono font-bold ${NUMBER_COLORS[cell.adjacentMines]}`}>
            {cell.adjacentMines}
          </span>
        )
      }
    }
  }

  // Призрак флажка: игрок видит, что удержание работает, и не убирает палец рано
  const ghost = holding && !cell.isRevealed && !cell.isFlagged
  if (ghost) {
    content = <span className="opacity-40">🚩</span>
    style = `${style} ring-2 ring-inset ring-red-500`
  }

  const ariaState = cell.isRevealed
    ? cell.isMine
      ? 'мина'
      : `открыта, мин рядом: ${cell.adjacentMines}`
    : cell.isFlagged
      ? 'флажок'
      : 'закрыта'

  return (
    <button
      type="button"
      className={`grid place-items-center rounded-[5px] border border-black/5 transition-colors select-none touch-manipulation [-webkit-tap-highlight-color:transparent] active:scale-95 ${style} ${sizeClass}`}
      style={{ WebkitTouchCallout: 'none' }}
      aria-label={`Ряд ${row + 1}, столбец ${col + 1}: ${ariaState}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={startLongPress}
      onPointerUp={endHold}
      onPointerLeave={endHold}
      onPointerCancel={endHold}
      onPointerMove={handlePointerMove}
      onKeyDown={(e) => {
        // Флажок с клавиатуры: F или А (русская раскладка)
        if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
          e.preventDefault()
          onFlag()
        }
      }}
    >
      {content}
    </button>
  )
}

// ============================================================
// Страница игры
// ============================================================

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [game, setGame] = useState<GameState>(() => createGameState('easy'))
  const [time, setTime] = useState(0) // секунды
  const [bestTimes, setBestTimes] = useState<Record<string, number>>({})
  const [newRecord, setNewRecord] = useState(false)

  const flags = countFlags(game)
  const minesLeft = game.mineCount - flags
  const isGameOver = game.status === 'won' || game.status === 'lost'

  // --- Таймер: идёт, только пока игра активна ---
  useEffect(() => {
    if (game.status !== 'playing') return
    const id = setInterval(() => setTime((t) => Math.min(999, t + 1)), 1000)
    return () => clearInterval(id) // очистка при остановке — без утечек
  }, [game.status])

  // --- Рекорды: читаем из localStorage после монтирования ---
  // localStorage для React — «внешняя система» (сервер о ней не знает),
  // поэтому читаем аккуратно, в колбэке, а не синхронно в теле эффекта
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(BEST_KEY)
        if (raw) setBestTimes(JSON.parse(raw))
      } catch {
        /* приватный режим — просто без рекордов */
      }
    })
  }, [])

  // --- Действия игрока ---

  const handleReveal = (row: number, col: number) => {
    if (isGameOver) return
    const cell = game.cells[row][col]
    const next = cell.isRevealed
      ? chordCell(game, row, col) // клик по открытой цифре — «аккорд»
      : revealCell(game, row, col)
    setGame(next)

    // Побочный эффект делаем здесь, в обработчике события, а не в useEffect:
    // если партия только что выиграна — фиксируем рекорд
    if (next.status === 'won' && game.status !== 'won') {
      const current = bestTimes[difficulty]
      if (current === undefined || time < current) {
        const nextBest = { ...bestTimes, [difficulty]: time }
        setBestTimes(nextBest)
        setNewRecord(true)
        try {
          window.localStorage.setItem(BEST_KEY, JSON.stringify(nextBest))
        } catch {
          /* ignore */
        }
      } else {
        setNewRecord(false)
      }
    }
  }

  const handleFlag = (row: number, col: number) => {
    setGame((g) => toggleFlag(g, row, col))
  }

  const restart = () => {
    setGame(createGameState(difficulty))
    setTime(0)
    setNewRecord(false)
  }

  const changeDifficulty = (d: Difficulty) => {
    if (d === difficulty) return
    setDifficulty(d)
    setGame(createGameState(d))
    setTime(0)
    setNewRecord(false)
  }

  // Текст для скринридеров
  const statusText =
    game.status === 'won'
      ? 'Победа!'
      : game.status === 'lost'
        ? 'Поражение'
        : game.status === 'playing'
          ? 'Игра идёт'
          : 'Откройте любую клетку, чтобы начать'

  // ============================================================
  // Разметка
  // ============================================================

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="sr-only" role="status" aria-live="polite">
        {statusText}
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-5 px-4 py-8">
        {/* Заголовок */}
        <header className="space-y-1 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-800 sm:text-4xl">
            🧨 Сапёр
          </h1>
          <p className="text-sm text-stone-500 sm:text-base">
            Классика жанра — первая игра на React
          </p>
        </header>

        {/* Выбор сложности + рекорд */}
        <div className="flex flex-col items-center gap-2">
          <Tabs value={difficulty} onValueChange={(v) => changeDifficulty(v as Difficulty)}>
            <TabsList>
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
                <TabsTrigger key={key} value={key}>
                  {DIFFICULTIES[key].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-xs text-stone-500 sm:text-sm">
            {bestTimes[difficulty] !== undefined
              ? `🏆 Рекорд: ${bestTimes[difficulty]} сек`
              : 'Рекорд ещё не установлен'}
          </p>
        </div>

        {/* Панель статуса: мины • смайлик • время */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            className="min-w-18 rounded-lg bg-stone-900 px-3 py-1.5 text-center font-mono text-lg font-bold text-amber-300 tabular-nums shadow-inner sm:text-xl"
            aria-label={`Осталось мин: ${minesLeft}`}
          >
            💣 {minesLeft < 0 ? minesLeft : String(minesLeft).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={restart}
            aria-label="Начать заново"
            className="grid size-12 place-items-center rounded-xl border border-stone-300 bg-stone-200 text-2xl shadow-sm transition hover:bg-stone-100 active:scale-90 sm:size-14 sm:text-3xl"
          >
            {game.status === 'won' ? '😎' : game.status === 'lost' ? '💀' : '🙂'}
          </button>
          <span
            className="min-w-18 rounded-lg bg-stone-900 px-3 py-1.5 text-center font-mono text-lg font-bold text-amber-300 tabular-nums shadow-inner sm:text-xl"
            aria-label={`Прошло секунд: ${time}`}
          >
            ⏱ {String(time).padStart(3, '0')}
          </span>
        </div>

        {/* Игровое поле */}
        <div className="relative mx-auto w-fit max-w-full">
          <div className="max-w-full overflow-x-auto rounded-2xl bg-stone-400/30 p-2 shadow-lg sm:p-3">
            <div
              className="grid w-fit gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))` }}
            >
              {game.cells.map((rowCells, r) =>
                rowCells.map((cell, c) => (
                  <CellButton
                    key={`${r}:${c}`}
                    cell={cell}
                    gameStatus={game.status}
                    sizeClass={CELL_SIZE[difficulty]}
                    row={r}
                    col={c}
                    onReveal={() => handleReveal(r, c)}
                    onFlag={() => handleFlag(r, c)}
                  />
                )),
              )}
            </div>
          </div>

          {/* Оверлей победы / поражения */}
          {isGameOver && (
            <div className="absolute inset-0 z-10 grid animate-in fade-in place-items-center rounded-2xl bg-stone-900/60 backdrop-blur-sm duration-300">
              <div className="max-w-[90%] animate-in zoom-in-95 rounded-2xl bg-white px-8 py-6 text-center shadow-2xl duration-300 sm:px-10">
                <div className="mb-2 text-5xl">{game.status === 'won' ? '🏆' : '💥'}</div>
                <h2 className="mb-1 text-xl font-bold text-stone-800 sm:text-2xl">
                  {game.status === 'won' ? 'Победа!' : 'Взрыв!'}
                </h2>
                <p className="mb-1 text-sm text-stone-500">
                  {game.status === 'won'
                    ? `Поле разминировано за ${time} сек`
                    : 'Вы наступили на мину. Ещё попытка?'}
                </p>
                {game.status === 'won' && (
                  <p
                    className={`text-sm ${newRecord ? 'font-semibold text-amber-600' : 'text-stone-400'}`}
                  >
                    {newRecord ? '🏆 Новый рекорд!' : `Рекорд: ${bestTimes[difficulty]} сек`}
                  </p>
                )}
                <Button onClick={restart} className="mt-4">
                  Играть ещё
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Подсказки */}
      <footer className="mt-auto border-t border-stone-200/70 bg-white/50 px-4 py-5">
        <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-center gap-x-8 gap-y-3 text-xs text-stone-600 sm:text-sm">
          <span>
            <span className="mr-1 text-base">🖱️</span>
            <b>Левый клик / тап</b> — открыть клетку
          </span>
          <span>
            <span className="mr-1 text-base">🚩</span>
            <b>Правый клик / долгое нажатие</b> — флажок
          </span>
          <span>
            <span className="mr-1 text-base">⚡</span>
            <b>Клик по цифре</b> — открыть соседей («аккорд»)
          </span>
          <span>
            <span className="mr-1 text-base">📱</span>
            <b>Телефон:</b> держите клетку — подсветка и призрак флажка, затем вибрация
          </span>
          <span>
            <span className="mr-1 text-base">💡</span>
            <b>Первый клик всегда безопасен</b>
          </span>
        </div>
      </footer>
    </div>
  )
}
