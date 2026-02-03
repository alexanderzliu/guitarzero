import type { RenderNote } from '../tabs/tempoUtils';
import type { GameState, ScoreResult } from '../../types';
import { DEFAULT_TIMING_TOLERANCES } from '../scoring';

// ============================================================================
// Highway Renderer - "Garage Film" Aesthetic
// Inspired by The White Stripes' Under Blackpool Lights
// ============================================================================

/**
 * Color scheme - warmed analog palette.
 * String 1 (high E) at top to String 6 (low E) at bottom.
 */
export const STRING_COLORS = [
  '#65a30d', // String 1 (high E) - Lime green
  '#eab308', // String 2 (B) - Yellow
  '#f97316', // String 3 (G) - Orange
  '#0891b2', // String 4 (D) - Cyan
  '#a855f7', // String 5 (A) - Purple
  '#dc2626', // String 6 (low E) - Blood red
];

/**
 * Dimmed versions of string colors (for passed notes).
 */
export const STRING_COLORS_DIM = [
  '#365314', // String 1 dim
  '#713f12', // String 2 dim
  '#7c2d12', // String 3 dim
  '#164e63', // String 4 dim
  '#581c87', // String 5 dim
  '#7f1d1d', // String 6 dim
];

/**
 * Colors for hit results - warm analog feel.
 */
export const HIT_RESULT_COLORS: Record<ScoreResult, string> = {
  perfect: '#fbbf24', // Golden spotlight
  good: '#f5f0e6',    // Clean cream white
  ok: '#d97706',      // Amber warning
  miss: '#dc2626',    // Blood red
};

/**
 * Background colors for hit results.
 */
export const HIT_RESULT_BG_COLORS: Record<ScoreResult, string> = {
  perfect: '#92400e', // Deep amber
  good: '#57534e',    // Warm gray
  ok: '#78350f',      // Dark amber
  miss: '#450a0a',    // Dark blood
};

/**
 * Configuration for highway rendering.
 */
export interface HighwayConfig {
  hitZoneXPercent: number;
  stringPadding: number;
  noteWidth: number;
  noteHeight: number;
  showFretNumbers: boolean;
  backgroundColor: string;
  hitZoneColor: string;
  stringLineColor: string;
}

export const DEFAULT_HIGHWAY_CONFIG: HighwayConfig = {
  hitZoneXPercent: 0.12,
  stringPadding: 24,
  noteWidth: 44,
  noteHeight: 36,
  showFretNumbers: true,
  backgroundColor: '#0a0a0a', // Void black
  hitZoneColor: '#dc2626',    // Blood red hit zone
  stringLineColor: '#1a1614', // Barely visible warm black
};

const NOTE_PASSED_THRESHOLD_SEC = 0.1;
const HIT_ANIMATION_DURATION_SEC = 0.25;

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
  countdownValue: number;
  beatActive: boolean;
  timeSinceLastOnsetSec?: number;
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
    alpha: false,
    desynchronized: true
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
 */
function getStringY(
  stringNum: number,
  height: number,
  padding: number
): number {
  const usableHeight = height - padding * 2;
  const stringSpacing = usableHeight / 5;
  return padding + (stringNum - 1) * stringSpacing;
}

/**
 * Get X position for a note based on timing.
 */
function getNoteX(
  noteTimeSec: number,
  currentTimeSec: number,
  lookAheadSec: number,
  speed: number,
  width: number,
  hitZoneX: number
): number {
  const visualLookAhead = lookAheadSec / speed;
  const timeUntilHit = noteTimeSec - currentTimeSec;
  const progress = timeUntilHit / visualLookAhead;
  const travelWidth = width - hitZoneX;
  return hitZoneX + progress * travelWidth;
}

/**
 * Clear the canvas with background color and subtle gradient.
 */
