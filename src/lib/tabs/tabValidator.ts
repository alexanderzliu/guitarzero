import type { Tab } from '../../types';

// ============================================================================
// Tab Validation - Validates Tab JSON structure before import
// ============================================================================

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  tab: Tab | null;
}

/**
 * Validate a Tab object and return detailed errors
 */
export function validateTab(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if data is an object
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Tab must be an object' }],
      tab: null,
    };
  }

  const tab = data as Record<string, unknown>;

  // Required string fields
  if (typeof tab.id !== 'string' || !tab.id) {
    errors.push({ path: 'id', message: 'id must be a non-empty string' });
  }
  if (typeof tab.title !== 'string' || !tab.title) {
    errors.push({ path: 'title', message: 'title must be a non-empty string' });
  }
  if (typeof tab.artist !== 'string') {
    errors.push({ path: 'artist', message: 'artist must be a string' });
  }

  // PPQ validation
  if (typeof tab.ppq !== 'number' || tab.ppq <= 0 || !Number.isInteger(tab.ppq)) {
    errors.push({ path: 'ppq', message: 'ppq must be a positive integer' });
  }

  // Time signature validation
  if (!validateTimeSignature(tab.timeSignature)) {
    errors.push({ path: 'timeSignature', message: 'timeSignature must be [number, number] with positive integers' });
  }

  // Tuning validation (exactly 6 MIDI notes)
  if (!validateTuning(tab.tuning)) {
    errors.push({ path: 'tuning', message: 'tuning must be an array of exactly 6 MIDI notes (0-127)' });
  }

  // Tempo map validation
  const tempoErrors = validateTempoMap(tab.tempoMap);
  errors.push(...tempoErrors);

  // Sections validation
  const sectionErrors = validateSections(tab.sections);
  errors.push(...sectionErrors);

  // Check for unique IDs across all entities
  const idErrors = validateUniqueIds(tab);
  errors.push(...idErrors);

  if (errors.length > 0) {
    return { valid: false, errors, tab: null };
  }

  return { valid: true, errors: [], tab: data as Tab };
}

/**
 * Validate time signature [numerator, denominator]
 */
function validateTimeSignature(ts: unknown): ts is [number, number] {
  return (
    Array.isArray(ts) &&
    ts.length === 2 &&
    typeof ts[0] === 'number' &&
    typeof ts[1] === 'number' &&
    ts[0] > 0 &&
    ts[1] > 0 &&
    Number.isInteger(ts[0]) &&
    Number.isInteger(ts[1])
  );
}

/**
 * Validate tuning array (6 MIDI notes)
 */
function validateTuning(tuning: unknown): tuning is number[] {
  return (
    Array.isArray(tuning) &&
    tuning.length === 6 &&
    tuning.every((n) => typeof n === 'number' && n >= 0 && n <= 127 && Number.isInteger(n))
  );
}

/**
 * Validate tempo map
 */
function validateTempoMap(tempoMap: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(tempoMap)) {
    errors.push({ path: 'tempoMap', message: 'tempoMap must be an array' });
    return errors;
  }

  if (tempoMap.length === 0) {
    errors.push({ path: 'tempoMap', message: 'tempoMap must have at least one tempo event' });
    return errors;
  }

  let lastTick = -1;
  tempoMap.forEach((event: unknown, i: number) => {
    const te = event as Record<string, unknown>;

    if (typeof te.tick !== 'number' || te.tick < 0 || !Number.isInteger(te.tick)) {
      errors.push({ path: `tempoMap[${i}].tick`, message: 'tick must be a non-negative integer' });
    } else {
      if (te.tick <= lastTick && i > 0) {
        errors.push({ path: `tempoMap[${i}].tick`, message: 'tempo events must be sorted by tick (monotonically increasing)' });
      }
      lastTick = te.tick as number;
    }

    if (typeof te.bpm !== 'number' || te.bpm <= 0) {
      errors.push({ path: `tempoMap[${i}].bpm`, message: 'bpm must be a positive number' });
    }
  });

  // First tempo event should be at tick 0
  if (tempoMap.length > 0) {
    const first = tempoMap[0] as Record<string, unknown>;
    if (first.tick !== 0) {
      errors.push({ path: 'tempoMap[0].tick', message: 'first tempo event must be at tick 0' });
    }
  }

  return errors;
}

/**
 * Validate sections array
 */
function validateSections(sections: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(sections)) {
    errors.push({ path: 'sections', message: 'sections must be an array' });
    return errors;
  }

  if (sections.length === 0) {
    errors.push({ path: 'sections', message: 'tab must have at least one section' });
    return errors;
  }

  sections.forEach((section: unknown, si: number) => {
    const s = section as Record<string, unknown>;
    const sectionPath = `sections[${si}]`;

    if (typeof s.id !== 'string' || !s.id) {
      errors.push({ path: `${sectionPath}.id`, message: 'section id must be a non-empty string' });
    }
    if (typeof s.name !== 'string') {
      errors.push({ path: `${sectionPath}.name`, message: 'section name must be a string' });
    }
    if (typeof s.startTick !== 'number' || s.startTick < 0) {
      errors.push({ path: `${sectionPath}.startTick`, message: 'startTick must be a non-negative number' });
    }

    // Validate measures
    const measureErrors = validateMeasures(s.measures, sectionPath);
    errors.push(...measureErrors);
  });

  return errors;
}

/**
 * Validate measures array
 */
