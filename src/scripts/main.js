import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/instrument-sans/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "../styles/base.css";
import "../styles/rail.css";
import "../styles/components.css";
import "../styles/home.css";
import "../styles/pages.css";
import {initRail} from "./rail.js";
import {initFlow} from "./flow.js";
import {initScrolly} from "./scrolly.js";

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

initRail();

// Allow transitions only after the first frame, so the restored rail state doesn't animate on load.
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-anim")));

// Scroll reveals --------------------------------------------------------------------------------------------------
const revealables = document.querySelectorAll("[data-reveal], .journey__step");
if ("IntersectionObserver" in window && !reducedMotion.matches) {
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			entry.target.classList.add("is-in");
			observer.unobserve(entry.target);
		}
	}, {rootMargin: "0px 0px -8% 0px", threshold: 0.08});
	revealables.forEach((element) => observer.observe(element));
} else {
	revealables.forEach((element) => element.classList.add("is-in"));
}

// Hero orbit: a slow turn tied to scroll position (no work when reduced motion is on). ------------------------------
const hero = document.querySelector(".hero");
if (hero && !reducedMotion.matches) {
	let queued = false;
	const update = () => {
		queued = false;
		const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, hero.offsetHeight)));
		hero.style.setProperty("--scroll", progress.toFixed(3));
	};
	window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, {passive: true});
}

// Tabs (WAI-ARIA tabs pattern, automatic activation) ---------------------------------------------------------------
for (const container of document.querySelectorAll("[data-tabs]")) {
	const tabs = [...container.querySelectorAll('[role="tab"]')];
	const select = (tab, focus) => {
		for (const other of tabs) {
			const selected = other === tab;
			other.setAttribute("aria-selected", String(selected));
			other.tabIndex = selected ? 0 : -1;
			document.getElementById(other.getAttribute("aria-controls")).hidden = !selected;
		}
		if (focus) tab.focus();
	};
	tabs.forEach((tab, index) => {
		tab.addEventListener("click", () => select(tab, false));
		tab.addEventListener("keydown", (event) => {
			const keys = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1};
			if (!(event.key in keys)) return;
			event.preventDefault();
			select(tabs[(keys[event.key] + tabs.length) % tabs.length], true);
		});
	});
}

// Copy buttons on code blocks ----------------------------------------------------------------------------------------
const copyIcon = '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
if (navigator.clipboard) {
	for (const block of document.querySelectorAll(".code")) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "code__copy";
		button.innerHTML = `${copyIcon}<span>Copy</span>`;
		const label = button.querySelector("span");
		button.addEventListener("click", async () => {
			const visible = [...block.querySelectorAll("pre")].find((pre) => !pre.closest("[hidden]"));
			if (!visible) return;
			try {
				await navigator.clipboard.writeText(visible.innerText.replace(/^\$ /gm, "").trimEnd());
				label.textContent = "Copied";
				button.dataset.copied = "";
			} catch {
				label.textContent = "Copy failed";
			}
			setTimeout(() => { label.textContent = "Copy"; delete button.dataset.copied; }, 1800);
		});
		(block.querySelector(".code__bar") || block.querySelector(".tabs__list"))?.append(button);
	}
}

// On-this-page navigation: highlight the section being read ----------------------------------------------------------
const tocLinks = [...document.querySelectorAll(".toc a[href^='#']")];
if (tocLinks.length && "IntersectionObserver" in window) {
	const sections = tocLinks.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
	const visible = new Set();
	const spy = new IntersectionObserver((entries) => {
		for (const entry of entries) entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target);
		const current = sections.find((section) => visible.has(section));
		if (!current) return;
		for (const link of tocLinks) link.setAttribute("aria-current", String(link.hash === `#${current.id}`));
	}, {rootMargin: "-20% 0px -60% 0px"});
	sections.forEach((section) => spy.observe(section));
}

document.querySelectorAll("[data-flow]").forEach((figure) => initFlow(figure, reducedMotion));
document.querySelectorAll("[data-scrolly]").forEach((element) => initScrolly(element));
