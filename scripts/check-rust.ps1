# 检测 Rust 开发环境（Windows 优化）
param(
  [switch]$InstallIfMissing
)

Write-Host "[check-rust] 开始检测 Rust 工具链..." -ForegroundColor Cyan

$rustc = (Get-Command rustc -ErrorAction SilentlyContinue)
$cargo = (Get-Command cargo -ErrorAction SilentlyContinue)
$rustup = (Get-Command rustup -ErrorAction SilentlyContinue)

if ($rustc -and $cargo) {
  rustc -V
  cargo -V
} else {
  Write-Warning "未检测到 Rust 工具链。"
  if ($InstallIfMissing) {
    Write-Host "将通过 rustup 安装 stable 工具链..." -ForegroundColor Yellow
    if (-not $rustup) {
      Invoke-WebRequest https://win.rustup.rs -OutFile rustup-init.exe
      Start-Process -FilePath .\rustup-init.exe -ArgumentList "-y" -Wait
      Remove-Item .\rustup-init.exe -Force
    } else {
      rustup -V
      rustup update
    }
  } else {
    Write-Host "可运行：`pwsh scripts/check-rust.ps1 -InstallIfMissing` 自动安装。" -ForegroundColor Yellow
  }
}

# 检测 MSVC/CL（Tauri Windows 构建依赖）
$cl = (Get-Command cl.exe -ErrorAction SilentlyContinue)
if (-not $cl) {
  Write-Warning "未检测到 MSVC 编译器（cl.exe）。请安装 Visual Studio Build Tools 2022 -> C++ 桌面开发组件。"
}

Write-Host "[check-rust] 检测完成。" -ForegroundColor Cyan

