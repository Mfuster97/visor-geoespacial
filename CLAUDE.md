# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Visor Geoespacial: a geospatial viewer for exploring/comparing project boundaries (originally electrical line projects vs. nearby SEA — Chilean environmental impact assessment — projects) on a satellite map. It is a **single self-contained static HTML file** (`index.html`, ~3000 lines: CSS + JS inline) with **no backend, no build system, no package manager, no bundler**. It's opened directly in a browser (double-click) or via any static file server.

Besides local vector formats, it can also add **remote WMS layers** (via URL + layer name) as an overlay alongside locally loaded files — see `addWmsLayer` in Architecture below.

All third-party libraries (Leaflet, JSZip, shpjs, shp-write) are loaded from the `unpkg.com` CDN via `<script>` tags at the top of `index.html` — there is nothing to `npm install`.

## Development workflow

There is no build/lint/test tooling in this repo — it's a single hand-edited HTML file. To work on it:

- Edit `index.html` directly.
- To try changes, open `index.html` in a browser (or serve the folder with any static server) and reload.
- There are no automated tests. Verify changes manually in-browser: load a sample KML/KMZ/Shapefile/GeoJSON, check the layers panel, measurement tool, charts, and "Guardar y compartir" export.
- `.gitignore` excludes generated exports (`visor_kmz_*.html`, `visor_de_proyectos_*.html`) and local test geodata (`*.kmz`, `*.shp`, `*.dbf`, `*.shx`, `*.prj`, `*.gdb/`) — don't commit those even if present locally.

## Git workflow

- Always run `git status` before making changes.
- Always run `git diff` after making changes, before committing.
- Make descriptive commits when appropriate.
- Never run `git push` automatically.
- Only run `git push` when the user explicitly requests it.
- A generic approval (e.g. "dale") does not imply `git push` — it must be requested explicitly.

## Architecture

Everything lives in `index.html`, structured top to bottom as:

1. **`<head>`**: CDN `<script>` tags (Leaflet, JSZip, shpjs, shp-write) and a big inline `<style>` block.
2. **`<body>`**: markup for the header/toolbar, the collapsible sidebar (drawer on mobile), map container, modals (WMS layer, KML⇄Shapefile converter), and the drag/drop overlay (`#dropzone`).
3. **One inline `<script>` block** (from line ~849) containing all app logic, in roughly this order:
   - Map/basemap setup (`BASEMAPS`, `referenceLayer`, `map`), global state (`layerGroup`, `allItems`, `loadedFiles`).
   - Measurement tool (distance/area, snapping to vertices/edges of loaded layers): `startMeasuring`/`stopMeasuring`, `buildSnapChains`, `findSnapLatLng`, `computeGeodesicArea`.
   - Format parsers: KML (`parseKml`, `buildStyleMap`, `parseStyleEl`), KMZ (via JSZip), GeoJSON (`addGeoJsonFeatures`), Shapefile (via shpjs, `groupShapefileParts`).
   - Format converters: `kmlToGeoJSON`, `geoJsonToKml`, `sanitizeFeaturesForShapefile`/`sanitizeFieldName` (DBF field-name/encoding constraints for Shapefile export, Esri-compatible), used by the KML⇄Shapefile converter modal.
   - Attribute/status classification: `findEstadoInProps`/`classifyEstado` (SEA project status: Aprobado/En calificación/Rechazado/Desistido-Caducado) and `findRegionInProps`/`normalizeRegion` (Chilean region name normalization) — both used for auto-coloring and the sidebar charts (`renderStatusChart`, `renderRegionChart`).
   - Layer/file management: `registerFile`/`loadedFiles` (one entry per loaded file or WMS layer) vs. `allItems` (one entry per individual feature/placemark across all files) — most rendering code iterates `allItems` filtered by `fileId`. WMS layers (`addWmsLayer`) share the `loadedFiles` array (`kind: 'wms'`) but intentionally have no `allItems` entries since they're server-rendered tile images, not vector features.
   - UI rendering: `renderLayersPanel`, `renderTree`, `renderStats`, `focusItem`, search (`renderSearchResults`, `runPlaceSearch`).
   - Grid overlays (`drawLatLngGrid`, `drawUtmGrid`) and coordinate conversion (`latLngToUtm`/`utmToLatLng`, `parseUtmPair`, `parseCoordinatePair`).
   - **Export ("Guardar y compartir")**: `exportViewer` clones `ORIGINAL_HTML` (a snapshot of the page's *original* `outerHTML` taken before any DOM mutations, captured at the very top of the script) and re-embeds the currently loaded layers' data plus their current color/visibility/type state, producing a new fully self-contained `index.html`-like file with no external file dependencies beyond the same CDN scripts.
   - Event wiring for all toolbar/modal/file-input/drag-drop interactions, near the bottom of the script.

### Key data model

- `loadedFiles`: array of `{ id, name, color, visible, type ('propio'|'sea'), kind ('vector'|'wms'), ... }` — one per loaded file/layer, drives the layers panel.
- `allItems`: array of `{ id, name, folder, type, layer, fileId, fileColor, estado }` — one per individual geometry/placemark, drives the tree view, search, charts, and stats. Always cross-referenced by `fileId` back to `loadedFiles`.
- Security note: KML/GeoJSON descriptions/attributes are attacker-controllable content (arbitrary user-supplied files) rendered into popups — `sanitizeHtmlContent`/`escapeHtml` exist specifically to prevent XSS from malicious KML descriptions; don't bypass them when touching popup/description rendering.

### Supported formats

KMZ, KML, Shapefile (`.shp`+`.dbf`+`.prj`, loose or zipped, with reprojection if `.prj` is present), GeoJSON/`.json`, and remote WMS layers. Esri Geodatabase (`.gdb`) is explicitly unsupported (binary, folder-based Esri format).

## Roadmap

Directions being considered for future work (not yet implemented unless noted elsewhere in this file):

- WMS improvements (already have basic remote WMS layer support — see Architecture)
- WMS `GetCapabilities` discovery (list available layers from a server URL instead of typing the layer name manually)
- WFS support
- Sentinel/Landsat imagery integration
- Python/FastAPI backend (optional, for features that outgrow a client-only architecture)
- PostgreSQL/PostGIS (optional, for server-side spatial storage/queries)
- Geospatial automation (batch processing, scripted workflows)
- AI applied to geospatial data
