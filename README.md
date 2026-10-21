# JJS holding page

Published at https://jjs-holding.pages.dev/ from the main branch. No build command; publish repository root.

Portrait mobile screens use the user-approved Austin rooftop film, with its original soundtrack. Desktop uses stabilized Austin landscape footage, the same approved neon sign artwork used for mobile, composited directly into the rooftop view, January 2027, a smooth thirty-second zoom loop at 60 frames per second, and muffled traffic with a distant siren.

Both layouts fill the viewport without stretching. Video autoplays muted and loops; Sound on enables audio. Reduced-motion visitors and browsers blocking autoplay can start playback with Play video.

The desktop sign reuses the approved mobile reference artwork, including its neon tube appearance, cool blue-white halo, warm gold rules and launch date. It is not re-generated frame by frame.

The offline renderer is `tools/render-desktop-neon.py`. It accepts the original landscape footage, the approved high-resolution mobile reference artwork, the approved ambience MP3 and an output directory. It requires Python, OpenCV, NumPy and FFmpeg. Site hosting itself needs no Python or build step.

Desktop motion uses texture-based registration refinement to remove noisy rooftop tracking, interpolated source timing, and continuous subpixel logo placement. The camera gradually moves toward the sign and returns to its starting framing so the 30-second loop closes without a framing jump. The approved mobile video remains the portrait source.

## Comparison links

- /daytime-desktop/
- /daytime-mobile/
- /nighttime-desktop/
- /nighttime-mobile/

Each comparison page fixes the requested source regardless of viewport size and contains the complete image without cropping. All four autoplay muted and loop, with playback, sound and fullscreen controls. Night-time desktop keeps the approved 0.5 playback speed. The night-time videos use a restrained full-frame luminance sharpening pass. Mobile uses the original 1080 × 1918 master rather than the earlier 512 × 908 web encode. Original source files remain in the repository.

Films are stored as exact byte parts under `media/` and reassembled into an MP4 Blob by `film-loader.js`. This preserves the complete exported video without an additional compression pass. `films.json` retains each original byte size and SHA-256; concatenate its parts in order to recover the original MP4.
