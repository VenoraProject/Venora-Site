// The navigation rail: collapse/expand on wide screens, a drawer on phones.

const STORAGE_KEY = "venora-rail";
const PHONE = window.matchMedia("(max-width: 767.98px)");
const TABLET = window.matchMedia("(min-width: 768px) and (max-width: 1199.98px)");

export function initRail() {
	const root = document.documentElement;
	const rail = document.getElementById("site-nav");
	if (!rail) return;
	const page = document.querySelector(".page");
	const topbar = document.querySelector(".topbar");
	const scrim = document.querySelector(".scrim");
	const toggle = rail.querySelector("[data-rail-toggle]");
	const toggleLabel = rail.querySelector("[data-rail-toggle-label]");
	const drawerButton = document.querySelector("[data-drawer-toggle]");

	const save = (value) => { try { localStorage.setItem(STORAGE_KEY, value); } catch { /* private mode: keep it per page */ } };

	// Rail (≥ 768px) ------------------------------------------------------------------------------------------
	const isExpanded = () => root.dataset.rail === "expanded";
	function setExpanded(expanded, {persist = true} = {}) {
		if (expanded) root.dataset.rail = "expanded";
		else delete root.dataset.rail;
		toggle.setAttribute("aria-expanded", String(expanded));
		toggleLabel.textContent = expanded ? "Collapse navigation" : "Expand navigation";
		// On tablets the expanded rail overlays the page, so show the scrim to make that clear and clickable.
		showScrim(expanded && TABLET.matches);
		if (persist) save(expanded ? "expanded" : "collapsed");
	}
	toggle.setAttribute("aria-expanded", String(isExpanded()));
	toggleLabel.textContent = isExpanded() ? "Collapse navigation" : "Expand navigation";
	if (isExpanded() && TABLET.matches) showScrim(true);
	toggle.addEventListener("click", () => setExpanded(!isExpanded()));

	// "[" toggles the rail, like many editors' sidebar shortcut. Ignored while typing.
	document.addEventListener("keydown", (event) => {
		if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey || PHONE.matches) return;
		if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
		setExpanded(!isExpanded());
	});

	// Drawer (< 768px) ---------------------------------------------------------------------------------------
	let lastFocus = null;
	const isOpen = () => root.classList.contains("drawer-open");
	function openDrawer() {
		lastFocus = document.activeElement;
		root.classList.add("drawer-open");
		drawerButton.setAttribute("aria-expanded", "true");
		page.inert = true;
		topbar.inert = true;
		showScrim(true);
		(rail.querySelector('[aria-current="page"]') || rail.querySelector("a")).focus({preventScroll: true});
	}
	function closeDrawer({restoreFocus = true} = {}) {
		if (!isOpen()) return;
		root.classList.remove("drawer-open");
		drawerButton.setAttribute("aria-expanded", "false");
		page.inert = false;
		topbar.inert = false;
		showScrim(false);
		if (restoreFocus) (lastFocus && lastFocus !== document.body ? lastFocus : drawerButton).focus({preventScroll: true});
	}
	drawerButton?.addEventListener("click", openDrawer);
	document.querySelectorAll("[data-drawer-close]").forEach((element) => element.addEventListener("click", () => {
		if (isOpen()) closeDrawer();
		else if (TABLET.matches && isExpanded()) setExpanded(false);
	}));

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			if (isOpen()) closeDrawer();
			else if (TABLET.matches && isExpanded()) { setExpanded(false); toggle.focus(); }
			return;
		}
		// Keep focus inside the open drawer.
		if (event.key === "Tab" && isOpen()) {
			const focusable = [...rail.querySelectorAll("a[href], button:not([disabled])")].filter((element) => element.offsetParent !== null);
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
			else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
		}
	});

	// Moving between layouts resets transient states.
	PHONE.addEventListener("change", () => { closeDrawer({restoreFocus: false}); showScrim(false); });
	TABLET.addEventListener("change", () => showScrim(isExpanded() && TABLET.matches));

	// The scrim fades; `hidden` is only set after the fade so it stays out of the way.
	let scrimTimer;
	function showScrim(show) {
		if (!scrim) return;
		clearTimeout(scrimTimer);
		if (show) {
			scrim.hidden = false;
			requestAnimationFrame(() => scrim.classList.add("is-visible"));
		} else {
			scrim.classList.remove("is-visible");
			scrimTimer = setTimeout(() => { scrim.hidden = true; }, 300);
		}
	}
}
