import { useState } from 'react';
import type { Tab } from '../../types';
import { midiToNoteName } from '../../lib/audio/midiUtils';

interface TabPreviewProps {
  tab: Tab;
  onClose: () => void;
  onDelete?: () => void;
}

export function TabPreview({ tab, onClose, onDelete }: TabPreviewProps) {
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

  // Get tuning note names
  const tuningNames = tab.tuning.map((midi) => midiToNoteName(midi));

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{tab.title}</h1>
            <p className="text-slate-400 text-lg">{tab.artist || 'Unknown Artist'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Info Card */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Tab Information</h2>
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
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Sections</h2>
          <div className="space-y-2">
            {tab.sections.map((section, index) => (
              <SectionCard key={section.id} section={section} index={index} />
            ))}
          </div>
        </div>

        {/* Tempo Changes */}
        {tab.tempoMap.length > 1 && (
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-slate-200 mb-4">Tempo Changes</h2>
            <div className="space-y-2">
              {tab.tempoMap.map((tempo, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center px-4 py-2 bg-slate-700 rounded-lg"
                >
                  <span className="text-slate-400 text-sm">
                    Tick {tempo.tick}
                    {tempo.tick === 0 && ' (start)'}
                  </span>
                  <span className="text-white font-medium">{tempo.bpm} BPM</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Back to Library
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
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
    <div className="bg-slate-700 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-white ${mono ? 'font-mono text-sm' : ''}`}>{value}</div>
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
    <div className="bg-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm">#{index + 1}</span>
          <span className="text-white font-medium">{section.name || '(unnamed)'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            {section.measures.length} measures, {noteCount} notes
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-600">
          <div className="pt-3 text-xs text-slate-400">
            Start tick: {section.startTick}
          </div>
          {section.measures.slice(0, 5).map((measure) => (
            <MeasurePreview key={measure.id} measure={measure} />
          ))}
          {section.measures.length > 5 && (
            <div className="text-slate-500 text-sm text-center py-2">
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
    <div className="bg-slate-800 rounded px-3 py-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-slate-400 text-xs">Measure {measure.number}</span>
        <span className="text-slate-500 text-xs">{measure.events.length} events</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {measure.events.slice(0, 8).map((event) => (
          <div
            key={event.id}
            className="bg-slate-700 px-2 py-1 rounded text-xs"
            title={`Tick: ${event.tick}, Duration: ${event.durationTicks}`}
          >
            {event.notes.map((note, noteIndex) => (
              <span key={`${noteIndex}-${note.string}-${note.fret}`}>
                {noteIndex > 0 && <span className="text-slate-500 mx-0.5">+</span>}
                <span className="text-green-400">{note.string}:{note.fret}</span>
              </span>
            ))}
            {event.technique && (
              <span className="text-purple-400 ml-1">({event.technique})</span>
            )}
          </div>
        ))}
        {measure.events.length > 8 && (
          <span className="text-slate-500 text-xs px-2 py-1">+{measure.events.length - 8}</span>
        )}
      </div>
    </div>
  );
}

