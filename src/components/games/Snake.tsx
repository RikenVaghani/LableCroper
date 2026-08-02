import { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCcw, Trophy, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const GRID_SIZE = 30
const INITIAL_SPEED = 150
const MIN_SPEED = 60
const SPEED_INCREMENT = 2

type Point = { x: number; y: number }
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }])
  const [food, setFood] = useState<Point>({ x: 15, y: 15 })
  const [isGameOver, setIsGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [speed, setSpeed] = useState(INITIAL_SPEED)
  const [isPaused, setIsPaused] = useState(true)

  const directionRef = useRef<Direction>('RIGHT')

  useEffect(() => {
    const savedHighScore = localStorage.getItem('snake-high-score')
    if (savedHighScore) setHighScore(parseInt(savedHighScore))
  }, [])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('snake-high-score', score.toString())
    }
  }, [score, highScore])

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      }
      // eslint-disable-next-line no-loop-func
      if (!currentSnake.some(s => s.x === newFood.x && s.y === newFood.y)) break
    }
    setFood(newFood)
  }, [])

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }])
    generateFood([{ x: 10, y: 10 }])
    directionRef.current = 'RIGHT'
    setIsGameOver(false)
    setScore(0)
    setSpeed(INITIAL_SPEED)
    setIsPaused(false)
  }

  const moveSnake = useCallback(() => {
    if (isGameOver || isPaused) return

    setSnake(prevSnake => {
      const head = prevSnake[0]
      const newHead = { ...head }

      switch (directionRef.current) {
        case 'UP': newHead.y -= 1; break
        case 'DOWN': newHead.y += 1; break
        case 'LEFT': newHead.x -= 1; break
        case 'RIGHT': newHead.x += 1; break
      }

      // Wrap around wall logic
      if (newHead.x < 0) newHead.x = GRID_SIZE - 1
      else if (newHead.x >= GRID_SIZE) newHead.x = 0
      if (newHead.y < 0) newHead.y = GRID_SIZE - 1
      else if (newHead.y >= GRID_SIZE) newHead.y = 0

      // Check self-collision
      if (prevSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        setIsGameOver(true)
        return prevSnake
      }

      const newSnake = [newHead, ...prevSnake]

      // Check food
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10)
        setSpeed(s => Math.max(MIN_SPEED, s - SPEED_INCREMENT))
        generateFood(newSnake)
      } else {
        newSnake.pop()
      }

      return newSnake
    })
  }, [food, isGameOver, isPaused, generateFood])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for game keys to stop page scrolling
      const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 's', 'a', 'd'];
      if (gameKeys.includes(e.key.toLowerCase())) {
        e.preventDefault()
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (directionRef.current !== 'DOWN') {
            directionRef.current = 'UP'
          }
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          if (directionRef.current !== 'UP') {
            directionRef.current = 'DOWN'
          }
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (directionRef.current !== 'RIGHT') {
            directionRef.current = 'LEFT'
          }
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (directionRef.current !== 'LEFT') {
            directionRef.current = 'RIGHT'
          }
          break
        case ' ':
          if (!isGameOver) setIsPaused(p => !p)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isGameOver])

  useEffect(() => {
    const interval = setInterval(moveSnake, speed)
    return () => clearInterval(interval)
  }, [moveSnake, speed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw grid (subtle)
    ctx.strokeStyle = '#e2e8f005'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * (canvas.width / GRID_SIZE), 0)
      ctx.lineTo(i * (canvas.width / GRID_SIZE), canvas.height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * (canvas.height / GRID_SIZE))
      ctx.lineTo(canvas.width, i * (canvas.height / GRID_SIZE))
      ctx.stroke()
    }

    // Draw snake
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#10b981' : '#34d399'
      const x = segment.x * (canvas.width / GRID_SIZE)
      const y = segment.y * (canvas.height / GRID_SIZE)
      const size = canvas.width / GRID_SIZE
      
      // Rounded rectangle for snake
      ctx.beginPath()
      ctx.roundRect(x + 1, y + 1, size - 2, size - 2, 4)
      ctx.fill()
      
      // Eyes for head
      if (index === 0) {
        ctx.fillStyle = 'white'
        const eyeSize = size / 6
        if (directionRef.current === 'RIGHT' || directionRef.current === 'UP') {
          ctx.beginPath()
          ctx.arc(x + size * 0.7, y + size * 0.3, eyeSize, 0, Math.PI * 2)
          ctx.fill()
        }
        if (directionRef.current === 'RIGHT' || directionRef.current === 'DOWN') {
          ctx.beginPath()
          ctx.arc(x + size * 0.7, y + size * 0.7, eyeSize, 0, Math.PI * 2)
          ctx.fill()
        }
        // ... add other directions if needed
      }
    })

    // Draw food
    ctx.fillStyle = '#f43f5e'
    const fx = food.x * (canvas.width / GRID_SIZE)
    const fy = food.y * (canvas.height / GRID_SIZE)
    const fsize = canvas.width / GRID_SIZE
    ctx.beginPath()
    ctx.arc(fx + fsize / 2, fy + fsize / 2, fsize / 3, 0, Math.PI * 2)
    ctx.fill()
    // Add glow to food
    ctx.shadowBlur = 10
    ctx.shadowColor = '#f43f5e'
    ctx.fill()
    ctx.shadowBlur = 0

  }, [snake, food])

  const setDir = (newDir: Direction) => {
    if (isGameOver || isPaused) return
    const opposites = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
    if (opposites[newDir] !== directionRef.current) {
      directionRef.current = newDir
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-3xl mx-auto scroll-mt-24">
      <div className="flex justify-between w-full items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-amber-500" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400">High Score</span>
            <span className="text-lg font-black font-mono leading-none">{highScore}</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">Score</span>
          <span className="text-3xl font-black font-mono leading-none text-emerald-500">{score}</span>
        </div>
        <div className="w-12"></div> {/* Spacer */}
      </div>

      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="rounded-2xl bg-slate-900 border-4 border-slate-200 dark:border-slate-800 shadow-2xl w-full aspect-square"
        />
        
        {(isPaused || isGameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-xl transition-all">
            {isGameOver ? (
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-black text-rose-500">GAME OVER</h3>
                <p className="text-slate-300">Final Score: {score}</p>
                <button
                  onClick={resetGame}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RotateCcw className="h-4 w-4" /> Try Again
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <button
                  onClick={() => setIsPaused(false)}
                  className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black text-xl hover:scale-105 transition-transform shadow-xl shadow-white/10"
                >
                  {score > 0 ? 'RESUME' : 'START GAME'}
                </button>
                <p className="text-slate-400 text-xs">Use Arrow Keys or WASD</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="grid grid-cols-3 gap-2 sm:hidden select-none touch-none">
        <div />
        <button onClick={() => setDir('UP')} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-purple-100 dark:active:bg-purple-900/40">
          <ChevronUp className="h-6 w-6" />
        </button>
        <div />
        <button onClick={() => setDir('LEFT')} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-purple-100 dark:active:bg-purple-900/40">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button onClick={() => setIsPaused(p => !p)} className="p-4 rounded-xl bg-slate-900 text-white font-bold text-xs">
          {isPaused ? 'GO' : '||'}
        </button>
        <button onClick={() => setDir('RIGHT')} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-purple-100 dark:active:bg-purple-900/40">
          <ChevronRight className="h-6 w-6" />
        </button>
        <div />
        <button onClick={() => setDir('DOWN')} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-purple-100 dark:active:bg-purple-900/40">
          <ChevronDown className="h-6 w-6" />
        </button>
        <div />
      </div>

      <p className="hidden sm:block text-slate-400 text-[10px] items-center gap-2">
        <span className="px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded">SPAACE</span> to pause
        <span className="ml-4 px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded">ARROWS</span> to move
      </p>
    </div>
  )
}
