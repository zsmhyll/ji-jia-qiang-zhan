/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Home, Heart, Target, Crosshair, Shield, Zap, Skull, Trophy } from 'lucide-react';

// --- Constants ---
const GAME_WIDTH = 375;
const GAME_HEIGHT = 667;
const PLAYER_SIZE = 30;
const ENEMY_SIZE = 30;
const BULLET_SIZE = 6;
const ITEM_SIZE = 24;
const PLAYER_SPEED = 3.5;
const ENEMY_SPEED = 1.5;
const BULLET_SPEED = 8;
const SAFE_ZONE_SHRINK_RATE = 0.15; // pixels per frame
const INITIAL_SAFE_ZONE_RADIUS = 400;

type GameState = 'MENU' | 'PLAYING' | 'WON' | 'LOST';

interface Entity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Character extends Entity {
  health: number;
  hasWeapon: boolean;
  angle: number;
}

interface Bullet extends Entity {
  ownerId: number;
  vx: number;
  vy: number;
}

interface Item extends Entity {
  type: 'weapon' | 'health' | 'shield';
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(5);
  const [hasWeapon, setHasWeapon] = useState(false);
  const [enemiesLeft, setEnemiesLeft] = useState(0);
  const [, setTick] = useState(0);

  const gameLoopRef = useRef<number>(0);
  const playerPosRef = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, angle: 0 });
  const enemiesRef = useRef<Character[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const safeZoneRef = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: INITIAL_SAFE_ZONE_RADIUS });
  const nextIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Game Logic ---

  const spawnInitialWorld = useCallback(() => {
    nextIdRef.current = 0;
    enemiesRef.current = [];
    itemsRef.current = [];
    bulletsRef.current = [];
    safeZoneRef.current = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: INITIAL_SAFE_ZONE_RADIUS };

    // Spawn Items
    for (let i = 0; i < 8; i++) {
      itemsRef.current.push({
        id: nextIdRef.current++,
        x: Math.random() * (GAME_WIDTH - ITEM_SIZE),
        y: Math.random() * (GAME_HEIGHT - ITEM_SIZE),
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        type: i < 3 ? 'weapon' : (i < 6 ? 'health' : 'shield')
      });
    }

    // Spawn Enemies
    for (let i = 0; i < 4; i++) {
      enemiesRef.current.push({
        id: nextIdRef.current++,
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
        health: 3,
        hasWeapon: true,
        angle: Math.random() * Math.PI * 2
      });
    }
    setEnemiesLeft(enemiesRef.current.length);
  }, []);

  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    // 1. Shrink Safe Zone
    safeZoneRef.current.radius = Math.max(50, safeZoneRef.current.radius - SAFE_ZONE_SHRINK_RATE);

    // 2. Player Safe Zone Check
    const distToCenter = Math.sqrt(
      Math.pow(playerPosRef.current.x - safeZoneRef.current.x, 2) + 
      Math.pow(playerPosRef.current.y - safeZoneRef.current.y, 2)
    );
    if (distToCenter > safeZoneRef.current.radius) {
      if (Math.floor(time / 1000) % 2 === 0) { // Damage every 2 seconds roughly
        setHealth(h => {
          const newH = Math.max(0, h - 0.05);
          if (newH <= 0) setGameState('LOST');
          return newH;
        });
      }
    }

    // 3. Update Bullets
    bulletsRef.current.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
    });
    bulletsRef.current = bulletsRef.current.filter(b => b.x > 0 && b.x < GAME_WIDTH && b.y > 0 && b.y < GAME_HEIGHT);

    // 4. Update Enemies (Simple AI)
    enemiesRef.current.forEach(e => {
      // Move randomly
      e.x += Math.cos(e.angle) * ENEMY_SPEED;
      e.y += Math.sin(e.angle) * ENEMY_SPEED;

      // Bounce off walls
      if (e.x < 0 || e.x > GAME_WIDTH) e.angle = Math.PI - e.angle;
      if (e.y < 0 || e.y > GAME_HEIGHT) e.angle = -e.angle;

      // Randomly shoot
      if (Math.random() < 0.01) {
        const targetAngle = Math.atan2(playerPosRef.current.y - e.y, playerPosRef.current.x - e.x);
        bulletsRef.current.push({
          id: nextIdRef.current++,
          x: e.x + ENEMY_SIZE / 2,
          y: e.y + ENEMY_SIZE / 2,
          width: BULLET_SIZE,
          height: BULLET_SIZE,
          vx: Math.cos(targetAngle) * BULLET_SPEED,
          vy: Math.sin(targetAngle) * BULLET_SPEED,
          ownerId: e.id
        });
      }
    });

    // 5. Collision Detection
    const playerRect = { x: playerPosRef.current.x - PLAYER_SIZE / 2, y: playerPosRef.current.y - PLAYER_SIZE / 2, width: PLAYER_SIZE, height: PLAYER_SIZE };

    // Bullets hitting characters
    for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
      const b = bulletsRef.current[i];
      
      // Hit Player?
      if (b.ownerId !== -1 && 
          b.x > playerRect.x && b.x < playerRect.x + playerRect.width &&
          b.y > playerRect.y && b.y < playerRect.y + playerRect.height) {
        setHealth(h => {
          const newH = h - 1;
          if (newH <= 0) setGameState('LOST');
          return newH;
        });
        bulletsRef.current.splice(i, 1);
        continue;
      }

      // Hit Enemy?
      for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
        const e = enemiesRef.current[j];
        if (b.ownerId === -1 && 
            b.x > e.x && b.x < e.x + e.width &&
            b.y > e.y && b.y < e.y + e.height) {
          e.health -= 1;
          if (e.health <= 0) {
            enemiesRef.current.splice(j, 1);
            setScore(s => s + 100);
            setEnemiesLeft(enemiesRef.current.length);
            if (enemiesRef.current.length === 0) setGameState('WON');
          }
          bulletsRef.current.splice(i, 1);
          break;
        }
      }
    }

    // Player picking up items
    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
      const item = itemsRef.current[i];
      if (playerRect.x < item.x + item.width &&
          playerRect.x + playerRect.width > item.x &&
          playerRect.y < item.y + item.height &&
          playerRect.y + playerRect.height > item.y) {
        
        if (item.type === 'weapon') setHasWeapon(true);
        else if (item.type === 'health') setHealth(h => Math.min(5, h + 1));
        else if (item.type === 'shield') setHealth(h => h + 0.5);
        
        itemsRef.current.splice(i, 1);
      }
    }

    setTick(t => t + 1);
    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      gameLoopRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(gameLoopRef.current);
    }
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState, update]);

  // --- Controls ---

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const targetX = clientX - rect.left;
    const targetY = clientY - rect.top;

    const dx = targetX - playerPosRef.current.x;
    const dy = targetY - playerPosRef.current.y;
    const angle = Math.atan2(dy, dx);

    playerPosRef.current.x += Math.cos(angle) * PLAYER_SPEED;
    playerPosRef.current.y += Math.sin(angle) * PLAYER_SPEED;
    playerPosRef.current.angle = angle;

    // Boundary check
    playerPosRef.current.x = Math.max(0, Math.min(GAME_WIDTH, playerPosRef.current.x));
    playerPosRef.current.y = Math.max(0, Math.min(GAME_HEIGHT, playerPosRef.current.y));
  };

  const handleShoot = () => {
    if (gameState !== 'PLAYING' || !hasWeapon) return;
    bulletsRef.current.push({
      id: nextIdRef.current++,
      x: playerPosRef.current.x,
      y: playerPosRef.current.y,
      width: BULLET_SIZE,
      height: BULLET_SIZE,
      vx: Math.cos(playerPosRef.current.angle) * BULLET_SPEED,
      vy: Math.sin(playerPosRef.current.angle) * BULLET_SPEED,
      ownerId: -1 // Player id
    });
  };

  const startGame = () => {
    setScore(0);
    setHealth(5);
    setHasWeapon(false);
    playerPosRef.current = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, angle: 0 };
    spawnInitialWorld();
    setGameState('PLAYING');
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 font-sans text-white overflow-hidden select-none">
      {/* Game Container */}
      <div 
        ref={containerRef}
        className="relative bg-emerald-900/20 border-4 border-neutral-800 shadow-2xl overflow-hidden rounded-[2rem]"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        onMouseMove={handleMove}
        onTouchMove={handleMove}
        onClick={handleShoot}
      >
        {/* Map Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:32px_32px] opacity-10" />

        <AnimatePresence mode="wait">
          {gameState === 'MENU' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-50 p-8 text-center"
            >
              <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                <Target className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter mb-2 uppercase italic">Mini Royale</h1>
              <p className="text-emerald-400 text-xs mb-8 font-mono tracking-widest">SURVIVE AT ALL COSTS</p>
              
              <button 
                onClick={(e) => { e.stopPropagation(); startGame(); }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-emerald-600/30"
              >
                <Play className="w-6 h-6 fill-current" />
                ENTER BATTLE
              </button>
              
              <div className="mt-8 space-y-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <div>DRAG TO MOVE</div>
                <div>TAP TO SHOOT (NEED WEAPON)</div>
              </div>
            </motion.div>
          )}

          {gameState === 'PLAYING' && (
            <motion.div 
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Safe Zone Visual */}
              <div 
                className="absolute border-[4px] border-blue-500/40 rounded-full transition-all duration-100 ease-linear pointer-events-none"
                style={{ 
                  left: safeZoneRef.current.x - safeZoneRef.current.radius,
                  top: safeZoneRef.current.y - safeZoneRef.current.radius,
                  width: safeZoneRef.current.radius * 2,
                  height: safeZoneRef.current.radius * 2,
                  boxShadow: '0 0 0 2000px rgba(59, 130, 246, 0.1)'
                }}
              />

              {/* HUD */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-40">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-4 h-4 rounded-sm ${i < Math.floor(health) ? 'bg-rose-500' : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/10">
                    <Skull className="w-3 h-3 text-white/60" />
                    <span className="text-xs font-bold font-mono">{enemiesLeft} LEFT</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-black font-mono leading-none">{score}</div>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Points</div>
                </div>
              </div>

              {/* Weapon Indicator */}
              <div className="absolute bottom-6 right-6 z-40">
                <div className={`p-4 rounded-2xl border-2 transition-all ${hasWeapon ? 'bg-emerald-500 border-emerald-400' : 'bg-white/5 border-white/10 opacity-40'}`}>
                  <Crosshair className={`w-6 h-6 ${hasWeapon ? 'text-white' : 'text-white/40'}`} />
                </div>
              </div>

              {/* Items */}
              {itemsRef.current.map(item => (
                <div 
                  key={item.id}
                  className="absolute z-10 flex items-center justify-center"
                  style={{ 
                    transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
                    width: item.width,
                    height: item.height
                  }}
                >
                  <div className={`w-full h-full rounded-lg flex items-center justify-center shadow-sm ${
                    item.type === 'weapon' ? 'bg-amber-500' : (item.type === 'health' ? 'bg-rose-500' : 'bg-blue-500')
                  }`}>
                    {item.type === 'weapon' && <Zap className="w-3 h-3 text-white" />}
                    {item.type === 'health' && <Heart className="w-3 h-3 text-white" />}
                    {item.type === 'shield' && <Shield className="w-3 h-3 text-white" />}
                  </div>
                </div>
              ))}

              {/* Enemies */}
              {enemiesRef.current.map(enemy => (
                <div 
                  key={enemy.id}
                  className="absolute z-20 flex items-center justify-center will-change-transform"
                  style={{ 
                    width: enemy.width, 
                    height: enemy.height,
                    transform: `translate3d(${enemy.x}px, ${enemy.y}px, 0) rotate(${enemy.angle}rad)`
                  }}
                >
                  <div className="w-full h-full bg-neutral-800 border-2 border-neutral-700 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-rose-500 rounded-full translate-x-2" />
                  </div>
                </div>
              ))}

              {/* Bullets */}
              {bulletsRef.current.map(bullet => (
                <div 
                  key={bullet.id}
                  className={`absolute rounded-full z-10 ${bullet.ownerId === -1 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{ 
                    transform: `translate3d(${bullet.x}px, ${bullet.y}px, 0)`,
                    width: bullet.width, 
                    height: bullet.height,
                    boxShadow: bullet.ownerId === -1 ? '0 0 8px #10b981' : '0 0 8px #fb7185'
                  }}
                />
              ))}

              {/* Player */}
              <div 
                className="absolute z-30 will-change-transform"
                style={{ 
                  transform: `translate3d(${playerPosRef.current.x - PLAYER_SIZE / 2}px, ${playerPosRef.current.y - PLAYER_SIZE / 2}px, 0) rotate(${playerPosRef.current.angle}rad)`
                }}
              >
                <div className="relative w-[30px] h-[30px] bg-emerald-500 border-2 border-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <div className="w-2 h-2 bg-white rounded-full translate-x-2" />
                </div>
              </div>
            </motion.div>
          )}

          {(gameState === 'WON' || gameState === 'LOST') && (
            <motion.div 
              key="end"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50 p-8 text-center"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${gameState === 'WON' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                {gameState === 'WON' ? <Trophy className="w-10 h-10 text-white" /> : <Skull className="w-10 h-10 text-white" />}
              </div>
              
              <h2 className="text-4xl font-black mb-2 uppercase tracking-tighter">
                {gameState === 'WON' ? 'Winner Winner!' : 'Eliminated'}
              </h2>
              <p className="text-white/40 mb-8 font-mono text-xs">
                {gameState === 'WON' ? 'CHICKEN DINNER' : 'BETTER LUCK NEXT TIME'}
              </p>
              
              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="text-[10px] text-white/40 uppercase font-bold mb-1">Score</div>
                  <div className="text-2xl font-black font-mono">{score}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="text-[10px] text-white/40 uppercase font-bold mb-1">Rank</div>
                  <div className="text-2xl font-black font-mono text-emerald-400">#{gameState === 'WON' ? '1' : enemiesLeft + 1}</div>
                </div>
              </div>

              <div className="space-y-3 w-full">
                <button 
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="w-full py-4 bg-emerald-600 text-white hover:bg-emerald-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                  PLAY AGAIN
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setGameState('MENU'); }}
                  className="w-full py-4 bg-white/5 text-white/60 hover:bg-white/10 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Home className="w-5 h-5" />
                  MAIN MENU
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
