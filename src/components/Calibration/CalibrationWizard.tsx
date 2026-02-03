import { useCalibration } from '../../hooks/useCalibration';
import { loadCalibration } from '../../lib/storage/calibrationStorage';

// ============================================================================
// Calibration Wizard - "Garage Film" Aesthetic
// ============================================================================

interface CalibrationWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function CalibrationWizard({ onComplete, onCancel }: CalibrationWizardProps) {
  const calibration = useCalibration();

  const handleSaveAndFinish = () => {
    calibration.saveAndFinish();
    onComplete();
  };

  const handleCancel = () => {
    calibration.cancelCalibration();
    calibration.stopAudio();
    onCancel();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-[#f5f0e6] tracking-wide mb-2">
            LATENCY CALIBRATION
          </h1>
          <p className="text-[#78716c]">
            Calibrate your audio input to ensure accurate timing detection
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-[#1a1614] border border-[#292524] rounded p-6">
          {calibration.phase === 'idle' && (
            <IdlePhase
              calibration={calibration}
              onCancel={handleCancel}
            />
          )}

          {(calibration.phase === 'countdown' || calibration.phase === 'listening') && (
            <ActivePhase calibration={calibration} />
          )}

          {calibration.phase === 'processing' && (
            <ProcessingPhase />
          )}

          {calibration.phase === 'results' && (
            <ResultsPhase
              calibration={calibration}
              onSave={handleSaveAndFinish}
              onRetry={() => calibration.startCalibration()}
            />
          )}

          {calibration.phase === 'error' && (
            <ErrorPhase
              error={calibration.error}
              onRetry={() => calibration.startCalibration()}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Phase Components
// ============================================================================

interface IdlePhaseProps {
  calibration: ReturnType<typeof useCalibration>;
  onCancel: () => void;
}

function IdlePhase({ calibration, onCancel }: IdlePhaseProps) {
  const existingCalibration = loadCalibration(calibration.selectedDeviceId);

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="space-y-4 text-[#d6d3cd]">
        <p>
          This wizard will measure the latency of your audio input so timing
          detection is accurate during gameplay.
        </p>
        <div className="bg-[#0a0a0a] border border-[#292524] rounded p-4 space-y-2">
          <p className="font-semibold text-[#f5f0e6]">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-[#78716c]">
            <li>Connect your guitar and start audio capture</li>
            <li>Watch for the visual flash (8 beats)</li>
            <li>Strum your guitar exactly when each flash appears</li>
            <li>We'll calculate the timing offset automatically</li>
          </ol>
        </div>
      </div>

      {/* Existing Calibration Notice */}
      {existingCalibration && (
        <div className="bg-[#0a0a0a] border border-[#d97706] rounded p-3">
          <p className="text-[#d97706] text-sm">
            Current calibration: <span className="font-mono text-[#f5f0e6]">{(existingCalibration.offsetSec * 1000).toFixed(1)}ms</span>
            <br />
            <span className="text-[#92400e] text-xs">
              Calibrated {new Date(existingCalibration.calibratedAt).toLocaleDateString()}
            </span>
          </p>
        </div>
      )}

      {/* Device Selection */}
      <div className="space-y-2">
        <label className="text-sm text-[#78716c]">Audio Input Device</label>
        <select
          className="w-full bg-[#0a0a0a] text-[#f5f0e6] border border-[#292524] rounded px-3 py-2 focus:outline-none focus:border-[#d97706] focus:shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-all"
          value={calibration.selectedDeviceId || ''}
          onChange={(e) => calibration.selectDevice(e.target.value || null)}
          disabled={calibration.isAudioRunning}
        >
          <option value="">Default Device</option>
          {calibration.devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Device ${device.deviceId.slice(0, 8)}...`}
            </option>
          ))}
        </select>
      </div>

      {/* Audio Status / Start Button */}
      {!calibration.isAudioRunning ? (
        <button
          onClick={calibration.startAudio}
          disabled={calibration.isAudioStarting}
          className="w-full py-3 px-4 bg-[#292524] hover:bg-[#dc2626] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] disabled:bg-[#292524] disabled:opacity-50 text-[#f5f0e6] rounded font-semibold transition-all"
        >
          {calibration.isAudioStarting ? 'Starting Audio...' : 'Start Audio'}
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-[#d97706] rounded">
          <span className="w-3 h-3 bg-[#d97706] rounded-full animate-pulse shadow-[0_0_10px_rgba(217,119,6,0.6)]" />
          <span className="text-[#d97706]">Audio is running</span>
        </div>
      )}

      {/* Audio Error */}
      {calibration.audioError && (
        <div className="p-3 bg-[#0a0a0a] border border-[#dc2626] rounded text-[#dc2626] text-sm">
          {calibration.audioError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-[#292524] hover:bg-[#1a1614] border border-[#292524] hover:border-[#78716c] text-[#78716c] hover:text-[#f5f0e6] rounded transition-all"
        >
          Cancel
        </button>
        <button
          onClick={calibration.startCalibration}
          disabled={!calibration.isAudioRunning}
          className="flex-1 py-2 px-4 bg-[#dc2626] hover:bg-[#ef4444] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] disabled:bg-[#991b1b] disabled:opacity-50 text-[#f5f0e6] rounded font-semibold transition-all"
        >
          Begin Calibration
        </button>
      </div>
    </div>
  );
}

interface ActivePhaseProps {
  calibration: ReturnType<typeof useCalibration>;
}

function ActivePhase({ calibration }: ActivePhaseProps) {
  const isCountdown = calibration.phase === 'countdown';
  const totalBeats = 8;

  return (
    <div className="space-y-8 py-4">
      {/* Phase Indicator */}
      <div className="text-center">
        <p className="text-[#78716c] text-sm mb-2">
          {isCountdown ? 'Get ready...' : 'Strum on each flash!'}
        </p>
        <p className="text-6xl font-display text-[#f5f0e6] tracking-wide">
          {isCountdown ? calibration.countdownValue : `${calibration.currentBeat + 1}/${totalBeats}`}
        </p>
      </div>

      {/* Beat Flash Indicator */}
      <div className="flex justify-center">
        <div
          className={`w-32 h-32 rounded-full transition-all duration-75 ${
            calibration.beatActive
              ? 'bg-[#fbbf24] shadow-[0_0_60px_20px_rgba(251,191,36,0.5)] scale-110'
              : 'bg-[#292524]'
          }`}
        />
      </div>

      {/* Progress */}
      {!isCountdown && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#78716c]">
            <span>Progress</span>
            <span className="font-mono">{calibration.collectedSamples} strums detected</span>
          </div>
          <div className="h-2 bg-[#0a0a0a] rounded overflow-hidden">
            <div
              className="h-full bg-[#dc2626] transition-all duration-300"
              style={{ width: `${((calibration.currentBeat + 1) / totalBeats) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Cancel Button */}
      <button
        onClick={calibration.cancelCalibration}
        className="w-full py-2 px-4 bg-[#292524] hover:bg-[#1a1614] border border-[#292524] hover:border-[#78716c] text-[#78716c] hover:text-[#f5f0e6] rounded transition-all"
      >
        Cancel
      </button>
    </div>
  );
}

function ProcessingPhase() {
  return (
    <div className="py-12 text-center space-y-4">
      <div className="w-12 h-12 border-4 border-[#dc2626] border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-[#78716c]">Calculating offset...</p>
    </div>
  );
}

interface ResultsPhaseProps {
  calibration: ReturnType<typeof useCalibration>;
  onSave: () => void;
  onRetry: () => void;
}

function ResultsPhase({ calibration, onSave, onRetry }: ResultsPhaseProps) {
  const calculatedMs = (calibration.calculatedOffsetSec ?? 0) * 1000;
  const adjustmentMs = calibration.manualAdjustmentSec * 1000;
  const finalMs = calibration.getFinalOffset() * 1000;

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-[#dc2626] rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(220,38,38,0.5)]">
          <svg className="w-8 h-8 text-[#f5f0e6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-[#f5f0e6] tracking-wide">CALIBRATION COMPLETE</h2>
        <p className="text-[#78716c] text-sm mt-1 font-mono">
          {calibration.collectedSamples} strums analyzed
        </p>
      </div>

      {/* Results */}
      <div className="bg-[#0a0a0a] border border-[#292524] rounded p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-[#78716c]">Detected latency:</span>
          <span className="text-[#f5f0e6] font-mono">{calculatedMs.toFixed(1)} ms</span>
        </div>
        {adjustmentMs !== 0 && (
          <div className="flex justify-between">
            <span className="text-[#78716c]">Manual adjustment:</span>
            <span className="text-[#f5f0e6] font-mono">{adjustmentMs > 0 ? '+' : ''}{adjustmentMs.toFixed(1)} ms</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[#292524] pt-2">
          <span className="text-[#d6d3cd] font-semibold">Final offset:</span>
          <span className="text-[#d97706] font-mono font-bold">{finalMs.toFixed(1)} ms</span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-[#78716c] text-sm">
        {finalMs > 0
          ? `Your input is detected ${Math.abs(finalMs).toFixed(0)}ms late. This will be compensated during gameplay.`
          : finalMs < 0
          ? `Your input is detected ${Math.abs(finalMs).toFixed(0)}ms early. This will be compensated during gameplay.`
          : 'Your timing is perfectly calibrated!'}
      </p>

      {/* Manual Fine-Tune Slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[#78716c]">Fine-tune adjustment</span>
          <span className="text-[#f5f0e6] font-mono">{adjustmentMs > 0 ? '+' : ''}{adjustmentMs.toFixed(0)} ms</span>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={adjustmentMs}
          onChange={(e) => calibration.setManualAdjustment(Number(e.target.value) / 1000)}
          className="w-full h-2 bg-[#0a0a0a] rounded appearance-none cursor-pointer accent-[#dc2626]"
        />
        <div className="flex justify-between text-xs text-[#57534e]">
          <span>-50ms (earlier)</span>
          <span>+50ms (later)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onRetry}
          className="flex-1 py-2 px-4 bg-[#292524] hover:bg-[#1a1614] border border-[#292524] hover:border-[#78716c] text-[#78716c] hover:text-[#f5f0e6] rounded transition-all"
        >
          Retry
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-2 px-4 bg-[#dc2626] hover:bg-[#ef4444] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] text-[#f5f0e6] rounded font-semibold transition-all"
        >
          Save & Continue
        </button>
      </div>
    </div>
  );
}

interface ErrorPhaseProps {
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

function ErrorPhase({ error, onRetry, onCancel }: ErrorPhaseProps) {
  return (
    <div className="space-y-6 py-4">
      {/* Error Icon */}
      <div className="text-center">
        <div className="w-16 h-16 bg-[#7f1d1d] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#dc2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-[#f5f0e6] tracking-wide">CALIBRATION FAILED</h2>
      </div>

      {/* Error Message */}
      <div className="bg-[#0a0a0a] border border-[#dc2626] rounded p-4">
        <p className="text-[#dc2626]">{error}</p>
      </div>

      {/* Tips */}
      <div className="bg-[#0a0a0a] border border-[#292524] rounded p-4">
        <p className="text-[#f5f0e6] font-semibold mb-2">Tips for better results:</p>
        <ul className="text-[#78716c] text-sm space-y-1">
          <li>• Strum a single clear note on each flash</li>
          <li>• Use a clean guitar tone (less distortion)</li>
          <li>• Make sure your guitar volume is up</li>
          <li>• Try to be as precise as possible with timing</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-[#292524] hover:bg-[#1a1614] border border-[#292524] hover:border-[#78716c] text-[#78716c] hover:text-[#f5f0e6] rounded transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onRetry}
          className="flex-1 py-2 px-4 bg-[#dc2626] hover:bg-[#ef4444] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] text-[#f5f0e6] rounded font-semibold transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
