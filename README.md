# JJS holding page

Published at https://jonathanjamessearch.com/ from `main` on Cloudflare Pages. No build command; publish the repository root.

All day and night pages now show fixed, high-quality images. There is no video element, pan, zoom, loop or image animation on the main page or the six fixed review routes. The closer approved night-time mobile crop is fixed in `still-image.css`; it displays the full 2160 × 3836 image without another video encode or a lower-resolution derivative. The desktop night view retains its approved landscape fit. The bed is hidden. Building signs have no date; the separate “Launching January 2027” message remains visible.

Daytime desktop uses the approved 3840 × 2160 still; daytime mobile uses the approved 2160 × 3840 still. Night uses frame 480 (20 seconds) of the latest approved 2160 × 3836 neon master. These are enhanced assets from compressed source footage, not newly captured native 4K photography. No new detail is invented. Source hashes and verification are retained in `tools/all-still-images-data/`.

`holding-schedule.js` selects daytime from local 07:00 to 19:00 and night-time outside those hours, with the mobile layout on portrait screens up to 900px. `holding.js` loads and decodes the selected image before replacing it and responds to orientation, clock, timezone, visibility and focus changes. Images have no transition. No film or audio downloads on initial load.

Sound remains optional and initially off. `still-image.js` controls sound on the fixed pages. Daytime retains the approved quieter AAC track; night-time audio is copied from the approved film without re-encoding or changing its level. Audio loads only after Sound on and pauses when the page is hidden or sound is switched off.

Fixed review pages:

- `/daytime-desktop/`
- `/daytime-mobile/`
- `/nighttime-desktop/`
- `/nighttime-mobile/`
- `/nighttime-desktop-cropped/` (same still as night-time desktop)
- `/nighttime-mobile-cropped/` (same still as the closer night-time mobile view)

The compact Start a conversation button and existing inquiry forms remain. Name, work email and inquiry are required; company is optional. Delivery uses the existing FormSubmit AJAX endpoint for jonathan.mcmanus@jj-search.com. Keep provider activation and the direct email fallback. Do not submit test inquiries without authorization.

Run `node --test tests/*.test.mjs`. The older video assets and streaming function remain available for previously opened pages and archival previews; current launch pages do not request them.
