# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Visor Geoespacial: a geospatial viewer for exploring/comparing project boundaries (originally electrical line projects vs. nearby SEA — Chilean environmental impact assessment — projects) on a satellite map. It is a **single self-contained static HTML file** (`index.html`, ~4800 lines: CSS + JS inline) with **no backend, no build system, no package manager, no bundler**. It's opened directly in a browser (double-click) or via any static file server. There is one small optional companion file, `sw.js` (a Service Worker — see "Offline usage" below); the app itself still works fully without it, `index.html` just won't cache itself for offline use.

Besides local vector formats, it can also add **remote WMS layers** (via URL + layer name, either typed manually or discovered via `GetCapabilities`) as an overlay alongside locally loaded files, and pull real geometries from a **remote WFS service** (`GetFeature`, downloaded as GeoJSON and merged into the same local-vector pipeline) — see `addWmsLayer`/WFS section in Architecture below.

All third-party libraries (Leaflet, JSZip, shpjs, shp-write) are loaded from the `unpkg.com` CDN via `<script>` tags at the top of `index.html` — there is nothing to `npm install`.

### Offline usage

`sw.js` is a Service Worker with a "network-first, cache as fallback" strategy applied to every GET request the page makes — `index.html` itself, the CDN libraries, and every map tile. Nothing is pre-downloaded: a resource is cached the first time it's successfully fetched, and served from that cache on the next request whenever the network fetch fails. In practice this means the app shell always works offline after one successful load, and the map looks fully detailed only in areas/zooms already visited — it is *not* a "download this region" feature. Loading a local file (KML/KMZ/SHP/GeoJSON) never needed the network and is unaffected; adding a WMS/WFS layer always needs the network, cached or not, since that's new data the browser never had.

Registration (`index.html`, guarded by `'serviceWorker' in navigator && window.isSecureContext`) happens on `window.load` and fails silently if unsupported. Two hard constraints worth knowing when touching this:
- **Service Workers require a secure context** — `https://`, or `http://localhost`/`127.0.0.1`. Opening `index.html` directly via `file://` (the primary documented way to use this app) never registers one; the app still works the same as always, just without offline caching, and nothing in the console should error over this.
- **A file exported via "Guardar y compartir" won't have `sw.js` next to it** wherever the recipient saves/opens it (it's meant to be a standalone file) — registration there fails silently (404) the same way. Offline caching is a main-repo-served feature, not something exported copies carry with them.

`document.body` gets an `is-offline` class (toggled by the `online`/`offline` window events, driving `#offlineBadge` in the header) purely as a UI signal — it's informational, not what makes caching work.

### GPS

