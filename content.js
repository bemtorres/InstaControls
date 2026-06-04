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

function injectDOMIdentifiers() {
  // 1. Identify wrappers of image/video (class contains _aagv)
  document.querySelectorAll("div._aagv, .insta-wrapper-hook").forEach(container => {
    container.setAttribute("data-insta-role", "media-container");
    
    // Find sibling overlays positioned absolutely over the image/video
    let sibling = container.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === "DIV") {
        sibling.setAttribute("data-insta-role", "protection-overlay");
      }
      sibling = sibling.nextElementSibling;
    }
  });

  // 2. Identify html-div divs (structural layout divs)
  document.querySelectorAll("div.html-div, div[class*='html-div']").forEach((div, index) => {
    div.setAttribute("data-insta-role", `structural-div-${index + 1}`);
  });
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
  injectDOMIdentifiers();
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

  // Set global background elements
  let globalBg = document.getElementById("insta-custom-global-bg");
  if (!globalBg) {
    globalBg = document.createElement("div");
    globalBg.id = "insta-custom-global-bg";
    globalBg.innerHTML = `
      <div class="global-bg-image"></div>
      <div class="global-bg-tint"></div>
    `;
    document.body.prepend(globalBg);
  }

  const globalBgImg = globalBg.querySelector(".global-bg-image");
  const globalBgTint = globalBg.querySelector(".global-bg-tint");
  const tints = {
    default: "rgba(10, 7, 18, 0.82)",
    slate: "rgba(30, 41, 59, 0.85)",
    midnight: "rgba(15, 23, 42, 0.85)",
    forest: "rgba(9, 29, 21, 0.85)",
    black: "rgba(0, 0, 0, 0.95)"
  };
  const activeTintColor = tints[bgTint] || tints.default;

  // Set the background image
  const bgOverlay = sidebar.querySelector(".sidebar-bg-overlay");
  if (bgImageBase64 && bgImageBase64 !== "default") {
    document.body.classList.add("insta-has-custom-bg");
    globalBg.style.display = "block";
    if (globalBgImg) {
      globalBgImg.style.backgroundImage = `url('${bgImageBase64}')`;
      const blurVal = bgBlur !== undefined ? bgBlur : 15;
      globalBgImg.style.filter = `blur(${blurVal}px)`;
    }
    if (globalBgTint) {
      globalBgTint.style.background = activeTintColor;
    }
  } else {
    document.body.classList.remove("insta-has-custom-bg");
    globalBg.style.display = "none";
    if (globalBgImg) {
      globalBgImg.style.backgroundImage = "none";
      globalBgImg.style.filter = "none";
    }
  }

  // Force sidebar background image overlay to be hidden/neutral
  if (bgOverlay) {
    bgOverlay.style.backgroundImage = "none";
    bgOverlay.style.display = "none";
    bgOverlay.style.filter = "none";
  }

  // Set the background tint color
  const tintOverlay = sidebar.querySelector(".sidebar-tint-overlay");
  if (tintOverlay) {
    tintOverlay.style.background = activeTintColor;
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
        
        /* Direct target for html-div elements to enforce background colors when custom background is NOT active */
        body:not(.insta-has-custom-bg), 
        body:not(.insta-has-custom-bg) html, 
        body:not(.insta-has-custom-bg) [role="main"], 
        body:not(.insta-has-custom-bg) main,
        body:not(.insta-has-custom-bg) div.html-div, 
        body:not(.insta-has-custom-bg) div[class*="html-div"] {
          background-color: rgb(${activeTheme.bgPrimary}) !important;
        }

        /* Enforce theme backgrounds on articles, navs and custom container divs when custom background is NOT active */
        body:not(.insta-has-custom-bg) article, 
        body:not(.insta-has-custom-bg) div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9x,
        body:not(.insta-has-custom-bg) div._aaeq, 
        body:not(.insta-has-custom-bg) div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9s {
          background-color: rgb(${activeTheme.bgSecondary}) !important;
        }

        /* When custom background IS active - make them transparent / glassmorphic */
        body.insta-has-custom-bg, 
        body.insta-has-custom-bg html, 
        body.insta-has-custom-bg [role="main"], 
        body.insta-has-custom-bg main,
        body.insta-has-custom-bg div.html-div, 
        body.insta-has-custom-bg div[class*="html-div"] {
          background-color: transparent !important;
          background-image: none !important;
        }

        body.insta-has-custom-bg article, 
        body.insta-has-custom-bg div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9x,
        body.insta-has-custom-bg div._aaeq, 
        body.insta-has-custom-bg div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9s {
          background-color: rgba(${activeTheme.bgSecondary}, 0.55) !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
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

function applyMatrixMode(active) {
  let matrixStyleEl = document.getElementById("insta-matrix-mode-style");
  let canvas = document.getElementById("insta-matrix-canvas");
  if (active) {
    if (!matrixStyleEl) {
      matrixStyleEl = document.createElement("style");
      matrixStyleEl.id = "insta-matrix-mode-style";
      document.head.appendChild(matrixStyleEl);
    }
    matrixStyleEl.innerHTML = `
      /* Matrix Mode hacker theme */
      :root, html, body {
        --ig-primary-background: 0, 0, 0 !important;
        --ig-secondary-background: 0, 0, 0 !important;
        --primary-background: rgb(0, 0, 0) !important;
        --secondary-background: rgb(0, 0, 0) !important;
        --ig-link: #00ff00 !important;
        --ig-primary-button-background: #00ff00 !important;
        --ig-primary-button-hover-background: #00dd00 !important;
        --link: #00ff00 !important;
        --accent-blue: #00ff00 !important;
        --ig-accent-blue: #00ff00 !important;
      }

      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        font-family: 'Courier New', Courier, monospace !important;
        color: #00ff00 !important;
        text-shadow: 0 0 4px rgba(0, 255, 0, 0.6) !important;
      }
      
      body, html, main, [role="main"], article, nav, header, section, input, textarea, button,
      div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background-color: transparent !important;
        background-image: none !important;
        border-color: #00ff00 !important;
        box-shadow: none !important;
      }
      
      /* Make divs transparent so overlays don't cover photos, excluding our sidebar */
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
        border-color: #00ff00 !important;
        box-shadow: none !important;
      }
      
      /* Keep modal dialogs and lightboxes opaque black */
      div[role="presentation"], div[role="dialog"] {
        background-color: rgba(0, 0, 0, 0.95) !important;
      }
      
      ::-webkit-scrollbar {
        width: 8px !important;
        background-color: #000000 !important;
      }
      ::-webkit-scrollbar-thumb {
        background-color: #00ff00 !important;
        border-radius: 4px !important;
      }
      
      svg {
        fill: #00ff00 !important;
        stroke: #00ff00 !important;
        color: #00ff00 !important;
      }
      svg * {
        fill: #00ff00 !important;
        stroke: #00ff00 !important;
      }
      
      /* Add hacker green tint filter to images and videos without turning them black */
      img, video {
        filter: sepia(1) hue-rotate(85deg) saturate(2) brightness(0.9) !important;
        border: 1px solid #00ff00 !important;
      }
      
      a:hover, button:hover {
        color: #ffffff !important;
        text-shadow: 0 0 8px #00ff00, 0 0 15px #00ff00 !important;
      }
    `;

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "insta-matrix-canvas";
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.zIndex = "-999";
      canvas.style.pointerEvents = "none";
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.instaMatrixResizeFn = resizeCanvas;

    // Japanese/Katakana characters + numbers + Latin uppercase
    const matrixChars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const alphabet = matrixChars.split("");
    const fontSize = 16;
    let columns = Math.floor(canvas.width / fontSize) + 1;
    let rainDrops = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0f0";
      ctx.font = `${fontSize}px monospace`;

      let newCols = Math.floor(canvas.width / fontSize) + 1;
      if (newCols !== rainDrops.length) {
        if (newCols > rainDrops.length) {
          while(rainDrops.length < newCols) rainDrops.push(1);
        } else {
          rainDrops = rainDrops.slice(0, newCols);
        }
      }

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet[Math.floor(Math.random() * alphabet.length)];
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    if (window.instaMatrixInterval) {
      clearInterval(window.instaMatrixInterval);
    }
    window.instaMatrixInterval = setInterval(draw, 33);
  } else {
    if (matrixStyleEl) matrixStyleEl.remove();
    if (canvas) canvas.remove();
    if (window.instaMatrixInterval) {
      clearInterval(window.instaMatrixInterval);
      window.instaMatrixInterval = null;
    }
    if (window.instaMatrixResizeFn) {
      window.removeEventListener("resize", window.instaMatrixResizeFn);
      window.instaMatrixResizeFn = null;
    }
  }
}

// -------------------- Hacker Mode --------------------
// Global store for elements affected by Hacker mode
let hackerElements = [];

function applyHackerMode(active) {
  let styleEl = document.getElementById("insta-hacker-mode-style");
  let canvas = document.getElementById("insta-hacker-canvas");
  if (active) {
    // Inject style if not present
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-hacker-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      /* Hacker mode base styles */
      :root, html, body {
        --ig-primary-background: 0,0,0 !important;
        --ig-secondary-background: 0,0,0 !important;
        --primary-background: rgb(0,0,0) !important;
        --secondary-background: rgb(0,0,0) !important;
        background-color: rgb(0,0,0) !important;
        color: #00ff00 !important;
        font-family: 'Courier New', Courier, monospace !important;
      }
      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        font-family: 'Courier New', Courier, monospace !important;
        color: #00ff00 !important;
        text-shadow: 0 0 4px rgba(0,255,0,0.6) !important;
      }
      body, html, main, [role="main"], article, nav, header, section, input, textarea, button,
      div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background-color: transparent !important;
        background-image: none !important;
        border-color: rgba(0,255,0,0.3) !important;
        box-shadow: none !important;
      }
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
        border-color: rgba(0,255,0,0.2) !important;
        box-shadow: none !important;
      }
      div[role="presentation"], div[role="dialog"] {
        background-color: rgba(0, 0, 0, 0.95) !important;
      }
      ::-webkit-scrollbar { width: 8px !important; background-color: #000 !important; }
      ::-webkit-scrollbar-thumb { background-color: #00ff00 !important; border-radius: 4px !important; }
      svg { fill: #00ff00 !important; stroke: #00ff00 !important; color: #00ff00 !important; }
      svg * { fill: #00ff00 !important; stroke: #00ff00 !important; }
      img, video {
        filter: sepia(1) hue-rotate(85deg) saturate(2) brightness(0.9) !important;
        border: 1px solid #00ff00 !important;
      }
      a:hover, button:hover {
        color: #ffffff !important;
        text-shadow: 0 0 8px #00ff00, 0 0 15px #00ff00 !important;
      }
      /* Hacker obfuscation classes */
      [data-hacker-obfuscated="true"] {
        cursor: pointer !important;
        transition: opacity 0.2s ease !important;
      }
      [data-hacker-obfuscated="true"]:hover {
        opacity: 1 !important;
        text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00 !important;
      }
    `;

    // Create falling code canvas
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "insta-hacker-canvas";
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.zIndex = "-999";
      canvas.style.pointerEvents = "none";
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.instaHackerResizeFn = resizeCanvas;

    // Hacker rain characters — mixed scripts
    const hackerChars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワンΔΣΩΨΦΛΞΠ01ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ";
    const alphabet = hackerChars.split("");
    const fontSize = 16;
    let columns = Math.floor(canvas.width / fontSize) + 1;
    let rainDrops = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f0";
      ctx.font = `${fontSize}px monospace`;

      let newCols = Math.floor(canvas.width / fontSize) + 1;
      if (newCols !== rainDrops.length) {
        if (newCols > rainDrops.length) {
          while (rainDrops.length < newCols) rainDrops.push(1);
        } else {
          rainDrops = rainDrops.slice(0, newCols);
        }
      }

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet[Math.floor(Math.random() * alphabet.length)];
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);
        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    if (window.instaHackerInterval) clearInterval(window.instaHackerInterval);
    window.instaHackerInterval = setInterval(draw, 33);

    // Obfuscate visible text elements
    const pool = "アイウエオカキクケコサシスセソタチツテトΔΣΩΨΦΛΞΠ01ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰabcdefghijklmnopqrstuvwxyz0123456789!@#$%&";
    const randomString = (len) => {
      let s = "";
      for (let i = 0; i < len; i++) {
        s += pool.charAt(Math.floor(Math.random() * pool.length));
      }
      return s;
    };

    // Target text-containing elements inside articles
    const textEls = document.querySelectorAll("article span, article a, article h2, article h1");
    textEls.forEach(el => {
      // Skip elements that are inside our sidebar or have no meaningful text
      if (el.closest("#insta-favorites-sidebar") || el.closest("#insta-favorites-trigger")) return;
      if (!el.textContent.trim() || el.children.length > 0) return;
      if (el.dataset.hackerOriginal) return; // already processed

      const original = el.textContent;
      el.dataset.hackerOriginal = original;
      el.dataset.hackerObfuscated = "true";
      el.textContent = randomString(original.length);

      const showOriginal = () => { el.textContent = el.dataset.hackerOriginal; };
      const hideOriginal = () => { el.textContent = randomString(el.dataset.hackerOriginal.length); };
      el.addEventListener("mouseenter", showOriginal);
      el.addEventListener("mouseleave", hideOriginal);
      hackerElements.push({ el, showOriginal, hideOriginal });
    });
  } else {
    // Clean up style and canvas
    if (styleEl) styleEl.remove();
    if (canvas) canvas.remove();
    if (window.instaHackerInterval) {
      clearInterval(window.instaHackerInterval);
      window.instaHackerInterval = null;
    }
    if (window.instaHackerResizeFn) {
      window.removeEventListener("resize", window.instaHackerResizeFn);
      window.instaHackerResizeFn = null;
    }
    // Restore original texts and detach listeners
    hackerElements.forEach(item => {
      const { el, showOriginal, hideOriginal } = item;
      el.removeEventListener("mouseenter", showOriginal);
      el.removeEventListener("mouseleave", hideOriginal);
      if (el.dataset.hackerOriginal) {
        el.textContent = el.dataset.hackerOriginal;
        delete el.dataset.hackerOriginal;
        delete el.dataset.hackerObfuscated;
      }
    });
    hackerElements = [];
  }
}

// End of Hacker mode

// ---------------------------------------------------

// Existing code continues below


function applyAngineMode(active) {
  let angineStyleEl = document.getElementById("insta-angine-mode-style");
  if (active) {
    if (!angineStyleEl) {
      angineStyleEl = document.createElement("style");
      angineStyleEl.id = "insta-angine-mode-style";
      document.head.appendChild(angineStyleEl);
    }
    angineStyleEl.innerHTML = `
      /* Angine Mode theme (Angine de Poitrine) */
      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        color: #ffffff !important;
        text-shadow: none !important;
      }
      
      body, html, main, [role="main"], article, nav, header, section, input, textarea, button,
      div.html-div:not([data-insta-role="structural-div-1"]), div[class*="html-div"]:not([data-insta-role="structural-div-1"]) {
        background-color: #000000 !important;
        background-image: none !important;
        border-color: #ffffff !important;
        box-shadow: none !important;
      }
      
      /* Apply the dotted pattern and parpadeo + zoom animation directly to the outermost layout div */
      div[data-insta-role="structural-div-1"] {
        background-color: #000000 !important;
        background-image: 
          radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px),
          radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px) !important;
        background-size: 32px 32px !important;
        background-position: 0 0, 16px 16px !important;
        animation: angine-intro-anim 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards !important;
      }
      
      /* Make divs transparent so overlays don't cover photos, excluding our sidebar */
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
        box-shadow: none !important;
      }
      
      /* Keep modal dialogs and lightboxes opaque black with dots */
      div[role="presentation"], div[role="dialog"] {
        background-color: #000000 !important;
        background-image: 
          radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px),
          radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px) !important;
        background-size: 32px 32px !important;
        background-position: 0 0, 16px 16px !important;
      }
      
      svg {
        fill: #ffffff !important;
        stroke: #ffffff !important;
        color: #ffffff !important;
      }
      svg * {
        fill: #ffffff !important;
        stroke: #ffffff !important;
      }
      
      a:hover, button:hover {
        color: #cccccc !important;
      }

      @keyframes angine-intro-anim {
        0% {
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.05) 2px, transparent 2px),
            radial-gradient(rgba(255, 255, 255, 0.05) 2px, transparent 2px) !important;
          background-size: 16px 16px !important;
          background-position: 0 0, 8px 8px !important;
        }
        20% {
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px),
            radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px) !important;
          background-size: 40px 40px !important;
          background-position: 0 0, 20px 20px !important;
        }
        40% {
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.05) 2px, transparent 2px),
            radial-gradient(rgba(255, 255, 255, 0.05) 2px, transparent 2px) !important;
          background-size: 24px 24px !important;
          background-position: 0 0, 12px 12px !important;
        }
        60% {
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px),
            radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px) !important;
          background-size: 36px 36px !important;
          background-position: 0 0, 18px 18px !important;
        }
        80% {
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.1) 2px, transparent 2px),
            radial-gradient(rgba(255, 255, 255, 0.1) 2px, transparent 2px) !important;
          background-size: 30px 30px !important;
          background-position: 0 0, 15px 15px !important;
        }
        100% {
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px),
            radial-gradient(rgba(255, 255, 255, 0.28) 2px, transparent 2px) !important;
          background-size: 32px 32px !important;
          background-position: 0 0, 16px 16px !important;
        }
      }
    `;
  } else {
    if (angineStyleEl) angineStyleEl.remove();
  }
}

function applyCyberpunkMode(active) {
  let styleEl = document.getElementById("insta-cyberpunk-mode-style");
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-cyberpunk-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      /* Cyberpunk Mode neon theme */
      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        color: #ffffff !important;
        animation: cyberpunk-flicker 3s infinite alternate !important;
      }
      
      body, html, main, [role="main"], article, nav, header, section, input, textarea, button,
      div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background-color: #0d0c1d !important;
        background-image: none !important;
        border-color: #ff0055 !important;
        box-shadow: 0 0 10px rgba(255, 0, 85, 0.2) !important;
      }
      
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
        border-color: rgba(0, 240, 255, 0.4) !important;
      }
      
      a, span[role="link"], ._aa-y, button {
        color: #00f0ff !important;
        text-shadow: 0 0 5px #00f0ff !important;
      }

      img, video {
        filter: saturate(1.8) contrast(1.2) hue-rotate(-10deg) !important;
        border: 2px solid #00f0ff !important;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.5) !important;
      }

      @keyframes cyberpunk-flicker {
        0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
          text-shadow: 0 0 4px #fff, 0 0 8px #00f0ff, 0 0 12px #ff0055 !important;
        }
        20%, 24%, 55% {
          text-shadow: none !important;
        }
      }
    `;
  } else {
    if (styleEl) styleEl.remove();
  }
}

