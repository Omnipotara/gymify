# Frontend Design Context

> Design decisions, tokens, and patterns for the Gymify frontend.
> Keep this updated when making non-trivial UI decisions.

---

## Direction

Dark-first, mobile-first. Inspired by premium fitness app aesthetics — high contrast, vivid blue accents, bold headings. The member experience on mobile is the primary surface; the admin experience on desktop is secondary.

Reference: the purple-dark fitness app mockup from Freepik, recoloured to blue.

---

## Brand Color

| Name | Hex | HSL |
|------|-----|-----|
| Primary | `#3263cf` | `221 62% 50%` |
| Primary (dark mode) | `#5b87e0` | `221 72% 65%` (lightened for contrast on dark bg) |

---

## Theme System

| Concern | Choice |
|---------|--------|
| Engine | `next-themes` with `attribute="class"` |
| Default | Dark |
| Storage key | `gymify-theme` in localStorage |
| Flash prevention | Inline script in `index.html` reads localStorage before React hydrates |
| Tailwind strategy | `darkMode: 'class'` — dark variants applied when `<html class="dark">` |

Toggle: `ThemeToggle` component (sun/moon icon). Placed in sidebar footer (desktop) and mobile top bar.

---

## CSS Variable Tokens

Defined in `src/index.css`. All Tailwind color utilities reference these.

### Light mode (`:root`)
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `0 0% 100%` | Page background |
| `--foreground` | `222 47% 11%` | Primary text |
| `--card` | `0 0% 100%` | Card/panel surfaces |
| `--card-foreground` | `222 47% 11%` | Text on cards |
| `--primary` | `221 62% 50%` | Brand blue |
| `--primary-foreground` | `0 0% 100%` | Text on primary buttons |
| `--secondary` | `210 40% 96%` | Subtle backgrounds, hover states |
| `--muted` | `210 40% 96%` | Muted backgrounds |
| `--muted-foreground` | `215 16% 47%` | Secondary text, labels |
| `--border` | `214 32% 91%` | All borders |
| `--destructive` | `0 84% 60%` | Errors, delete actions |
| `--radius` | `0.75rem` | Border radius base |

### Dark mode (`.dark`)
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `222 47% 6%` | ≈ `#080C16` |
| `--card` | `222 40% 10%` | ≈ `#0F1523` |
| `--primary` | `221 72% 65%` | Lightened for dark bg contrast |
| `--secondary` | `222 35% 16%` | Slightly lighter than card |
| `--muted-foreground` | `215 20% 60%` | Readable on dark bg |
| `--border` | `222 35% 18%` | Subtle dark borders |

---

## Typography

| Use | Font | Weight | Notes |
|-----|------|--------|-------|
| Headings (h1–h6) | Barlow Condensed | 600, 700 | Sporty, condensed — use `font-heading` class |
| Body | Inter | 400, 500, 600 | Clean modern sans |

Loaded via Google Fonts `<link>` in `index.html`. Both fonts preconnected. Fallback: `system-ui, sans-serif`.

To use Barlow on non-heading elements: `className="font-heading"`. Applies automatically to `<h1>`–`<h6>` via `@layer base` in `index.css`.

---

## Navigation

### Desktop (≥ 768px)
- Fixed left sidebar, 240px wide
- `bg-card border-r border-border`
- Logo + context-aware nav items + user footer with theme toggle
- Context-aware: shows different items depending on whether user is in a gym (admin/member) or at the top level

### Mobile (< 768px)
- Fixed bottom tab bar (`bg-card/95 backdrop-blur-sm border-t border-border`)
- Height: 64px + `env(safe-area-inset-bottom)` for iOS home indicator
- Sticky top bar (`bg-card/80 backdrop-blur-md border-b border-border h-14`) with page title + theme toggle
- No hamburger/drawer — sidebar is hidden entirely on mobile

### Bottom tab sets (context-aware)

| Context | Tabs |
|---------|------|
| No gym | Gyms, [Admin if super admin], Profile |
| Gym + member | My Gyms, Check In, Profile |
| Gym + admin | Members, Stats, Rewards, Profile |

---

## Component Patterns

### Cards / panels
```
rounded-2xl bg-card border border-border
```
Use `overflow-hidden` when card has child sections with different backgrounds.

### Inputs
```
rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground
placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
```
For small/inline inputs: `py-1.5`. For auth page (dark gradient bg): use `dark:bg-white/10 dark:border-white/20 dark:text-white`.

### Buttons

**Primary:**
```
rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50
```

**Outline/secondary:**
```
rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground
```

**Destructive:**
```
rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90
```

**Text/link:**
```
text-primary hover:underline   (or text-destructive for delete)
```

### Status badges (MembershipBadge)
Opacity-based so they work in both dark and light mode:
```
active:      bg-green-500/15 text-green-700 dark:text-green-400
expiring:    bg-amber-500/15 text-amber-700 dark:text-amber-400
expired:     bg-destructive/15 text-destructive
none:        bg-secondary text-muted-foreground
```

### Alert banners
```
error:   bg-destructive/10 border border-destructive/20 text-destructive
warning: bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400
success: bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400
```

### Stat numbers
```
font-heading text-3xl font-bold text-foreground
```
Secondary label: `text-xs text-muted-foreground mt-1`

---

## Auth Pages

All three auth pages (Login, Register, ForgotPassword) share:
- `auth-gradient` CSS class: plain `bg-background` in light mode, dark gradient in dark mode
- Content: centered `max-w-sm` column with logo + form
- Logo: `Dumbbell` icon in `bg-primary/10 dark:bg-white/10` rounded box
- Inputs: frosted glass in dark (`dark:bg-white/10 dark:border-white/20`), standard in light
- Button: primary blue in light; white button with dark blue text (`dark:bg-white dark:text-[#0d2251]`) in dark

Dark gradient definition in `index.css`:
```css
.dark .auth-gradient {
  background: linear-gradient(145deg, #112a5c 0%, #060c18 100%);
}
```

---

## Recharts (AnalyticsPage)

Recharts uses props not CSS classes, so dark mode colors are passed explicitly. Import `useTheme` from `next-themes` and set:
```ts
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';
// grid stroke: isDark ? '#1f2b42' : '#f0f0f0'
// tick fill:   isDark ? '#6b7a99' : '#9ca3af'
// chart stroke: '#3263cf' (always)
```

---

## QR Codes

The `<QRCode>` component (react-qr-code) renders always with a white background — this is correct and intentional. Always wrap in `bg-white p-N rounded-xl` to ensure it's readable regardless of app theme.

---

## Utility

`src/lib/utils.ts` exports `cn(...classes)` — clsx + tailwind-merge. Import wherever you need conditional/merged Tailwind classes.
