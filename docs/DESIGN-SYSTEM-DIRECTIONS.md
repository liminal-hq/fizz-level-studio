# Design system directions E to H

The studio's look, explored a second time. Directions A to D (frosted pills, soft tactile, hairline and underline, and pixel bevel) did not land, so four new directions, E to H, start from Ben rather than from the game's pixels. This page records why, what each direction is, and every colour and font choice, so the decision can be picked up later. The boards live on the Design system page of the studio's design canvas, in the row below directions A to D, with this page beside them.

## The feedback so far

- **None of A to D inspire.** The owner's words: "None of them inspire me."
- **The game's pixel font is rejected for the app.** It does not work well on a desktop app; the studio uses good sans serif families instead.
- **The game's colour palette is rejected for the app's chrome.** It is too harsh for interface colour. The EGA palette board was made because the owner asked to see it as a curiosity, not as a direction.
- **The A to D colours are uninspiring.** Flat greys and purples, with an orange primary, read as generic.
- **The blur is liked.** The frosted-glass effect on panels, menus, and dialogs over the level stays, in every new direction.
- **The original button style is disliked.** The new directions each draw their buttons differently, and none reuses A's translucent pill.
- **Ben's personality should drive the design**, and the result should be documented for later use, which is this page.

## Ben

Ben is a playful, curious eight-year-old with a mind for figuring out how things work. If it is not broken, he will break it just to fix it. He loves biking and whatever his cousin is up to, thrives on new adventures, and has a knack for saving the day. He is caring, loving, loyal, and fun to be around. He is deep into understanding technology and loves to push the limits of whatever he can get his hands on.

Four traits were drawn out of that, one per direction:

| Direction           | Trait                                   | What it becomes in the interface                                                               |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| E · The Tinkerer    | Takes things apart to see how they work | Exposed structure: a drafting grid, construction marks, printed measurements, quiet precision  |
| F · The Trail Rider | Biking, his cousin, new adventures      | Motion: controls that lean forward, tabs as stops on a trail, a switch that rolls like a wheel |
| G · The Hero        | Saves the day                           | Confidence: night-sky navy and marigold, solid outlines, heavy labels, one clear action        |
| H · The Companion   | Caring, loving, loyal, fun              | Welcome: soft rounded surfaces, shadows instead of lines, a tooltip tail, a switch that smiles |

Playfulness is kept to small details in every direction. The studio is a tool people sit in for hours, so the chrome stays calm and the delight lives in a handful of moments: a switch, a tab marker, a tooltip, a status line.

## Type

The game's pixel font is dropped for the desktop app. A pixel face is built for one size on a low-resolution grid; in an app it is hard to read at small sizes, it cannot be hinted for body text, it has no weights to build a hierarchy with, and it ties the tool to the game's look when the tool should frame the game rather than imitate it. The level itself still shows the game's own art in the Game view; the chrome around it does not.

Each direction picks one or two Google Fonts sans serif families and a monospace face for code and the script. All are open-licensed and on Google Fonts.

| Direction           | Display             | Interface       | Code           | Why                                                                                                                  |
| ------------------- | ------------------- | --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| E · The Tinkerer    | Instrument Sans     | Instrument Sans | IBM Plex Mono  | A clean, precise grotesque reads like a technical label; Plex Mono carries the measurements and field values         |
| F · The Trail Rider | Outfit              | DM Sans         | DM Mono        | Outfit's round geometric forms feel friendly and quick; DM Sans keeps small text readable                            |
| G · The Hero        | Bricolage Grotesque | Figtree         | JetBrains Mono | Bricolage has character at heavy weights for titles; Figtree is sturdy and clear at 700 and 800 for confident labels |
| H · The Companion   | Nunito              | Source Sans 3   | JetBrains Mono | Nunito's rounded terminals are warm without being childish; Source Sans 3 is a calm humanist face for long reading   |

## Colour

The game's EGA colours are saturated primaries chosen for a 1990s screen. As interface colour they vibrate against each other, fight with the level being edited, and leave no room for a calm hierarchy. Directions A to D avoided that but went flat: cool greys and violets with an orange primary that read as any app. The new palettes are softer and more considered: each has a tinted ground (cool blueprint, warm sand, night navy, warm cocoa or oatmeal), gentler contrast between surfaces, one primary for action, and one accent for selection and state. Saturated colour stays in the level, where it belongs.

