document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    autoControls: document.getElementById("autoControls"),
    keyboardShortcuts: document.getElementById("keyboardShortcuts"),
    persistVolume: document.getElementById("persistVolume"),
    skipSeconds: document.getElementById("skipSeconds")
  };

  const defaultSettings = {
    autoControls: false,
    keyboardShortcuts: true,
    persistVolume: true,
    skipSeconds: 10
  };

  // Load saved configurations from chrome.storage.local
  chrome.storage.local.get(defaultSettings, (saved) => {
    Object.keys(elements).forEach((key) => {
      if (elements[key]) {
        if (elements[key].type === "checkbox") {
          elements[key].checked = saved[key];
        } else {
          elements[key].value = saved[key];
        }
      }
    });
  });

  // Helper to save setting change
  function saveSetting(key, value) {
    chrome.storage.local.set({ [key]: value });
  }

  // Bind change events to elements
  Object.keys(elements).forEach((key) => {
    if (elements[key]) {
      elements[key].addEventListener("change", (e) => {
        const val = e.target.type === "checkbox" ? e.target.checked : parseInt(e.target.value, 10);
        saveSetting(key, val);
      });
    }
  });
});
