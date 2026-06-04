// Global settings cache
let settings = {
  autoControls: false,
  keyboardShortcuts: true,
  persistVolume: true,
  skipSeconds: 10,
  globalVolume: 0.8,
  globalMuted: false
};

// Track hovered video for shortcuts
let hoveredVideo = null;

// Load settings from storage
chrome.storage.local.get(settings, (saved) => {
  settings = { ...settings, ...saved };
});

// Watch settings changes in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    for (let [key, { newValue }] of Object.entries(changes)) {
      if (newValue !== undefined) {
        settings[key] = newValue;
      }
    }
    // Update all current video elements with new volume/control preferences
    if (changes.autoControls) {
      document.querySelectorAll("video").forEach(v => {
        v.controls = settings.autoControls;
      });
    }
  }
});

// Helper: Get metadata from any post video/image element
function getMediaMetadata(el) {
  let parent = el.parentElement;
  let container = null;
  let postUrl = "";
  let username = "";
  let thumbnail = "";

  // Climb up to find wrapper elements
  while (parent) {
    if (parent.tagName === "ARTICLE") {
      container = parent;
      break;
    }
    if (parent.classList.contains("insta-wrapper-hook")) {
      container = parent;
    }
    parent = parent.parentElement;
  }

  const searchScope = container || el.closest('.insta-wrapper-hook') || document;

  // 1. Post URL extraction
  if (window.location.pathname.includes("/p/") || window.location.pathname.includes("/reel/") || window.location.pathname.includes("/reels/")) {
    postUrl = window.location.origin + window.location.pathname;
  } else {
    const links = searchScope.querySelectorAll("a");
    for (const link of links) {
      const href = link.getAttribute("href");
      if (href && (href.includes("/p/") || href.includes("/reel/") || href.includes("/reels/"))) {
        postUrl = window.location.origin + href;
        break;
      }
    }
  }
  if (!postUrl) postUrl = window.location.href;
  if (postUrl.includes("?")) postUrl = postUrl.split("?")[0];

  // 2. Username extraction
  const links = searchScope.querySelectorAll("a");
  for (const link of links) {
    const href = link.getAttribute("href");
    if (href && href.length > 2 && href.startsWith("/") &&
      !href.includes("/p/") && !href.includes("/reel/") && !href.includes("/reels/") &&
      !href.includes("/explore/") && !href.includes("/direct/") && !href.includes("/stories/")) {
      const cleanUser = href.replace(/\//g, "").split("?")[0];
      if (cleanUser && cleanUser !== "instagram") {
        username = cleanUser;
        break;
      }
    }
  }
  if (!username) {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length === 1 && !["reels", "explore", "direct", "stories"].includes(pathParts[0])) {
      username = pathParts[0];
    } else {
      username = "instagram_user";
    }
  }

  // 3. Thumbnail / Poster extraction
  if (el.tagName === "VIDEO") {
    thumbnail = el.getAttribute("poster") || "";
    if (!thumbnail) {
      const siblingImg = searchScope.querySelector("img");
      if (siblingImg) thumbnail = siblingImg.src;
    }
  } else if (el.tagName === "IMG") {
    thumbnail = el.src;
  }

  // 4. Type detection
  let type = "Video";
  if (el.tagName === "VIDEO") {
    if (postUrl.includes("/reel/") || postUrl.includes("/reels/")) {
      type = "Reel";
    } else {
      type = "Video";
    }
  } else if (el.tagName === "IMG") {
    type = "Imagen";
  }

  return {
    id: postUrl.split("/").filter(Boolean).pop() || `fav_${Date.now()}`,
    postUrl,
    username,
    thumbnail,
    type,
    timestamp: Date.now()
  };
}

// Helpers for controls/actions
async function togglePiP(video) {
  try {
    if (document.pictureInPictureElement !== video) {
      await video.requestPictureInPicture();
    } else {
      await document.exitPictureInPicture();
    }
  } catch (err) {
    console.error("PiP error:", err);
  }
}

function toggleFullscreen(video) {
  try {
    if (!document.fullscreenElement) {
      video.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  } catch (err) {
    console.error("Fullscreen error:", err);
  }
}

// Global listener for keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (!settings.keyboardShortcuts || !hoveredVideo) return;

  // Ignore typing in input fields
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
    return;
  }

  switch (e.key) {
    case "ArrowLeft":
      e.preventDefault();
      hoveredVideo.currentTime = Math.max(0, hoveredVideo.currentTime - settings.skipSeconds);
      break;
    case "ArrowRight":
      e.preventDefault();
      hoveredVideo.currentTime = Math.min(hoveredVideo.duration || hoveredVideo.currentTime, hoveredVideo.currentTime + settings.skipSeconds);
      break;
    case "m":
    case "M":
      e.preventDefault();
      hoveredVideo.muted = !hoveredVideo.muted;
      break;
    case " ":
      e.preventDefault();
      if (hoveredVideo.paused) {
        hoveredVideo.play().catch(() => { });
      } else {
        hoveredVideo.pause();
      }
      break;
    case "p":
    case "P":
      e.preventDefault();
      togglePiP(hoveredVideo);
      break;
    case "f":
    case "F":
      e.preventDefault();
      toggleFullscreen(hoveredVideo);
      break;
    case ">":
    case ".":
      if (e.shiftKey || e.key === ">") {
        e.preventDefault();
        hoveredVideo.playbackRate = Math.min(2.0, hoveredVideo.playbackRate + 0.25);
      }
      break;
    case "<":
    case ",":
      if (e.shiftKey || e.key === "<") {
        e.preventDefault();
        hoveredVideo.playbackRate = Math.max(0.5, hoveredVideo.playbackRate - 0.25);
      }
      break;
  }
});

// Update favorite buttons across the DOM
function updateOverlayFavoriteStates() {
  chrome.storage.local.get({ favorites: [] }, (data) => {
    document.querySelectorAll(".insta-fav-btn").forEach(btn => {
      const postUrl = btn.dataset.postUrl;
      const isFav = data.favorites.some(f => f.postUrl === postUrl);
      if (isFav) {
        btn.classList.add("is-favorited");
      } else {
        btn.classList.remove("is-favorited");
      }
    });
  });
}

