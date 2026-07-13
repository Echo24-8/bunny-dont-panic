Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'assets\images'
New-Item -ItemType Directory -Force -Path $output | Out-Null

function New-Brush([string]$hex, [int]$alpha = 255) {
  $color = [System.Drawing.ColorTranslator]::FromHtml($hex)
  return New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B))
}

function New-Pen([string]$hex, [float]$width, [int]$alpha = 255) {
  $color = [System.Drawing.ColorTranslator]::FromHtml($hex)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B)), $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  return $pen
}

function New-Graphics([System.Drawing.Bitmap]$bitmap) {
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  return $graphics
}

function Add-PaperGrain($graphics, $random, [int]$width, [int]$height, [string]$light, [string]$dark) {
  $lightBrush = New-Brush $light 20
  $darkBrush = New-Brush $dark 14
  for ($i = 0; $i -lt 7200; $i++) {
    $x = $random.Next(0, $width)
    $y = $random.Next(0, $height)
    $size = $random.Next(1, 5)
    $brush = if (($i % 3) -eq 0) { $darkBrush } else { $lightBrush }
    $graphics.FillEllipse($brush, $x, $y, $size, $size)
  }
  $lightBrush.Dispose()
  $darkBrush.Dispose()
}

function New-Background([string]$path, [bool]$storm) {
  $width = 1080
  $height = 1920
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = New-Graphics $bitmap
  $random = New-Object System.Random ($(if ($storm) { 9221 } else { 4217 }))

  $sky = New-Brush $(if ($storm) { '#8eb6b8' } else { '#cce8e5' })
  $graphics.FillRectangle($sky, 0, 0, $width, $height)
  $sky.Dispose()

  $washColors = if ($storm) { @('#6f9094', '#b8d1cc', '#647f86', '#d6dfcf') } else { @('#eaf6ee', '#a9d8d2', '#d8efeb', '#f7edcc') }
  for ($i = 0; $i -lt 68; $i++) {
    $brush = New-Brush $washColors[$i % $washColors.Count] ($random.Next(9, 28))
    $w = $random.Next(180, 620)
    $h = $random.Next(120, 430)
    $graphics.FillEllipse($brush, $random.Next(-180, $width), $random.Next(-120, 1250), $w, $h)
    $brush.Dispose()
  }

  $cloud = New-Brush '#f8f5e8' $(if ($storm) { 78 } else { 132 })
  foreach ($cloudData in @(@(40, 190, 350, 126), @(680, 315, 420, 144), @(320, 560, 290, 108))) {
    $graphics.FillEllipse($cloud, $cloudData[0], $cloudData[1], $cloudData[2], $cloudData[3])
    $graphics.FillEllipse($cloud, $cloudData[0] + 80, $cloudData[1] - 46, $cloudData[2] * .45, $cloudData[3] * .9)
  }
  $cloud.Dispose()

  $farHill = New-Brush $(if ($storm) { '#789c88' } else { '#9bc59a' }) 255
  $graphics.FillEllipse($farHill, -220, 1120, 940, 820)
  $graphics.FillEllipse($farHill, 430, 1060, 990, 880)
  $farHill.Dispose()
  $nearHill = New-Brush $(if ($storm) { '#52796d' } else { '#6ca878' })
  $graphics.FillEllipse($nearHill, -330, 1390, 1080, 740)
  $graphics.FillEllipse($nearHill, 390, 1320, 1160, 800)
  $nearHill.Dispose()

  $pathBrush = New-Brush $(if ($storm) { '#bfba91' } else { '#e8d79c' }) 210
  $pathShape = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pathShape.AddBezier(405, 1920, 430, 1650, 500, 1480, 540, 1240)
  $pathShape.AddBezier(540, 1240, 620, 1500, 690, 1690, 790, 1920)
  $pathShape.CloseFigure()
  $graphics.FillPath($pathBrush, $pathShape)
  $pathShape.Dispose()
  $pathBrush.Dispose()

  $flowerColors = @('#f1c95f', '#f0918b', '#f8f4df', '#7dbbc3')
  for ($i = 0; $i -lt 92; $i++) {
    $x = $random.Next(28, $width - 28)
    $y = $random.Next(1340, $height - 24)
    if ($x -gt 390 -and $x -lt 800 -and $y -gt 1580) { continue }
    $stem = New-Pen '#47745b' 4 150
    $graphics.DrawLine($stem, $x, $y, $x + $random.Next(-5, 6), $y + 22)
    $stem.Dispose()
    $petal = New-Brush $flowerColors[$i % $flowerColors.Count] 205
    $graphics.FillEllipse($petal, $x - 6, $y - 5, 13, 13)
    $petal.Dispose()
  }

  if ($storm) {
    $windPen = New-Pen '#e9f0df' 6 42
    for ($i = 0; $i -lt 24; $i++) {
      $x = $random.Next(-80, 980)
      $y = $random.Next(120, 1540)
      $graphics.DrawArc($windPen, $x, $y, $random.Next(120, 280), $random.Next(40, 90), 190, 130)
    }
    $windPen.Dispose()
    $dangerWash = New-Brush '#b9525c' 24
    $graphics.FillEllipse($dangerWash, -160, 80, 520, 440)
    $graphics.FillEllipse($dangerWash, 760, 520, 440, 520)
    $dangerWash.Dispose()
  }

  Add-PaperGrain $graphics $random $width $height '#fffdf3' '#355f59'
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Add-PlushTexture($graphics, $random, [int]$cx, [int]$cy, [int]$rx, [int]$ry, [string]$color) {
  $brush = New-Brush $color 28
  for ($i = 0; $i -lt 180; $i++) {
    $angle = $random.NextDouble() * [Math]::PI * 2
    $radius = [Math]::Sqrt($random.NextDouble())
    $x = $cx + [Math]::Cos($angle) * $rx * $radius
    $y = $cy + [Math]::Sin($angle) * $ry * $radius
    $graphics.FillEllipse($brush, [int]$x, [int]$y, 3, 3)
  }
  $brush.Dispose()
}

function New-Bunny([string]$path) {
  $bitmap = New-Object System.Drawing.Bitmap 512, 512
  $graphics = New-Graphics $bitmap
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $random = New-Object System.Random 1187
  $outline = New-Pen '#536560' 12
  $fur = New-Brush '#fff8e9'
  $pink = New-Brush '#efb2b0'
  $shadow = New-Brush '#5a716b' 36
  $graphics.FillEllipse($shadow, 112, 392, 288, 52)
  $graphics.FillEllipse($fur, 118, 178, 276, 260)
  $graphics.DrawEllipse($outline, 118, 178, 276, 260)
  $graphics.FillEllipse($fur, 142, 44, 86, 214)
  $graphics.DrawEllipse($outline, 142, 44, 86, 214)
  $graphics.FillEllipse($fur, 282, 44, 86, 214)
  $graphics.DrawEllipse($outline, 282, 44, 86, 214)
  $graphics.FillEllipse($pink, 168, 76, 34, 142)
  $graphics.FillEllipse($pink, 308, 76, 34, 142)
  $graphics.FillEllipse($fur, 82, 280, 92, 104)
  $graphics.DrawEllipse($outline, 82, 280, 92, 104)
  $graphics.FillEllipse($fur, 340, 280, 92, 104)
  $graphics.DrawEllipse($outline, 340, 280, 92, 104)
  $eye = New-Brush '#2c4142'
  $graphics.FillEllipse($eye, 192, 274, 22, 30)
  $graphics.FillEllipse($eye, 298, 274, 22, 30)
  $eye.Dispose()
  $nose = New-Brush '#df777c'
  $graphics.FillEllipse($nose, 245, 310, 22, 16)
  $nose.Dispose()
  $mouth = New-Pen '#5b4a49' 6
  $graphics.DrawArc($mouth, 224, 308, 38, 48, 20, 100)
  $graphics.DrawArc($mouth, 252, 308, 38, 48, 60, 100)
  $mouth.Dispose()
  $scarf = New-Brush '#df5660'
  $graphics.FillEllipse($scarf, 136, 362, 244, 48)
  $graphics.FillPolygon($scarf, @(
    (New-Object System.Drawing.Point 316, 382),
    (New-Object System.Drawing.Point 388, 426),
    (New-Object System.Drawing.Point 332, 450)
  ))
  $scarf.Dispose()
  Add-PlushTexture $graphics $random 256 308 118 100 '#b5c9bd'
  $outline.Dispose(); $fur.Dispose(); $pink.Dispose(); $shadow.Dispose()
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function New-Enemy([string]$path, [string]$kind) {
  $bitmap = New-Object System.Drawing.Bitmap 384, 384
  $graphics = New-Graphics $bitmap
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $random = New-Object System.Random ($(if ($kind -eq 'puff') { 774 } elseif ($kind -eq 'bell') { 981 } else { 1182 }))
  $outline = New-Pen '#4d5f5e' 11
  $shadow = New-Brush '#536c68' 34
  $graphics.FillEllipse($shadow, 80, 300, 224, 42)
  if ($kind -eq 'puff') {
    $body = New-Brush '#ed9b87'
    foreach ($circle in @(@(72, 126, 148), @(164, 86, 154), @(228, 132, 124), @(112, 176, 188))) {
      $graphics.FillEllipse($body, $circle[0], $circle[1], $circle[2], $circle[2])
      $graphics.DrawEllipse($outline, $circle[0], $circle[1], $circle[2], $circle[2])
    }
    Add-PlushTexture $graphics $random 190 208 108 82 '#9e554f'
  } elseif ($kind -eq 'bell') {
    $body = New-Brush '#75a9c0'
    $graphics.FillEllipse($body, 94, 82, 196, 164)
    $graphics.DrawEllipse($outline, 94, 82, 196, 164)
    $graphics.FillRectangle($body, 94, 164, 196, 116)
    $graphics.DrawLine($outline, 94, 164, 94, 280)
    $graphics.DrawLine($outline, 290, 164, 290, 280)
    $graphics.DrawArc($outline, 94, 230, 196, 100, 0, 180)
    Add-PlushTexture $graphics $random 192 194 86 96 '#3e6c83'
  } else {
    $body = New-Brush '#f0c75e'
    $points = New-Object 'System.Collections.Generic.List[System.Drawing.Point]'
    for ($i = 0; $i -lt 10; $i++) {
      $radius = if (($i % 2) -eq 0) { 132 } else { 62 }
      $angle = -[Math]::PI / 2 + $i * [Math]::PI / 5
      $points.Add((New-Object System.Drawing.Point ([int](192 + [Math]::Cos($angle) * $radius)), ([int](192 + [Math]::Sin($angle) * $radius))))
    }
    $graphics.FillPolygon($body, $points.ToArray())
    $graphics.DrawPolygon($outline, $points.ToArray())
    Add-PlushTexture $graphics $random 192 192 92 92 '#9e742d'
  }
  $eye = New-Brush '#2d4141'
  $graphics.FillEllipse($eye, 139, 182, 22, 28)
  $graphics.FillEllipse($eye, 223, 182, 22, 28)
  $eye.Dispose()
  $mouth = New-Pen '#5c4a47' 5
  $graphics.DrawArc($mouth, 164, 205, 58, 42, 15, 150)
  $mouth.Dispose()
  $outline.Dispose(); $shadow.Dispose(); $body.Dispose()
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

New-Background (Join-Path $output 'meadow-day.png') $false
New-Background (Join-Path $output 'meadow-storm.png') $true
New-Bunny (Join-Path $output 'bunny.png')
New-Enemy (Join-Path $output 'enemy-puff.png') 'puff'
New-Enemy (Join-Path $output 'enemy-bell.png') 'bell'
New-Enemy (Join-Path $output 'enemy-star.png') 'star'
Write-Output "Generated art assets in $output"
