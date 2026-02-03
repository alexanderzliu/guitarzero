# GuitarZero Design System

## Aesthetic Direction: "Garage Film"

Inspired by **The White Stripes' "Under Blackpool Lights"** (2004) - a concert film shot entirely on Super 8 and 16mm film at the Empress Ballroom. The visual language captures raw garage rock energy: grainy analog footage, warm tube amp glow, intimate club atmosphere, no-frills authenticity.

> "You couldn't ask for a more vintage feel unless Toerag studios opened a film division."

### Core Principles

1. **Raw over polished** - Embrace imperfection, grain, and organic texture
2. **Analog warmth** - Everything should feel like it's glowing through a tube amp
3. **High contrast** - Deep murky blacks with harsh spotlight pools
4. **Restraint with power** - Red is used sparingly but hits hard when it appears
5. **Authenticity** - Like a gig poster, hand-painted signage, garage band flyers

---

## Color Palette

### Primary Colors (The White Stripes Signature)

| Name | Hex | Usage |
|------|-----|-------|
| **Void Black** | `#0a0a0a` | Primary background, the darkness of the venue |
| **Blood Red** | `#dc2626` | Primary accent, stage lights, energy, hits |
| **Cream White** | `#f5f0e6` | Primary text, spotlight pools |

### Secondary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Warm Black** | `#1a1614` | Card backgrounds, subtle elevation |
| **Charcoal** | `#292524` | Borders, dividers, secondary surfaces |
| **Amber Glow** | `#d97706` | Warm accents, tube amp warmth |
| **Smoke** | `#78716c` | Secondary text, muted elements |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Perfect** | `#fbbf24` | Perfect hits - golden spotlight |
| **Good** | `#f5f0e6` | Good hits - clean white |
| **OK** | `#d97706` | OK hits - amber warning |
| **Miss** | `#7f1d1d` | Missed notes - dark blood red |

### String Colors (Guitar Hero-style, warmed)

```
String 1 (high E): #4ade80  → Warm to #65a30d (lime, organic)
String 2 (B):      #eab308  → Keep (already warm yellow)
String 3 (G):      #f97316  → Keep (already warm orange)
String 4 (D):      #3b82f6  → Warm to #0891b2 (cyan, vintage)
String 5 (A):      #8b5cf6  → Warm to #a855f7 (purple, richer)
String 6 (low E):  #ef4444  → Warm to #dc2626 (blood red)
```

---

## Typography

### Font Stack

**Display / Headers:**
- Primary: **"Bebas Neue"** - Bold, condensed, poster-style
- Fallback: Impact, Haettenschweiler, sans-serif

**Body / UI:**
- Primary: **"Barlow"** - Clean, slightly condensed, industrial
- Fallback: system-ui, sans-serif

**Monospace / Data:**
- Primary: **"IBM Plex Mono"** - Technical, retro-computing feel
- Fallback: monospace

### Type Scale

| Element | Font | Size | Weight | Style |
|---------|------|------|--------|-------|
| App Title | Bebas Neue | 48px | 400 | Uppercase, tracking wide |
| Section Header | Bebas Neue | 24px | 400 | Uppercase |
| Card Title | Barlow | 18px | 600 | Normal |
| Body | Barlow | 14px | 400 | Normal |
| Label | Barlow | 12px | 500 | Uppercase, tracking wide |
| Data/Numbers | IBM Plex Mono | 14px | 500 | Tabular nums |

---

## Texture & Effects

### Film Grain Overlay

A subtle animated grain texture covers the entire viewport:
- Opacity: 3-5% (subtle, not distracting)
- Animation: Slow drift/flicker to feel organic
- Implementation: CSS pseudo-element with noise texture or SVG filter

### Vignette

Darkening at edges to focus attention and create intimacy:
- Style: Radial gradient from transparent center to dark edges
- Intensity: Subtle on main screens, heavier during gameplay
- Implementation: CSS radial-gradient overlay

### Light Leaks

Occasional warm amber/red bleeds, especially on:
- Session results (celebration)
- Perfect hit streaks
- Implementation: Positioned gradients with low opacity

### Glow Effects

