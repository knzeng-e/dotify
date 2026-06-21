---
name: High-Fidelity Web3 Audio
colors:
  surface: '#111416'
  surface-dim: '#111416'
  surface-bright: '#37393c'
  surface-container-lowest: '#0c0e11'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#282a2d'
  surface-container-highest: '#323538'
  on-surface: '#e1e2e6'
  on-surface-variant: '#c0c7ce'
  inverse-surface: '#e1e2e6'
  inverse-on-surface: '#2e3133'
  outline: '#8a9298'
  outline-variant: '#40484d'
  surface-tint: '#90cef4'
  primary: '#c0e5ff'
  on-primary: '#00344a'
  primary-container: '#8eccf2'
  on-primary-container: '#015778'
  inverse-primary: '#1d6587'
  secondary: '#b3cada'
  on-secondary: '#1d3340'
  secondary-container: '#364c5a'
  on-secondary-container: '#a5bbcc'
  tertiary: '#ffdab6'
  on-tertiary: '#482900'
  tertiary-container: '#f9b870'
  on-tertiary-container: '#754705'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c5e7ff'
  primary-fixed-dim: '#90cef4'
  on-primary-fixed: '#001e2d'
  on-primary-fixed-variant: '#004c6a'
  secondary-fixed: '#cee6f7'
  secondary-fixed-dim: '#b3cada'
  on-secondary-fixed: '#061e2a'
  on-secondary-fixed-variant: '#344957'
  tertiary-fixed: '#ffddbb'
  tertiary-fixed-dim: '#fbba72'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#111416'
  on-background: '#e1e2e6'
  surface-variant: '#323538'
typography:
  display-lg:
    fontFamily: Clash Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Clash Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Clash Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Clash Display
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 16px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is engineered for a mobile-first, high-performance music ecosystem that bridges decentralized finance with live entertainment. The brand personality is "Arctic Horizon"—transitioning from deep indigo tones to a luminous, atmospheric blue that suggests clarity, expansive space, and high-fidelity digital precision.

The aesthetic avoids ethereal "orb" trends in favor of structured, high-fidelity surfaces. It utilizes a **Modern-Technical** approach: deep dark backgrounds, sophisticated slate and cyan-blue accents for functional clarity, and a dense, information-rich layout that remains elegant through strict grid discipline. The emotional response should be one of professional-grade audio equipment—reliable, high-performance, and sophisticated.

## Colors

The color palette is anchored in a deep, dark base to maximize contrast and focus on album artwork and artist media. 

- **Primary Accent (Glacier Blue):** A tech-forward, medium-light blue (#3D7EA1) used for core interactions, play states, and primary navigation. It represents a clear digital signal.
- **Secondary Accent (Slate Gray):** A structural color (#647A89) used for supporting UI elements, secondary actions, and grouped metadata.
- **Tertiary Accent (Amber Gold):** A warm, high-visibility accent (#F9B870) reserved for live status indicators, "New" badges, and specific real-time alerts.
- **Neutral (Cool Gray):** Used for micro-borders, inactive icons, and descriptive text (#75777A) to maintain a sophisticated hardware aesthetic.
- **Surfaces:** UI containers use a dark, neutral-tinted charcoal to provide subtle depth without breaking the dark immersion.

## Typography

Typography follows a strict hierarchical split based on function:

1.  **Headlines (Clash Display):** High-character, geometric sans-serif used for artist names, album titles, and section headers. It provides the "editorial" feel of a music magazine.
2.  **UI/Body (Inter):** Maximum legibility for track listings, descriptions, and settings. Inter ensures the interface remains functional and grounded.
3.  **Technical (JetBrains Mono):** Used for blockchain addresses, transaction hashes, timestamps, and audio bitrates. This emphasizes the DApp’s technical transparency.

On mobile devices, `display-lg` should be used sparingly for artist profiles, while `headline-sm` handles most standard view titles.

## Layout & Spacing

The layout is optimized for a **Dense-Elegant** mobile experience. It utilizes a 4px base grid system to maintain tightness and precision.

- **Grid:** 4-column fluid grid for mobile, expanding to 12-columns on desktop. 
- **Safe Zones:** A standard 16px horizontal margin is applied to all main views.
- **Density:** Lists and track items use tight vertical padding (8px - 12px) to allow more content on the screen, mimicking professional digital audio workstations (DAWs).
- **Navigation:** A fixed bottom navigation bar handles primary app states, with a persistent "Now Playing" mini-player docked above it.

## Elevation & Depth

This design system avoids heavy shadows. Depth is created through **Tonal Layering** and **Micro-Borders**:

- **Layer 0:** The deepest background layer—the "Floor."
- **Layer 1:** Surface elevation used for cards, list items, and input fields.
- **Layer 2:** Elevated tier used for floating action buttons or active modals.
- **Micro-Borders:** Instead of shadows, use 1px solid borders at low opacity (utilizing the Neutral color #75777A) to define element boundaries. This maintains a crisp, "hardware" look.
- **Active States:** Selection is indicated by a 2px left-accent border or a subtle inner glow of the Primary Glacier Blue color.

## Shapes

The shape language is disciplined and geometric. A "Soft" roundedness level is applied consistently across the system to maintain a modern feel without appearing "bubbly."

- **Standard Elements:** Buttons, cards, and input fields use a **4px to 8px** corner radius.
- **Album Art:** Specifically restricted to an **8px** radius to ensure the focus remains on the artwork while softening the edges for the mobile screen.
- **Interactive Icons:** Contained within square or 4px-radius frames to reinforce the technical aesthetic.

## Components

### Buttons
- **Primary:** Solid #3D7EA1 background with light text. 4px radius. 
- **Ghost:** 1px border (#75777A at 30%) with white text.
- **Secondary Action:** Solid #647A89 background for utility triggers.

### Cards & Track Items
- **Track Item:** Horizontal layout. 48px square album art (8px radius). Title in Inter Medium (14px), Artist in Inter Regular (12px, #75777A).
- **Artist Card:** Vertical layout. 140px square image. Headline-sm for the name.

### Inputs
- **Search/Fields:** Dark surface background, 1px neutral border. Text in Inter 14px. Focus state: border-color #3D7EA1.

### Technical Tags
- **Bitrate/Chain Badges:** JetBrains Mono 10px. Surface background. Border matched to the relevant accent color (e.g., Amber #F9B870 for live content).

### Progress Bars
- **Audio Seekbar:** 4px height. Muted track background, active fill #3D7EA1. The handle is a simple 12px circle, appearing only on interaction.