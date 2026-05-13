import { useCallback, useEffect, useRef, useState } from 'react'
import Hammer from 'hammerjs'

type Direction = 'up' | 'right' | 'down' | 'left'

interface Tile {
  id: number
  x: number
  y: number
  value: number
}

const BOARD_SIZE_OPTIONS = [4, 5, 6] as const
const COLORS: Record<number, string> = {
  2: '#00d0a4',
  4: '#dd7373',
  8: '#7d53de',
  16: '#6622cc',
  32: '#00bfb2',
  64: '#c06ff2',
  128: '#340068',
  256: '#3e92cc',
  512: '#d8315b',
  1024: '#1c0b19',
  2048: '#1c0b19'
}

function randomTileValue(): number {
  return Math.random() < 0.9 ? 2 : 4
}

function keyFor(x: number, y: number): string {
  return `${x},${y}`
}

export function Game2048() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [score, setScore] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [boardSize, setBoardSize] = useState<number>(4)
  const nextIdRef = useRef(1)
  const boardRef = useRef<HTMLDivElement>(null)

  const getEmptyCells = useCallback((sourceTiles: Tile[]) => {
    const occupied = new Set(sourceTiles.map((t) => keyFor(t.x, t.y)))
    const empty: Array<{ x: number; y: number }> = []
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (!occupied.has(keyFor(x, y))) empty.push({ x, y })
      }
    }
    return empty
  }, [boardSize])

  const addRandomTile = useCallback((sourceTiles: Tile[]): Tile[] => {
    const empty = getEmptyCells(sourceTiles)
    if (!empty.length) return sourceTiles
    const pos = empty[Math.floor(Math.random() * empty.length)]
    return [
      ...sourceTiles,
      {
        id: nextIdRef.current++,
        x: pos.x,
        y: pos.y,
        value: randomTileValue()
      }
    ]
  }, [getEmptyCells])

  const initGame = useCallback(() => {
    nextIdRef.current = 1
    setScore(0)
    setStatusText('')
    let nextTiles: Tile[] = []
    nextTiles = addRandomTile(nextTiles)
    nextTiles = addRandomTile(nextTiles)
    setTiles(nextTiles)
  }, [addRandomTile])

  const canMove = useCallback((sourceTiles: Tile[]) => {
    if (sourceTiles.length < boardSize * boardSize) return true
    const map = new Map<string, Tile>()
    sourceTiles.forEach((t) => map.set(keyFor(t.x, t.y), t))

    for (const tile of sourceTiles) {
      const right = map.get(keyFor(tile.x + 1, tile.y))
      const down = map.get(keyFor(tile.x, tile.y + 1))
      if ((right && right.value === tile.value) || (down && down.value === tile.value)) {
        return true
      }
    }
    return false
  }, [boardSize])

  const move = useCallback((direction: Direction) => {
    setTiles((prevTiles) => {
      if (!prevTiles.length) return prevTiles

      let moved = false
      let gained = 0
      const byPos = new Map<string, Tile>()
      prevTiles.forEach((t) => byPos.set(keyFor(t.x, t.y), { ...t }))
      const nextTiles: Tile[] = []

      const moveLine = (lineTiles: Tile[]): Tile[] => {
        const merged: Tile[] = []
        let i = 0
        while (i < lineTiles.length) {
          const current = { ...lineTiles[i] }
          const next = lineTiles[i + 1]
          if (next && next.value === current.value) {
            current.value = current.value * 2
            gained += current.value
            i += 2
          } else {
            i += 1
          }
          merged.push(current)
        }
        return merged
      }

      for (let fixed = 0; fixed < boardSize; fixed++) {
        const indexes = Array.from({ length: boardSize }, (_, i) => i)
        const readOrder = (direction === 'right' || direction === 'down') ? [...indexes].reverse() : indexes

        const line: Tile[] = []
        for (const step of readOrder) {
          const x = direction === 'left' || direction === 'right' ? step : fixed
          const y = direction === 'up' || direction === 'down' ? step : fixed
          const tile = byPos.get(keyFor(x, y))
          if (tile) line.push(tile)
        }

        const mergedLine = moveLine(line)

        for (let slot = 0; slot < mergedLine.length; slot++) {
          const tile = mergedLine[slot]
          const boardIndex = (direction === 'right' || direction === 'down') ? (boardSize - 1 - slot) : slot
          const targetX = direction === 'left' || direction === 'right' ? boardIndex : fixed
          const targetY = direction === 'up' || direction === 'down' ? boardIndex : fixed
          if (tile.x !== targetX || tile.y !== targetY) moved = true
          nextTiles.push({ ...tile, x: targetX, y: targetY })
        }
      }

      if (!moved) return prevTiles

      const withNewTile = addRandomTile(nextTiles)

      if (gained > 0) {
        setScore((prev) => prev + gained)
      }

      if (withNewTile.some((t) => t.value === 2048)) {
        setStatusText('You won!')
      } else if (!canMove(withNewTile)) {
        setStatusText('Game over!')
      } else {
        setStatusText('')
      }

      return withNewTile
    })
  }, [addRandomTile, canMove, boardSize])

  useEffect(() => {
    initGame()
  }, [initGame])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key
      if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(key)) {
        event.preventDefault()
      }
      if (key === 'ArrowUp') move('up')
      if (key === 'ArrowRight') move('right')
      if (key === 'ArrowDown') move('down')
      if (key === 'ArrowLeft') move('left')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move])

  useEffect(() => {
    if (!boardRef.current) return
    const hammer = new Hammer(boardRef.current, {
      recognizers: [[Hammer.Swipe, { direction: Hammer.DIRECTION_ALL }]]
    })

    hammer.on('swipeleft', () => move('left'))
    hammer.on('swiperight', () => move('right'))
    hammer.on('swipeup', () => move('up'))
    hammer.on('swipedown', () => move('down'))

    return () => hammer.destroy()
  }, [move])

  return (
    <main className="w-full max-w-[500px] px-4 py-4 text-white">
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold tracking-wide text-[#f9d49a]">2048</h1>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          data-js="newGame"
          onClick={initGame}
          className="rounded-md border-2 border-transparent bg-transparent px-4 py-2 font-bold tracking-[0.08em] text-[#f9d49a] shadow-[inset_0_0_0_2px_#d4a8cf] outline outline-2 outline-[#f9d49a]"
        >
          New Game
        </button>
        <div className="flex items-center gap-2">
          {BOARD_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => setBoardSize(size)}
              className={`rounded-md px-3 py-1 text-sm font-bold ${boardSize === size ? 'bg-[#f9d49a] text-[#261535]' : 'bg-white/10 text-[#f9d49a]'}`}
            >
              {size}x{size}
            </button>
          ))}
        </div>

        <div className="inline-block min-w-[6.5rem] rounded-md bg-gradient-to-r from-[#f9d49a] to-[#d4a8cf] px-3 py-2 text-center">
          <span className="text-sm text-slate-800">Score</span>
          <br />
          <span data-js="score" className="text-3xl font-extrabold leading-none text-[#4a3647]">{score}</span>
        </div>
      </div>

      <div
        id="touchGameboard"
        ref={boardRef}
        className="relative mb-6 w-full rounded-md bg-white/5 p-2 shadow-[0_0_8px_0_#f9d49a] touch-none"
      >
        <div className="aspect-square w-full">
          <div
            className="grid h-full w-full gap-2"
            style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: boardSize * boardSize }).map((_, i) => (
              <div key={i} className="rounded-sm bg-[rgba(238,228,218,0.35)]" />
            ))}
          </div>

          <div className="pointer-events-none absolute inset-2">
            {tiles.map((tile) => (
              <div
                key={tile.id}
                className="absolute p-1 transition-all duration-150 ease-out"
                style={{
                  width: `${100 / boardSize}%`,
                  height: `${100 / boardSize}%`,
                  transform: `translate(${tile.x * 100}%, ${tile.y * 100}%)`
                }}
              >
                <div
                  className="flex h-full w-full items-center justify-center rounded-sm text-3xl font-bold text-white shadow"
                  style={{ backgroundColor: COLORS[tile.value] || '#1c0b19' }}
                >
                  {tile.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="border-y border-slate-400/40 py-4 text-sm">
        <h2 className="mb-2 text-lg italic">What is this?</h2>
        <p>
          Although coded from scratch in this app, this game follows the classic 2048 gameplay.
        </p>
      </section>

      <section className="border-b border-slate-400/40 py-4 text-sm">
        <h2 className="mb-2 text-lg italic">How do I play?</h2>
        <p className="mb-2">Tiles with the same value merge into one tile with their summed value.</p>
        <p className="mb-3">Use arrow keys or swipe to move the board.</p>
        <div className="mb-3 flex items-center gap-4 text-3xl">
          <span>↑</span>
          <span>←</span>
          <span>→</span>
          <span>↓</span>
        </div>
        <p>Reach 2048 to win.</p>
      </section>

      {statusText && (
        <div className="mt-4 rounded-md bg-black/30 px-3 py-2 text-sm font-semibold text-[#f9d49a]">
          {statusText}
        </div>
      )}
    </main>
  )
}