function addVideoTools(video) {
  const parent = video.parentElement;
  if (!parent) return;

  // Check if overlay already exists in this parent
  let overlay = parent.querySelector(":scope > .insta-tools-overlay");
  if (overlay) {
    const currentMeta = getMediaMetadata(video);
    const favBtn = overlay.querySelector(".insta-fav-btn");
    if (favBtn && favBtn.dataset.postUrl === currentMeta.postUrl) {
      return;
    } else {
      overlay.remove();
    }
  }

  video.disablePictureInPicture = false;

  const currentPos = window.getComputedStyle(parent).position;
  if (currentPos === 'static') {
    parent.style.position = "relative";
  }
  parent.classList.add("insta-wrapper-hook");

  // Track hover state and persistent settings only once
  if (!video.dataset.hasInstaListeners) {
    video.dataset.hasInstaListeners = "true";
    parent.addEventListener("mouseenter", () => { hoveredVideo = video; });
    parent.addEventListener("mouseleave", () => { if (hoveredVideo === video) hoveredVideo = null; });

    // Apply persistent volume if enabled
    if (settings.persistVolume) {
      video.volume = settings.globalVolume;
      video.muted = settings.globalMuted;
    }

    // Monitor volume changes on this video
    video.addEventListener("volumechange", () => {
      // Ignore volume changes from seeking or if the video is not currently hovered (avoid autoplay auto-mutes overriding user volume)
      if (video.seeking || hoveredVideo !== video) {
        return;
      }
      if (settings.persistVolume) {
        settings.globalVolume = video.volume;
        settings.globalMuted = video.muted;
        chrome.storage.local.set({
          globalVolume: video.volume,
          globalMuted: video.muted
        });
      }
    });
  }

  // Handle native controls configuration on load
  if (settings.autoControls) {
    video.controls = true;
    video.style.zIndex = "100";
  }

  const overlayEl = document.createElement("div");
  overlayEl.className = "insta-tools-overlay";

  // Icons SVG
  const iconPiP = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><rect x="12" y="11" width="8" height="6" rx="1" ry="1"/></svg>`;
  const iconControls = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>`;
  const iconHide = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  const iconDownload = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const iconOpenNew = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  const iconStar = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="star-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  // Create Controls Button
  const startControlsBtn = document.createElement("button");
  startControlsBtn.className = "insta-tools-btn";
  startControlsBtn.innerHTML = settings.autoControls ? iconHide : iconControls;
  startControlsBtn.title = "Controles / Controls";
  startControlsBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (video.controls) {
      video.controls = false;
      startControlsBtn.innerHTML = iconControls;
      video.style.zIndex = "";
    } else {
      video.controls = true;
      startControlsBtn.innerHTML = iconHide;
      video.style.zIndex = "100";
    }
  };

  // PiP Button
  const pipBtn = document.createElement("button");
  pipBtn.className = "insta-tools-btn";
  pipBtn.innerHTML = iconPiP;
  pipBtn.title = "Ventana Flotante / Picture-in-Picture";
  pipBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePiP(video);
  };

  // Open in New Tab Button
  const openNewBtn = document.createElement("button");
  openNewBtn.className = "insta-tools-btn";
  openNewBtn.innerHTML = iconOpenNew;
  openNewBtn.title = "Abrir en nueva pestaña / Open in New Tab";
  openNewBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const meta = getMediaMetadata(video);
    if (video.src && !video.src.startsWith('blob:')) {
      window.open(video.src, '_blank');
    } else {
      // Instagram uses blob URLs for video playback, which Chrome blocks from opening directly in a new tab.
      // In this case, we open the post URL page.
      window.open(meta.postUrl, '_blank');
    }
  };

  // Download Button
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "insta-tools-btn";
  downloadBtn.innerHTML = iconDownload;
  downloadBtn.title = "Descargar Video / Download Video";
  downloadBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const src = video.src;
    if (!src) return;
    if (src.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = src;
      a.download = `insta_video_${Date.now()}.mp4`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      chrome.runtime.sendMessage({ action: "download", url: src });
    }
  };

  // Speed Button
  const speedBtn = document.createElement("button");
  speedBtn.className = "insta-tools-btn insta-speed-btn";
  speedBtn.innerText = "1.0x";
  speedBtn.title = "Velocidad / Speed (Atajos: < o >)";
  const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.5, 0.75];
  let speedIdx = 0;
  speedBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    speedIdx = (speedIdx + 1) % speeds.length;
    const s = speeds[speedIdx];
    video.playbackRate = s;
    speedBtn.innerText = `${s}x`;
  };
  video.addEventListener("ratechange", () => {
    speedBtn.innerText = `${video.playbackRate}x`;
    const sIdx = speeds.indexOf(video.playbackRate);
    if (sIdx > -1) speedIdx = sIdx;
  });

  // Favorite Button
  const favBtn = document.createElement("button");
  favBtn.className = "insta-tools-btn insta-fav-btn";
  favBtn.innerHTML = iconStar;
  favBtn.title = "Agregar a Favoritos / Save to Favorites";

  // Pre-extract metadata for early favorite check
  const meta = getMediaMetadata(video);
  favBtn.dataset.postUrl = meta.postUrl;

  favBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const freshMeta = getMediaMetadata(video);
    chrome.storage.local.get({ favorites: [] }, (data) => {
      let favs = data.favorites;
      const existsIdx = favs.findIndex(f => f.postUrl === freshMeta.postUrl);
      if (existsIdx > -1) {
        favs.splice(existsIdx, 1);
        favBtn.classList.remove("is-favorited");
      } else {
        favs.unshift(freshMeta);
        favBtn.classList.add("is-favorited");
      }
      chrome.storage.local.set({ favorites: favs }, () => {
        updateFavoritesSidebar();
        updateOverlayFavoriteStates();
      });
    });
  };

  overlayEl.appendChild(startControlsBtn);
  overlayEl.appendChild(pipBtn);
  overlayEl.appendChild(speedBtn);
  overlayEl.appendChild(openNewBtn);
  overlayEl.appendChild(downloadBtn);
  overlayEl.appendChild(favBtn);
  parent.appendChild(overlayEl);

  // Sync the star active class immediately
  chrome.storage.local.get({ favorites: [] }, (data) => {
    if (data.favorites.some(f => f.postUrl === meta.postUrl)) {
      favBtn.classList.add("is-favorited");
    }
  });
}

