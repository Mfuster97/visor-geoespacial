# Visor de Proyectos

Visor geoespacial de escritorio/navegador para explorar y comparar proyectos sobre un mapa satelital, pensado originalmente para cruzar trazados de proyectos eléctricos con proyectos del **SEA** (Servicio de Evaluación Ambiental de Chile) cercanos. Es una **aplicación web estática de un solo archivo**, construida sobre **Leaflet**, sin backend ni build system: se abre directo en el navegador, sin instalar nada.

## Características

- **Mapa satelital** (Esri World Imagery) con capa de referencia de límites, rutas y nombres de lugares.
- **Carga de múltiples capas simultáneas**, sin perder las anteriores: podés ir sumando tu proyecto y varios proyectos SEA cercanos, cada uno con su propio color.
- **Panel de capas** con checkbox de visibilidad, color, cantidad de elementos y clasificación automática (o manual) entre "Mis proyectos" y "Proyectos SEA".
- **Coloreado inteligente**: los proyectos SEA se pintan según su campo "Estado" (Aprobado / En calificación / Rechazado / Desistido-Caducado), detectado automáticamente desde la ficha del KML o los atributos del Shapefile/GeoJSON.
- **Gráficos automáticos** en el panel lateral:
  - Donut de proyectos SEA por estado.
  - Barras de proyectos SEA por región (con normalización de nombres: "Quinta" → "Región de Valparaíso", regiones múltiples → "Interregional", etc.).
- **Popups con ficha completa** del proyecto (tabla de atributos legible en blanco y negro, con ancho responsive).
- **Buscador y árbol de elementos** navegable, agrupado por carpeta/archivo.
- **Herramienta de medición** de distancia y área:
  - Snap automático a vértices y bordes de las capas cargadas, para medir con precisión.
  - Selector de unidad: metros, kilómetros, millas, pies (o automático).
  - Cálculo de área geodésica al marcar 3 o más puntos.
- **Diseño responsive**: panel lateral tipo *drawer* en celular/tablet, header adaptable, popups que no desbordan en pantallas chicas.
- **Guardar y compartir**: exporta un nuevo archivo `.html` autocontenido con las capas actualmente cargadas ya embebidas (colores, tipo, visibilidad), listo para mandar a un cliente sin depender de ningún otro archivo.
- **Capas WMS remotas**: agregá una capa de cualquier servicio WMS (OGC) por URL, con descubrimiento automático de capas disponibles vía GetCapabilities — ver detalle abajo.
- **Capas WFS remotas**: descargá los elementos de un servicio WFS (OGC) y agregalos como una capa local más (buscable, con popup y en los gráficos), con el mismo descubrimiento por GetCapabilities — ver detalle abajo.

## Tecnologías utilizadas

No hay framework ni build system — es JavaScript vanilla en un único archivo HTML. Las librerías se cargan por CDN, no están instaladas localmente:

