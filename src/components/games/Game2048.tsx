import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hammer from 'hammerjs';

interface Tile {
  id: number;
  value: number;
  x: number;
  y: number;
}

export function Game2048() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    return parseInt(localStorage.getItem('2048-best-score') || '0');
  });
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gridSize, setGridSize] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  const colors: { [key: number]: string } = {
    2: 'bg-[#00d0a4]',
    4: 'bg-[#dd7373]',
    8: 'bg-[#7d53de]',
    16: 'bg-[#6622cc]',
    32: 'bg-[#00bfb2]',
    64: 'bg-[#c06ff2]',
    128: 'bg-[#340068]',
    256: 'bg-[#3e92cc]',
    512: 'bg-[#d8315b]',
    1024: 'bg-[#1c0b19]',
    2048: 'bg-[#1c0b19]',
  };

  const createTile = useCallback((pos: { x: number, y: number }): Tile => ({
    id: nextId.current++,
    value: Math.random() < 0.9 ? 2 : 4,
    x: pos.x,
    y: pos.y,
  }), []);

  const getRandomEmptyPos = useCallback((currentTiles: Tile[], size: number = gridSize) => {
    const emptyPos: { x: number; y: number }[] = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (!currentTiles.some(t => t.x === x && t.y === y)) {
          emptyPos.push({ x, y });
        }
      }
    }
    if (emptyPos.length === 0) return null;
    return emptyPos[Math.floor(Math.random() * emptyPos.length)];
  }, [gridSize]);

  const canMove = (currentTiles: Tile[], size: number) => {
    if (currentTiles.length < size * size) return true;
    for (const tile of currentTiles) {
      const right = currentTiles.find(t => t.x === tile.x + 1 && t.y === tile.y);
      const down = currentTiles.find(t => t.x === tile.x && t.y === tile.y + 1);
      if ((right && right.value === tile.value) || (down && down.value === tile.value)) {
        return true;
      }
    }
    return false;
  };

  const initGame = useCallback((size: number = gridSize) => {
    setTiles([]);
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    
    // Add two initial tiles
    const firstPos = getRandomEmptyPos([], size);
    if (!firstPos) {
      setTiles([]);
      return;
    }
    const firstTile = createTile(firstPos);
    const secondPos = getRandomEmptyPos([firstTile], size);
    if (!secondPos) {
      setTiles([firstTile]);
      return;
    }
    const secondTile = createTile(secondPos);
    setTiles([firstTile, secondTile]);
  }, [gridSize, createTile, getRandomEmptyPos]);

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver || gameWon) return;

    setTiles(prevTiles => {
      let hasChanged = false;
      const newTiles: Tile[] = [];
      let scoreIncrement = 0;

      const isVertical = direction === 'up' || direction === 'down';
      const isForward = direction === 'right' || direction === 'down';

      for (let i = 0; i < gridSize; i++) {
        const line = prevTiles.filter(t => (isVertical ? t.x === i : t.y === i))
          .sort((a, b) => isForward ? (isVertical ? b.y - a.y : b.x - a.x) : (isVertical ? a.y - b.y : a.x - b.x));

        const nextLine: Tile[] = [];
        for (let j = 0; j < line.length; j++) {
          const tile = { ...line[j] };
          if (j < line.length - 1 && line[j].value === line[j+1].value) {
            // Merge
            tile.value *= 2;
            scoreIncrement += tile.value;
            j++; // skip next
            hasChanged = true;
          }
          
          const newPos = isForward ? gridSize - 1 - nextLine.length : nextLine.length;
          if (isVertical) {
            if (tile.y !== newPos) hasChanged = true;
            tile.y = newPos;
          } else {
            if (tile.x !== newPos) hasChanged = true;
            tile.x = newPos;
          }
          nextLine.push(tile);
        }
        newTiles.push(...nextLine);
      }

      if (hasChanged) {
        const nextPos = getRandomEmptyPos(newTiles, gridSize);
        const finalTiles = nextPos ? [...newTiles, createTile(nextPos)] : [...newTiles];

        setScore(prev => {
          const nextScore = prev + scoreIncrement;
          if (nextScore > bestScore) {
            setBestScore(nextScore);
            localStorage.setItem('2048-best-score', nextScore.toString());
          }
          return nextScore;
        });

        if (finalTiles.some(t => t.value === 2048)) {
          setGameWon(true);
        }
        setGameOver(!canMove(finalTiles, gridSize));

        return finalTiles;
      }
      return prevTiles;
    });
  }, [gameOver, gameWon, bestScore, gridSize, createTile, getRandomEmptyPos]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp': move('up'); break;
        case 'ArrowDown': move('down'); break;
        case 'ArrowLeft': move('left'); break;
        case 'ArrowRight': move('right'); break;
        case 'w': case 'W': move('up'); break;
        case 's': case 'S': move('down'); break;
        case 'a': case 'A': move('left'); break;
        case 'd': case 'D': move('right'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  useEffect(() => {
    if (containerRef.current) {
      const mc = new Hammer(containerRef.current);
      mc.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
      mc.on('swipeup', () => move('up'));
      mc.on('swipedown', () => move('down'));
      mc.on('swipeleft', () => move('left'));
      mc.on('swiperight', () => move('right'));
      return () => mc.destroy();
    }
  }, [move]);

  const GAP_PX = 12;
  const cellSize = `calc((100% - ${(gridSize - 1) * GAP_PX}px) / ${gridSize})`;

  return (
    <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto">
      <div className="flex justify-between items-center w-full">
        <div className="text-3xl font-black text-slate-800 dark:text-white">2048</div>
        <div className="flex gap-2">
          <div className="bg-slate-200 dark:bg-slate-800 p-2 rounded-xl text-center min-w-[80px]">
            <div className="text-[10px] uppercase font-bold text-slate-500">Score</div>
            <div className="text-xl font-black text-slate-800 dark:text-white">{score}</div>
          </div>
          <div className="bg-slate-200 dark:bg-slate-800 p-2 rounded-xl text-center min-w-[80px]">
            <div className="text-[10px] uppercase font-bold text-slate-500">Best</div>
            <div className="text-xl font-black text-slate-800 dark:text-white">{bestScore}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between w-full items-center">
        <div className="flex gap-2">
          {[4, 5, 6].map(size => (
            <button
              key={size}
              onClick={() => { setGridSize(size); initGame(size); }}
              className={`px-3 py-1 text-sm rounded-lg font-bold transition-colors ${
                gridSize === size 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {size}x{size}
            </button>
          ))}
        </div>
        <button 
          onClick={() => initGame(gridSize)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold transition-colors"
        >
          New Game
        </button>
      </div>

      <div 
        ref={containerRef}
        className="relative aspect-square w-full bg-slate-200 dark:bg-slate-800 rounded-2xl p-3 shadow-inner touch-none overflow-hidden"
      >
        {/* Grid Background */}
        <div 
          className="grid gap-3 w-full h-full"
          style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, i) => (
            <div key={i} className="bg-slate-300/50 dark:bg-slate-700/50 rounded-xl w-full h-full" />
          ))}
        </div>

        {/* Tiles */}
        <div className="absolute inset-0 p-3">
          <AnimatePresence>
            {tiles.map(tile => (
              <motion.div
                key={tile.id}
                layoutId={`tile-${tile.id}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: `calc(${tile.x} * (100% + ${GAP_PX}px))`,
                  y: `calc(${tile.y} * (100% + ${GAP_PX}px))`
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 1
                }}
                className="absolute p-1.5"
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: 0,
                  top: 0
                }}
              >
                <div className={`w-full h-full rounded-xl flex items-center justify-center text-2xl font-black text-white shadow-lg ${colors[tile.value] || 'bg-slate-900'}`}>
                  {tile.value}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Overlays */}
        <AnimatePresence>
          {(gameOver || gameWon) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6"
            >
              <h2 className="text-4xl font-black mb-4 text-slate-900 dark:text-white">
                {gameWon ? '🎉 You Won!' : 'Game Over!'}
              </h2>
              <button 
                onClick={() => initGame(gridSize)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-2xl font-bold text-lg shadow-xl shadow-purple-500/30 transition-all active:scale-95"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full text-slate-400 text-xs text-center">
        Use Arrow keys, WASD, or Swipe to move the tiles.
      </div>

      <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Difficulty Guide</h3>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2 font-semibold text-slate-500 dark:text-slate-400">
            <span>Grid Size</span>
            <span>Difficulty</span>
            <span>Notes</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-slate-700 dark:text-slate-300">
            <span className="font-semibold">4x4</span>
            <span>Standard</span>
            <span>Classic 2048 rules.</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-slate-700 dark:text-slate-300">
            <span className="font-semibold">5x5</span>
            <span>Easier</span>
            <span>More space for longer survival and higher scores.</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-slate-700 dark:text-slate-300">
            <span className="font-semibold">6x6</span>
            <span>Much Easier</span>
            <span>Most forgiving board, often reaching very high tiles.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
