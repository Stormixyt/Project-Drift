# Project Drift Custom Installer UI

This is a minimalist, glass-morphism Electron installer for Project Drift. It matches the website style and launches the Inno Setup installer EXE.

## Features
- Neon blue accent, Inter font, glass morphism
- Shows logo, Install button, Run launcher checkbox
- Runs the official installer EXE (silent or normal)
- Can be packaged as a single EXE with embedded icon

## How to build
1. Run `npm install` in this folder.
2. Run `npm run start` to test the installer UI locally.
3. Run `npm run pack` to build a distributable EXE (icon embedded).

## How it works
- Clicking Install runs the Inno Setup EXE (`../Project Drift Website/installer/Output/Project-Drift-Complete-Installer-v1.0.0.exe`).
- The Run launcher checkbox is for future extension (can be wired to auto-launch after install).

## Customization
- Edit `style.css` for colors, glass effect, spacing.
- Replace `InstallerImage.png` for a different logo.
- Edit `main.js` for advanced install logic (silent mode, progress, etc).

---

**Note:** This UI does not replace the actual installer logic. It is a front-end for launching the official installer. For a full custom install flow, extend `main.js` to extract files, create shortcuts, etc.
