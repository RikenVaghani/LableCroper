import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, Trophy, Play, Cloud } from 'lucide-react'

const CANV_WIDTH = 800
const CANV_HEIGHT = 400
const GROUND_Y = CANV_HEIGHT - 50
const DINO_WIDTH = 44
const DINO_HEIGHT = 48
const GRAVITY = 0.6
const JUMP_FORCE = -12
const INITIAL_SPEED = 6
const SPEED_INC = 0.001

interface Obstacle {
  x: number
  width: number
  height: number
  type: 'cactus' | 'bird'
}

interface Star {
  x: number
  y: number
  size: number
}

export function DinoRun() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE')
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Game state refs
  const dinoPos = useRef({ y: GROUND_Y - DINO_HEIGHT, velocity: 0, isJumping: false })
  const obstacles = useRef<Obstacle[]>([])
  const gameSpeed = useRef(INITIAL_SPEED)
  const frameCount = useRef(0)
  const requestRef = useRef<number>()
  const stars = useRef<Star[]>([])

  const initGame = useCallback(() => {
    obstacles.current = []
    gameSpeed.current = INITIAL_SPEED
    dinoPos.current = { y: GROUND_Y - DINO_HEIGHT, velocity: 0, isJumping: false }
    frameCount.current = 0
    
    // Init stars for night mode
    const newStars: Star[] = []
    for (let i = 0; i < 50; i++) {
      newStars.push({
        x: Math.random() * CANV_WIDTH,
        y: Math.random() * (CANV_HEIGHT - 100),
        size: Math.random() * 2
      })
    }
    stars.current = newStars
  }, [])

  useEffect(() => {
    const savedHighScore = localStorage.getItem('dinorun-high-score')
    if (savedHighScore) setHighScore(parseInt(savedHighScore))
    initGame()
  }, [initGame])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('dinorun-high-score', score.toString())
    }
    // Day/Night switch every 1000 points
    setIsDarkMode(Math.floor(score / 1000) % 2 === 0)
  }, [score, highScore])

  const jump = useCallback(() => {
    if (!dinoPos.current.isJumping && gameState === 'PLAYING') {
      dinoPos.current.velocity = JUMP_FORCE
      dinoPos.current.isJumping = true
    }
  }, [gameState])

  const spawnObstacle = () => {
    const type = 'cactus'
    const height = 30 + Math.random() * 30
    const width = 20 + Math.random() * 20
    obstacles.current.push({
      x: CANV_WIDTH,
      width,
      height,
      type
    })
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    frameCount.current++

    // Clear and background
    ctx.fillStyle = isDarkMode ? '#0f172a' : '#f8fafc'
    ctx.fillRect(0, 0, CANV_WIDTH, CANV_HEIGHT)

    // Draw Stars/Clouds
    if (isDarkMode) {
      ctx.fillStyle = 'white'
      stars.current.forEach(star => {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
        star.x -= gameSpeed.current * 0.1
        if (star.x < 0) star.x = CANV_WIDTH
      })
    }

    // Draw Ground
    ctx.strokeStyle = isDarkMode ? '#334155' : '#e2e8f0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y)
    ctx.lineTo(CANV_WIDTH, GROUND_Y)
    ctx.stroke()

    if (gameState === 'PLAYING') {
      // Update Dino
      dinoPos.current.velocity += GRAVITY
      dinoPos.current.y += dinoPos.current.velocity

      if (dinoPos.current.y > GROUND_Y - DINO_HEIGHT) {
        dinoPos.current.y = GROUND_Y - DINO_HEIGHT
        dinoPos.current.velocity = 0
        dinoPos.current.isJumping = false
      }

      // Update Speed and Score
      gameSpeed.current += SPEED_INC
      setScore(s => s + 1)

      // Spawn Obstacles
      if (frameCount.current % Math.floor(100 / (gameSpeed.current / 5)) === 0) {
        if (Math.random() > 0.7) spawnObstacle()
      }

      // Update Obstacles
      obstacles.current.forEach((obs, index) => {
        obs.x -= gameSpeed.current
        
        // Draw Obstacle (Cactus)
        ctx.fillStyle = isDarkMode ? '#10b981' : '#059669'
        ctx.beginPath()
        ctx.roundRect(obs.x, GROUND_Y - obs.height, obs.width, obs.height, 4)
        ctx.fill()

        // Collision Check
        const dinoPadding = 10
        if (
          dinoPos.current.y + DINO_HEIGHT > GROUND_Y - obs.height &&
          dinoPos.current.y < GROUND_Y &&
          obs.x < (50 + DINO_WIDTH - dinoPadding) &&
          obs.x + obs.width > (50 + dinoPadding)
        ) {
          setGameState('GAMEOVER')
        }

        if (obs.x < -100) obstacles.current.splice(index, 1)
      })
    }

    // Draw Dino (Procedural)
    ctx.fillStyle = isDarkMode ? '#f43f5e' : '#e11d48'
    const dx = 50
    const dy = dinoPos.current.y
    
    // Body
    ctx.beginPath()
    ctx.roundRect(dx, dy, DINO_WIDTH, DINO_HEIGHT - 10, 8)
    ctx.fill()
    // Head/Snout
    ctx.fillRect(dx + 20, dy, DINO_WIDTH - 10, 20)
    // Eye
    ctx.fillStyle = isDarkMode ? 'white' : 'black'
    ctx.fillRect(dx + 45, dy + 5, 5, 5)
    // Feet (simple animation)
    ctx.fillStyle = isDarkMode ? '#f43f5e' : '#e11d48'
    const footOffset = (frameCount.current % 10 < 5) ? 0 : 5
    ctx.fillRect(dx + 10, dy + DINO_HEIGHT - 10, 10, 10)
    ctx.fillRect(dx + 25, dy + DINO_HEIGHT - 10, 10, 10)

    requestRef.current = requestAnimationFrame(draw)
  }, [gameState, isDarkMode])

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
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w') {
        jump()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [jump])

  const startGame = () => {
    setScore(0)
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
          <span className="text-[10px] uppercase font-bold text-slate-400">Distance</span>
          <span className="text-3xl font-black font-mono leading-none text-emerald-500">{score}m</span>
        </div>
        <div className="flex items-center gap-2">
            <Cloud className={`h-5 w-5 ${isDarkMode ? 'text-slate-600' : 'text-sky-400'}`} />
            <span className="text-[10px] uppercase font-bold text-slate-400">{isDarkMode ? 'Night' : 'Day'}</span>
        </div>
      </div>

      <div className="relative group overflow-hidden rounded-2xl border-4 border-slate-200 dark:border-slate-800 shadow-2xl w-full select-none touch-none">
        <canvas
          ref={canvasRef}
          width={CANV_WIDTH}
          height={CANV_HEIGHT}
          className="w-full h-auto bg-slate-950"
          onClick={jump}
        />
        
        {gameState !== 'PLAYING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-xl transition-all">
            {gameState === 'GAMEOVER' ? (
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-black text-rose-500 uppercase tracking-wider">Extinct!</h3>
                <p className="text-slate-300">Distance Traveled: {score}m</p>
                <button
                  onClick={startGame}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2 mx-auto"
                >
                  <RotateCcw className="h-4 w-4" /> Try Again
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <button
                  onClick={startGame}
                  className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black text-xl hover:scale-105 transition-transform shadow-xl shadow-white/10 flex items-center gap-2"
                >
                  <Play className="h-6 w-6 fill-current" /> START RUN
                </button>
                <p className="text-slate-400 text-xs uppercase tracking-widest leading-relaxed">
                  SPACE / UP / CLICK TO JUMP
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-slate-400 text-[10px] flex items-center gap-2">
        <span className="px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded uppercase">Space</span> to jump
        <span className="ml-4 text-slate-500 italic">Day/Night cycles every 1000m</span>
      </p>
    </div>
  )
}
