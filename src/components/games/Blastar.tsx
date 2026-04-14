import { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCcw, Trophy, Zap, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Play } from 'lucide-react'

const CANV_WIDTH = 800
const CANV_HEIGHT = 600
const SHIP_SIZE = 40
const ALIEN_SIZE = 35
const LASER_SPEED = 8
const ALIEN_SPEED = 2
const INITIAL_ALIENS = 5

interface Star {
  x: number
  y: number
  size: number
  speed: number
}

interface Entity {
  x: number
  y: number
  width: number
  height: number
  color: string
}

interface Bullet {
  x: number
  y: number
}

export function Blastar() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE')
  
  // Game state refs
  const shipPos = useRef({ x: CANV_WIDTH / 2, y: CANV_HEIGHT - 60 })
  const aliens = useRef<Entity[]>([])
  const lasers = useRef<Bullet[]>([])
  const stars = useRef<Star[]>([])
  const keys = useRef<{ [key: string]: boolean }>({})
  const requestRef = useRef<number>(null)
  const lastShotTime = useRef(0)

  const initGame = useCallback(() => {
    // Init stars
    const newStars: Star[] = []
    for (let i = 0; i < 100; i++) {
      newStars.push({
        x: Math.random() * CANV_WIDTH,
        y: Math.random() * CANV_HEIGHT,
        size: Math.random() * 2,
        speed: Math.random() * 2 + 0.5
      })
    }
    stars.current = newStars

    // Init aliens
    aliens.current = []
    spawnAliens()
  }, [])

  const spawnAliens = () => {
    for (let i = 0; i < INITIAL_ALIENS; i++) {
      aliens.current.push({
        x: Math.random() * (CANV_WIDTH - ALIEN_SIZE),
        y: -Math.random() * 500,
        width: ALIEN_SIZE,
        height: ALIEN_SIZE,
        color: `hsl(${Math.random() * 60 + 200}, 100%, 70%)`
      })
    }
  }

  useEffect(() => {
    const savedHighScore = localStorage.getItem('blastar-high-score')
    if (savedHighScore) setHighScore(parseInt(savedHighScore))
    initGame()
  }, [initGame])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('blastar-high-score', score.toString())
    }
  }, [score, highScore])

  const shoot = () => {
    const now = Date.now()
    if (now - lastShotTime.current > 250) {
      lasers.current.push({ x: shipPos.current.x + SHIP_SIZE / 2, y: shipPos.current.y })
      lastShotTime.current = now
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, CANV_WIDTH, CANV_HEIGHT)

    // Draw & Update Stars
    ctx.fillStyle = 'white'
    stars.current.forEach(star => {
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fill()
      star.y += star.speed
      if (star.y > CANV_HEIGHT) {
        star.y = 0
        star.x = Math.random() * CANV_WIDTH
      }
    })

    if (gameState === 'PLAYING') {
      // Input handling
      const moveSpeed = 5
      if (keys.current['ArrowLeft'] || keys.current['a']) shipPos.current.x -= moveSpeed
      if (keys.current['ArrowRight'] || keys.current['d']) shipPos.current.x += moveSpeed
      if (keys.current['ArrowUp'] || keys.current['w']) shipPos.current.y -= moveSpeed
      if (keys.current['ArrowDown'] || keys.current['s']) shipPos.current.y += moveSpeed
      if (keys.current[' ']) shoot()

      // Clamp ship
      shipPos.current.x = Math.max(0, Math.min(CANV_WIDTH - SHIP_SIZE, shipPos.current.x))
      shipPos.current.y = Math.max(0, Math.min(CANV_HEIGHT - SHIP_SIZE, shipPos.current.y))

      // Update Lasers
      lasers.current = lasers.current.filter(l => l.y > 0)
      lasers.current.forEach(l => {
        l.y -= LASER_SPEED
        ctx.fillStyle = '#06b6d4'
        ctx.shadowBlur = 10
        ctx.shadowColor = '#06b6d4'
        ctx.fillRect(l.x - 2, l.y, 4, 15)
        ctx.shadowBlur = 0
      })

      // Update Aliens
      aliens.current.forEach(alien => {
        alien.y += ALIEN_SPEED + (score / 200)
        
        // Draw Alien (simple triangle ship)
        ctx.fillStyle = alien.color
        ctx.beginPath()
        ctx.moveTo(alien.x + alien.width / 2, alien.y + alien.height)
        ctx.lineTo(alien.x, alien.y)
        ctx.lineTo(alien.x + alien.width, alien.y)
        ctx.closePath()
        ctx.fill()

        // Collision with ship
        if (
          alien.x < shipPos.current.x + SHIP_SIZE &&
          alien.x + alien.width > shipPos.current.x &&
          alien.y < shipPos.current.y + SHIP_SIZE &&
          alien.y + alien.height > shipPos.current.y
        ) {
          setGameState('GAMEOVER')
        }

        // Collision with lasers
        lasers.current.forEach((laser, lIndex) => {
          if (
            laser.x > alien.x &&
            laser.x < alien.x + alien.width &&
            laser.y > alien.y &&
            laser.y < alien.y + alien.height
          ) {
            alien.y = -Math.random() * 500
            alien.x = Math.random() * (CANV_WIDTH - alien.width)
            lasers.current.splice(lIndex, 1)
            setScore(s => s + 50)
          }
        })

        if (alien.y > CANV_HEIGHT) {
          alien.y = -100
          alien.x = Math.random() * (CANV_WIDTH - alien.width)
        }
      })

      // Draw Ship
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.moveTo(shipPos.current.x + SHIP_SIZE / 2, shipPos.current.y)
      ctx.lineTo(shipPos.current.x, shipPos.current.y + SHIP_SIZE)
      ctx.lineTo(shipPos.current.x + SHIP_SIZE, shipPos.current.y + SHIP_SIZE)
      ctx.closePath()
      ctx.fill()
      // Ship Glow
      ctx.shadowBlur = 20
      ctx.shadowColor = '#f43f5e'
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    requestRef.current = requestAnimationFrame(draw)
  }, [gameState, score])

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [draw])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 's', 'a', 'd'];
      if (gameKeys.includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
      keys.current[e.key] = true
    }
    const handleKeyUp = (e: KeyboardEvent) => keys.current[e.key] = false
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const startGame = () => {
    setScore(0)
    shipPos.current = { x: CANV_WIDTH / 2, y: CANV_HEIGHT - 60 }
    lasers.current = []
    initGame()
    setGameState('PLAYING')
  }

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
          <span className="text-3xl font-black font-mono leading-none text-rose-500">{score}</span>
        </div>
        <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-cyan-400 fill-cyan-400" />
            <span className="text-sm font-bold text-cyan-400">READY</span>
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
                <h3 className="text-3xl font-black text-rose-500 uppercase tracking-wider">Hull Destroyed</h3>
                <p className="text-slate-300">Final Score: {score}</p>
                <button
                  onClick={startGame}
                  className="px-6 py-2 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RotateCcw className="h-4 w-4" /> Respawn
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <button
                  onClick={startGame}
                  className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black text-xl hover:scale-105 transition-transform shadow-xl shadow-white/10 flex items-center gap-2"
                >
                  <Play className="h-6 w-6 fill-current" /> LAUNCH MISSION
                </button>
                <p className="text-slate-400 text-xs uppercase tracking-widest leading-relaxed">
                  WASD / ARROWS to Move<br/>
                  SPACE to Fire
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="grid grid-cols-3 gap-2 sm:hidden select-none touch-none">
        <div />
        <button 
          onMouseDown={() => (keys.current['ArrowUp'] = true)}
          onMouseUp={() => (keys.current['ArrowUp'] = false)}
          onTouchStart={() => (keys.current['ArrowUp'] = true)}
          onTouchEnd={() => (keys.current['ArrowUp'] = false)}
          className="p-4 rounded-xl bg-slate-800 text-white outline-none"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
        <div />
        <button 
          onMouseDown={() => (keys.current['ArrowLeft'] = true)}
          onMouseUp={() => (keys.current['ArrowLeft'] = false)}
          onTouchStart={() => (keys.current['ArrowLeft'] = true)}
          onTouchEnd={() => (keys.current['ArrowLeft'] = false)}
          className="p-4 rounded-xl bg-slate-800 text-white outline-none"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button 
          onMouseDown={shoot}
          onTouchStart={shoot}
          className="p-4 rounded-xl bg-cyan-500 text-white outline-none"
        >
          <Zap className="h-6 w-6 fill-current" />
        </button>
        <button 
          onMouseDown={() => (keys.current['ArrowRight'] = true)}
          onMouseUp={() => (keys.current['ArrowRight'] = false)}
          onTouchStart={() => (keys.current['ArrowRight'] = true)}
          onTouchEnd={() => (keys.current['ArrowRight'] = false)}
          className="p-4 rounded-xl bg-slate-800 text-white outline-none"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
        <div />
        <button 
          onMouseDown={() => (keys.current['ArrowDown'] = true)}
          onMouseUp={() => (keys.current['ArrowDown'] = false)}
          onTouchStart={() => (keys.current['ArrowDown'] = true)}
          onTouchEnd={() => (keys.current['ArrowDown'] = false)}
          className="p-4 rounded-xl bg-slate-800 text-white outline-none"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
        <div />
      </div>
    </div>
  )
}
