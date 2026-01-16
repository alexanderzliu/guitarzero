import type { RenderNote } from '../tabs/tempoUtils';
import type { GameState, ScoreResult } from '../../types';

// ============================================================================
// Highway Renderer - Pure Canvas Drawing Functions
// ============================================================================

/**
 * Color scheme for guitar strings (standard Guitar Hero style).
 * String 1 (high E) at top to String 6 (low E) at bottom.
 */
export const STRING_COLORS = [
  '#22c55e', // String 1 (high E) - Green
  '#eab308', // String 2 (B) - Yellow
  '#f97316', // String 3 (G) - Orange
  '#3b82f6', // String 4 (D) - Blue
  '#8b5cf6', // String 5 (A) - Purple
  '#ef4444', // String 6 (low E) - Red
];

/**
 * Dimmed versions of string colors (for passed notes).
 */
export const STRING_COLORS_DIM = [
  '#166534', // String 1 dim
  '#854d0e', // String 2 dim
  '#9a3412', // String 3 dim
  '#1e40af', // String 4 dim
  '#5b21b6', // String 5 dim
  '#991b1b', // String 6 dim
];

/**
 * Colors for hit results (applied as glow/border).
 */
export const HIT_RESULT_COLORS: Record<ScoreResult, string> = {
  perfect: '#22d3ee', // cyan-400 - bright flash
  good: '#4ade80', // green-400
  ok: '#facc15', // yellow-400
  miss: '#f87171', // red-400
};

/**
 * Background colors for hit results.
 */
export const HIT_RESULT_BG_COLORS: Record<ScoreResult, string> = {
  perfect: '#0891b2', // cyan-600
  good: '#16a34a', // green-600
  ok: '#ca8a04', // yellow-600
  miss: '#dc2626', // red-600
};

/**
 * Configuration for highway rendering.
 */
export interface HighwayConfig {
  hitZoneXPercent: number; // Where hit zone line is (0-1), default 0.12
  stringPadding: number; // Pixels padding top/bottom
  noteWidth: number; // Base note width in pixels
  noteHeight: number; // Note height in pixels
  showFretNumbers: boolean;
  backgroundColor: string;
  hitZoneColor: string;
  stringLineColor: string;
}

export const DEFAULT_HIGHWAY_CONFIG: HighwayConfig = {
  hitZoneXPercent: 0.12,
  stringPadding: 20,
  noteWidth: 40,
  noteHeight: 32,
  showFretNumbers: true,
  backgroundColor: '#0f172a', // slate-900
  hitZoneColor: '#ffffff',
  stringLineColor: '#334155', // slate-700
};

const NOTE_PASSED_THRESHOLD_SEC = 0.1; // Time after hit zone to consider note "passed"
const HIT_ANIMATION_DURATION_SEC = 0.2; // Duration of hit pulse animation

// Timing tolerances in milliseconds (must match hitDetection.ts)
const TIMING_PERFECT_MS = 50;
const TIMING_GOOD_MS = 100;
const TIMING_OK_MS = 200;

/**
 * Context passed to render functions.
 */
export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  config: HighwayConfig;
}

/**
 * State for a single render frame.
 */
export interface RenderFrameState {
  notes: RenderNote[];
  currentTimeSec: number;
  lookAheadSec: number;
  speed: number;
  gameState: GameState;
  countdownValue: number; // 3, 2, 1, 0
  beatActive: boolean; // Flash during countdown
  // Onset feedback: time since last onset in seconds (for visual flash)
  timeSinceLastOnsetSec?: number;
  // Detected pitch info for debug display
  lastOnsetMidi?: number | null;
}

/**
 * Initialize canvas with device pixel ratio for crisp rendering.
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): RenderContext {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d', {
    alpha: false,        // No transparency needed - faster compositing
    desynchronized: true // Reduce latency on supported browsers
  });
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }
  ctx.scale(dpr, dpr);

  return {
    canvas,
    ctx,
    width,
    height,
    config: { ...DEFAULT_HIGHWAY_CONFIG },
  };
}

/**
 * Get Y position for a string (1-6).
 * String 1 (high E) at top, String 6 (low E) at bottom.
 */
