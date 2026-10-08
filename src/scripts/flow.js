// The hero's request-flow diagram. Each scenario is real API v1 behaviour (docs/plugin-api.md §5, §8, §12):
// the checks run in the documented order, and the first one that fails decides the error.

const c = (text) => `<code>${text}</code>`;

const SCENARIOS = [
	{
		who: "plugin declares <b>ui</b>",
		call: 'await venora.ui.toast({ message: "Saved" })',
		details: {2: `${c("ui.toast")} is in the fixed registry`, 3: `needs ${c("ui")}: declared`, 4: "plain text, at most 200 characters", 5: "5 at once, then 1 every 2 s", 6: "Venora draws the notice in its own UI"},
		failAt: null,
		result: {tone: "ok", code: "null", text: "notice shown; an imported plugin's notice carries its name"}
	},
	{
		who: "plugin declares <b>ui</b> only",
		call: 'await venora.mentions.showAvatar({ mentionId: "m12" })',
		details: {2: `${c("mentions.showAvatar")} is in the registry`, 3: `needs ${c("ui")}, ${c("account")} and ${c("network")}`, 4: "checked only after permissions", 5: "100 at once, then 50/s", 6: "Venora would look up the avatar"},
		failAt: 3,
		result: {tone: "bad", code: "permission_denied", text: "rejected before the payload is even read"}
	},
	{
		who: "plugin declares <b>ui</b> · sixth notice in a burst",
		call: 'await venora.ui.toast({ message: "Hi again" })',
		details: {2: `${c("ui.toast")} is in the fixed registry`, 3: `needs ${c("ui")}: declared`, 4: "plain text, at most 200 characters", 5: "5 at once, then 1 every 2 s: used up", 6: "Venora draws the notice in its own UI"},
		failAt: 5,
		result: {tone: "bad", code: "rate_limited", text: "nothing was done; retry after a delay"}
	},
	{
		who: "plugin declares <b>storage</b> · the user pasted their token into a setting",
		call: 'await venora.settings.get({ key: "label" })',
		details: {2: `${c("settings.get")} is in the registry`, 3: `needs ${c("storage")}: declared`, 4: "a key the plugin declared", 5: "no limit of its own; general limits apply", 6: "reads the user's saved value"},
		failAt: 7,
		result: {tone: "bad", code: "sensitive_data_blocked", text: "the value is withheld, and the token is not logged"}
	}
];

const STEP_MS = 430;
const HOLD_MS = 3200;

export function initFlow(figure, reducedMotion) {
	const steps = [...figure.querySelectorAll("[data-flow-steps] li")];
	const buttons = [...figure.querySelectorAll("[data-scenario]")];
	const pauseButton = figure.querySelector("[data-flow-pause]");
	const pauseLabel = pauseButton.querySelector(".visually-hidden");
	const who = figure.querySelector("[data-flow-who]");
	const call = figure.querySelector("[data-flow-call]");
	const result = figure.querySelector("[data-flow-result]");

	let current = 0;
	let run = 0; // increments to cancel a running animation
	let userPaused = false;
	let hoverPaused = false;
	let visible = false;
	let timer = null;

	const wait = (ms, id) => new Promise((resolve, reject) => {
		timer = setTimeout(() => (id === run ? resolve() : reject(new Error("cancelled"))), ms);
	});

	function setScenario(index) {
		current = index;
		const scenario = SCENARIOS[index];
		buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
		who.innerHTML = scenario.who;
		call.textContent = scenario.call;
		for (const [step, html] of Object.entries(scenario.details)) {
			const detail = figure.querySelector(`[data-flow-detail="${step}"]`);
			if (detail) detail.innerHTML = html;
		}
	}

	function renderResult(scenario) {
		result.dataset.tone = scenario.result.tone;
		result.innerHTML = `<span class="flow__result-label">Result</span>${c(scenario.result.code)}<span>${scenario.result.text}</span>`;
	}

	function renderFinal(scenario) {
		steps.forEach((step, i) => {
			step.dataset.state = scenario.failAt === null || i < scenario.failAt ? "pass" : i === scenario.failAt ? "fail" : "skip";
		});
		renderResult(scenario);
	}

	async function animate(index) {
		const id = ++run;
		clearTimeout(timer);
		setScenario(index);
		const scenario = SCENARIOS[index];
		if (reducedMotion.matches) { renderFinal(scenario); return; }
		steps.forEach((step) => { step.dataset.state = ""; });
		result.dataset.tone = "wait";
		result.innerHTML = `<span class="flow__result-label">Result</span><span>…</span>`;
		try {
			for (let i = 0; i < steps.length; i++) {
				steps[i].dataset.state = "active";
				await wait(STEP_MS, id);
				if (i === scenario.failAt) {
					steps[i].dataset.state = "fail";
					for (let j = i + 1; j < steps.length; j++) steps[j].dataset.state = "skip";
					break;
				}
				steps[i].dataset.state = "pass";
			}
			renderResult(scenario);
			await wait(HOLD_MS, id);
			while (userPaused || hoverPaused || !visible || document.hidden) await wait(400, id);
			animate((index + 1) % SCENARIOS.length);
		} catch { /* cancelled by a newer run */ }
	}

	buttons.forEach((button, i) => button.addEventListener("click", () => {
		// Choosing a scenario means the reader wants to look at it: stop cycling.
		setPaused(true);
		animate(i);
	}));

	function setPaused(paused) {
		userPaused = paused;
		pauseButton.setAttribute("aria-pressed", String(paused));
		pauseLabel.textContent = paused ? "Play the animation" : "Pause the animation";
	}
	pauseButton.addEventListener("click", () => setPaused(!userPaused));

	figure.addEventListener("pointerenter", () => { hoverPaused = true; });
	figure.addEventListener("pointerleave", () => { hoverPaused = false; });
	figure.addEventListener("focusin", () => { hoverPaused = true; });
	figure.addEventListener("focusout", (event) => { if (!figure.contains(event.relatedTarget)) hoverPaused = false; });

	if (reducedMotion.matches) {
		// No automatic cycling; the scenario buttons still switch the static view.
		pauseButton.hidden = true;
		renderFinal(SCENARIOS[0]);
		setScenario(0);
		return;
	}

	const observer = new IntersectionObserver(([entry]) => {
		const wasVisible = visible;
		visible = entry.isIntersecting;
		if (visible && !wasVisible && run === 0) animate(current);
	}, {threshold: 0.25});
	observer.observe(figure);
}