function addImageTools(img) {
  const width = img.naturalWidth || img.clientWidth;
  const height = img.naturalHeight || img.clientHeight;
  if (width < 250 || height < 250) return;

  const parent = img.parentElement;
  if (!parent) return;

  // Check if overlay already exists in this parent
  let overlay = parent.querySelector(":scope > .insta-tools-overlay");
  if (overlay) {
    const currentMeta = getMediaMetadata(img);
    const favBtn = overlay.querySelector(".insta-fav-btn");
    if (favBtn && favBtn.dataset.postUrl === currentMeta.postUrl) {
      return;
    } else {
      overlay.remove();
    }
  }

  parent.classList.add("insta-wrapper-hook");

  const currentPos = window.getComputedStyle(parent).position;
  if (currentPos === 'static') {
    parent.style.position = "relative";
  }

  const overlayEl = document.createElement("div");
  overlayEl.className = "insta-tools-overlay insta-static-overlay";

  const iconDownload = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const iconOpenNew = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  const iconStar = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="star-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  // Helper function to extract correct srcset URL
  function getImgSrc() {
    let src = img.src;
    if (img.srcset) {
      const sources = img.srcset.split(",");
      const lastSource = sources[sources.length - 1].trim();
      const urlPart = lastSource.split(" ")[0];
      if (urlPart) src = urlPart;
    }
    return src;
  }

  // Open in New Tab Button
  const openNewBtn = document.createElement("button");
  openNewBtn.className = "insta-tools-btn";
  openNewBtn.innerHTML = iconOpenNew;
  openNewBtn.title = "Abrir en nueva pestaña / Open in New Tab";
  openNewBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const src = getImgSrc();
    if (src) window.open(src, '_blank');
  };

  // Download Button
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "insta-tools-btn";
  downloadBtn.innerHTML = iconDownload;
  downloadBtn.title = "Descargar Imagen / Download Image";
  downloadBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const src = getImgSrc();
    if (src) {
      chrome.runtime.sendMessage({ action: "download", url: src });
    }
  };

  // Favorite Button
  const favBtn = document.createElement("button");
  favBtn.className = "insta-tools-btn insta-fav-btn";
  favBtn.innerHTML = iconStar;
  favBtn.title = "Agregar a Favoritos / Save to Favorites";

  const meta = getMediaMetadata(img);
  favBtn.dataset.postUrl = meta.postUrl;

  favBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Recalculate thumbnail in case it loaded fully
    const freshMeta = getMediaMetadata(img);
    chrome.storage.local.get({ favorites: [] }, (data) => {
      let favs = data.favorites;
      const existsIdx = favs.findIndex(f => f.postUrl === freshMeta.postUrl);
      if (existsIdx > -1) {
        favs.splice(existsIdx, 1);
        favBtn.classList.remove("is-favorited");
      } else {
        favs.unshift(freshMeta);
        favBtn.classList.add("is-favorited");
      }
      chrome.storage.local.set({ favorites: favs }, () => {
        updateFavoritesSidebar();
        updateOverlayFavoriteStates();
      });
    });
  };

  overlayEl.appendChild(openNewBtn);
  overlayEl.appendChild(downloadBtn);
  overlayEl.appendChild(favBtn);
  parent.appendChild(overlayEl);

  // Sync star active class
  chrome.storage.local.get({ favorites: [] }, (data) => {
    if (data.favorites.some(f => f.postUrl === meta.postUrl)) {
      favBtn.classList.add("is-favorited");
    }
  });
}

// Track pathname changes to adjust positioning on Reels/Stories
let lastPathname = "";
function checkPathname() {
  if (window.location.pathname !== lastPathname) {
    lastPathname = window.location.pathname;
    if (lastPathname.includes("/reels/") || lastPathname.includes("/reel/")) {
      document.body.classList.add("insta-is-reels-page");
      document.body.classList.remove("insta-is-stories-page");
    } else if (lastPathname.includes("/stories/")) {
      document.body.classList.add("insta-is-stories-page");
      document.body.classList.remove("insta-is-reels-page");
    } else {
      document.body.classList.remove("insta-is-reels-page", "insta-is-stories-page");
    }
  }
}

// Initial node processor
function processNode(node) {
  if (node.nodeType !== 1) return;

  // Handle Videos
  if (node.tagName === "VIDEO") {
    addVideoTools(node);
  } else {
    node.querySelectorAll("video").forEach(addVideoTools);
  }

  // Handle Images
  if (node.tagName === "IMG") {
    addImageTools(node);
  } else {
    node.querySelectorAll("img").forEach(addImageTools);
  }
}

// Observer to handle dynamic content (SPA)
const observer = new MutationObserver((mutations) => {
  checkPathname();
  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach(processNode);
    } else if (mutation.type === "attributes" && mutation.attributeName === "src") {
      processNode(mutation.target);
    }
  });
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src"]
});

/* ==========================================
   FAVORITES SIDEBAR & FLOATING TRIGGER INJECTION
   ========================================== */

let activeFavoritesTab = "recent"; // "recent", "creators", or "settings"
let isSelectionModeActive = false;
const selectedPostUrls = new Set();
const selectedFavObjects = new Map();

function applyTheme(accent, bgImageBase64, bordersGlow, bgTint, bgBlur) {
  const sidebar = document.getElementById("insta-favorites-sidebar");
  const trigger = document.getElementById("insta-favorites-trigger");
  if (!sidebar) return;

  const gradients = {
    default: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)", // Cyber Pink
    blue: "linear-gradient(135deg, #a5f3fc 0%, #06b6d4 100%)",   // Diamante
    green: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",   // Esmeralda
    orange: "linear-gradient(135deg, #f97316 0%, #facc15 100%)",  // Naranja
    gold: "linear-gradient(135deg, #fde047 0%, #eab308 100%)"     // Oro
  };

  const colors = {
    default: "#ec4899",
    blue: "#06b6d4",
    green: "#34d399",
    orange: "#f97316",
    gold: "#eab308"
  };

  const rgbs = {
    default: "236, 72, 153",
    blue: "6, 182, 212",
    green: "16, 185, 129",
    orange: "249, 115, 22",
    gold: "234, 179, 8"
  };

  const activeGradient = gradients[accent] || gradients.default;
  const activeColor = colors[accent] || colors.default;
  const activeRgb = rgbs[accent] || rgbs.default;

  sidebar.style.setProperty("--fav-accent-gradient", activeGradient);
  sidebar.style.setProperty("--fav-accent-color", activeColor);
  sidebar.style.setProperty("--fav-accent-rgb", activeRgb);

  if (trigger) {
    trigger.style.background = activeGradient;
    trigger.style.boxShadow = `0 4px 16px ${activeColor}60`;
  }

  // Set the background image
  const bgOverlay = sidebar.querySelector(".sidebar-bg-overlay");
  if (bgOverlay) {
    if (bgImageBase64 && bgImageBase64 !== "default") {
      bgOverlay.style.backgroundImage = `url('${bgImageBase64}')`;
      bgOverlay.style.display = "block";
      const blurVal = bgBlur !== undefined ? bgBlur : 15;
      bgOverlay.style.filter = `blur(${blurVal}px)`;
    } else {
      bgOverlay.style.backgroundImage = "none";
      bgOverlay.style.display = "none";
      bgOverlay.style.filter = "none";
    }
  }

  // Set the background tint color
  const tintOverlay = sidebar.querySelector(".sidebar-tint-overlay");
  if (tintOverlay) {
    const tints = {
      default: "rgba(10, 7, 18, 0.82)",
      slate: "rgba(30, 41, 59, 0.85)",
      midnight: "rgba(15, 23, 42, 0.85)",
      forest: "rgba(9, 29, 21, 0.85)",
      black: "rgba(0, 0, 0, 0.95)"
    };
    tintOverlay.style.background = tints[bgTint] || tints.default;
    const blurVal = bgBlur !== undefined ? bgBlur : 15;
    tintOverlay.style.backdropFilter = `blur(${blurVal}px)`;
    tintOverlay.style.webkitBackdropFilter = `blur(${blurVal}px)`;
  }

  // Handle glowing borders
  if (bordersGlow) {
    sidebar.classList.add("glowing-borders");
    if (trigger) trigger.classList.add("glowing-borders");
  } else {
    sidebar.classList.remove("glowing-borders");
    if (trigger) trigger.classList.remove("glowing-borders");
  }
}

