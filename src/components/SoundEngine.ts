/**
 * Retro Synthwave Sound Engine & Synthesizer using Web Audio API
 * Generates genuine upbeat retro synth-wave music & sound effects dynamically on the fly!
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  // Music State
  private isMusicPlaying = false;
  private currentBeats = 0;
  private tempo = 115; // BPM
  private musicIntervalId: any = null;
  private currentStep = 0;

  // Synthesizer settings
  private bassNotes = [36, 36, 39, 41, 41, 41, 44, 43]; // Midi numbers
  private melodyNotes = [
    [60, 63, 67, 72, 70, 67, 65, 67], // Lead pattern 1
    [72, 72, 75, 77, 79, 75, 72, 74], // Lead pattern 2
  ];
  private melodyActive = true;

  constructor() {
    // Audio Context is initialized on first user interaction to bypass browser autoplay policies.
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.error('Failed to initialize Web Audio API: ', e);
    }
  }

  public toggleMute(muted: boolean) {
    this.init();
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setValueAtTime(muted ? 0 : 0.7, this.ctx.currentTime);
  }

  public startMusic() {
    this.init();
    if (this.isMusicPlaying || !this.ctx || !this.musicGain) return;
    
    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMusicPlaying = true;
    this.currentStep = 0;

    const stepDuration = 60 / this.tempo / 2; // Eighth notes
    let nextTickTime = this.ctx.currentTime;

    const scheduler = () => {
      if (!this.isMusicPlaying || !this.ctx) return;
      
      while (nextTickTime < this.ctx.currentTime + 0.1) {
        this.playMusicStep(this.currentStep, nextTickTime);
        nextTickTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 16;
      }
      this.musicIntervalId = setTimeout(scheduler, 25);
    };

    scheduler();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicIntervalId) {
      clearTimeout(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  private mtof(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Play a dynamic step of our upbeat Synthwave song
   */
  private playMusicStep(step: number, time: number) {
    if (!this.ctx || !this.musicGain) return;

    // --- SYNTHWAVE DRUMS ---
    // Kick drum on beats 0, 4, 8, 12
    if (step % 4 === 0) {
      this.synthesizeKick(time);
    }
    // Snare drum on beats 4, 12 (layered snare/noise)
    if (step % 8 === 4) {
      this.synthesizeSnare(time);
    }
    // High-hat on odd 16th indices
    if (step % 2 === 1) {
      this.synthesizeHiHat(time);
    }

    // --- DRIVING SYNTH BASS LINE (Classic Outrun Arpeggio) ---
    // 8th note feel: Bass triggers every step
    const barIndex = Math.floor(step / 8) % 2; // alternate bar note selection
    const rawMidi = this.bassNotes[step % this.bassNotes.length];
    // Alternate octave on off-beats for that ultimate bouncy feel!
    const midiNote = step % 2 === 1 ? rawMidi + 12 : rawMidi; 
    this.synthesizeBass(midiNote, time, step % 2 === 1);

    // --- SYNTH MELODY (16-step nostalgic lead sequences) ---
    if (this.melodyActive && step % 4 === 0) {
      const melodyIndex = Math.floor(this.currentStep / 8) % this.melodyNotes.length;
      const melodyPattern = this.melodyNotes[melodyIndex];
      const noteMidi = melodyPattern[Math.floor(step / 2) % melodyPattern.length];
      
      // Let's sometimes skip a chord or note for variety
      if (Math.random() < 0.85) {
        this.synthesizeMelody(noteMidi, time);
      }
    }
  }

  private synthesizeKick(time: number) {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  private synthesizeSnare(time: number) {
    if (!this.ctx || !this.musicGain) return;

    // Use noise buffer for snare snap
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time);

    const gain = this.ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    osc.connect(gain);
    gain.connect(this.musicGain);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.16);
    osc.stop(time + 0.16);
  }

  private synthesizeHiHat(time: number) {
    if (!this.ctx || !this.musicGain) return;

    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const gain = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  private synthesizeBass(midiNote: number, time: number, offBeat: boolean) {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.mtof(midiNote), time);

    // Classic synthwave filter sweep
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(offBeat ? 650 : 400, time);
    filter.Q.setValueAtTime(2, time);

    const gain = this.ctx.createGain();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + 0.22); // tight decay

    osc.start(time);
    osc.stop(time + 0.23);
  }

  private synthesizeMelody(midiNote: number, time: number) {
    if (!this.ctx || !this.musicGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    
    // Warm synth wave combo
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    
    const freq = this.mtof(midiNote);
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.005, time); // detune slightly for cosmic chorus!

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + 0.4);

    const delay = this.ctx.createDelay();
    delay.delayTime.value = 0.15; // echo feedback

    const delayGain = this.ctx.createGain();
    delayGain.gain.value = 0.2;

    const gain = this.ctx.createGain();

    // Hook up nodes
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    
    // Echo loop
    gain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(gain);
    
    gain.connect(this.musicGain);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

    osc1.start(time);
    osc2.start(time);
    
    osc1.stop(time + 0.5);
    osc2.stop(time + 0.5);
  }

  // ==========================================
  // RETRO GAME SOUND EFFECTS (SFX)
  // ==========================================

  public playPaddleHit() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.start();
    osc.stop(now + 0.13);
  }

  public playBrickHit() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    // Chiptune coin/bell strike
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.start();
    osc.stop(now + 0.19);
  }

  public playGoldBrickHit() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    // Ascending cute chiptune coin chime!
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.setValueAtTime(0.25, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.start();
    osc.stop(now + 0.23);
  }

  public playPowerUp() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Ascending C major arpeggio
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      gain.gain.setValueAtTime(0.18, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.16);
    });
  }

  public playExplosion() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.35);

    const gain = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

    noise.start(now);
    noise.stop(now + 0.4);
  }

  public playLaser() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start();
    osc.stop(now + 0.11);
  }

  public playLifeLost() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.48);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.start();
    osc.stop(now + 0.5);
  }

  public playVictory() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    // Retro triumph chord: E4, G#4, B4, E5
    const chord = [329.63, 415.30, 493.88, 659.25];
    
    chord.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.03);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      gain.gain.setValueAtTime(0.2, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.start(now + i * 0.03);
      osc.stop(now + 0.55);
    });
  }
}

export const soundEngine = new SoundEngine();
