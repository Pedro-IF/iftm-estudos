/* Minimal LaTeX subset renderer, no dependencies.

   text may mix prose and inline math: "Um triângulo de lados $a$ e $b$ ...".
   Only the subset documented in the README is rendered; anything else is shown
   as-is so a bad transcription is visible instead of breaking the page. */
(function () {
    "use strict";

    var SYMBOLS = {
        times: "\u00d7", cdot: "\u22c5", div: "\u00f7", pm: "\u00b1", mp: "\u2213",
        approx: "\u2248", leq: "\u2264", geq: "\u2265", le: "\u2264", ge: "\u2265",
        neq: "\u2260", ne: "\u2260", equiv: "\u2261", sim: "\u223c", propto: "\u221d",
        infty: "\u221e", sum: "\u2211", prod: "\u220f", int: "\u222b",
        rightarrow: "\u2192", to: "\u2192", longrightarrow: "\u27f6", leftarrow: "\u2190",
        Rightarrow: "\u21d2", leftrightarrow: "\u2194", ldots: "\u2026", cdots: "\u22ef",
        angle: "\u2220", triangle: "\u25b3", square: "\u25a1", perp: "\u22a5",
        parallel: "\u2225", cong: "\u2245", cup: "\u222a", cap: "\u2229",
        subset: "\u2282", in: "\u2208", notin: "\u2209", forall: "\u2200",
        exists: "\u2203", therefore: "\u2234", circ: "\u00b0", degree: "\u00b0",
        alpha: "\u03b1", beta: "\u03b2", gamma: "\u03b3", delta: "\u03b4",
        epsilon: "\u03b5", zeta: "\u03b6", eta: "\u03b7", theta: "\u03b8",
        iota: "\u03b9", kappa: "\u03ba", lambda: "\u03bb", mu: "\u03bc",
        nu: "\u03bd", xi: "\u03be", pi: "\u03c0", rho: "\u03c1", sigma: "\u03c3",
        tau: "\u03c4", upsilon: "\u03c5", phi: "\u03c6", chi: "\u03c7",
        psi: "\u03c8", omega: "\u03c9", Delta: "\u0394", Omega: "\u03a9",
        Sigma: "\u03a3", Pi: "\u03a0", Theta: "\u0398", Lambda: "\u039b",
        ast: "\u2217", varphi: "\u03c6", varepsilon: "\u03b5", mid: "\u2223",
        rightleftharpoons: "\u21cc", percent: "%", amp: "&", hash: "#", underscore: "_", dollar: "$",
        "{": "{", "}": "}", "&": "&", "#": "#", "_": "_", "$": "$", "%": "%",
        ",": " ", ";": " ", ":": " ", "!": "", " ": " "
    };
    var UPRIGHT = { sen: "sen", sin: "sen", cos: "cos", tg: "tg", tan: "tg", log: "log",
        ln: "ln", lim: "lim", senh: "senh", cosh: "cosh", max: "max", min: "min", det: "det" };
    var SPACES = { ",": "0.17em", ":": "0.22em", ";": "0.28em", "!": "-0.17em", " ": "0.3em",
        quad: "1em", qquad: "2em" };
    var BLACKBOARD = { R: "\u211d", N: "\u2115", Z: "\u2124", Q: "\u211a", C: "\u2102", P: "\u2119" };

    function escapeHTML(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function tokenize(source) {
        var tokens = [];
        var i = 0;
        while (i < source.length) {
            var ch = source.charAt(i);
            if (ch === "\\") {
                var j = i + 1;
                var name = "";
                if (/[a-zA-Z]/.test(source.charAt(j))) {
                    while (j < source.length && /[a-zA-Z]/.test(source.charAt(j))) {
                        name += source.charAt(j);
                        j += 1;
                    }
                } else {
                    name = source.charAt(j);
                    j += 1;
                }
                tokens.push({ type: "cmd", value: name, pos: i });
                i = j;
                continue;
            }
            if (ch === "{" || ch === "}" || ch === "^" || ch === "_") {
                tokens.push({ type: ch, pos: i });
                i += 1;
                continue;
            }
            if (/\s/.test(ch)) {
                tokens.push({ type: "char", value: " ", pos: i });
                i += 1;
                continue;
            }
            tokens.push({ type: "char", value: ch, pos: i });
            i += 1;
        }
        return tokens;
    }

    function mathToHTML(source) {
        var tokens = tokenize(source);
        var i = 0;

        function unescapeText(raw) {
            return raw.replace(/\\([$%&#_{}])/g, "$1").replace(/[{}]/g, "");
        }

        function readRawGroup() {
            if (!tokens[i] || tokens[i].type !== "{") {
                return "";
            }
            var startPos = tokens[i].pos;
            var depth = 0;
            var endPos = -1;
            while (i < tokens.length) {
                var token = tokens[i];
                i += 1;
                if (token.type === "{") {
                    depth += 1;
                    if (depth === 1) startPos = token.pos;
                } else if (token.type === "}") {
                    depth -= 1;
                    if (depth === 0) {
                        endPos = token.pos;
                        break;
                    }
                }
            }
            if (endPos < 0) return "";
            return unescapeText(source.slice(startPos + 1, endPos));
        }

        function readArgument() {
            if (tokens[i] && tokens[i].type === "{") {
                i += 1;
                var html = sequence("}");
                if (tokens[i] && tokens[i].type === "}") i += 1;
                return html;
            }
            if (tokens[i] && tokens[i].type === "cmd") {
                var name = tokens[i].value;
                i += 1;
                return command(name);
            }
            if (tokens[i] && tokens[i].type === "char") {
                var value = tokens[i].value;
                i += 1;
                return escapeHTML(value === "-" ? "\u2212" : value);
            }
            return "";
        }

        function command(name) {
            if (name === "frac" || name === "dfrac" || name === "tfrac") {
                var numerator = readArgument();
                var denominator = readArgument();
                return '<span class="tex-frac"><span class="tex-frac-num">' + numerator +
                    '</span><span class="tex-frac-den">' + denominator + "</span></span>";
            }
            if (name === "sqrt") {
                var index = "";
                if (tokens[i] && tokens[i].type === "char" && tokens[i].value === "[") {
                    i += 1;
                    var parts = "";
                    while (i < tokens.length && !(tokens[i].type === "char" && tokens[i].value === "]")) {
                        if (tokens[i].type === "char") parts += tokens[i].value;
                        if (tokens[i].type === "cmd") parts += (SYMBOLS[tokens[i].value] || tokens[i].value);
                        i += 1;
                    }
                    i += 1;
                    index = '<span class="tex-sqrt-index">' + escapeHTML(parts) + "</span>";
                }
                return '<span class="tex-sqrt">' + index + '<span class="tex-sqrt-sign">\u221a</span>' +
                    '<span class="tex-sqrt-body">' + readArgument() + "</span></span>";
            }
            if (name === "multicolumn") {
                readArgument();
                readArgument();
                return readArgument();
            }
            if (name === "textbf") {
                return "<b>" + escapeHTML(readRawGroup()) + "</b>";
            }
            if (name === "colon") {
                return ":";
            }
            if (name === "text" || name === "mathrm" || name === "textrm" || name === "textnormal") {
                return '<span class="tex-text">' + escapeHTML(readRawGroup()) + "</span>";
            }
            if (name === "mathbb") {
                var letter = readRawGroup().trim();
                return BLACKBOARD[letter] || escapeHTML(letter);
            }
            if (name === "overline" || name === "bar") {
                return '<span class="tex-overline">' + readArgument() + "</span>";
            }
            if (name === "binom") {
                var top = readArgument();
                var bottom = readArgument();
                return '<span class="tex-binom">(</span><span class="tex-binom-stack">' +
                    '<span class="tex-binom-top">' + top + "</span>" +
                    '<span class="tex-binom-bottom">' + bottom + "</span></span>" +
                    '<span class="tex-binom">)</span>';
            }
            if (name === "widehat" || name === "hat" || name === "acute" || name === "mathring") {
                var accent = { widehat: "\u0302", hat: "\u0302", acute: "\u0301",
                               mathring: "\u030a" }[name];
                return "<span>" + readArgument() + accent + "</span>";
            }
            if (name === "vec") {
                return "<span>" + readArgument() + "\u20d7</span>";
            }
            if (name === "left" || name === "right" || name === "displaystyle" || name === "limits") {
                return "";
            }
            if (SPACES[name] !== undefined) {
                return '<span class="tex-sp" style="width:' + SPACES[name] + '"></span>';
            }
            if (UPRIGHT[name]) {
                return '<span class="tex-op">' + UPRIGHT[name] + "</span>";
            }
            if (SYMBOLS[name] !== undefined) {
                return escapeHTML(SYMBOLS[name]);
            }
            return '<span class="tex-unknown">\\' + escapeHTML(name) + "</span>";
        }

        function sequence(stop) {
            var parts = [];
            while (i < tokens.length) {
                var token = tokens[i];
                if (token.type === "}" && stop === "}") break;
                if (token.type === "^" || token.type === "_") {
                    i += 1;
                    var argument = readArgument();
                    var base = parts.pop() || "";
                    var tag = token.type === "^" ? "sup" : "sub";
                    parts.push(base + "<" + tag + ">" + argument + "</" + tag + ">");
                    continue;
                }
                if (token.type === "cmd") {
                    i += 1;
                    parts.push(command(token.value));
                    continue;
                }
                if (token.type === "{") {
                    i += 1;
                    parts.push(sequence("}"));
                    if (tokens[i] && tokens[i].type === "}") i += 1;
                    continue;
                }
                i += 1;
                if (token.type === "char") {
                    parts.push(escapeHTML(token.value === "-" ? "\u2212" : token.value));
                }
            }
            return parts.join("");
        }

        return sequence("");
    }

    function appendPlain(fragment, text) {
        var lines = String(text).replace(/\\([%$&#_{}])/g, "$1").split("\n");
        lines.forEach(function (line, lineIndex) {
            if (lineIndex > 0) fragment.appendChild(document.createElement("br"));
            var pieces = line.split(/(\[figura\]|\[tabela\])/i);
            pieces.forEach(function (piece) {
                if (!piece) return;
                var token = /^\[(figura|tabela)\]$/i.exec(piece);
                if (token) {
                    var badge = document.createElement("span");
                    badge.className = "tex-figure";
                    badge.textContent = token[1].toLowerCase() === "figura" ? "figura \u2193" : "tabela \u2193";
                    fragment.appendChild(badge);
                    return;
                }
                fragment.appendChild(document.createTextNode(piece));
            });
        });
    }

    var TABLE_ENVS = ["tabular", "array", "pmatrix", "bmatrix", "matrix"];

    function splitMath(text) {
        var parts = [];
        var current = "";
        var inMath = false;
        var tableDepth = 0;
        var pendingDisplay = false;
        for (var i = 0; i < text.length; i += 1) {
            var ch = text.charAt(i);
            if (inMath && text.substr(i, 6) === "\\begin") {
                var close = text.indexOf("}", i);
                if (close > i && TABLE_ENVS.indexOf(text.slice(i + 7, close)) >= 0) {
                    tableDepth += 1;
                }
            } else if (inMath && text.substr(i, 4) === "\\end") {
                var closeEnd = text.indexOf("}", i);
                if (closeEnd > i && TABLE_ENVS.indexOf(text.slice(i + 5, closeEnd)) >= 0) {
                    tableDepth -= 1;
                }
            }
            if (ch !== "$") {
                current += ch;
                continue;
            }
            if (tableDepth > 0) {
                current += ch;           // $30$ inside a table cell is inner math
                continue;
            }
            var previous = text.charAt(i - 1);
            var previousTwo = text.slice(Math.max(0, i - 2), i);
            if (previous === "\\") {
                current += "$";          // escaped: R\$ 50,00 is a literal dollar
                continue;
            }
            if (!inMath && (previous === "R" || previousTwo === "US")) {
                current += "$";          // currency: R$ 50,00
                continue;
            }
            var display = inMath ? pendingDisplay
                : (/\n\s*$/.test(current) && current.trim() !== "");
            pendingDisplay = false;
            parts.push({ math: inMath, text: current, display: display });
            if (!inMath) pendingDisplay = display;
            current = "";
            inMath = !inMath;
        }
        parts.push({ math: inMath, text: current });
        return parts;
    }

    function buildTabular(body, spec) {
        var table = document.createElement("table");
        table.className = "tex-tabular";
        var aligns = [];
        (spec || "").replace(/[lcr]/g, function (ch) { aligns.push(ch); });
        var rows = body.split(/\\\\/);
        rows.forEach(function (row) {
            if (!row.trim()) return;
            var tr = document.createElement("tr");
            row.split("&").forEach(function (cell, i) {
                var trimmed = cell.trim();
                if (/^\$[^$]*\$$/.test(trimmed)) cell = trimmed.slice(1, -1);
                var td = document.createElement("td");
                if (aligns[i] === "c") td.style.textAlign = "center";
                else if (aligns[i] === "r") td.style.textAlign = "right";
                td.innerHTML = mathToHTML(cell);
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
        return table;
    }

    var LIST_ENVS = { itemize: "ul", enumerate: "ol" };

    function renderList(env, body, fragment) {
        var list = document.createElement(LIST_ENVS[env]);
        list.className = "tex-list";
        body.split(/\\item\b/).slice(1).forEach(function (item) {
            var li = document.createElement("li");
            li.appendChild(renderLatex(item.replace(/^\s*\[\w*\]\s*/, "")));
            list.appendChild(li);
        });
        fragment.appendChild(list);
    }

    function renderLatex(text) {
        var fragment = document.createDocumentFragment();
        if (!text) return fragment;
        var listMatch = /\\begin\{(itemize|enumerate)\}/.exec(String(text));
        if (listMatch) {
            var env = listMatch[1];
            var end = String(text).indexOf("\\end{" + env + "}");
            if (end >= 0) {
                var before = String(text).slice(0, listMatch.index);
                var body = String(text).slice(listMatch.index + ("\\begin{" + env + "}").length, end);
                var after = String(text).slice(end + ("\\end{" + env + "}").length);
                if (before.trim()) fragment.appendChild(renderLatex(before.replace(/\n+$/, "")));
                renderList(env, body, fragment);
                if (after.trim()) fragment.appendChild(renderLatex(after.replace(/^\n+/, "")));
                return fragment;
            }
        }
        var parts = splitMath(String(text));
        parts.forEach(function (part, idx) {
            if (!part.math) return;
            var isBlock = part.display ||
                /^\s*\\begin\{(tabular|array|pmatrix|bmatrix|matrix)\}/.test(part.text);
            if (!isBlock) return;
            var prev = parts[idx - 1];
            if (prev && !prev.math) prev.text = prev.text.replace(/\n+$/, "");
            var next = parts[idx + 1];
            if (next && !next.math) next.text = next.text.replace(/^\n+/, "");
        });
        parts.forEach(function (part, idx, parts) {
            if (part.math) {
                var table = /^\s*\\begin\{(tabular|array)\}/.exec(part.text);
                var matrix = /^\s*\\begin\{(pmatrix|bmatrix|matrix)\}/.exec(part.text);
                var tail = "";
                var next = parts[idx + 1];
                if (part.display && next && !next.math && /^\s*[,.:;]/.test(next.text)) {
                    tail = next.text.match(/^\s*[,.:;]+/)[0].trim();
                    next.text = next.text.replace(/^\s*[,.:;]+/, "");
                }
                if (table) {
                    var body = part.text.replace(/^\s*\\begin\{(?:tabular|array)\}\{([^}]*)\}/, "")
                                        .replace(/\\end\{(?:tabular|array)\}\s*$/, "")
                                        .replace(/\\hline/g, "");
                    fragment.appendChild(buildTabular(body, RegExp.$1));
                } else if (matrix) {
                    var wrap = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], matrix: ["", ""] }[matrix[1]];
                    var mbody = part.text.replace(/^\s*\\begin\{(?:pmatrix|bmatrix|matrix)\}/, "")
                                         .replace(/\\end\{(?:pmatrix|bmatrix|matrix)\}\s*$/, "");
                    var holder = document.createElement("span");
                    holder.className = "tex-matrix";
                    if (wrap[0]) holder.appendChild(document.createTextNode(wrap[0]));
                    holder.appendChild(buildTabular(mbody, ""));
                    if (wrap[1]) holder.appendChild(document.createTextNode(wrap[1]));
                    fragment.appendChild(holder);
                } else {
                    var span = document.createElement("span");
                    span.className = "tex";
                    span.innerHTML = mathToHTML(part.text);
                    if (part.display) {
                        var block = document.createElement("div");
                        block.className = "tex-display";
                        block.appendChild(span);
                        if (tail) block.appendChild(document.createTextNode(tail));
                        fragment.appendChild(block);
                    } else {
                        fragment.appendChild(span);
                    }
                }
            } else if (part.text) {
                appendPlain(fragment, part.text);
            }
        });
        return fragment;
    }

    window.renderLatex = renderLatex;
    window.renderLatexHTML = function (text) {
        var box = document.createElement("div");
        box.appendChild(renderLatex(text));
        return box.innerHTML;
    };
})();
