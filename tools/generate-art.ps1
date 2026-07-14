Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'assets\images'
New-Item -ItemType Directory -Force -Path $output | Out-Null

function New-Brush([string]$hex, [int]$alpha = 255) {
  $color = [System.Drawing.ColorTranslator]::FromHtml($hex)
  return [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B))
}

function New-Pen([string]$hex, [float]$width, [int]$alpha = 255) {
  $color = [System.Drawing.ColorTranslator]::FromHtml($hex)
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function New-Graphics([System.Drawing.Bitmap]$bitmap) {
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return $graphics
}

function Add-PaperGrain($graphics, $random, [int]$width, [int]$height, [string]$light, [string]$dark, [int]$count = 5200) {
  $lightBrush = New-Brush $light 14
  $darkBrush = New-Brush $dark 9
  for ($i = 0; $i -lt $count; $i++) {
    $x = $random.Next(0, $width)
    $y = $random.Next(0, $height)
    $size = $random.Next(1, 4)
    $brush = if (($i % 4) -eq 0) { $darkBrush } else { $lightBrush }
    $graphics.FillRectangle($brush, $x, $y, $size, $size)
  }
  $lightBrush.Dispose()
  $darkBrush.Dispose()
}

function Add-TapeStrip($graphics, [float]$x, [float]$y, [float]$width, [float]$height, [float]$angle, [string]$color, [int]$alpha = 150) {
  $state = $graphics.Save()
  $graphics.TranslateTransform($x + $width / 2, $y + $height / 2)
  $graphics.RotateTransform($angle)
  $brush = New-Brush $color $alpha
  $edge = New-Pen '#fffaf0' 3 110
  $graphics.FillRectangle($brush, -$width / 2, -$height / 2, $width, $height)
  $graphics.DrawLine($edge, -$width / 2, -$height / 2, $width / 2, -$height / 2)
  $graphics.DrawLine($edge, -$width / 2, $height / 2, $width / 2, $height / 2)
  $fiber = New-Pen '#29474c' 1 22
  for ($i = -[int]($width / 2) + 12; $i -lt [int]($width / 2); $i += 24) {
    $graphics.DrawLine($fiber, $i, -$height / 2 + 4, $i + 12, $height / 2 - 4)
  }
  $fiber.Dispose(); $edge.Dispose(); $brush.Dispose()
  $graphics.Restore($state)
}

function Add-GraphPaper($graphics, [int]$width, [int]$height, [string]$minorColor, [string]$majorColor) {
  $minor = New-Pen $minorColor 2 45
  $major = New-Pen $majorColor 3 50
  for ($x = 0; $x -le $width; $x += 54) {
    $pen = if (($x % 270) -eq 0) { $major } else { $minor }
    $graphics.DrawLine($pen, $x, 0, $x, $height)
  }
  for ($y = 0; $y -le $height; $y += 54) {
    $pen = if (($y % 270) -eq 0) { $major } else { $minor }
    $graphics.DrawLine($pen, 0, $y, $width, $y)
  }
  $minor.Dispose(); $major.Dispose()
}

function New-HillPath([int]$width, [int]$height, [int]$top, [int]$variant) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.StartFigure()
  if ($variant -eq 1) {
    $path.AddBezier(-70, $top + 130, 170, $top - 90, 360, $top + 170, 570, $top + 30)
    $path.AddBezier(570, $top + 30, 760, $top - 90, 940, $top + 170, $width + 70, $top + 40)
  } else {
    $path.AddBezier(-80, $top + 90, 210, $top - 70, 410, $top + 130, 650, $top + 10)
    $path.AddBezier(650, $top + 10, 820, $top - 70, 980, $top + 90, $width + 80, $top)
  }
  $path.AddLine($width + 80, $top, $width + 80, $height + 80)
  $path.AddLine($width + 80, $height + 80, -80, $height + 80)
  $path.CloseFigure()
  return $path
}