Every text pair was computed with the WCAG 2 relative luminance formula. Translucent tints were composited over the surface they sit on, and frosted glass was composited at its opacity over the stage colour behind it (the blur itself is ignored, which is the worst case). Every text pair is at least 4.5:1; borders and focus rings that mark a control's edge are at least 3:1. The lowest text pair in each scheme: E 5.12 dark and 4.66 light, F 5.18 and 4.85, G 5.27 and 4.90, H 5.39 and 4.65.

Status colours differ in lightness as well as hue, and danger never relies on red against green alone.

### E · The Tinkerer palette

| Role           | Token                  | Dark      | Light     |
| -------------- | ---------------------- | --------- | --------- |
| Window         | `--fls-bg-window`      | `#121a22` | `#eef2f4` |
| Panel          | `--fls-bg-content`     | `#16202a` | `#f7f9fa` |
| Raised         | `--fls-bg-raised`      | `#1b2631` | `#ffffff` |
| Selected       | `--fls-bg-selected`    | `#1d3a4a` | `#d2e5ed` |
| Strong border  | `--fls-border-strong`  | `#5c7487` | `#77899a` |
| Text           | `--fls-text-primary`   | `#e4ecf2` | `#17222b` |
| Secondary text | `--fls-text-secondary` | `#b6c4d0` | `#3b4d5a` |
| Muted text     | `--fls-text-muted`     | `#91a3b2` | `#53646f` |
| Primary        | `--fls-primary`        | `#dc9a62` | `#9c4f22` |
| Primary label  | `--fls-primary-fg`     | `#121a22` | `#ffffff` |
| Accent         | `--fls-accent`         | `#7cc4d8` | `#246f86` |
| Accent text    | `--fls-accent-text`    | `#8fd0e2` | `#1d6178` |
| Danger         | `--fls-danger`         | `#f0907f` | `#ad3626` |
| Success        | `--fls-success`        | `#8fcca3` | `#2c744b` |
| Focus ring     | `--fls-focus-ring`     | `#a3d4ff` | `#1d68aa` |

| Pair                               | Dark    | Light   |
| ---------------------------------- | ------- | ------- |
| Text on window                     | 14.69:1 | 14.34:1 |
| Secondary text on window           | 9.86:1  | 7.78:1  |
| Muted text on window               | 6.76:1  | 5.45:1  |
| Muted text on raised               | 5.91:1  | 6.14:1  |
| Muted text on glass over the level | 6.88:1  | 5.61:1  |
| Primary label on primary           | 7.39:1  | 5.91:1  |
| Primary text on primary tint       | 6.92:1  | 4.94:1  |
| Accent text on accent tint         | 6.41:1  | 5.54:1  |
| Danger text on danger tint         | 6.19:1  | 4.66:1  |
| Focus ring on window               | 11.21:1 | 5.16:1  |
| Strong border on window            | 3.60:1  | 3.20:1  |

### F · The Trail Rider palette

| Role           | Token                  | Dark      | Light     |
| -------------- | ---------------------- | --------- | --------- |
| Window         | `--fls-bg-window`      | `#1a1d19` | `#f5f1e8` |
| Panel          | `--fls-bg-content`     | `#20241f` | `#fbf8f2` |
| Raised         | `--fls-bg-raised`      | `#272c26` | `#ffffff` |
| Selected       | `--fls-bg-selected`    | `#2e4231` | `#dde8d3` |
| Strong border  | `--fls-border-strong`  | `#6b7766` | `#8c836f` |
| Text           | `--fls-text-primary`   | `#eef0e8` | `#22251e` |
| Secondary text | `--fls-text-secondary` | `#c8cdbe` | `#484d40` |
| Muted text     | `--fls-text-muted`     | `#a3aa98` | `#5f6555` |
| Primary        | `--fls-primary`        | `#9fcb8b` | `#3d6a38` |
| Primary label  | `--fls-primary-fg`     | `#162014` | `#ffffff` |
| Accent         | `--fls-accent`         | `#f2a27e` | `#b85234` |
| Accent text    | `--fls-accent-text`    | `#f5b293` | `#a2462b` |
| Danger         | `--fls-danger`         | `#f28c9b` | `#a92d3d` |
| Success        | `--fls-success`        | `#9fcb8b` | `#3d6a38` |
| Focus ring     | `--fls-focus-ring`     | `#9cc8ff` | `#2a66a8` |

