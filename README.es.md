# InstaControls

<div align="center">
  <img src="assets/banner.jpg" alt="InstaControls Banner" width="100%">
  <br>
  
  [![Español](https://img.shields.io/badge/Lang-Español-red)](README.es.md)
  [![English](https://img.shields.io/badge/Lang-English-blue)](README.md)
</div>

**InstaControls** es una extensión de Chrome ligera y potente diseñada para mejorar tu experiencia en Instagram. Te permite habilitar los controles nativos de reproducción de video, gestionar una lista local de favoritos y **descargar videos y fotos** directamente desde tu feed, historias o reels de forma rápida y sencilla.

## Características

- **Controles de Video Nativos**: Habilita la barra de reproducción estándar del navegador (play/pausa, volumen, pantalla completa, velocidad de reproducción) sobre cualquier video.
- **Menú de Ajustes Emergente (Popup)**: Panel interactivo moderno (glassmorphic) al hacer clic en el icono de la extensión para configurar saltos de segundos, autocontrol, atajos y persistencia de volumen.
- **Atajos de Teclado**: Controla los videos al pasar el cursor sobre ellos:
  - `Flecha Izquierda / Derecha`: Retroceder o avanzar segundos.
  - `M`: Silenciar / Desactivar silencio.
  - `Barra Espaciadora`: Reproducir / Pausar.
  - `P`: Abrir ventana flotante (Picture-in-Picture).
  - `F`: Pantalla completa nativa.
- **Persistencia de Volumen Inteligente**: Recuerda tu nivel de volumen seleccionado y lo aplica automáticamente a los siguientes videos, filtrando los silenciados automáticos de la interfaz de Instagram.
- **Sistema de Favoritos Locales**:
  - Guarda posts directamente presionando la estrella en el overlay de fotos o videos.
  - Botón flotante reubicado y panel lateral desplegable y traslúcido para gestionar favoritos.
  - Organiza tus favoritos por cuenta/creador de contenido o visualiza los recientes.
  - **Selección Múltiple (Batch)**: Selecciona varios favoritos a la vez en la barra lateral para descargarlos o eliminarlos en lote con un solo clic.
- **Personalización Avanzada de Interfaz (InstaControl Deluxe)**:
  - **Sistema de Fondo Principal Global**: Sube una imagen de fondo personalizada que se aplicará a todo Instagram en segundo plano. Cuenta con desenfoque de fondo ajustable y superposición de tono de fondo (Slate, Midnight, Forest, Negro Puro) con efecto glassmorphic translúcido en los posts. La barra lateral de ajustes permanece neutra y oscura para mantener el contraste.
  - **Tipografía y Escalado de Texto**: Cambia la tipografía de Instagram a fuentes premium (Outfit, Inter, Montserrat, Poppins, Playfair Display) y escala el tamaño de letra de la interfaz desde XS hasta XL.
  - **Modo Compacto**: Ajusta el feed de artículos a un ancho reducido (450px) y recorta el exceso de altura de las publicaciones para una lectura ágil y cómoda.
- **Descargas Universales**: Descarga **Videos** (Reels, Stories, Feed) y **Fotos** en alta calidad directamente a tu ordenador.
- **Abrir en Nueva Pestaña**: Abre el archivo de origen (imagen/video) directamente, o redirige a la publicación si el video está protegido por un blob.
- **Códigos Secretos (Easter Eggs)**: Escribe estos códigos en el campo "Código Secreto" para transformar la interfaz por completo:
  - `matrix`: Añade una lluvia de código digital Katakana cayendo en cascada en el fondo, tipografía Courier verde y filtros hacker.
  - `angine`: Establece un fondo negro puro en `structural-div-1` con un patrón intercalado de puntos blancos que parpadean y hacen zoom al activarse.
  - `cyberpunk`: Fondo morado oscuro, textos con resplandor neón animado rosa/cian y alta saturación en imágenes y videos.
  - `retro` / `gameboy`: Estética retro verde clásica, fuente pixel de 8 bits (mayúsculas) y filtro CRT analógico con parpadeo de pantalla.
  - `ocean` / `aqua`: Fondo de burbujas flotantes animadas y oscilación acuática en posts.
  - `psychedelic` / `rainbow`: Rotación de tonalidades constante en el fondo y efecto de distorsión psicodélica al pasar el ratón.
  - `minecraft`: Bloques de adoquín 3D de piedra en los paneles/botones, fuente pixelada VT323 y **reemplaza los corazones por corazones pixelados de Minecraft** (llenos/vacíos).
  - `yt05`: Emula YouTube clásico de 2005, tipografía Arial simple, enlaces azules, logotipo de YouTube clásico y **reemplaza los likes por estrellas de calificación amarillas/rojas**.
  - `instaold`: Recrea la interfaz original de Instagram de 2011/2012 con la barra superior de degradado azul clásico, el logotipo cursive Billabong/Pacifico en blanco, fondo de página grisáceo, bordes de posts y los clásicos **corazones azules de likes**.
- **Optimizado para Stories y Reels**: Los botones se colocan en los márgenes exteriores seguros (como las franjas negras en historias) para no obstruir el contenido visual.

## Instalación

1.  **Clona o Descarga** este repositorio.
2.  Abre Google Chrome y ve a: `chrome://extensions`
3.  Activa el **"Modo de desarrollador"** (esquina superior derecha).
4.  Haz clic en **"Cargar descomprimida"**.
5.  Selecciona la carpeta del proyecto.

## Cómo Usar

1.  Ve a [Instagram.com](https://www.instagram.com).
2.  Navega por tu feed, historias o reels.
3.  Verás iconos nuevos sobre el contenido multimedia al pasar el ratón:
    *   **Controles (Ajustes)**: Activa o desactiva la barra de reproducción nativa.
    *   **PiP (Ventana Flotante)**: Abre el video en Picture-in-Picture.
    *   **Abrir Nueva Pestaña**: Abre el enlace directo de la imagen/video.
    *   **Descarga**: Guarda la foto o video actual.
    *   **Estrella (Favorito)**: Guarda la publicación en tu lista de favoritos local.
4.  Usa el botón flotante con forma de **estrella** en la parte inferior derecha de la pantalla (al lado de la barra de mensajes) para desplegar tu panel de favoritos y personalizar la apariencia.

## Autor

Desarrollado por [bemtorres](https://github.com/bemtorres).

## Tecnologías

- JavaScript (Vanilla)
- CSS3 Moderno (Glassmorphism & CSS Variables)
- Chrome Extensions API (Manifest V3)
