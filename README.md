# Venora website

The source of the website for [Venora](https://github.com/VenoraProject/Venora), an unofficial, open-source plugin manager and
plugin API for the Fermo web client. Venora is not affiliated with or endorsed by Fermo or Spacebar.

Plain HTML, CSS and JavaScript, built with [Vite](https://vite.dev). There is no framework, and pages ship about 4 kB
of gzipped JavaScript.

## Commands

```bash
npm install
npm run dev            # local server with reload
npm run build          # static site in dist/
npm run preview        # serve dist/
npm run check          # links, anchors, headings, ids, overclaiming wording (after a build)
npm run test:browser   # layout and interaction checks in a real browser (after a build)
```

`npm run check` can also verify every link into the Venora repository against a local checkout, and confirm the
version matches `venora-chrome/manifest.json`:

```bash
VENORA_REPO=../Venora npm run check
```

`npm run test:browser` needs a Chromium-based browser. It looks for Chrome, Edge, Brave or Chromium, or uses
`CHROME_PATH`. It checks every page at four widths for horizontal overflow and console errors, tests the navigation
rail, drawer, keyboard use and reduced motion, and writes screenshots to `test-results/`.

## Structure

```text
site.config.js        Facts the site states about Venora (version, phase, URLs). Update this first.
vite.config.js        Multi-page build plus a small HTML transform (see below)
build/highlight.js    Build-time syntax highlighting for code blocks
src/
  index.html          Home
  install/ features/ security/ developers/ roadmap/   One index.html per page
  404.html
  partials/           head, navigation rail, footer, and the logo mark as an SVG symbol
  scripts/            main.js (entry), rail.js, flow.js (hero diagram), scrolly.js (security walk-through)
  styles/             base (tokens), rail, components, home, pages
public/               favicon and icons (the icons are copied from venora-chrome/icons)
scripts/              check-site.mjs, browser-test.mjs
```

The HTML transform in `vite.config.js` runs at build time:

- `<!-- @include name -->` inserts `src/partials/name.html`;
- `<i data-icon="name"></i>` becomes an inline [Lucide](https://lucide.dev) SVG (or the GitHub mark);
- `{{ key }}` is replaced from `site.config.js`, for example `{{ venoraVersion }}` or `{{ doc:plugin-api.md }}`;
- `<code class="language-js">` blocks are highlighted;
- the link whose `data-nav` matches the page's `<body data-page>` gets `aria-current="page"`.

## Keeping the site accurate

Every product claim on this site was checked against the Venora source, tests and `docs/` at version 0.1.0
(Phase 3.4). When Venora changes:

1. Update `site.config.js` (version, phase, repository URL).
2. Check the pages that quote specifics. The limits, error codes and capability table are in `src/index.html`,
   `src/security/index.html` and `src/developers/index.html`, and come from `docs/plugin-api.md` §5, §8 and §12.
3. Move items on the roadmap page from "Next" or "Later" to "Done" only once they have shipped.
4. Run `npm run build && VENORA_REPO=../Venora npm run check`.

The site deliberately doesn't describe future features (registry, hosted updates, publisher verification,
maintainer badges) as existing. When they ship, add pages for them; the navigation rail has room for more entries.

### Discrepancies noticed in the Venora repository

These were found while writing the site. They are not changed here.

- The README's project checklist leaves "Add plugin creator information and custom CSS support" and "Add RPC support
  and a public Plugin API" unticked, but `author` is shown on plugin cards, plugin CSS is supported, and API v1 is
  documented as complete. Update prompts exist, but automatic updates don't.
- `docs/runtime-architecture.md` lists the plugin-CSS restrictions without the Phase 3.3 rule against quoted strings
  and `@counter-style`, which `docs/plugin-api.md` §5.5 and the code enforce.
- The README's install section is titled "Install in Chrome", while the automated browser test runs in Microsoft Edge
  (Chromium). The site says "Chrome or another Chromium-based browser" and notes where tests run.
- Repository links are set in `site.config.js`: `repoUrl` (`https://github.com/VenoraProject/Venora`) for Venora's
  extension, API, runtime and docs, and `siteRepoUrl` (`https://github.com/VenoraProject/Venora-Site`) for this
  website's source. Neither repository was publicly reachable at the time of writing, so those links, and the
  `git clone` on the install page, only work once they are public. Venora's local checkout still has
  `Belligerently/Venora` as its `origin` remote.

## Privacy

The site has no analytics and sets no cookies. Fonts are self-hosted from Fontsource packages, so no third-party
requests are made. `localStorage` holds one value: whether the navigation rail is expanded.

## Third-party assets

- Icons: [Lucide](https://lucide.dev) (ISC license), inlined at build time. GitHub mark from Primer Octicons (MIT).
- Fonts (SIL Open Font License 1.1): Bricolage Grotesque, Instrument Sans and JetBrains Mono, via Fontsource.
- The Venora mark and icons belong to the Venora project.
