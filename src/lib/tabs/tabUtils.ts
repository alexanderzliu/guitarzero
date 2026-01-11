import type { Tab } from '../../types';

/**
 * Get total note count across all sections of a tab
 */
export function getTotalNotes(tab: Tab): number {
  return tab.sections.reduce(
    (sum, section) =>
      sum + section.measures.reduce(
        (mSum, measure) =>
          mSum + measure.events.reduce((eSum, event) => eSum + event.notes.length, 0),
        0
      ),
    0
  );
}

/**
 * Get total measure count across all sections of a tab
 */
export function getTotalMeasures(tab: Tab): number {
  return tab.sections.reduce((sum, section) => sum + section.measures.length, 0);
}