function applyRetroMode(active) {
  let styleEl = document.getElementById("insta-retro-mode-style");
  let crtEl = document.getElementById("insta-crt-overlay");
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-retro-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
      
      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        font-family: 'Press Start 2P', monospace !important;
        font-size: 9px !important;
        line-height: 1.6 !important;
        text-transform: uppercase !important;
        color: #0f380f !important;
        text-shadow: none !important;
      }
      
      body, html, main, [role="main"], div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background-color: #9bbc0f !important;
        background-image: none !important;
        border-color: #0f380f !important;
      }
      
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
        border-color: #0f380f !important;
      }
      
      article, section, nav, header, input, select, textarea, button {
        background-color: #8bac0f !important;
        border: 3px solid #0f380f !important;
        border-radius: 0px !important;
        box-shadow: none !important;
      }
      
      img, video {
        filter: grayscale(1) contrast(1.4) !important;
        border: 3px solid #0f380f !important;
      }
      
      svg, svg * {
        fill: #0f380f !important;
        stroke: #0f380f !important;
      }
      
      /* CRT scanline simulation */
      #insta-crt-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 99999;
        background: repeating-linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.12) 50%);
        background-size: 100% 4px;
        animation: crt-flicker 0.15s infinite;
      }
      
      @keyframes crt-flicker {
        0% { opacity: 0.95; }
        50% { opacity: 1; }
        100% { opacity: 0.96; }
      }
    `;
    
    if (!crtEl) {
      crtEl = document.createElement("div");
      crtEl.id = "insta-crt-overlay";
      document.body.appendChild(crtEl);
    }
  } else {
    if (styleEl) styleEl.remove();
    if (crtEl) crtEl.remove();
  }
}

function applyOceanMode(active) {
  let styleEl = document.getElementById("insta-ocean-mode-style");
  let bubbleContainer = document.getElementById("insta-ocean-bubbles");
  
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-ocean-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      body, html, main, [role="main"], div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background: linear-gradient(180deg, #021526 0%, #03346e 100%) !important;
        background-attachment: fixed !important;
      }
      
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
      }
      
      article, section, nav, header, input, button {
        background-color: rgba(3, 52, 110, 0.4) !important;
        backdrop-filter: blur(5px) !important;
        -webkit-backdrop-filter: blur(5px) !important;
        border: 1px solid rgba(110, 172, 218, 0.3) !important;
        border-radius: 16px !important;
        animation: ocean-water-ripple 5s ease-in-out infinite alternate !important;
      }
      
      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        color: #e2f1e7 !important;
      }
      
      svg, svg * {
        fill: #6eacda !important;
        stroke: #6eacda !important;
      }
      
      img, video {
        border-radius: 12px !important;
        animation: ocean-water-ripple 4.5s ease-in-out infinite alternate-reverse !important;
      }

      .ocean-bubble {
        position: absolute;
        bottom: -30px;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        animation: float-up linear infinite;
      }

      @keyframes float-up {
        0% {
          transform: translateY(0) translateX(0);
          opacity: 0;
        }
        10% { opacity: 0.6; }
        90% { opacity: 0.6; }
        100% {
          transform: translateY(-110vh) translateX(50px);
          opacity: 0;
        }
      }

      @keyframes ocean-water-ripple {
        0% {
          transform: skewX(-1.5deg) translateY(0);
        }
        100% {
          transform: skewX(1.5deg) translateY(6px);
        }
      }
    `;

    if (!bubbleContainer) {
      bubbleContainer = document.createElement("div");
      bubbleContainer.id = "insta-ocean-bubbles";
      bubbleContainer.style.position = "fixed";
      bubbleContainer.style.inset = "0";
      bubbleContainer.style.pointerEvents = "none";
      bubbleContainer.style.zIndex = "-999";
      bubbleContainer.style.overflow = "hidden";
      document.body.appendChild(bubbleContainer);
      
      for (let i = 0; i < 25; i++) {
        const bubble = document.createElement("div");
        bubble.className = "ocean-bubble";
        bubble.style.left = `${Math.random() * 100}vw`;
        const size = Math.random() * 15 + 5;
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.animationDelay = `${Math.random() * 6}s`;
        bubble.style.animationDuration = `${Math.random() * 8 + 6}s`;
        bubbleContainer.appendChild(bubble);
      }
    }
  } else {
    if (styleEl) styleEl.remove();
    if (bubbleContainer) bubbleContainer.remove();
  }
}

