import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hammer from 'hammerjs';

interface Tile {
  id: number;
  value: number;
  x: number;
  y: number;
  mergedFrom?: Tile[];
}

export function Game2048() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    return parseInt(localStorage.getItem('2048-best-score') || '0');
  });
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
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

  const initGame = useCallback(() => {
    setTiles([]);
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    
    // Add two initial tiles
    const firstTile = createTile(getRandomEmptyPos([]));
    const secondTile = createTile(getRandomEmptyPos([firstTile]));
    setTiles([firstTile, secondTile]);
  }, []);

  const createTile = (pos: { x: number, y: number }): Tile => ({
    id: nextId.current++,
    value: Math.random() < 0.9 ? 2 : 4,
    x: pos.x,
    y: pos.y,
  });

  const getRandomEmptyPos = (currentTiles: Tile[]) => {
    const emptyPos = [];
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        if (!currentTiles.some(t => t.x === x && t.y === y)) {
          emptyPos.push({ x, y });
        }
      }
    }
    return emptyPos[Math.floor(Math.random() * emptyPos.length)];
  };

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver || gameWon) return;

    setTiles(prevTiles => {
      let hasChanged = false;
      const newTiles: Tile[] = [];
      // const scoreIncrement = 0;
      let currentScore = score;

      const isVertical = direction === 'up' || direction === 'down';
      const isForward = direction === 'right' || direction === 'down';

      for (let i = 0; i < 4; i++) {
        const line = prevTiles.filter(t => (isVertical ? t.x === i : t.y === i))
          .sort((a, b) => isForward ? (isVertical ? b.y - a.y : b.x - a.x) : (isVertical ? a.y - b.y : a.x - b.x));

        let nextLine: Tile[] = [];
        for (let j = 0; j < line.length; j++) {
          const tile = { ...line[j] };
          if (j < line.length - 1 && line[j].value === line[j+1].value) {
            // Merge
            tile.value *= 2;
            tile.mergedFrom = [line[j], line[j+1]];
            currentScore += tile.value;
            j++; // skip next
            hasChanged = true;
          }
          
          const newPos = isForward ? 3 - nextLine.length : nextLine.length;
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
        const nextTile = createTile(getRandomEmptyPos(newTiles));
        const finalTiles = [...newTiles, nextTile];
        
        setScore(currentScore);
        if (currentScore > bestScore) {
          setBestScore(currentScore);
          localStorage.setItem('2048-best-score', currentScore.toString());
        }

        // Check game over
        if (finalTiles.length === 16) {
          // Check if any moves possible
          // (simplified check for now)
        }
        
        if (finalTiles.some(t => t.value === 2048)) {
          setGameWon(true);
        }

        return finalTiles;
      }
      return prevTiles;
    });
  }, [gameOver, gameWon, score, bestScore]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Join the numbers to get to the <strong>2048</strong> tile!
        </p>
        <button 
          onClick={initGame}
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
        <div className="grid grid-cols-4 grid-rows-4 gap-3 w-full h-full">
          {Array.from({ length: 16 }).map((_, i) => (
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
                  x: `${tile.x * 100}%`,
                  y: `${tile.y * 100}%`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 1
                }}
                className="absolute w-1/4 h-1/4 p-1.5"
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
                onClick={initGame}
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
    </div>
  );
}