function getStringY(
  stringNum: number,
  height: number,
  padding: number
): number {
  const usableHeight = height - padding * 2;
  const stringSpacing = usableHeight / 5; // 5 gaps for 6 strings
  return padding + (stringNum - 1) * stringSpacing;
}

/**
 * Get X position for a note based on timing.
 * Notes scroll from right to left, hit zone is on the left.
 */
function getNoteX(
  noteTimeSec: number,
  currentTimeSec: number,
  lookAheadSec: number,
  speed: number,
  width: number,
  hitZoneX: number
): number {
  // Adjust look-ahead by speed (slower = more visual time)
  const visualLookAhead = lookAheadSec / speed;
  const timeUntilHit = noteTimeSec - currentTimeSec;

  // 0 = at hit zone, 1 = at right edge
  const progress = timeUntilHit / visualLookAhead;

  // Map to screen X
  const travelWidth = width - hitZoneX;
  return hitZoneX + progress * travelWidth;
}

/**
 * Clear the canvas with background color.
 */
function clearCanvas(rc: RenderContext): void {
  rc.ctx.fillStyle = rc.config.backgroundColor;
  rc.ctx.fillRect(0, 0, rc.width, rc.height);
}

/**
 * Draw the 6 string lane lines.
 */
function drawStringLines(rc: RenderContext): void {
  const { ctx, width, height, config } = rc;

  ctx.strokeStyle = config.stringLineColor;
  ctx.lineWidth = 1;

  for (let s = 1; s <= 6; s++) {
    const y = getStringY(s, height, config.stringPadding);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

/**
 * Draw the hit zone with timing window visualization.
 * Shows colored bands for OK, Good, and Perfect timing windows.
 */
function drawHitZone(rc: RenderContext, state?: RenderFrameState): void {
  const { ctx, width, height, config } = rc;
  const hitZoneX = width * config.hitZoneXPercent;

  // Draw timing window bands if we have state info
  if (state && state.lookAheadSec > 0 && state.speed > 0) {
    // Calculate pixel width for timing windows based on current speed and look-ahead
    const visualLookAhead = state.lookAheadSec / state.speed;
    const travelWidth = width - hitZoneX;
    const msToPixels = (ms: number) => (ms / 1000 / visualLookAhead) * travelWidth;

    const okWidth = msToPixels(TIMING_OK_MS);
    const goodWidth = msToPixels(TIMING_GOOD_MS);
    const perfectWidth = msToPixels(TIMING_PERFECT_MS);

    // Draw timing window bands (back to front: OK -> Good -> Perfect)
    // OK band (outermost) - subtle blue
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'; // blue-500 at 8%
    ctx.fillRect(hitZoneX - okWidth, 0, okWidth * 2, height);

    // Good band - slightly brighter
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'; // green-500 at 10%
    ctx.fillRect(hitZoneX - goodWidth, 0, goodWidth * 2, height);

    // Perfect band - brightest center
    ctx.fillStyle = 'rgba(250, 204, 21, 0.15)'; // yellow-400 at 15%
    ctx.fillRect(hitZoneX - perfectWidth, 0, perfectWidth * 2, height);
  }

  // Draw onset flash effect when a note attack is detected
  const ONSET_FLASH_DURATION = 0.15; // 150ms flash
  if (state?.timeSinceLastOnsetSec !== undefined && state.timeSinceLastOnsetSec < ONSET_FLASH_DURATION) {
    const flashIntensity = 1 - (state.timeSinceLastOnsetSec / ONSET_FLASH_DURATION);
    const flashAlpha = flashIntensity * 0.4;

    // Flash the entire hit zone area
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    const flashWidth = state.lookAheadSec > 0 && state.speed > 0
      ? ((TIMING_OK_MS / 1000) / (state.lookAheadSec / state.speed)) * (width - hitZoneX)
      : 30;
    ctx.fillRect(hitZoneX - flashWidth, 0, flashWidth * 2, height);
  }

  // Draw the center hit line with glow
  ctx.shadowColor = config.hitZoneColor;
  ctx.shadowBlur = 10;

  ctx.strokeStyle = config.hitZoneColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hitZoneX, 0);
  ctx.lineTo(hitZoneX, height);
  ctx.stroke();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/**
 * Style properties for rendering a note.
 */
interface NoteStyle {
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  glowColor: string | null;
}

/**
 * Determine note style based on its state (hit result, passed, or upcoming).
 */
function getNoteStyle(
  note: RenderNote,
  isPassed: boolean
): NoteStyle {
  const colorIdx = note.string - 1;

  if (note.hitResult) {
    // Note has been scored - use hit result colors
    return {
      fillColor: HIT_RESULT_BG_COLORS[note.hitResult],
      borderColor: HIT_RESULT_COLORS[note.hitResult],
      borderWidth: note.hitResult === 'miss' ? 2 : 3,
      textColor: '#ffffff',
      glowColor: note.hitResult !== 'miss' ? HIT_RESULT_COLORS[note.hitResult] : null,
    };
  }

  if (isPassed) {
    // Passed without being scored (shouldn't happen often)
    return {
      fillColor: STRING_COLORS_DIM[colorIdx],
      borderColor: '#475569',
      borderWidth: 1,
      textColor: '#64748b',
      glowColor: null,
    };
  }

  // Normal upcoming note
  return {
    fillColor: STRING_COLORS[colorIdx],
    borderColor: '#ffffff',
    borderWidth: 2,
    textColor: '#ffffff',
    glowColor: null,
  };
}

/**
 * Calculate animation scale for a hit note.
 * Returns a scale from 1.0 -> 1.3 -> 1.0 over HIT_ANIMATION_DURATION_SEC.
 */
function getHitAnimationScale(
  note: RenderNote,
  currentTimeSec: number
): number {
  // Skip animation for misses or notes without hit timestamps
  // Use explicit undefined check since hitTimestampSec can be 0 (valid at loop start)
  if (!note.hitResult || note.hitResult === 'miss' || note.hitTimestampSec === undefined) {
    return 1.0;
  }

  const elapsed = currentTimeSec - note.hitTimestampSec;
  const isWithinAnimationWindow = elapsed >= 0 && elapsed <= HIT_ANIMATION_DURATION_SEC;
  if (!isWithinAnimationWindow) {
    return 1.0;
  }

  // Sine wave pulse: 0->pi over duration, sin goes 0->1->0
  const progress = elapsed / HIT_ANIMATION_DURATION_SEC;
  return 1.0 + Math.sin(progress * Math.PI) * 0.3;
}

/**
 * Draw a single note.
 */
function drawNote(
  rc: RenderContext,
  note: RenderNote,
  x: number,
  isPassed: boolean,
  currentTimeSec: number
): void {
  const { ctx, height, config } = rc;
  const y = getStringY(note.string, height, config.stringPadding);
  const { fillColor, borderColor, borderWidth, textColor, glowColor } = getNoteStyle(note, isPassed);

  // Calculate animation scale for hit notes
  const scale = getHitAnimationScale(note, currentTimeSec);
  const isAnimating = scale > 1.0;

  // Note dimensions (apply scale for animation)
  const noteW = config.noteWidth * scale;
  const noteH = config.noteHeight * scale;
  const noteX = x - noteW / 2;
  const noteY = y - noteH / 2;
  const radius = 6 * scale;

  // Apply glow effect for hit notes (enhanced during animation)
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isAnimating ? 25 : 15;
  }

  // Draw rounded rectangle
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.roundRect(noteX, noteY, noteW, noteH, radius);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  // Reset shadow
  if (glowColor) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // Draw fret number
  if (config.showFretNumbers) {
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(note.fret.toString(), x, y);
  }

  // Draw technique indicator (small badge) for non-hit notes
  if (note.technique && !isPassed && !note.hitResult) {
    const techLabel = getTechniqueLabel(note.technique);
    ctx.fillStyle = '#c084fc'; // purple-400
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(techLabel, x, noteY - 4);
  }

  // Draw hit result label for scored notes
  if (note.hitResult) {
    const resultLabel = note.hitResult.toUpperCase();
    ctx.fillStyle = HIT_RESULT_COLORS[note.hitResult];
    ctx.font = `bold ${Math.round(10 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(resultLabel, x, noteY - 6 * scale);
  }
}

/**
 * Get short label for technique.
 */
function getTechniqueLabel(technique: string): string {
  const labels: Record<string, string> = {
    'bend': 'B',
    'slide': 'S',
    'hammer-on': 'H',
    'pull-off': 'P',
    'vibrato': '~',
    'mute': 'X',
  };
  return labels[technique] || '';
}

/**
 * Draw all visible notes.
 */
function drawNotes(rc: RenderContext, state: RenderFrameState): void {
  const { width, config } = rc;
  const hitZoneX = width * config.hitZoneXPercent;

  for (const note of state.notes) {
    const x = getNoteX(
      note.timeSec,
      state.currentTimeSec,
      state.lookAheadSec,
      state.speed,
      width,
      hitZoneX
    );

    // Skip notes that are too far off screen
    if (x < -config.noteWidth || x > width + config.noteWidth) continue;

    const isPassed = note.timeSec < state.currentTimeSec - NOTE_PASSED_THRESHOLD_SEC;
    drawNote(rc, note, x, isPassed, state.currentTimeSec);
  }
}

/**
 * Draw countdown overlay.
 */
function drawCountdown(rc: RenderContext, value: number, beatActive: boolean): void {
  const { ctx, width, height } = rc;

  // Semi-transparent backdrop
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; // slate-900 with alpha
  ctx.fillRect(0, 0, width, height);

  // Countdown number with glow when beat active
  if (beatActive) {
    ctx.shadowColor = '#fbbf24'; // amber-400
    ctx.shadowBlur = 40;
  }

  ctx.fillStyle = beatActive ? '#fbbf24' : '#ffffff';
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value.toString(), width / 2, height / 2);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Instruction text
  ctx.fillStyle = '#94a3b8'; // slate-400
  ctx.font = '18px sans-serif';
  ctx.fillText('Get ready...', width / 2, height / 2 + 80);
}

/**
 * Draw pause overlay.
 */
function drawPauseOverlay(rc: RenderContext): void {
  const { ctx, width, height } = rc;

  // Dim backdrop
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.fillRect(0, 0, width, height);

  // Pause icon (two vertical bars)
  const barWidth = 20;
  const barHeight = 60;
  const gap = 20;
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(centerX - gap - barWidth, centerY - barHeight / 2, barWidth, barHeight);
  ctx.fillRect(centerX + gap, centerY - barHeight / 2, barWidth, barHeight);

  // Text
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', centerX, centerY + 60);
  ctx.font = '14px sans-serif';
  ctx.fillText('Press Space to resume', centerX, centerY + 85);
}

/**
 * Draw "finished" overlay.
 */
function drawFinishedOverlay(rc: RenderContext): void {
  const { ctx, width, height } = rc;

  // Backdrop
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, 0, width, height);

  // Checkmark circle
  const centerX = width / 2;
  const centerY = height / 2 - 20;

  ctx.fillStyle = '#22c55e'; // green-500
  ctx.beginPath();
  ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
  ctx.fill();

  // Checkmark
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX - 15, centerY);
  ctx.lineTo(centerX - 5, centerY + 12);
  ctx.lineTo(centerX + 18, centerY - 12);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Song Complete!', centerX, centerY + 80);
}

/**
 * Main render function - draws a complete frame.
 */
export function renderFrame(rc: RenderContext, state: RenderFrameState): void {
  // Always draw base elements
  clearCanvas(rc);
  drawStringLines(rc);
  drawHitZone(rc, state);
  drawNotes(rc, state);

  // Draw overlays based on game state
  switch (state.gameState) {
    case 'countdown':
      if (state.countdownValue > 0) {
        drawCountdown(rc, state.countdownValue, state.beatActive);
      }
      break;
    case 'paused':
      drawPauseOverlay(rc);
      break;
    case 'finished':
      drawFinishedOverlay(rc);
      break;
  }
}

/**
 * Draw idle state (before game starts).
 */
export function renderIdleState(rc: RenderContext): void {
  clearCanvas(rc);
  drawStringLines(rc);
  drawHitZone(rc);

  const { ctx, width, height } = rc;

  // Instruction text
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Press Play to start', width / 2, height / 2);
}
