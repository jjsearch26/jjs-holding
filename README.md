# JJS holding page

Published at https://jonathanjamessearch.com/ from the main branch on Cloudflare Pages. No build command; publish repository root. The `functions/film/[key].js` Pages Function serves byte ranges for progressive video playback. `_routes.json` limits function invocations to `/film/*`; the remaining files are static assets.

The main holding page automatically selects the approved daytime films from 07:00 up to 19:00, and the approved night-time films from 19:00 until 07:00, using the visitor’s local clock. Portrait mobile screens automatically use the corresponding mobile export; other viewports use desktop. Night-time desktop retains the approved 0.5 playback speed. Both periods retain their existing branding, camera movement, traffic and ambience.

Both layouts fill the viewport without stretching. Video autoplays muted and loops; Sound on enables audio. Every video opts out of picture-in-picture, and the site-wide Permissions Policy disables that feature to suppress browser pop-out controls. Reduced-motion visitors and browsers blocking autoplay can start playback with Play video.

The desktop sign reuses the approved mobile reference artwork, including its neon tube appearance, cool blue-white halo, warm gold rules and launch date. It is not re-generated frame by frame.

The offline renderer is `tools/render-desktop-neon.py`. It accepts the original landscape footage, the approved high-resolution mobile reference artwork, the approved ambience MP3 and an output directory. It requires Python, OpenCV, NumPy and FFmpeg. Site hosting itself needs no Python or build step.

Desktop motion uses texture-based registration refinement to remove noisy rooftop tracking, interpolated source timing, and continuous subpixel logo placement. The camera gradually moves toward the sign and returns to its starting framing so the 30-second loop closes without a framing jump. The approved mobile video remains the portrait source.

## Comparison links

- /daytime-desktop/
- /daytime-mobile/
- /nighttime-desktop/
- /nighttime-mobile/

Each comparison page fixes the requested source regardless of viewport size. All four autoplay muted and loop, with playback, sound and fullscreen controls. Night-time desktop keeps the approved 0.5 playback speed. Original source parts remain in the repository.

All six page routes use the enhanced 4K exports at all times: desktop is 3840 × 2160; daytime mobile is 2160 × 3840; night-time mobile is 2160 × 3836. These enhance the approved lower-resolution footage; they are not native 4K camera recordings. No adaptive quality downgrade is used. Frame rates, film durations and the approved composition are retained. The two very quiet night soundtracks are raised by 30 dB to a measured peak near −10 dBFS, preserving their original fades and avoiding clipping. Daytime audio is unchanged. Playback starts muted until a visitor chooses Sound on.

Films are stored as exact byte parts under `media/`. `film-loader.js` assigns a native `/film/<key>` URL, and the Pages Function streams the requested bytes from those parts without buffering or downloading the complete file before playback. It supports HTTP byte ranges for seeking, HEAD requests and cache validators. `films.json` retains each film’s byte size, part sizes and SHA-256; concatenate its parts in order to recover the exact MP4. `tools/package-holding-film.py` remuxes each reviewed enhanced H.264 master with its approved audio, copies the video bitstream without re-encoding, creates a poster, and packages the parts. Run `node --test tests/film-stream.test.mjs` to check range and stream behavior.

Daytime revision 2 uses the passing vehicles from the original landscape footage before the desktop approach leaves street level. Desktop establishes the street for five seconds and retains the original 29-second zoom. The portrait view keeps the complete rooftop branding on a fixed horizontal centre throughout its approach and uses the full-width street source so the recentered crop has continuous moving footage across its width. The renderer is `tools/render-daytime-street.py`; it uses the original uploaded footage, registered approved daytime atlas and tracking matrices in the authoring workspace. Both outputs are 1080p at 30 fps with the existing ambience.

Each comparison route supports `?layout=full-bleed` and `?layout=framed`, with a visible link to switch between them. Full bleed fills the intended device view and keeps playback controls over the film; framed retains the surrounding navigation, margins and control bar. On landscape screens the mobile full-bleed example uses a portrait preview canvas; it fills the screen on a portrait phone. Both layouts reuse the exact same video export.

## Pre-launch inquiries

Every holding-page and comparison layout shares `contact.css` and `contact.js`. The navy and gold “Start a conversation” button uses text only and stays compact in the bottom-left corner on phones, with a 44px minimum tap height and safe-area spacing. It opens a compact ivory dialog on desktop and a bottom sheet on mobile. The existing video continues to play behind the dialog. Name, work email and inquiry are required; company is optional. The form keeps entered values if a request fails and only displays the approved confirmation after an explicitly successful provider response. Native dialogs provide keyboard focus management and Escape-to-close.

Delivery uses the FormSubmit AJAX endpoint for `jonathan.mcmanus@jj-search.com`, with the visitor’s email in Reply-To and the company in the subject. All variants use the canonical origin as `_url` so a single activation serves the comparison routes. The exact page and film variant accompany each inquiry. A honeypot is included; no visitor data is stored in the repository or browser storage. The first submission requires the recipient to click FormSubmit’s activation email before delivery is enabled. Failure or pending activation displays a direct email fallback rather than a false sent confirmation. This activation must be completed for each new domain before using it for client inquiries.

## Automatic day and night

`holding-schedule.js` selects the film and calculates the next local 07:00 or 19:00 boundary with local calendar arithmetic, including daylight-saving changes. `holding.js` checks at that boundary, on orientation or visibility changes, and once a minute to catch clock/timezone changes. It loads the incoming video’s first frame before replacing the current one and uses a restrained crossfade. Reduced-motion preferences disable the fade and automatic playback. Obsolete video sources are released. Window focus resumes requested playback. Changing the film leaves the inquiry dialog and entered form values intact.

The main page always fills the screen. All four fixed comparison routes now default to full bleed too; the earlier framed examples remain available only through an explicit `?layout=framed` link. Fixed comparison routes continue to show their named film for direct review.

`/transition-preview/` demonstrates the exact two-second day/night crossfade with the original moving videos. It starts in daytime, switches to night once after five seconds, and offers a replay button in either direction. Its preview override is scoped to that page; the main holding page always follows the visitor’s clock.
