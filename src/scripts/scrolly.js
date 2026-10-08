// Scroll-linked explanation: as each step scrolls into the reading zone, the matching part of the sticky
// diagram is highlighted. Without JavaScript or IntersectionObserver, the steps simply read as a list.

export function initScrolly(container) {
	const steps = [...container.querySelectorAll("[data-focus]")];
	const diagram = container.querySelector("[data-scrolly-diagram]");
	if (!steps.length || !diagram || !("IntersectionObserver" in window)) return;
	const targets = [...diagram.querySelectorAll("[data-part]")];

	function activate(step) {
		const parts = step.dataset.focus.split(/\s+/);
		for (const target of targets) target.toggleAttribute("data-lit", parts.includes(target.dataset.part));
		for (const other of steps) other.toggleAttribute("data-current", other === step);
		diagram.dataset.focus = step.dataset.focus;
	}

	const observer = new IntersectionObserver((entries) => {
		const entering = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
		if (entering.length) activate(entering[0].target);
	}, {rootMargin: "-42% 0px -42% 0px"});
	steps.forEach((step) => observer.observe(step));
	activate(steps[0]);
}