| Pair                               | Dark    | Light   |
| ---------------------------------- | ------- | ------- |
| Text on window                     | 14.80:1 | 13.79:1 |
| Secondary text on window           | 10.48:1 | 7.73:1  |
| Muted text on window               | 7.10:1  | 5.35:1  |
| Muted text on raised               | 5.94:1  | 6.04:1  |
| Muted text on glass over the level | 7.25:1  | 5.45:1  |
| Primary label on primary           | 9.11:1  | 6.33:1  |
| Primary text on primary tint       | 7.41:1  | 5.16:1  |
| Accent text on accent tint         | 5.75:1  | 4.90:1  |
| Danger text on danger tint         | 5.96:1  | 4.93:1  |
| Focus ring on window               | 9.82:1  | 5.23:1  |
| Strong border on window            | 3.61:1  | 3.33:1  |

### G · The Hero palette

| Role           | Token                  | Dark      | Light     |
| -------------- | ---------------------- | --------- | --------- |
| Window         | `--fls-bg-window`      | `#141821` | `#f7f4ec` |
| Panel          | `--fls-bg-content`     | `#191e29` | `#fcfaf5` |
| Raised         | `--fls-bg-raised`      | `#1f2532` | `#ffffff` |
| Selected       | `--fls-bg-selected`    | `#3a3220` | `#f6e6bf` |
| Strong border  | `--fls-border-strong`  | `#606c85` | `#8f8873` |
| Text           | `--fls-text-primary`   | `#f3efe6` | `#1a1e28` |
| Secondary text | `--fls-text-secondary` | `#cbc7bd` | `#414656` |
| Muted text     | `--fls-text-muted`     | `#a7a39a` | `#5a5f6d` |
| Primary        | `--fls-primary`        | `#f2b544` | `#eaa93a` |
| Primary label  | `--fls-primary-fg`     | `#141821` | `#1a1e28` |
| Accent         | `--fls-accent`         | `#6cc6b8` | `#1d7368` |
| Accent text    | `--fls-accent-text`    | `#84d2c6` | `#196459` |
| Danger         | `--fls-danger`         | `#f4876f` | `#a8381f` |
| Success        | `--fls-success`        | `#86d297` | `#2c7340` |
| Focus ring     | `--fls-focus-ring`     | `#93b8ff` | `#2453bd` |

| Pair                               | Dark    | Light   |
| ---------------------------------- | ------- | ------- |
| Text on window                     | 15.48:1 | 15.16:1 |
| Secondary text on window           | 10.52:1 | 8.55:1  |
| Muted text on window               | 7.06:1  | 5.80:1  |
| Muted text on raised               | 6.10:1  | 6.38:1  |
| Muted text on glass over the level | 7.14:1  | 5.86:1  |
| Primary label on primary           | 9.70:1  | 8.12:1  |
| Primary text on primary tint       | 8.05:1  | 5.82:1  |
| Accent text on accent tint         | 6.31:1  | 5.59:1  |
| Danger text on danger tint         | 6.02:1  | 4.90:1  |
| Focus ring on window               | 8.92:1  | 6.27:1  |
| Strong border on window            | 3.37:1  | 3.22:1  |

### H · The Companion palette

| Role           | Token                  | Dark      | Light     |
| -------------- | ---------------------- | --------- | --------- |
| Window         | `--fls-bg-window`      | `#1e1a18` | `#f7f1ea` |
| Panel          | `--fls-bg-content`     | `#24201d` | `#fcf8f3` |
| Raised         | `--fls-bg-raised`      | `#2b2623` | `#ffffff` |
| Selected       | `--fls-bg-selected`    | `#43322a` | `#f6e0d3` |
| Strong border  | `--fls-border-strong`  | `#776b61` | `#958679` |
| Text           | `--fls-text-primary`   | `#f4ede6` | `#2a2420` |
| Secondary text | `--fls-text-secondary` | `#d3c8be` | `#54493f` |
| Muted text     | `--fls-text-muted`     | `#afa498` | `#6b5f55` |
| Primary        | `--fls-primary`        | `#f1ab8c` | `#ad5435` |
| Primary label  | `--fls-primary-fg`     | `#1e1a18` | `#ffffff` |
| Accent         | `--fls-accent`         | `#a9c8a4` | `#4a7748` |
| Accent text    | `--fls-accent-text`    | `#b9d4b4` | `#406b3e` |
| Danger         | `--fls-danger`         | `#f4919a` | `#ab2f3a` |
| Success        | `--fls-success`        | `#a9c8a4` | `#4a7748` |
| Focus ring     | `--fls-focus-ring`     | `#9fc4ff` | `#2c68b0` |

