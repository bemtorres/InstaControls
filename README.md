# InstaControls

<div align="center">
  <img src="assets/banner.jpg" alt="InstaControls Banner" width="100%">
  <br>
  
  [![Español](https://img.shields.io/badge/Lang-Español-red)](README.es.md)
  [![English](https://img.shields.io/badge/Lang-English-blue)](README.md)
</div>

**InstaControls** is a lightweight and powerful Chrome extension designed to enhance your Instagram experience. It enables native video playback controls, provides a local favorites system, and allows you to **download videos and photos** directly from your feed, stories, or reels.

## Features

- **Native Video Controls**: Enables the standard browser playback bar (play/pause, volume, fullscreen, playback speed) on any video.
- **Interactive Settings Popup**: Modern glassmorphic panel accessible from the extension icon to customize preferences:
  - Auto-enable native controls.
  - Turn keyboard shortcuts on/off.
  - Toggle volume persistence.
  - Set arrow seeking interval (5s, 10s, 15s).
- **Keyboard Shortcuts**: Control video playback by hovering your cursor over them:
  - `Left / Right Arrow`: Seek backward or forward.
  - `M`: Toggle mute/unmute.
  - `Spacebar`: Play/pause.
  - `P`: Toggle Picture-in-Picture window.
  - `F`: Toggle native fullscreen.
- **Smart Volume Persistence**: Remembers your preferred volume level across different posts, reels, and stories, filtering out Instagram's automatic background mute changes.
- **Local Favorites System**:
  - Save posts instantly by clicking the star icon on any image/video overlay.
  - Access saved content through a floating trigger button and a gorgeous slide-in sidebar.
  - Filter and group your favorites by creator, or view recent items.
  - **Sidebar Aesthetics customization**: Choose custom accent colors (Cyber Pink, Electric Blue, Emerald Green, Sunset Orange, Golden Yellow) and upload a custom background image (saved locally in storage).
- **Universal Downloads**: Download **Videos** (Reels, Stories, Feed) and **Photos** in high quality.
- **Open in New Tab**: View direct source files instantly (or open the post page if the video is streamed via blob).
- **Reels & Stories Alignment**: Repositioned controls to outer safe zones (such as stories' side black bars) so they never overlap the content.

## Installation

1.  **Clone or Download** this repository.
2.  Open Google Chrome and go to: `chrome://extensions`
3.  Enable **"Developer mode"** (top right toggle).
4.  Click on **"Load unpacked"**.
5.  Select the project folder.

## How to Use

1.  Go to [Instagram.com](https://www.instagram.com).
2.  Browse your feed, stories, or reels.
3.  You will see new overlay icons on the media content:
    *   **Controls Button**: Toggle native video playback controls.
    *   **PiP (Floating Window)**: Open video in Picture-in-Picture.
    *   **Open in New Tab**: View the image/video source.
    *   **Download**: Save the current photo or video to your device.
    *   **Star (Favorite)**: Save the post to your local favorites.
4.  Use the **star** trigger button in the bottom right corner (next to the messages bar) to toggle the favorites panel and customize sidebar styles.

## Author

Developed by [bemtorres](https://github.com/bemtorres).

## Technologies

- JavaScript (Vanilla)
- Modern CSS3 (Glassmorphism & CSS Variables)
- Chrome Extensions API (Manifest V3)