function applyInstagramCustomizations(igTheme, igCustomFont, compactMode, igFontSize) {
  // 1. Handle Font injection
  let fontStyleEl = document.getElementById("insta-custom-font-style");
  let fontLinkEl = document.getElementById("insta-custom-font-link");

  const fontUrls = {
    outfit: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap",
    inter: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap",
    montserrat: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap",
    poppins: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap",
    playfair: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap"
  };

  const fontFamilies = {
    outfit: "'Outfit', sans-serif",
    inter: "'Inter', sans-serif",
    montserrat: "'Montserrat', sans-serif",
    poppins: "'Poppins', sans-serif",
    playfair: "'Playfair Display', serif"
  };

  if (igCustomFont && igCustomFont !== "default" && fontUrls[igCustomFont]) {
    if (!fontLinkEl || fontLinkEl.getAttribute("href") !== fontUrls[igCustomFont]) {
      if (fontLinkEl) fontLinkEl.remove();
      fontLinkEl = document.createElement("link");
      fontLinkEl.id = "insta-custom-font-link";
      fontLinkEl.rel = "stylesheet";
      fontLinkEl.href = fontUrls[igCustomFont];
      document.head.appendChild(fontLinkEl);
    }

    if (!fontStyleEl) {
      fontStyleEl = document.createElement("style");
      fontStyleEl.id = "insta-custom-font-style";
      document.head.appendChild(fontStyleEl);
    }
    fontStyleEl.innerHTML = `
      * {
        font-family: ${fontFamilies[igCustomFont]}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      }
    `;
  } else {
    if (fontLinkEl) fontLinkEl.remove();
    if (fontStyleEl) fontStyleEl.remove();
  }

  // 1b. Handle Font Size injection
  let fontSizeStyleEl = document.getElementById("insta-custom-font-size-style");
  if (igFontSize && igFontSize !== "m") {
    if (!fontSizeStyleEl) {
      fontSizeStyleEl = document.createElement("style");
      fontSizeStyleEl.id = "insta-custom-font-size-style";
      document.head.appendChild(fontSizeStyleEl);
    }
    const fontSizes = {
      xs: "11px",
      s: "13px",
      l: "16px",
      xl: "18px"
    };
    const sizeVal = fontSizes[igFontSize] || "14px";
    fontSizeStyleEl.innerHTML = `
      body, p, span, a, button, input, textarea,
      ._aacl, ._aaco, ._aacw, ._aacx, ._aad7, ._aade {
        font-size: ${sizeVal} !important;
      }
    `;
  } else {
    if (fontSizeStyleEl) fontSizeStyleEl.remove();
  }

  // 2. Handle Instagram Theme Color Theme
  let themeStyleEl = document.getElementById("insta-custom-theme-style");
  if (igTheme) {
    if (!themeStyleEl) {
      themeStyleEl = document.createElement("style");
      themeStyleEl.id = "insta-custom-theme-style";
      document.head.appendChild(themeStyleEl);
    }

    const themeColors = {
      default: { // Cyber Pink
        primary: "#ec4899",
        hover: "#db2777",
        rgb: "rgb(236, 72, 153)",
        bgPrimary: "10, 10, 12",
        bgSecondary: "20, 16, 24"
      },
      blue: { // Diamante (Cian)
        primary: "#06b6d4",
        hover: "#0891b2",
        rgb: "rgb(6, 182, 212)",
        bgPrimary: "8, 14, 24",
        bgSecondary: "15, 23, 42"
      },
      green: { // Esmeralda (Verde)
        primary: "#10b981",
        hover: "#059669",
        rgb: "rgb(16, 185, 129)",
        bgPrimary: "6, 18, 14",
        bgSecondary: "12, 30, 24"
      },
      orange: { // Naranja
        primary: "#f97316",
        hover: "#ea580c",
        rgb: "rgb(249, 115, 22)",
        bgPrimary: "16, 12, 8",
        bgSecondary: "28, 20, 14"
      },
      gold: { // Oro
        primary: "#eab308",
        hover: "#ca8a04",
        rgb: "rgb(234, 179, 8)",
        bgPrimary: "14, 12, 6",
        bgSecondary: "24, 20, 10"
      }
    };

    const activeTheme = themeColors[igTheme];
    if (activeTheme) {
      themeStyleEl.innerHTML = `
        :root, html, body, [class] {
          --ig-link: ${activeTheme.primary} !important;
          --ig-primary-button-background: ${activeTheme.primary} !important;
          --ig-primary-button-hover-background: ${activeTheme.hover} !important;
          --ig-callout-border: ${activeTheme.primary} !important;
          --ig-badge: ${activeTheme.primary} !important;
          --link: ${activeTheme.primary} !important;
          --primary-button-background: ${activeTheme.primary} !important;
          --primary-button-hover-background: ${activeTheme.hover} !important;
          --accent-blue: ${activeTheme.primary} !important;
          --ig-accent-blue: ${activeTheme.primary} !important;
          
          /* Background overrides for Instagram */
          --ig-primary-background: ${activeTheme.bgPrimary} !important;
          --ig-secondary-background: ${activeTheme.bgSecondary} !important;
          --primary-background: rgb(${activeTheme.bgPrimary}) !important;
          --secondary-background: rgb(${activeTheme.bgSecondary}) !important;
        }
        
        /* Direct target for html-div elements to enforce background colors */
        body, html, [role="main"], main,
        div.html-div, div[class*="html-div"] {
          background-color: rgb(${activeTheme.bgPrimary}) !important;
        }

        /* Enforce theme backgrounds on articles, navs and custom container divs */
        article, 
        div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9x,
        div._aaeq, div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9s {
          background-color: rgb(${activeTheme.bgSecondary}) !important;
        }
        
        a, span[role="link"], ._aa-y, ._aacl._aaco._aacw._aacx._aad7._aade,
        a *, span[role="link"] *,
        [style*="color: rgb(0, 149, 246)"], [style*="color: #0095f6"] {
          color: ${activeTheme.primary} !important;
        }

        svg[color="rgb(0, 149, 246)"],
        svg[fill="rgb(0, 149, 246)"],
        svg[color="#0095f6"],
        svg[fill="#0095f6"] {
          color: ${activeTheme.primary} !important;
          fill: ${activeTheme.primary} !important;
        }

        svg *[fill="rgb(0, 149, 246)"],
        svg *[fill="#0095f6"],
        svg *[stroke="rgb(0, 149, 246)"],
        svg *[stroke="#0095f6"] {
          fill: ${activeTheme.primary} !important;
          stroke: ${activeTheme.primary} !important;
        }
      `;
    }
  } else {
    if (themeStyleEl) themeStyleEl.remove();
  }

  // 3. Handle Compact Mode
  let compactStyleEl = document.getElementById("insta-compact-mode-style");
  if (compactMode) {
    if (!compactStyleEl) {
      compactStyleEl = document.createElement("style");
      compactStyleEl.id = "insta-compact-mode-style";
      document.head.appendChild(compactStyleEl);
    }
    compactStyleEl.innerHTML = `
      /* Compact Instagram Feed and Spacing */
      article {
        max-width: 450px !important;
        margin-bottom: 16px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      article div._aagv,
      article div._aajn,
      article video {
        max-height: 500px !important;
        object-fit: contain !important;
        background: black !important;
      }
      article header {
        padding: 6px 8px !important;
      }
      article section {
        padding: 4px 8px !important;
      }
      div._ac7v {
        gap: 8px !important;
        margin-bottom: 8px !important;
      }
    `;
  } else {
    if (compactStyleEl) compactStyleEl.remove();
  }
}