| Pair                               | Dark    | Light   |
| ---------------------------------- | ------- | ------- |
| Text on window                     | 14.89:1 | 13.65:1 |
| Secondary text on window           | 10.50:1 | 7.80:1  |
| Muted text on window               | 7.06:1  | 5.52:1  |
| Muted text on raised               | 6.11:1  | 6.19:1  |
| Muted text on glass over the level | 7.21:1  | 5.61:1  |
| Primary label on primary           | 9.00:1  | 5.13:1  |
| Primary text on primary tint       | 7.55:1  | 5.08:1  |
| Accent text on accent tint         | 6.56:1  | 5.01:1  |
| Danger text on danger tint         | 6.23:1  | 4.88:1  |
| Focus ring on window               | 9.71:1  | 5.04:1  |
| Strong border on window            | 3.34:1  | 3.14:1  |

## The four directions

### E · The Tinkerer

- **Idea:** The inside of the machine is on show. Ben takes things apart to see how they work, so the interface shows its own construction.
- **Palette:** Blueprint ink (`#121a22`) and cool drafting paper (`#eef2f4`), with a soft cyan line colour (`#7cc4d8` dark, `#246f86` light) for selection and a copper wire primary (`#dc9a62` dark, `#9c4f22` light) for action.
- **Shapes:** Square, 3 px corners, one-pixel lines. The slide switch is rectangular with a ribbed knob, like a hardware switch. Segmented controls are joined cells with a line under the chosen one.
- **Density:** The densest of the four: 28 px controls, 24 px panel padding.
- **Type:** Instrument Sans for labels; IBM Plex Mono for section numbers, field values, keyboard shortcuts, the tooltip, and the status bar.
- **Signature details:** A faint 24 px drafting grid on every panel; corner construction marks on panels, menus, and dialogs; numbered section headings with a dashed rule; a spec tag that prints a control's height, radius, padding, and type; numbered tabs; level tiles drawn as outlines over a grid, as though the level were a plan.
- **Where the play is:** The measurements and construction marks are an invitation to look closer, the way Ben looks inside things.
- **Blur:** Thin glass (12 to 16 px) so the grid shows through the menu and the dialog.

### F · The Trail Rider

- **Idea:** Always heading somewhere. Ben loves biking and new adventures, so the interface has a sense of travel.
- **Palette:** Evening moss (`#1a1d19`) and trail sand (`#f5f1e8`), with a sage and forest green primary (`#9fcb8b` dark, `#3d6a38` light) and a sunset coral accent (`#f2a27e` dark, `#b85234` light).
- **Shapes:** 12 px corners on controls and 22 px on panels; round icon buttons like wheels. The primary button's fill is skewed forward by ten degrees while its label stays upright.
- **Density:** Open and generous: 38 px controls, 30 px panel padding.
- **Type:** Outfit for headings and buttons, DM Sans for text, DM Mono for code.
- **Signature details:** Tabs are stops on a dashed trail, with the current stop filled in coral; the switch knob is a spoked wheel that rolls and turns as it moves; icons nudge forward on hover; the Create button carries an arrow; rolling hills in the level stage.
- **Where the play is:** The wheel switch, the trail tabs, and the forward lean.
- **Blur:** Warm, medium glass (16 to 20 px) with large corners.

### G · The Hero

- **Idea:** Ready to save the day. Confident and warm, strong but not shouting.
- **Palette:** Night-sky navy (`#141821`) and warm paper (`#f7f4ec`), with a marigold primary (`#f2b544` dark, `#eaa93a` light, both with dark labels) and a rescue teal accent (`#6cc6b8` dark, `#1d7368` light).
- **Shapes:** 8 px corners and solid two-pixel outlines on every control. The segmented control inverts the chosen option, text colour on window colour, for a bold, clear choice.
- **Density:** Medium: 36 px controls, 28 px panel padding.
- **Type:** Bricolage Grotesque at 700 and 800 for titles; Figtree at 700 and 800 for labels and buttons; uppercase, tracked section headings.
- **Signature details:** A star on the primary button; a soft marigold halo when the primary is hovered; a small marigold notch under the selected tab, like a badge ribbon; a shield badge on dialog titles; a star beside "Saved"; a night sky with a few stars behind the level.
- **Where the play is:** The stars, the shield, and the ribbon notch, each used once.
- **Blur:** Medium glass (14 to 18 px) with two-pixel edges, matching the controls.

