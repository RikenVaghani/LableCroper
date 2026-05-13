import { useCallback, useEffect, useRef, useState } from 'react'

type GameState = 'ready' | 'playing' | 'ended' | 'resetting'
type Plane = 'x' | 'z'

type Block = {
  id: number
  x: number
  z: number
  width: number
  depth: number
  y: number
  color: string
  moving: boolean
  plane: Plane
  direction: number
  falling?: boolean
}

const MOVE_LIMIT = 12
const BASE_WIDTH = 10
const BASE_DEPTH = 10
const BLOCK_HEIGHT = 2

function blockColor(index: number): string {
  if (index === 0) return '#333344'
  const r = Math.sin(0.3 * index) * 55 + 200
  const g = Math.sin(0.3 * index + 2) * 55 + 200
  const b = Math.sin(0.3 * index + 4) * 55 + 200
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

export function StackTower() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [state, setState] = useState<GameState>('ready')
  const [score, setScore] = useState(0)

  const frameRef = useRef<number | null>(null)
  const idRef = useRef(1)
  const cameraRef = useRef(0)

  const addBlock = useCallback((prevBlocks: Block[]) => {
    const prev = prevBlocks[prevBlocks.length - 1]
    const index = prevBlocks.length

    const plane: Plane = index % 2 === 0 ? 'x' : 'z'

    const baseSpeed = 0.1 + index * 0.004
    const speed =
      (Math.random() > 0.5 ? 1 : -1) * Math.min(baseSpeed, 0.28)

    const next: Block = {
      id: idRef.current++,
      x: prev ? prev.x : 0,
      z: prev ? prev.z : 0,
      width: prev ? prev.width : BASE_WIDTH,
      depth: prev ? prev.depth : BASE_DEPTH,
      y: index * BLOCK_HEIGHT,
      color: blockColor(index),
      moving: true,
      plane,
      direction: speed
    }

    next[plane] = Math.random() > 0.5 ? -MOVE_LIMIT : MOVE_LIMIT

    return [...prevBlocks, next]
  }, [])

  const resetGame = useCallback(() => {
    idRef.current = 1

    const base: Block = {
      id: idRef.current++,
      x: 0,
      z: 0,
      width: BASE_WIDTH,
      depth: BASE_DEPTH,
      y: 0,
      color: blockColor(0),
      moving: false,
      plane: 'x',
      direction: 0
    }

    setBlocks([base])
    setScore(0)
    setState('ready')
  }, [])

  useEffect(() => {
    resetGame()
  }, [resetGame])

  const startGame = useCallback(() => {
    setState('playing')
    setBlocks((prev) => (prev.length === 1 ? addBlock(prev) : prev))
  }, [addBlock])

  const endGame = useCallback(() => {
    setState('ended')
  }, [])

  const placeBlock = useCallback(() => {
    setBlocks((prev) => {
      if (prev.length < 2) return prev

      const arr = [...prev]
      const current = { ...arr[arr.length - 1] }
      const target = arr[arr.length - 2]

      const plane = current.plane
      const dimKey = plane === 'x' ? 'width' : 'depth'

      const size = current[dimKey]
      const delta = current[plane] - target[plane]
      let overlap = size - Math.abs(delta)

      if (overlap <= 0) {
        endGame()
        return prev
      }

      // 🎯 perfect placement bonus
      if (Math.abs(delta) < 0.3) {
        overlap = size
        current.x = target.x
        current.z = target.z
        current.width = target.width
        current.depth = target.depth
        setScore((s) => s + 2)
      } else {
        // ✂️ create chopped falling piece
        const chopped: Block = {
          ...current,
          id: idRef.current++,
          [dimKey]: size - overlap,
          [plane]:
            delta > 0
              ? current[plane] + overlap / 2
              : current[plane] - overlap / 2,
          falling: true,
          moving: false
        }

        arr.push(chopped)
      }

      current[dimKey] = overlap

      // 🎯 center alignment fix
      current[plane] = target[plane] + delta / 2

      current.moving = false
      arr[arr.length - 1] = current

      const nextScore = arr.filter((b) => !b.falling).length - 1
      setScore(nextScore)

      return addBlock(arr)
    })
  }, [addBlock, endGame])

  const onAction = useCallback(() => {
    if (state === 'resetting') return

    if (state === 'ready') startGame()
    else if (state === 'playing') placeBlock()
    else if (state === 'ended') {
      setState('resetting')
      setTimeout(() => {
        resetGame()
        startGame()
      }, 250)
    }
  }, [placeBlock, resetGame, startGame, state])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        onAction()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAction])

  useEffect(() => {
    const loop = () => {
      setBlocks((prev) => {
        if (prev.length === 0) return prev

        const arr = prev.map((b) => ({ ...b }))

        const top = arr[arr.length - 1]

        if (state === 'playing' && top.moving && !top.falling) {
          const plane = top.plane
          const next = top[plane] + top.direction

          if (next > MOVE_LIMIT || next < -MOVE_LIMIT) {
            top.direction = -top.direction
            top[plane] = Math.max(Math.min(next, MOVE_LIMIT), -MOVE_LIMIT)
          } else {
            top[plane] = next
          }
        }

        // ⬇️ falling animation
        arr.forEach((b) => {
          if (b.falling) {
            b.y -= 0.5
          }
        })

        return arr
      })

      // 🎥 smooth camera
      const target = Math.max(0, (blocks.length - 5) * 14)
      cameraRef.current += (target - cameraRef.current) * 0.1

      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [state, blocks.length])

  const cameraY = cameraRef.current

  return (
    <div
      className={`relative h-[82vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-[#d0cbc7] cursor-pointer`}
      onClick={onAction}
    >
      <div className="absolute left-0 top-5 z-20 w-full text-center text-[10vh] font-bold text-[#333344]">
        {score}
      </div>

      <div className="absolute inset-0">
        <div
          className="absolute left-1/2 top-[86%] w-full -translate-x-1/2"
          style={{ transform: `translate(-50%, ${cameraY}px)` }}
        >
          {blocks.map((b) => (
            <div
              key={b.id}
              className="absolute border border-black/10 shadow-sm"
              style={{
                left: `calc(50% + ${b.x * 8}px - ${(b.width * 8) / 2}px)`,
                top: `${(blocks.length * BLOCK_HEIGHT - b.y) * 10}px`,
                width: `${b.width * 8}px`,
                height: `${BLOCK_HEIGHT * 10}px`,
                backgroundColor: b.color,
                opacity: b.falling ? 0.7 : 1,
                transform: 'skewX(-6deg)'
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute top-[16vh] w-full text-center text-[#333344]">
        Click / Space to play
      </div>

      {state === 'ended' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#333344]">
          <h2 className="text-4xl">Game Over</h2>
          <p>Click to restart</p>
        </div>
      )}
    </div>
  )
}
