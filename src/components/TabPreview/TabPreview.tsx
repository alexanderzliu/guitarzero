import { useState } from 'react';
import type { Tab } from '../../types';
import { midiToNoteName } from '../../lib/audio/midiUtils';
import { getTotalNotes, getTotalMeasures } from '../../lib/tabs/tabUtils';
import { useSessionHistory } from '../../hooks/useSessionHistory';
import { SessionHistory } from './SessionHistory';

// ============================================================================
// Tab Preview - "Garage Film" Aesthetic
// ============================================================================

interface TabPreviewProps {
  tab: Tab;
  onClose: () => void;
  onDelete?: () => void;
  onPlay?: () => void;
}

export function TabPreview({ tab, onClose, onDelete, onPlay }: TabPreviewProps) {
  const totalNotes = getTotalNotes(tab);
  const totalMeasures = getTotalMeasures(tab);

  // Get tuning note names
  const tuningNames = tab.tuning.map((midi) => midiToNoteName(midi));

  // Session history for this tab
  const sessionHistory = useSessionHistory(tab.id);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-4xl text-[#f5f0e6] tracking-wide">{tab.title}</h1>
            <p className="text-[#78716c] text-lg">{tab.artist || 'Unknown Artist'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#57534e] hover:text-[#f5f0e6] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Info Card */}
        <div className="bg-[#1a1614] border border-[#292524] rounded p-6">
          <h2 className="font-display text-lg text-[#f5f0e6] tracking-wide mb-4">TAB INFORMATION</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="Tempo" value={`${tab.tempoMap[0]?.bpm || '?'} BPM`} />
            <InfoItem label="Time Signature" value={`${tab.timeSignature[0]}/${tab.timeSignature[1]}`} />
            <InfoItem label="Sections" value={tab.sections.length.toString()} />
            <InfoItem label="Measures" value={totalMeasures.toString()} />
            <InfoItem label="Total Notes" value={totalNotes.toString()} />
            <InfoItem label="PPQ" value={tab.ppq.toString()} />
            <InfoItem
              label="Tuning"
              value={`${tuningNames[0]}-${tuningNames[1]}-${tuningNames[2]}-${tuningNames[3]}-${tuningNames[4]}-${tuningNames[5]}`}
            />
            <InfoItem label="ID" value={tab.id.slice(0, 8) + '...'} mono />
          </div>
        </div>

        {/* Sections List */}
        <div className="bg-[#1a1614] border border-[#292524] rounded p-6">
          <h2 className="font-display text-lg text-[#f5f0e6] tracking-wide mb-4">SECTIONS</h2>
          <div className="space-y-2">
            {tab.sections.map((section, index) => (
              <SectionCard key={section.id} section={section} index={index} />
            ))}
          </div>
        </div>

        {/* Tempo Changes */}
        {tab.tempoMap.length > 1 && (
          <div className="bg-[#1a1614] border border-[#292524] rounded p-6">
            <h2 className="font-display text-lg text-[#f5f0e6] tracking-wide mb-4">TEMPO CHANGES</h2>
            <div className="space-y-2">
              {tab.tempoMap.map((tempo, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center px-4 py-2 bg-[#0a0a0a] border border-[#292524] rounded"
                >
                  <span className="text-[#78716c] text-sm font-mono">
                    Tick {tempo.tick}
                    {tempo.tick === 0 && ' (start)'}
                  </span>
                  <span className="text-[#f5f0e6] font-mono font-semibold">{tempo.bpm} BPM</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session History */}
        <SessionHistory
          sessions={sessionHistory.sessions}
          stats={sessionHistory.stats}
          isLoading={sessionHistory.isLoading}
          onDeleteSession={sessionHistory.deleteSession}
        />

        {/* Action Buttons */}
        <div className="flex gap-4">
          {onPlay && (
            <button
              onClick={onPlay}
              className="flex-1 py-3 px-4 bg-[#dc2626] hover:bg-[#ef4444] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] text-[#f5f0e6] rounded font-semibold transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-[#292524] hover:bg-[#1a1614] border border-[#292524] hover:border-[#78716c] text-[#78716c] hover:text-[#f5f0e6] rounded font-semibold transition-all"
          >
            Back to Library
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="py-3 px-6 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#dc2626] hover:text-[#f5f0e6] border border-[#dc2626]/30 hover:border-[#dc2626] rounded font-semibold transition-all"
            >
              Delete Tab
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface InfoItemProps {
  label: string;
  value: string;
  mono?: boolean;
}

function InfoItem({ label, value, mono }: InfoItemProps) {
  return (
    <div className="bg-[#0a0a0a] border border-[#292524] rounded p-3">
      <div className="text-xs text-[#57534e] mb-1">{label}</div>
      <div className={`text-[#f5f0e6] ${mono ? 'font-mono text-sm' : ''}`}>{value}</div>
    </div>
  );
}

interface SectionCardProps {
  section: Tab['sections'][0];
  index: number;
}

function SectionCard({ section, index }: SectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const noteCount = section.measures.reduce(
    (sum, measure) =>
      sum + measure.events.reduce((eSum, event) => eSum + event.notes.length, 0),
    0
  );

  return (
    <div className="bg-[#0a0a0a] border border-[#292524] rounded overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#292524] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#57534e] text-sm font-mono">#{index + 1}</span>
          <span className="text-[#f5f0e6] font-semibold">{section.name || '(unnamed)'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#78716c] text-sm font-mono">
            {section.measures.length} measures, {noteCount} notes
          </span>
          <svg
            className={`w-4 h-4 text-[#57534e] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-[#292524]">
          <div className="pt-3 text-xs text-[#57534e] font-mono">
            Start tick: {section.startTick}
          </div>
          {section.measures.slice(0, 5).map((measure) => (
            <MeasurePreview key={measure.id} measure={measure} />
          ))}
          {section.measures.length > 5 && (
            <div className="text-[#57534e] text-sm text-center py-2">
              ... and {section.measures.length - 5} more measures
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MeasurePreviewProps {
  measure: Tab['sections'][0]['measures'][0];
}

function MeasurePreview({ measure }: MeasurePreviewProps) {
  return (
    <div className="bg-[#1a1614] border border-[#292524] rounded px-3 py-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[#78716c] text-xs">Measure {measure.number}</span>
        <span className="text-[#57534e] text-xs font-mono">{measure.events.length} events</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {measure.events.slice(0, 8).map((event) => (
          <div
            key={event.id}
            className="bg-[#0a0a0a] border border-[#292524] px-2 py-1 rounded text-xs"
            title={`Tick: ${event.tick}, Duration: ${event.durationTicks}`}
          >
            {event.notes.map((note, noteIndex) => (
              <span key={`${noteIndex}-${note.string}-${note.fret}`}>
                {noteIndex > 0 && <span className="text-[#57534e] mx-0.5">+</span>}
                <span className="text-[#d97706] font-mono">{note.string}:{note.fret}</span>
              </span>
            ))}
            {event.technique && (
              <span className="text-[#dc2626] ml-1">({event.technique})</span>
            )}
          </div>
        ))}
        {measure.events.length > 8 && (
          <span className="text-[#57534e] text-xs px-2 py-1 font-mono">+{measure.events.length - 8}</span>
        )}
      </div>
    </div>
  );
}
