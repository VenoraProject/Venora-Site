// Static checks on the built site (run `npm run build` first):
//  - internal links and #anchors resolve;
//  - heading levels don't skip, ids are unique, every page has one h1;
//  - wording that would overclaim (see BANNED) doesn't appear;
//  - optionally, with VENORA_REPO=/path/to/Venora, every linked repository file exists in that checkout and the
//    version in site.config.js matches venora-chrome/manifest.json.

import {existsSync, readFileSync, readdirSync, statSync} from "node:fs";
import {join, relative} from "node:path";
import {site} from "../site.config.js";

const DIST = "dist";
if (!existsSync(DIST)) { console.error("Run `npm run build` first."); process.exit(1); }

let problems = 0;
const fail = (message) => { problems++; console.log(`  ✗ ${message}`); };

const files = [];
(function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) walk(path);
		else if (path.endsWith(".html")) files.push(path);
	}
})(DIST);

const urlFor = (file) => "/" + relative(DIST, file).replace(/index\.html$/, "").replace(/\\/g, "/");
const pages = new Map(files.map((file) => [urlFor(file), readFileSync(file, "utf8")]));
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");

// Phrases the site must never use: absolute security claims, and features Venora does not have.
// The negated mentions the site does use ("no store release yet") don't match these patterns.
const BANNED = [
	/completely (secure|safe)/i, /100\s?% (secure|safe)/i, /fully audited/i, /verified plugins/i, /zero risk/i,
	/military[- ]grade/i, /immune to/i, /can never access your data/i, /never leaves your (device|browser)/i,
	/unhackable/i, /bulletproof/i,
	/chrome web store/i, /firefox add-?ons/i, /download (the )?\.crx/i,
	/\d[\d,.]*\+?\s*(users|downloads|installs|plugins available|stars)\b/i,
	/testimonial/i, /trusted by/i, /join (our|the) discord/i
];

// Repository links must use the two configured repositories, and nothing else on GitHub.
const ALLOWED_GITHUB = [site.repoUrl, site.siteRepoUrl];
let siteRepoLinked = false;

const repoLinks = new Set();

for (const [url, html] of pages) {
	console.log(url);
	const ids = idsOf(html);

	// One h1, no skipped heading levels.
	const levels = [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
	if (levels.filter((level) => level === 1).length !== 1) fail("expected exactly one h1");
	levels.forEach((level, i) => { if (i && level > levels[i - 1] + 1) fail(`heading jumps from h${levels[i - 1]} to h${level}`); });

	// Unique ids.
	const allIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
	for (const id of new Set(allIds.filter((id, i) => allIds.indexOf(id) !== i))) fail(`duplicate id "${id}"`);

	// Links.
	for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
		if (href.includes("github.com") && !ALLOWED_GITHUB.some((allowed) => href === allowed || href.startsWith(`${allowed}/`) || href.startsWith(`${allowed}.git`))) fail(`unexpected repository link ${href}`);
		if (href === site.siteRepoUrl) { siteRepoLinked = true; continue; }
		if (href.startsWith(`${site.repoUrl}/`) || href === site.repoUrl) { repoLinks.add(href); continue; }
		if (/^(https?:|mailto:)/.test(href)) continue;
		const [path, hash] = href.split("#");
		if (path.startsWith("/assets/") || /\.(svg|png|ico|css|js)$/.test(path)) continue;
		const target = path === "" ? url : path;
		if (!pages.has(target)) { fail(`broken link ${href}`); continue; }
		if (hash && !idsOf(pages.get(target)).has(hash)) fail(`missing anchor ${href}`);
	}
	// Every aria-controls / aria-labelledby target exists.
	for (const [, attr, value] of html.matchAll(/\s(aria-controls|aria-labelledby)="([^"]+)"/g)) {
		for (const id of value.split(/\s+/)) if (!ids.has(id)) fail(`${attr} points to missing id "${id}"`);
	}
	// Buttons need an accessible name.
	for (const [button] of html.matchAll(/<button\b[\s\S]*?<\/button>/g)) {
		if (!textOf(button).trim() && !/aria-label=/.test(button)) fail(`button without a name: ${button.slice(0, 80)}`);
	}
	// Images need alt text.
	for (const [img] of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt=/.test(img)) fail(`img without alt: ${img}`);

	const text = textOf(html);
	for (const pattern of BANNED) {
		const match = text.match(pattern);
		if (match) fail(`overclaiming or unsupported wording: "${match[0]}"`);
	}
}

if (!siteRepoLinked) fail(`no page links to the website source (${site.siteRepoUrl})`);
for (const [url, html] of pages) if (!html.includes(`href="${site.siteRepoUrl}"`)) fail(`${url} has no website-source link`);

// Repository links, checked against a local Venora checkout when one is given.
const repo = process.env.VENORA_REPO;
console.log(`\nrepository links (${repoLinks.size})`);
if (repo) {
	for (const href of repoLinks) {
		const match = href.slice(site.repoUrl.length).match(/^\/(?:blob|tree)\/[^/]+\/([^#?]+)/);
		if (!match) continue; // repository root, archive download
		if (!existsSync(join(repo, decodeURIComponent(match[1])))) fail(`${href} → not in ${repo}`);
	}
	const manifest = JSON.parse(readFileSync(join(repo, "venora-chrome/manifest.json"), "utf8"));
	if (manifest.version !== site.venoraVersion) fail(`site.config.js says ${site.venoraVersion}, manifest.json says ${manifest.version}`);
	else console.log(`  ✓ version ${manifest.version} matches venora-chrome/manifest.json`);
} else {
	console.log("  (set VENORA_REPO=/path/to/Venora to check them against a local checkout)");
}

console.log(problems ? `\n${problems} problem(s).` : "\nAll site checks passed.");
process.exit(problems ? 1 : 0);
