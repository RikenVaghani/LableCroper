import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, ArrowLeft, Grid3X3, FastForward, Layers, Rocket, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { TicTacToe } from '../components/games/TicTacToe'
import { Snake } from '../components/games/Snake'
import { BlockBreaker } from '../components/games/BlockBreaker'
import { Blastar } from '../components/games/Blastar'
import { DinoRun } from '../components/games/DinoRun'

type GameType = 'tictactoe' | 'snake' | 'blockbreaker' | 'blastar' | 'dinorun' | null

export function Games() {
  const [selectedGame, setSelectedGame] = useState<GameType>(null)
  const gameViewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedGame && gameViewRef.current) {
      gameViewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedGame])

  const games = [
    {
      id: 'tictactoe' as const,
      title: 'Tic Tac Toe',
      icon: <Grid3X3 className="h-6 w-6" />,
      description: 'Classic 3x3 strategy game',
      color: 'from-blue-500 to-cyan-500',
      component: <TicTacToe />
    },
    {
      id: 'snake' as const,
      title: 'Retro Snake',
      icon: <FastForward className="h-6 w-6" />,
      description: 'Classic arcade snake game',
      color: 'from-emerald-500 to-teal-500',
      component: <Snake />
    },
    {
      id: 'blockbreaker' as const,
      title: 'Block Breaker',
      icon: <Layers className="h-6 w-6" />,
      description: 'Smash bricks and set high scores',
      color: 'from-purple-500 to-indigo-500',
      component: <BlockBreaker />
    },
    {
      id: 'blastar' as const,
      title: 'Blastar',
      icon: <Rocket className="h-6 w-6" />,
      description: 'Elon Musk\'s classic space shooter',
      color: 'from-rose-500 to-orange-500',
      component: <Blastar />
    },
    {
      id: 'dinorun' as const,
      title: 'Dino Run',
      icon: <Activity className="h-6 w-6" />,
      description: 'The classic infinite dinosaur runner',
      color: 'from-sky-500 to-indigo-500',
      component: <DinoRun />
    }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <Gamepad2 className="h-8 w-8 text-purple-600" />
              Mini Games
            </h1>
            <p className="text-slate-600 dark:text-slate-400">Pure browser fun, no installation needed</p>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!selectedGame ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid gap-6 sm:grid-cols-2"
          >
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-left transition-all hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-xl dark:hover:shadow-purple-900/10"
              >
                <div className={`mb-6 inline-flex rounded-2xl bg-gradient-to-br ${game.color} p-4 text-white shadow-lg shadow-purple-200 dark:shadow-none`}>
                  {game.icon}
                </div>
                <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{game.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">{game.description}</p>
                <div className="text-purple-600 font-bold flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                  Play Now <span className="text-xl">→</span>
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            ref={gameViewRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <button 
                onClick={() => setSelectedGame(null)}
                className="text-sm font-semibold text-slate-500 hover:text-purple-600 flex items-center gap-2 transition-colors underline decoration-slate-200 hover:decoration-purple-600"
              >
                <ArrowLeft className="h-4 w-4" /> Back to menu
              </button>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-bold">
                {games.find(g => g.id === selectedGame)?.icon}
                {games.find(g => g.id === selectedGame)?.title}
              </div>
            </div>
            
            <div className="flex justify-center">
              {games.find(g => g.id === selectedGame)?.component}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="rounded-3xl bg-slate-900 dark:bg-slate-800 p-8 text-white text-center">
        <h3 className="text-xl font-bold mb-2">Did You Know?</h3>
        <p className="text-slate-400 dark:text-slate-500 max-w-lg mx-auto">
          These games are built using pure React and Canvas. They run entirely in your browser memory, saving no data to any server.
        </p>
      </section>
    </div>
  )
}
