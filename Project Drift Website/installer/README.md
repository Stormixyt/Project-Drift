Project Drift - Installer builder
================================

This folder contains an Inno Setup script and a build script to create a Windows installer for Project Drift.

What is included
- installer.iss       - Inno Setup script that packages the site/launcher files into an installer EXE.
- build-installer.ps1 - PowerShell script that creates a staging folder and runs Inno Setup compiler (ISCC.exe).

How to build locally
1. Install Inno Setup 6 on Windows (https://jrsoftware.org/isinfo.php).
2. Open PowerShell in this folder and run:

   .\build-installer.ps1

3. If successful, the installer EXE will be in the `Output` subfolder (Inno Setup default).

CI build (recommended)
- A GitHub Actions workflow is included at `.github/workflows/build-installer.yml`. When the workflow runs on `windows-latest` it will install Inno Setup, build the installer, and attach the produced EXE as a release asset called `Project-Drift-Complete-Installer-v1.0.0.exe`.

Notes
- The Inno Setup script assumes the launcher executable is named `ProjectDriftLauncher.exe` in the packaged files. If your launcher has a different name, update `installer.iss` accordingly.
- Storing large binaries in the git repository is not recommended. The workflow uploads the EXE as a GitHub Release asset instead of keeping it in the repository history.

CI trigger note:
- This small markdown change was added to trigger the GitHub Actions workflow so the installer will be rebuilt and the Release updated.