function applySavedTheme() {
  chrome.storage.local.get({
    themeAccent: "default",
    themeBg: "default",
    themeBorders: false,
    themeBgTint: "default",
    themeBgBlur: 15,
    igCustomFont: "default",
    igCompactMode: false,
    igFontSize: "m"
  }, (saved) => {
    applyTheme(saved.themeAccent, saved.themeBg, saved.themeBorders, saved.themeBgTint, saved.themeBgBlur);
    applyInstagramCustomizations(saved.themeAccent, saved.igCustomFont, saved.igCompactMode, saved.igFontSize);
  });
}

function initFavoritesSidebar() {
  if (!document.body) {
    // Retry when body becomes available
    setTimeout(initFavoritesSidebar, 50);
    return;
  }

  if (document.getElementById("insta-favorites-sidebar")) return;

  // 1. Create floating button
  const trigger = document.createElement("div");
  trigger.id = "insta-favorites-trigger";
  trigger.title = "Mis Favoritos Local / My Local Favorites";
  trigger.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  // 2. Create Sidebar panel
  const sidebar = document.createElement("div");
  sidebar.id = "insta-favorites-sidebar";
  sidebar.innerHTML = `
    <div class="sidebar-bg-overlay"></div>
    <div class="sidebar-tint-overlay"></div>
    <div class="sidebar-header">
      <span class="sidebar-title">⭐ InstaControl Deluxe</span>
      <button id="insta-sidebar-close" title="Cerrar">✕</button>
    </div>
    
    <div class="sidebar-tabs">
      <button id="tab-recent" class="sidebar-tab active">Recientes</button>
      <button id="tab-creators" class="sidebar-tab">Creadores</button>
      <button id="tab-settings" class="sidebar-tab">Ajustes</button>
    </div>

    <div class="sidebar-content" id="insta-sidebar-content-area">
      <!-- Cards list will be injected here -->
    </div>

    <div id="insta-sidebar-selection-actions" class="sidebar-selection-actions">
      <button id="btn-download-selected" class="action-btn download">📥 Descargar (<span id="selected-count">0</span>)</button>
      <button id="btn-delete-selected" class="action-btn delete">🗑️ Eliminar</button>
    </div>
  `;

  document.body.appendChild(trigger);
  document.body.appendChild(sidebar);

  // Apply saved theme styles immediately
  applySavedTheme();

  // Bind Open/Close Events
  trigger.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    if (sidebar.classList.contains("open")) {
      updateFavoritesSidebar();
    }
  });

  const closeBtn = sidebar.querySelector("#insta-sidebar-close");
  closeBtn.addEventListener("click", () => {
    sidebar.classList.remove("open");
  });

  // Bind Selection Actions
  const downloadSelectedBtn = sidebar.querySelector("#btn-download-selected");
  downloadSelectedBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectedFavObjects.forEach((fav) => {
      if (fav.thumbnail) {
        chrome.runtime.sendMessage({
          action: "download",
          url: fav.thumbnail
        });
      }
    });
    isSelectionModeActive = false;
    selectedPostUrls.clear();
    selectedFavObjects.clear();
    updateFavoritesSidebar();
    updateSelectionUI();
  };

  const deleteSelectedBtn = sidebar.querySelector("#btn-delete-selected");
  deleteSelectedBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`¿Estás seguro de que deseas eliminar ${selectedPostUrls.size} favoritos?`)) {
      chrome.storage.local.get({ favorites: [] }, (data) => {
        let favs = data.favorites;
        const newFavs = favs.filter(f => !selectedPostUrls.has(f.postUrl));
        chrome.storage.local.set({ favorites: newFavs }, () => {
          isSelectionModeActive = false;
          selectedPostUrls.clear();
          selectedFavObjects.clear();
          updateFavoritesSidebar();
          updateSelectionUI();
          updateOverlayFavoriteStates();
        });
      });
    }
  };

  // Bind Tab Events
  const tabRecent = sidebar.querySelector("#tab-recent");
  const tabCreators = sidebar.querySelector("#tab-creators");
  const tabSettings = sidebar.querySelector("#tab-settings");

  tabRecent.addEventListener("click", () => {
    activeFavoritesTab = "recent";
    tabRecent.classList.add("active");
    tabCreators.classList.remove("active");
    tabSettings.classList.remove("active");
    updateFavoritesSidebar();
  });

  tabCreators.addEventListener("click", () => {
    activeFavoritesTab = "creators";
    tabCreators.classList.add("active");
    tabRecent.classList.remove("active");
    tabSettings.classList.remove("active");
    updateFavoritesSidebar();
  });

  tabSettings.addEventListener("click", () => {
    activeFavoritesTab = "settings";
    tabSettings.classList.add("active");
    tabRecent.classList.remove("active");
    tabCreators.classList.remove("active");
    updateFavoritesSidebar();
  });
}

