// Browser checks for the built site: layout at several widths, the navigation rail and drawer, keyboard use,
// reduced motion, and console errors. Screenshots go to test-results/.
//
//   npm run build && npm run test:browser
//
// Needs a Chromium-based browser. Set CHROME_PATH if it isn't found automatically.

import {existsSync, mkdirSync} from "node:fs";
import {preview} from "vite";
import {chromium} from "playwright-core";

const CANDIDATES = [
	process.env.CHROME_PATH,
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
	"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
	"/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
].filter(Boolean);
const executablePath = CANDIDATES.find((path) => existsSync(path));
if (!executablePath) { console.error("No Chromium-based browser found. Set CHROME_PATH."); process.exit(1); }

const PAGES = ["/", "/install/", "/features/", "/security/", "/developers/", "/roadmap/", "/404.html"];
const WIDTHS = [{name: "desktop", width: 1440, height: 900}, {name: "laptop", width: 1280, height: 800}, {name: "tablet", width: 900, height: 1100}, {name: "phone", width: 390, height: 844}];
const OUT = "test-results";
mkdirSync(OUT, {recursive: true});

let failures = 0;
const check = (ok, message) => { console.log(`${ok ? "  ✓" : "  ✗"} ${message}`); if (!ok) failures++; };

const server = await preview({preview: {port: 4319, strictPort: false}, logLevel: "silent"});
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch({executablePath, headless: true});

