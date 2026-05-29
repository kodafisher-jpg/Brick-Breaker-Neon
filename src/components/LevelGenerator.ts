import { Brick, BrickType, VisualTheme } from '../types';

/**
 * Procedural Brick Maker with pre-defined layouts and randomized geometric symmetries.
 * Scales brick count, HP, armored configurations, explosives, and boss units dynamically.
 */

interface LevelConfig {
  name: string;
  columns: number;
  rows: number;
  pattern: 'ROWS' | 'SPACE_INVADER' | 'HEART' | 'FORTRESS' | 'EXP_CHECKERBOARD' | 'BOSS_COURT' | 'SYMMETRIC_RANDOM';
  difficultyScale: number;
}

export const LEVELS: LevelConfig[] = [
  {
    name: "CYBER BREAKOUT",
    columns: 10,
    rows: 4,
    pattern: 'ROWS',
    difficultyScale: 1.0
  },
  {
    name: "ELECTRIC AVENUE",
    columns: 10,
    rows: 5,
    pattern: 'ROWS',
    difficultyScale: 1.2
  },
  {
    name: "SPACE INVADER CORES",
    columns: 11,
    rows: 6,
    pattern: 'SPACE_INVADER',
    difficultyScale: 1.4
  },
  {
    name: "HEARTBEAT CORE",
    columns: 11,
    rows: 7,
    pattern: 'HEART',
    difficultyScale: 1.6
  },
  {
    name: "ARMORED BASTION",
    columns: 10,
    rows: 6,
    pattern: 'FORTRESS',
    difficultyScale: 1.8
  },
  {
    name: "BOOM GRID",
    columns: 12,
    rows: 6,
    pattern: 'EXP_CHECKERBOARD',
    difficultyScale: 2.0
  },
  {
    name: "GILDED DREADNOUGHT",
    columns: 11,
    rows: 7,
    pattern: 'BOSS_COURT',
    difficultyScale: 2.4
  },
  {
    name: "OUTRUN INFINITE",
    columns: 10,
    rows: 7,
    pattern: 'SYMMETRIC_RANDOM',
    difficultyScale: 2.8
  }
];

