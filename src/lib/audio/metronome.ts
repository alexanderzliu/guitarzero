// ============================================================================
// Metronome - Simple click sound using Web Audio
// ============================================================================

/**
 * Play a metronome click sound.
 * Uses an oscillator with quick decay for a percussive sound.
 */
export function playMetronomeClick(
  audioContext: AudioContext,
  frequency: number = 880,
  duration: number = 0.05
): void {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // Quick attack, quick decay for percussive sound
  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

/**
 * Schedule a metronome click at a specific time.
 */
export function scheduleMetronomeClick(
  audioContext: AudioContext,
  time: number,
  frequency: number = 880,
  duration: number = 0.05
): void {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.3, time);
  gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);

  oscillator.start(time);
  oscillator.stop(time + duration);
}
