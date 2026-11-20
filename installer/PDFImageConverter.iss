; Inno Setup 6 installer for PDF Image Converter.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppName "PDF Image Converter"
#define AppExeName "PDF Image Converter.exe"
#define AppId "{{997B86CB-E4E0-5147-BF76-2733DAB6636A}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Asahi
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\release
OutputBaseFilename=PDF Image Converter Setup {#AppVersion}
SetupIconFile=..\assets\app-icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
ChangesAssociations=yes

[Languages]
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Files]
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "デスクトップにショートカットを作成する"; GroupDescription: "追加アイコン:"; Flags: unchecked

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    { Remove the invalid legacy parent command before recreating the menu. }
    RegDeleteKeyIncludingSubkeys(HKCU,
      'Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    RegDeleteKeyIncludingSubkeys(HKCU,
      'Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter');
    RegDeleteKeyIncludingSubkeys(HKCU,
      'Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Open');
    RegDeleteKeyIncludingSubkeys(HKCU,
      'Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Png');
    RegDeleteKeyIncludingSubkeys(HKCU,
      'Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Jpeg');
    RegDeleteKeyIncludingSubkeys(HKCU,
      'Software\Classes\PDFImageConverter.PDF');
    RegDeleteValue(HKCU,
      'Software\Classes\.pdf\OpenWithProgids', 'PDFImageConverter.PDF');
  end;
end;

[Registry]
Root: HKCU; Subkey: "Software\Classes\PDFImageConverter.PDF"; ValueType: string; ValueData: "PDF document"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\PDFImageConverter.PDF\DefaultIcon"; ValueType: string; ValueData: "{app}\{#AppExeName},0"
Root: HKCU; Subkey: "Software\Classes\PDFImageConverter.PDF\shell\open\command"; ValueType: string; ValueData: """{app}\{#AppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\.pdf\OpenWithProgids"; ValueType: string; ValueName: "PDFImageConverter.PDF"; ValueData: ""; Flags: uninsdeletevalue

Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Open"; ValueType: string; ValueName: "MUIVerb"; ValueData: "PDF Image Converterで変換"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Open\command"; ValueType: string; ValueData: """{app}\{#AppExeName}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Png"; ValueType: string; ValueName: "MUIVerb"; ValueData: "PNGに変換（標準）"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Png\command"; ValueType: string; ValueData: """{app}\{#AppExeName}"" --convert=png ""%1"""
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Jpeg"; ValueType: string; ValueName: "MUIVerb"; ValueData: "JPEGに変換（標準）"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.pdf\shell\PDFImageConverter.Jpeg\command"; ValueType: string; ValueData: """{app}\{#AppExeName}"" --convert=jpeg ""%1"""

[Run]
Filename: "{app}\{#AppExeName}"; Description: "PDF Image Converter を起動する"; Flags: nowait postinstall skipifsilent
