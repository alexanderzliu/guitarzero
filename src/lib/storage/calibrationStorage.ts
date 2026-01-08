// ============================================================================
// Calibration Storage - Per-device latency offset persistence
// ============================================================================

const STORAGE_KEY_PREFIX = 'guitar_calibration_';

export interface CalibrationData {
  offsetSec: number;
  calibratedAt: string; // ISO timestamp
  sampleCount: number;
}

/**
 * Get the storage key for a device
 */
function getStorageKey(deviceId: string | null): string {
  return `${STORAGE_KEY_PREFIX}${deviceId ?? 'default'}`;
}

/**
 * Save calibration data for a device
 */
export function saveCalibration(
  deviceId: string | null,
  offsetSec: number,
  sampleCount: number
): void {
  const data: CalibrationData = {
    offsetSec,
    calibratedAt: new Date().toISOString(),
    sampleCount,
  };
  localStorage.setItem(getStorageKey(deviceId), JSON.stringify(data));
}

/**
 * Load calibration data for a device
 */
export function loadCalibration(deviceId: string | null): CalibrationData | null {
  try {
    const stored = localStorage.getItem(getStorageKey(deviceId));
    if (!stored) return null;
    return JSON.parse(stored) as CalibrationData;
  } catch {
    return null;
  }
}

/**
 * Get just the offset value, defaulting to 0 if not calibrated
 */
export function getCalibrationOffset(deviceId: string | null): number {
  const data = loadCalibration(deviceId);
  return data?.offsetSec ?? 0;
}

/**
 * Clear calibration for a device
 */
export function clearCalibration(deviceId: string | null): void {
  localStorage.removeItem(getStorageKey(deviceId));
}

/**
 * Check if a device has been calibrated
 */
export function isCalibrated(deviceId: string | null): boolean {
  return loadCalibration(deviceId) !== null;
}