`gpsBtn` (floating, next to the compass) drives `navigator.geolocation.watchPosition` live tracking through 3 states, same recenter/stop convention as Google Maps' location button — see the comment above `gpsWatchId` for the full state table:
1. **Off**: click → `startGps()` (also warns via toast if `!window.isSecureContext`, since `watchPosition` silently fails outside https/localhost — most commonly when the app is opened via `file://`).
2. **`following`** (solid-fill button): tracking is on and the map recenters on every fix (`map.panTo`, or `map.setView` with a zoom floor on the very first fix). Click → `stopGps()`.
3. **`active` without `following`** (soft-tint button): the user dragged the map away from their position (detected via the map's `dragstart` event, which — unlike the `setView`/`panTo` calls this feature makes itself — only fires for a real user drag) so auto-recentering paused, but the watch and the "blue dot" (`L.marker` with a `gps-dot-icon` divIcon) + accuracy `L.circle` keep updating in the background. Click → `setGpsFollowing(true)` and jump to the last known fix, *without* restarting `watchPosition` — this is what makes "click takes me back to where I am" work without re-prompting for permission.

There's nothing here to persist, so exportViewer/restoreLayer are untouched.

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
   - Format parsers: KML (`parseKml`, `buildStyleMap`, `parseStyleEl`), KMZ (via JSZip), GeoJSON (`addGeoJsonFeatures`), Shapefile (via shpjs, `groupShapefileParts`). `parseKml`'s per-placemark color follows a priority chain: **the Placemark's own native KML color first, always** — from `getStyleForPlacemark`/`parseStyleEl` (stroke via `LineStyle`, fill via `PolyStyle`, independently; `getStyleForPlacemark` leaves `style.color`/`style.fillColor` `undefined`, not defaulted, specifically so this layer can tell "no Style defined" apart from "explicitly styled") → SEA status color (only as a fallback for placemarks with *no* native style — `Estado` is a common column in plenty of non-SEA KML too, e.g. "Estado: Activo"/"Estado: Construcción", so it must never clobber a color the file actually defined) → the `líneas/ductos` folder-name heuristic → the file's auto-assigned palette color, only as the final fallback for placemarks with no styling info at all. For points specifically, a lot of real-world KML never sets `IconStyle > color` (the color comes from *which* pushpin icon the user picked in Google Earth/My Maps, not a `<color>` tag) — `inferColorFromIconHref` fills that gap from the icon `href`: Google My Maps' own filenames embed the exact hex (`icon-1899-0288D1-normal.png`), and Google Earth's standard `mapfiles/kml/pushpin|paddle` set is matched by color name (`red-pushpin.png`, etc.). Only used when no explicit `<color>` was present, same "never override an explicit color" rule as everything else in this chain.
   - Format converters: `kmlToGeoJSON`, `geoJsonToKml`, `sanitizeFeaturesForShapefile`/`sanitizeFieldName` (DBF field-name/encoding constraints for Shapefile export, Esri-compatible), used by the KML⇄Shapefile converter modal.
   - Attribute/status classification: `findEstadoInProps`/`classifyEstado` (SEA project status: Aprobado/En calificación/Rechazado/Desistido-Caducado) and `findRegionInProps`/`normalizeRegion` (Chilean region name normalization) — both used for auto-coloring and the sidebar charts (`renderStatusChart`, `renderRegionChart`).
   - Layer/file management: `registerFile`/`loadedFiles` (one entry per loaded file or WMS layer) vs. `allItems` (one entry per individual feature/placemark across all files) — most rendering code iterates `allItems` filtered by `fileId`. WMS layers (`addWmsLayer`) share the `loadedFiles` array (`kind: 'wms'`) but intentionally have no `allItems` entries since they're server-rendered tile images, not vector features.
   - **WMS GetCapabilities discovery** (pure helpers, no fetch/DOM): `buildGetCapabilitiesUrl(baseUrl, service)` (adds `service`/`request` query params without clobbering existing ones; `service` defaults to `'WMS'`, shared with the WFS discovery below), `parseWmsCapabilities` (DOMParser, same pattern as `parseKml`; detects WMS 1.1.1 vs 1.3.0 from the root element's `version` attribute, validates `<parsererror>` and `<ServiceException>`), `flattenWmsLayers`/`extractLayerInfo` (recursively walk nested `<Layer>` containers, only layers with their own `<Name>` are requestable; CRS and BoundingBox are inherited from ancestor `<Layer>` elements when not redefined — WMS 1.3.0 uses `<CRS>`/`<EX_GeographicBoundingBox>`, 1.1.1 uses `<SRS>`/`<LatLonBoundingBox>`). `fetchWmsCapabilities` is the only function that actually calls `fetch()`, and only runs on demand (the "🔎 Buscar capas" button in the WMS modal) — never automatically. `renderWmsLayerList` paints the (client-side-filtered, capped at 200) results into the modal, escaping all server-provided text with `escapeHtml`. `selectWmsLayer` autofills the manual name/layer inputs from a clicked result and stores its BoundingBox in `pendingWmsBounds`, which `addWmsLayer`'s optional `opts.bounds` then uses for a `map.fitBounds()` after adding the layer.
   - **WFS discovery + download**: mirrors the WMS discovery flow (own modal `#wfsModal`, `fetchWfsCapabilities`/`parseWfsCapabilities`/`extractFeatureTypeInfo`, `renderWfsLayerList`/`selectWfsLayer`, reusing the `.wms-*` CSS classes since it's visually the same "remote layer list" pattern) but WFS's `FeatureTypeList` is flat (no nesting) and heavily namespace-prefixed (`ows:`/`fes:`), so parsing uses `findByLocalName` (walks `getElementsByTagName('*')` matching on `.localName`) instead of unprefixed CSS selectors. Unlike WMS, a WFS layer has real geometries: `fetchWfsFeatures`/`buildGetFeatureUrl` request `GetFeature&outputFormat=application/json` (GeoJSON is always lon/lat per RFC 7946, sidestepping WFS 1.1/2.0's axis-order ambiguity entirely) with `count`+`maxFeatures` both set to `WFS_FEATURE_LIMIT` and an explicit `bbox=west,south,east,north,EPSG:4326` (verified against a real GeoServer: omitting the literal `EPSG:4326` suffix makes WFS 2.0.0 silently interpret the bbox as lat/lon and return nothing). Selecting a WFS layer calls `map.fitBounds()` **immediately** (not deferred like WMS) because the current map view *is* the bbox filter the download will use. The result is handed straight to `addGeoJsonFile()` — no WFS-specific data model, it becomes an ordinary `kind: 'vector'` file. `WFS_FETCH_TIMEOUT_MS` aborts the download (via `AbortController`, kept alive through the `response.text()` body read, not just the initial `fetch()`) if it runs long: `count`/`maxFeatures` alone cannot bound payload size when a dataset has few but geometrically huge features (measured against a real SNASPE layer: 107 features, ~320MB uncapped by bbox) — the timeout is what actually protects against that case.
   - UI rendering: `renderLayersPanel`, `renderTree`, `renderStats`, `focusItem` (zooms to one feature, from the tree), `focusFile` (zooms to a whole layer's extent, from clicking its row in the layers panel — vector layers via `allItems` bounds, WMS via the `bounds` BoundingBox stashed on the file by `addWmsLayer` when GetCapabilities provided one), search (`renderSearchResults`, `runPlaceSearch`).
   - Grid overlays (`drawLatLngGrid`, `drawUtmGrid`) and coordinate conversion (`latLngToUtm`/`utmToLatLng`, `parseUtmPair`, `parseCoordinatePair`).
   - **Export ("Guardar y compartir")**: `exportViewer` clones `ORIGINAL_HTML` (a snapshot of the page's *original* `outerHTML` taken before any DOM mutations, captured at the very top of the script) and re-embeds the currently loaded layers' data plus their current color/visibility/type state, producing a new fully self-contained `index.html`-like file with no external file dependencies beyond the same CDN scripts.
   - **Preconfigured service catalog** (`#catalogModal`, "🌐 Catálogo de servicios"): `SERVICE_CATALOG` is a hand-maintained array of known WMS/WFS services (name, organization, category, type, URL, description) — adding a service is just appending an entry, no logic changes needed. `renderCatalogList` filters it by free-text search, type (WMS/WFS), a curated category taxonomy (`CATALOG_CATEGORY_CHIPS`), and by organism (`renderCatalogOrganismChips`, options derived live from `SERVICE_CATALOG` so they never go stale as entries are added), then sorts with `catalogSortComparator` (favorites first, then recently-used by recency, relying on `Array.sort` stability for the rest). Picking "Usar servicio" opens the normal WMS or WFS modal with the URL prefilled and auto-runs "Buscar capas" — it's a picker over the existing GetCapabilities flow, not a separate code path.
   - Event wiring for all toolbar/modal/file-input/drag-drop interactions, near the bottom of the script.

### Key data model

- `loadedFiles`: array of `{ id, name, color, visible, type ('propio'|'sea'), kind ('vector'|'wms'), ... }` — one per loaded file/layer, drives the layers panel.
- `allItems`: array of `{ id, name, folder, type, layer, fileId, fileColor, estado }` — one per individual geometry/placemark, drives the tree view, search, charts, and stats. Always cross-referenced by `fileId` back to `loadedFiles`.
- Security note: KML/GeoJSON descriptions/attributes are attacker-controllable content (arbitrary user-supplied files) rendered into popups — `sanitizeHtmlContent`/`escapeHtml` exist specifically to prevent XSS from malicious KML descriptions; don't bypass them when touching popup/description rendering. The same applies to WMS/WFS `GetCapabilities` responses (layer name/title/abstract come from a remote server the user points at) — `renderWmsLayerList`/`renderWfsLayerList` always route that text through `escapeHtml`. A WFS layer's actual feature *attributes* go through the same `buildPropsTableHtml`/popup path as any GeoJSON, so they're covered by the existing KML/GeoJSON sanitization already.

### Supported formats

KMZ, KML, Shapefile (`.shp`+`.dbf`+`.prj`, loose or zipped, with reprojection if `.prj` is present), GeoJSON/`.json`, remote WMS layers, and remote WFS layers (downloaded as GeoJSON, become ordinary local vector files). Esri Geodatabase (`.gdb`) is explicitly unsupported (binary, folder-based Esri format).

## Roadmap

Directions being considered for future work (not yet implemented unless noted elsewhere in this file):

- WMS: manual layer entry and `GetCapabilities`-based discovery (with filtering and auto-`fitBounds`) are both implemented — see Architecture.
- WFS: `GetCapabilities` discovery and `GetFeature` download (bbox + feature-count + fetch-timeout limited, merged into the local vector pipeline) are both implemented — see Architecture.
- Offline usage (opportunistic app-shell + tile caching via `sw.js`) and live GPS tracking are both implemented — see "Offline usage" / "GPS" above.
- Sentinel/Landsat imagery integration
- Python/FastAPI backend (optional, for features that outgrow a client-only architecture)
- PostgreSQL/PostGIS (optional, for server-side spatial storage/queries)
- Geospatial automation (batch processing, scripted workflows)
- AI applied to geospatial data
