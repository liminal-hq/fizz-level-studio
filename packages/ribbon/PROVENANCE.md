# Provenance

This package is a copy of `packages/ribbon` from [liminal-hq/folio](https://github.com/liminal-hq/folio), published there as `@liminal-hq/folio-ribbon`, taken at commit `22c68e0c576507d03f365233607cef42abb1a2d9`.

## Changes from the source

- The package is `@liminal-hq/fizz-studio-ribbon`, and it depends on `@liminal-hq/fizz-studio-chrome` (the studio's copy of the shared chrome) in place of Folio's.
- Folio's `--folio-*` custom properties are the studio's `--fls-*`, and the element ids `folio-ribbon-*` are `fls-ribbon-*`. The chrome package's `tokens.css` already defines the names the ribbon reads, and `apps/studio/src/theme/tokens.css` gives them the studio's values, so the ribbon's own sources carry no colours of their own. The rename is a plain find and replace over `src/` and `package.json`, so later fixes can be brought across the same way.
- `mode` is optional on `Ribbon` and `ClassicToolbar`. Without it there is no Easy and Expert switch and every control shows (the studio has no Easy mode). With it the components behave as Folio's do.
- `RibbonItem` takes an optional `icon(px)` that draws an app icon in place of the SVG path `d` (now optional), so the studio's one icon set serves the menus, the toolbar and the ribbon.
- `ClassicToolbar` takes an optional `after` node, drawn straight after its groups and before the end (the studio's brush chip).
- Those three small additions (`mode`, `icon` and `after`) are the only changes to the sources beyond the rename, apart from the glass hooks: the ribbon, the classic toolbar and the ribbon's panel read `--fls-ribbon-bg`, `--fls-ribbon-backdrop` and `--fls-ribbon-panel-bg` (each with the old colour as its fallback), its overlay panel and tooltips wear the menu fill and backdrop, so the host can put them under glass.
- The package's `README.md` is not copied; the model types in `src/types.ts` are the documentation.

## Why a copy

The ribbon is not published. When it is (or when a shared Liminal workspace owns it), delete this copy and depend on the release instead. The app keeps the command registry, the layouts (`apps/studio/src/commands/ribbonLayout.ts`) and every string; this package knows nothing about the studio's commands.