try {
	// Layout and console at every width -------------------------------------------------------------------------
	for (const size of WIDTHS) {
		console.log(`\n${size.name} (${size.width}px)`);
		const context = await browser.newContext({viewport: {width: size.width, height: size.height}});
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
		for (const path of PAGES) {
			const response = await page.goto(base + path, {waitUntil: "networkidle"});
			check(response.ok() || path === "/404.html", `${path} loads`);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
			check(overflow <= 0, `${path} has no horizontal overflow (${overflow}px)`);
			const h1 = await page.locator("h1").count();
			check(h1 === 1, `${path} has exactly one h1`);
			// Reveal everything before the screenshot.
			await page.evaluate(() => document.querySelectorAll("[data-reveal], .journey__step").forEach((element) => element.classList.add("is-in")));
			await page.waitForTimeout(900);
			const name = path === "/" ? "home" : path.replace(/\W+/g, "") || "page";
			await page.screenshot({path: `${OUT}/${size.name}-${name}.png`, fullPage: true});
		}
		check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
		await context.close();
	}

	// Rail: collapse, expand, keyboard, tooltip, persistence ----------------------------------------------------
	console.log("\nnavigation rail (desktop)");
	{
		const context = await browser.newContext({viewport: {width: 1440, height: 900}});
		const page = await context.newPage();
		await page.goto(base + "/security/", {waitUntil: "networkidle"});
		const rail = page.locator("#site-nav");
		const toggle = page.locator("[data-rail-toggle]");
		const width = async () => (await rail.boundingBox()).width;
		check(Math.round(await width()) === 68, "starts collapsed at 68px");
		check(await toggle.getAttribute("aria-expanded") === "false", "toggle reports collapsed");
		check(await page.locator('.rail__link[aria-current="page"]').getAttribute("data-nav") === "security", "current page is marked");
		const name = await page.locator('.rail__link[data-nav="install"]').evaluate((link) => link.textContent.trim());
		check(name.includes("Install"), "collapsed links keep their accessible text");

		await page.locator('.rail__link[data-nav="install"]').hover();
		await page.waitForTimeout(400);
		const tipOpacity = await page.locator('.rail__link[data-nav="install"] .rail__tip').evaluate((tip) => getComputedStyle(tip).opacity);
		check(tipOpacity === "1", "tooltip shows on hover while collapsed");
		await page.screenshot({path: `${OUT}/rail-collapsed-tooltip.png`, clip: {x: 0, y: 0, width: 420, height: 520}});

		await toggle.click();
		await page.waitForTimeout(700);
		check(Math.round(await width()) === 236, "expands to 236px");
		check(await toggle.getAttribute("aria-expanded") === "true", "toggle reports expanded");
		const mainLeft = await page.locator(".page").evaluate((element) => element.getBoundingClientRect().left);
		check(Math.round(mainLeft) === 236, "page is pushed, not covered, on wide screens");
		await page.screenshot({path: `${OUT}/rail-expanded.png`, clip: {x: 0, y: 0, width: 900, height: 900}});

		await page.reload({waitUntil: "networkidle"});
		check(Math.round(await width()) === 236, "expanded state persists across pages");

		await page.locator("body").click({position: {x: 900, y: 400}});
		await page.keyboard.press("[");
		await page.waitForTimeout(700);
		check(Math.round(await width()) === 68, "the [ key collapses it");

		// Keyboard: the first Tab on a fresh page reaches the skip link.
		await page.reload({waitUntil: "networkidle"});
		await page.keyboard.press("Tab");
		check(await page.evaluate(() => document.activeElement.classList.contains("skip-link")), "first Tab reaches the skip link");
		await page.keyboard.press("Enter");
		check(await page.evaluate(() => location.hash === "#main"), "skip link jumps to the main content");
		await context.close();
	}

	// Tablet: expanded rail overlays with a scrim; Escape closes ------------------------------------------------
	console.log("\nnavigation rail (tablet)");
	{
		const context = await browser.newContext({viewport: {width: 900, height: 1100}});
		const page = await context.newPage();
		await page.goto(base + "/", {waitUntil: "networkidle"});
		await page.locator("[data-rail-toggle]").click();
		await page.waitForTimeout(600);
		const mainLeft = await page.locator(".page").evaluate((element) => element.getBoundingClientRect().left);
		check(Math.round(mainLeft) === 68, "expanded rail overlays instead of narrowing the page");
		check(await page.locator(".scrim").isVisible(), "scrim is shown");
		await page.keyboard.press("Escape");
		await page.waitForTimeout(600);
		check(await page.locator("[data-rail-toggle]").getAttribute("aria-expanded") === "false", "Escape collapses it");
		await context.close();
	}

	// Phone: drawer ------------------------------------------------------------------------------------------------
	console.log("\nnavigation drawer (phone)");
	{
		const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
		const page = await context.newPage();
		await page.goto(base + "/developers/", {waitUntil: "networkidle"});
		check(await page.locator(".topbar").isVisible(), "top bar is shown");
		check(!(await page.locator("#site-nav").isVisible()), "drawer starts hidden");
		const menu = page.locator("[data-drawer-toggle]");
		await menu.click();
		await page.waitForTimeout(500);
		check(await page.locator("#site-nav").isVisible(), "menu button opens the drawer");
		check(await menu.getAttribute("aria-expanded") === "true", "menu button reports expanded");
		check(await page.evaluate(() => document.activeElement.dataset.nav === "developers"), "focus moves to the current page link");
		check(await page.locator(".page").evaluate((element) => element.inert), "page behind the drawer is inert");
		await page.screenshot({path: `${OUT}/phone-drawer.png`});
		for (let i = 0; i < 14; i++) await page.keyboard.press("Tab");
		check(await page.evaluate(() => Boolean(document.activeElement.closest("#site-nav"))), "Tab stays inside the drawer");
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);
		check(!(await page.locator("#site-nav").isVisible()), "Escape closes the drawer");
		check(await page.evaluate(() => document.activeElement.matches("[data-drawer-toggle]")), "focus returns to the menu button");
		await menu.click();
		await page.waitForTimeout(400);
		await page.locator(".scrim").click({position: {x: 370, y: 400}});
		await page.waitForTimeout(500);
		check(!(await page.locator("#site-nav").isVisible()), "tapping the scrim closes the drawer");
		await context.close();
	}

	// Tabs, flow diagram, reduced motion ------------------------------------------------------------------------
	console.log("\ninteractive components");
	{
		const context = await browser.newContext({viewport: {width: 1440, height: 900}});
		const page = await context.newPage();
		await page.goto(base + "/", {waitUntil: "networkidle"});
		await page.waitForTimeout(4600);
		const states = await page.locator("[data-flow-steps] li").evaluateAll((items) => items.map((item) => item.dataset.state));
		check(states.every((state) => state === "pass"), `flow diagram completes the allowed scenario (${states.join(",")})`);
		await page.locator(".hero").screenshot({path: `${OUT}/hero.png`});
		await page.locator('[data-scenario="1"]').click();
		await page.waitForTimeout(2200);
		check((await page.locator("[data-flow-result]").textContent()).includes("permission_denied"), "denied scenario ends in permission_denied");
		check(await page.locator("[data-flow-pause]").getAttribute("aria-pressed") === "true", "choosing a scenario pauses cycling");

		const jsonTab = page.locator("#tab-json");
		await page.locator("#tab-js").focus();
		await page.keyboard.press("ArrowRight");
		check(await jsonTab.getAttribute("aria-selected") === "true", "arrow keys switch code tabs");
		check(await page.locator("#panel-json").isVisible(), "the selected tab's panel is shown");
		await context.close();

		const reduced = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
		const quiet = await reduced.newPage();
		await quiet.goto(base + "/", {waitUntil: "networkidle"});
		const quietStates = await quiet.locator("[data-flow-steps] li").evaluateAll((items) => items.map((item) => item.dataset.state));
		check(quietStates.every((state) => state === "pass"), "reduced motion: diagram shows its final state immediately");
		check(!(await quiet.locator("[data-flow-pause]").isVisible()), "reduced motion: no autoplay control needed");
		const opacity = await quiet.locator("[data-reveal]").first().evaluate((element) => getComputedStyle(element).opacity);
		check(opacity === "1", "reduced motion: content is visible without scroll reveals");
		await reduced.close();
	}

	// Security scrollytelling --------------------------------------------------------------------------------------
	console.log("\nsecurity walk-through");
	{
		const context = await browser.newContext({viewport: {width: 1440, height: 900}});
		const page = await context.newPage();
		await page.goto(base + "/security/", {waitUntil: "networkidle"});
		await page.locator('[data-focus="guard"]').scrollIntoViewIfNeeded();
		await page.evaluate(() => document.querySelector('[data-focus="guard"]').scrollIntoView({block: "center"}));
		await page.waitForTimeout(700);
		check(await page.locator('[data-part="guard"]').evaluate((element) => element.hasAttribute("data-lit")), "scrolling to a step lights its part of the diagram");
		await page.screenshot({path: `${OUT}/security-scrolly.png`});
		await context.close();
	}
} finally {
	await browser.close();
	await new Promise((resolve) => server.httpServer.close(resolve));
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll browser checks passed.");
process.exit(failures ? 1 : 0);