### H · The Companion

- **Idea:** A friend at your side. Caring, loving, loyal, and fun, so the interface feels welcoming.
- **Palette:** Warm cocoa (`#1e1a18`) and oatmeal (`#f7f1ea`), with a soft peach and terracotta primary (`#f1ab8c` dark, `#ad5435` light) and a gentle sage accent (`#a9c8a4` dark, `#4a7748` light).
- **Shapes:** The roundest: 14 px corners on controls, 26 to 28 px on panels and dialogs. Surfaces are separated by soft shadows rather than lines.
- **Density:** The most spacious: 40 px controls, 32 px panel padding, 14.5 px field text.
- **Type:** Nunito for headings and buttons, Source Sans 3 for text, JetBrains Mono for code.
- **Signature details:** The switch knob gets two eyes and a smile when it is on; tooltips have a small tail; tabs and segmented choices lift out of a soft tray; the primary rises a pixel on hover and squashes slightly when pressed; the status bar says "Saved, all safe".
- **Where the play is:** The smiling switch and the friendly status line.
- **Blur:** The heaviest glass (22 px) with the largest corners, like frosted sea glass.

## How they differ

|                | E · Tinkerer          | F · Trail Rider             | G · Hero                  | H · Companion                |
| -------------- | --------------------- | --------------------------- | ------------------------- | ---------------------------- |
| Corners        | 3 px                  | 12 px, skewed primary       | 8 px                      | 14 to 28 px                  |
| Edges          | 1 px lines            | 1.5 px lines                | 2 px outlines             | Shadows                      |
| Control height | 28 px                 | 38 px                       | 36 px                     | 40 px                        |
| Ground         | Cool blueprint        | Warm sand and moss          | Night navy and warm paper | Cocoa and oatmeal            |
| Primary        | Copper                | Sage and forest green       | Marigold                  | Peach and terracotta         |
| Accent         | Cyan line             | Sunset coral                | Rescue teal               | Sage                         |
| Signature      | Grid and measurements | Trail tabs and wheel switch | Star, shield, ribbon      | Smiling switch, tooltip tail |

All four keep the shared `--fls-*` token names from directions A to D, so any of them can be applied to the app's stylesheet without renaming.

## Research notes

A short look at current interface design, for direction rather than copying. No proprietary design was reproduced.

- **Calm over flash for long sessions.** Recent trend round-ups (daisyUI's UI design trends, Lollypop's 2026 UI trends) note that tools used for hours are moving towards calm, clarity, and restraint, with personality in a few details. This set how much play each direction allows.
- **Warm, tinted neutrals.** Several 2026 colour pieces (Updivision's UI colour trends) point to productivity tools moving from pure greys to warm greys and soft beige grounds. Directions F, G (light), and H use tinted, warm grounds; E uses a cool tint deliberately.
- **One action colour.** Palette guides recommend a limited set of tones with a single accent for action. Each direction has exactly one primary and one accent.
- **Soft and clay-like interfaces need contrast checks.** Comparisons of glassmorphism, neumorphism, and claymorphism (Pixso) note the friendly, rounded, pastel look and its accessibility catch. H borrows the softness but keeps text at 4.5:1 or better and keeps a visible edge on inputs.
- **Perceptual colour and contrast at the token level.** Evil Martians' Harmony palette and their writing on the OKLCH ecosystem describe building palettes in a perceptual space and checking contrast when a token is created rather than when a component is tested. The palettes here were tuned by lightness and checked against WCAG 2 per token pair; APCA could be added as a second check later.
- **Sans pairings.** Font-pairing guides consistently recommend one well-made sans for interface text, optionally paired with a more characterful display face, and contrast a geometric with a humanist face. That is the pattern in F, G, and H; E uses one grotesque throughout for precision.

## Next steps

- The owner picks a direction, or a mix (for example, H's surfaces with G's confidence).
- The chosen direction is applied to the editor mock and the Ultimate layout, then written into the app's tokens.
- Open question: whether the game's art should be framed differently in each direction's Game view (borders, a drop shadow, or none).
