import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Grid3X3, FastForward, Layers, Rocket, Activity } from 'lucide-react'
import { TicTacToe } from '../components/games/TicTacToe'
import { Snake } from '../components/games/Snake'
import { BlockBreaker } from '../components/games/BlockBreaker'
import { Blastar } from '../components/games/Blastar'
import { DinoRun } from '../components/games/DinoRun'
import { Game2048 } from '../components/games/Game2048'
import { Sudoku } from '../components/games/Sudoku'

type GameType = 'tictactoe' | 'snake' | 'blockbreaker' | 'blastar' | 'dinorun' | '2048' | 'sudoku' | null

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
      id: '2048' as const,
      title: '2048',
      icon: <Layers className="h-6 w-6" />,
      description: 'Slide tiles and reach the 2048 block',
      color: 'from-amber-500 to-orange-500',
      component: <Game2048 />
    },
    {
      id: 'sudoku' as const,
      title: 'Sudoku',
      icon: <Grid3X3 className="h-6 w-6" />,
      description: 'Test your logic with classic puzzles',
      color: 'from-blue-600 to-indigo-600',
      component: <Sudoku />
    },
    {
      id: 'snake' as const,
      title: 'Retro Snake',
      icon: <Activity className="h-6 w-6" />,
      description: 'Classic arcade snake game',
      color: 'from-emerald-500 to-teal-500',
      component: <Snake />
    },
    {
      id: 'dinorun' as const,
      title: 'Dino Run',
      icon: <FastForward className="h-6 w-6" />,
      description: 'The classic infinite dinosaur runner',
      color: 'from-sky-500 to-indigo-500',
      component: <DinoRun />
    },
    {
      id: 'blockbreaker' as const,
      title: 'Block Breaker',
      icon: <Rocket className="h-6 w-6" />,
      description: 'Smash bricks and set high scores',
      color: 'from-purple-500 to-indigo-500',
      component: <BlockBreaker />
    },
    {
      id: 'tictactoe' as const,
      title: 'Tic Tac Toe',
      icon: <Grid3X3 className="h-6 w-6" />,
      description: 'Classic 3x3 strategy game',
      color: 'from-blue-400 to-sky-400',
      component: <TicTacToe />
    },
    {
      id: 'blastar' as const,
      title: 'Blastar',
      icon: <Rocket className="h-6 w-6" />,
      description: 'Elon Musk\'s classic space shooter',
      color: 'from-rose-500 to-orange-500',
      component: <Blastar />
    }
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12">
      <header className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 text-white sm:p-12">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-bold tracking-widest uppercase">
              EasyMyTools Arcade
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
              Level Up Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Break Time</span>
            </h1>
            <p className="text-slate-400 text-lg">
              Classic games reimagined for your browser. Pure fun, no downloads, and absolutely zero distractions.
            </p>
          </div>
          <div className="hidden lg:block relative h-48 w-48">
             <div className="absolute inset-0 bg-purple-600/20 blur-3xl rounded-full animate-pulse" />
             <img 
               src="/arcade_mascot.png" 
               alt="Arcade Mascot" 
               className="h-full w-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]"
             />
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
      </header>

      <AnimatePresence mode="wait">
        {!selectedGame ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {games.map((game, index) => (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedGame(game.id)}
                className="group relative flex flex-col items-start overflow-hidden rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-left transition-all hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-2xl hover:-translate-y-1"
              >
                <div className={`mb-6 inline-flex rounded-2xl bg-gradient-to-br ${game.color} p-4 text-white shadow-xl shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300`}>
                  {game.icon}
                </div>
                <h3 className="mb-2 text-2xl font-black text-slate-900 dark:text-slate-100">{game.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed flex-1">{game.description}</p>
                
                <div className="w-full flex items-center justify-between mt-auto pt-4 border-t border-slate-50 dark:border-slate-800/50">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Play Game</span>
                  <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <span className="text-xl font-bold">→</span>
                  </div>
                </div>
                
                {/* Hover decoration */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-[0.03] transition-opacity rounded-full -mr-16 -mt-16`} />
              </motion.button>
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
