New-Item -ItemType Directory -Force -Path "img" | Out-Null
Write-Host "Downloading 27 images..."
$wc = New-Object System.Net.WebClient
$urls = @{
    "img/gambit-logo.png" = "https://gambitco.io/wp-content/uploads/2025/01/cropped-Black-logo-no-background.png"
    "img/team-pat.png" = "https://gambitco.io/wp-content/uploads/2025/03/Changemakers-7.png"
    "img/team-ryan.jpg" = "https://gambitco.io/wp-content/uploads/2025/03/1708978948204-4.jpg"
    "img/team-chris.png" = "https://gambitco.io/wp-content/uploads/2025/03/Changemakers-6.png"
    "img/team-sarah.png" = "https://gambitco.io/wp-content/uploads/2025/03/Changemakers-8.png"
    "img/hero-bg.jpg" = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=80"
    "img/worker-ellyn.jpg" = "https://gambitco.io/wp-content/uploads/2025/03/IMG_0931.jpeg"
    "img/ind-parkinsons.jpg" = "https://images.unsplash.com/photo-1594824476967-48c8b964ac31?w=800&q=80"
    "img/ind-chaddict.jpg" = "https://images.squarespace-cdn.com/content/v1/620b19221fdbcc0197b48eb8/75e9758e-a819-4051-86e3-b8459d0ab014/%24%240P3A1720.jpg?format=1500w"
    "img/ind-medical.jpg" = "https://images.unsplash.com/photo-1631815588090-d4bfec5b1b98?w=800&q=80"
    "img/ind-vail.jpg" = "https://www.thesebastianvail.com/wp-content/uploads/2024/09/WEB_LOWRES_timbers_sebastian_aerial_0136_D.jpg"
    "img/ind-caregiver.jpg" = "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&q=80"
    "img/ind-legal.jpg" = "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80"
    "img/ind-finance.jpg" = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80"
    "img/ind-freight.jpg" = "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80"
    "img/ind-amber.jpg" = "https://res.cloudinary.com/ybmedia/image/upload/c_crop,e_improve,h_1125,w_2000,x_0,y_59/c_fill,f_auto,h_900,q_auto,w_1600/v1/m/0/f/0faee739be10a594e873be7ff836dbfdab118e8b/apr-26-2025-talladega-alabama-usa-arca-series.jpg"
    "img/ind-gillis.jpg" = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"
    "img/ind-demi.jpg" = "https://hellodemi.ai/wp-content/uploads/2026/01/iStock-1487231759.jpg"
    "img/ind-askbibi.jpg" = "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80"
    "img/ind-geotab.jpg" = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80"
    "img/cs-chaddict.png" = "https://gambitco.io/wp-content/uploads/2026/01/Chaddict-AskEva-Marie.png"
    "img/cs-askashleigh.png" = "https://gambitco.io/wp-content/uploads/2025/11/Gemini_Generated_Image_wzpcuxwzpcuxwzpc.png"
    "img/cs-geotab.png" = "https://gambitco.io/wp-content/uploads/2025/12/Gemini_Generated_Image_bgabb4bgabb4bgab.png"
    "img/cs-askellyn.png" = "https://gambitco.io/wp-content/uploads/2025/03/Screenshot-2026-01-09-at-9.17.18%20AM.png"
    "img/cs-asktodd.png" = "https://gambitco.io/wp-content/uploads/2025/03/Screenshot-2026-01-08-at-4.12.37%20PM.png"
    "img/cs-askbibi.png" = "https://gambitco.io/wp-content/uploads/2025/03/AskBibi.png"
    "img/article-hpe.png" = "https://gambitco.io/wp-content/uploads/2025/12/HPE-Unleash-AI-announcement.png"
}
$i = 0
foreach ($item in $urls.GetEnumerator()) {
    $i++
    $name = Split-Path $item.Key -Leaf
    Write-Host "  $i/27  $name ... " -NoNewline
    try {
        $wc.DownloadFile($item.Value, $item.Key)
        Write-Host "OK" -ForegroundColor Green
    }
    catch {
        Write-Host "FAILED" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host "Done! Check the img folder." -ForegroundColor Green
Read-Host "Press Enter to close"
