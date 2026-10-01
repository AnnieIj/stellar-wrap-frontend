import { useSoundStore } from "../store/soundStore";
import { logger } from "./logger";

const log = logger.child("soundManager");


export const SOUND_NAMES = {
    SLIDE_WHOOSH: "slide-whoosh",
    CARD_FLIP: "card-flip",
  MINT_SUCCESS: "mint-success",
    BG_MUSIC: "bg-music",
} as const;

export const SOUND_FILES = {
  [SOUND_NAMES.SLIDE_WHOOSH]: "/audio/slide-whoosh.mp3",
  [SOUND_NAMES.CARD_FLIP]: "/audio/card-flip.mp3",
  [SOUND_NAMES.MINT_SUCCESS]: "/audio/mint-success.mp3",
  [SOUND_NAMES.BG_MUSIC]: "/audio/bg-music.mp3",

};


export type SoundName = (typeof SOUND_NAMES)[keyof typeof SOUND_NAMES];

interface AudioInstance {
  audio: HTMLAudioElement;
  isPlaying: boolean;
}

class SoundManager {
  private sfxPool: Map<SoundName, AudioInstance[]> = new Map();
  private audioContext: AudioContext | null = null;
  private bgMusicBuffer: AudioBuffer | null = null;
  private bgMusicSource: AudioBufferSourceNode | null = null;
  private bgMusicGainNode: GainNode | null = null;
  private bgMusicLoaded: boolean = false;
  private isPlaying: boolean = false;
  private isInitialized: boolean = false;


   preloadSFX(): void {
    if (typeof window === "undefined") return;
     
     Object.entries(SOUND_FILES).forEach(([name, src]) => {
      
      if (name === SOUND_NAMES.BG_MUSIC) return;
      
      const pool: AudioInstance[] = [];
      for (let i = 0; i < 3; i++) {
        const audio = new Audio(src);
        audio.preload = "auto";
        audio.volume = 0.7; 
        pool.push({ audio, isPlaying: false });
      }
      this.sfxPool.set(name as SoundName, pool);
    });

    this.isInitialized = true;
  }

  private getAvailableInstance(soundName: SoundName): AudioInstance | null {
    const pool = this.sfxPool.get(soundName);
    if (!pool) return null;

    let available = pool.find((instance) => !instance.isPlaying);

    if (!available) {
      available = pool[0];
      try {
        available.audio.pause();
        available.audio.currentTime = 0;
      } catch (error) {
        // Ignore errors from resetting audio state
      }
    }

    return available;
  }

  playSound(soundName: SoundName): void {
    if (typeof window === "undefined") return;

    if (soundName === SOUND_NAMES.BG_MUSIC) {
      return;
    }

    const isMuted = useSoundStore.getState().isMuted;
    if (isMuted) return;

    if (!this.isInitialized) {
      this.preloadSFX();
    }

    const instance = this.getAvailableInstance(soundName);
    if (!instance) return;

    instance.isPlaying = true;
    const audio = instance.audio;

    try {
      audio.currentTime = 0;
    } catch (error) {
      instance.isPlaying = false;
      return;
    }

    audio.play().catch((error) => {
      instance.isPlaying = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes("NotAllowedError") ||
        errorMsg.includes("NotSupportedError") ||
        errorMsg.includes("autoplay")
      ) {
        return;
      }
      log.warn(`Failed to play sound ${soundName}:`, error);
    });

