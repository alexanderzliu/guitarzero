import { useState } from 'react';
import type { Tab } from '../../types';
import { parseAndValidateTab, type ValidationError } from '../../lib/tabs/tabValidator';
import { saveTab, generateTabId, StorageQuotaError } from '../../lib/storage/tabStorage';

interface TabImportWizardProps {
  onComplete: (tab: Tab) => void;
  onCancel: () => void;
}

type ImportPhase = 'paste' | 'preview' | 'saving';

export function TabImportWizard({ onComplete, onCancel }: TabImportWizardProps) {
  const [phase, setPhase] = useState<ImportPhase>('paste');
  const [jsonInput, setJsonInput] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [parsedTab, setParsedTab] = useState<Tab | null>(null);

  const handleValidate = () => {
    const result = parseAndValidateTab(jsonInput);

    if (result.valid && result.tab) {
      // Ensure the tab has a valid ID
      const tab = {
        ...result.tab,
        id: result.tab.id || generateTabId(),
      };
      setParsedTab(tab);
      setErrors([]);
      setPhase('preview');
    } else {
      setErrors(result.errors);
      setParsedTab(null);
    }
  };

  const handleSave = () => {
    if (!parsedTab) return;

    setPhase('saving');
    try {
      saveTab(parsedTab);
      onComplete(parsedTab);
    } catch (e) {
      if (e instanceof StorageQuotaError) {
        setErrors([{ path: '', message: e.message }]);
        setPhase('preview');
      } else {
        throw e;
      }
    }
  };

  const handleBack = () => {
    setPhase('paste');
    setErrors([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Import Tab</h1>
          <p className="text-slate-400">
            Paste your tab JSON to import it into the app
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl">
          {phase === 'paste' && (
            <PastePhase
              jsonInput={jsonInput}
              setJsonInput={setJsonInput}
              errors={errors}
              onValidate={handleValidate}
              onCancel={onCancel}
            />
          )}

          {phase === 'preview' && parsedTab && (
            <PreviewPhase
              tab={parsedTab}
              onSave={handleSave}
              onBack={handleBack}
            />
          )}

          {phase === 'saving' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-300">Saving tab...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Phase Components
// ============================================================================

interface PastePhaseProps {
  jsonInput: string;
  setJsonInput: (value: string) => void;
  errors: ValidationError[];
  onValidate: () => void;
  onCancel: () => void;
}

function PastePhase({ jsonInput, setJsonInput, errors, onValidate, onCancel }: PastePhaseProps) {
  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-slate-700 rounded-lg p-4">
        <p className="text-slate-300 text-sm">
          Paste a valid Tab JSON object below. The format should include title, artist,
          tempo map, sections, measures, and note events.
        </p>
      </div>

      {/* JSON Input */}
      <div className="space-y-2">
        <label className="text-sm text-slate-400">Tab JSON</label>
        <textarea
          className="w-full h-64 bg-slate-700 text-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder='{"id": "...", "title": "Song Name", "artist": "Artist", ...}'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 max-h-48 overflow-y-auto">
          <p className="text-red-300 font-medium mb-2">Validation Errors ({errors.length})</p>
          <ul className="text-red-400 text-sm space-y-1">
            {errors.map((error, i) => (
              <li key={i} className="font-mono">
                {error.path && <span className="text-red-500">{error.path}: </span>}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sample Format Link */}
      <details className="text-sm">
        <summary className="text-blue-400 cursor-pointer hover:text-blue-300">
          Show example format
        </summary>
        <pre className="mt-2 bg-slate-700 rounded-lg p-3 text-slate-300 text-xs overflow-x-auto">
{`{
  "id": "example-tab-1",
  "title": "Simple Song",
  "artist": "Test Artist",
  "ppq": 480,
  "timeSignature": [4, 4],
  "tuning": [40, 45, 50, 55, 59, 64],
  "tempoMap": [{ "tick": 0, "bpm": 120 }],
  "sections": [{
    "id": "section-1",
    "name": "Intro",
    "startTick": 0,
    "measures": [{
      "id": "measure-1",
      "number": 1,
      "events": [{
        "id": "event-1",
        "tick": 0,
        "durationTicks": 480,
        "notes": [{ "string": 1, "fret": 0, "midi": 64 }]
      }]
    }]
  }]
}`}
        </pre>
      </details>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onValidate}
          disabled={!jsonInput.trim()}
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          Validate & Preview
        </button>
      </div>
    </div>
  );
}

interface PreviewPhaseProps {
  tab: Tab;
  onSave: () => void;
  onBack: () => void;
}

function PreviewPhase({ tab, onSave, onBack }: PreviewPhaseProps) {
  const totalNotes = tab.sections.reduce(
    (sum, section) =>
      sum + section.measures.reduce(
        (mSum, measure) =>
          mSum + measure.events.reduce((eSum, event) => eSum + event.notes.length, 0),
        0
      ),
    0
  );

  const totalMeasures = tab.sections.reduce(
    (sum, section) => sum + section.measures.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Tab Validated Successfully</h2>
      </div>

      {/* Tab Info */}
      <div className="bg-slate-700 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-400">Title</span>
          <span className="text-white font-medium">{tab.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Artist</span>
          <span className="text-white">{tab.artist || '(unknown)'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Tempo</span>
          <span className="text-white">{tab.tempoMap[0]?.bpm || '?'} BPM</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Time Signature</span>
          <span className="text-white">{tab.timeSignature[0]}/{tab.timeSignature[1]}</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{tab.sections.length}</div>
          <div className="text-xs text-slate-400">Sections</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{totalMeasures}</div>
          <div className="text-xs text-slate-400">Measures</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{totalNotes}</div>
          <div className="text-xs text-slate-400">Notes</div>
        </div>
      </div>

      {/* Sections Preview */}
      <div className="space-y-2">
        <h3 className="text-sm text-slate-400">Sections</h3>
        <div className="bg-slate-700 rounded-lg divide-y divide-slate-600">
          {tab.sections.map((section) => (
            <div key={section.id} className="px-4 py-2 flex justify-between items-center">
              <span className="text-white">{section.name || '(unnamed)'}</span>
              <span className="text-slate-400 text-sm">
                {section.measures.length} measures
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          Save Tab
        </button>
      </div>
    </div>
  );
}
