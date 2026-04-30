import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, CheckCircle2, Eraser, AlertCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

type Grid = (number | null)[][]
type Level = 'EASY' | 'MEDIUM' | 'HARD'

const generateSudoku = (level: Level): { puzzle: Grid; solution: Grid } => {
  // Simple generator for demonstration. In a real app, use a more robust library or pre-generated puzzles.
  const solution: Grid = Array(9).fill(null).map(() => Array(9).fill(null))
  
  const isValid = (grid: Grid, r: number, c: number, val: number) => {
    for (let i = 0; i < 9; i++) {
      if (grid[r][i] === val || grid[i][c] === val) return false
    }
    const startR = Math.floor(r / 3) * 3
    const startC = Math.floor(c / 3) * 3
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (grid[startR + i][startC + j] === val) return false
      }
    }
    return true
  }

  const solve = (grid: Grid): boolean => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === null) {
          const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5)
          for (const num of nums) {
            if (isValid(grid, r, c, num)) {
              grid[r][c] = num
              if (solve(grid)) return true
              grid[r][c] = null
            }
          }
          return false
        }
      }
    }
    return true
  }

  solve(solution)

  const puzzle: Grid = solution.map(row => [...row])
  const attempts = { EASY: 30, MEDIUM: 45, HARD: 55 }[level]
  let removed = 0
  while (removed < attempts) {
    const r = Math.floor(Math.random() * 9)
    const c = Math.floor(Math.random() * 9)
    if (puzzle[r][c] !== null) {
      puzzle[r][c] = null
      removed++
    }
  }

  return { puzzle, solution }
}

export function Sudoku() {
  const [level, setLevel] = useState<Level>('EASY')
  const [grid, setGrid] = useState<Grid>(Array(9).fill(null).map(() => Array(9).fill(null)))
  const [initialGrid, setInitialGrid] = useState<Grid>(Array(9).fill(null).map(() => Array(9).fill(null)))
  const [solution, setSolution] = useState<Grid>(Array(9).fill(null).map(() => Array(9).fill(null)))
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [errors, setErrors] = useState<boolean[][]>(Array(9).fill(null).map(() => Array(9).fill(false)))
  const [isWon, setIsWon] = useState(false)

  const initGame = useCallback((newLevel?: Level) => {
    const l = newLevel || level
    const { puzzle, solution: sol } = generateSudoku(l)
    setGrid(puzzle.map(row => [...row]))
    setInitialGrid(puzzle.map(row => [...row]))
    setSolution(sol)
    setSelected(null)
    setErrors(Array(9).fill(null).map(() => Array(9).fill(false)))
    setIsWon(false)
  }, [level])

  useEffect(() => {
    initGame()
  }, [initGame])

  const handleCellClick = (r: number, c: number) => {
    if (initialGrid[r][c] !== null) {
      // Show same numbers highlight
      setSelected([r, c])
      return
    }
    setSelected([r, c])
  }

  const handleNumberInput = (num: number | null) => {
    if (!selected || isWon) return
    const [r, c] = selected
    if (initialGrid[r][c] !== null) return

    const nextGrid = grid.map(row => [...row])
    nextGrid[r][c] = num
    setGrid(nextGrid)

    // Check error
    const nextErrors = errors.map(row => [...row])
    if (num !== null && num !== solution[r][c]) {
      nextErrors[r][c] = true
    } else {
      nextErrors[r][c] = false
    }
    setErrors(nextErrors)

    // Check win
    if (num !== null && num === solution[r][c]) {
      const flatGrid = nextGrid.flat()
      const flatSol = solution.flat()
      if (flatGrid.every((v, i) => v === flatSol[i])) {
        setIsWon(true)
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') handleNumberInput(parseInt(e.key))
      if (e.key === 'Backspace' || e.key === 'Delete') handleNumberInput(null)
      if (e.key === 'ArrowUp' && selected) setSelected([Math.max(0, selected[0] - 1), selected[1]])
      if (e.key === 'ArrowDown' && selected) setSelected([Math.min(8, selected[0] + 1), selected[1]])
      if (e.key === 'ArrowLeft' && selected) setSelected([selected[0], Math.max(0, selected[1] - 1)])
      if (e.key === 'ArrowRight' && selected) setSelected([selected[0], Math.min(8, selected[1] + 1)])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, grid, solution, isWon])

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      <div className="flex justify-between w-full items-center">
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {(['EASY', 'MEDIUM', 'HARD'] as Level[]).map(l => (
            <button
              key={l}
              onClick={() => { setLevel(l); initGame(l); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                level === l 
                  ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => initGame()}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-sky-600 transition-colors"
          title="New Game"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="relative aspect-square w-full grid grid-cols-9 border-2 border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 gap-[1px] overflow-hidden rounded-lg shadow-xl">
        {grid.map((row, r) => row.map((val, c) => {
          const isSelected = selected?.[0] === r && selected?.[1] === c
          const isInitial = initialGrid[r][c] !== null
          const isError = errors[r][c]
          const isHighlighted = selected && (selected[0] === r || selected[1] === c || (Math.floor(selected[0]/3) === Math.floor(r/3) && Math.floor(selected[1]/3) === Math.floor(c/3)))
          const isSameNum = selected && grid[selected[0]][selected[1]] !== null && grid[selected[0]][selected[1]] === val

          return (
            <div
              key={`${r}-${c}`}
              onClick={() => handleCellClick(r, c)}
              className={cn(
                "flex items-center justify-center text-lg sm:text-xl font-bold cursor-pointer transition-all",
                "bg-white dark:bg-slate-900",
                isHighlighted && "bg-slate-50 dark:bg-slate-800/50",
                isSameNum && "bg-sky-100 dark:bg-sky-900/40",
                isSelected && "bg-sky-200 dark:bg-sky-800 !text-sky-700 dark:!text-sky-200 ring-2 ring-inset ring-sky-500",
                isError && "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
                isInitial ? "text-slate-900 dark:text-slate-100" : "text-sky-600 dark:text-sky-400 font-medium",
                // Grid borders
                (r + 1) % 3 === 0 && r < 8 && "border-b-2 border-slate-900 dark:border-slate-100",
                (c + 1) % 3 === 0 && c < 8 && "border-r-2 border-slate-900 dark:border-slate-100"
              )}
            >
              {val}
            </div>
          )
        }))}

        <AnimatePresence>
          {isWon && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mb-4">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Excellent!</h3>
                <p className="text-slate-500 mb-6">Puzzle completed successfully.</p>
                <button
                  onClick={() => initGame()}
                  className="bg-sky-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-sky-700 transition shadow-lg shadow-sky-200 dark:shadow-none"
                >
                  New Game
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleNumberInput(num)}
            className="aspect-square flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-black text-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 hover:text-sky-600 transition-all border border-transparent active:scale-95 shadow-sm"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleNumberInput(null)}
          className="aspect-square flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-all shadow-sm"
          title="Erase"
        >
          <Eraser className="h-6 w-6" />
        </button>
      </div>

      <div className="flex gap-4 w-full">
        <div className="flex-1 flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Click a cell then use the number pad or keyboard to fill it.</p>
        </div>
      </div>
    </div>
  )
}