function applyPsychedelicMode(active) {
  let styleEl = document.getElementById("insta-psychedelic-mode-style");
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-psychedelic-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      body, html, main, [role="main"], div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background: linear-gradient(45deg, #ff0055, #00f0ff, #00ff66, #ffcc00, #ff0055) !important;
        background-size: 400% 400% !important;
        animation: psychedelic-bg-shift 8s ease infinite !important;
      }
      
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
      }
      
      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        animation: psychedelic-text-shift 4s linear infinite !important;
      }
      
      img:hover, video:hover, article:hover {
        animation: psychedelic-wobble 0.5s ease-in-out infinite alternate !important;
      }
      
      @keyframes psychedelic-bg-shift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      @keyframes psychedelic-text-shift {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
      
      @keyframes psychedelic-wobble {
        0% { transform: scale(1.05) rotate(-1deg) skewX(-2deg); }
        100% { transform: scale(1.05) rotate(1deg) skewX(2deg); }
      }
    `;
  } else {
    if (styleEl) styleEl.remove();
  }
}

function applyMinecraftMode(active) {
  let styleEl = document.getElementById("insta-minecraft-mode-style");
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-minecraft-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
      
      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        font-family: 'VT323', monospace !important;
        font-size: 19px !important;
        text-shadow: 2px 2px 0px #000000 !important;
        color: #ffffff !important;
      }
      
      body, html, main, [role="main"], div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background-color: #2c2c2c !important;
        background-image: 
          linear-gradient(90deg, #1e1e1e 2px, transparent 2px),
          linear-gradient(0deg, #1e1e1e 2px, transparent 2px),
          linear-gradient(90deg, #444 1px, transparent 1px),
          linear-gradient(0deg, #444 1px, transparent 1px) !important;
        background-size: 32px 32px, 32px 32px, 8px 8px, 8px 8px !important;
      }
      
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
      }
      
      article, section, nav, header, input, select, textarea, button {
        background-color: #4a4a4a !important;
        border: 4px solid #1a1a1a !important;
        border-radius: 0px !important;
        box-shadow: inset -4px -4px 0px #2a2a2a, inset 4px 4px 0px #6a6a6a !important;
      }
      
      button:hover, [role="button"]:hover, a:hover {
        background-color: #7a7a7a !important;
        border-color: #ffff55 !important;
      }
      
      svg, svg * {
        fill: #55ff55 !important;
        stroke: #55ff55 !important;
      }

      /* Unliked Pixel Heart override */
      svg:has(path[d^="M16.792"]) {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 9 9'><path d='M1,0h2v1h-2z M5,0h2v1h-2z M0,1h1v3h-1z M4,1h1v2h-1z M8,1h1v3h-1z M1,4h1v1h-1z M7,4h1v1h-1z M2,5h1v1h-1z M6,5h1v1h-1z M3,6h1v1h-1z M5,6h1v1h-1z M4,7h1v1h-1z' fill='%23000'/><path d='M1,1h3v3h-3z M5,1h3v3h-3z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z' fill='rgba(0,0,0,0.35)'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        width: 24px !important;
        height: 24px !important;
      }
      svg:has(path[d^="M16.792"]) * {
        display: none !important;
      }

      /* Liked Pixel Heart override */
      svg[color="rgb(255, 48, 64)"], 
      svg[fill="rgb(255, 48, 64)"],
      svg[color="#ff3040"],
      svg:has(path[fill="rgb(255, 48, 64)"]),
      svg:has(path[d^="M3.478"]),
      svg:has(path[d^="M12 21.35"]) {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 9 9'><path d='M1,0h2v1h-2z M5,0h2v1h-2z M0,1h1v3h-1z M4,1h1v2h-1z M8,1h1v3h-1z M1,4h1v1h-1z M7,4h1v1h-1z M2,5h1v1h-1z M6,5h1v1h-1z M3,6h1v1h-1z M5,6h1v1h-1z M4,7h1v1h-1z' fill='%23000'/><path d='M1,1h3v3h-3z M5,1h3v3h-3z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z' fill='%23ff2222'/><rect x='1' y='1' width='1' height='1' fill='%23fff'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        width: 24px !important;
        height: 24px !important;
      }
      svg[color="rgb(255, 48, 64)"] *, 
      svg[fill="rgb(255, 48, 64)"] *,
      svg[color="#ff3040"] *,
      svg:has(path[fill="rgb(255, 48, 64)"]) *,
      svg:has(path[d^="M3.478"]) *,
      svg:has(path[d^="M12 21.35"]) * {
        display: none !important;
      }
      
      img, video {
        border: 4px solid #1a1a1a !important;
      }
    `;
  } else {
    if (styleEl) styleEl.remove();
  }
}

