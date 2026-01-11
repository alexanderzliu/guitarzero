# Guitar Hero App - Code Cleanup & Optimization Plan

## Executive Summary

This plan outlines improvements to enhance code organization, reduce duplication, and optimize performance for real-time gameplay. The codebase is well-architected (8/10). Changes are ordered from lowest-risk to highest-risk, with performance optimizations gated behind profiling data.

**Note:** Phases 5 (Session Recording & Analytics) and Phase 6 (Polish & UX) are planned future features per the README. Several "unused" exports are intentional placeholders for these phases and should be kept.

---

## Phase 1: Safe Cleanups (Zero Risk)

### 1.1 Remove Truly Unused Exports

These functions have no current use AND no foreseeable use in planned phases:

| Export | File | Reason to Remove |
|--------|------|------------------|
| `midiMatches` | `src/lib/audio/midiUtils.ts:68` | Redundant - `pitchMatches` in hitDetection.ts does this |
| `frequenciesMatch` | `src/lib/audio/midiUtils.ts:59` | Only used by `midiMatches` (also being removed) |
| `dbToLinear` | `src/lib/audio/onsetDetector.ts` | Inverse function never needed - only `linearToDb` is used |
| `calculatePeakDb` | `src/lib/audio/onsetDetector.ts` | Never called - `calculateRms` is used instead |

**Keep These (Future Phase Placeholders):**

| Export | File | Future Use |
|--------|------|------------|
| `clearCalibration` | calibrationStorage.ts | Phase 6: Settings UI to reset calibration |
| `isCalibrated` | calibrationStorage.ts | Phase 5/6: Show calibration status in UI |
| `tabExists` | tabStorage.ts | Phase 5: Verify tab exists for session recording |
| `getTabCount` | tabStorage.ts | Phase 5/6: Analytics dashboard |
| `scheduleMetronomeClick` | metronome.ts | Phase 6: Practice mode (schedule clicks ahead) |
| `stringFretToMidi` | midiUtils.ts | Phase 5: Convert played notes back to tab format |
| `secToTick` | tempoUtils.ts | Any feature converting time back to ticks |
| `getSecondsPerBeat` | tempoUtils.ts | Phase 6: Practice mode tempo display |

---

### 1.2 Add Named Constants for Magic Numbers

**File:** `src/hooks/useGameEngine.ts`
```typescript
// Add near top of file
const LOOK_BEHIND_SEC = 0.5;      // Time window to show passed notes
const MIN_SPEED = 0.25;
const MAX_SPEED = 2.0;
const MIN_LOOK_AHEAD_SEC = 2;
const MAX_LOOK_AHEAD_SEC = 8;
```

**File:** `src/hooks/useCalibration.ts`
```typescript
const ONSET_MATCH_WINDOW_SEC = 0.4;  // Tolerance for calibration click timing
```

**File:** `src/lib/rendering/highwayRenderer.ts`
```typescript
const NOTE_PASSED_THRESHOLD_SEC = 0.1;
```

---

### 1.3 Add Worklet Code Sync Comments

**Problem:** AudioWorklet duplicates implementations from main bundle (unavoidable due to browser thread isolation).

**File:** `src/worklets/pitch-detector.worklet.ts` - Add at top:
```typescript
/**
 * DUPLICATION NOTICE
 *
 * AudioWorklets run in a separate thread and cannot import from the main bundle.
 * This file contains duplicated implementations of:
 *
 * - RingBuffer       → sync with: src/lib/audio/ringBuffer.ts
 * - YinDetector      → sync with: src/lib/audio/yinDetector.ts
 * - calculateRms     → sync with: src/lib/audio/onsetDetector.ts
 * - linearToDb       → sync with: src/lib/audio/onsetDetector.ts
 * - hzToMidi         → sync with: src/lib/audio/midiUtils.ts
 *
 * WHEN MODIFYING: Update both locations to keep implementations in sync.
 */
```

**Main bundle files:** Add cross-reference comment to duplicated functions:
```typescript
// SYNC: Duplicated in src/worklets/pitch-detector.worklet.ts - keep both in sync
```

---

## Phase 2: Code Deduplication (Low Risk)

### 2.1 Extract Tab Statistics Utilities

**Problem:** `totalNotes` calculation is duplicated.

**Locations:**
- `src/components/TabPreview/TabPreview.tsx:13-21`
- `src/components/TabImport/TabImportWizard.tsx:212-220`

**Solution:** Create `src/lib/tabs/tabUtils.ts`:

```typescript
import type { Tab } from '../../types';

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

export function getTotalMeasures(tab: Tab): number {
  return tab.sections.reduce((sum, section) => sum + section.measures.length, 0);
}
```

**Files to update:**
- `src/components/TabPreview/TabPreview.tsx` - import `getTotalNotes`
- `src/components/TabImport/TabImportWizard.tsx` - import `getTotalNotes`

---

## Phase 3: Canvas & Audio Verification (Low Risk)

### 3.1 Canvas Context Optimization

**File:** `src/lib/rendering/highwayRenderer.ts`

Verify and apply if not present:
```typescript
const ctx = canvas.getContext('2d', {
  alpha: false,           // No transparency needed - faster compositing
  desynchronized: true    // Reduce latency on supported browsers
});
```

### 3.2 Verify Memory Cleanup

Ensure these are properly handled on unmount:

| File | Check |
|------|-------|
| `src/hooks/useGameEngine.ts` | ✓ `cancelAnimationFrame` in cleanup |
| `src/hooks/useAudioInput.ts` | Verify AudioWorklet termination |
| `src/lib/audio/audioCapture.ts` | Verify `AudioContext.close()` on cleanup |