function validateMeasures(measures: unknown, parentPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(measures)) {
    errors.push({ path: `${parentPath}.measures`, message: 'measures must be an array' });
    return errors;
  }

  if (measures.length === 0) {
    errors.push({ path: `${parentPath}.measures`, message: 'section must have at least one measure' });
    return errors;
  }

  measures.forEach((measure: unknown, mi: number) => {
    const m = measure as Record<string, unknown>;
    const measurePath = `${parentPath}.measures[${mi}]`;

    if (typeof m.id !== 'string' || !m.id) {
      errors.push({ path: `${measurePath}.id`, message: 'measure id must be a non-empty string' });
    }
    if (typeof m.number !== 'number' || !Number.isInteger(m.number)) {
      errors.push({ path: `${measurePath}.number`, message: 'measure number must be an integer' });
    }

    // Validate events
    const eventErrors = validateEvents(m.events, measurePath);
    errors.push(...eventErrors);
  });

  return errors;
}

/**
 * Validate events array
 */
function validateEvents(events: unknown, parentPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(events)) {
    errors.push({ path: `${parentPath}.events`, message: 'events must be an array' });
    return errors;
  }

  if (events.length === 0) {
    errors.push({ path: `${parentPath}.events`, message: 'measure must have at least one event' });
    return errors;
  }

  let lastTick = -1;
  events.forEach((event: unknown, ei: number) => {
    const e = event as Record<string, unknown>;
    const eventPath = `${parentPath}.events[${ei}]`;

    if (typeof e.id !== 'string' || !e.id) {
      errors.push({ path: `${eventPath}.id`, message: 'event id must be a non-empty string' });
    }

    if (typeof e.tick !== 'number' || e.tick < 0) {
      errors.push({ path: `${eventPath}.tick`, message: 'tick must be a non-negative number' });
    } else {
      if (e.tick < lastTick) {
        errors.push({ path: `${eventPath}.tick`, message: 'events must be sorted by tick within measure' });
      }
      lastTick = e.tick as number;
    }

    if (typeof e.durationTicks !== 'number' || e.durationTicks <= 0) {
      errors.push({ path: `${eventPath}.durationTicks`, message: 'durationTicks must be a positive number' });
    }

    // Validate notes
    const noteErrors = validateNotes(e.notes, eventPath);
    errors.push(...noteErrors);

    // Validate technique if present
    if (e.technique !== undefined) {
      const validTechniques = ['bend', 'slide', 'hammer-on', 'pull-off', 'vibrato', 'mute'];
      if (typeof e.technique !== 'string' || !validTechniques.includes(e.technique)) {
        errors.push({ path: `${eventPath}.technique`, message: `technique must be one of: ${validTechniques.join(', ')}` });
      }
    }
  });

  return errors;
}

/**
 * Validate notes array
 */
function validateNotes(notes: unknown, parentPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(notes)) {
    errors.push({ path: `${parentPath}.notes`, message: 'notes must be an array' });
    return errors;
  }

  if (notes.length === 0) {
    errors.push({ path: `${parentPath}.notes`, message: 'event must have at least one note' });
    return errors;
  }

  notes.forEach((note: unknown, ni: number) => {
    const n = note as Record<string, unknown>;
    const notePath = `${parentPath}.notes[${ni}]`;

    // String: 1-6
    if (typeof n.string !== 'number' || n.string < 1 || n.string > 6 || !Number.isInteger(n.string)) {
      errors.push({ path: `${notePath}.string`, message: 'string must be an integer 1-6' });
    }

    // Fret: 0-24
    if (typeof n.fret !== 'number' || n.fret < 0 || n.fret > 24 || !Number.isInteger(n.fret)) {
      errors.push({ path: `${notePath}.fret`, message: 'fret must be an integer 0-24' });
    }

    // MIDI: 0-127
    if (typeof n.midi !== 'number' || n.midi < 0 || n.midi > 127 || !Number.isInteger(n.midi)) {
      errors.push({ path: `${notePath}.midi`, message: 'midi must be an integer 0-127' });
    }
  });

  return errors;
}

/**
 * Check for unique IDs across all entities
 */
function validateUniqueIds(tab: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const ids = new Set<string>();

  function checkId(id: unknown, path: string) {
    if (typeof id === 'string') {
      if (ids.has(id)) {
        errors.push({ path, message: `duplicate id: "${id}"` });
      } else {
        ids.add(id);
      }
    }
  }

  // Check tab ID
  checkId(tab.id, 'id');

  // Check all nested IDs
  const sections = tab.sections as unknown[];
  if (Array.isArray(sections)) {
    sections.forEach((section: unknown, si: number) => {
      const s = section as Record<string, unknown>;
      checkId(s.id, `sections[${si}].id`);

      const measures = s.measures as unknown[];
      if (Array.isArray(measures)) {
        measures.forEach((measure: unknown, mi: number) => {
          const m = measure as Record<string, unknown>;
          checkId(m.id, `sections[${si}].measures[${mi}].id`);

          const events = m.events as unknown[];
          if (Array.isArray(events)) {
            events.forEach((event: unknown, ei: number) => {
              const e = event as Record<string, unknown>;
              checkId(e.id, `sections[${si}].measures[${mi}].events[${ei}].id`);
            });
          }
        });
      }
    });
  }

  return errors;
}

/**
 * Parse JSON string and validate as Tab
 */
export function parseAndValidateTab(jsonString: string): ValidationResult {
  try {
    const data = JSON.parse(jsonString);
    return validateTab(data);
  } catch (e) {
    return {
      valid: false,
      errors: [{ path: '', message: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}` }],
      tab: null,
    };
  }
}