| Librería | Versión | Uso |
|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | Motor de mapa interactivo |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | Descomprimir archivos `.kmz` |
| [shpjs](https://github.com/calvinmetcalf/shapefile-js) | 4.0.4 | Conversión de Shapefile a GeoJSON |
| Esri World Imagery / Reference tiles | — | Capas base satelitales (endpoints públicos, sin API key) |

## Formatos soportados

| Formato | Soporte |
|---|---|
| `.kmz` | ✅ Completo |
| `.kml` | ✅ Completo |
| `.shp` + `.dbf` + `.prj` (sueltos o en `.zip`) | ✅ Completo, con reproyección automática si hay `.prj` |
| `.geojson` / `.json` | ✅ Completo |
| Geodatabase (`.gdb`) | ❌ No soportado — es un formato binario propietario de Esri y en realidad una carpeta, no un archivo. Exportalo a Shapefile o KMZ desde ArcGIS/QGIS antes de cargarlo. |

## Capas WMS remotas

Además de tus archivos locales, podés superponer capas de cualquier servicio WMS (OGC) público — por ejemplo, capas de IDE Chile, geoportales institucionales u otros servidores GeoServer/MapServer.

Desde **"🛰️ + Capa WMS"**:

- **Alta manual**: pegá la URL del servicio, el nombre de la capa WMS (el `Name` tal como lo espera el servidor, ej. `SNASPE:snap`) y un nombre para mostrar, y agregala directo.
- **Descubrimiento automático (GetCapabilities)**: pegá solo la URL base del servicio y presioná **"🔎 Buscar capas"**. El visor consulta `GetCapabilities` (soporta WMS 1.1.1 y 1.3.0, incluida la jerarquía de capas anidadas típica de GeoServer) y muestra la lista de capas disponibles con su nombre, título y descripción.
  - **Filtro en vivo**: escribí en "Filtrar capas…" para buscar por nombre/título/descripción entre los resultados, sin volver a consultar el servidor. Si un servicio devuelve muchas capas, se muestran hasta 200 a la vez.
  - **Selección con un clic**: al elegir una capa de la lista, se autocompletan los campos de nombre y capa WMS (podés seguir editándolos a mano si querés). Si el servicio informa el área geográfica de la capa (BoundingBox), el mapa hace zoom automático a esa zona al agregarla.
- Las capas WMS son independientes de tus archivos locales: podés mostrarlas, ocultarlas o quitarlas desde el panel de capas igual que cualquier otra.

> Requiere que el servidor WMS permita solicitudes desde el navegador (CORS). Si no lo permite, el visor lo indica con un mensaje de error al intentar buscar o cargar la capa.

## Capas WFS remotas

A diferencia de WMS (que trae una imagen), un servicio WFS entrega las geometrías reales. Desde **"🧩 + Capa WFS"** el flujo es el mismo que WMS —pegá la URL, "🔎 Buscar capas" vía GetCapabilities, filtrá y elegí una capa—, pero el resultado se descarga (`GetFeature`, formato GeoJSON) y se agrega **como una capa local vectorial más**: queda en el buscador, el árbol, los gráficos y con su popup de atributos, igual que un `.geojson` cargado a mano.

- **Selección con un clic**: al elegir una capa de la lista, el mapa salta de inmediato a su área (BoundingBox) — a diferencia de WMS, acá conviene hacerlo *antes* de descargar, porque la vista actual del mapa es justamente el filtro que se usa para pedir los datos.
- **Solo se descarga la vista actual**: la descarga usa el BBOX visible del mapa en ese momento y un límite de hasta 500 elementos por vez, para no traer un dataset completo de golpe. Si necesitás otra zona, navegá el mapa y volvé a presionar "Cargar capa".
- **Protección ante descargas pesadas**: si una capa tiene geometrías muy detalladas (polígonos grandes y complejos), la descarga se corta a los 20 segundos con un aviso para acercar el zoom — el límite de elementos por sí solo no garantiza un tamaño de descarga chico cuando hay pocos elementos pero muy grandes.
- Una vez cargada, la capa WFS es un archivo local más: se puede ocultar, quitar o incluir en "Guardar y compartir" igual que cualquier KML/Shapefile/GeoJSON.

> Igual que WMS, requiere que el servidor permita solicitudes desde el navegador (CORS).

## Instalación y uso

No requiere instalación. Es un único archivo HTML:

1. Descargá o cloná este repositorio.
2. Abrí `index.html` con doble clic (se abre con tu navegador predeterminado).
3. Usá **"Agregar capa"** o arrastrá archivos directamente sobre el mapa para cargar tus KMZ/KML/Shapefile/GeoJSON.
4. Cuando quieras conservar el estado actual, usá **"Guardar y compartir"** para exportar una copia con las capas ya adentro.

> **Requiere conexión a internet** en tiempo de ejecución: las librerías (Leaflet, JSZip, shpjs) y los tiles satelitales se cargan desde CDN público. Sin internet, la página abre pero el mapa no tiene imagen de fondo y las librerías no funcionan.

## Estructura del proyecto

```
_kmz_viewer/
├── index.html      # Aplicación completa (HTML + CSS + JS)
├── .gitignore
└── README.md
```

Un visor exportado con "Guardar y compartir" es otro `index.html` autocontenido igual a este, con las capas embebidas — no genera archivos adicionales.

## Limitaciones

- Todo el procesamiento ocurre **del lado del cliente**: archivos muy grandes (KML de varios miles de geometrías) pueden tardar unos segundos en renderizar.
- No hay persistencia automática entre sesiones — si cerrás la pestaña sin usar "Guardar y compartir", se pierden las capas cargadas.
- No hay backend ni base de datos: no es multiusuario ni colaborativo en tiempo real.
- La detección de campos "Estado" y "Región" depende de que el KML/Shapefile los incluya con ese nombre de columna (u variantes contempladas); datos con otra nomenclatura no se clasifican automáticamente.
- Geodatabase (`.gdb`) no es soportado por las razones técnicas explicadas arriba.
- El archivo exportado por "Guardar y compartir" puede pesar varios MB si se embeben muchas capas (las geometrías se guardan como texto dentro del propio HTML).

## Seguridad

No usa credenciales, API keys ni backend. Los servicios externos son CDN públicos (`unpkg.com`), tiles públicos de Esri, y —si el usuario decide agregar una capa WMS o WFS— el servidor que indique (por URL, incluyendo las consultas de `GetCapabilities`/`GetFeature`); ninguno requiere autenticación desde el visor. El texto que devuelven estos servicios (nombres, títulos, descripciones de capas) se muestra siempre escapado, nunca insertado como HTML sin sanear.
