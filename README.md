# Iris Universe

Iris Universe is a browser-first art experience that matches a user's iris photo to a real nebula image from NASA.

## Live Site

If you want to visit the public site, open:

- [https://iris-universe.com/](https://iris-universe.com/)

This custom domain is the long-term public entry for the project.

The current site includes:

- Single mode: iris-to-nebula matching with narrative, career line, love line, and energy line
- Dual mode: relationship reading with tacit line, attraction line, growth line, and a relationship title
- Pure frontend analysis: iris crop, lightweight browser-side detection, and local matching
- Share-friendly output: 9:16 image cards for mobile sharing

## Project Structure

- `index.html`: app entry
- `js/`: application logic
- `styles/`: site styles
- `data/`: deployable nebula catalog, thumbnails, and result assets
- `image/metadata.json`: source metadata used to maintain the catalog
- `example.jpg`: iris photo example shown on the upload page
- `tools/dedupe_catalog.js`: catalog cleanup utility

`image/raw/` is intentionally ignored from Git so the repository stays lightweight enough for GitHub and static deployment.

## Local Run

```bash
npm run serve
```

Then open:

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/?catalog=full`

## Scripts

- `npm run serve`: start a local static server
- `npm run dedupe`: run the nebula catalog dedupe utility
- `npm run build:fonts`: rebuild the self-hosted font subset files used in production

## Deploy Notes

This repository is structured to work well with static hosting platforms such as Cloudflare Pages or Vercel.

For deployment, the important runtime assets are:

- `index.html`
- `js/`
- `styles/`
- `data/`
- `example.jpg`
