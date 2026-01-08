import { useCalibration } from '../../hooks/useCalibration';
import { loadCalibration } from '../../lib/storage/calibrationStorage';

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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Latency Calibration</h1>
          <p className="text-slate-400">
            Calibrate your audio input to ensure accurate timing detection
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl">
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
      <div className="space-y-4 text-slate-300">
        <p>
          This wizard will measure the latency of your audio input so timing
          detection is accurate during gameplay.
        </p>
        <div className="bg-slate-700 rounded-lg p-4 space-y-2">
          <p className="font-medium text-white">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Connect your guitar and start audio capture</li>
            <li>Watch for the visual flash (8 beats)</li>
            <li>Strum your guitar exactly when each flash appears</li>
            <li>We'll calculate the timing offset automatically</li>
          </ol>
        </div>
      </div>

      {/* Existing Calibration Notice */}
      {existingCalibration && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
          <p className="text-blue-300 text-sm">
            Current calibration: <span className="font-mono">{(existingCalibration.offsetSec * 1000).toFixed(1)}ms</span>
            <br />
            <span className="text-blue-400/70 text-xs">
              Calibrated {new Date(existingCalibration.calibratedAt).toLocaleDateString()}
            </span>
          </p>
        </div>
      )}

      {/* Device Selection */}
      <div className="space-y-2">
        <label className="text-sm text-slate-400">Audio Input Device</label>
        <select
          className="w-full bg-slate-700 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {calibration.isAudioStarting ? 'Starting Audio...' : 'Start Audio'}
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-700 rounded-lg">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-300">Audio is running</span>
        </div>
      )}

      {/* Audio Error */}
      {calibration.audioError && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
          {calibration.audioError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={calibration.startCalibration}
          disabled={!calibration.isAudioRunning}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
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
        <p className="text-slate-400 text-sm mb-2">
          {isCountdown ? 'Get ready...' : 'Strum on each flash!'}
        </p>
        <p className="text-6xl font-bold text-white font-mono">
          {isCountdown ? calibration.countdownValue : `${calibration.currentBeat + 1}/${totalBeats}`}
        </p>
      </div>

      {/* Beat Flash Indicator */}
      <div className="flex justify-center">
        <div
          className={`w-32 h-32 rounded-full transition-all duration-75 ${
            calibration.beatActive
              ? 'bg-yellow-400 shadow-[0_0_60px_20px_rgba(250,204,21,0.5)] scale-110'
              : 'bg-slate-700'
          }`}
        />
      </div>

      {/* Progress */}
      {!isCountdown && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progress</span>
            <span>{calibration.collectedSamples} strums detected</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((calibration.currentBeat + 1) / totalBeats) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Cancel Button */}
      <button
        onClick={calibration.cancelCalibration}
        className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

function ProcessingPhase() {
  return (
    <div className="py-12 text-center space-y-4">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-slate-300">Calculating offset...</p>
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
        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Calibration Complete</h2>
        <p className="text-slate-400 text-sm mt-1">
          {calibration.collectedSamples} strums analyzed
        </p>
      </div>

      {/* Results */}
      <div className="bg-slate-700 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-400">Detected latency:</span>
          <span className="text-white font-mono">{calculatedMs.toFixed(1)} ms</span>
        </div>
        {adjustmentMs !== 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Manual adjustment:</span>
            <span className="text-white font-mono">{adjustmentMs > 0 ? '+' : ''}{adjustmentMs.toFixed(1)} ms</span>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-600 pt-2">
          <span className="text-slate-300 font-medium">Final offset:</span>
          <span className="text-green-400 font-mono font-bold">{finalMs.toFixed(1)} ms</span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-slate-400 text-sm">
        {finalMs > 0
          ? `Your input is detected ${Math.abs(finalMs).toFixed(0)}ms late. This will be compensated during gameplay.`
          : finalMs < 0
          ? `Your input is detected ${Math.abs(finalMs).toFixed(0)}ms early. This will be compensated during gameplay.`
          : 'Your timing is perfectly calibrated!'}
      </p>

      {/* Manual Fine-Tune Slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Fine-tune adjustment</span>
          <span className="text-slate-300 font-mono">{adjustmentMs > 0 ? '+' : ''}{adjustmentMs.toFixed(0)} ms</span>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={adjustmentMs}
          onChange={(e) => calibration.setManualAdjustment(Number(e.target.value) / 1000)}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>-50ms (earlier)</span>
          <span>+50ms (later)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onRetry}
          className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Retry
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
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
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Calibration Failed</h2>
      </div>

      {/* Error Message */}
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">{error}</p>
      </div>

      {/* Tips */}
      <div className="bg-slate-700 rounded-lg p-4">
        <p className="text-slate-300 font-medium mb-2">Tips for better results:</p>
        <ul className="text-slate-400 text-sm space-y-1">
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
          className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onRetry}
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