---

## Phase 4: Performance Profiling (Required Before Phase 5)

**CRITICAL:** Do not proceed to Phase 5 without completing profiling.

### 4.1 Profile the Game Loop

1. Open Chrome DevTools → Performance tab
2. Play a tab for 60+ seconds with dense notes
3. Record the session
4. Analyze:
   - **GC Events:** Frequency and duration of garbage collection pauses
   - **Frame Timing:** Are any frames exceeding 16ms budget?
   - **JS Heap:** Is memory growing unbounded or stable?

### 4.2 Decision Criteria

Proceed to Phase 5 **ONLY** if profiling shows:
- GC pauses > 3ms occurring during gameplay
- Frame drops correlating with GC events
- Consistent frame time > 12ms (leaving no headroom)

If profiling shows smooth 60fps with no GC-related jank, **skip Phase 5 entirely**.

---

## Phase 5: Game Loop Optimization (High Risk - Only If Profiling Justifies)

⚠️ **WARNING:** These changes add complexity and risk introducing bugs. Only implement if Phase 4 profiling proves necessity.

### 5.1 Time-Windowed Note Processing

**Problem:** Current code filters all notes every frame.

**Current approach:**
```typescript
const pendingNotes = allNotesRef.current.filter(
  (n) => !hitNotesRef.current.has(getNoteKey(n))
);
```

**Optimized approach - Process only notes in time window:**
```typescript
// Notes are sorted by time, use binary search to find relevant window
const windowStart = songTime - LOOK_BEHIND_SEC;
const windowEnd = songTime + lookAheadSec;

// Binary search to find bounds (O(log n) instead of O(n))
const startIdx = binarySearchNoteTime(allNotesRef.current, windowStart);
const endIdx = binarySearchNoteTime(allNotesRef.current, windowEnd);

// Process only the slice - iterate by index, no array allocation
for (let i = startIdx; i < endIdx; i++) {
  const note = allNotesRef.current[i];
  if (!hitNotesRef.current.has(getNoteKey(note))) {
    // Process pending note...
  }
}
```

**Required helper:**
```typescript
function binarySearchNoteTime(notes: RenderNote[], targetTime: number): number {
  let lo = 0, hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].timeSec < targetTime) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
```

### 5.2 Avoid Object Spread in Hot Path

**Problem:** Creating new objects every frame for visible notes.

**Current:**
```typescript
return hitResult ? { ...note, hitResult } : note;
```

**Alternative - Store hit results separately:**
```typescript
// Pass noteResultsRef.current to renderer for lookup instead of embedding in notes
const visibleNotes = getVisibleNotes(allNotesRef.current, songTime, lookAhead, LOOK_BEHIND_SEC);
// Renderer looks up results from Map
```

**Note:** This requires renderer changes to accept a results Map.

---

## Phase 6: Code Organization (Optional)

### 6.1 Split highwayRenderer.ts

**Only if file continues growing past 600+ lines.**

Current: 523 lines - manageable as-is.

Potential structure if needed:
```
src/lib/rendering/
├── index.ts              # Barrel exports
├── highwayRenderer.ts    # Main renderFrame, setupCanvas
├── colors.ts             # STRING_COLORS, HIT_RESULT_COLORS
├── noteRenderer.ts       # drawNote, getNoteStyle
├── overlays.ts           # Countdown, pause, finished overlays
└── primitives.ts         # clearCanvas, drawStringLines, drawHitZone
```

---

## Implementation Checklist

### Phase 1 (Safe Cleanups) ✅ COMPLETED
- [x] 1.1 Remove 4 truly unused exports (midiMatches, frequenciesMatch, dbToLinear, calculatePeakDb)
- [x] 1.2 Add named constants for magic numbers
- [x] 1.3 Add worklet sync comments

### Phase 2 (Deduplication) ✅ COMPLETED
- [x] 2.1 Create `tabUtils.ts` and update consumers

### Phase 3 (Canvas/Audio) ✅ COMPLETED
- [x] 3.1 Add canvas context options (`alpha: false`, `desynchronized: true`)
- [x] 3.2 Audit memory cleanup (verified proper cleanup in audioCapture.ts)

### Phase 4 (Profiling) - GATE
- [ ] 4.1 Profile 60-second gameplay session
- [ ] 4.2 Document findings (GC frequency, frame times)
- [ ] 4.3 Decide: Proceed to Phase 5 or skip?

### Phase 5 (Only if justified by profiling)
- [ ] 5.1 Implement binary search time windowing
- [ ] 5.2 Refactor visible notes to avoid object spread

### Phase 6 (Optional)
- [ ] 6.1 Split renderer if it grows past 600 lines

---

## Verification After Each Phase

1. `npm run build` - No compilation errors
2. `npm run lint` - No linting errors
3. Manual test:
   - Notes scroll smoothly
   - Hit detection works
   - Score updates correctly
   - No console errors

---

## Summary

| Phase | Risk | Impact | Status |
|-------|------|--------|--------|
| 1. Safe Cleanups | None | Clarity | ✅ Done |
| 2. Deduplication | Low | DRY | ✅ Done |
| 3. Canvas/Audio | Low | Correctness | ✅ Done |
| 4. Profiling | None | Data | ⏳ Pending |
| 5. Game Loop | High | Performance | ⏳ Blocked on Phase 4 |
| 6. Split Files | Low | Organization | ⏳ Optional |
