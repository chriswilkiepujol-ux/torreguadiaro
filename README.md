# Seventh Floor — Torreguadiaro, Sotogrande

Scroll-driven sales website for a 130 m² three-bedroom beachfront apartment on the seventh floor in Torreguadiaro (Sotogrande, Cádiz). Built on the same engine as the Dúplex Bernabéu site.

- `index.html`, `style.css`, `main.js` — the page (Lenis smooth scroll + scroll-scrubbed video)
- `scrub/*.mp4` — all-intra H.264 (every frame a keyframe) at 1080p/30fps; `*_720.mp4` served on phones
- `assets/` — poster frames and gallery stills taken from the footage
- `vercel.json` — clean URLs and long cache headers for media

Deployed on Vercel. Push to `main` to redeploy.
