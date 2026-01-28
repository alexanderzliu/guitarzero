import type { GameState } from '../../types';

export interface CountdownFrame {
  countdownValue: number; // beats remaining, min 1 while active
  beatActive: boolean; // true briefly at beat start
  isDone: boolean;
}

export interface CountdownClock {
  beatDurationSec: number;
  countdownDurationSec: number;
  getFrame: (elapsedSec: number) => CountdownFrame;
}

export function createCountdownClock(bpm: number, beats: number): CountdownClock {
  const beatDurationSec = 60 / bpm;
  const countdownDurationSec = beats * beatDurationSec;

  return {
    beatDurationSec,
    countdownDurationSec,
    getFrame: (elapsedSec: number) => {
      if (elapsedSec >= countdownDurationSec) {
        return { countdownValue: 0, beatActive: false, isDone: true };
      }

      const beatIndex = Math.floor(elapsedSec / beatDurationSec);
      const beatProgress = (elapsedSec % beatDurationSec) / beatDurationSec;
      const countdownValue = beats - beatIndex;
      const beatActive = beatProgress < 0.15;

      return {
        countdownValue: Math.max(1, countdownValue),
        beatActive,
        isDone: false,
      };
    },
  };
}

export function getSongTimeSec(audioTimeSec: number, playStartTimeSec: number, speed: number): number {
  return (audioTimeSec - playStartTimeSec) * speed;
}

export function getPlayStartTimeForSongTime(audioTimeSec: number, songTimeSec: number, speed: number): number {
  return audioTimeSec - songTimeSec / speed;
}

export function applyPauseToPlayStart(
  playStartTimeSec: number,
  pausedAtTimeSec: number,
  resumeAtTimeSec: number
): number {
  return playStartTimeSec + (resumeAtTimeSec - pausedAtTimeSec);
}

export function isActiveGameplayState(state: GameState): boolean {
  return state === 'playing' || state === 'countdown';
}

