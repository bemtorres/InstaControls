# Developer Guide / Guía para Desarrolladores

This guide contains useful commands for developing and packaging **InstaControls**.

## Packaging for Chrome Web Store

To create the `.zip` file required for upload, run the following command in PowerShell:

```powershell
Compress-Archive -Path "manifest.json", "content.js", "background.js", "style.css", "welcome.html", "welcome.css", "assets", "LICENSE" -DestinationPath "InstaControls-v1.0.zip" -Force
```

## Useful Links / Enlaces Útiles

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