function clearCanvas(rc: RenderContext): void {
  const { ctx, width, height, config } = rc;

  // Base black
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Subtle warm gradient from left (stage light effect)
  const gradient = ctx.createLinearGradient(0, 0, width * 0.4, 0);
  gradient.addColorStop(0, 'rgba(220, 38, 38, 0.03)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw the 6 string lane lines - subtle, barely visible.
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
 * Blood red glow, the heart of the stage.
 */
function drawHitZone(rc: RenderContext, state?: RenderFrameState): void {
  const { ctx, width, height, config } = rc;
  const hitZoneX = width * config.hitZoneXPercent;

  // Draw timing window bands if we have state info
  if (state && state.lookAheadSec > 0 && state.speed > 0) {
    const visualLookAhead = state.lookAheadSec / state.speed;
    const travelWidth = width - hitZoneX;
    const msToPixels = (ms: number) => (ms / 1000 / visualLookAhead) * travelWidth;

    const okWidth = msToPixels(DEFAULT_TIMING_TOLERANCES.okMs);
    const goodWidth = msToPixels(DEFAULT_TIMING_TOLERANCES.goodMs);
    const perfectWidth = msToPixels(DEFAULT_TIMING_TOLERANCES.perfectMs);

    // OK band - very subtle
    ctx.fillStyle = 'rgba(220, 38, 38, 0.04)';
    ctx.fillRect(hitZoneX - okWidth, 0, okWidth * 2, height);

    // Good band
    ctx.fillStyle = 'rgba(220, 38, 38, 0.06)';
    ctx.fillRect(hitZoneX - goodWidth, 0, goodWidth * 2, height);

    // Perfect band - warmest
    ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
    ctx.fillRect(hitZoneX - perfectWidth, 0, perfectWidth * 2, height);
  }

  // Draw onset flash effect - bright red flash when note attack detected
  const ONSET_FLASH_DURATION = 0.12;
  if (state?.timeSinceLastOnsetSec !== undefined && state.timeSinceLastOnsetSec < ONSET_FLASH_DURATION) {
    const flashIntensity = 1 - (state.timeSinceLastOnsetSec / ONSET_FLASH_DURATION);
    const flashAlpha = flashIntensity * 0.5;

    ctx.fillStyle = `rgba(220, 38, 38, ${flashAlpha})`;
    const flashWidth = state.lookAheadSec > 0 && state.speed > 0
      ? ((DEFAULT_TIMING_TOLERANCES.okMs / 1000) / (state.lookAheadSec / state.speed)) * (width - hitZoneX)
      : 30;
    ctx.fillRect(hitZoneX - flashWidth, 0, flashWidth * 2, height);
  }

  // Draw the center hit line with RED GLOW
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 25;

  ctx.strokeStyle = config.hitZoneColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hitZoneX, 0);
  ctx.lineTo(hitZoneX, height);
  ctx.stroke();

  // Second pass for more intense core
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hitZoneX, 0);
  ctx.lineTo(hitZoneX, height);
  ctx.stroke();

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
  glowIntensity: number;
}

/**
 * Determine note style based on its state.
 */
function getNoteStyle(
  note: RenderNote,
  isPassed: boolean
): NoteStyle {
  const colorIdx = note.string - 1;

  if (note.hitResult) {
    const glowIntensity = note.hitResult === 'perfect' ? 30 :
                          note.hitResult === 'good' ? 20 :
                          note.hitResult === 'ok' ? 15 : 0;
    return {
      fillColor: HIT_RESULT_BG_COLORS[note.hitResult],
      borderColor: HIT_RESULT_COLORS[note.hitResult],
      borderWidth: note.hitResult === 'miss' ? 2 : 3,
      textColor: note.hitResult === 'miss' ? '#fca5a5' : '#ffffff',
      glowColor: note.hitResult !== 'miss' ? HIT_RESULT_COLORS[note.hitResult] : null,
      glowIntensity,
    };
  }

  if (isPassed) {
    return {
      fillColor: STRING_COLORS_DIM[colorIdx],
      borderColor: '#292524',
      borderWidth: 1,
      textColor: '#57534e',
      glowColor: null,
      glowIntensity: 0,
    };
  }

  // Normal upcoming note - slight glow as it approaches
  return {
    fillColor: STRING_COLORS[colorIdx],
    borderColor: '#f5f0e6',
    borderWidth: 2,
    textColor: '#ffffff',
    glowColor: STRING_COLORS[colorIdx],
    glowIntensity: 8,
  };
}

/**
 * Calculate animation scale for a hit note.
 */
function getHitAnimationScale(
  note: RenderNote,
  currentTimeSec: number
): number {
  if (!note.hitResult || note.hitResult === 'miss' || note.hitTimestampSec === undefined) {
    return 1.0;
  }

  const elapsed = currentTimeSec - note.hitTimestampSec;
  const isWithinAnimationWindow = elapsed >= 0 && elapsed <= HIT_ANIMATION_DURATION_SEC;
  if (!isWithinAnimationWindow) {
    return 1.0;
  }

  const progress = elapsed / HIT_ANIMATION_DURATION_SEC;
  return 1.0 + Math.sin(progress * Math.PI) * 0.35;
}

