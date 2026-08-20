Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\Administrator\Music\votinghub\frontend\public\logo192.png"
$dstPath = "C:\Users\Administrator\Music\votinghub\frontend\public\logo-sm.png"
$src = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap 88, 88
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, 0, 0, 88, 88)
$bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$src.Dispose()
Write-Output "Generated logo-sm.png: $((Get-Item $dstPath).Length) bytes"
