import type { Tab, LoopConfig } from '../../types';
import { getSectionTimeBounds } from '../../lib/tabs/tempoUtils';
import { getPlayStartTimeForSongTime } from './clock';

export function buildLoopConfig(tab: Tab, sectionId: string): LoopConfig | null {
  const section = tab.sections.find((s) => s.id === sectionId);
  const bounds = getSectionTimeBounds(tab, sectionId);
  if (!section || !bounds) return null;

  return {
    sectionId,
    sectionName: section.name,
    startSec: bounds.startSec,
    endSec: bounds.endSec,
  };
}

export function shouldRestartLoop(loopConfig: LoopConfig | null, songTimeSec: number): boolean {
  return !!loopConfig && songTimeSec >= loopConfig.endSec;
}

export function getLoopStartSec(loopConfig: LoopConfig | null): number {
  return loopConfig?.startSec ?? 0;
}

export function computeLoopRestart(params: {
  audioTimeSec: number;
  loopConfig: LoopConfig;
  speed: number;
}): { songTimeSec: number; playStartTimeSec: number } {
  const songTimeSec = params.loopConfig.startSec;
  const playStartTimeSec = getPlayStartTimeForSongTime(params.audioTimeSec, songTimeSec, params.speed);
  return { songTimeSec, playStartTimeSec };
}