function updateSelectionUI() {
  const actionsBar = document.getElementById("insta-sidebar-selection-actions");
  const countSpan = document.getElementById("selected-count");
  if (!actionsBar) return;

  if (isSelectionModeActive && selectedPostUrls.size > 0) {
    actionsBar.classList.add("visible");
    if (countSpan) countSpan.innerText = selectedPostUrls.size;
  } else {
    actionsBar.classList.remove("visible");
  }
}

function triggerCheckboxToggle(fav, isChecked) {
  if (isChecked) {
    selectedPostUrls.add(fav.postUrl);
    selectedFavObjects.set(fav.postUrl, fav);
  } else {
    selectedPostUrls.delete(fav.postUrl);
    selectedFavObjects.delete(fav.postUrl);
  }
  updateSelectionUI();
}

function renderSelectionHeader(container, favs) {
  const headerDiv = document.createElement("div");
  headerDiv.className = "sidebar-selection-header";
  if (isSelectionModeActive) {
    headerDiv.innerHTML = `
      <button id="btn-select-all" class="selection-action-btn-small">Todos</button>
      <button id="btn-deselect-all" class="selection-action-btn-small">Ninguno</button>
      <button id="btn-cancel-select" class="selection-action-btn-small cancel">Cancelar</button>
    `;

    headerDiv.querySelector("#btn-select-all").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      favs.forEach(f => {
        selectedPostUrls.add(f.postUrl);
        selectedFavObjects.set(f.postUrl, f);
      });
      updateFavoritesSidebar();
      updateSelectionUI();
    };

    headerDiv.querySelector("#btn-deselect-all").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedPostUrls.clear();
      selectedFavObjects.clear();
      updateFavoritesSidebar();
      updateSelectionUI();
    };

    headerDiv.querySelector("#btn-cancel-select").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isSelectionModeActive = false;
      selectedPostUrls.clear();
      selectedFavObjects.clear();
      updateFavoritesSidebar();
      updateSelectionUI();
    };
  } else {
    headerDiv.innerHTML = `
      <button id="btn-start-select" class="selection-action-btn-start">☑️ Seleccionar Múltiples</button>
    `;
    headerDiv.querySelector("#btn-start-select").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isSelectionModeActive = true;
      selectedPostUrls.clear();
      selectedFavObjects.clear();
      updateFavoritesSidebar();
      updateSelectionUI();
    };
  }
  container.appendChild(headerDiv);
}

