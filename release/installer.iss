; Project Drift - Inno Setup Installer Script
; Creates a Windows installer for the Unity client

#define MyAppName "Project Drift"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Project Drift Team"
#define MyAppURL "https://github.com/yourusername/project-drift"
#define MyAppExeName "ProjectDrift.exe"

[Setup]
; App information
AppId={{PROJECT-DRIFT-UNIQUE-ID}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Installation directories
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output
OutputDir=release\Output
OutputBaseFilename=ProjectDrift-Setup-v{#MyAppVersion}
SetupIconFile=client\unity\Assets\Icon.ico
Compression=lzma2
SolidCompression=yes

; Modern UI
WizardStyle=modern
WizardImageFile=release\installer-banner.bmp
WizardSmallImageFile=release\installer-icon.bmp

; Requirements
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0

; License
LicenseFile=LICENSE

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Main executable and dependencies
Source: "build\StandaloneWindows64\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\StandaloneWindows64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Redistributables
Source: "release\vcredist_x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Install Visual C++ Redistributable
Filename: "{tmp}\vcredist_x64.exe"; Parameters: "/quiet /norestart"; StatusMsg: "Installing Visual C++ Redistributable..."; Flags: waituntilterminated

; Launch application
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
