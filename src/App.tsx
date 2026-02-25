/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Zap, Play, RotateCcw, Home, Heart } from 'lucide-react';

// --- Constants ---
const GAME_WIDTH = 375;
const GAME_HEIGHT = 667;
const PLAYER_SIZE = 40;
const ENEMY_SIZE = 35;
const BULLET_SIZE = 8;
const PLAYER_SPEED = 5;
const ENEMY_SPEED = 1.5;
const BULLET_SPEED = 7;
const ENEMY_SPAWN_RATE = 2000; // ms
const ENEMY_SHOOT_RATE = 3000; // ms
const WIN_SCORE = 10;

type GameState = 'MENU' | 'PLAYING' | 'WON' | 'LOST';

interface Entity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Bullet extends Entity {
  owner: 'player' | 'enemy';
}

interface Enemy extends Entity {
  lastShot: number;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(3);
  const [playerPos, setPlayerPos] = useState({ x: GAME_WIDTH / 2 - PLAYER_SIZE / 2, y: GAME_HEIGHT - 100 });
  
  const gameLoopRef = useRef<number>(0);
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const lastEnemySpawnRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);

  // --- Game Logic ---

  const spawnEnemy = useCallback((time: number) => {
    if (time - lastEnemySpawnRef.current > ENEMY_SPAWN_RATE) {
      const newEnemy: Enemy = {
        id: nextIdRef.current++,
        x: Math.random() * (GAME_WIDTH - ENEMY_SIZE),
        y: -ENEMY_SIZE,
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
        lastShot: time,
      };
      enemiesRef.current.push(newEnemy);
      lastEnemySpawnRef.current = time;
    }
  }, []);

  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    spawnEnemy(time);

    // Update Bullets
    bulletsRef.current = bulletsRef.current
      .map(b => ({ ...b, y: b.owner === 'player' ? b.y - BULLET_SPEED : b.y + BULLET_SPEED }))
      .filter(b => b.y > -20 && b.y < GAME_HEIGHT + 20);

    // Update Enemies
    enemiesRef.current = enemiesRef.current.map(e => {
      // Enemy shooting logic
      if (time - e.lastShot > ENEMY_SHOOT_RATE) {
        bulletsRef.current.push({
          id: nextIdRef.current++,
          x: e.x + ENEMY_SIZE / 2 - BULLET_SIZE / 2,
          y: e.y + ENEMY_SIZE,
          width: BULLET_SIZE,
          height: BULLET_SIZE,
          owner: 'enemy'
        });
        return { ...e, y: e.y + ENEMY_SPEED, lastShot: time };
      }
      return { ...e, y: e.y + ENEMY_SPEED };
    }).filter(e => e.y < GAME_HEIGHT);

    // Collision Detection
    const playerRect = { x: playerPos.x, y: playerPos.y, width: PLAYER_SIZE, height: PLAYER_SIZE };

    // Player bullets hitting enemies
    bulletsRef.current.forEach((bullet, bIdx) => {
      if (bullet.owner === 'player') {
        enemiesRef.current.forEach((enemy, eIdx) => {
          if (
            bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y
          ) {
            // Hit!
            bulletsRef.current.splice(bIdx, 1);
            enemiesRef.current.splice(eIdx, 1);
            setScore(s => {
              const newScore = s + 1;
              if (newScore >= WIN_SCORE) setGameState('WON');
              return newScore;
            });
          }
        });
      } else {
        // Enemy bullets hitting player
        if (
          bullet.x < playerRect.x + playerRect.width &&
          bullet.x + bullet.width > playerRect.x &&
          bullet.y < playerRect.y + playerRect.height &&
          bullet.y + bullet.height > playerRect.y
        ) {
          bulletsRef.current.splice(bIdx, 1);
          setHealth(h => {
            const newHealth = h - 1;
            if (newHealth <= 0) setGameState('LOST');
            return newHealth;
          });
        }
      }
    });

    // Enemy body hitting player
    enemiesRef.current.forEach((enemy, eIdx) => {
      if (
        enemy.x < playerRect.x + playerRect.width &&
        enemy.x + enemy.width > playerRect.x &&
        enemy.y < playerRect.y + playerRect.height &&
        enemy.y + enemy.height > playerRect.y
      ) {
        enemiesRef.current.splice(eIdx, 1);
        setHealth(h => {
          const newHealth = h - 1;
          if (newHealth <= 0) setGameState('LOST');
          return newHealth;
        });
      }
    });

    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameState, playerPos, spawnEnemy]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameLoopRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(gameLoopRef.current);
    }
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState, update]);

  // --- Controls ---

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== 'PLAYING' || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    // Calculate relative X
    let newX = clientX - rect.left - PLAYER_SIZE / 2;
    
    // Boundary check
    newX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, newX));
    
    setPlayerPos(prev => ({ ...prev, x: newX }));
  };

  const handleShoot = () => {
    if (gameState !== 'PLAYING') return;
    
    bulletsRef.current.push({
      id: nextIdRef.current++,
      x: playerPos.x + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
      y: playerPos.y - BULLET_SIZE,
      width: BULLET_SIZE,
      height: BULLET_SIZE,
      owner: 'player'
    });
  };

  const startGame = () => {
    setScore(0);
    setHealth(3);
    setPlayerPos({ x: GAME_WIDTH / 2 - PLAYER_SIZE / 2, y: GAME_HEIGHT - 100 });
    enemiesRef.current = [];
    bulletsRef.current = [];
    setGameState('PLAYING');
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans text-white overflow-hidden">
      {/* Game Container */}
      <div 
        ref={containerRef}
        className="relative bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden rounded-2xl"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        onMouseMove={handleTouchMove}
        onTouchMove={handleTouchMove}
        onClick={handleShoot}
      >
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="h-full w-full" style={{ 
            backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
          }} />
        </div>

        <AnimatePresence mode="wait">
          {gameState === 'MENU' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-8 text-center"
            >
              <div className="mb-8 relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-4 border border-blue-500/30 rounded-full"
                />
                <Target className="w-20 h-20 text-blue-500" />
              </div>
              <h1 className="text-4xl font-bold tracking-tighter mb-2 uppercase">Mecha Strike</h1>
              <p className="text-blue-400/70 text-sm mb-8 font-mono tracking-widest">SYSTEM ONLINE // VER 1.0</p>
              
              <div className="space-y-4 w-full">
                <button 
                  onClick={startGame}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                >
                  <Play className="w-5 h-5 fill-current" />
                  START MISSION
                </button>
                <div className="text-xs text-white/40 font-mono">
                  SLIDE TO MOVE • TAP TO SHOOT
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'PLAYING' && (
            <div className="absolute inset-0 pointer-events-none">
              {/* HUD */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-40">
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <Heart 
                        key={i} 
                        className={`w-5 h-5 ${i < health ? 'text-red-500 fill-red-500' : 'text-white/20'}`} 
                      />
                    ))}
                  </div>
                  <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Armor Integrity</div>
                </div>
                
                <div className="text-right">
                  <div className="text-3xl font-bold font-mono leading-none">{score.toString().padStart(2, '0')}</div>
                  <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Targets Neutralized</div>
                </div>
              </div>

              {/* Player */}
              <motion.div 
                className="absolute z-30"
                animate={{ x: playerPos.x, y: playerPos.y }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              >
                <div className="relative">
                  <Zap className="w-10 h-10 text-blue-400 fill-blue-400/20" />
                  <motion.div 
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="absolute -inset-2 bg-blue-500/20 blur-xl rounded-full"
                  />
                </div>
              </motion.div>

              {/* Enemies */}
              {enemiesRef.current.map(enemy => (
                <div 
                  key={enemy.id}
                  className="absolute z-20"
                  style={{ left: enemy.x, top: enemy.y }}
                >
                  <Shield className="w-9 h-9 text-neutral-500 fill-neutral-500/20 rotate-180" />
                </div>
              ))}

              {/* Bullets */}
              {bulletsRef.current.map(bullet => (
                <div 
                  key={bullet.id}
                  className={`absolute rounded-full z-10 ${bullet.owner === 'player' ? 'bg-blue-400 shadow-[0_0_10px_#60a5fa]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`}
                  style={{ 
                    left: bullet.x, 
                    top: bullet.y, 
                    width: bullet.width, 
                    height: bullet.height 
                  }}
                />
              ))}
            </div>
          )}

          {(gameState === 'WON' || gameState === 'LOST') && (
            <motion.div 
              key="end"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50 p-8 text-center"
            >
              <h2 className={`text-5xl font-black mb-2 uppercase tracking-tighter ${gameState === 'WON' ? 'text-blue-500' : 'text-red-500'}`}>
                {gameState === 'WON' ? 'Mission Success' : 'Mission Failed'}
              </h2>
              <p className="text-white/60 mb-8 font-mono">
                {gameState === 'WON' ? 'ALL TARGETS NEUTRALIZED' : 'CRITICAL SYSTEM FAILURE'}
              </p>
              
              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="text-xs text-white/40 uppercase mb-1">Score</div>
                  <div className="text-2xl font-bold font-mono">{score}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="text-xs text-white/40 uppercase mb-1">Status</div>
                  <div className="text-sm font-bold text-blue-400">{gameState === 'WON' ? 'PROMOTED' : 'REPAIRING'}</div>
                </div>
              </div>

              <div className="space-y-3 w-full">
                <button 
                  onClick={startGame}
                  className="w-full py-4 bg-white text-black hover:bg-neutral-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                  RETRY MISSION
                </button>
                <button 
                  onClick={() => setGameState('MENU')}
                  className="w-full py-4 bg-transparent border border-white/20 hover:bg-white/5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Home className="w-5 h-5" />
                  RETURN TO BASE
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Instructions Overlay (Optional, for desktop users to know it's mobile-first) */}
      <div className="fixed bottom-4 left-0 right-0 text-center pointer-events-none opacity-20 hidden md:block">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em]">Optimized for Mobile Touch Controls</p>
      </div>
    </div>
  );
}
