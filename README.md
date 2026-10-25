# JJS holding page

Published at https://jonathanjamessearch.com/ from `main` on Cloudflare Pages. No build command; publish the repository root.

The homepage and four day/night desktop/mobile routes use the approved fixed photographs and navy/gold launch box. Both nighttime layouts use the brighter building signage photograph. The corner monogram is white, framed in gold, with Start a conversation directly underneath. Daytime layouts have no corner logo. The launch box shares the contact button’s bottom edge.

There are no sound controls, audio elements, or playback scripts on the current homepage and these four routes. Legacy media, streaming functions, and archived routes are retained for previously opened pages.

`holding-schedule.js` selects daytime from the visitor’s local 07:00 to 19:00 and nighttime otherwise, with mobile in portrait up to 900px. `holding.js` decodes the selected still before displaying it and responds to orientation, clock, visibility, focus, and connectivity changes. Images do not animate.

The images are enhanced exports from the approved source material, not newly captured native 4K photography. The day mobile image matches the approved review page.

Fixed routes: `/daytime-desktop/`, `/daytime-mobile/`, `/nighttime-desktop/`, `/nighttime-mobile/`. Legacy cropped review routes remain unchanged.

The inquiry form requires name, work email, and message; company is optional. Delivery uses the existing FormSubmit AJAX endpoint for jonathan.mcmanus@jj-search.com, with direct email fallback. Do not submit test inquiries without authorization.

Run `node --test tests/*.test.mjs`.
