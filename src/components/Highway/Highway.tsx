import { useRef, useEffect, useCallback } from 'react';
import type { GameState } from '../../types';
import type { RenderNote } from '../../lib/tabs/tempoUtils';
import {
  setupCanvas,
  renderFrame,
  renderIdleState,
  type RenderContext,
  type RenderFrameState,
} from '../../lib/rendering/highwayRenderer';

// ============================================================================
// Highway Component - Canvas-based Tab Display
// ============================================================================

interface HighwayProps {
  notes: RenderNote[];
  currentTimeSec: number;
  lookAheadSec: number;
  speed: number;
  gameState: GameState;
  countdownValue: number;
  beatActive: boolean;
  timeSinceLastOnsetSec?: number | null;
  lastOnsetMidi?: number | null;
  className?: string;
}

export function Highway({
  notes,
  currentTimeSec,
  lookAheadSec,
  speed,
  gameState,
  countdownValue,
  beatActive,
  timeSinceLastOnsetSec,
  lastOnsetMidi,
  className = '',
}: HighwayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const rafIdRef = useRef<number>(0);
  const renderRef = useRef<() => void>(() => {});

  // Store props in refs to avoid recreating render loop
  const propsRef = useRef({
    notes,
    currentTimeSec,
    lookAheadSec,
    speed,
    gameState,
    countdownValue,
    beatActive,
    timeSinceLastOnsetSec,
    lastOnsetMidi,
  });

  useEffect(() => {
    propsRef.current = {
      notes,
      currentTimeSec,
      lookAheadSec,
      speed,
      gameState,
      countdownValue,
      beatActive,
      timeSinceLastOnsetSec,
      lastOnsetMidi,
    };
  }, [notes, currentTimeSec, lookAheadSec, speed, gameState, countdownValue, beatActive, timeSinceLastOnsetSec, lastOnsetMidi]);

  /**
   * Setup canvas with correct dimensions
   */
  const setupCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    renderContextRef.current = setupCanvas(canvas, rect.width, rect.height);
  }, []);

  /**
   * Render loop
   */
  const render = useCallback(() => {
    const rc = renderContextRef.current;
    if (!rc) return;

    const props = propsRef.current;

    if (props.gameState === 'idle') {
      renderIdleState(rc);
    } else {
      const frameState: RenderFrameState = {
        notes: props.notes,
        currentTimeSec: props.currentTimeSec,
        lookAheadSec: props.lookAheadSec,
        speed: props.speed,
        gameState: props.gameState,
        countdownValue: props.countdownValue,
        beatActive: props.beatActive,
        timeSinceLastOnsetSec: props.timeSinceLastOnsetSec ?? undefined,
        lastOnsetMidi: props.lastOnsetMidi,
      };
      renderFrame(rc, frameState);
    }

    rafIdRef.current = requestAnimationFrame(() => renderRef.current());
  }, []);

  // Initialize canvas on mount
  useEffect(() => {
    setupCanvasSize();

    // Start render loop
    renderRef.current = render;
    rafIdRef.current = requestAnimationFrame(() => renderRef.current());

    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [setupCanvasSize, render]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setupCanvasSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvasSize]);

  // ResizeObserver for container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      setupCanvasSize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [setupCanvasSize]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