    audio.onended = () => {
      instance.isPlaying = false;
    };
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    
    if (!this.audioContext) {
      // webkitAudioContext is a vendor-prefixed fallback for older Safari/iOS browsers
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        this.audioContext = new AudioContextCtor();
      }
    }
    
    return this.audioContext;
  }

  async initBackgroundMusic(): Promise<void> {
    if (typeof window === "undefined" || this.bgMusicLoaded) return;

    try {
      const audioContext = this.getAudioContext();
      if (!audioContext) return;

      const response = await fetch(SOUND_FILES[SOUND_NAMES.BG_MUSIC]);
      if (!response.ok) {
        this.bgMusicLoaded = false;
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      this.bgMusicBuffer = await audioContext.decodeAudioData(arrayBuffer);

      this.bgMusicGainNode = audioContext.createGain();
      this.bgMusicGainNode.gain.value = 0.2;
      this.bgMusicGainNode.connect(audioContext.destination);

      this.bgMusicLoaded = true;
    } catch (error) {
      this.bgMusicLoaded = false;
    }
  }

  private startLoop(): void {
    const audioContext = this.getAudioContext();
    if (!audioContext || !this.bgMusicBuffer || !this.bgMusicGainNode) return;

    if (this.bgMusicSource) {
      try {
        this.bgMusicSource.stop();
        this.bgMusicSource.onended = null;
      } catch (error) {
        // Source already stopped
      }
      this.bgMusicSource = null;
    }

    if (!this.isPlaying) return;

    try {
      this.bgMusicSource = audioContext.createBufferSource();
      this.bgMusicSource.buffer = this.bgMusicBuffer;
      this.bgMusicSource.connect(this.bgMusicGainNode);

      const currentSource = this.bgMusicSource;
      this.bgMusicSource.onended = () => {
        if (this.isPlaying && this.bgMusicSource === currentSource) {
          this.bgMusicSource = null;
          this.startLoop();
        }
      };

      this.bgMusicSource.start(0);
    } catch (error) {
      this.bgMusicSource = null;
      this.isPlaying = false;
    }
  }

  async startBackgroundMusic(): Promise<void> {
    if (typeof window === "undefined") return;

    const isMuted = useSoundStore.getState().isMuted;
    if (isMuted) {
      this.isPlaying = false;
      return;
    }

    if (this.isPlaying) {
      return;
    }

    if (!this.bgMusicLoaded) {
      await this.initBackgroundMusic();
    }

    if (!this.bgMusicLoaded) {
      return;
    }

    const audioContext = this.getAudioContext();
    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (error) {
        return;
      }
    }

    this.isPlaying = true;
    this.startLoop();
  }

  stopBackgroundMusic(): void {
    this.isPlaying = false;
    
    if (this.bgMusicSource) {
      try {
        this.bgMusicSource.onended = null;
        this.bgMusicSource.stop();
      } catch (error) {
        log.error("Failed to stop background music:", error);
      }
      this.bgMusicSource = null;
    }
  }

  pauseBackgroundMusic(): void {
    this.isPlaying = false;
    
    if (this.bgMusicSource) {
      try {
        this.bgMusicSource.onended = null;
        this.bgMusicSource.stop();
      } catch (error) {
        log.error("Failed to pause background music:", error);
      }
      this.bgMusicSource = null;
    }
  }

  async resumeBackgroundMusic(): Promise<void> {
    if (typeof window === "undefined") return;

    const isMuted = useSoundStore.getState().isMuted;
    if (isMuted) {
      this.isPlaying = false;
      return;
    }

    if (this.isPlaying) {
      return;
    }

    if (!this.bgMusicLoaded) {
      await this.initBackgroundMusic();
    }

    if (!this.bgMusicLoaded) {
      return;
    }

    const audioContext = this.getAudioContext();
    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (error) {
        return;
      }
    }

    this.isPlaying = true;
    this.startLoop();
  }

  updateMuteState(isMuted: boolean): void {
    if (isMuted) {
      this.pauseBackgroundMusic();
    } else {
      if (this.bgMusicLoaded) {
        this.resumeBackgroundMusic().catch(() => {
          // Silently handle resume failures
        });
      }
    }
  }

  cleanup(): void {
    this.stopBackgroundMusic();
    
    if (this.bgMusicGainNode) {
      this.bgMusicGainNode.disconnect();
      this.bgMusicGainNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close().catch((error) => {
        log.warn("Failed to close audio context:", error);
      });
      this.audioContext = null;
    }
    
    this.bgMusicBuffer = null;
    this.bgMusicLoaded = false;
    this.sfxPool.clear();
    this.isInitialized = false;
  }
}

export const soundManager = new SoundManager();

if (typeof window !== "undefined") {
  soundManager.preloadSFX();
}