export function generateLevelBricks(
  levelIndex: number,
  fieldWidth: number,
  fieldHeight: number,
  theme: VisualTheme
): Brick[] {
  // Use config modulo if level exceeds the array length
  const levelConfig = LEVELS[levelIndex % LEVELS.length];
  
  // Account for scaling in infinite high levels
  const levelLoopOffset = Math.floor(levelIndex / LEVELS.length);
  const scalingMultiplier = 1 + levelLoopOffset * 0.4;
  const currentDifficulty = levelConfig.difficultyScale * scalingMultiplier;

  const cols = levelConfig.columns;
  const rows = levelConfig.rows;

  // Brick proportions based on current canvas area
  // Leave padding at sides: e.g., 5% margin left and right
  const sidePadding = fieldWidth * 0.05;
  const availableWidth = fieldWidth - sidePadding * 2;
  const brickGap = 4;
  const brickWidth = (availableWidth - (cols - 1) * brickGap) / cols;
  const brickHeight = Math.min(22, (fieldHeight * 0.45) / rows);
  const startY = fieldHeight * 0.12; // starts slightly down from HUD

  const bricks: Brick[] = [];

  // Helper to color based on index or type
  const getBrickColor = (type: BrickType, rowIdx: number): string => {
    switch (type) {
      case 'armored':
        // Metallic steel gray or bright electric primary depending on theme
        return '#a855f7'; // Purple neon
      case 'coin':
        return '#eab308'; // Glowing Gold
      case 'explosive':
        return '#ef4444'; // Cyber Red
      case 'gilded':
        return '#facc15'; // Brilliant Golden Orange
      case 'normal':
      default:
        // Spectral shift across rows
        const colors = [theme.primaryColor, theme.secondaryColor, '#06b6d4', '#ec4899', '#3b82f6'];
        return colors[rowIdx % colors.length];
    }
  };

  // Pre-designed templates or dynamic symmetry generator
  const pattern = levelConfig.pattern === 'SYMMETRIC_RANDOM' && levelIndex > 7 
    ? (Math.random() > 0.5 ? 'ROWS' : 'EXP_CHECKERBOARD') 
    : levelConfig.pattern;

  // SPACE INVADER MAP MOCK (symmetric horizontal binary grid for invader shape)
  const InvaderMap = [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
    [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
  ];

  // HEART GEOMETRY
  const HeartMap = [
    [0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0],
    [1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let active = true;
      let type: BrickType = 'normal';
      let hp = 1;
      let points = 100;
      
      const x = sidePadding + c * (brickWidth + brickGap);
      const y = startY + r * (brickHeight + brickGap);

      // Distinguish patterns
      if (pattern === 'SPACE_INVADER') {
        const shapeRow = r % InvaderMap.length;
        const shapeCol = c % InvaderMap[0].length;
        active = InvaderMap[shapeRow][shapeCol] === 1;
        
        // Enhance some core locations inside the invader
        if (active) {
          if (r === 3 && c === 5) {
            type = 'gilded';
            hp = 3 + Math.floor(levelLoopOffset * 1.5);
            points = 500;
          } else if (r === 2 || r === 4) {
            type = (c % 4 === 0) ? 'armored' : 'normal';
            hp = type === 'armored' ? 2 : 1;
          } else if (c % 5 === 1) {
            type = 'coin';
          }
        }
      } else if (pattern === 'HEART') {
        const shapeRow = r % HeartMap.length;
        const shapeCol = c % HeartMap[0].length;
        active = HeartMap[shapeRow][shapeCol] === 1;

        if (active) {
          if (r === 3 && c === 5) {
            type = 'gilded'; // center core heart
            hp = 4;
            points = 600;
          } else if (r === 0 || r === 1) {
            type = 'coin'; // gold glow edges
          } else if (r === 4) {
            type = 'explosive'; // dramatic chain risk
          }
        }
      } else if (pattern === 'FORTRESS') {
        // High defensive structure. Armored bricks build an outer shield wall.
        if (r === 0 || r === 1) {
          type = 'armored';
          hp = Math.min(4, 2 + levelLoopOffset);
          points = 250;
        } else if (r === 2) {
          type = 'explosive';
          points = 300;
        } else if (r >= 4) {
          type = 'coin';
          points = 150;
        }
      } else if (pattern === 'EXP_CHECKERBOARD') {
        // Red explosive bricks checkerboarded with standard ones
        active = (r + c) % 2 === 0;
        if (active) {
          if ((r * c) % 5 === 0) {
            type = 'explosive';
            points = 300;
          } else if ((r + c) % 4 === 0) {
            type = 'armored';
            hp = 2;
          }
        }
      } else if (pattern === 'BOSS_COURT') {
        // Giant "Boss" row in the very center requiring multiple dynamic impacts
        const midRow = Math.floor(rows / 2);
        const midCol = Math.floor(cols / 2);

        if (r === midRow && Math.abs(c - midCol) <= 1) {
          type = 'gilded'; // The big boss brick!
          hp = 5 + levelLoopOffset * 2;
          points = 1000;
        } else if (r < midRow) {
          type = 'armored';
          hp = 2;
          points = 200;
        } else if (r > midRow) {
          type = 'normal';
          if (c % 3 === 0) type = 'coin';
        }
      } else {
        // Standard levels / SYMMETRIC_RANDOM
        // Symmetrical layout
        const midCol = Math.ceil(cols / 2);
        const mappedCol = c >= midCol ? (cols - 1 - c) : c;
        
        // Determine layout based on row/column hash
        const seed = (r * 7 + mappedCol * 13 + levelIndex * 19) % 100;

        if (seed < 12) {
          active = false; // hollow spots
        } else if (seed < 25) {
          type = 'armored';
          hp = Math.min(3, 2 + levelLoopOffset);
          points = 250;
        } else if (seed < 40) {
          type = 'coin';
          points = 150;
        } else if (seed < 46) {
          type = 'explosive';
          points = 300;
        }
      }

      if (active) {
        bricks.push({
          id: `brick_${levelIndex}_${r}_${c}`,
          x,
          y,
          width: brickWidth,
          height: brickHeight,
          type,
          hp,
          maxHp: hp,
          points,
          color: getBrickColor(type, r)
        });
      }
    }
  }

  return bricks;
}