function updateFavoritesSidebar() {
  const contentArea = document.getElementById("insta-sidebar-content-area");
  if (!contentArea) return;

  if (activeFavoritesTab === "settings") {
    isSelectionModeActive = false;
    updateSelectionUI();
    renderSettingsView(contentArea);
    return;
  }

  chrome.storage.local.get({ favorites: [] }, (data) => {
    const favs = data.favorites;

    if (!favs || favs.length === 0) {
      isSelectionModeActive = false;
      updateSelectionUI();
      contentArea.innerHTML = `
        <div class="sidebar-empty">
          <p>No tienes favoritos guardados.</p>
          <p style="font-size: 11px; color: #8e8e8e; margin-top: 5px;">Presiona el ícono de la estrella ⭐ en cualquier post.</p>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = "";
    renderSelectionHeader(contentArea, favs);

    const cardsWrapper = document.createElement("div");
    cardsWrapper.className = "sidebar-cards-wrapper";
    contentArea.appendChild(cardsWrapper);

    if (activeFavoritesTab === "recent") {
      renderRecentFavorites(favs, cardsWrapper);
    } else if (activeFavoritesTab === "creators") {
      renderCreatorsFavorites(favs, cardsWrapper);
    }
    updateSelectionUI();
  });
} function renderSettingsView(container) {
  container.innerHTML = `
    <div class="sidebar-settings-view">
      <!-- Sección: Color de Acento -->
      <div class="settings-section">
        <span class="settings-section-title">Color de Acento (Personalización)</span>
        <div class="color-palette">
          <div class="color-dot default" data-color="default" title="Cyber Pink"></div>
          <div class="color-dot blue" data-color="blue" title="Diamante"></div>
          <div class="color-dot green" data-color="green" title="Esmeralda"></div>
          <div class="color-dot orange" data-color="orange" title="Naranja"></div>
          <div class="color-dot gold" data-color="gold" title="Oro"></div>
        </div>
      </div>

      <!-- Sección: Tono de Fondo (Favoritos) -->
      <div class="settings-section">
        <span class="settings-section-title">Tono de Fondo (Favoritos)</span>
        <select id="sidebar-bg-tint" class="select-input-small">
          <option value="default">Cyber Dark (Por defecto)</option>
          <option value="slate">Gris Slate</option>
          <option value="midnight">Azul Medianoche</option>
          <option value="forest">Verde Bosque</option>
          <option value="black">Negro Puro</option>
        </select>
      </div>

      <!-- Sección: Desenfocar Fondo (Favoritos) -->
      <div class="settings-section">
        <span class="settings-section-title">Desenfocar Fondo: <span id="blur-val-display">15px</span></span>
        <div class="settings-slider-row">
          <input type="range" id="sidebar-bg-blur" min="0" max="30" value="15" class="range-input-small">
        </div>
      </div>

      <!-- Sección: Efectos Especiales -->
      <div class="settings-section">
        <span class="settings-section-title">Efectos Especiales</span>
        <div class="settings-row">
          <span class="settings-label">Bordes Brillantes Neon</span>
          <label class="switch-small">
            <input type="checkbox" id="sidebar-borders-glow">
            <span class="slider-small"></span>
          </label>
        </div>
      </div>

      <!-- Sección: Personalizar -->
      <div class="settings-section">
        <span class="settings-section-title">Personalizar</span>
        
        <div class="settings-row-dropdown">
          <span class="settings-label">Tipografía de Instagram</span>
          <select id="ig-custom-font" class="select-input-small">
            <option value="default">Original (Sin cambios)</option>
            <option value="outfit">Outfit (Moderna/Limpia)</option>
            <option value="inter">Inter (Legible/Neutral)</option>
            <option value="montserrat">Montserrat (Elegante)</option>
            <option value="poppins">Poppins (Amigable)</option>
            <option value="playfair">Playfair Display (Serif/Editorial)</option>
          </select>
        </div>

        <div class="settings-row-dropdown" style="margin-top: 12px;">
          <span class="settings-label">Tamaño de Letra</span>
          <select id="ig-font-size" class="select-input-small">
            <option value="xs">Muy pequeña (XS)</option>
            <option value="s">Pequeña (S)</option>
            <option value="m">Predeterminada (M)</option>
            <option value="l">Grande (L)</option>
            <option value="xl">Muy grande (XL)</option>
          </select>
        </div>

        <div class="settings-row" style="margin-top: 12px;">
          <span class="settings-label">Modo Compacto</span>
          <label class="switch-small">
            <input type="checkbox" id="ig-compact-mode">
            <span class="slider-small"></span>
          </label>
        </div>
      </div>

      <!-- Sección: Imagen de Fondo -->
      <div class="settings-section">
        <span class="settings-section-title">Imagen de Fondo (Favoritos)</span>
        <div class="bg-upload-container">
          <label class="bg-upload-btn" for="bg-image-input">
            📁 Subir Imagen
          </label>
          <input type="file" id="bg-image-input" accept="image/*" style="display: none;">
          
          <div id="bg-preview-container" class="bg-preview-wrapper" style="display: none;">
            <div id="bg-preview-thumb" class="bg-preview-thumb"></div>
            <button id="bg-remove-btn" class="bg-remove-btn">Quitar</button>
          </div>
        </div>
        <p class="settings-help">Carga una imagen (PNG/JPG) para el fondo del panel.</p>
      </div>

      <button id="settings-reset-btn" class="settings-reset-btn">Restablecer Todo</button>
    </div>
  `;

  chrome.storage.local.get({
    themeAccent: "default",
    themeBg: "default",
    themeBorders: false,
    themeBgTint: "default",
    themeBgBlur: 15,
    igCustomFont: "default",
    igCompactMode: false,
    igFontSize: "m"
  }, (saved) => {
    // 1. Color Palette dots
    const dots = container.querySelectorAll(".color-dot");
    dots.forEach(dot => {
      if (dot.dataset.color === saved.themeAccent) {
        dot.classList.add("active");
      }

      dot.addEventListener("click", () => {
        dots.forEach(d => d.classList.remove("active"));
        dot.classList.add("active");

        chrome.storage.local.set({ themeAccent: dot.dataset.color }, () => {
          chrome.storage.local.get({ themeBg: "default", themeBorders: false, themeBgTint: "default", themeBgBlur: 15, igCustomFont: "default", igCompactMode: false, igFontSize: "m" }, (curr) => {
            applyTheme(dot.dataset.color, curr.themeBg, curr.themeBorders, curr.themeBgTint, curr.themeBgBlur);
            applyInstagramCustomizations(dot.dataset.color, curr.igCustomFont, curr.igCompactMode, curr.igFontSize);
          });
        });
      });
    });

    // 2. Background Tint selector
    const bgTintSelect = container.querySelector("#sidebar-bg-tint");
    bgTintSelect.value = saved.themeBgTint;
    bgTintSelect.addEventListener("change", (e) => {
      const activeTint = e.target.value;
      chrome.storage.local.set({ themeBgTint: activeTint }, () => {
        chrome.storage.local.get({ themeAccent: "default", themeBg: "default", themeBorders: false, themeBgBlur: 15 }, (curr) => {
          applyTheme(curr.themeAccent, curr.themeBg, curr.themeBorders, activeTint, curr.themeBgBlur);
        });
      });
    });

    // 3. Background Blur range slider
    const bgBlurInput = container.querySelector("#sidebar-bg-blur");
    const blurValDisplay = container.querySelector("#blur-val-display");
    bgBlurInput.value = saved.themeBgBlur;
    blurValDisplay.innerText = `${saved.themeBgBlur}px`;
    bgBlurInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      blurValDisplay.innerText = `${val}px`;
      chrome.storage.local.set({ themeBgBlur: val }, () => {
        chrome.storage.local.get({ themeAccent: "default", themeBg: "default", themeBorders: false, themeBgTint: "default" }, (curr) => {
          applyTheme(curr.themeAccent, curr.themeBg, curr.themeBorders, curr.themeBgTint, val);
        });
      });
    });

    // 4. Borders Glow switch
    const bordersGlowInput = container.querySelector("#sidebar-borders-glow");
    bordersGlowInput.checked = saved.themeBorders;
    bordersGlowInput.addEventListener("change", (e) => {
      const active = e.target.checked;
      chrome.storage.local.set({ themeBorders: active }, () => {
        chrome.storage.local.get({ themeAccent: "default", themeBg: "default", themeBgTint: "default", themeBgBlur: 15 }, (curr) => {
          applyTheme(curr.themeAccent, curr.themeBg, active, curr.themeBgTint, curr.themeBgBlur);
        });
      });
    });

    // 5. Instagram Font dropdown select
    const igFontSelect = container.querySelector("#ig-custom-font");
    igFontSelect.value = saved.igCustomFont;
    igFontSelect.addEventListener("change", (e) => {
      const selectedFont = e.target.value;
      chrome.storage.local.set({ igCustomFont: selectedFont }, () => {
        chrome.storage.local.get({ themeAccent: "default", igCompactMode: false, igFontSize: "m" }, (curr) => {
          applyInstagramCustomizations(curr.themeAccent, selectedFont, curr.igCompactMode, curr.igFontSize);
        });
      });
    });

    // 5b. Instagram Font Size dropdown select
    const igFontSizeSelect = container.querySelector("#ig-font-size");
    igFontSizeSelect.value = saved.igFontSize || "m";
    igFontSizeSelect.addEventListener("change", (e) => {
      const selectedSize = e.target.value;
      chrome.storage.local.set({ igFontSize: selectedSize }, () => {
        chrome.storage.local.get({ themeAccent: "default", igCustomFont: "default", igCompactMode: false }, (curr) => {
          applyInstagramCustomizations(curr.themeAccent, curr.igCustomFont, curr.igCompactMode, selectedSize);
        });
      });
    });

    // 6. Instagram Compact Mode switch
    const igCompactInput = container.querySelector("#ig-compact-mode");
    igCompactInput.checked = saved.igCompactMode;
    igCompactInput.addEventListener("change", (e) => {
      const active = e.target.checked;
      chrome.storage.local.set({ igCompactMode: active }, () => {
        chrome.storage.local.get({ themeAccent: "default", igCustomFont: "default", igFontSize: "m" }, (curr) => {
          applyInstagramCustomizations(curr.themeAccent, curr.igCustomFont, active, curr.igFontSize);
        });
      });
    });

    // 7. Show background preview if it exists
    const previewContainer = container.querySelector("#bg-preview-container");
    const previewThumb = container.querySelector("#bg-preview-thumb");
    const removeBtn = container.querySelector("#bg-remove-btn");
    const fileInput = container.querySelector("#bg-image-input");

    if (saved.themeBg && saved.themeBg !== "default") {
      previewThumb.style.backgroundImage = `url('${saved.themeBg}')`;
      previewContainer.style.display = "flex";
    }

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert("La imagen es demasiado grande. Elige una menor a 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        chrome.storage.local.set({ themeBg: base64 }, () => {
          previewThumb.style.backgroundImage = `url('${base64}')`;
          previewContainer.style.display = "flex";

          chrome.storage.local.get({ themeAccent: "default", themeBorders: false, themeBgTint: "default", themeBgBlur: 15 }, (curr) => {
            applyTheme(curr.themeAccent, base64, curr.themeBorders, curr.themeBgTint, curr.themeBgBlur);
          });
        });
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener("click", () => {
      chrome.storage.local.set({ themeBg: "default" }, () => {
        previewContainer.style.display = "none";
        previewThumb.style.backgroundImage = "none";

        chrome.storage.local.get({ themeAccent: "default", themeBorders: false, themeBgTint: "default", themeBgBlur: 15 }, (curr) => {
          applyTheme(curr.themeAccent, "default", curr.themeBorders, curr.themeBgTint, curr.themeBgBlur);
        });
      });
    });

    // 8. Reset button
    const resetBtn = container.querySelector("#settings-reset-btn");
    resetBtn.addEventListener("click", () => {
      const defaults = {
        themeAccent: "default",
        themeBg: "default",
        themeBorders: false,
        themeBgTint: "default",
        themeBgBlur: 15,
        igCustomFont: "default",
        igCompactMode: false,
        igFontSize: "m"
      };

      chrome.storage.local.set(defaults, () => {
        // Reset UI
        dots.forEach(d => d.classList.remove("active"));
        const defDot = container.querySelector(".color-dot.default");
        if (defDot) defDot.classList.add("active");

        bgTintSelect.value = "default";
        bgBlurInput.value = 15;
        blurValDisplay.innerText = "15px";
        bordersGlowInput.checked = false;
        igFontSelect.value = "default";
        igFontSizeSelect.value = "m";
        igCompactInput.checked = false;
        previewContainer.style.display = "none";
        previewThumb.style.backgroundImage = "none";

        applyTheme("default", "default", false, "default", 15);
        applyInstagramCustomizations("default", "default", false, "m");
      });
    });
  });
}
function renderRecentFavorites(favs, container) {
  container.innerHTML = "";

  favs.forEach((fav) => {
    const card = createFavoriteCard(fav);
    container.appendChild(card);
  });
}

function renderCreatorsFavorites(favs, container) {
  container.innerHTML = "";

  // Group by creator
  const groups = {};
  favs.forEach((fav) => {
    if (!groups[fav.username]) {
      groups[fav.username] = [];
    }
    groups[fav.username].push(fav);
  });

  // Render collapsible sections for each creator
  Object.keys(groups).sort().forEach((username) => {
    const creatorSection = document.createElement("div");
    creatorSection.className = "creator-section";

    const header = document.createElement("div");
    header.className = "creator-header";
    header.innerHTML = `
      <span class="creator-name">@${username}</span>
      <span class="creator-count">${groups[username].length} posts</span>
    `;

    const itemsGrid = document.createElement("div");
    itemsGrid.className = "creator-items-grid";

    groups[username].forEach((fav) => {
      const card = createFavoriteCard(fav, true); // true for condensed style
      itemsGrid.appendChild(card);
    });

    // Toggle expand/collapse
    header.addEventListener("click", () => {
      creatorSection.classList.toggle("collapsed");
    });

    creatorSection.appendChild(header);
    creatorSection.appendChild(itemsGrid);
    container.appendChild(creatorSection);
  });
}

function createFavoriteCard(fav, isCondensed = false) {
  const card = document.createElement("div");
  card.className = `favorite-card ${isCondensed ? 'condensed' : ''} ${isSelectionModeActive ? 'selectable' : ''}`;

  // Use a nice placeholder or the actual media thumbnail
  const thumbUrl = fav.thumbnail || "https://www.instagram.com/static/images/ico/favicon-192.png/b4a4f67a4c9c.png";
  const mediaType = fav.type || "Video";

  let selectCheckHtml = "";
  if (isSelectionModeActive) {
    const isChecked = selectedPostUrls.has(fav.postUrl);
    selectCheckHtml = `
      <div class="card-select-checkbox-wrapper">
        <input type="checkbox" class="card-select-checkbox" ${isChecked ? "checked" : ""} data-post-url="${fav.postUrl}">
      </div>
    `;
  }

  card.innerHTML = `
    ${selectCheckHtml}
    <div class="card-thumb-wrapper" style="background-image: url('${thumbUrl}')">
      <a href="${fav.postUrl}" target="_blank" class="card-link-overlay" title="Ver publicación"></a>
    </div>
    <div class="card-details">
      <div class="card-user-info">
        <a href="https://instagram.com/${fav.username}" target="_blank" class="card-username">@${fav.username}</a>
        <div class="card-meta-row">
          <span class="card-type-badge ${mediaType.toLowerCase()}">${mediaType}</span>
          <span class="card-date">${new Date(fav.timestamp).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="card-action-btn card-download-btn" title="Descargar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="card-action-btn card-delete-btn" title="Eliminar">✕</button>
      </div>
    </div>
  `;

  // Selection toggle click handling
  if (isSelectionModeActive) {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("a") || e.target.classList.contains("card-select-checkbox")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const checkbox = card.querySelector(".card-select-checkbox");
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        triggerCheckboxToggle(fav, checkbox.checked);
      }
    });

    const checkbox = card.querySelector(".card-select-checkbox");
    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        triggerCheckboxToggle(fav, e.target.checked);
      });
    }
  }

  // Bind Actions inside the card
  const downloadBtn = card.querySelector(".card-download-btn");
  downloadBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    chrome.runtime.sendMessage({
      action: "download",
      url: fav.thumbnail
    });
  });

  const deleteBtn = card.querySelector(".card-delete-btn");
  deleteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    chrome.storage.local.get({ favorites: [] }, (data) => {
      let favs = data.favorites;
      const idx = favs.findIndex(f => f.postUrl === fav.postUrl);
      if (idx > -1) {
        favs.splice(idx, 1);
        chrome.storage.local.set({ favorites: favs }, () => {
          updateFavoritesSidebar();
          updateOverlayFavoriteStates();
        });
      }
    });
  });

  return card;
}

// Initial check for existing media and pathname
checkPathname();
document.querySelectorAll("video").forEach(addVideoTools);
document.querySelectorAll("img").forEach(addImageTools);

// Initialize favorites sidebar once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initFavoritesSidebar();
    updateOverlayFavoriteStates();
  });
} else {
  initFavoritesSidebar();
  updateOverlayFavoriteStates();
}
