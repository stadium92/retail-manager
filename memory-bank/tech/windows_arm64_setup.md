$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
Write-Host "--- Toolset Architecture Check ---" -ForegroundColor Cyan
$x86 = & $vswhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64
$arm = & $vswhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.ARM64
if ($x86) { Write-Host "[OK] x86/x64 Build Tools are present" -ForegroundColor Green }
if ($arm) { Write-Host "[OK] ARM64 Native Build Tools are present" -ForegroundColor Green }
if (!$x86 -and !$arm) { Write-Host "[!!] NO C++ COMPILERS FOUND" -ForegroundColor Red }