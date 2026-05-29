export type PowerUpType = 
  | 'WIDE_PADDLE' 
  | 'SLOW_BALL' 
  | 'LASER' 
  | 'DOUBLE_COINS' 
  | 'STICKY' 
  | 'EXTRA_LIFE' 
  | 'MULTI_BALL';

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  color: string;
  speed: number;
  radius: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface LaserBolt {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  sticky: boolean;
  isStickyAttached: boolean;
  stickyOffsetX: number; // distance from center of paddle when attached
}

export type BrickType = 'normal' | 'armored' | 'coin' | 'explosive' | 'gilded';

export interface Brick {
  id: string;
  x: number; // grid position or raw pixel
  y: number;
  width: number;
  height: number;
  type: BrickType;
  hp: number;
  maxHp: number;
  points: number;
  color: string;
}

export interface PaddleSkin {
  id: string;
  name: string;
  cost: number;
  unlocked: boolean;
  color: string;
  stripeColor: string;
  description: string;
  glow: string;
}

export interface VisualTheme {
  id: string;
  name: string;
  cost: number;
  unlocked: boolean;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  brickGradientStart: string;
  brickGradientEnd: string;
  gridColor: string;
  neonGlow: string;
  glowColor: string;
  description: string;
}

export interface SaveState {
  score: number;
  coins: number;
  levelIndex: number;
  lives: number;
  unlockedSkins: string[]; // skin IDs
  unlockedThemes: string[]; // theme IDs
  selectedSkinId: string;
  selectedThemeId: string;
  highScore: number;
  savedGameExists: boolean;
  // State for paused game resume
  midGameLevel?: number;
  midGameBricks?: Brick[];
  midGameScore?: number;
  midGameLives?: number;
  midGameCoins?: number;
  midGameBalls?: Ball[];
}