function applyYt05Mode(active) {
  let styleEl = document.getElementById("insta-yt05-mode-style");
  let ytHeader = document.getElementById("insta-yt05-header");
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-yt05-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      /* YouTube 2005 Mode */
      body, html, main, [role="main"], div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background-color: #ffffff !important;
        background-image: none !important;
      }
      
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
        box-shadow: none !important;
      }

      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        font-family: Arial, Helvetica, sans-serif !important;
        color: #333333 !important;
        text-shadow: none !important;
      }

      /* Logo wrapper expansion to fit 240px YouTube slogan logo */
      a[href="/"]:has(svg[aria-label="Instagram"]),
      a[href="/"]:has(svg[aria-label="Logotipo de Instagram"]),
      a[href="/"]:has(svg[aria-label="Instagram logo"]),
      a[href="/"]:has(svg._8-yf) {
        width: 240px !important;
        height: 40px !important;
        display: block !important;
        overflow: visible !important;
      }

      /* Logo Replacement */
      svg[aria-label="Instagram"],
      svg[aria-label="Logotipo de Instagram"],
      svg[aria-label="Instagram logo"],
      svg._8-yf {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 40' width='240' height='40'><text x='5' y='26' font-family='Arial Black, Arial, sans-serif' font-weight='900' font-size='24' fill='%23000' letter-spacing='-1.5'>You</text><rect x='56' y='4' width='54' height='28' rx='6' ry='6' fill='%23ff0000'/><text x='60' y='25' font-family='Arial Black, Arial, sans-serif' font-weight='900' font-size='20' fill='%23ffffff' letter-spacing='-1'>Tube</text><text x='112' y='12' font-family='Arial, sans-serif' font-size='8' fill='%23666' font-weight='bold'>TM</text><text x='125' y='24' font-family='Arial, sans-serif' font-size='12' fill='%23777' font-weight='bold'>Broadcast Yourself</text></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: left center !important;
        width: 240px !important;
        height: 40px !important;
      }
      svg[aria-label="Instagram"] *,
      svg[aria-label="Logotipo de Instagram"] *,
      svg[aria-label="Instagram logo"] *,
      svg._8-yf * {
        display: none !important;
      }

      /* Link overrides */
      a, span[role="link"], ._aa-y, ._aacl._aaco._aacw._aacx._aad7._aade {
        color: #0033cc !important;
        text-decoration: underline !important;
        font-weight: normal !important;
      }
      a:hover, span[role="link"]:hover {
        color: #cc0000 !important;
      }

      /* Article / Post Styling */
      article {
        background-color: #ffffff !important;
        border: 1px solid #cccccc !important;
        border-radius: 0px !important;
        padding: 12px !important;
        margin-bottom: 20px !important;
        box-shadow: none !important;
      }
      article header {
        background-color: #e5e5e5 !important;
        border-bottom: 1px solid #cccccc !important;
        margin: -12px -12px 10px -12px !important;
        padding: 8px 12px !important;
        border-radius: 0px !important;
      }
      article header a, article header span {
        font-weight: bold !important;
        color: #0033cc !important;
      }

      /* Add black border to video and images like YouTube player screen */
      article div._aagv, article div._aajn, article video, article img {
        border: 5px solid #000000 !important;
        box-sizing: border-box !important;
      }

      /* Sidebar navigation items styled as classic 2005 tabs */
      div[role="navigation"] a, div[role="navigation"] div[role="button"] {
        background: linear-gradient(180deg, #d2e3fc 0%, #aecbfa 100%) !important;
        border: 1px solid #7baaf7 !important;
        border-radius: 4px 4px 0 0 !important;
        padding: 6px 12px !important;
        margin-bottom: 6px !important;
      }
      div[role="navigation"] a:hover {
        background: #aecbfa !important;
      }
      div[role="navigation"] svg {
        display: none !important;
      }
      div[role="navigation"] span {
        color: #0033cc !important;
        text-decoration: underline !important;
        font-weight: normal !important;
      }

      /* Action buttons style overrides */
      /* Heart SVG replaced by 2005 rating star */
      svg:has(path[d^="M16.792"]) {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffcc00'><path d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        width: 24px !important;
        height: 24px !important;
      }
      svg:has(path[d^="M16.792"]) * {
        display: none !important;
      }

      /* Red active liked heart -> filled red star */
      svg[color="rgb(255, 48, 64)"], 
      svg[fill="rgb(255, 48, 64)"],
      svg[color="#ff3040"],
      svg:has(path[fill="rgb(255, 48, 64)"]),
      svg:has(path[d^="M3.478"]),
      svg:has(path[d^="M12 21.35"]) {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cc0000'><path d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        width: 24px !important;
        height: 24px !important;
      }
      svg[color="rgb(255, 48, 64)"] *, 
      svg[fill="rgb(255, 48, 64)"] *,
      svg[color="#ff3040"] *,
      svg:has(path[fill="rgb(255, 48, 64)"]) *,
      svg:has(path[d^="M3.478"]) *,
      svg:has(path[d^="M12 21.35"]) * {
        display: none !important;
      }

      /* Comment SVG override */
      svg[aria-label="Comment"], svg[aria-label="Comentar"] {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230033cc'><path d='M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
      }
      svg[aria-label="Comment"] *, svg[aria-label="Comentar"] * {
        display: none !important;
      }

      /* Share SVG override */
      svg[aria-label="Share Post"], svg[aria-label="Compartir publicación"], svg[aria-label="Share"], svg[aria-label="Compartir"] {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230033cc'><path d='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
      }
      svg[aria-label="Share Post"] *, svg[aria-label="Compartir publicación"] *, svg[aria-label="Share"] *, svg[aria-label="Compartir"] * {
        display: none !important;
      }

      /* Save SVG override */
      svg[aria-label="Save"], svg[aria-label="Guardar"] {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230033cc'><path d='M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
      }
      svg[aria-label="Save"] *, svg[aria-label="Guardar"] * {
        display: none !important;
      }

      /* Suggestions bar right column boxes */
      div._aaoz, div._as5c, div[class*="sidebar"], aside {
        background-color: #fff9db !important;
        border: 1px solid #ffe87c !important;
        border-radius: 0px !important;
        padding: 12px !important;
        box-shadow: none !important;
      }
      div._aaoz::before, div._as5c::before, aside::before {
        content: "Sign up for your free account!" !important;
        font-family: Arial, sans-serif !important;
        font-weight: bold !important;
        font-size: 14px !important;
        color: #0033cc !important;
        text-decoration: underline !important;
        display: block !important;
        margin-bottom: 10px !important;
      }
    `;
    
    // Inject sub-navigation header above main feed
    if (!ytHeader) {
      ytHeader = document.createElement("div");
      ytHeader.id = "insta-yt05-header";
      ytHeader.style.width = "100%";
      ytHeader.style.backgroundColor = "#e5e5e5";
      ytHeader.style.border = "1px solid #cccccc";
      ytHeader.style.padding = "8px 12px";
      ytHeader.style.marginBottom = "20px";
      ytHeader.style.boxSizing = "border-box";
      ytHeader.style.display = "flex";
      ytHeader.style.justifyContent = "center";
      ytHeader.style.alignItems = "center";
      ytHeader.style.fontSize = "12px";
      ytHeader.style.fontFamily = "Arial, sans-serif";
      ytHeader.innerHTML = `
        <span style="color: #000; font-weight: bold; margin-right: 15px; font-size: 13px;">Most Viewed</span>
        <a href="#" onclick="return false;" style="color: #0033cc; text-decoration: underline; margin: 0 8px;">Today</a> |
        <a href="#" onclick="return false;" style="color: #0033cc; text-decoration: underline; margin: 0 8px;">This Week</a> |
        <a href="#" onclick="return false;" style="color: #0033cc; text-decoration: underline; margin: 0 8px;">This Month</a> |
        <a href="#" onclick="return false;" style="color: #0033cc; text-decoration: underline; margin: 0 8px; font-weight: bold;">All Time</a>
        <span style="margin-left: auto; color: #666; font-size: 11px;">Videos 1-20 of 100</span>
      `;
      
      const mainEl = document.querySelector("main[role='main']") || document.querySelector("div[data-insta-role='structural-div-1']");
      if (mainEl) {
        mainEl.prepend(ytHeader);
      }
    }

  } else {
    if (styleEl) styleEl.remove();
    if (ytHeader) ytHeader.remove();
  }
}

function applyInstaOldMode(active) {
  let styleEl = document.getElementById("insta-instaold-mode-style");
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "insta-instaold-mode-style";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Pacifico&display=swap');
      
      /* Old Instagram 2011/2012 Theme */
      body, html, main, [role="main"], div.html-div, div[class*="html-div"], div[data-insta-role="structural-div-1"] {
        background-color: #edeeee !important;
        background-image: none !important;
      }
      
      div:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not([data-insta-role="structural-div-1"]) {
        background-color: transparent !important;
        box-shadow: none !important;
      }

      *:not(#insta-favorites-sidebar):not(#insta-favorites-sidebar *):not(#insta-favorites-trigger):not(#insta-favorites-trigger *) {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        color: #333333 !important;
        text-shadow: none !important;
      }

      /* Desktop navigation sidebar & mobile headers */
      div[role="navigation"], nav[role="navigation"], header, div[class*="Navigation"], nav[class*="Navigation"] {
        background: linear-gradient(to bottom, #517fa4 0%, #3f729b 100%) !important;
        border-right: 1px solid #2d506d !important;
        border-bottom: 1px solid #2d506d !important;
      }

      div[role="navigation"] span, div[role="navigation"] a, div[role="navigation"] div[role="button"] {
        color: #ffffff !important;
        font-weight: bold !important;
        text-shadow: 0 -1px 0 rgba(0,0,0,0.4) !important;
      }

      div[role="navigation"] a:hover, div[role="navigation"] div[role="button"]:hover {
        background-color: rgba(255, 255, 255, 0.15) !important;
      }

      div[role="navigation"] svg {
        fill: #ffffff !important;
        stroke: #ffffff !important;
        color: #ffffff !important;
      }

      /* Expand link wrapper to fit cursive script logo */
      a[href="/"]:has(svg[aria-label="Instagram"]),
      a[href="/"]:has(svg[aria-label="Logotipo de Instagram"]),
      a[href="/"]:has(svg[aria-label="Instagram logo"]),
      a[href="/"]:has(svg._8-yf) {
        width: 150px !important;
        height: 40px !important;
        display: block !important;
        overflow: visible !important;
      }

      /* Logo Replacement */
      svg[aria-label="Instagram"],
      svg[aria-label="Logotipo de Instagram"],
      svg[aria-label="Instagram logo"],
      svg._8-yf {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 40' width='150' height='40'><text x='5' y='30' font-family='Pacifico, cursive' font-size='28' fill='%23fff'>Instagram</text></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: left center !important;
        width: 150px !important;
        height: 40px !important;
      }
      svg[aria-label="Instagram"] *,
      svg[aria-label="Logotipo de Instagram"] *,
      svg[aria-label="Instagram logo"] *,
      svg._8-yf * {
        display: none !important;
      }

      /* Post / Article Styling */
      article {
        background-color: #ffffff !important;
        border: 1px solid #d9d9d9 !important;
        border-radius: 4px !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
        padding: 0px !important;
        margin-bottom: 24px !important;
        overflow: hidden !important;
      }
      article header {
        background-color: #ffffff !important;
        border-bottom: none !important;
        padding: 12px 16px !important;
        margin: 0px !important;
        border-radius: 4px 4px 0 0 !important;
      }
      article header a, article header span {
        font-weight: bold !important;
        color: #3f729b !important;
      }

      /* Post details, comments, captions styling */
      article time, article span, article div {
        color: #333333 !important;
      }
      a, span[role="link"], ._aa-y, ._aacl._aaco._aacw._aacx._aad7._aade {
        color: #3f729b !important;
        font-weight: bold !important;
        text-decoration: none !important;
      }
      a:hover, span[role="link"]:hover {
        text-decoration: underline !important;
      }

      /* Unliked Heart -> blue-grey outline heart */
      svg:has(path[d^="M16.792"]) {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233f729b' stroke-width='2'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        width: 24px !important;
        height: 24px !important;
      }
      svg:has(path[d^="M16.792"]) * {
        display: none !important;
      }

      /* Liked Heart -> solid blue heart */
      svg[color="rgb(255, 48, 64)"], 
      svg[fill="rgb(255, 48, 64)"],
      svg[color="#ff3040"],
      svg:has(path[fill="rgb(255, 48, 64)"]),
      svg:has(path[d^="M3.478"]),
      svg:has(path[d^="M12 21.35"]) {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233f729b'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>") !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        width: 24px !important;
        height: 24px !important;
      }
      svg[color="rgb(255, 48, 64)"] *, 
      svg[fill="rgb(255, 48, 64)"] *,
      svg[color="#ff3040"] *,
      svg:has(path[fill="rgb(255, 48, 64)"]) *,
      svg:has(path[d^="M3.478"]) *,
      svg:has(path[d^="M12 21.35"]) * {
        display: none !important;
      }
    `;
  } else {
    if (styleEl) styleEl.remove();
  }
}

