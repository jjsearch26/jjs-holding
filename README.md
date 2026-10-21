# JJS holding page

Published at https://jjs-holding.pages.dev/ from the main branch. No build command; publish repository root.

Portrait mobile screens use the user-approved Austin rooftop film, with its original soundtrack. Desktop uses stabilized Austin landscape footage, the same approved neon sign artwork used for mobile, composited directly into the rooftop view, January 2027, a gentle thirty-second push-in, and muffled traffic with a distant siren.

Both layouts fill the viewport without stretching. Video autoplays muted and loops; Sound on enables audio. Reduced-motion visitors and browsers blocking autoplay can start playback with Play video.

The desktop sign reuses the approved mobile reference artwork, including its neon tube appearance, cool blue-white halo, warm gold rules and launch date. It is not re-generated frame by frame.

The offline renderer is `tools/render-desktop-neon.py`. It accepts the original landscape footage, the approved high-resolution mobile reference artwork, the approved ambience MP3 and an output directory. It requires Python, OpenCV, NumPy and FFmpeg. Site hosting itself needs no Python or build step.
