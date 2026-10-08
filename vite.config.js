import {readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import {resolvePlaceholder} from "./site.config.js";
import {highlight} from "./build/highlight.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "src");
const partialsDir = join(root, "partials");
const iconsDir = resolve(root, "../node_modules/lucide-static/icons");

// Every index.html under src/ (except partials) is a page.
function findPages(dir, pages = {}) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (path === partialsDir) continue;
		if (statSync(path).isDirectory()) findPages(path, pages);
		else if (entry.endsWith(".html")) pages[relative(root, path).replace(/\.html$/, "").replace(/\\/g, "/") || "index"] = path;
	}
	return pages;
}

// Custom icons that Lucide does not provide. The GitHub mark is GitHub's own logo (Primer Octicons, MIT).
const customIcons = {
	github: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>`
};

const iconCache = new Map();
function icon(name, extraClass = "") {
	if (!iconCache.has(name)) {
		let svg = customIcons[name];
		if (!svg) {
			svg = readFileSync(join(iconsDir, `${name}.svg`), "utf8")
				.replace(/<!--.*?-->/s, "")
				.replace(/\s*class="[^"]*"/, "")
				.replace(/\s*(width|height)="24"/g, "")
				.replace(/stroke-width="2"/, 'stroke-width="1.75"')
				.replace(/\n\s*/g, " ")
				.trim();
		}
		iconCache.set(name, svg);
	}
	return iconCache.get(name).replace("<svg", `<svg class="icon${extraClass ? ` ${extraClass}` : ""}" aria-hidden="true" focusable="false"`);
}

const escapeAttr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Build-time HTML: partials, icons, placeholders, code highlighting, and the current page in the navigation.
function sitePages() {
	return {
		name: "venora-site-pages",
		transformIndexHtml: {
			order: "pre",
			handler(html) {
				const page = html.match(/<body[^>]*data-page="([^"]+)"/)?.[1] || "";
				// Partials (one level of nesting is enough for this site).
				for (let pass = 0; pass < 2; pass++) {
					html = html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name) => readFileSync(join(partialsDir, `${name}.html`), "utf8"));
				}
				// <i data-icon="name" class="..."></i> becomes an inline SVG.
				html = html.replace(/<i data-icon="([\w-]+)"(?:\s+class="([^"]*)")?\s*><\/i>/g, (_, name, cls) => icon(name, cls));
				// {{ key }} placeholders from site.config.js. Values used inside attributes are escaped.
				html = html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expression) => escapeAttr(resolvePlaceholder(expression)));
				// Code blocks: <pre><code class="language-js">…</code></pre>
				html = html.replace(/<code class="language-(\w+)">([\s\S]*?)<\/code>/g, (_, lang, code) => `<code class="language-${lang}">${highlight(code, lang)}</code>`);
				// Mark the current page in the navigation.
				if (page) html = html.replace(new RegExp(`(<a[^>]*data-nav="${page}")`, "g"), '$1 aria-current="page"');
				return html;
			}
		},
		handleHotUpdate({file, server}) {
			if (file.startsWith(partialsDir) || file.endsWith("site.config.js")) server.ws.send({type: "full-reload"});
		}
	};
}

export default defineConfig({
	root,
	publicDir: resolve(root, "../public"),
	appType: "mpa",
	plugins: [sitePages()],
	build: {
		outDir: resolve(root, "../dist"),
		emptyOutDir: true,
		rollupOptions: {input: findPages(root)}
	}
});