function applySecretCodes(code) {
  const normCode = (code || "").trim().toLowerCase();
  
  applyMatrixMode(normCode === "matrix");
  applyAngineMode(normCode === "angine");
  applyCyberpunkMode(normCode === "cyberpunk");
  applyRetroMode(normCode === "retro" || normCode === "gameboy");
  applyOceanMode(normCode === "ocean" || normCode === "aqua");
  applyPsychedelicMode(normCode === "psychedelic" || normCode === "rainbow");
  applyMinecraftMode(normCode === "minecraft");
  applyYt05Mode(normCode === "yt05");
  applyInstaOldMode(normCode === "instaold");
  applyHackerMode(normCode === "hacker");
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
    igFontSize: "m",
    secretCode: ""
  }, (saved) => {
    applyTheme(saved.themeAccent, saved.themeBg, saved.themeBorders, saved.themeBgTint, saved.themeBgBlur);
    applyInstagramCustomizations(saved.themeAccent, saved.igCustomFont, saved.igCompactMode, saved.igFontSize);
    applySecretCodes(saved.secretCode);
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

      <!-- Sección: Tono de Fondo Principal -->
      <div class="settings-section">
        <span class="settings-section-title">Tono de Fondo Principal</span>
        <select id="sidebar-bg-tint" class="select-input-small">
          <option value="default">Cyber Dark (Por defecto)</option>
          <option value="slate">Gris Slate</option>
          <option value="midnight">Azul Medianoche</option>
          <option value="forest">Verde Bosque</option>
          <option value="black">Negro Puro</option>
        </select>
      </div>

      <!-- Sección: Desenfocar Fondo Principal -->
      <div class="settings-section">
        <span class="settings-section-title">Desenfocar Fondo Principal: <span id="blur-val-display">15px</span></span>
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
        <span class="settings-section-title">Imagen de Fondo Principal</span>
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
        <p class="settings-help">Carga una imagen (PNG/JPG) para el fondo principal de Instagram.</p>
      </div>

      <!-- Sección: Código Secreto (Easter Egg) -->
      <div class="settings-section">
        <span class="settings-section-title">Código Secreto</span>
        <div class="settings-row-dropdown">
          <input type="text" id="settings-secret-code" class="text-input-small" placeholder="Escribe un código secreto...">
        </div>
        <p class="settings-help" style="margin-top: 4px;">Introduce un código para desbloquear modos ocultos.</p>
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
    igFontSize: "m",
    secretCode: ""
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

    // 7b. Secret Code input logic
    const secretCodeInput = container.querySelector("#settings-secret-code");
    secretCodeInput.value = saved.secretCode || "";
    secretCodeInput.addEventListener("input", (e) => {
      const codeVal = e.target.value;
      chrome.storage.local.set({ secretCode: codeVal }, () => {
        applySecretCodes(codeVal);
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
        igFontSize: "m",
        secretCode: ""
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
        secretCodeInput.value = "";

        applyTheme("default", "default", false, "default", 15);
        applyInstagramCustomizations("default", "default", false, "m");
        applySecretCodes("");
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
injectDOMIdentifiers();
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
