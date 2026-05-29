import React, { useState, useEffect, useRef } from 'react';
import { PaddleSkin, VisualTheme } from '../types';
import { PADDLE_SKINS, VISUAL_THEMES } from './ThemeStyles';
import { soundEngine } from './SoundEngine';
import { Coins, Lock, ShoppingBag, Sparkles, ChevronLeft, Check, Palette, Eye, Play, Sparkle } from 'lucide-react';
import { motion } from 'motion/react';

interface GameShopProps {
  coins: number;
  unlockedSkins: string[];
  unlockedThemes: string[];
  selectedSkinId: string;
  selectedThemeId: string;
  onUnlockSkin: (skinId: string, cost: number) => void;
  onSelectSkin: (skinId: string) => void;
  onUnlockTheme: (themeId: string, cost: number) => void;
  onSelectTheme: (themeId: string) => void;
  onClose: () => void;
}

export default function GameShop({
  coins,
  unlockedSkins,
  unlockedThemes,
  selectedSkinId,
  selectedThemeId,
  onUnlockSkin,
  onSelectSkin,
  onUnlockTheme,
  onSelectTheme,
  onClose
}: GameShopProps) {
  // Preview State (allows looking at skins/themes before purchasing)
  const [previewSkinId, setPreviewSkinId] = useState<string>(selectedSkinId);
  const [previewThemeId, setPreviewThemeId] = useState<string>(selectedThemeId);

  // Lookups
  const previewSkin = PADDLE_SKINS.find(s => s.id === previewSkinId) || PADDLE_SKINS[0];
  const previewTheme = VISUAL_THEMES.find(t => t.id === previewThemeId) || VISUAL_THEMES[0];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Live Interactive Simulated Graphics Canvas effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let ballX = canvas.width / 2;
    let ballY = canvas.height * 0.45;
    let ballVx = 1.6;
    let ballVy = 1.4;
    const ballRadius = 4.5;

    let paddleX = canvas.width / 2 - 30;
    const paddleWidth = 60;
    const paddleHeight = 7;
    const paddleY = canvas.height - 20;

    // Small floating preview bricks matching theme
    interface MiniBrick {
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      active: boolean;
    }
    const miniBricks: MiniBrick[] = [
      { x: 25, y: 15, width: 38, height: 9, color: previewTheme.primaryColor, active: true },
      { x: 67, y: 15, width: 38, height: 9, color: previewTheme.secondaryColor, active: true },
      { x: 109, y: 15, width: 38, height: 9, color: previewTheme.primaryColor, active: true },
      { x: 151, y: 15, width: 38, height: 9, color: previewTheme.secondaryColor, active: true },
      { x: 193, y: 15, width: 38, height: 9, color: previewTheme.primaryColor, active: true },
      { x: 235, y: 15, width: 38, height: 9, color: previewTheme.secondaryColor, active: true },

      { x: 25, y: 28, width: 38, height: 9, color: previewTheme.secondaryColor, active: true },
      { x: 67, y: 28, width: 38, height: 9, color: previewTheme.primaryColor, active: true },
      { x: 109, y: 28, width: 38, height: 9, color: previewTheme.secondaryColor, active: true },
      { x: 151, y: 28, width: 38, height: 9, color: previewTheme.primaryColor, active: true },
      { x: 193, y: 28, width: 38, height: 9, color: previewTheme.secondaryColor, active: true },
      { x: 235, y: 28, width: 38, height: 9, color: previewTheme.primaryColor, active: true },
    ];

    interface MiniParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      life: number;
    }
    let miniParticles: MiniParticle[] = [];

    const animatePreview = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw active preview theme's custom background
      ctx.fillStyle = previewTheme.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Perspective horizon neon grid lines
      ctx.save();
      ctx.strokeStyle = previewTheme.gridColor;
      ctx.lineWidth = 1;
      const spacing = 18;
      const offset = (frame * 0.4) % spacing;

      // Draw horizon linear background simulation
      const hGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      hGrad.addColorStop(0, 'rgba(8, 6, 20, 0.95)');
      hGrad.addColorStop(1, previewTheme.backgroundColor);
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      // Horizontal grid lines drifting
      for (let y = 10; y < canvas.height; y += spacing) {
        const cy = y + offset;
        ctx.globalAlpha = Math.min(0.12, cy / canvas.height);
        ctx.moveTo(0, cy);
        ctx.lineTo(canvas.width, cy);
      }
      // Vanishing perspective lines
      for (let x = -50; x < canvas.width + 100; x += 40) {
        ctx.globalAlpha = 0.08;
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(x, canvas.height);
      }
      ctx.stroke();
      ctx.restore();

      // Smooth paddle tracking - moves towards the bouncing ball's horizontal axis
      const targetPaddleX = ballX - paddleWidth / 2;
      paddleX += (targetPaddleX - paddleX) * 0.12;

      // Hard borders clamp
      if (paddleX < 4) paddleX = 4;
      if (paddleX + paddleWidth > canvas.width - 4) paddleX = canvas.width - paddleWidth - 4;

      // Ball physics increments
      ballX += ballVx;
      ballY += ballVy;

      // Wall rebounds
      if (ballX - ballRadius < 4 || ballX + ballRadius > canvas.width - 4) {
        ballVx = -ballVx;
        ballX = ballX < 4 ? ballRadius + 4 : canvas.width - ballRadius - 4;
      }
      if (ballY - ballRadius < 4) {
        ballVy = -ballVy;
        ballY = ballRadius + 4;
      }

      // Re-initialize custom mini bricks if all cleared
      const activeBricksCount = miniBricks.filter(b => b.active).length;
      if (activeBricksCount === 0) {
        miniBricks.forEach(b => b.active = true);
      }

      // Brick intersection
      miniBricks.forEach(brick => {
        if (!brick.active) return;
        if (
          ballX + ballRadius >= brick.x &&
          ballX - ballRadius <= brick.x + brick.width &&
          ballY + ballRadius >= brick.y &&
          ballY - ballRadius <= brick.y + brick.height
        ) {
          brick.active = false;
          ballVy = -ballVy;
          // Spawn impact particles
          for (let i = 0; i < 6; i++) {
            miniParticles.push({
              x: ballX,
              y: ballY,
              vx: (Math.random() - 0.5) * 2.8,
              vy: (Math.random() - 0.5) * 2.8,
              color: brick.color,
              life: 25
            });
          }
        }
      });

      // Paddle collision rebound
      if (
        ballY + ballRadius >= paddleY &&
        ballY - ballRadius <= paddleY + paddleHeight &&
        ballX >= paddleX &&
        ballX <= paddleX + paddleWidth
      ) {
        ballVy = -Math.abs(ballVy);
        ballY = paddleY - ballRadius;
        
        // Spawn glowing skin particles on collision
        const laserColor = previewSkin.color;
        for (let i = 0; i < 5; i++) {
          miniParticles.push({
            x: ballX,
            y: paddleY,
            vx: (Math.random() - 0.5) * 3.5,
            vy: -Math.random() * 2 - 1,
            color: laserColor,
            life: 22
          });
        }
      }

      // Ball fails and respawns safely
      if (ballY > canvas.height) {
        ballX = canvas.width / 2;
        ballY = canvas.height * 0.45;
        ballVx = (Math.random() > 0.5 ? 1.6 : -1.6);
        ballVy = 1.4;
      }

      // Particles physics update
      miniParticles = miniParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        
        ctx.save();
        ctx.globalAlpha = p.life / 25;
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
        ctx.restore();
        
        return p.life > 0;
      });

      // Draw Mini Bricks
      miniBricks.forEach(brick => {
        if (!brick.active) return;
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = brick.color;
        ctx.fillStyle = brick.color;
        
        // Draw round corners for micro bricks
        ctx.beginPath();
        ctx.rect(brick.x, brick.y, brick.width, brick.height);
        ctx.fill();
        
        // Accent core highlight
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.25;
        ctx.fillRect(brick.x + 1, brick.y + 1, brick.width - 2, 2.5);
        ctx.restore();
      });

      // Draw Simulated Rounded Paddle Skin with details
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = previewSkin.color;

      const colors = previewSkin.id === 'hyper_rainbow'
        ? ['#ff5e62', '#ffd984', '#39ff14', '#00d2ff', '#ff007f']
        : [previewSkin.color, previewSkin.stripeColor || '#ffffff', previewSkin.color];

      const pGrad = ctx.createLinearGradient(paddleX, paddleY, paddleX + paddleWidth, paddleY);
      colors.forEach((col, i) => {
        pGrad.addColorStop(i / (colors.length - 1), col);
      });
      ctx.fillStyle = pGrad;
      
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(paddleX, paddleY, paddleWidth, paddleHeight, 3.5);
      } else {
        ctx.rect(paddleX, paddleY, paddleWidth, paddleHeight);
      }
      ctx.fill();

      // Core white light bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(paddleX + 5, paddleY + 1.5, paddleWidth - 10, 1.2);
      ctx.restore();

      // Draw Neon Ball
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = previewTheme.secondaryColor;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Outer ring matching theme secondary
      ctx.strokeStyle = previewTheme.secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      requestFrameId = requestAnimationFrame(animatePreview);
    };

    let requestFrameId = requestAnimationFrame(animatePreview);
    return () => cancelAnimationFrame(requestFrameId);
  }, [previewSkinId, previewThemeId, previewTheme, previewSkin]);

  // Audio actions
  const handleSelectSkin = (skin: PaddleSkin) => {
    soundEngine.playPaddleHit();
    onSelectSkin(skin.id);
  };

  const handleSelectTheme = (theme: VisualTheme) => {
    soundEngine.playPaddleHit();
    onSelectTheme(theme.id);
  };

  const handleBuySkin = (skin: PaddleSkin) => {
    if (coins >= skin.cost) {
      soundEngine.playPowerUp();
      onUnlockSkin(skin.id, skin.cost);
      setPreviewSkinId(skin.id);
    } else {
      soundEngine.playLifeLost();
    }
  };

  const handleBuyTheme = (theme: VisualTheme) => {
    if (coins >= theme.cost) {
      soundEngine.playPowerUp();
      onUnlockTheme(theme.id, theme.cost);
      setPreviewThemeId(theme.id);
    } else {
      soundEngine.playLifeLost();
    }
  };

  // Status computation for bottom action terminals
  const isSkinUnlocked = unlockedSkins.includes(previewSkinId);
  const isSkinSelected = selectedSkinId === previewSkinId;
  const canAffordSkin = coins >= previewSkin.cost;

  const isThemeUnlocked = unlockedThemes.includes(previewThemeId);
  const isThemeSelected = selectedThemeId === previewThemeId;
  const canAffordTheme = coins >= previewTheme.cost;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      id="game-shop-root"
      className="absolute inset-x-0 top-0 bottom-0 bg-slate-950/98 backdrop-blur-xl z-30 flex flex-col overflow-y-auto select-none font-sans border-b border-pink-500/20"
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 sticky top-0 bg-slate-950/95 z-40 backdrop-blur">
        <button 
          onClick={() => { soundEngine.playPaddleHit(); onClose(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-pink-400 hover:border-pink-500/30 transition text-[11px] font-bold"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> CLOSE SHOP
        </button>

        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 drop-shadow-[0_0_10px_rgba(236,72,153,0.3)] flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4 text-pink-500" /> SYSTEM STORE
        </h2>

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
          <Coins className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
          <span className="font-mono font-bold text-xs tracking-wide">{coins}</span>
        </div>
      </div>

      {/* 2. LIVE SIMULATION TERM PREVIEW */}
      <div className="p-4 bg-slate-900/60 border-b border-zinc-800">
        <div className="max-w-md mx-auto bg-slate-950/90 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          {/* Top Panel LED info indicator bar */}
          <div className="bg-slate-900 px-3 py-1.5 border-b border-zinc-900 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-cyan-400 font-bold uppercase tracking-wider">LIVE GRAPHICS TERMINAL</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[9px]">RES: 300x130</span>
              <span className="text-zinc-700">|</span>
              <span className="text-pink-500 font-bold">FPS: 60 SECURE</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-900">
            {/* Visualizer Frame */}
            <div className="p-3 flex items-center justify-center bg-slate-950">
              <div className="relative rounded-lg overflow-hidden border border-zinc-800">
                <canvas 
                  ref={canvasRef} 
                  width={300} 
                  height={130} 
                  className="block"
                />
              </div>
            </div>

            {/* Spec Information Details */}
            <div className="p-3 flex-1 flex flex-col justify-between text-[11px] space-y-2.5">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">INSURGENT CONFIGURATION</div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-mono">PADDLE:</span>
                  <span className="text-slate-100 font-bold tracking-wide" style={{ color: previewSkin.color }}>{previewSkin.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-mono">THEME CORE:</span>
                  <span className="text-slate-100 font-bold tracking-wide" style={{ color: previewTheme.primaryColor }}>{previewTheme.name}</span>
                </div>
              </div>

              {/* Instant terminal operations button details */}
              <div className="space-y-1">
                {/* 2A. Skin Equip / Purchase Button */}
                <div className="flex items-center justify-between gap-2 border-t border-zinc-900 pt-1.5">
                  <span className="text-[9px] text-cyan-400 font-extrabold uppercase font-mono tracking-wider">PADDLE GEAR:</span>
                  {isSkinUnlocked ? (
                    isSkinSelected ? (
                      <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> EQUIPPED
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSelectSkin(previewSkin)}
                        className="px-2 py-0.5 rounded bg-cyan-500 text-black text-[10px] font-extrabold uppercase hover:bg-cyan-400 active:scale-95 transition"
                      >
                        EQUIP
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleBuySkin(previewSkin)}
                      disabled={!canAffordSkin}
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase flex items-center gap-1 transition ${
                        canAffordSkin 
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3 h-3" />
                      <span>UNLOCK {previewSkin.cost}</span>
                    </button>
                  )}
                </div>

                {/* 2B. Theme Equip / Purchase Button */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-pink-500 font-extrabold uppercase font-mono tracking-wider">ENVIRONMENT:</span>
                  {isThemeUnlocked ? (
                    isThemeSelected ? (
                      <span className="text-[10px] font-bold text-pink-500 flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> APPLIED
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSelectTheme(previewTheme)}
                        className="px-2 py-0.5 rounded bg-pink-500 text-white text-[10px] font-extrabold uppercase hover:bg-pink-400 active:scale-95 transition"
                      >
                        APPLY
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleBuyTheme(previewTheme)}
                      disabled={!canAffordTheme}
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase flex items-center gap-1 transition ${
                        canAffordTheme 
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3 h-3" />
                      <span>UNLOCK {previewTheme.cost}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Items Selector Panels */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        
        {/* PADDLE SKINS */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-1.5 border-b border-cyan-500/15 pb-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" /> PADDLE GEAR SYSTEM ({PADDLE_SKINS.length})
          </h3>
          <p className="text-[10px] text-zinc-500 leading-tight">
            Click any row to test-drive inside the real-time simulation terminal above.
          </p>
          
          <div className="space-y-2">
            {PADDLE_SKINS.map((skin) => {
              const isUnlocked = unlockedSkins.includes(skin.id);
              const isSelected = selectedSkinId === skin.id;
              const isCurrentlyPreviewed = previewSkinId === skin.id;
              const canAfford = coins >= skin.cost;
              
              return (
                <div 
                  key={skin.id}
                  onClick={() => {
                    setPreviewSkinId(skin.id);
                    soundEngine.playPaddleHit();
                  }}
                  className={`group relative p-2.5 rounded-xl border cursor-pointer transition-all duration-300 flex items-center justify-between ${
                    isCurrentlyPreviewed 
                      ? 'border-cyan-500 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] scale-[1.01]' 
                      : isSelected 
                      ? 'border-cyan-900/60 bg-cyan-950/5 hover:border-zinc-700' 
                      : 'border-zinc-900 bg-slate-950/25 hover:border-zinc-800 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Visual Preview */}
                    <div 
                      className={`w-11 h-6 rounded border transition-all ${
                        isCurrentlyPreviewed ? 'border-cyan-500' : 'border-zinc-800'
                      } flex items-center justify-center bg-slate-950 overflow-hidden relative`}
                    >
                      {/* Paddle style details */}
                      <div 
                        className="w-7 h-1 rounded"
                        style={{ 
                          background: skin.id === 'hyper_rainbow' 
                            ? 'linear-gradient(90deg, red, orange, yellow, green, blue, violet)'
                            : skin.color,
                          boxShadow: `0 0 5px ${skin.color}`
                        }}
                      />
                    </div>

                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        {skin.name}
                        {isSelected && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-400 font-mono font-bold border border-cyan-500/20 uppercase">
                            ACTIVE
                          </span>
                        )}
                        {!isUnlocked && (
                          <Lock className="w-3 h-3 text-zinc-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-normal leading-tight max-w-[210px] group-hover:text-zinc-300 transition">
                        {skin.description}
                      </p>
                    </div>
                  </div>

                  {/* Buttons controls */}
                  <div className="pl-2" onClick={(e) => e.stopPropagation()}>
                    {isUnlocked ? (
                      isSelected ? (
                        <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-[10px]">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectSkin(skin)}
                          className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 font-black hover:bg-zinc-700 text-[10px] transition"
                        >
                          EQUIP
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleBuySkin(skin)}
                        disabled={!canAfford}
                        className={`px-2.5 py-1 rounded border flex items-center gap-0.5 text-[10px] font-black tracking-wide transition ${
                          canAfford 
                            ? 'bg-yellow-500/10 border-yellow-500/50 hover:bg-yellow-500 text-yellow-400 hover:text-black shadow-[0_0_10px_rgba(234,179,8,0.1)]' 
                            : 'bg-zinc-950 border-zinc-900 text-zinc-700 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3 h-3" />
                        <span>{skin.cost}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BRICK CORES / THEMES */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-pink-500 flex items-center gap-1.5 border-b border-pink-500/15 pb-1.5">
            <Palette className="w-4 h-4 text-pink-500" /> STAGE THEME ENVIRONMENT ({VISUAL_THEMES.length})
          </h3>
          <p className="text-[10px] text-zinc-500 leading-tight">
            Selecting a theme updates the live simulator & main block game field.
          </p>
          
          <div className="space-y-2">
            {VISUAL_THEMES.map((theme) => {
              const isUnlocked = unlockedThemes.includes(theme.id);
              const isSelected = selectedThemeId === theme.id;
              const isCurrentlyPreviewed = previewThemeId === theme.id;
              const canAfford = coins >= theme.cost;
              
              return (
                <div 
                  key={theme.id}
                  onClick={() => {
                    setPreviewThemeId(theme.id);
                    soundEngine.playPaddleHit();
                  }}
                  className={`group relative p-2.5 rounded-xl border cursor-pointer transition-all duration-300 flex items-center justify-between ${
                    isCurrentlyPreviewed 
                      ? 'border-pink-500 bg-pink-950/20 shadow-[0_0_15px_rgba(236,72,153,0.15)] scale-[1.01]' 
                      : isSelected 
                      ? 'border-pink-920/60 bg-pink-950/5 hover:border-zinc-700' 
                      : 'border-zinc-900 bg-slate-950/25 hover:border-zinc-800 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Visual Swatch Preview */}
                    <div 
                      className={`w-11 h-8 rounded border transition-all ${
                        isCurrentlyPreviewed ? 'border-pink-500' : 'border-zinc-800'
                      } flex flex-col justify-between p-1 bg-slate-950 overflow-hidden relative`}
                      style={{ backgroundColor: theme.backgroundColor }}
                    >
                      {/* Simualted brick rows in micro grid */}
                      <div className="flex gap-0.5 justify-center mt-0.5">
                        <div className="w-2.5 h-1 rounded" style={{ background: theme.primaryColor }} />
                        <div className="w-2.5 h-1 rounded" style={{ background: theme.secondaryColor }} />
                        <div className="w-2.5 h-1 rounded" style={{ background: theme.primaryColor }} />
                      </div>
                      
                      {/* Simulated laser particle spark */}
                      <div className="flex justify-between items-center text-[5px] mt-1.5">
                        <div className="w-1 h-1 rounded-full animate-bounce mx-auto" style={{ background: theme.primaryColor, boxShadow: `0 0 4px ${theme.primaryColor}` }} />
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        {theme.name}
                        {isSelected && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded bg-pink-500/10 text-pink-500 font-mono font-bold border border-pink-500/20 uppercase">
                            APPLIED
                          </span>
                        )}
                        {!isUnlocked && (
                          <Lock className="w-3 h-3 text-zinc-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-normal leading-tight max-w-[210px] group-hover:text-zinc-300 transition">
                        {theme.description}
                      </p>
                    </div>
                  </div>

                  {/* Right Action buttons */}
                  <div className="pl-2" onClick={(e) => e.stopPropagation()}>
                    {isUnlocked ? (
                      isSelected ? (
                        <div className="w-7 h-7 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-500 flex items-center justify-center text-[10px]">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectTheme(theme)}
                          className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 font-black hover:bg-zinc-700 text-[10px] transition"
                        >
                          APPLY
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleBuyTheme(theme)}
                        disabled={!canAfford}
                        className={`px-2.5 py-1 rounded border flex items-center gap-0.5 text-[10px] font-black tracking-wide transition ${
                          canAfford 
                            ? 'bg-yellow-500/10 border-yellow-500/50 hover:bg-yellow-500 text-yellow-400 hover:text-black shadow-[0_0_10px_rgba(234,179,8,0.1)]' 
                            : 'bg-zinc-950 border-zinc-900 text-zinc-700 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3 h-3" />
                        <span>{theme.cost}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
