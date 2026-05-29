import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Pause, 
  Volume2, 
  VolumeX, 
  Coins, 
  ShoppingBag, 
  Sparkles, 
  TrendingUp, 
  Heart, 
  Cpu, 
  Save, 
  Smartphone, 
  Music,
  Home,
  Maximize2,
  Gamepad2,
  BookmarkCheck,
  Zap,
  Clock
} from 'lucide-react';
import { soundEngine } from './components/SoundEngine';
import { generateLevelBricks, LEVELS } from './components/LevelGenerator';
import { PADDLE_SKINS, VISUAL_THEMES } from './components/ThemeStyles';
import GameShop from './components/GameShop';
import { Brick, Ball, PowerUp, Particle, LaserBolt, SaveState, PowerUpType, BrickType } from './types';

export default function App() {
  // --- Core Game Settings / Progress State ---
  const [score, setScore] = useState<number>(0);
  const [coins, setCoins] = useState<number>(100); // Start with some pocket coins
  const [highScore, setHighScore] = useState<number>(0);
  const [levelIndex, setLevelIndex] = useState<number>(0); // Level 1 is idx 0
  const [lives, setLives] = useState<number>(3);
  
  // Shop State
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(['classic_pink']);
  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(['cyberpunk_neon']);
  const [selectedSkinId, setSelectedSkinId] = useState<string>('classic_pink');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('cyberpunk_neon');
  const [shopOpen, setShopOpen] = useState<boolean>(false);

  // Mute / Sound State
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [musicStarted, setMusicStarted] = useState<boolean>(false);

  // Game Engine Loop States
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'LEVEL_COMPLETE' | 'VICTORY'>('MENU');
  const [savedRunExists, setSavedRunExists] = useState<boolean>(false);
  const [saveIndicatorText, setSaveIndicatorText] = useState<string>('Progress Synced');
  const [saveIndicatorTime, setSaveIndicatorTime] = useState<string>('Up to date');

  // Interactive Powerup timers tracked in state for UI display
  const [activeWideDuration, setActiveWideDuration] = useState<number>(0);
  const [activeLaserDuration, setActiveLaserDuration] = useState<number>(0);
  const [activeDoubleCoinsDuration, setActiveDoubleCoinsDuration] = useState<number>(0);
  const [activeStickyDuration, setActiveStickyDuration] = useState<number>(0);

  // Canvas Refs & Dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Paddle Skin & Theme Object Lookup Helpers
  const currentSkin = PADDLE_SKINS.find(s => s.id === selectedSkinId) || PADDLE_SKINS[0];
  const currentTheme = VISUAL_THEMES.find(t => t.id === selectedThemeId) || VISUAL_THEMES[0];

  // --- Dynamic Gameplay Physics References ---
  const bricksRef = useRef<Brick[]>([]);
  const ballsRef = useRef<Ball[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const laserBoltsRef = useRef<LaserBolt[]>([]);
  const paddleRef = useRef<{ x: number; y: number; width: number; height: number; speed: number }>({
    x: 350,
    y: 540,
    width: 100,
    height: 15,
    speed: 12
  });

  // Track active keyboard inputs
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  // Mouse and Touch position trackers
  const isPointerActiveRef = useRef<boolean>(false);
  const pointerXRef = useRef<number>(350);

  // Active powerup tracking timers inside loop
  const wideTimerRef = useRef<number>(0);
  const laserTimerRef = useRef<number>(0);
  const doubleCoinsTimerRef = useRef<number>(0);
  const stickyTimerRef = useRef<number>(0);
  const laserFireCooldownRef = useRef<number>(0);

  // Speed scaling factor for physics calculations
  const speedScale = 1.0 + levelIndex * 0.08;

  // Floating text popups inside canvas (e.g., "+35 Coins", "+100 Score")
  const scorePopupsRef = useRef<{ x: number; y: number; text: string; color: string; life: number }[]>([]);

  // Frame simulation handle
  const requestFrameRef = useRef<number | null>(null);

  // --------------------------------------------------------------------
  // LOCAL STORAGE PERSISTENCE (SAVE / RESUME)
  // --------------------------------------------------------------------
  // Mount: Load unlocks and meta
  useEffect(() => {
    try {
      const storedHighScore = localStorage.getItem('NEON_BREAKER_HIGH_SCORE');
      if (storedHighScore) setHighScore(parseInt(storedHighScore, 10));

      const storedMeta = localStorage.getItem('NEON_BREAKER_META_STATE');
      if (storedMeta) {
        const decoded = JSON.parse(storedMeta);
        if (decoded.coins !== undefined) setCoins(decoded.coins);
        if (decoded.unlockedSkins) setUnlockedSkins(decoded.unlockedSkins);
        if (decoded.unlockedThemes) setUnlockedThemes(decoded.unlockedThemes);
        if (decoded.selectedSkinId) setSelectedSkinId(decoded.selectedSkinId);
        if (decoded.selectedThemeId) setSelectedThemeId(decoded.selectedThemeId);
      }

      // Check if active resume state exists
      const resumeFile = localStorage.getItem('NEON_BREAKER_RESUME_STATE');
      if (resumeFile) {
        setSavedRunExists(true);
      }
    } catch (e) {
      console.error('Failed to parse meta progress: ', e);
    }
  }, []);

  // Save meta values anytime critical items shift
  useEffect(() => {
    try {
      const meta = {
        coins,
        unlockedSkins,
        unlockedThemes,
        selectedSkinId,
        selectedThemeId
      };
      localStorage.setItem('NEON_BREAKER_META_STATE', JSON.stringify(meta));
    } catch (e) {
      console.warn('Metadata write blocked', e);
    }
  }, [coins, unlockedSkins, unlockedThemes, selectedSkinId, selectedThemeId]);

  // Handle auto-saving state back to storage
  const performSaveState = (midGame: boolean = true) => {
    try {
      const saveObj: SaveState = {
        score,
        coins,
        levelIndex,
        lives,
        unlockedSkins,
        unlockedThemes,
        selectedSkinId,
        selectedThemeId,
        highScore: Math.max(highScore, score),
        savedGameExists: midGame,
        // Current positions for seamless pause/resume
        midGameLevel: levelIndex,
        midGameBricks: midGame ? bricksRef.current : undefined,
        midGameScore: midGame ? score : undefined,
        midGameLives: midGame ? lives : undefined,
        midGameCoins: midGame ? coins : undefined,
        midGameBalls: midGame ? ballsRef.current : undefined,
      };

      if (midGame) {
        localStorage.setItem('NEON_BREAKER_RESUME_STATE', JSON.stringify(saveObj));
        setSavedRunExists(true);
      } else {
        localStorage.removeItem('NEON_BREAKER_RESUME_STATE');
        setSavedRunExists(false);
      }

      // Update HUD status label
      setSaveIndicatorText('Game Saved!');
      const date = new Date();
      setSaveIndicatorTime(`${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}:${date.getUTCSeconds().toString().padStart(2, '0')} UTC`);
      
      setTimeout(() => {
        setSaveIndicatorText('Progress Synced');
      }, 3000);
    } catch (e) {
      console.error('Unable to store state', e);
    }
  };

  // --------------------------------------------------------------------
  // AUDIO CONTROLLER TRIGGERS
  // --------------------------------------------------------------------
  const handleToggleVolume = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    soundEngine.toggleMute(nextMute);
    soundEngine.playPaddleHit();
  };

  const ensureMusicStarts = () => {
    soundEngine.init();
    if (!musicStarted && !isMuted) {
      soundEngine.startMusic();
      setMusicStarted(true);
    }
  };

  // --------------------------------------------------------------------
  // UNLOCKERS & SELECTION WRAPPERS
  // --------------------------------------------------------------------
  const handleUnlockSkin = (skinId: string, cost: number) => {
    if (coins >= cost) {
      const nextCoins = coins - cost;
      setCoins(nextCoins);
      setUnlockedSkins(prev => [...prev, skinId]);
      setSelectedSkinId(skinId);
      
      if (gameState === 'PLAYING' || gameState === 'PAUSED') {
        try {
          const saveObj: SaveState = {
            score,
            coins: nextCoins,
            levelIndex,
            lives,
            unlockedSkins: [...unlockedSkins, skinId],
            unlockedThemes,
            selectedSkinId: skinId,
            selectedThemeId,
            highScore: Math.max(highScore, score),
            savedGameExists: true,
            midGameLevel: levelIndex,
            midGameBricks: bricksRef.current,
            midGameScore: score,
            midGameLives: lives,
            midGameCoins: nextCoins,
            midGameBalls: ballsRef.current,
          };
          localStorage.setItem('NEON_BREAKER_RESUME_STATE', JSON.stringify(saveObj));
          setSavedRunExists(true);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleSelectSkin = (skinId: string) => {
    setSelectedSkinId(skinId);
    if (gameState === 'PLAYING' || gameState === 'PAUSED') {
      try {
        const saveObj: SaveState = {
          score,
          coins,
          levelIndex,
          lives,
          unlockedSkins,
          unlockedThemes,
          selectedSkinId: skinId,
          selectedThemeId,
          highScore: Math.max(highScore, score),
          savedGameExists: true,
          midGameLevel: levelIndex,
          midGameBricks: bricksRef.current,
          midGameScore: score,
          midGameLives: lives,
          midGameCoins: coins,
          midGameBalls: ballsRef.current,
        };
        localStorage.setItem('NEON_BREAKER_RESUME_STATE', JSON.stringify(saveObj));
        setSavedRunExists(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleUnlockTheme = (themeId: string, cost: number) => {
    if (coins >= cost) {
      const nextCoins = coins - cost;
      setCoins(nextCoins);
      setUnlockedThemes(prev => [...prev, themeId]);
      setSelectedThemeId(themeId);

      if (gameState === 'PLAYING' || gameState === 'PAUSED') {
        try {
          const saveObj: SaveState = {
            score,
            coins: nextCoins,
            levelIndex,
            lives,
            unlockedSkins,
            unlockedThemes: [...unlockedThemes, themeId],
            selectedSkinId,
            selectedThemeId: themeId,
            highScore: Math.max(highScore, score),
            savedGameExists: true,
            midGameLevel: levelIndex,
            midGameBricks: bricksRef.current,
            midGameScore: score,
            midGameLives: lives,
            midGameCoins: nextCoins,
            midGameBalls: ballsRef.current,
          };
          localStorage.setItem('NEON_BREAKER_RESUME_STATE', JSON.stringify(saveObj));
          setSavedRunExists(true);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    if (gameState === 'PLAYING' || gameState === 'PAUSED') {
      try {
        const saveObj: SaveState = {
          score,
          coins,
          levelIndex,
          lives,
          unlockedSkins,
          unlockedThemes,
          selectedSkinId,
          selectedThemeId: themeId,
          highScore: Math.max(highScore, score),
          savedGameExists: true,
          midGameLevel: levelIndex,
          midGameBricks: bricksRef.current,
          midGameScore: score,
          midGameLives: lives,
          midGameCoins: coins,
          midGameBalls: ballsRef.current,
        };
        localStorage.setItem('NEON_BREAKER_RESUME_STATE', JSON.stringify(saveObj));
        setSavedRunExists(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // --------------------------------------------------------------------
  // PROCEDURAL LEVEL TRANSITIONS & SPAWNS
  // --------------------------------------------------------------------
  const prepareLevel = (selectedLevelIdx: number, resumeBricks?: Brick[], resumeBalls?: Ball[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set level index
    setLevelIndex(selectedLevelIdx);

    const w = canvas.width;
    const h = canvas.height;

    // Paddle setup
    paddleRef.current = {
      x: w / 2 - 50,
      y: h - 45,
      width: wideTimerRef.current > 0 ? 160 : 100,
      height: 15,
      speed: 12
    };

    // Spawn bricks from LevelGenerator
    if (resumeBricks && resumeBricks.length > 0) {
      bricksRef.current = resumeBricks;
    } else {
      bricksRef.current = generateLevelBricks(selectedLevelIdx, w, h, currentTheme);
    }

    // Spawn ball
    if (resumeBalls && resumeBalls.length > 0) {
      ballsRef.current = resumeBalls;
    } else {
      ballsRef.current = [
        {
          x: w / 2,
          y: paddleRef.current.y - 12,
          vx: (Math.random() - 0.5) * 4,
          vy: -6 * speedScale,
          radius: 8,
          speed: 6.5 * speedScale,
          sticky: false,
          isStickyAttached: true,
          stickyOffsetX: 0
        }
      ];
    }

    // Clear accessories
    powerUpsRef.current = [];
    particlesRef.current = [];
    laserBoltsRef.current = [];
    scorePopupsRef.current = [];
    
    // Play transition chime
    soundEngine.playVictory();
  };

  // Start complete fresh session
  const startNewSession = () => {
    ensureMusicStarts();
    setScore(0);
    setLives(3);
    
    // Reset active ref powerup timers
    wideTimerRef.current = 0;
    laserTimerRef.current = 0;
    doubleCoinsTimerRef.current = 0;
    stickyTimerRef.current = 0;
    
    setActiveWideDuration(0);
    setActiveLaserDuration(0);
    setActiveDoubleCoinsDuration(0);
    setActiveStickyDuration(0);

    setGameState('PLAYING');
    
    // Auto initiate first level structure
    setTimeout(() => {
      prepareLevel(0);
    }, 100);
  };

  // Resume old snapshot state
  const startResumeSession = () => {
    ensureMusicStarts();
    try {
      const resumeFile = localStorage.getItem('NEON_BREAKER_RESUME_STATE');
      if (resumeFile) {
        const decoded: SaveState = JSON.parse(resumeFile);
        
        setScore(decoded.midGameScore ?? decoded.score);
        setCoins(decoded.coins);
        setLives(decoded.midGameLives ?? decoded.lives);
        setLevelIndex(decoded.midGameLevel ?? decoded.levelIndex);
        
        if (decoded.selectedSkinId) setSelectedSkinId(decoded.selectedSkinId);
        if (decoded.selectedThemeId) setSelectedThemeId(decoded.selectedThemeId);

        setGameState('PLAYING');

        setTimeout(() => {
          prepareLevel(
            decoded.midGameLevel ?? decoded.levelIndex,
            decoded.midGameBricks,
            decoded.midGameBalls
          );
        }, 120);
      }
    } catch (e) {
      console.error('Failed to load resume state: ', e);
      startNewSession();
    }
  };

  // Reset ball position if player loses a ball but still has remaining lives
  const handleLostBallLife = () => {
    soundEngine.playLifeLost();
    const nextLives = lives - 1;
    setLives(nextLives);

    if (nextLives <= 0) {
      setGameState('GAMEOVER');
      soundEngine.stopMusic();
      setMusicStarted(false);
      // Remove resume cache on final death
      localStorage.removeItem('NEON_BREAKER_RESUME_STATE');
      setSavedRunExists(false);
    } else {
      // Re-anchor a singular ball onto the paddle
      const canvas = canvasRef.current;
      if (!canvas) return;

      paddleRef.current.x = canvas.width / 2 - paddleRef.current.width / 2;

      ballsRef.current = [
        {
          x: canvas.width / 2,
          y: paddleRef.current.y - 12,
          vx: (Math.random() - 0.5) * 4,
          vy: -6 * speedScale,
          radius: 8,
          speed: 6.5 * speedScale,
          sticky: false,
          isStickyAttached: true,
          stickyOffsetX: 0
        }
      ];

      // Reset laser / wide timers to allow recovery
      laserTimerRef.current = 0;
      wideTimerRef.current = 0;
      setActiveLaserDuration(0);
      setActiveWideDuration(0);
    }

    performSaveState(nextLives > 0);
  };

  // Trigger win next level configuration
  const handleVictoryLevel = () => {
    soundEngine.playVictory();
    const nextLvlIdx = levelIndex + 1;
    
    // Scale gold reward depending on achievement
    const bonusGold = 100 + nextLvlIdx * 15;
    setCoins(prev => prev + bonusGold);
    triggerScorePopup(canvasRef.current?.width ? canvasRef.current.width / 2 : 300, 300, `+${bonusGold} LEVEL COMPLETED BONUS CREDIT!`, '#eab308');

    if (nextLvlIdx >= LEVELS.length * 4) {
      // Finished final loop levels
      setGameState('VICTORY');
      localStorage.removeItem('NEON_BREAKER_RESUME_STATE');
      setSavedRunExists(false);
    } else {
      setGameState('LEVEL_COMPLETE');
      setLevelIndex(nextLvlIdx);
      performSaveState(true);
    }
  };

  // Launch the currently attached ball from the paddle
  const launchActiveBalls = () => {
    ballsRef.current.forEach(ball => {
      if (ball.isStickyAttached) {
        ball.isStickyAttached = false;
        // Pushes off in general upward direction relative to where on paddle it was
        const relativeRatio = ball.stickyOffsetX / (paddleRef.current.width / 2);
        ball.vx = relativeRatio * 4;
        ball.vy = -6 * speedScale;
      }
    });
    soundEngine.playPaddleHit();
  };

  // --------------------------------------------------------------------
  // FLOAT POPUP EMITTER
  // --------------------------------------------------------------------
  const triggerScorePopup = (x: number, y: number, text: string, color: string) => {
    scorePopupsRef.current.push({
      x,
      y,
      text,
      color,
      life: 1.0 // opacity scales down with this
    });
  };

  // --------------------------------------------------------------------
  // EVENT LISTENERS: Keyboard, Mouse, and Mobile Touch Drag
  // --------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = true;
      keysPressedRef.current[e.code] = true;

      // Spacebar action
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (gameState === 'PLAYING') {
          // Launch attached ball
          const hasAttached = ballsRef.current.some(b => b.isStickyAttached);
          if (hasAttached) {
            launchActiveBalls();
          } else if (laserTimerRef.current > 0) {
            // Fire laser
            fireLaserBolts();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = false;
      keysPressedRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Handle laser ammunition launching
  const fireLaserBolts = () => {
    if (laserFireCooldownRef.current > 0) return;
    
    soundEngine.playLaser();
    
    // Spawn two bolts from edge sides of paddle
    const leftX = paddleRef.current.x + 5;
    const rightX = paddleRef.current.x + paddleRef.current.width - 5;
    const boltY = paddleRef.current.y - 10;

    laserBoltsRef.current.push(
      { id: Math.random().toString(), x: leftX, y: boltY, vx: 0, vy: -12, color: currentTheme.primaryColor },
      { id: Math.random().toString(), x: rightX, y: boltY, vx: 0, vy: -12, color: currentTheme.primaryColor }
    );

    // Speed cooldown
    laserFireCooldownRef.current = 15; // frames (approx 0.25s)
  };

  // --------------------------------------------------------------------
  // PHYSIC GRAPHICS GAME LOOP RUNNER
  // --------------------------------------------------------------------
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (requestFrameRef.current) {
        cancelAnimationFrame(requestFrameRef.current);
        requestFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localFrame = 0;

    const gameTick = () => {
      localFrame++;
      
      // Clear screen
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- 1. RENDER PERSPECTIVE MATRIX TECH BACKGROUND ---
      renderRetroGrid(ctx, canvas, localFrame);

      // --- 2. DECREMENT ACTIVE TIMERS ---
      updateTimers();

      // --- 3. PADDLE VELOCITY POSITION CALCULATIONS ---
      updatePaddlePosition(canvas);

      // --- 4. RENDER BRICKS & PROCESS COLLISION CHECKS ---
      renderAndPhysicsBricks(ctx);

      // --- 5. BALL REBOUNDS & WALL COLLISION ---
      renderAndPhysicsBalls(canvas, ctx);

      // --- 6. POWER-UP RECEPTACLES & DRIFT PHYSICS ---
      renderAndPhysicsPowerups(ctx);

      // --- 7. RENDER PARTICLES SPLASHES ---
      renderParticles(ctx);

      // --- 8. LASER SHAFTS SIMULATIONS ---
      renderAndPhysicsLasers(ctx);

      // --- 9. PADDLE RENDERING WITH SKIN SPECIFICATIONS ---
      renderPaddle(ctx);

      // --- 10. FLYING FLOATING ACCENT POPUPS ---
      renderScorePopups(ctx);

      // --- 11. LEVEL VICTOR CHECK ---
      checkLevelStatus();

      requestFrameRef.current = requestAnimationFrame(gameTick);
    };

    // Run first frame
    requestFrameRef.current = requestAnimationFrame(gameTick);

    return () => {
      if (requestFrameRef.current) {
        cancelAnimationFrame(requestFrameRef.current);
      }
    };
  }, [gameState, levelIndex, selectedSkinId, selectedThemeId]);

  // Decrement ref durations & set React timers for sidebars UI indicators
  const updateTimers = () => {
    if (laserFireCooldownRef.current > 0) laserFireCooldownRef.current--;

    if (wideTimerRef.current > 0) {
      wideTimerRef.current = Math.max(0, wideTimerRef.current - 1 / 60);
      setActiveWideDuration(Math.ceil(wideTimerRef.current));
      if (wideTimerRef.current === 0) {
        // Reset normal paddle dimensions
        paddleRef.current.width = 100;
      }
    }

    if (laserTimerRef.current > 0) {
      laserTimerRef.current = Math.max(0, laserTimerRef.current - 1 / 60);
      setActiveLaserDuration(Math.ceil(laserTimerRef.current));
    }

    if (doubleCoinsTimerRef.current > 0) {
      doubleCoinsTimerRef.current = Math.max(0, doubleCoinsTimerRef.current - 1 / 60);
      setActiveDoubleCoinsDuration(Math.ceil(doubleCoinsTimerRef.current));
    }

    if (stickyTimerRef.current > 0) {
      stickyTimerRef.current = Math.max(0, stickyTimerRef.current - 1 / 60);
      setActiveStickyDuration(Math.ceil(stickyTimerRef.current));
    }
  };

  // Keyboard, Mouse, and Touch trackers updates
  const updatePaddlePosition = (canvas: HTMLCanvasElement) => {
    const pad = paddleRef.current;
    
    if (isPointerActiveRef.current) {
      // Clamp to center limits
      const targetX = pointerXRef.current - pad.width / 2;
      pad.x += (targetX - pad.x) * 0.35; // smooth interpolation
    } else {
      // Arrow keyboard trackers
      if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['KeyA'] || keysPressedRef.current['a']) {
        pad.x -= pad.speed;
      }
      if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['KeyD'] || keysPressedRef.current['d']) {
        pad.x += pad.speed;
      }
    }

    // Border bounds hard clamp
    if (pad.x < 0) pad.x = 0;
    if (pad.x + pad.width > canvas.width) pad.x = canvas.width - pad.width;
  };

  // Grid effect generator
  const renderRetroGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, frame: number) => {
    ctx.save();
    
    // Ambient back colors matching theme background
    ctx.fillStyle = currentTheme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing horizon background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(13, 10, 30, 0.9)');
    grad.addColorStop(0.5, 'rgba(5, 1, 18, 0.95)');
    grad.addColorStop(1, '#050112');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Perspective neon grid lines
    ctx.strokeStyle = currentTheme.gridColor;
    ctx.lineWidth = 1;

    // Horizontal cyber neon grid scanning forward
    const gridSpacing = 40;
    const offset = (frame * 0.7) % gridSpacing;
    ctx.beginPath();
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      const cy = y + offset;
      // Fade transparency at the top
      ctx.globalAlpha = Math.min(0.2, cy / canvas.height);
      ctx.moveTo(0, cy);
      ctx.lineTo(canvas.width, cy);
    }
    ctx.stroke();

    // Vertical diverging retro tunnel grid lines
    ctx.beginPath();
    const midX = canvas.width / 2;
    for (let x = -200; x <= canvas.width + 200; x += 80) {
      ctx.globalAlpha = 0.12;
      // Radiate outwards from top horizon
      ctx.moveTo(midX, 0);
      ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();

    ctx.restore();
  };

  // Render & physics bricks animations
  const renderAndPhysicsBricks = (ctx: CanvasRenderingContext2D) => {
    bricksRef.current.forEach((brick) => {
      ctx.save();
      
      // Shadow and neon glow filters based on brick colors
      ctx.shadowBlur = 10;
      ctx.shadowColor = brick.color;
      
      // Render HP armor indicators
      const isDamaged = brick.hp < brick.maxHp && brick.type === 'armored';
      
      // Outer border gradient glow
      const bGrad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
      bGrad.addColorStop(0, brick.color);
      // Gilded boss brick shine
      bGrad.addColorStop(1, brick.type === 'gilded' ? '#b45309' : 'rgba(0,0,0,0.4)');

      ctx.fillStyle = bGrad;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;

      // Draw rounded rectangular neon card
      drawRoundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 6);
      ctx.fill();
      ctx.stroke();

      // Accent core shine
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height / 2.5);

      // Core custom visuals depending on brick specs
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0; // Turn off for labels

      if (brick.type === 'armored') {
        // Metallic armor grid bars
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(brick.x + 6, brick.y + brick.height / 2);
        ctx.lineTo(brick.x + brick.width - 6, brick.y + brick.height / 2);
        ctx.stroke();

        if (isDamaged) {
          // Cracks
          ctx.beginPath();
          ctx.moveTo(brick.x + 10, brick.y + 4);
          ctx.lineTo(brick.x + 18, brick.y + 15);
          ctx.lineTo(brick.x + 12, brick.y + 18);
          ctx.stroke();
        }
      } else if (brick.type === 'coin') {
        // Neon Dollar Coin Star Glyph
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.fillText('$', brick.x + brick.width / 2 - 3, brick.y + brick.height / 2 + 4);
      } else if (brick.type === 'explosive') {
        // Center hazard neon triangle core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const centerX = brick.x + brick.width / 2;
        const centerY = brick.y + brick.height / 2;
        ctx.moveTo(centerX, centerY - 5);
        ctx.lineTo(centerX - 5, centerY + 5);
        ctx.lineTo(centerX + 5, centerY + 5);
        ctx.closePath();
        ctx.fill();
      } else if (brick.type === 'gilded') {
        // Giant Boss crown glyph or text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`★ ${brick.hp}`, brick.x + brick.width / 2 - 12, brick.y + brick.height / 2 + 3);
      }

      ctx.restore();
    });
  };

  // Draw rounded support helper
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Ball dynamics & custom frame rebounds
  const renderAndPhysicsBalls = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const pad = paddleRef.current;
    
    // Manage state copy to prune lost elements out of bounds
    const survivedBalls: Ball[] = [];

    ballsRef.current.forEach((ball) => {
      // If attached to sticky paddle, replicate paddle offset
      if (ball.isStickyAttached) {
        ball.x = pad.x + pad.width / 2 + ball.stickyOffsetX;
        ball.y = pad.y - ball.radius;
        ball.vx = 0;
        ball.vy = 0;
      } else {
        // Standard drifting movement
        ball.x += ball.vx;
        ball.y += ball.vy;

        // --- 1. Hard Boundaries rebound checks ---
        // Left & Right Rebounds
        if (ball.x - ball.radius < 0) {
          ball.x = ball.radius;
          ball.vx = -ball.vx;
          soundEngine.playPaddleHit();
          spawnCollisionParticles(ball.x, ball.y, '#ffffff');
        } else if (ball.x + ball.radius > canvas.width) {
          ball.x = canvas.width - ball.radius;
          ball.vx = -ball.vx;
          soundEngine.playPaddleHit();
          spawnCollisionParticles(ball.x, ball.y, '#ffffff');
        }

        // Top Roof Rebounds
        if (ball.y - ball.radius < 0) {
          ball.y = ball.radius;
          ball.vy = -ball.vy;
          soundEngine.playPaddleHit();
          spawnCollisionParticles(ball.x, ball.y, '#ffffff');
        }

        // --- 2. Paddle Impact check ---
        const ballBottom = ball.y + ball.radius;
        if (
          ballBottom >= pad.y &&
          ball.y - ball.radius <= pad.y + pad.height &&
          ball.x + ball.radius >= pad.x &&
          ball.x - ball.radius <= pad.x + pad.width
        ) {
          // Adjust position above outer deck
          ball.y = pad.y - ball.radius;
          
          // Sticky Mode activation
          if (stickyTimerRef.current > 0 || ball.sticky) {
            ball.isStickyAttached = true;
            ball.stickyOffsetX = ball.x - (pad.x + pad.width / 2);
            soundEngine.playPaddleHit();
            return;
          }

          // Calculate bounce angle offset based on distance from center of paddle
          const paddleCenter = pad.x + pad.width / 2;
          const hitDist = ball.x - paddleCenter;
          const maxNormalized = pad.width / 2;
          const relativeNormalized = hitDist / maxNormalized; // -1 to +1 ratio

          // Deflect max 60 degrees sideways
          const maxAngle = Math.PI / 3; 
          const bounceAngle = relativeNormalized * maxAngle;

          ball.vx = ball.speed * Math.sin(bounceAngle);
          ball.vy = -ball.speed * Math.cos(bounceAngle);

          // Spawn gorgeous pink neon sparks
          spawnCollisionParticles(ball.x, ball.y, currentTheme.secondaryColor, 12);
          soundEngine.playPaddleHit();
        }
      }

      // Bricks collisions check per ball
      handleBallBrickCollisions(ball);

      // Prune if falls below screen limits
      if (ball.y - ball.radius < canvas.height + 20) {
        survivedBalls.push(ball);
      } else {
        // Spawn deep failure particles
        spawnCollisionParticles(ball.x, canvas.height - 2, '#ef4444', 18);
      }
    });

    ballsRef.current = survivedBalls;

    // Render survived balls
    ballsRef.current.forEach((ball) => {
      ctx.save();
      
      // Gorgeous hyper-glow trail
      ctx.shadowBlur = 18;
      ctx.shadowColor = currentTheme.primaryColor;
      ctx.fillStyle = '#ffffff';

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer orbital ring
      ctx.strokeStyle = currentTheme.secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius + 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    });

    // Check if player is completely out of balls
    if (ballsRef.current.length === 0 && gameState === 'PLAYING') {
      handleLostBallLife();
    }
  };

  // Collision matrix checking
  const handleBallBrickCollisions = (ball: Ball) => {
    let hitDetected = false;

    bricksRef.current = bricksRef.current.filter((brick) => {
      if (hitDetected) return true; // checks only one brick at a time to keep rebounds pristine

      // Standard AABB Axis collision intersection checks
      const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
      const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));

      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const squaredDist = dx * dx + dy * dy;

      if (squaredDist < ball.radius * ball.radius) {
        hitDetected = true;

        // Perform rebound physics vector flips
        const overlapX = ball.radius - Math.abs(dx);
        const overlapY = ball.radius - Math.abs(dy);

        if (dx !== 0 && (overlapX < overlapY || dy === 0)) {
          // Bounce side horizontal
          ball.vx = -ball.vx;
          ball.x += ball.vx * 0.4; // shift out of penetration
        } else {
          // Bounce vertical
          ball.vy = -ball.vy;
          ball.y += ball.vy * 0.4;
        }

        // Damage calculation
        const isExploded = triggerBrickImpact(brick);
        return !isExploded; // returns false to filter/destroy instantly upon zero health
      }

      return true;
    });
  };

  // Perform brick damage points & triggers
  const triggerBrickImpact = (brick: Brick): boolean => {
    // Standard impact
    brick.hp--;
    
    // Play SFX
    if (brick.type === 'coin') {
      soundEngine.playGoldBrickHit();
    } else {
      soundEngine.playBrickHit();
    }

    // Spawn rich neon fragments
    spawnCollisionParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 10);

    // If still retains health
    if (brick.hp > 0) {
      return false; // Not destroyed
    }

    // --- BRICK IS DESTROYED! ---
    // Double coin powerup calculations
    const doubleGold = doubleCoinsTimerRef.current > 0;
    
    let earnedCoins = 0;
    let earnedPoints = brick.points;

    // Specialized brick bonuses
    if (brick.type === 'coin') {
      earnedCoins = doubleGold ? 50 : 25;
      triggerScorePopup(brick.x, brick.y, `+${earnedCoins} COINS`, '#eab308');
    } else if (brick.type === 'armored') {
      earnedCoins = doubleGold ? 20 : 10;
      triggerScorePopup(brick.x, brick.y, `+${earnedCoins} CREDITS`, '#a855f7');
    } else if (brick.type === 'gilded') {
      earnedCoins = doubleGold ? 160 : 80;
      earnedPoints = 1200; // massive score
      triggerScorePopup(brick.x, brick.y, `+${earnedCoins} COINS BONUS!`, '#facc15');
      
      // Gilded guaranteed drops 3 split balls!
      spawnCascadingPowerups(brick.x + brick.width / 2, brick.y + brick.height, 'MULTI_BALL');
    } else {
      // Normal bricks sometimes give partial silver or points
      earnedCoins = doubleGold ? 6 : 3;
    }

    setCoins(prev => prev + earnedCoins);
    setScore(prev => prev + earnedPoints);

    // Check if is explosive type
    if (brick.type === 'explosive') {
      triggerChainExplosion(brick);
    }

    // Chance powerup pill spawn (14% chance on standard brick removals)
    if (brick.type !== 'gilded' && Math.random() < 0.15) {
      spawnCascadingPowerups(brick.x + brick.width / 2, brick.y + brick.height);
    }

    return true; // Is destroyed!
  };

  // Detonate adjacent grids
  const triggerChainExplosion = (source: Brick) => {
    soundEngine.playExplosion();
    
    const explosionRadius = 75; // reaches roughly 1.5 brick blocks away
    const centerX = source.x + source.width / 2;
    const centerY = source.y + source.height / 2;

    // Create huge blast effect on particles layer
    spawnCollisionParticles(centerX, centerY, '#ef4444', 35);

    // Identify bricks inside radius circle
    bricksRef.current = bricksRef.current.filter((bk) => {
      // Calculated mid distance
      const bmidX = bk.x + bk.width / 2;
      const bmidY = bk.y + bk.height / 2;
      const dist = Math.hypot(bmidX - centerX, bmidY - centerY);

      if (dist <= explosionRadius) {
        // Impact this brick with huge force damage
        bk.hp = 0; // instantly broken
        
        // Add credits
        const dCoins = doubleCoinsTimerRef.current > 0;
        setCoins(prev => prev + (dCoins ? 10 : 5));
        setScore(prev => prev + bk.points);
        spawnCollisionParticles(bmidX, bmidY, bk.color, 8);
        return false; // remove
      }
      return true;
    });
  };

  // Falling powerup pills
  const spawnCascadingPowerups = (x: number, y: number, forceType?: PowerUpType) => {
    const list: PowerUpType[] = ['WIDE_PADDLE', 'SLOW_BALL', 'LASER', 'DOUBLE_COINS', 'STICKY', 'EXTRA_LIFE', 'MULTI_BALL'];
    let selType = forceType || list[Math.floor(Math.random() * list.length)];

    // Colors matching type
    let color = '#39ff14'; // default
    if (selType === 'WIDE_PADDLE') color = '#06b6d4'; // teal
    if (selType === 'LASER') color = '#ef4444'; // red
    if (selType === 'DOUBLE_COINS') color = '#eab308'; // gold
    if (selType === 'EXTRA_LIFE') color = '#ec4899'; // pink
    if (selType === 'MULTI_BALL') color = '#a855f7'; // purple
    if (selType === 'STICKY') color = '#ffff00'; // neon white yellow

    powerUpsRef.current.push({
      id: Math.random().toString(),
      x,
      y,
      type: selType,
      color,
      speed: 2.2,
      radius: 11
    });
  };

  // Render & physics powerup capture checks
  const renderAndPhysicsPowerups = (ctx: CanvasRenderingContext2D) => {
    const pad = paddleRef.current;
    const activePowerups: PowerUp[] = [];

    powerUpsRef.current.forEach((pup) => {
      pup.y += pup.speed;

      // Contact checking with paddle deck
      const padYRadius = pad.y;
      if (
        pup.y + pup.radius >= padYRadius &&
        pup.y - pup.radius <= pad.y + pad.height &&
        pup.x + pup.radius >= pad.x &&
        pup.x - pup.radius <= pad.x + pad.width
      ) {
        // CAPTURED POWERUP!
        activatePowerupEffect(pup.type);
        soundEngine.playPowerUp();
        triggerScorePopup(pup.x, pad.y - 15, `${pup.type.replace('_', ' ')} ACCREDITED`, pup.color);
        spawnCollisionParticles(pup.x, pup.y, pup.color, 15);
      } else if (pup.y - pup.radius < ctx.canvas.height) {
        // Keep inside bounds
        activePowerups.push(pup);
      }
    });

    powerUpsRef.current = activePowerups;

    // Render powerup icons with glow bubbles
    powerUpsRef.current.forEach((pup) => {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = pup.color;

      // Pulse bubble
      ctx.fillStyle = pup.color;
      ctx.beginPath();
      ctx.arc(pup.x, pup.y, pup.radius, 0, Math.PI * 2);
      ctx.fill();

      // Core white accent details
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      let sym = '★';
      if (pup.type === 'WIDE_PADDLE') sym = '↔';
      if (pup.type === 'SLOW_BALL') sym = '▼';
      if (pup.type === 'LASER') sym = '▲';
      if (pup.type === 'DOUBLE_COINS') sym = '$$';
      if (pup.type === 'STICKY') sym = '●';
      if (pup.type === 'EXTRA_LIFE') sym = '♥';
      if (pup.type === 'MULTI_BALL') sym = '●3';

      ctx.fillText(sym, pup.x - 5, pup.y + 3);
      ctx.restore();
    });
  };

  // Active timers triggers
  const activatePowerupEffect = (type: PowerUpType) => {
    switch (type) {
      case 'WIDE_PADDLE':
        wideTimerRef.current = 10; // 10 secs
        paddleRef.current.width = 160;
        setActiveWideDuration(10);
        break;
      case 'SLOW_BALL':
        ballsRef.current.forEach(b => {
          b.vx *= 0.7;
          b.vy *= 0.7;
          b.speed *= 0.7;
        });
        break;
      case 'LASER':
        laserTimerRef.current = 12;
        setActiveLaserDuration(12);
        break;
      case 'DOUBLE_COINS':
        doubleCoinsTimerRef.current = 15;
        setActiveDoubleCoinsDuration(15);
        break;
      case 'STICKY':
        stickyTimerRef.current = 15;
        setActiveStickyDuration(15);
        break;
      case 'EXTRA_LIFE':
        setLives(prev => Math.min(5, prev + 1));
        break;
      case 'MULTI_BALL':
        // Multiply each existing ball into two additional opposing paths
        const currentBalls = [...ballsRef.current];
        currentBalls.forEach((b) => {
          // Additional ball A
          ballsRef.current.push({
            x: b.x,
            y: b.y,
            vx: b.vx * Math.cos(45) - b.vy * Math.sin(45),
            vy: b.vx * Math.sin(45) + b.vy * Math.cos(45),
            radius: b.radius,
            speed: b.speed,
            sticky: false,
            isStickyAttached: false,
            stickyOffsetX: 0
          });
          // Additional ball B
          ballsRef.current.push({
            x: b.x,
            y: b.y,
            vx: b.vx * Math.cos(-45) - b.vy * Math.sin(-45),
            vy: b.vx * Math.sin(-45) + b.vy * Math.cos(-45),
            radius: b.radius,
            speed: b.speed,
            sticky: false,
            isStickyAttached: false,
            stickyOffsetX: 0
          });
        });
        break;
    }
  };

  // Particle bursts generators
  const spawnCollisionParticles = (x: number, y: number, color: string, qty: number = 8) => {
    for (let i = 0; i < qty; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocityScale = 1 + Math.random() * 4;
      
      particlesRef.current.push({
        id: Math.random().toString(),
        x,
        y,
        vx: Math.cos(angle) * velocityScale,
        vy: Math.sin(angle) * velocityScale - (Math.random() * 1.5), // slightly upwards bias
        color,
        size: 1.5 + Math.random() * 3,
        alpha: 1.0,
        life: 0,
        maxLife: 30 + Math.random() * 35
      });
    }
  };

  // Render particle cascades
  const renderParticles = (ctx: CanvasRenderingContext2D) => {
    const survived: Particle[] = [];

    particlesRef.current.forEach((part) => {
      part.life++;
      part.x += part.vx;
      part.y += part.vy;
      // Gravity drag
      part.vy += 0.04;
      part.alpha = 1.0 - part.life / part.maxLife;

      if (part.life < part.maxLife) {
        survived.push(part);
        
        ctx.save();
        ctx.globalAlpha = part.alpha;
        ctx.shadowBlur = 6;
        ctx.shadowColor = part.color;
        ctx.fillStyle = part.color;

        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    particlesRef.current = survived;
  };

  // Laser bolt updates & bricks contact checking
  const renderAndPhysicsLasers = (ctx: CanvasRenderingContext2D) => {
    const remainingBolts: LaserBolt[] = [];

    laserBoltsRef.current.forEach((bolt) => {
      bolt.y += bolt.vy; // shift up

      let hit = false;
      // Check collision with bricks
      bricksRef.current = bricksRef.current.filter((bk) => {
        if (hit) return true;

        if (
          bolt.x >= bk.x &&
          bolt.x <= bk.x + bk.width &&
          bolt.y >= bk.y &&
          bolt.y <= bk.y + bk.height
        ) {
          hit = true;
          // Trigger impact
          triggerBrickImpact(bk);
          return bk.hp > 0; // standard removal if broken
        }
        return true;
      });

      if (!hit && bolt.y > 0) {
        remainingBolts.push(bolt);
      }
    });

    laserBoltsRef.current = remainingBolts;

    // Drawing laser bolts
    laserBoltsRef.current.forEach((bolt) => {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';

      ctx.beginPath();
      ctx.moveTo(bolt.x, bolt.y);
      ctx.lineTo(bolt.x, bolt.y + 12);
      ctx.stroke();

      ctx.restore();
    });
  };

  // Render skin styled paddle
  const renderPaddle = (ctx: CanvasRenderingContext2D) => {
    const pad = paddleRef.current;
    ctx.save();

    // Laser accessory glow
    const laserActive = laserTimerRef.current > 0;

    ctx.shadowBlur = 16;
    ctx.shadowColor = currentSkin.color;
    
    // Gradient fill representing sunset deck or golden aurum
    const colors = currentSkin.id === 'hyper_rainbow' 
      ? ['#ff00ff', '#00ffff', '#00ff00', '#ffd700', '#ff00ff']
      : [currentSkin.color, currentSkin.stripeColor, currentSkin.color];

    const pGrad = ctx.createLinearGradient(pad.x, pad.y, pad.x + pad.width, pad.y);
    colors.forEach((col, i) => {
      pGrad.addColorStop(i / (colors.length - 1), col);
    });

    ctx.fillStyle = pGrad;
    drawRoundedRect(ctx, pad.x, pad.y, pad.width, pad.height, 8);
    ctx.fill();

    // Inner glowing core accent bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(pad.x + 8, pad.y + 3, pad.width - 16, 2.5);

    // Laser nozzles indicators
    if (laserActive) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ef4444';
      // Left and right turrets
      ctx.fillRect(pad.x + 2, pad.y - 6, 6, 6);
      ctx.fillRect(pad.x + pad.width - 8, pad.y - 6, 6, 6);
    }

    ctx.restore();
  };

  // Render floating score popup indicators
  const renderScorePopups = (ctx: CanvasRenderingContext2D) => {
    const activePopups: any[] = [];

    scorePopupsRef.current.forEach((pop) => {
      pop.y -= 0.85; // slide up slowly
      pop.life -= 0.02; // fade out

      if (pop.life > 0) {
        activePopups.push(pop);

        ctx.save();
        ctx.globalAlpha = pop.life;
        ctx.font = 'black 10px monospace';
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }
    });

    scorePopupsRef.current = activePopups;
  };

  // Determine win thresholds
  const checkLevelStatus = () => {
    // Only breakable bricks remaining are normal/armored/coin/gilded
    const breakables = bricksRef.current.filter((b) => b.type !== 'explosive');
    
    if (breakables.length === 0 && gameState === 'PLAYING') {
      handleVictoryLevel();
    }
  };

  // Desktop Pointer actions
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPointerActiveRef.current = true;
    updatePointerCoords(e);

    // Click triggers sticky launching or laser bullet fires!
    const attached = ballsRef.current.some(b => b.isStickyAttached);
    if (attached) {
      launchActiveBalls();
    } else if (laserTimerRef.current > 0) {
      fireLaserBolts();
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPointerActiveRef.current) {
      updatePointerCoords(e);
    }
  };

  const updatePointerCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Translate client coordinates relative to physical scale size
    const clientX = e.clientX - rect.left;
    pointerXRef.current = (clientX / rect.width) * canvas.width;
  };

  // Mobile Touch drag actions suitable for simulated Android touch inputs
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    isPointerActiveRef.current = true;
    updateTouchCoords(e);

    // Click triggers sticky launching or laser bullet fires!
    const attached = ballsRef.current.some(b => b.isStickyAttached);
    if (attached) {
      launchActiveBalls();
    } else if (laserTimerRef.current > 0) {
      fireLaserBolts();
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isPointerActiveRef.current) {
      updateTouchCoords(e);
    }
  };

  const updateTouchCoords = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches[0].clientX - rect.left;
    pointerXRef.current = (clientX / rect.width) * canvas.width;
  };

  return (
    <div id="immersive-dashboard-root" className="min-h-screen w-full bg-[#050112] text-white flex flex-col justify-center items-center py-1 md:py-4 px-1 md:px-2 overflow-x-hidden font-sans select-none relative">
      
      {/* 1. Neon background cyber matrix grid */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#200843_0%,#050112_100%)] opacity-85"></div>
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'linear-gradient(#1e1e40 1px, transparent 1px), linear-gradient(90deg, #1e1e40 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          transform: 'perspective(450px) rotateX(60deg) translateY(-140px)',
          opacity: 0.17
        }}></div>
      </div>

      {/* Main Arcade Frame Wrapper styled identically to "Immersive UI" */}
      <div 
        ref={containerRef}
        id="arcade-cabinet-dashboard"
        className="w-full max-w-[1024px] h-auto lg:h-[768px] min-h-[95vh] lg:min-h-0 rounded-2xl md:rounded-3xl overflow-hidden bg-slate-950/80 border border-purple-900/40 backdrop-blur-md relative z-10 flex flex-col shadow-[0_0_80px_rgba(168,85,247,0.12)]"
      >
        {/* --- DYNAMIC CUSTOM THEME ALERTS OR FLASHING BACKGROUND --- */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-15" style={{ boxShadow: `inset 0 0 100px ${currentTheme.glowColor}` }} />

        {/* ------------------------------------------------------------------
            TOP HUD HEADER
            ------------------------------------------------------------------ */}
        {!(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <div className="relative z-15 p-2.5 sm:p-4 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 border-b border-purple-900/50 bg-black/50 backdrop-blur-md">
            {/* Left indicators: Level & High Score counts */}
            <div className="flex gap-4 sm:gap-6 items-center">
              <div>
                <div className="text-[8.5px] uppercase tracking-widest text-cyan-400 font-bold mb-0.5">Level</div>
                <div className="text-lg sm:text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(62,211,238,0.7)]">
                  {(levelIndex + 1).toString().padStart(2, '0')}{' '}
                  <span className="text-[10px] sm:text-xs text-purple-400 font-normal">/ 08</span>
                </div>
              </div>
              <div>
                <div className="text-[8.5px] uppercase tracking-widest text-pink-500 font-bold mb-0.5">Score</div>
                <div className="text-lg sm:text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.7)]">
                  {score.toLocaleString().padStart(7, '0')}
                </div>
              </div>
            </div>

            {/* Core Applet Title */}
            <div className="text-center py-1 sm:py-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-pink-500 italic uppercase drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]">
                NEON BREAKER
              </h1>
              <div className="mt-0.5 flex justify-center">
                <span className="inline-flex items-center gap-1 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold text-cyan-400 font-mono tracking-widest uppercase shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                  <span className="w-1.2 h-1.2 rounded-full bg-cyan-400 animate-ping" />
                  SYNTHWAVE CYBER EDITION
                </span>
              </div>
            </div>

            {/* Right indicators: Coins count, Audio Toggle, Pause Switch */}
            <div className="flex gap-4 sm:gap-6 items-center justify-between w-full sm:w-auto">
              <div className="text-left sm:text-right">
                <div className="text-[8.5px] uppercase tracking-widest text-yellow-500 font-bold mb-0.5">Credits / Coins</div>
                <div className="flex items-center sm:justify-end gap-1.5">
                  <div className="text-lg sm:text-xl font-black text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]">
                    {coins.toLocaleString()}
                  </div>
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15] animate-pulse"></div>
                </div>
              </div>

              <div className="flex gap-1.5 sm:gap-2">
                {/* Sound toggle button */}
                <button 
                  onClick={handleToggleVolume}
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-purple-500/30 rounded-lg bg-purple-950/20 text-purple-400 hover:text-white hover:border-purple-500 transition-all cursor-pointer box-border"
                  title={isMuted ? "Unmute Retro Synth tracks" : "Mute Sound synthesizer"}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
                </button>

                {/* Pause / Resume trigger button */}
                {gameState === 'PLAYING' && (
                  <button 
                    onClick={() => { soundEngine.playPaddleHit(); setGameState('PAUSED'); }}
                    className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-cyan-400/40 rounded-lg bg-cyan-950/20 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all cursor-pointer"
                    title="Pause game"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            MAIN ARCADE MIDDLE FIELD GRID
            ------------------------------------------------------------------ */}
        <div className="flex-1 min-h-0 relative z-10 flex flex-col lg:flex-row p-2 sm:p-4 gap-2.5 sm:gap-4 bg-zinc-950/40">
          
          {/* Left Sidebar: Active Power-Ups timers panel */}
          <div id="left-hud-sidebar" className="hidden lg:flex w-24 flex-col gap-3 select-none">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-1 text-center">
              DRIVES
            </div>

            {/* Shield / Wide active indicator */}
            <div className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
              activeWideDuration > 0 
                ? 'border-cyan-500/60 bg-cyan-950/25 shadow-[0_0_10px_rgba(6,182,212,0.15)] animate-pulse' 
                : 'border-slate-800 bg-slate-900/10 grayscale opacity-30'
            }`}>
              <div className="text-[8px] text-cyan-400 uppercase font-black">Wide Deck</div>
              <div className="w-8 h-8 rounded-full border border-cyan-500 flex items-center justify-center text-cyan-400">
                <span className="text-xs font-bold leading-none">{activeWideDuration > 0 ? `${activeWideDuration}s` : 'OFF'}</span>
              </div>
              <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all duration-300" 
                  style={{ width: `${activeWideDuration ? (activeWideDuration / 10) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Laser Active indicator */}
            <div className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
              activeLaserDuration > 0 
                ? 'border-red-500/60 bg-red-950/25 shadow-[0_0_10px_rgba(239,68,68,0.15)] animate-pulse' 
                : 'border-slate-800 bg-slate-900/10 grayscale opacity-30'
            }`}>
              <div className="text-[8px] text-red-500 uppercase font-black">Lasers</div>
              <div className="w-8 h-8 rounded-full border border-red-500 flex items-center justify-center text-red-400">
                <span className="text-xs font-bold leading-none">{activeLaserDuration > 0 ? `${activeLaserDuration}s` : 'OFF'}</span>
              </div>
              <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 transition-all duration-300" 
                  style={{ width: `${activeLaserDuration ? (activeLaserDuration / 12) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Double Coins indicator */}
            <div className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
              activeDoubleCoinsDuration > 0 
                ? 'border-yellow-500/60 bg-yellow-950/25 shadow-[0_0_10px_rgba(234,179,8,0.15)] animate-pulse' 
                : 'border-slate-800 bg-slate-900/10 grayscale opacity-30'
            }`}>
              <div className="text-[8px] text-yellow-500 uppercase font-black">Double $</div>
              <div className="w-8 h-8 rounded-full border border-yellow-500 flex items-center justify-center text-yellow-400">
                <span className="text-xs font-bold leading-none">{activeDoubleCoinsDuration > 0 ? `${activeDoubleCoinsDuration}s` : 'OFF'}</span>
              </div>
              <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-300" 
                  style={{ width: `${activeDoubleCoinsDuration ? (activeDoubleCoinsDuration / 15) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Sticky indicator */}
            <div className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
              activeStickyDuration > 0 
                ? 'border-green-500/60 bg-green-950/25 shadow-[0_0_10px_rgba(34,197,94,0.15)] animate-pulse' 
                : 'border-slate-800 bg-slate-900/10 grayscale opacity-30'
            }`}>
              <div className="text-[8px] text-green-500 uppercase font-black">Sticky</div>
              <div className="w-8 h-8 rounded-full border border-green-500 flex items-center justify-center text-green-400">
                <span className="text-xs font-bold leading-none">{activeStickyDuration > 0 ? `${activeStickyDuration}s` : 'OFF'}</span>
              </div>
              <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300" 
                  style={{ width: `${activeStickyDuration ? (activeStickyDuration / 15) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Center Column: Interactive Canvas Screen wrapped inside the beautiful cage */}
          <div className="flex-1 bg-black/60 rounded-[20px] sm:rounded-[28px] border-2 border-purple-500/20 relative overflow-hidden shadow-[inset_0_0_30px_rgba(168,85,247,0.15)] flex flex-col aspect-[660/520] lg:aspect-auto">
            
            {/* Elegant Transparent HUD Overlay (Top & Bottom of Game Screen) */}
            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <>
                {/* Top-Left: LEVEL indicator (completely transparent background & borderless) */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex flex-col pointer-events-none select-none text-left">
                  <span className="text-[7.5px] uppercase tracking-[0.2em] text-cyan-400 font-extrabold font-mono drop-shadow-[0_0_3px_rgba(34,211,238,0.4)]">Level</span>
                  <span className="text-sm sm:text-lg font-black text-cyan-200 tracking-tighter leading-none mt-0.5">
                    {(levelIndex + 1).toString().padStart(2, '0')}{' '}
                    <span className="text-[9px] text-purple-400/80 font-normal">/ 08</span>
                  </span>
                </div>

                {/* Top-Right: CREDITS / COINS tracker (completely transparent background & borderless) */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col items-end pointer-events-none select-none text-right">
                  <span className="text-[7.5px] uppercase tracking-[0.2em] text-yellow-500 font-extrabold font-mono drop-shadow-[0_0_3px_rgba(234,179,8,0.4)]">Credits</span>
                  <div className="flex items-center gap-1.5 mt-0.5 leading-none">
                    <span className="text-sm sm:text-lg font-black text-yellow-300 font-mono drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]">
                      {coins}
                    </span>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_6px_#facc15] animate-pulse shrink-0"></div>
                  </div>
                </div>

                {/* Bottom-Left: SCORE indicator (completely transparent background & borderless) */}
                <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 flex flex-col pointer-events-none select-none text-left">
                  <span className="text-[7.5px] uppercase tracking-[0.2em] text-pink-500 font-extrabold font-mono drop-shadow-[0_0_3px_rgba(236,72,153,0.4)]">Score</span>
                  <span className="text-sm sm:text-lg font-black text-pink-400 font-mono tracking-wider leading-none mt-0.5">
                    {score.toLocaleString().padStart(7, '0')}
                  </span>
                </div>

                {/* Bottom-Right: HULL INTEGRITY/HEARTS indicator (completely transparent background & borderless) */}
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex flex-col items-end pointer-events-none select-none text-right">
                  <span className="text-[7.5px] uppercase tracking-[0.2em] text-purple-400 font-extrabold font-mono mb-1 leading-none drop-shadow-[0_0_3px_rgba(168,85,247,0.4)]">Hull Integrity</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Heart 
                        key={i} 
                        className={`w-3.5 h-3.5 sm:w-4 transition-all ${
                          i < lives 
                            ? 'text-pink-500 fill-pink-500 drop-shadow-[0_0_4px_rgba(236,72,153,0.7)] animate-pulse' 
                            : 'text-slate-950/40 opacity-20'
                        }`} 
                      />
                    ))}
                  </div>
                </div>

                {/* Highly tactile Interactive Control buttons bar (top middle console) */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-25 flex gap-2 sm:gap-3 pointer-events-auto items-center justify-center">
                  
                  {/* Shop Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEngine.playPaddleHit();
                      setShopOpen(true);
                    }}
                    className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-b from-purple-900/40 via-purple-950/60 to-black/80 border-2 border-purple-500/60 hover:border-purple-300 text-purple-200 hover:text-white transition-all active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.45)] active:bg-purple-500 active:text-black hover:shadow-[0_0_22px_#a855f7] flex flex-col items-center justify-center relative group"
                    title="Access Upgrades Shop"
                  >
                    <div className="absolute inset-0 rounded-xl bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <ShoppingBag className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 drop-shadow-[0_0_4px_#a855f7] group-active:text-black" />
                    <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-wider uppercase font-mono mt-0.5 text-purple-300 group-hover:text-purple-100 group-active:text-black">SHOP</span>
                  </button>

                  {/* Fast audio synthesizer mute toggler */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVolume();
                    }}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-b from-purple-900/30 via-purple-950/60 to-black/80 border-2 ${isMuted ? 'border-red-500/60 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.45)] hover:shadow-[0_0_22px_#ef4444]' : 'border-cyan-400/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.45)] hover:shadow-[0_0_22px_#22d3ee]'} hover:border-white transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center relative group`}
                    title={isMuted ? "Unmute Retro Synth" : "Mute Sound synth"}
                  >
                    <div className="absolute inset-0 rounded-xl bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isMuted ? (
                      <VolumeX className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 drop-shadow-[0_0_4px_#ef4444] animate-pulse" />
                    ) : (
                      <Volume2 className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 drop-shadow-[0_0_4px_#22d3ee]" />
                    )}
                    <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-wider uppercase font-mono mt-0.5 group-hover:text-cyan-100">
                      {isMuted ? "MUTED" : "SOUNDS"}
                    </span>
                  </button>

                  {/* Play/Pause Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEngine.playPaddleHit();
                      if (gameState === 'PLAYING') {
                        setGameState('PAUSED');
                      } else {
                        setGameState('PLAYING');
                      }
                    }}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-b from-purple-900/30 via-purple-950/60 to-black/80 border-2 ${gameState === 'PAUSED' ? 'border-green-400/80 text-green-300 animate-pulse shadow-[0_0_15px_rgba(74,222,128,0.45)] hover:shadow-[0_0_22px_#4ade80]' : 'border-yellow-400/80 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.45)] hover:shadow-[0_0_22px_#facc15]'} hover:border-white transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center relative group`}
                    title={gameState === 'PAUSED' ? "Resume Run Cores" : "Pause Run Cores"}
                  >
                    <div className="absolute inset-0 rounded-xl bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {gameState === 'PAUSED' ? (
                      <Play className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 drop-shadow-[0_0_4px_#4ade80]" />
                    ) : (
                      <Pause className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 drop-shadow-[0_0_4px_#facc15]" />
                    )}
                    <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-wider uppercase font-mono mt-0.5 group-hover:text-yellow-105">
                      {gameState === 'PAUSED' ? "PLAY" : "PAUSE"}
                    </span>
                  </button>

                  {/* Clean Home Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEngine.playPaddleHit();
                      setGameState('MENU');
                    }}
                    className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-b from-purple-900/30 via-purple-950/60 to-black/80 border-2 border-rose-500/60 hover:border-rose-300 text-rose-300 hover:text-white transition-all active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.45)] hover:shadow-[0_0_22px_#f43f5e] flex flex-col items-center justify-center relative group"
                    title="Exit run to splash screen"
                  >
                    <div className="absolute inset-0 rounded-xl bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Home className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 drop-shadow-[0_0_4px_#f43f5e]" />
                    <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-wider uppercase font-mono mt-0.5 text-rose-400 group-hover:text-rose-100">HOME</span>
                  </button>
                </div>
              </>
            )}

            {/* Real Canvas element */}
            <canvas
              ref={canvasRef}
              id="game-physics-canvas"
              width={660}
              height={520}
              onMouseMove={handlePointerMove}
              onMouseDown={handlePointerDown}
              onTouchMove={handleTouchMove}
              onTouchStart={handleTouchStart}
              onMouseLeave={() => { isPointerActiveRef.current = false; }}
              onTouchEnd={() => { isPointerActiveRef.current = false; }}
              className="w-full h-full block cursor-none"
            />

            {/* Canvas overlay alerts & screens based on Game State */}
            <AnimatePresence mode="wait">              {/* MENU SCREEN */}
              {gameState === 'MENU' && (
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="absolute inset-0 bg-black/40 backdrop-blur-[6px] flex flex-col items-center justify-center p-6 text-center select-none"
                >
                  <Cpu className="w-12 h-12 text-pink-500 animate-spin mb-3 drop-shadow-[0_0_15px_#ec4899]" />
                  
                  <h2 className="text-3xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.4)] mb-2 uppercase bg-transparent">
                    Select Launch Action
                  </h2>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    Control your laser-deck paddle to bounce glowing cosmic plasma balls. Break armored bricks, trigger explosive chains, collect power-up boosters, and acquire coin credits!
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    {savedRunExists && (
                      <button
                        onClick={startResumeSession}
                        className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition hover:scale-105 cursor-pointer"
                      >
                        <BookmarkCheck className="w-4 h-4 animate-bounce" /> RESUME CORES
                      </button>
                    )}

                    <button
                      onClick={startNewSession}
                      className="px-6 py-3 rounded-xl bg-purple-600 border border-purple-500 text-white font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:bg-purple-500 transition hover:scale-105 cursor-pointer"
                    >
                      <Play className="w-4 h-4" /> START NEW RUN
                    </button>
                  </div>

                  {/* Android touch notice */}
                  <div className="mt-8 flex items-center gap-2 justify-center py-1.5 px-3 rounded-full border border-purple-900/40 bg-purple-950/20 text-purple-400 text-[10px] tracking-wide">
                    <Smartphone className="w-3.5 h-3.5" /> TOUCH / DRAG PADDLE TO BEGIN
                  </div>
                </motion.div>
              )}

              {/* PAUSED OVERLAY */}
              {gameState === 'PAUSED' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/45 backdrop-blur-[6px] flex flex-col items-center justify-center p-4 text-center select-none"
                >
                  <Pause className="w-12 h-12 text-cyan-400 animate-pulse mb-3" />
                  <h3 className="text-2xl font-black italic tracking-widest text-cyan-400 uppercase bg-transparent">RUN PAUSED</h3>
                  <p className="text-xs text-slate-400 mb-6 max-w-xs">
                    Progress auto-synced to index memory safe. You can securely close this tab and resume later!
                  </p>

                  <div className="flex gap-4">
                    <button
                      onClick={() => { soundEngine.playPaddleHit(); setGameState('PLAYING'); }}
                      className="px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-extrabold text-xs tracking-wider uppercase hover:bg-cyan-400 transition"
                    >
                      RESUME RUN
                    </button>
                    <button
                      onClick={() => { soundEngine.playPaddleHit(); setGameState('MENU'); }}
                      className="px-5 py-2.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs tracking-wider uppercase hover:bg-slate-700 transition"
                    >
                      MAIN MENU
                    </button>
                  </div>
                </motion.div>
              )}

              {/* LEVEL COMPLETION OVERLAY */}
              {gameState === 'LEVEL_COMPLETE' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/45 backdrop-blur-[6px] flex flex-col items-center justify-center p-6 text-center select-none"
                >
                  <Sparkles className="w-12 h-12 text-yellow-400 mb-2 animate-bounce drop-shadow-[0_0_10px_#facc15]" />
                  <div className="text-[10px] text-yellow-400 uppercase tracking-widest font-black">STRIKE MATRIX CLEAR</div>
                  
                  <h3 className="text-2xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-500 to-cyan-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)] mb-4 uppercase bg-transparent">
                    Level {(levelIndex).toString().padStart(2, '0')} Complete!
                  </h3>

                  <p className="text-[11px] text-slate-300 max-w-xs mb-6">
                    Awesome strike! Advanced cyber coordinates loaded. Ball velocities increased by 8% to test your fast twitch reflex!
                  </p>

                  <button
                    onClick={() => {
                      setGameState('PLAYING');
                      prepareLevel(levelIndex);
                    }}
                    className="px-6 py-3 rounded-xl bg-pink-500 hover:bg-pink-400 text-black font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(236,72,153,0.3)] transition"
                  >
                    CONTINUE NEXT LEVEL <Play className="w-3.5 h-3.5 fill-black" />
                  </button>
                </motion.div>
              )}

              {/* VICTORY OVERLAY */}
              {gameState === 'VICTORY' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-[7px] flex flex-col items-center justify-center p-6 text-center select-none"
                >
                  <Sparkles className="w-16 h-16 text-yellow-400 animate-spin mb-4" />
                  <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 drop-shadow-[0_0_12px_rgba(251,191,36,0.3)] uppercase mb-2 bg-transparent">
                    GRAND CHAMPION
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
                    Incredible! You have conquered all procedural levels of the Retro Neon Breaker grid and secured your place on the top lists!
                  </p>
                  
                  <div className="p-3 bg-transparent border border-purple-500/25 rounded-xl mb-6 flex gap-6 text-left shadow-[0_0_12px_rgba(168,85,247,0.1)]">
                    <div>
                      <div className="text-[9px] text-slate-400">FINAL SCORE</div>
                      <div className="text-xl font-bold text-pink-500">{score.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">TOTAL COINS REBUILT</div>
                      <div className="text-xl font-bold text-yellow-400">{coins.toLocaleString()}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => setGameState('MENU')}
                    className="px-5 py-2.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-black font-black uppercase text-xs tracking-wider transition"
                  >
                    RETURN PLAYROOM
                  </button>
                </motion.div>
              )}

              {/* GAME OVER OVERLAY */}
              {gameState === 'GAMEOVER' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-[7px] flex flex-col items-center justify-center p-6 text-center select-none"
                >
                  <div className="w-14 h-14 rounded-full border border-red-500 flex items-center justify-center text-red-500 animate-pulse mb-3 text-2xl font-black">
                    !
                  </div>
                  <h3 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 uppercase mb-2 bg-transparent">
                    DECK TERMINATED
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-6">
                    All neural life reservoirs drained! Spend your harvested coins in the shop to unlocked new unique paddle skins and visual themes.
                  </p>

                  <div className="mb-6 flex gap-6 text-left bg-transparent p-3 rounded-lg border border-pink-500/25 shadow-[0_0_12px_rgba(236,72,153,0.1)]">
                    <div>
                      <div className="text-[9px] text-slate-400">FINAL SCORE</div>
                      <div className="text-lg font-bold text-slate-200">{score}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">COINS HARVESTED</div>
                      <div className="text-lg font-bold text-yellow-400">{coins}</div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={startNewSession}
                      className="px-6 py-2.5 rounded-xl bg-purple-600 border border-purple-500 text-white font-black text-xs uppercase tracking-wider hover:bg-purple-500 transition"
                    >
                      RESTART TEST
                    </button>
                    <button
                      onClick={() => setShopOpen(true)}
                      className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-4 h-4" /> VISIT SHOP
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tap or release notice during sticky simulation on Active canvas */}
            {gameState === 'PLAYING' && ballsRef.current.some(b => b.isStickyAttached) && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse pb-5 uppercase tracking-widest font-black text-xs text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400 drop-shadow-[0_0_10px_#06b6d4]">
                TAP SCREEN or SPACE TO REBOUND
              </div>
            )}
          </div>

          {/* Right Sidebar: Shop Trigger & Save State HUD Indicators */}
          <div id="right-hud-sidebar" className="hidden lg:flex w-56 flex-col gap-4 select-none">
            
            {/* Lifelines panel */}
            <div id="lives-panel" className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3.5 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">HULL POWER / LIVES</span>
                <span className="text-xs font-bold text-pink-500">{lives} / 5</span>
              </div>
              
              <div className="flex gap-2 items-center justify-center py-1 bg-slate-950/60 rounded-lg border border-slate-900">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Heart 
                    key={i} 
                    className={`w-4 h-4 transition-all ${
                      i < lives 
                        ? 'text-pink-500 fill-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)] scale-110' 
                        : 'text-slate-800 opacity-20'
                    }`} 
                  />
                ))}
              </div>
            </div>

            {/* Interactive Shop Miniature trigger widget */}
            <div id="quick-store-widget" className="flex-1 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 p-4 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-pink-500 animate-pulse" /> SKIN STORE
                </h3>
                <span className="text-[8px] bg-cyan-400/20 text-cyan-400 px-1.5 py-0.5 rounded font-mono font-medium border border-cyan-500/20">HOT</span>
              </div>

              {/* 3 mini items previewed inside sidebar */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                <div className="p-2 rounded-lg bg-white/5 border border-cyan-500/30 flex items-center gap-2">
                  <div className="w-6 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></div>
                  <div className="flex-1">
                    <div className="text-[9px] font-bold text-slate-200">Magenta Cyber</div>
                    <div className="text-[8px] text-gray-500">Unlocked</div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white/5 border border-transparent flex items-center gap-2 opacity-75">
                  <div className="w-6 h-1.5 rounded-full bg-green-400"></div>
                  <div className="flex-1">
                    <div className="text-[9px] font-semibold text-slate-300">Toxic Acid</div>
                    <div className="text-[8px] text-yellow-500 font-mono">150 Cr</div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white/5 border border-transparent flex items-center gap-2 opacity-50">
                  <div className="w-6 h-1.5 rounded-full bg-amber-400"></div>
                  <div className="flex-1">
                    <div className="text-[9px] font-semibold text-slate-300">Retro Sunset</div>
                    <div className="text-[8px] text-yellow-500 font-mono">600 Cr</div>
                  </div>
                </div>
              </div>

              {/* Grand Full Shop launch trigger */}
              <button 
                onClick={() => { soundEngine.playPaddleHit(); setShopOpen(true); }}
                className="mt-3 w-full py-2.5 bg-purple-600/20 border border-purple-500/40 rounded-xl text-[9px] font-black uppercase tracking-widest font-mono text-purple-300 hover:bg-purple-600 hover:text-white transition shadow-lg shrink-0 cursor-pointer"
              >
                OPEN GEAR SHOP
              </button>
            </div>

            {/* Save State Blinking Synchronized status bar */}
            <div id="sync-container" className="bg-purple-900/10 border border-purple-500/20 p-3.5 rounded-2xl flex items-center gap-2.5 shadow-[inset_0_0_10px_rgba(168,85,247,0.05)]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></div>
              <div className="flex-1">
                <div className="text-[9px] font-black uppercase tracking-tight text-slate-200">
                  {saveIndicatorText}
                </div>
                <div className="text-[8px] text-slate-400 font-mono">
                  {saveIndicatorTime}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------
            BOTTOM CONTROLS / FOOTER
            ------------------------------------------------------------------ */}
        <div className="relative z-10 p-2.5 sm:p-3 bg-black/70 border-t border-purple-900/30 flex flex-col sm:flex-row justify-between items-center px-4 md:px-10 gap-2 sm:gap-0">
          
          {/* Dynamic Frequency beats animation to mimic dynamic real-time Retrowave synthesizers */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-[9px] text-slate-500 uppercase font-black">Synthesizer Level</div>
            <div className="flex gap-0.5 items-end h-3">
              <div className="w-1 h-2 bg-pink-500 animate-pulse"></div>
              <div className="w-1 h-3 bg-pink-500" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1 h-1.5 bg-pink-500 animate-pulse"></div>
              <div className="w-1 h-2.5 bg-pink-500" style={{ animationDelay: '300ms' }}></div>
              <div className="w-1 h-3.5 bg-pink-500"></div>
            </div>
            <div className="text-[9px] font-bold text-pink-400 font-mono">
              RETROWAVE_DRIVE.SYNTH
            </div>
          </div>

          <div className="text-[8px] sm:text-[8.5px] text-zinc-500 uppercase font-bold tracking-[0.2em] sm:tracking-[0.25em] font-mono text-center">
            ENGINE BUILT FOR NEOMOBILE v2.4
          </div>

          {/* Quick instructions / Info modal toggle trigger */}
          <div className="flex gap-2 sm:gap-3 text-[8px] sm:text-[9px] font-semibold text-slate-400 scale-95 sm:scale-100">
            <div className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-slate-900 border border-slate-800">
              <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400 animate-bounce" /> Drag or Click to launch
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-slate-900 border border-slate-800">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} /> Level scales
            </div>
          </div>
        </div>

        {/* --- FULL COIN & SKINS SHOP MODAL CANVAS --- */}
        <AnimatePresence>
          {shopOpen && (
            <GameShop 
              coins={coins}
              unlockedSkins={unlockedSkins}
              unlockedThemes={unlockedThemes}
              selectedSkinId={selectedSkinId}
              selectedThemeId={selectedThemeId}
              onUnlockSkin={handleUnlockSkin}
              onSelectSkin={handleSelectSkin}
              onUnlockTheme={handleUnlockTheme}
              onSelectTheme={handleSelectTheme}
              onClose={() => setShopOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
