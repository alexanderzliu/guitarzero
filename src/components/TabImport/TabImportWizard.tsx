import { useState } from 'react';
import type { Tab } from '../../types';
import { parseAndValidateTab, type ValidationError } from '../../lib/tabs/tabValidator';
import { saveTab, generateTabId, StorageQuotaError } from '../../lib/storage/tabStorage';
import { getTotalNotes, getTotalMeasures } from '../../lib/tabs/tabUtils';

// ============================================================================
// Tab Import Wizard - "Garage Film" Aesthetic
// ============================================================================

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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-[#f5f0e6] tracking-wide mb-2">
            IMPORT TAB
          </h1>
          <p className="text-[#78716c]">
            Paste your tab JSON to import it into the app
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-[#1a1614] border border-[#292524] rounded p-6">
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
              <div className="w-12 h-12 border-4 border-[#dc2626] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[#78716c]">Saving tab...</p>
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
      <div className="bg-[#0a0a0a] border border-[#292524] rounded p-4">
        <p className="text-[#d6d3cd] text-sm">
          Paste a valid Tab JSON object below. The format should include title, artist,
          tempo map, sections, measures, and note events.
        </p>
      </div>

      {/* JSON Input */}
      <div className="space-y-2">
        <label className="text-sm text-[#78716c]">Tab JSON</label>
        <textarea
          className="w-full h-64 bg-[#0a0a0a] text-[#f5f0e6] border border-[#292524] rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#d97706] focus:shadow-[0_0_15px_rgba(217,119,6,0.3)] resize-none transition-all"
          placeholder='{"id": "...", "title": "Song Name", "artist": "Artist", ...}'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-[#0a0a0a] border border-[#dc2626] rounded p-4 max-h-48 overflow-y-auto">
          <p className="text-[#dc2626] font-semibold mb-2">Validation Errors ({errors.length})</p>
          <ul className="text-[#dc2626]/80 text-sm space-y-1">
            {errors.map((error, i) => (
              <li key={i} className="font-mono">
                {error.path && <span className="text-[#dc2626]">{error.path}: </span>}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sample Format Link */}
      <details className="text-sm">
        <summary className="text-[#d97706] cursor-pointer hover:text-[#fbbf24] transition-colors">
          Show example format
        </summary>
        <pre className="mt-2 bg-[#0a0a0a] border border-[#292524] rounded p-3 text-[#78716c] text-xs overflow-x-auto">
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
          className="flex-1 py-2 px-4 bg-[#292524] hover:bg-[#1a1614] border border-[#292524] hover:border-[#78716c] text-[#78716c] hover:text-[#f5f0e6] rounded transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onValidate}
          disabled={!jsonInput.trim()}
          className="flex-1 py-2 px-4 bg-[#dc2626] hover:bg-[#ef4444] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] disabled:bg-[#991b1b] disabled:opacity-50 text-[#f5f0e6] rounded font-semibold transition-all"
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
  const totalNotes = getTotalNotes(tab);
  const totalMeasures = getTotalMeasures(tab);

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-[#dc2626] rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(220,38,38,0.5)]">
          <svg className="w-8 h-8 text-[#f5f0e6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-[#f5f0e6] tracking-wide">TAB VALIDATED</h2>
      </div>

      {/* Tab Info */}
      <div className="bg-[#0a0a0a] border border-[#292524] rounded p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-[#78716c]">Title</span>
          <span className="text-[#f5f0e6] font-semibold">{tab.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#78716c]">Artist</span>
          <span className="text-[#f5f0e6]">{tab.artist || '(unknown)'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#78716c]">Tempo</span>
          <span className="text-[#f5f0e6] font-mono">{tab.tempoMap[0]?.bpm || '?'} BPM</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#78716c]">Time Signature</span>
          <span className="text-[#f5f0e6] font-mono">{tab.timeSignature[0]}/{tab.timeSignature[1]}</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0a0a0a] border border-[#292524] rounded p-3 text-center">
          <div className="text-2xl font-display text-[#dc2626]">{tab.sections.length}</div>
          <div className="text-xs text-[#57534e]">Sections</div>
        </div>
        <div className="bg-[#0a0a0a] border border-[#292524] rounded p-3 text-center">
          <div className="text-2xl font-display text-[#d97706]">{totalMeasures}</div>
          <div className="text-xs text-[#57534e]">Measures</div>
        </div>
        <div className="bg-[#0a0a0a] border border-[#292524] rounded p-3 text-center">
          <div className="text-2xl font-display text-[#f5f0e6]">{totalNotes}</div>
          <div className="text-xs text-[#57534e]">Notes</div>
        </div>
      </div>

      {/* Sections Preview */}
      <div className="space-y-2">
        <h3 className="text-sm text-[#78716c]">Sections</h3>
        <div className="bg-[#0a0a0a] border border-[#292524] rounded divide-y divide-[#292524]">
          {tab.sections.map((section) => (
            <div key={section.id} className="px-4 py-2 flex justify-between items-center">
              <span className="text-[#f5f0e6]">{section.name || '(unnamed)'}</span>
              <span className="text-[#57534e] text-sm font-mono">
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
          className="flex-1 py-2 px-4 bg-[#292524] hover:bg-[#1a1614] border border-[#292524] hover:border-[#78716c] text-[#78716c] hover:text-[#f5f0e6] rounded transition-all"
        >
          Back
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-2 px-4 bg-[#dc2626] hover:bg-[#ef4444] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] text-[#f5f0e6] rounded font-semibold transition-all"
        >
          Save Tab
        </button>
      </div>
    </div>
  );
}
