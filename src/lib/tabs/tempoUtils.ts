import type { Tab, TempoEvent, Technique, ScoreResult } from '../../types';

// ============================================================================
// Tempo Map Utilities - Tick/Time Conversion
// ============================================================================

/**
 * Convert tick position to time in seconds, respecting tempo map.
 * Handles tempo changes by accumulating time through each segment.
 */
export function tickToSec(
  tick: number,
  tempoMap: TempoEvent[],
  ppq: number
): number {
  if (tempoMap.length === 0 || tick <= 0) return 0;

  let sec = 0;
  let prevTick = 0;
  let prevBpm = tempoMap[0].bpm;

  for (let i = 1; i < tempoMap.length; i++) {
    const tempo = tempoMap[i];
    if (tempo.tick >= tick) break;

    // Add time from previous segment
    const ticksInSegment = tempo.tick - prevTick;
    sec += ticksInSegment / ppq * (60 / prevBpm);
    prevTick = tempo.tick;
    prevBpm = tempo.bpm;
  }

  // Add remaining ticks at current tempo
  const remainingTicks = tick - prevTick;
  sec += remainingTicks / ppq * (60 / prevBpm);

  return sec;
}

/**
 * Convert time in seconds to tick position, respecting tempo map.
 * Inverse of tickToSec.
 */
export function secToTick(
  sec: number,
  tempoMap: TempoEvent[],
  ppq: number
): number {
  if (tempoMap.length === 0 || sec <= 0) return 0;

  let accumulatedSec = 0;
  let prevTick = 0;
  let prevBpm = tempoMap[0].bpm;

  for (let i = 1; i < tempoMap.length; i++) {
    const tempo = tempoMap[i];
    const ticksInSegment = tempo.tick - prevTick;
    const segmentDuration = ticksInSegment / ppq * (60 / prevBpm);

    if (accumulatedSec + segmentDuration >= sec) {
      // Target time is within this segment
      const remainingSec = sec - accumulatedSec;
      const ticksPerSec = (prevBpm / 60) * ppq;
      return prevTick + remainingSec * ticksPerSec;
    }

    accumulatedSec += segmentDuration;
    prevTick = tempo.tick;
    prevBpm = tempo.bpm;
  }

  // Past all tempo changes - use last BPM
  const remainingSec = sec - accumulatedSec;
  const ticksPerSec = (prevBpm / 60) * ppq;
  return prevTick + remainingSec * ticksPerSec;
}

/**
 * Get the BPM at a given tick position.
 */
export function getBpmAtTick(tick: number, tempoMap: TempoEvent[]): number {
  if (tempoMap.length === 0) return 120; // Fallback

  let bpm = tempoMap[0].bpm;
  for (const tempo of tempoMap) {
    if (tempo.tick > tick) break;
    bpm = tempo.bpm;
  }
  return bpm;
}

/**
 * Get seconds per beat at a given tick position.
 */
export function getSecondsPerBeat(tick: number, tempoMap: TempoEvent[]): number {
  const bpm = getBpmAtTick(tick, tempoMap);
  return 60 / bpm;
}

// ============================================================================
// Render Note Preparation
// ============================================================================

/**
 * A note prepared for rendering with pre-computed timing.
 */
export interface RenderNote {
  eventId: string;
  noteIndex: number; // Index within the event's notes array
  timeSec: number; // When note should be hit
  durationSec: number; // For sustained note rendering
  string: number; // 1-6 (1 = high E at top)
  fret: number;
  midi: number;
  technique?: Technique;
  isChord: boolean; // True if part of multi-note event
  hitResult?: ScoreResult; // Set when note is hit or missed
  hitTimestampSec?: number; // When the hit occurred (for animation)
}

/**
 * Flatten all tab notes into a sorted array with pre-computed timing.
 * Call this once when starting a game session.
 */
export function prepareRenderNotes(tab: Tab): RenderNote[] {
  const notes: RenderNote[] = [];

  for (const section of tab.sections) {
    for (const measure of section.measures) {
      for (const event of measure.events) {
        const timeSec = tickToSec(event.tick, tab.tempoMap, tab.ppq);
        const durationSec = tickToSec(
          event.tick + event.durationTicks,
          tab.tempoMap,
          tab.ppq
        ) - timeSec;

        const isChord = event.notes.length > 1;

        for (let i = 0; i < event.notes.length; i++) {
          const note = event.notes[i];
          notes.push({
            eventId: event.id,
            noteIndex: i,
            timeSec,
            durationSec,
            string: note.string,
            fret: note.fret,
            midi: note.midi,
            technique: event.technique,
            isChord,
          });
        }
      }
    }
  }

  // Sort by time (ascending)
  notes.sort((a, b) => a.timeSec - b.timeSec);

  return notes;
}

/**
 * Get notes visible in the current time window.
 * Uses binary search for efficiency with large note arrays.
 */
export function getVisibleNotes(
  notes: RenderNote[],
  currentTimeSec: number,
  lookAheadSec: number,
  lookBehindSec: number = 0.5
): RenderNote[] {
  if (notes.length === 0) return [];

  const windowStart = currentTimeSec - lookBehindSec;
  const windowEnd = currentTimeSec + lookAheadSec;

  // Binary search for first note >= windowStart
  let lo = 0;
  let hi = notes.length;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (notes[mid].timeSec < windowStart) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // lo is now the first index where notes[lo].timeSec >= windowStart
  // or notes.length if all notes are before windowStart

  // Quick exit if no notes in window
  if (lo >= notes.length || notes[lo].timeSec > windowEnd) {
    return [];
  }

  // Collect notes in window
  const visible: RenderNote[] = [];
  for (let i = lo; i < notes.length; i++) {
    const note = notes[i];
    if (note.timeSec > windowEnd) break;
    visible.push(note);
  }

  return visible;
}

/**
 * Get the total duration of the tab in seconds.
 */
export function getTabDuration(tab: Tab): number {
  let maxTick = 0;

  for (const section of tab.sections) {
    for (const measure of section.measures) {
      for (const event of measure.events) {
        const endTick = event.tick + event.durationTicks;
        if (endTick > maxTick) {
          maxTick = endTick;
        }
      }
    }
  }

  return tickToSec(maxTick, tab.tempoMap, tab.ppq);
}

/**
 * Format seconds as mm:ss display string.
 */
export function formatTime(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get time boundaries for a section by ID.
 * Returns start and end times in seconds.
 * Returns null if section not found or is empty (has no measures).
 */
export function getSectionTimeBounds(
  tab: Tab,
  sectionId: string
): { startSec: number; endSec: number } | null {
  const sectionIndex = tab.sections.findIndex((s) => s.id === sectionId);
  if (sectionIndex === -1) return null;

  const section = tab.sections[sectionIndex];
  if (section.measures.length === 0) return null;

  const startSec = tickToSec(section.startTick, tab.tempoMap, tab.ppq);
  const nextSection = tab.sections[sectionIndex + 1];

  // End is start of next section, or end of last event in this section
  if (nextSection) {
    const endSec = tickToSec(nextSection.startTick, tab.tempoMap, tab.ppq);
    return { startSec, endSec };
  }

  // Last section - find max tick from its measures
  let maxTick = section.startTick;
  for (const measure of section.measures) {
    for (const event of measure.events) {
      const endTick = event.tick + event.durationTicks;
      if (endTick > maxTick) maxTick = endTick;
    }
  }

  return { startSec, endSec: tickToSec(maxTick, tab.tempoMap, tab.ppq) };
}
