chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: "welcome.html" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download") {
    // Try to determine extension
    let ext = "mp4";
    if (request.url.includes(".jpg")) ext = "jpg";
    else if (request.url.includes(".jpeg")) ext = "jpg";
    else if (request.url.includes(".png")) ext = "png";
    else if (request.url.includes(".webp")) ext = "webp";

    chrome.downloads.download({
      url: request.url,
      filename: `instagram_media_${Date.now()}.${ext}`,
      saveAs: true
    });
  }
});
