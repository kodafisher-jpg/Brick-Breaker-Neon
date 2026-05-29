import { PaddleSkin, VisualTheme } from '../types';

export const PADDLE_SKINS: PaddleSkin[] = [
  {
    id: 'classic_pink',
    name: 'Cyber Magenta',
    cost: 0,
    unlocked: true,
    color: '#ff007f',
    stripeColor: '#00ffff',
    glow: '0 0 15px rgba(255, 0, 127, 0.8)',
    description: 'The standard issue cybernetic paddle. Balanced and energetic.'
  },
  {
    id: 'acid_green',
    name: 'Toxic Acid',
    cost: 150,
    unlocked: false,
    color: '#39ff14',
    stripeColor: '#ff073a',
    glow: '0 0 15px rgba(57, 255, 20, 0.8)',
    description: 'Irradiated with bright radioactive isotopes. Corrosive look.'
  },
  {
    id: 'synth_gold',
    name: 'Retro Aurum',
    cost: 300,
    unlocked: false,
    color: '#ffd700',
    stripeColor: '#ff00ff',
    glow: '0 0 15px rgba(255, 215, 0, 0.8)',
    description: 'Pure 24-karat solid gold neon alloy. Shows off absolute wealth.'
  },
  {
    id: 'outrun_sunset',
    name: 'Outrun Gradient',
    cost: 500,
    unlocked: false,
    color: '#ff00ff',
    stripeColor: '#ff9000',
    glow: '0 0 15px rgba(255, 0, 255, 0.8)',
    description: 'Infused with the endless warm breeze of a 1980s summer beach sunset.'
  },
  {
    id: 'matrix_grid',
    name: 'Deep Grid',
    cost: 800,
    unlocked: false,
    color: '#00ffcc',
    stripeColor: '#ff3300',
    glow: '0 0 15px rgba(0, 255, 204, 0.8)',
    description: 'Quantum-woven carbon fibers. Hardened for heavy ball impact.'
  },
  {
    id: 'hyper_rainbow',
    name: 'Prism Spectrum',
    cost: 1200,
    unlocked: false,
    color: '#ff00ff', // Cycle handled dynamically in code or fallback
    stripeColor: '#00ff00',
    glow: '0 0 20px rgba(255, 0, 255, 1)',
    description: 'A glowing rainbow spectrum that dynamically changes color on contact.'
  }
];

export const VISUAL_THEMES: VisualTheme[] = [
  {
    id: 'cyberpunk_neon',
    name: 'Cyber Neon Pink',
    cost: 0,
    unlocked: true,
    primaryColor: '#ff007f',
    secondaryColor: '#00ffff',
    backgroundColor: '#0d0d1a',
    brickGradientStart: '#ff007f',
    brickGradientEnd: '#00ffff',
    gridColor: 'rgba(255, 0, 127, 0.15)',
    neonGlow: '0px 0px 10px rgba(255, 0, 127, 0.5)',
    glowColor: '#ff007f',
    description: 'Futuristic Neo-Tokyo streets. Classic magenta and cyan cyber grid.'
  },
  {
    id: 'toxic_waste',
    name: 'Nuclear Green',
    cost: 200,
    unlocked: false,
    primaryColor: '#39ff14',
    secondaryColor: '#ffff00',
    backgroundColor: '#050c05',
    brickGradientStart: '#39ff14',
    brickGradientEnd: '#ffff00',
    gridColor: 'rgba(57, 255, 20, 0.15)',
    neonGlow: '0px 0px 10px rgba(57, 255, 20, 0.5)',
    glowColor: '#39ff14',
    description: 'A glowing chemical vat themed arena. High contrast radioactive greens.'
  },
  {
    id: 'deep_space',
    name: 'Nebula Ultramarine',
    cost: 400,
    unlocked: false,
    primaryColor: '#00d2ff',
    secondaryColor: '#00416a',
    backgroundColor: '#020514',
    brickGradientStart: '#00d2ff',
    brickGradientEnd: '#7a2cff',
    gridColor: 'rgba(0, 210, 255, 0.15)',
    neonGlow: '0px 0px 10px rgba(0, 210, 255, 0.5)',
    glowColor: '#00d2ff',
    description: 'Deep cosmic atmosphere. Infinite stardust blue and galaxy ultraviolet.'
  },
  {
    id: 'retro_sunset',
    name: 'Sunset Gold',
    cost: 600,
    unlocked: false,
    primaryColor: '#ff5e62',
    secondaryColor: '#ff9966',
    backgroundColor: '#12050f',
    brickGradientStart: '#ff5e62',
    brickGradientEnd: '#ffd984',
    gridColor: 'rgba(255, 94, 98, 0.15)',
    neonGlow: '0px 0px 10px rgba(255, 94, 98, 0.5)',
    glowColor: '#ff5e62',
    description: 'Warm retro grid synthwave sunset. Orange, gold, and red violet notes.'
  },
  {
    id: 'mono_cyber',
    name: 'Matrix Monochrome',
    cost: 1000,
    unlocked: false,
    primaryColor: '#00ff00',
    secondaryColor: '#ffffff',
    backgroundColor: '#000800',
    brickGradientStart: '#00ff00',
    brickGradientEnd: '#115511',
    gridColor: 'rgba(0, 255, 0, 0.1)',
    neonGlow: '0px 0px 10px rgba(0, 255, 0, 0.5)',
    glowColor: '#00ff00',
    description: 'Green digital code cascades. Classic computer terminal hacker aesthetic.'
  }
];
