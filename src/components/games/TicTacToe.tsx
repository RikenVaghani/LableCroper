import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, User, Users, Cpu, ShieldAlert, Zap, Brain } from 'lucide-react'

type Player = 'X' | 'O' | null
type GameMode = 'PVP' | 'PVC'
type Difficulty = 'Normal' | 'Medium' | 'Hard'

export function TicTacToe() {
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null))
  const [isXNext, setIsXNext] = useState(true)
  const [winner, setWinner] = useState<Player | 'Draw'>(null)
  const [winningLine, setWinningLine] = useState<number[] | null>(null)
  const [gameMode, setGameMode] = useState<GameMode>('PVC')
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')
  const [isAiThinking, setIsAiThinking] = useState(false)

  const checkWinner = useCallback((squares: Player[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ]

    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: [a, b, c] }
      }
    }

    if (squares.every(s => s !== null)) return { winner: 'Draw' as const, line: null }
    return null
  }, [])

  const minimax = useCallback((squares: Player[], depth: number, isMaximizing: boolean): number => {
    const result = checkWinner(squares)
    if (result) {
      if (result.winner === 'O') return 10 - depth
      if (result.winner === 'X') return depth - 10
      return 0
    }

    if (isMaximizing) {
      let bestScore = -Infinity
      for (let i = 0; i < 9; i++) {
        if (!squares[i]) {
          squares[i] = 'O'
          const score = minimax(squares, depth + 1, false)
          squares[i] = null
          bestScore = Math.max(score, bestScore)
        }
      }
      return bestScore
    } else {
      let bestScore = Infinity
      for (let i = 0; i < 9; i++) {
        if (!squares[i]) {
          squares[i] = 'X'
          const score = minimax(squares, depth + 1, true)
          squares[i] = null
          bestScore = Math.min(score, bestScore)
        }
      }
      return bestScore
    }
  }, [checkWinner])

  const getBestMove = useCallback((squares: Player[], diff: Difficulty) => {
    const emptySquares = squares.map((s, i) => s === null ? i : null).filter(s => s !== null) as number[]
    
    // Normal: Purely Random
    if (diff === 'Normal') {
      return emptySquares[Math.floor(Math.random() * emptySquares.length)]
    }

    // Medium: Win or Block, then Random
    if (diff === 'Medium') {
      // 1. Try to win
      for (const i of emptySquares) {
        const tempBoard = [...squares]
        tempBoard[i] = 'O'
        if (checkWinner(tempBoard)?.winner === 'O') return i
      }
      // 2. Try to block player
      for (const i of emptySquares) {
        const tempBoard = [...squares]
        tempBoard[i] = 'X'
        if (checkWinner(tempBoard)?.winner === 'X') return i
      }
      // 3. Random
      return emptySquares[Math.floor(Math.random() * emptySquares.length)]
    }

    // Hard: Minimax
    let bestScore = -Infinity
    let move = -1
    for (const i of emptySquares) {
      squares[i] = 'O'
      const score = minimax(squares, 0, false)
      squares[i] = null
      if (score > bestScore) {
        bestScore = score
        move = i
      }
    }
    return move
  }, [checkWinner, minimax])

  const handleCellClick = useCallback((i: number) => {
    if (winner || board[i] || (gameMode === 'PVC' && !isXNext)) return

    const newBoard = [...board]
    newBoard[i] = isXNext ? 'X' : 'O'
    setBoard(newBoard)
    
    const result = checkWinner(newBoard)
    if (result) {
      setWinner(result.winner)
      setWinningLine(result.line)
    } else {
      setIsXNext(!isXNext)
    }
  }, [board, isXNext, winner, gameMode, checkWinner])

  useEffect(() => {
    if (gameMode === 'PVC' && !isXNext && !winner) {
      setIsAiThinking(true)
      const timer = setTimeout(() => {
        const move = getBestMove([...board], difficulty)
        if (move !== -1) {
          const newBoard = [...board]
          newBoard[move] = 'O'
          setBoard(newBoard)
          const result = checkWinner(newBoard)
          if (result) {
            setWinner(result.winner)
            setWinningLine(result.line)
          } else {
            setIsXNext(true)
          }
        }
        setIsAiThinking(false)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [isXNext, gameMode, board, winner, difficulty, checkWinner, getBestMove])

  const resetGame = () => {
    setBoard(Array(9).fill(null))
    setIsXNext(true)
    setWinner(null)
    setWinningLine(null)
    setIsAiThinking(false)
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xl mx-auto scroll-mt-24">
      {/* Game Mode Selection */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full">
        <button
          onClick={() => { setGameMode('PVC'); resetGame(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${gameMode === 'PVC' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-sm' : 'text-slate-500'}`}
        >
          <Cpu className="h-4 w-4" /> Vs p
        </button>
        <button
          onClick={() => { setGameMode('PVP'); resetGame(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all ${gameMode === 'PVP' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
        >
          <Users className="h-4 w-4" /> 2 Players
        </button>
      </div>

      {/* Difficulty Selection (only for PVC) */}
      <AnimatePresence>
        {gameMode === 'PVC' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full space-y-3"
          >
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Difficulty</span>
              <span className={`text-xs font-black uppercase ${difficulty === 'Hard' ? 'text-rose-500' : difficulty === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                {difficulty}
              </span>
            </div>
            <div className="flex gap-2">
              {[
                { id: 'Normal', icon: <ShieldAlert className="h-4 w-4" />, color: 'hover:border-emerald-500 active:bg-emerald-50' },
                { id: 'Medium', icon: <Zap className="h-4 w-4" />, color: 'hover:border-amber-500 active:bg-amber-50' },
                { id: 'Hard', icon: <Brain className="h-4 w-4" />, color: 'hover:border-rose-500 active:bg-rose-50' }
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => { setDifficulty(lvl.id as Difficulty); resetGame(); }}
                  className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${difficulty === lvl.id ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 text-slate-400 ' + lvl.color}`}
                >
                  {lvl.icon}
                  <span className="text-[10px] font-bold">{lvl.id}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Players Info */}
      <div className="flex justify-between w-full items-center px-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${isXNext && !winner ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
            <User className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Player X</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">You</span>
          </div>
        </div>
        
        <div className="h-8 w-8 flex items-center justify-center">
            {isAiThinking ? (
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"
                />
            ) : (
                <div className="text-xl font-black text-slate-200 dark:text-slate-800">VS</div>
            )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Player O</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{gameMode === 'PVC' ? 'CPU' : 'Friend'}</span>
          </div>
          <div className={`p-2 rounded-lg transition-colors ${!isXNext && !winner ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
            {gameMode === 'PVC' ? <Cpu className="h-5 w-5" /> : <Users className="h-5 w-5" />}
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-3 w-full aspect-square">
        {board.map((square, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: square || winner || isAiThinking ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleCellClick(i)}
            disabled={!!square || !!winner || isAiThinking}
            className={`
              relative flex items-center justify-center text-5xl font-black rounded-2xl
              bg-slate-50 dark:bg-slate-800/40 border-2 transition-all duration-300
              ${winningLine?.includes(i) 
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' 
                : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-800'}
              ${square === 'X' && !winningLine?.includes(i) ? 'text-blue-600' : ''}
              ${square === 'O' && !winningLine?.includes(i) ? 'text-rose-600' : ''}
              h-full w-full aspect-square
            `}
          >
            {square && (
              <motion.span
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className="select-none"
              >
                {square}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 w-full">
        <AnimatePresence>
          {winner && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <h2 className={`text-3xl font-black ${winner === 'Draw' ? 'text-slate-500' : winner === 'X' ? 'text-blue-600' : 'text-rose-600'}`}>
                {winner === 'Draw' ? "It's a Draw!" : winner === 'X' ? 'You Win!' : gameMode === 'PVC' ? 'CPU Wins!' : 'Player O Wins!'}
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={resetGame}
          className="flex items-center gap-2 px-8 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none"
        >
          <RotateCcw className="h-5 w-5" />
          {winner ? 'REPLAY' : 'RESET'}
        </button>
      </div>
    </div>
  )
}
