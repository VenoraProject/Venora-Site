// Facts the website states about Venora, kept in one place.
//
// Every value here was checked against the Venora repository (venora-chrome/manifest.json, docs/, and the runtime
// source). When Venora changes, update this file first; pages read these values through {{ key }} placeholders, so a
// version bump or a new phase does not mean hunting through HTML.

export const site = {
	// Venora itself
	venoraVersion: "0.1.0", // venora-chrome/manifest.json "version"
	apiVersion: "1", // SUPPORTED_API_VERSIONS in venora-chrome/plugin-compatibility.js
	phase: "Phase 3", // Current development phase
	phaseDetail: "3.4", // Latest completed sub-phase (docs/plugin-api-status.md)
	fermoUrl: "https://fermo.sbar.fyi",
	fermoHost: "fermo.sbar.fyi",

	// Links. repoUrl is Venora itself (extension, plugin API, runtime, docs); siteRepoUrl is this website's source.
	repoUrl: "https://github.com/VenoraProject/Venora",
	siteRepoUrl: "https://github.com/VenoraProject/Venora-Site",
	repoBranch: "main",
	get docsUrl() { return `${this.repoUrl}/tree/${this.repoBranch}/docs`; },
	get zipUrl() { return `${this.repoUrl}/archive/refs/heads/${this.repoBranch}.zip`; },
	get licenseUrl() { return `${this.repoUrl}/blob/${this.repoBranch}/LICENSE`; },
	doc(name) { return `${this.repoUrl}/blob/${this.repoBranch}/docs/${name}`; },
	file(path) { return `${this.repoUrl}/blob/${this.repoBranch}/${path}`; },
	tree(path) { return `${this.repoUrl}/tree/${this.repoBranch}/${path}`; },

	year: String(new Date().getFullYear())
};

// Placeholders available in HTML as {{ key }}. Functions are exposed as {{ doc:plugin-api.md }} etc.
export function resolvePlaceholder(expression) {
	const [key, arg] = expression.split(/:(.*)/s);
	const value = site[key.trim()];
	if (typeof value === "function") return value.call(site, (arg || "").trim());
	if (value === undefined) throw new Error(`Unknown site placeholder: {{ ${expression} }}`);
	return String(value);
}
