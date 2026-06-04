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
- **Menú de Ajustes Emergente (Popup)**: Panel interactivo moderno (glassmorphic) al hacer clic en el icono de la extensión para configurar:
  - Activar controles de video automáticos.
  - Habilitar/deshabilitar atajos de teclado.
  - Activar la persistencia de volumen.
  - Elegir el intervalo de salto de las flechas (5s, 10s, 15s).
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
  - **Ajustes estéticos del panel**: Elige colores de acento personalizados (Cyber Pink, Electric Blue, Emerald Green, Sunset Orange, Golden Yellow) y sube una imagen de fondo que se guardará de forma persistente.
- **Descargas Universales**: Descarga **Videos** (Reels, Stories, Feed) y **Fotos** en alta calidad directamente a tu ordenador.
- **Abrir en Nueva Pestaña**: Abre el archivo de origen (imagen/video) directamente, o redirige a la publicación si el video está protegido por un blob.
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
