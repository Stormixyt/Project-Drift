# Project Drift - UI/UX Guidelines

## Design System

### Color Palette

```css
Primary:          #00D9FF  /* Neon Blue */
Background:       #0A0A0A  /* Deep Black */
Surface:          #1A1A1A  /* Dark Gray */
Surface Light:    #2A2A2A  /* Medium Gray */
Text Primary:     #FFFFFF  /* White */
Text Secondary:   #A0A0A0  /* Light Gray */
Success:          #00FF88  /* Neon Green */
Warning:          #FFB800  /* Orange */
Error:            #FF3366  /* Red */
```

### Typography

**Font Family**
- Web/Admin: Inter (Google Fonts)
- Unity Client: Default Unity fonts (Arial, Roboto)

**Font Sizes**
```
Heading 1:  32px / 2rem
Heading 2:  24px / 1.5rem
Heading 3:  20px / 1.25rem
Body:       16px / 1rem
Small:      14px / 0.875rem
Tiny:       12px / 0.75rem
```

**Font Weights**
```
Light:      300
Regular:    400
Medium:     500
Semibold:   600
Bold:       700
```

### Spacing

Use 4px base unit (Tailwind-like scale):
```
xs:  4px   (0.25rem)
sm:  8px   (0.5rem)
md:  16px  (1rem)
lg:  24px  (1.5rem)
xl:  32px  (2rem)
2xl: 48px  (3rem)
3xl: 64px  (4rem)
```

### Border Radius
```
sm:  4px
md:  8px
lg:  12px
xl:  16px
full: 9999px
```

## Components

### Buttons

**Primary Button**
```css
Background: #00D9FF
Text: #000000
Padding: 12px 24px
Border Radius: 8px
Hover: 90% opacity
```

**Secondary Button**
```css
Background: #1A1A1A
Text: #FFFFFF
Border: 1px solid #2A2A2A
Padding: 12px 24px
Border Radius: 8px
Hover: #2A2A2A background
```

**Danger Button**
```css
Background: #FF3366
Text: #FFFFFF
Padding: 12px 24px
Border Radius: 8px
Hover: #CC2952
```

### Cards

```css
Background: #1A1A1A
Border: 1px solid #2A2A2A
Border Radius: 12px
Padding: 24px
```

### Inputs

```css
Background: #1A1A1A
Border: 1px solid #2A2A2A
Border Radius: 8px
Padding: 12px 16px
Focus Border: #00D9FF
```

### Glass Effect

```css
Background: rgba(26, 26, 26, 0.5)
Backdrop Blur: 12px
Border: 1px solid rgba(42, 42, 42, 0.5)
```

## Layout Guidelines

### Admin Dashboard

**Two-Column Layout**
```
┌────────────────────────────────────────┐
│          Header (Full Width)           │
├──────────────┬─────────────────────────┤
│  Server List │   Server Details        │
│  (1/3 width) │   (2/3 width)           │
│              │                         │
│  - Server 1  │   Selected Server Info  │
│  - Server 2  │   Player List           │
│  - Server 3  │   Controls              │
│              │   Live Logs             │
└──────────────┴─────────────────────────┘
```

**Grid System**
- Use 12-column grid for responsive layouts
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

### Unity Client Launcher

**Main Menu Layout**
```
┌─────────────────────────────────────┐
│          Logo (Centered)            │
│                                     │
│      [  Import Build  ]             │
│      [  Join Server   ]             │
│      [  Host Server   ]             │
│      [   Settings     ]             │
│      [     Exit       ]             │
│                                     │
│  Version: 0.1.0                     │
└─────────────────────────────────────┘
```

## Interactions

### Hover States
- Buttons: Reduce opacity to 90% or darken background
- Cards: Subtle border color change to primary color
- Links: Underline appears

### Active States
- Buttons: Scale down to 98%
- Inputs: Border changes to primary color (#00D9FF)

### Loading States
- Spinner: Primary color (#00D9FF) rotating animation
- Skeleton: Animated gradient from surface to surface-light

### Disabled States
- Opacity: 50%
- Cursor: not-allowed

## Icons

Use **Lucide React** for web (admin dashboard):
- Consistent 24px size by default
- Can scale to 16px for small UI or 32px for larger elements

Unity Client:
- Use Unity's built-in icon assets
- Maintain consistent stroke width

## Animations

### Timing Functions
```css
Ease Out:     cubic-bezier(0.33, 1, 0.68, 1)
Ease In Out:  cubic-bezier(0.65, 0, 0.35, 1)
Bounce:       cubic-bezier(0.68, -0.55, 0.265, 1.55)
```

### Durations
```
Fast:    150ms
Normal:  250ms
Slow:    350ms
```

### Examples
- Button hover: 150ms ease-out
- Card hover: 250ms ease-out
- Modal open: 350ms ease-in-out
- Page transition: 250ms ease-out

## Accessibility

### Contrast Ratios
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- UI components: 3:1 minimum

### Focus States
- All interactive elements must have visible focus indicator
- Focus ring: 2px solid #00D9FF with 2px offset

### Keyboard Navigation
- Tab order must follow visual layout
- All actions accessible via keyboard
- Escape key closes modals/overlays

## Responsive Design

### Mobile First
Start with mobile layout and enhance for larger screens

### Breakpoints
```
sm:  640px  (Mobile landscape, small tablets)
md:  768px  (Tablets)
lg:  1024px (Desktops)
xl:  1280px (Large desktops)
2xl: 1536px (Extra large screens)
```

### Admin Dashboard Mobile
- Stack two-column layout vertically
- Hide server list by default, show via hamburger menu
- Touch-friendly buttons (min 44x44px)

## Best Practices

1. **Consistency**: Use design tokens for all values
2. **Contrast**: Ensure sufficient contrast for readability
3. **Spacing**: Use consistent spacing scale
4. **Feedback**: Provide visual feedback for all interactions
5. **Performance**: Optimize animations for 60fps
6. **Accessibility**: Follow WCAG 2.1 AA guidelines

## Implementation

### Tailwind CSS (Admin Dashboard)
All design tokens are configured in `tailwind.config.js`

### Unity (Game Client)
Create a centralized `UITheme` ScriptableObject with all design values

---

**Design approved for production use in Project Drift**