function New-DoodleCloudPath([float]$x, [float]$y, [float]$width, [float]$height) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.StartFigure()
  $path.AddBezier($x, $y + $height * .64, $x, $y + $height * .38, $x + $width * .12, $y + $height * .26, $x + $width * .25, $y + $height * .42)
  $path.AddBezier($x + $width * .25, $y + $height * .42, $x + $width * .30, $y + $height * .04, $x + $width * .55, $y + $height * .02, $x + $width * .63, $y + $height * .36)
  $path.AddBezier($x + $width * .63, $y + $height * .36, $x + $width * .81, $y + $height * .18, $x + $width, $y + $height * .36, $x + $width * .96, $y + $height * .65)
  $path.AddBezier($x + $width * .96, $y + $height * .65, $x + $width * .94, $y + $height * .88, $x + $width * .73, $y + $height * .90, $x + $width * .56, $y + $height * .82)
  $path.AddLine($x + $width * .56, $y + $height * .82, $x + $width * .20, $y + $height * .82)
  $path.AddBezier($x + $width * .20, $y + $height * .82, $x + $width * .08, $y + $height * .87, $x, $y + $height * .77, $x, $y + $height * .64)
  $path.CloseFigure()
  return $path
}

function New-Background([string]$path, [bool]$storm) {
  $width = 1080
  $height = 1920
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = New-Graphics $bitmap
  $random = [System.Random]::new($(if ($storm) { 22147 } else { 10429 }))

  $paperColor = if ($storm) { '#d9e2df' } else { '#fffaf0' }
  $paper = New-Brush $paperColor
  $graphics.FillRectangle($paper, 0, 0, $width, $height)
  $paper.Dispose()
  Add-GraphPaper $graphics $width $height $(if ($storm) { '#668b93' } else { '#83bfd1' }) $(if ($storm) { '#4f727a' } else { '#79c99e' })

  # Keep the top HUD area quiet: decorative layers begin below y=330.
  if ($storm) {
    $wash = New-Brush '#668b93' 78
    $graphics.FillRectangle($wash, 0, 320, $width, 920)
    $wash.Dispose()
    Add-TapeStrip $graphics 100 388 300 86 -6 '#b8cdd0' 154
    Add-TapeStrip $graphics 338 420 360 92 4 '#819fa5' 172
    Add-TapeStrip $graphics 665 370 310 82 -4 '#d7c87b' 154
  } else {
    $wash = New-Brush '#dcefe8' 92
    $graphics.FillRectangle($wash, 0, 320, $width, 910)
    $wash.Dispose()
    Add-TapeStrip $graphics 96 382 316 84 -5 '#83bfd1' 138
    Add-TapeStrip $graphics 344 420 350 90 4 '#fffaf0' 190
    Add-TapeStrip $graphics 662 374 320 82 -3 '#f4d45f' 138
  }

  $cloudInk = New-Pen $(if ($storm) { '#4f727a' } else { '#668b93' }) 4 76
  foreach ($cloud in @(@(100, 500, 280, 112), @(672, 634, 276, 108), @(398, 802, 240, 96))) {
    $cloudPath = New-DoodleCloudPath $cloud[0] $cloud[1] $cloud[2] $cloud[3]
    $cloudBrush = New-Brush $(if ($storm) { '#c8d5d3' } else { '#fffdf7' }) 155
    $graphics.FillPath($cloudBrush, $cloudPath)
    $graphics.DrawPath($cloudInk, $cloudPath)
    $cloudBrush.Dispose(); $cloudPath.Dispose()
  }
  $cloudInk.Dispose()

  if ($storm) {
    $rain = New-Pen '#547983' 5 72
    for ($i = 0; $i -lt 38; $i++) {
      $x = $random.Next(30, $width - 30)
      $y = $random.Next(540, 1190)
      $graphics.DrawLine($rain, $x, $y, $x - 18, $y + 54)
    }
    $rain.Dispose()
  } else {
    $sunTape = New-Brush '#f4d45f' 170
    $graphics.FillRectangle($sunTape, 764, 536, 112, 112)
    $graphics.RotateTransform(4)
    $graphics.ResetTransform()
    $sunTape.Dispose()
  }

  $farPath = New-HillPath $width $height 1080 1
  $farEdge = New-Pen '#fffaf0' 18 230
  $farFill = New-Brush $(if ($storm) { '#789c8d' } else { '#a8d9af' })
  $graphics.FillPath($farFill, $farPath)
  $graphics.DrawPath($farEdge, $farPath)
  $farFill.Dispose(); $farEdge.Dispose(); $farPath.Dispose()

  $nearPath = New-HillPath $width $height 1370 2
  $nearEdge = New-Pen '#fffaf0' 20 235
  $nearFill = New-Brush $(if ($storm) { '#426f68' } else { '#79c99e' })
  $graphics.FillPath($nearFill, $nearPath)
  $graphics.DrawPath($nearEdge, $nearPath)
  $nearFill.Dispose(); $nearEdge.Dispose(); $nearPath.Dispose()

  $stemPen = New-Pen $(if ($storm) { '#29474c' } else { '#4e8e6c' }) 5 160
  $petalColors = if ($storm) { @('#d8c86d', '#a9c6cb', '#eef0df') } else { @('#f4d45f', '#83bfd1', '#fffaf0') }
  for ($i = 0; $i -lt 44; $i++) {
    $x = $random.Next(24, $width - 24)
    $y = $random.Next(1500, $height - 30)
    $graphics.DrawLine($stemPen, $x, $y + 24, $x, $y)
    $petal = New-Brush $petalColors[$i % $petalColors.Count] 220
    $graphics.FillPolygon($petal, @(
      [System.Drawing.Point]::new($x, $y - 12),
      [System.Drawing.Point]::new($x + 12, $y),
      [System.Drawing.Point]::new($x, $y + 12),
      [System.Drawing.Point]::new($x - 12, $y)
    ))
    $petal.Dispose()
  }
  $stemPen.Dispose()

  Add-PaperGrain $graphics $random $width $height '#ffffff' '#29474c' 6800
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Add-CrayonLines($graphics, $random, [int]$cx, [int]$cy, [int]$rx, [int]$ry, [string]$color, [int]$count = 54) {
  $pen = New-Pen $color 3 34
  for ($i = 0; $i -lt $count; $i++) {
    $angle = $random.NextDouble() * [Math]::PI * 2
    $radius = [Math]::Sqrt($random.NextDouble()) * 0.82
    $x = $cx + [Math]::Cos($angle) * $rx * $radius
    $y = $cy + [Math]::Sin($angle) * $ry * $radius
    $graphics.DrawLine($pen, [float]$x - 2, [float]$y, [float]$x + 3, [float]$y + 1)
  }
  $pen.Dispose()
}

function Draw-StickerEllipseBase($graphics, $cutBrush, $cutPen, [float]$x, [float]$y, [float]$width, [float]$height) {
  $graphics.FillEllipse($cutBrush, $x, $y, $width, $height)
  $graphics.DrawEllipse($cutPen, $x, $y, $width, $height)
}

function New-Bunny([string]$path) {
  $bitmap = [System.Drawing.Bitmap]::new(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = New-Graphics $bitmap
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $random = [System.Random]::new(31037)
  $cutBrush = New-Brush '#ffffff'
  $cutPen = New-Pen '#ffffff' 28
  $ink = New-Pen '#29474c' 9
  $fur = New-Brush '#fffaf0'
  $innerEar = New-Brush '#f3b7b0'
  $mint = New-Brush '#79c99e'

  foreach ($shape in @(@(143, 30, 82, 208), @(287, 30, 82, 208), @(152, 312, 208, 148), @(103, 378, 112, 82), @(297, 378, 112, 82), @(82, 168, 348, 222))) {
    Draw-StickerEllipseBase $graphics $cutBrush $cutPen $shape[0] $shape[1] $shape[2] $shape[3]
  }

  $graphics.FillEllipse($fur, 143, 30, 82, 208); $graphics.DrawEllipse($ink, 143, 30, 82, 208)
  $graphics.FillEllipse($fur, 287, 30, 82, 208); $graphics.DrawEllipse($ink, 287, 30, 82, 208)
  $graphics.FillEllipse($innerEar, 165, 57, 38, 142)
  $graphics.FillEllipse($innerEar, 309, 57, 38, 142)
  $graphics.FillEllipse($fur, 152, 312, 208, 148); $graphics.DrawEllipse($ink, 152, 312, 208, 148)
  $graphics.FillEllipse($fur, 103, 378, 112, 82); $graphics.DrawEllipse($ink, 103, 378, 112, 82)
  $graphics.FillEllipse($fur, 297, 378, 112, 82); $graphics.DrawEllipse($ink, 297, 378, 112, 82)
  $graphics.FillEllipse($fur, 82, 168, 348, 222); $graphics.DrawEllipse($ink, 82, 168, 348, 222)

  $graphics.FillEllipse($mint, 129, 347, 254, 44)
  $graphics.DrawEllipse($ink, 129, 347, 254, 44)
  $scarfTail = @([System.Drawing.Point]::new(325, 373), [System.Drawing.Point]::new(390, 419), [System.Drawing.Point]::new(327, 431))
  $graphics.FillPolygon($mint, $scarfTail); $graphics.DrawPolygon($ink, $scarfTail)

  $eyes = New-Brush '#29474c'
  $graphics.FillEllipse($eyes, 169, 233, 27, 35)
  $graphics.FillEllipse($eyes, 316, 233, 27, 35)
  $shine = New-Brush '#ffffff'
  $graphics.FillEllipse($shine, 176, 238, 8, 10); $graphics.FillEllipse($shine, 323, 238, 8, 10)
  $cheek = New-Brush '#ef8f8c' 190
  $graphics.FillEllipse($cheek, 125, 280, 54, 28); $graphics.FillEllipse($cheek, 333, 280, 54, 28)
  $nose = New-Brush '#df777c'
  $graphics.FillEllipse($nose, 245, 275, 22, 16)
  $mouth = New-Pen '#7b5654' 5
  $graphics.DrawArc($mouth, 226, 278, 33, 32, 10, 100); $graphics.DrawArc($mouth, 253, 278, 33, 32, 70, 100)
  Add-CrayonLines $graphics $random 256 256 136 76 '#83bfd1' 48

  $mouth.Dispose(); $nose.Dispose(); $cheek.Dispose(); $shine.Dispose(); $eyes.Dispose()
  $mint.Dispose(); $innerEar.Dispose(); $fur.Dispose(); $ink.Dispose(); $cutPen.Dispose(); $cutBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function New-CloudBearPath() {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.StartFigure()
  $path.AddBezier(47, 235, 31, 184, 68, 142, 119, 146)
  $path.AddBezier(119, 146, 113, 91, 166, 63, 209, 99)
  $path.AddBezier(209, 99, 242, 65, 305, 83, 303, 139)
  $path.AddBezier(303, 139, 353, 146, 371, 202, 338, 239)
  $path.AddBezier(338, 239, 355, 289, 310, 330, 264, 313)
  $path.AddBezier(264, 313, 231, 353, 167, 351, 139, 313)
  $path.AddBezier(139, 313, 88, 337, 39, 293, 47, 235)
  $path.CloseFigure()
  return $path
}

function New-AcornBodyPath() {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.StartFigure()
  $path.AddBezier(192, 102, 118, 108, 77, 185, 101, 260)
  $path.AddBezier(101, 260, 120, 322, 168, 346, 192, 350)
  $path.AddBezier(192, 350, 216, 346, 264, 322, 283, 260)
  $path.AddBezier(283, 260, 307, 185, 266, 108, 192, 102)
  $path.CloseFigure()
  return $path
}

function New-StarPoints([int]$cx, [int]$cy, [int]$outerRadius, [int]$innerRadius) {
  $points = [System.Collections.Generic.List[System.Drawing.Point]]::new()
  for ($i = 0; $i -lt 10; $i++) {
    $radius = if (($i % 2) -eq 0) { $outerRadius } else { $innerRadius }
    $angle = -[Math]::PI / 2 + $i * [Math]::PI / 5
    $points.Add([System.Drawing.Point]::new([int]($cx + [Math]::Cos($angle) * $radius), [int]($cy + [Math]::Sin($angle) * $radius)))
  }
  return $points.ToArray()
}

function New-Enemy([string]$path, [ValidateSet('cloud-bear', 'acorn-mouse', 'star-chick')][string]$kind) {
  $bitmap = [System.Drawing.Bitmap]::new(384, 384, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = New-Graphics $bitmap
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $random = [System.Random]::new($(if ($kind -eq 'cloud-bear') { 41111 } elseif ($kind -eq 'acorn-mouse') { 52223 } else { 63347 }))
  $cutBrush = New-Brush '#ffffff'
  $cutPen = New-Pen '#ffffff' 24
  $ink = New-Pen '#29474c' 8
  $eye = New-Brush '#29474c'
  $shine = New-Brush '#ffffff'

  if ($kind -eq 'cloud-bear') {
    $bodyPath = New-CloudBearPath
    $graphics.FillPath($cutBrush, $bodyPath); $graphics.DrawPath($cutPen, $bodyPath)
    Draw-StickerEllipseBase $graphics $cutBrush $cutPen 90 64 78 78
    Draw-StickerEllipseBase $graphics $cutBrush $cutPen 219 64 78 78
    $body = New-Brush '#efa6a0'
    $graphics.FillEllipse($body, 90, 64, 78, 78); $graphics.DrawEllipse($ink, 90, 64, 78, 78)
    $graphics.FillEllipse($body, 219, 64, 78, 78); $graphics.DrawEllipse($ink, 219, 64, 78, 78)
    $graphics.FillPath($body, $bodyPath); $graphics.DrawPath($ink, $bodyPath)
    $muzzle = New-Brush '#fff0dc'
    $graphics.FillEllipse($muzzle, 136, 200, 112, 80)
    $graphics.DrawEllipse($ink, 136, 200, 112, 80)
    $graphics.FillEllipse($eye, 116, 177, 24, 31); $graphics.FillEllipse($eye, 244, 177, 24, 31)
    $graphics.FillEllipse($shine, 122, 181, 7, 8); $graphics.FillEllipse($shine, 250, 181, 7, 8)
    $nose = New-Brush '#9a6648'; $graphics.FillEllipse($nose, 178, 220, 28, 21)
    $mouth = New-Pen '#9a6648' 5; $graphics.DrawArc($mouth, 157, 232, 35, 28, 8, 105); $graphics.DrawArc($mouth, 192, 232, 35, 28, 68, 105)
    Add-CrayonLines $graphics $random 192 220 126 91 '#9a6648' 42
    $mouth.Dispose(); $nose.Dispose(); $muzzle.Dispose(); $body.Dispose(); $bodyPath.Dispose()
  } elseif ($kind -eq 'acorn-mouse') {
    $bodyPath = New-AcornBodyPath
    Draw-StickerEllipseBase $graphics $cutBrush $cutPen 54 91 104 104
    Draw-StickerEllipseBase $graphics $cutBrush $cutPen 226 91 104 104
    $graphics.FillPath($cutBrush, $bodyPath); $graphics.DrawPath($cutPen, $bodyPath)
    $tailPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $tailPath.AddBezier(272, 249, 356, 219, 350, 310, 302, 315)
    $graphics.DrawPath($cutPen, $tailPath)
    $ear = New-Brush '#83bfd1'
    $graphics.FillEllipse($ear, 54, 91, 104, 104); $graphics.DrawEllipse($ink, 54, 91, 104, 104)
    $graphics.FillEllipse($ear, 226, 91, 104, 104); $graphics.DrawEllipse($ink, 226, 91, 104, 104)
    $earInner = New-Brush '#f0afa8'
    $graphics.FillEllipse($earInner, 78, 116, 56, 56); $graphics.FillEllipse($earInner, 250, 116, 56, 56)
    $body = New-Brush '#b67b55'
    $graphics.FillPath($body, $bodyPath); $graphics.DrawPath($ink, $bodyPath)
    $cap = New-Brush '#8d5a42'
    $capPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $capPath.AddBezier(108, 142, 134, 72, 249, 72, 276, 142)
    $capPath.AddBezier(276, 142, 244, 174, 140, 174, 108, 142)
    $capPath.CloseFigure()
    $graphics.FillPath($cap, $capPath); $graphics.DrawPath($ink, $capPath)
    $graphics.DrawPath($ink, $tailPath)
    $graphics.FillEllipse($eye, 136, 204, 22, 29); $graphics.FillEllipse($eye, 226, 204, 22, 29)
    $graphics.FillEllipse($shine, 141, 208, 7, 8); $graphics.FillEllipse($shine, 231, 208, 7, 8)
    $nose = New-Brush '#ef8f8c'; $graphics.FillEllipse($nose, 181, 235, 22, 17)
    $bow = New-Brush '#83bfd1'
    $graphics.FillEllipse($bow, 132, 276, 68, 46); $graphics.FillEllipse($bow, 184, 276, 68, 46); $graphics.FillEllipse($cap, 178, 286, 28, 28)
    Add-CrayonLines $graphics $random 192 234 74 92 '#f4d45f' 34
    $bow.Dispose(); $nose.Dispose(); $capPath.Dispose(); $cap.Dispose(); $body.Dispose(); $earInner.Dispose(); $ear.Dispose(); $tailPath.Dispose(); $bodyPath.Dispose()
  } else {
    $star = New-StarPoints 192 194 148 78
    $graphics.FillPolygon($cutBrush, $star); $graphics.DrawPolygon($cutPen, $star)
    $coat = New-Brush '#f4d45f'
    $graphics.FillPolygon($coat, $star); $graphics.DrawPolygon($ink, $star)
    $face = New-Brush '#fff1b8'
    $graphics.FillEllipse($face, 115, 119, 154, 154); $graphics.DrawEllipse($ink, 115, 119, 154, 154)
    $wing = New-Brush '#2f7f82'
    $graphics.FillEllipse($wing, 73, 207, 68, 44); $graphics.DrawEllipse($ink, 73, 207, 68, 44)
    $graphics.FillEllipse($wing, 243, 207, 68, 44); $graphics.DrawEllipse($ink, 243, 207, 68, 44)
    $graphics.FillEllipse($eye, 144, 169, 21, 28); $graphics.FillEllipse($eye, 219, 169, 21, 28)
    $graphics.FillEllipse($shine, 149, 173, 7, 8); $graphics.FillEllipse($shine, 224, 173, 7, 8)
    $beak = New-Brush '#e99b48'
    $graphics.FillPolygon($beak, @([System.Drawing.Point]::new(174, 207), [System.Drawing.Point]::new(211, 207), [System.Drawing.Point]::new(192, 226)))
    $cheek = New-Brush '#ef8f8c' 180
    $graphics.FillEllipse($cheek, 121, 202, 38, 20); $graphics.FillEllipse($cheek, 225, 202, 38, 20)
    Add-CrayonLines $graphics $random 192 194 110 112 '#9a6648' 42
    $cheek.Dispose(); $beak.Dispose(); $wing.Dispose(); $face.Dispose(); $coat.Dispose()
  }

  $shine.Dispose(); $eye.Dispose(); $ink.Dispose(); $cutPen.Dispose(); $cutBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

New-Background (Join-Path $output 'notebook-forest-day.png') $false
New-Background (Join-Path $output 'notebook-forest-storm.png') $true
New-Bunny (Join-Path $output 'bunny-sticker.png')
New-Enemy (Join-Path $output 'enemy-cloud-bear.png') 'cloud-bear'
New-Enemy (Join-Path $output 'enemy-acorn-mouse.png') 'acorn-mouse'
New-Enemy (Join-Path $output 'enemy-star-chick.png') 'star-chick'
Write-Output "Generated sticker-forest art assets in $output"