/**
 * Draw a single note with analog warmth.
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
  const style = getNoteStyle(note, isPassed);

  const scale = getHitAnimationScale(note, currentTimeSec);
  const isAnimating = scale > 1.0;

  const noteW = config.noteWidth * scale;
  const noteH = config.noteHeight * scale;
  const noteX = x - noteW / 2;
  const noteY = y - noteH / 2;
  const radius = 4 * scale;

  // Apply glow
  if (style.glowColor && style.glowIntensity > 0) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = isAnimating ? style.glowIntensity * 2 : style.glowIntensity;
  }

  // Draw rounded rectangle
  ctx.fillStyle = style.fillColor;
  ctx.beginPath();
  ctx.roundRect(noteX, noteY, noteW, noteH, radius);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = style.borderColor;
  ctx.lineWidth = style.borderWidth;
  ctx.stroke();

  // Reset shadow
  if (style.glowColor) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // Draw fret number
  if (config.showFretNumbers) {
    ctx.fillStyle = style.textColor;
    ctx.font = `bold ${Math.round(18 * scale)}px 'Barlow', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(note.fret.toString(), x, y);
  }

  // Draw technique indicator for non-hit notes
  if (note.technique && !isPassed && !note.hitResult) {
    const techLabel = getTechniqueLabel(note.technique);
    ctx.fillStyle = '#d97706';
    ctx.font = "bold 10px 'Barlow', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(techLabel, x, noteY - 6);
  }

  // Draw hit result label
  if (note.hitResult) {
    const resultLabel = note.hitResult.toUpperCase();
    ctx.fillStyle = HIT_RESULT_COLORS[note.hitResult];
    ctx.font = `bold ${Math.round(11 * scale)}px 'Bebas Neue', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(resultLabel, x, noteY - 8 * scale);
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

    if (x < -config.noteWidth || x > width + config.noteWidth) continue;

    const isPassed = note.timeSec < state.currentTimeSec - NOTE_PASSED_THRESHOLD_SEC;
    drawNote(rc, note, x, isPassed, state.currentTimeSec);
  }
}

/**
 * Draw countdown overlay - dramatic, stage-lit.
 */
function drawCountdown(rc: RenderContext, value: number, beatActive: boolean): void {
  const { ctx, width, height } = rc;

  // Dark backdrop
  ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
  ctx.fillRect(0, 0, width, height);

  // Red spotlight effect when beat active
  if (beatActive) {
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, height * 0.6
    );
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0.3)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // Countdown number with glow
  if (beatActive) {
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 60;
  }

  ctx.fillStyle = beatActive ? '#dc2626' : '#f5f0e6';
  ctx.font = "bold 160px 'Bebas Neue', Impact, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value.toString(), width / 2, height / 2);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Instruction text
  ctx.fillStyle = '#78716c';
  ctx.font = "18px 'Barlow', sans-serif";
  ctx.fillText('GET READY', width / 2, height / 2 + 100);
}

/**
 * Draw pause overlay.
 */
function drawPauseOverlay(rc: RenderContext): void {
  const { ctx, width, height } = rc;

  ctx.fillStyle = 'rgba(10, 10, 10, 0.9)';
  ctx.fillRect(0, 0, width, height);

  // Pause icon - two vertical bars
  const barWidth = 24;
  const barHeight = 80;
  const gap = 24;
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(centerX - gap - barWidth, centerY - barHeight / 2, barWidth, barHeight);
  ctx.fillRect(centerX + gap, centerY - barHeight / 2, barWidth, barHeight);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Text
  ctx.fillStyle = '#f5f0e6';
  ctx.font = "36px 'Bebas Neue', Impact, sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', centerX, centerY + 80);

  ctx.fillStyle = '#78716c';
  ctx.font = "14px 'Barlow', sans-serif";
  ctx.fillText('Press Space to resume', centerX, centerY + 110);
}

/**
 * Draw "finished" overlay.
 */
function drawFinishedOverlay(rc: RenderContext): void {
  const { ctx, width, height } = rc;

  ctx.fillStyle = 'rgba(10, 10, 10, 0.9)';
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2 - 20;

  // Glowing checkmark circle
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Checkmark
  ctx.strokeStyle = '#f5f0e6';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX - 18, centerY);
  ctx.lineTo(centerX - 6, centerY + 15);
  ctx.lineTo(centerX + 22, centerY - 15);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#f5f0e6';
  ctx.font = "48px 'Bebas Neue', Impact, sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('COMPLETE', centerX, centerY + 100);
}

/**
 * Main render function - draws a complete frame.
 */
export function renderFrame(rc: RenderContext, state: RenderFrameState): void {
  clearCanvas(rc);
  drawStringLines(rc);
  drawHitZone(rc, state);
  drawNotes(rc, state);

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

  ctx.fillStyle = '#78716c';
  ctx.font = "24px 'Bebas Neue', Impact, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRESS PLAY TO START', width / 2, height / 2);
}
