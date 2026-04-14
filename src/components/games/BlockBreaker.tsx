import { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCcw, Trophy, Heart, ChevronLeft, ChevronRight, Play } from 'lucide-react'

const CANV_WIDTH = 800
const CANV_HEIGHT = 600
const PADDLE_WIDTH = 100
const PADDLE_HEIGHT = 12
const BALL_RADIUS = 8
const BRICK_ROWS = 5
const BRICK_COLS = 10
const BRICK_HEIGHT = 25
const BRICK_PADDING = 10
const INITIAL_BALL_SPEED = 4

interface Brick {
  x: number
  y: number
  status: 1 | 0
  color: string
}

const COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4']

export function BlockBreaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER' | 'WON'>('IDLE')

  // Game references (mutable state for the loop)
  const paddleRef = useRef({ x: (CANV_WIDTH - PADDLE_WIDTH) / 2 })
  const ballRef = useRef({ 
    x: CANV_WIDTH / 2, 
    y: CANV_HEIGHT - 30, 
    dx: INITIAL_BALL_SPEED, 
    dy: -INITIAL_BALL_SPEED 
  })
  const bricksRef = useRef<Brick[]>([])
  const rightPressed = useRef(false)
  const leftPressed = useRef(false)
  const requestRef = useRef<number>(null)

  const initBricks = useCallback(() => {
    const newBricks: Brick[] = []
    const brickWidth = (CANV_WIDTH - (BRICK_COLS + 1) * BRICK_PADDING) / BRICK_COLS
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        newBricks.push({
          x: c * (brickWidth + BRICK_PADDING) + BRICK_PADDING,
          y: r * (BRICK_HEIGHT + BRICK_PADDING) + 50,
          status: 1,
          color: COLORS[r % COLORS.length]
        })
      }
    }
    bricksRef.current = newBricks
  }, [])

  useEffect(() => {
    const savedHighScore = localStorage.getItem('blockbreaker-high-score')
    if (savedHighScore) setHighScore(parseInt(savedHighScore))
    initBricks()
  }, [initBricks])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('blockbreaker-high-score', score.toString())
    }
  }, [score, highScore])

  const resetBall = () => {
    ballRef.current = {
      x: CANV_WIDTH / 2,
      y: CANV_HEIGHT - 30,
      dx: INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
      dy: -INITIAL_BALL_SPEED
    }
    paddleRef.current.x = (CANV_WIDTH - PADDLE_WIDTH) / 2
  }

  const startGame = () => {
    setLives(3)
    setScore(0)
    setLevel(1)
    initBricks()
    resetBall()
    setGameState('PLAYING')
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANV_WIDTH, CANV_HEIGHT)

    // Draw grid background
    ctx.strokeStyle = '#e2e8f005'
    ctx.lineWidth = 1
    for (let i = 0; i < CANV_WIDTH; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANV_HEIGHT); ctx.stroke()
    }
    for (let i = 0; i < CANV_HEIGHT; i += 50) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANV_WIDTH, i); ctx.stroke()
    }

    // Move paddle
    if (rightPressed.current && paddleRef.current.x < CANV_WIDTH - PADDLE_WIDTH) {
      paddleRef.current.x += 7
    } else if (leftPressed.current && paddleRef.current.x > 0) {
      paddleRef.current.x -= 7
    }

    // Draw Bricks
    const brickWidth = (CANV_WIDTH - (BRICK_COLS + 1) * BRICK_PADDING) / BRICK_COLS
    bricksRef.current.forEach(brick => {
      if (brick.status === 1) {
        ctx.fillStyle = brick.color
        ctx.beginPath()
        ctx.roundRect(brick.x, brick.y, brickWidth, BRICK_HEIGHT, 4)
        ctx.fill()
        
        // Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.fillRect(brick.x, brick.y, brickWidth, BRICK_HEIGHT / 2)
      }
    })

    // Draw Paddle
    ctx.fillStyle = '#8b5cf6'
    ctx.beginPath()
    ctx.roundRect(paddleRef.current.x, CANV_HEIGHT - PADDLE_HEIGHT - 10, PADDLE_WIDTH, PADDLE_HEIGHT, 6)
    ctx.fill()
    // Paddle Glow
    ctx.shadowBlur = 10
    ctx.shadowColor = '#8b5cf6'
    ctx.stroke()
    ctx.shadowBlur = 0

    // Draw Ball
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(ballRef.current.x, ballRef.current.y, BALL_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    // Ball Glow
    ctx.shadowBlur = 15
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
    ctx.fill()
    ctx.shadowBlur = 0

    // Ball Collision Wall
    if (ballRef.current.x + ballRef.current.dx > CANV_WIDTH - BALL_RADIUS || ballRef.current.x + ballRef.current.dx < BALL_RADIUS) {
      ballRef.current.dx = -ballRef.current.dx
    }
    if (ballRef.current.y + ballRef.current.dy < BALL_RADIUS) {
      ballRef.current.dy = -ballRef.current.dy
    } else if (ballRef.current.y + ballRef.current.dy > CANV_HEIGHT - BALL_RADIUS - 10) {
      // Paddle Collision
      if (ballRef.current.x > paddleRef.current.x && ballRef.current.x < paddleRef.current.x + PADDLE_WIDTH) {
        ballRef.current.dy = -ballRef.current.dy
        // Add some spin based on where it hit the paddle
        const hitPos = (ballRef.current.x - (paddleRef.current.x + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2)
        ballRef.current.dx = hitPos * 5
      } else if (ballRef.current.y > CANV_HEIGHT) {
        setLives(l => {
          if (l <= 1) {
            setGameState('GAMEOVER')
            return 0
          }
          resetBall()
          return l - 1
        })
      }
    }

    // Ball Collision Bricks
    bricksRef.current.forEach(brick => {
      if (brick.status === 1) {
        if (
          ballRef.current.x > brick.x && 
          ballRef.current.x < brick.x + brickWidth && 
          ballRef.current.y > brick.y && 
          ballRef.current.y < brick.y + BRICK_HEIGHT
        ) {
          ballRef.current.dy = -ballRef.current.dy
          brick.status = 0
          setScore(s => s + 10)
        }
      }
    })

    // Win Condition
    if (bricksRef.current.every(b => b.status === 0)) {
      setGameState('WON')
    }

    if (gameState === 'PLAYING') {
      ballRef.current.x += ballRef.current.dx
      ballRef.current.y += ballRef.current.dy
      requestRef.current = requestAnimationFrame(draw)
    }
  }, [gameState])

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(draw)
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [gameState, draw])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 's', 'a', 'd'];
      if (gameKeys.includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
      if (e.key === 'ArrowRight' || e.key === 'd') rightPressed.current = true
      if (e.key === 'ArrowLeft' || e.key === 'a') leftPressed.current = true
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') rightPressed.current = false
      if (e.key === 'ArrowLeft' || e.key === 'a') leftPressed.current = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto scroll-mt-24">
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
          <span className="text-3xl font-black font-mono leading-none text-purple-500">{score}</span>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(3)].map((_, i) => (
            <Heart key={i} className={`h-5 w-5 ${i < lives ? 'text-rose-500 fill-rose-500' : 'text-slate-300 dark:text-slate-700'}`} />
          ))}
        </div>
      </div>

      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={CANV_WIDTH}
          height={CANV_HEIGHT}
          className="rounded-2xl bg-slate-950 border-4 border-slate-200 dark:border-slate-800 shadow-2xl w-full aspect-[6/5]"
        />
        
        {gameState !== 'PLAYING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-xl transition-all">
            {gameState === 'GAMEOVER' ? (
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-black text-rose-500 uppercase tracking-wider">Game Over</h3>
                <p className="text-slate-300">Final Score: {score}</p>
                <button
                  onClick={startGame}
                  className="px-6 py-2 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RotateCcw className="h-4 w-4" /> Try Again
                </button>
              </div>
            ) : gameState === 'WON' ? (
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-black text-emerald-500 uppercase tracking-wider">You Won!</h3>
                <p className="text-slate-300">Score: {score}</p>
                <button
                  onClick={startGame}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RotateCcw className="h-4 w-4" /> Play Again
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <button
                  onClick={startGame}
                  className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black text-xl hover:scale-105 transition-transform shadow-xl shadow-white/10 flex items-center gap-2"
                >
                  <Play className="h-6 w-6 fill-current" /> START GAME
                </button>
                <p className="text-slate-400 text-xs uppercase tracking-widest">Use Arrows or A/D Keys</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="flex gap-4 sm:hidden select-none touch-none">
        <button 
          onMouseDown={() => (leftPressed.current = true)}
          onMouseUp={() => (leftPressed.current = false)}
          onTouchStart={() => (leftPressed.current = true)}
          onTouchEnd={() => (leftPressed.current = false)}
          className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-purple-100 dark:active:bg-purple-900/40 outline-none select-none"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        <button 
          onMouseDown={() => (rightPressed.current = true)}
          onMouseUp={() => (rightPressed.current = false)}
          onTouchStart={() => (rightPressed.current = true)}
          onTouchEnd={() => (rightPressed.current = false)}
          className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-purple-100 dark:active:bg-purple-900/40 outline-none select-none"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>
    </div>
  )
}
