function addVideoTools(video) {
  // Check if we already added tools to this video wrapper
  if (video.dataset.hasInstaTools) return;

  const parent = video.parentElement;
  if (!parent) return;

  // Mark as processed
  video.dataset.hasInstaTools = "true";
  parent.style.position = "relative"; // Ensure we can position absolute

  const overlay = document.createElement("div");
  overlay.className = "insta-tools-overlay";

  // Icons (SVG strings)
  const iconControls = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>`;
  const iconHide = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  const iconDownload = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  // Create Controls Toggle Button
  const startControlsBtn = document.createElement("button");
  startControlsBtn.className = "insta-tools-btn";
  startControlsBtn.innerHTML = iconControls;
  startControlsBtn.title = "Controles / Controls";
  startControlsBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (video.controls) {
      video.controls = false;
      startControlsBtn.innerHTML = iconControls;
      startControlsBtn.title = "Controles / Controls";
      // Restore z-index if we changed it
      video.style.zIndex = "";
    } else {
      video.controls = true;
      startControlsBtn.innerHTML = iconHide;
      startControlsBtn.title = "Ocultar Controles / Hide Controls";
      // Bring video to front so standard controls are clickable
      video.style.zIndex = "100";
    }
  };

  // Create Download Button
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "insta-tools-btn";
  downloadBtn.innerHTML = iconDownload;
  downloadBtn.title = "Descargar Video / Download Video";
  downloadBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const src = video.src;
    if (!src) {
      alert("No se encontró la fuente del video.");
      return;
    }

    if (src.startsWith('blob:')) {
      // Try strictly client-side download for blobs
      const a = document.createElement('a');
      a.href = src;
      a.download = `insta_video_${Date.now()}.mp4`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Send to background for standard download
      chrome.runtime.sendMessage({
        action: "download",
        url: src
      });
    }
  };

  overlay.appendChild(startControlsBtn);
  overlay.appendChild(downloadBtn);
  parent.appendChild(overlay);
}

function addImageTools(img) {
  // Check if processed
  if (img.dataset.hasInstaTools) return;

  // Heuristic: Ignore small images (profile pics, icons, etc.)
  // We check naturalWidth if available, or clientWidth
  // Note: naturalWidth might be 0 if not loaded yet, so we trust clientWidth mostly for visible elements
  const width = img.naturalWidth || img.clientWidth;
  const height = img.naturalHeight || img.clientHeight;

  // Instagram feed images are usually at least >250px wide/high
  if (width < 250 || height < 250) return;

  // Instagram specific: images in feed are usually inside a specific wrapper.
  const parent = img.parentElement;
  if (!parent) return;

  img.dataset.hasInstaTools = "true";

  // Ensure we can position absolute relative to this parent
  // Warning: changing position on some Instagram elements might break layout slightly? 
  // Usually 'relative' is safe on the wrapper div.
  const currentPos = window.getComputedStyle(parent).position;
  if (currentPos === 'static') {
    parent.style.position = "relative";
  }

  const overlay = document.createElement("div");
  overlay.className = "insta-tools-overlay";

  // Icon for download
  const iconDownload = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  const downloadBtn = document.createElement("button");
  downloadBtn.className = "insta-tools-btn";
  downloadBtn.innerHTML = iconDownload;
  downloadBtn.title = "Descargar Imagen / Download Image";

  downloadBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Get highest quality
    let src = img.src;
    if (img.srcset) {
      // Simple parse to get last (usually largest) url
      // srcset format: "url size, url size"
      const sources = img.srcset.split(",");
      const lastSource = sources[sources.length - 1].trim();
      const urlPart = lastSource.split(" ")[0];
      if (urlPart) src = urlPart;
    }

    if (!src) return;

    chrome.runtime.sendMessage({
      action: "download",
      url: src
    });
  };

  overlay.appendChild(downloadBtn);
  parent.appendChild(overlay);
}

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
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach(processNode);
  });
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial check for existing media
document.querySelectorAll("video").forEach(addVideoTools);
document.querySelectorAll("img").forEach(addImageTools);
