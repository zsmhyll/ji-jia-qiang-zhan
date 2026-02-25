/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Home, Heart, Coins, ShieldAlert, Ghost, Zap } from 'lucide-react';

// --- Constants ---
const GAME_WIDTH = 375;
const GAME_HEIGHT = 667;
const PLAYER_X = 60;
const GROUND_Y = 500;
const PLAYER_SIZE = 40;
const JUMP_FORCE = 15;
const GRAVITY = 0.8;
const BASE_SPEED = 5;
const OBSTACLE_SPAWN_RATE = 1500; // ms
const ITEM_SPAWN_RATE = 4000; // ms

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';
type PlayerAction = 'RUNNING' | 'JUMPING' | 'CROUCHING';

interface Entity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'obstacle' | 'coin' | 'heart' | 'invincible';
  subType?: 'ground' | 'air';
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isInvincible, setIsInvincible] = useState(false);
  const [, setTick] = useState(0); // Used to force re-render every frame
  
  const gameLoopRef = useRef<number>(0);
  const playerYRef = useRef(GROUND_Y - PLAYER_SIZE);
  const playerActionRef = useRef<PlayerAction>('RUNNING');
  const entitiesRef = useRef<Entity[]>([]);
  const lastObstacleSpawnRef = useRef<number>(0);
  const lastItemSpawnRef = useRef<number>(0);
  const velocityRef = useRef(0);
  const nextIdRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);

  // --- Game Logic ---

  const spawnObstacle = useCallback((time: number) => {
    if (time - lastObstacleSpawnRef.current > OBSTACLE_SPAWN_RATE) {
      const isAir = Math.random() > 0.5;
      const newObstacle: Entity = {
        id: nextIdRef.current++,
        x: GAME_WIDTH + 50,
        y: isAir ? GROUND_Y - 80 : GROUND_Y - 40,
        width: 30,
        height: 40,
        type: 'obstacle',
        subType: isAir ? 'air' : 'ground',
      };
      entitiesRef.current.push(newObstacle);
      lastObstacleSpawnRef.current = time;
    }
  }, []);

  const spawnItem = useCallback((time: number) => {
    if (time - lastItemSpawnRef.current > ITEM_SPAWN_RATE) {
      const rand = Math.random();
      let type: Entity['type'] = 'coin';
      if (rand > 0.8) type = 'heart';
      else if (rand > 0.9) type = 'invincible';

      const newItem: Entity = {
        id: nextIdRef.current++,
        x: GAME_WIDTH + 50,
        y: GROUND_Y - 60 - Math.random() * 100,
        width: 30,
        height: 30,
        type: type,
      };
      entitiesRef.current.push(newItem);
      lastItemSpawnRef.current = time;
    }
  }, []);

  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    spawnObstacle(time);
    spawnItem(time);

    // Update Speed
    speedRef.current += 0.0005;

    // Update Player Physics
    if (playerActionRef.current === 'JUMPING') {
      velocityRef.current -= GRAVITY;
      playerYRef.current -= velocityRef.current;
      
      if (playerYRef.current >= GROUND_Y - PLAYER_SIZE) {
        playerActionRef.current = 'RUNNING';
        velocityRef.current = 0;
        playerYRef.current = GROUND_Y - PLAYER_SIZE;
      }
    }

    // Update Entities
    entitiesRef.current.forEach(e => {
      e.x -= speedRef.current;
    });
    entitiesRef.current = entitiesRef.current.filter(e => e.x > -100);

    // Collision Detection
    const isCrouching = playerActionRef.current === 'CROUCHING';
    const pHeight = isCrouching ? PLAYER_SIZE / 2 : PLAYER_SIZE;
    const pY = isCrouching ? playerYRef.current + PLAYER_SIZE / 2 : playerYRef.current;
    const playerRect = { x: PLAYER_X, y: pY, width: PLAYER_SIZE, height: pHeight };

    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const entity = entitiesRef.current[i];
      if (
        playerRect.x < entity.x + entity.width &&
        playerRect.x + playerRect.width > entity.x &&
        playerRect.y < entity.y + entity.height &&
        playerRect.y + playerRect.height > entity.y
      ) {
        if (entity.type === 'obstacle') {
          if (!isInvincible) {
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) setGameState('GAMEOVER');
              return newLives;
            });
            entitiesRef.current.splice(i, 1);
          }
        } else if (entity.type === 'coin') {
          setScore(s => s + 10);
          entitiesRef.current.splice(i, 1);
        } else if (entity.type === 'heart') {
          setLives(l => Math.min(3, l + 1));
          entitiesRef.current.splice(i, 1);
        } else if (entity.type === 'invincible') {
          setIsInvincible(true);
          setTimeout(() => setIsInvincible(false), 2000);
          entitiesRef.current.splice(i, 1);
        }
      }
    }

    setTick(t => t + 1); // Trigger re-render
    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameState, isInvincible]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameLoopRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(gameLoopRef.current);
    }
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState, update]);

  // --- Controls ---

  const handleJump = () => {
    if (gameState !== 'PLAYING') return;
    if (playerActionRef.current === 'RUNNING') {
      playerActionRef.current = 'JUMPING';
      velocityRef.current = JUMP_FORCE;
    }
  };

  const handleCrouchStart = () => {
    if (gameState !== 'PLAYING') return;
    if (playerActionRef.current === 'RUNNING') {
      playerActionRef.current = 'CROUCHING';
    }
  };

  const handleCrouchEnd = () => {
    if (playerActionRef.current === 'CROUCHING') {
      playerActionRef.current = 'RUNNING';
    }
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    playerYRef.current = GROUND_Y - PLAYER_SIZE;
    playerActionRef.current = 'RUNNING';
    entitiesRef.current = [];
    speedRef.current = BASE_SPEED;
    setGameState('PLAYING');
  };

  return (
    <div className="min-h-screen bg-sky-100 flex items-center justify-center p-4 font-sans text-slate-800 overflow-hidden select-none">
      {/* Game Container */}
      <div 
        className="relative bg-white border-4 border-white shadow-2xl overflow-hidden rounded-[2rem]"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        onMouseDown={handleJump}
        onTouchStart={handleJump}
      >
        {/* Background Layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-300 to-sky-100" />
        
        {/* Scrolling Clouds/Trees (Simplified) */}
        <div className="absolute top-20 left-0 w-full flex justify-around opacity-40">
          <div className="w-20 h-10 bg-white rounded-full blur-sm animate-pulse" />
          <div className="w-24 h-12 bg-white rounded-full blur-sm animate-pulse delay-75" />
        </div>

        {/* Ground */}
        <div 
          className="absolute bottom-0 left-0 w-full bg-emerald-400 border-t-8 border-emerald-500"
          style={{ height: GAME_HEIGHT - GROUND_Y }}
        />

        <AnimatePresence mode="wait">
          {gameState === 'MENU' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-md z-50 p-8 text-center"
            >
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-6"
              >
                <div className="w-24 h-24 bg-amber-300 rounded-2xl border-4 border-amber-400 flex items-center justify-center shadow-lg">
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full translate-x-1 -translate-y-1" />
                  </div>
                </div>
              </motion.div>
              
              <h1 className="text-4xl font-black text-emerald-600 tracking-tight mb-2 uppercase">Tiny Runner</h1>
              <p className="text-slate-500 text-sm mb-8 font-medium">DASH THROUGH THE FOREST!</p>
              
              <button 
                onClick={(e) => { e.stopPropagation(); startGame(); }}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-emerald-500/30"
              >
                <Play className="w-6 h-6 fill-current" />
                START DASH
              </button>
              
              <div className="mt-8 grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div>TAP TO JUMP</div>
                <div>HOLD TO CROUCH</div>
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
                        className={`w-6 h-6 ${i < lives ? 'text-rose-500 fill-rose-500' : 'text-slate-200'}`} 
                      />
                    ))}
                  </div>
                </div>
                
                <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm flex items-center gap-2 border border-slate-100">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-xl font-black font-mono text-slate-700">{score}</span>
                </div>
              </div>

              {/* Player */}
              <div 
                className="absolute z-30 transition-transform duration-75 ease-out"
                style={{ 
                  left: PLAYER_X,
                  transform: `translate3d(0, ${playerYRef.current}px, 0) scaleY(${playerActionRef.current === 'CROUCHING' ? 0.6 : 1}) rotate(${playerActionRef.current === 'JUMPING' ? 10 : 0}deg)`
                }}
              >
                <div className={`relative w-10 h-10 rounded-xl border-4 transition-colors ${isInvincible ? 'bg-amber-300 border-amber-400' : 'bg-sky-400 border-sky-500'}`}>
                  <div className="absolute top-2 right-2 w-3 h-3 bg-slate-800 rounded-full">
                    <div className="w-1 h-1 bg-white rounded-full translate-x-1" />
                  </div>
                  {isInvincible && (
                    <motion.div 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                      className="absolute -inset-2 border-2 border-amber-400 rounded-2xl"
                    />
                  )}
                </div>
              </div>

              {/* Entities */}
              {entitiesRef.current.map(entity => (
                <div 
                  key={entity.id}
                  className="absolute z-20 flex items-center justify-center will-change-transform"
                  style={{ 
                    width: entity.width, 
                    height: entity.height,
                    transform: `translate3d(${entity.x}px, ${entity.y}px, 0)`
                  }}
                >
                  {entity.type === 'obstacle' && (
                    <div className={`w-full h-full rounded-lg flex items-center justify-center ${entity.subType === 'air' ? 'bg-slate-700' : 'bg-orange-700'}`}>
                      {entity.subType === 'air' ? <Ghost className="w-6 h-6 text-white" /> : <ShieldAlert className="w-6 h-6 text-white" />}
                    </div>
                  )}
                  {entity.type === 'coin' && (
                    <motion.div 
                      animate={{ rotateY: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-8 h-8 bg-amber-400 border-4 border-amber-500 rounded-full flex items-center justify-center shadow-sm"
                    >
                      <span className="text-[10px] font-black text-amber-700">$</span>
                    </motion.div>
                  )}
                  {entity.type === 'heart' && (
                    <Heart className="w-8 h-8 text-rose-500 fill-rose-500 animate-bounce" />
                  )}
                  {entity.type === 'invincible' && (
                    <div className="w-8 h-8 bg-amber-200 border-4 border-amber-400 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
                    </div>
                  )}
                </div>
              ))}

              {/* Controls Overlay (Invisible) */}
              <div className="absolute inset-0 pointer-events-auto flex flex-col">
                <div className="flex-1" onMouseDown={handleJump} onTouchStart={handleJump} />
                <div 
                  className="h-1/3" 
                  onMouseDown={handleCrouchStart} 
                  onMouseUp={handleCrouchEnd}
                  onMouseLeave={handleCrouchEnd}
                  onTouchStart={handleCrouchStart}
                  onTouchEnd={handleCrouchEnd}
                />
              </div>
            </div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md z-50 p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
                <Ghost className="w-10 h-10 text-rose-500" />
              </div>
              
              <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Ouch!</h2>
              <p className="text-slate-500 mb-8 font-medium">YOU RAN INTO SOMETHING!</p>
              
              <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 w-full mb-8">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Final Score</div>
                <div className="text-5xl font-black text-emerald-500 font-mono">{score}</div>
              </div>

              <div className="space-y-3 w-full">
                <button 
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="w-full py-4 bg-emerald-500 text-white hover:bg-emerald-400 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-emerald-500/20"
                >
                  <RotateCcw className="w-5 h-5" />
                  TRY AGAIN
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setGameState('MENU'); }}
                  className="w-full py-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Home className="w-5 h-5" />
                  MAIN MENU
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Hint */}
      <div className="fixed bottom-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] pointer-events-none">
        Tap Top to Jump • Hold Bottom to Crouch
      </div>
    </div>
  );
}