Tube amp warmth on interactive elements:
- Buttons glow red on hover
- Active inputs have warm amber outline
- Hit notes pulse with saturated glow
- Implementation: box-shadow with color, blur

---

## Motion & Animation

### Principles

1. **Organic over mechanical** - Ease curves that feel natural
2. **Flicker and pulse** - Like stage lights and tube amps
3. **Restraint** - Motion should enhance, not distract during gameplay

### Animations

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Page transitions | Fade + slight scale | 200ms | ease-out |
| Button hover | Glow pulse | 150ms | ease-in-out |
| Note hit (perfect) | Scale pulse + glow burst | 200ms | ease-out |
| Note hit (miss) | Shake + fade | 150ms | ease-in |
| Countdown numbers | Scale in + glow | 500ms | ease-out |
| Film grain | Continuous drift | 100ms loop | linear |

### Idle States

When paused or on menus, subtle ambient motion:
- Grain continues
- Slight vignette pulse (breathing)
- Occasional flicker on accent elements

---

## Component Patterns

### Cards

```
- Background: Warm Black (#1a1614)
- Border: 1px solid Charcoal (#292524)
- Border radius: 4px (slightly rounded, not too soft)
- Shadow: None (shadows feel too digital)
- Hover: Subtle red glow on border
```

### Buttons

**Primary (Red):**
```
- Background: Blood Red (#dc2626)
- Text: Cream White (#f5f0e6)
- Hover: Brighter red + glow
- Active: Darker red, pressed feel
```

**Secondary:**
```
- Background: Charcoal (#292524)
- Border: 1px solid Smoke (#78716c)
- Text: Cream White (#f5f0e6)
- Hover: Border turns red
```

### Inputs

```
- Background: Void Black (#0a0a0a)
- Border: 1px solid Charcoal (#292524)
- Text: Cream White (#f5f0e6)
- Focus: Amber glow border
- Placeholder: Smoke (#78716c)
```

### The Highway (Gameplay Canvas)

```
- Background: Pure black (#000000) with subtle noise
- String lines: Faint, barely visible (#1a1614)
- Hit zone: Bright vertical line with red glow
- Notes: String-colored with white border, glow on approach
- Timing bands: Very subtle, barely perceptible
```

---

## Screen-Specific Notes

### Main Menu

- Large, bold title treatment (Bebas Neue)
- Cards arranged with generous spacing
- Vignette more pronounced
- Subtle red accent on important actions

### Game Screen

- Maximum immersion: minimal UI, full-screen highway
- Score/streak in upper corners, subtle until streak builds
- Controls at bottom, low profile
- Heavy vignette during gameplay
- Grain continues but doesn't interfere with note reading

### Results Screen

- Celebratory: more light leaks, warmer overall
- Grade displayed huge, centered
- Stats feel like a gig poster / setlist
- "Play Again" button prominent with glow

---

## Implementation Notes

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-void: #0a0a0a;
  --color-warm-black: #1a1614;
  --color-charcoal: #292524;
  --color-blood-red: #dc2626;
  --color-cream: #f5f0e6;
  --color-amber: #d97706;
  --color-smoke: #78716c;

  /* Typography */
  --font-display: 'Bebas Neue', Impact, sans-serif;
  --font-body: 'Barlow', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* Effects */
  --glow-red: 0 0 20px rgba(220, 38, 38, 0.5);
  --glow-amber: 0 0 15px rgba(217, 119, 6, 0.4);
}
```

### Font Loading

Add to `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Grain Texture

Option 1: SVG filter (performant)
```css
.grain {
  filter: url(#noise);
}
```

Option 2: CSS with tiny noise image (simple)
```css
.grain::before {
  content: '';
  position: fixed;
  inset: 0;
  background: url('/noise.png');
  opacity: 0.03;
  pointer-events: none;
  animation: grain 100ms steps(4) infinite;
}
```

---

## References

- [Under Blackpool Lights - Wikipedia](https://en.wikipedia.org/wiki/Under_Blackpool_Lights)
- [The White Stripes visual aesthetic](https://www.punknews.org/review/3705/the-white-stripes-under-blackpool-lights-dvd)
- Super 8 / 16mm film characteristics
- Vintage gig posters and garage rock imagery
- Tube amplifier glow and stage lighting
