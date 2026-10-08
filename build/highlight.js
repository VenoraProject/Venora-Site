// A small build-time syntax highlighter for the few languages this site shows (js, json, bash, text).
// It runs in the Vite HTML transform, so pages ship pre-highlighted markup and no highlighting JavaScript.

const decode = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const encode = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const JS_KEYWORDS = new Set(["export", "default", "async", "await", "const", "let", "var", "return", "if", "else", "for", "of", "in", "new", "try", "catch", "finally", "function", "throw", "typeof", "import", "from"]);
const LITERALS = new Set(["true", "false", "null", "undefined"]);

const RULES = {
	js: [
		["comment", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
		["string", /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/y],
		["number", /\b\d[\d_]*(?:\.\d+)?\b/y],
		["word", /[A-Za-z_$][\w$]*/y],
		["punct", /=>|[{}()[\];,.:?=<>+\-*/!&|]/y]
	],
	json: [
		["key", /"(?:\\.|[^"\\\n])*"(?=\s*:)/y],
		["string", /"(?:\\.|[^"\\\n])*"/y],
		["number", /-?\b\d+(?:\.\d+)?\b/y],
		["word", /[A-Za-z_]+/y],
		["punct", /[{}[\],:]/y]
	],
	bash: [
		["comment", /#[^\n]*/y],
		["string", /"(?:\\.|[^"\\\n])*"|'[^'\n]*'/y],
		["prompt", /^\$ /my],
		["word", /[A-Za-z_][\w.-]*/y]
	]
};

export function highlight(source, lang) {
	const text = decode(source);
	const rules = RULES[lang];
	if (!rules) return encode(text);
	let out = "";
	let index = 0;
	let previousWord = "";
	while (index < text.length) {
		let matched = false;
		for (const [type, pattern] of rules) {
			pattern.lastIndex = index;
			const match = pattern.exec(text);
			if (!match || match[0] === "") continue;
			const value = match[0];
			let cls = type;
			if (type === "word") {
				if (lang === "bash") cls = /^(git|cd|npm|node|ls)$/.test(value) && /(^|\n)\s*(\$ )?$/.test(text.slice(0, index)) ? "fn" : "";
				else if (JS_KEYWORDS.has(value)) cls = "keyword";
				else if (LITERALS.has(value)) cls = "literal";
				else if (value === "venora") cls = "venora";
				else if (text[index + value.length] === "(") cls = "fn";
				else if (previousWord === "." ) cls = "prop";
				else cls = "";
			}
			if (type === "punct") cls = "punct";
			out += cls ? `<span class="tok-${cls}">${encode(value)}</span>` : encode(value);
			previousWord = type === "punct" ? value : type;
			index += value.length;
			matched = true;
			break;
		}
		if (!matched) {
			out += encode(text[index]);
			if (!/\s/.test(text[index])) previousWord = "";
			index++;
		}
	}
	return out;
}
