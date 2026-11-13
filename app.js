"use strict";

const BANK = window.BANK;
const STORE = "enem-d2-study-v1";
const LETTERS = ["A", "B", "C", "D", "E"];

let state = loadState() || { topic: 0, index: 0, answers: {}, crossed: {} };
if (!state.crossed) state.crossed = {};
delete state.out;   // older versions marked the whole question

function loadState() {
    try {
        return JSON.parse(window.localStorage.getItem(STORE));
    } catch (err) {
        return null;  // private mode or a file:// page without storage access
    }
}

function saveState() {
    try {
        window.localStorage.setItem(STORE, JSON.stringify(state));
    } catch (err) {
        // nothing to do: study progress is not available in this browser mode
    }
}

function currentTopic() {
    return BANK.topics[state.topic];
}

function currentQuestion() {
    return currentTopic().questions[state.index];
}

function elem(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function selectionActive() {
    const sel = window.getSelection();
    return !!(sel && !sel.isCollapsed && String(sel).trim());
}

function toggleCross(letter) {
    const question = currentQuestion();
    const crossed = state.crossed[question.id] || (state.crossed[question.id] = {});
    if (crossed[letter]) delete crossed[letter];
    else crossed[letter] = true;
    if (!Object.keys(crossed).length) delete state.crossed[question.id];
    saveState();
    render();
}

function topicScore(topic) {
    let right = 0;
    let done = 0;
    for (const question of topic.questions) {
        const chosen = state.answers[question.id];
        if (chosen && chosen !== "?") {
            done += 1;
            if (chosen === question.answer) right += 1;
        }
    }
    return { right: right, done: done };
}

function renderTopics() {
    const nav = document.getElementById("topics");
    nav.textContent = "";
    let group = null;
    BANK.topics.forEach(function (topic, index) {
        if (topic.discipline !== group) {
            group = topic.discipline;
            nav.appendChild(elem("div", "group", group));
        }
        const button = elem("button", index === state.topic ? "active" : "");
        button.appendChild(elem("span", "", topic.label));
        const score = topicScore(topic);
        const label = score.done ? score.right + "/" + score.done : topic.questions.length + " questões";
        button.appendChild(elem("span", "count", label));
        button.addEventListener("click", function () {
            state.topic = index;
            state.index = 0;
            saveState();
            render();
        });
        nav.appendChild(button);
    });
}

function renderAlternatives(panel, question) {
    const chosen = state.answers[question.id];
    const crossed = state.crossed[question.id] || {};
    const list = elem("ul", "alts");
    LETTERS.forEach(function (letter) {
        const button = elem("button");
        button.appendChild(elem("span", "letter", letter + ")"));
        const tex = question.tex_alternatives && question.tex_alternatives[letter];
        const text = (question.alternatives[letter] || "").trim();
        if (tex) {
            const label = elem("span", "tex-label");
            label.appendChild(renderLatex(tex));
            button.appendChild(label);
        } else {
            button.appendChild(elem("span", text ? "" : "empty", text || "(alternativa na imagem)"));
        }
        if (crossed[letter]) button.classList.add("crossed");
        button.addEventListener("contextmenu", function (event) {
            event.preventDefault();
            toggleCross(letter);
        });
        if (chosen) {
            button.classList.add("locked");
            if (letter === question.answer) button.classList.add("ok");
            else if (letter === chosen) button.classList.add("bad");
        } else {
            button.addEventListener("click", function () {
                if (selectionActive()) return;
                if (!crossed[letter]) answer(letter);
            });
        }
        list.appendChild(button);
    });
    panel.appendChild(list);
}

function renderFeedback(panel, question) {
    const chosen = state.answers[question.id];
    if (!chosen) return;
    const right = chosen === question.answer;
    const box = elem("div", "feedback " + (right ? "ok" : "bad"));
    if (chosen === "?") box.appendChild(elem("h3", "", "Resposta certa: " + question.answer));
    else if (right) box.appendChild(elem("h3", "", "Isso! Resposta certa: " + question.answer));
    else box.appendChild(elem("h3", "", "Você marcou " + chosen + ". Resposta certa: " + question.answer + "."));
    if (question.tex_explanation) {
        const how = elem("div", "how");
        how.appendChild(elem("strong", "", right ? "Como se resolve" : "Como resolver"));
        how.appendChild(elem("div", "tex-steps", ""));
        how.lastChild.appendChild(renderLatex(question.tex_explanation));
        box.appendChild(how);
    } else if (question.explanation) {
        const how = elem("p", "how");
        how.appendChild(elem("strong", "", right ? "Como se resolve" : "Como resolver"));
        how.appendChild(document.createTextNode(question.explanation));
        box.appendChild(how);
    } else {
        box.appendChild(elem("p", "how pending", "Explicação ainda não escrita para esta questão."));
    }
    panel.appendChild(box);
}

function renderImage(panel, question) {
    const images = question.images || [question.image];
    if (question.tex_only) return;   // the transcription covers the whole scan
    const figure = document.createElement("figure");
    images.forEach(function (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Questão " + question.number + " do ENEM " + question.year;
        figure.appendChild(img);
    });
    figure.appendChild(elem("figcaption", "", "ENEM " + question.year + " · questão " + question.number + " · página " + question.page));
    panel.appendChild(figure);
}

function renderNav(panel, question) {
    const questions = currentTopic().questions;
    const nav = elem("div", "nav");
    const prev = elem("button", "", "← Anterior");
    prev.disabled = state.index === 0;
    prev.addEventListener("click", function () {
        if (selectionActive()) return;
        state.index -= 1;
        saveState();
        render();
    });
    const next = elem("button", "", "Próxima →");
    next.disabled = state.index === questions.length - 1;
    next.addEventListener("click", function () {
        if (selectionActive()) return;
        state.index += 1;
        saveState();
        render();
    });
    nav.appendChild(prev);
    nav.appendChild(next);
    nav.appendChild(elem("span", "pos", "Questão " + (state.index + 1) + " de " + questions.length));
    if (!state.answers[question.id]) {
        const reveal = elem("button", "reveal", "Ver resposta");
        reveal.addEventListener("click", function () {
            if (selectionActive()) return;
            state.answers[question.id] = "?";
            saveState();
            render();
        });
        nav.appendChild(reveal);
    }
    const reset = elem("button", "reset", "Zerar acertos");
    reset.addEventListener("click", function () {
        if (!confirm("Apagar todas as suas respostas?")) return;
        state.answers = {};
        saveState();
        render();
    });
    nav.appendChild(reset);
    panel.appendChild(nav);
}

function renderPanel() {
    const panel = document.getElementById("panel");
    const topic = currentTopic();
    const question = currentQuestion();
    panel.textContent = "";

    const meta = elem("div", "meta");
    meta.appendChild(elem("strong", "", topic.label));
    meta.appendChild(elem("span", "", "ENEM " + question.year + " · questão " + question.number + " · " + question.area));
    const score = topicScore(topic);
    meta.appendChild(elem("span", "score", "acertos: " + score.right + "/" + score.done));
    const link = document.createElement("a");
    link.href = "../pdfs/enem_" + question.year + "_d2.pdf#page=" + question.page;
    link.textContent = "abrir a prova";
    link.target = "_blank";
    meta.appendChild(link);
    meta.appendChild(elem("span", "hint", "botão direito risca uma alternativa"));
    panel.appendChild(meta);

    if (question.tex_statement) {
        const body = elem("div", "tex-body");
        body.appendChild(renderLatex(question.tex_statement));
        panel.appendChild(body);
    }
    renderImage(panel, question);  // the precise crop of the question from the exam
    renderAlternatives(panel, question);
    renderFeedback(panel, question);
    renderNav(panel, question);
}

function answer(letter) {
    const question = currentQuestion();
    if (state.answers[question.id]) return;
    if ((state.crossed[question.id] || {})[letter]) return;   // crossed out: not selectable
    state.answers[question.id] = letter;
    saveState();
    render();
}

function renderTotal() {
    const out = document.getElementById("total");
    if (!out) return;
    let right = 0;
    let done = 0;
    const total = BANK.topics.reduce(function (sum, topic) { return sum + topic.questions.length; }, 0);
    for (const topic of BANK.topics) {
        const score = topicScore(topic);
        right += score.right;
        done += score.done;
    }
    out.textContent = "Seu placar: " + right + " acertos em " + done + " respondidas (de " + total + " questões).";
}

function render() {
    renderTopics();
    renderPanel();
    renderTotal();
}

/* ---------- simple calculator: + - * / ( ) % only ---------- */

const CALC_KEYS = [
    { label: "C", action: "clear", cls: "fn" },
    { label: "\u2190", action: "back", cls: "fn", title: "apagar o \u00faltimo caractere" },
    { label: "( )", action: "paren", cls: "fn" },
    { label: "\u00f7", insert: "\u00f7" },
    { label: "7", insert: "7" },
    { label: "8", insert: "8" },
    { label: "9", insert: "9" },
    { label: "\u00d7", insert: "\u00d7" },
    { label: "4", insert: "4" },
    { label: "5", insert: "5" },
    { label: "6", insert: "6" },
    { label: "\u2212", insert: "\u2212" },
    { label: "1", insert: "1" },
    { label: "2", insert: "2" },
    { label: "3", insert: "3" },
    { label: "+", insert: "+" },
    { label: "0", insert: "0", cls: "wide" },
    { label: ",", insert: "," },
    { label: "=", action: "eq", cls: "eq" },
];
let calcDone = false;   // the display holds a result, not an expression

function calcParse(source) {
    const text = source
        .replace(/,/g, ".")
        .replace(/[\u00d7x]/g, "*")
        .replace(/\u00f7/g, "/")
        .replace(/[\u2212\u2013]/g, "-")
        .replace(/\s+/g, "");
    let i = 0;
    const peek = function () { return text.charAt(i); };

    const primary = function () {
        if (peek() === "(") {
            i += 1;
            const value = expression();
            if (peek() !== ")") throw new Error("falta fechar o par\u00eantese");
            i += 1;
            return value;
        }
        if (peek() === "-") {
            i += 1;
            return -primary();
        }
        const start = i;
        while (i < text.length && /[0-9.]/.test(text.charAt(i))) i += 1;
        if (start === i) throw new Error("esperava um n\u00famero");
        const number = parseFloat(text.slice(start, i));
        if (isNaN(number)) throw new Error("n\u00famero inv\u00e1lido");
        return number;
    };

    const term = function () {
        let value = primary();
        while (peek() === "*" || peek() === "/") {
            const operator = text.charAt(i);
            i += 1;
            const right = primary();
            if (operator === "*") value = value * right;
            else if (right === 0) throw new Error("divis\u00e3o por zero");
            else value = value / right;
        }
        return value;
    };

    const expression = function () {
        let value = term();
        while (peek() === "+" || peek() === "-") {
            const operator = text.charAt(i);
            i += 1;
            const right = term();
            value = operator === "+" ? value + right : value - right;
        }
        return value;
    };

    const value = expression();
    if (i < text.length) throw new Error('n\u00e3o entendi "' + text.slice(i) + '"');
    if (!isFinite(value)) throw new Error("resultado inv\u00e1lido");
    return value;
}

function calcFormat(value) {
    return String(Number(value.toPrecision(12))).replace(".", ",");
}

function renderCalculator() {
    const display = document.getElementById("calc-display");
    const keys = document.getElementById("calc-keys");
    if (!display || !keys) return;

    CALC_KEYS.forEach(function (key) {
        const button = elem("button", key.cls || "", key.label);
        button.type = "button";
        if (key.title) button.title = key.title;
        button.addEventListener("click", function () {
            calcPress(key);
        });
        keys.appendChild(button);
    });
    display.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === "=") {
            event.preventDefault();
            calcPress({ action: "eq" });
        }
        if (event.key === "Escape") {
            event.preventDefault();
            calcPress({ action: "clear" });
        }
    });
}

function calcNote(message, error) {
    const note = document.getElementById("calc-note");
    if (!note) return;
    note.className = error ? "note error" : "note";
    note.textContent = message;
}

function calcPress(key) {
    const display = document.getElementById("calc-display");
    if (key.action === "clear") {
        display.value = "";
        calcDone = false;
        calcNote("");
        return;
    }
    if (key.action === "back") {
        display.value = display.value.slice(0, -1);
        calcDone = false;
        return;
    }
    if (key.action === "eq") {
        const expression = display.value.trim();
        if (!expression) return;
        try {
            display.value = calcFormat(calcParse(expression));
            calcNote("");
        } catch (error) {
            calcNote("conta inv\u00e1lida: " + error.message, true);
            calcDone = false;
            return;
        }
        calcDone = true;
        return;
    }
    if (key.action === "paren") {
        const opened = display.value.split("(").length - 1;
        const closed = display.value.split(")").length - 1;
        key = { insert: opened > closed ? ")" : "(" };
    }
    if (calcDone && /^[0-9,(]$/.test(key.insert)) display.value = "";
    display.value += key.insert;
    calcDone = false;
    calcNote("");
}

document.addEventListener("keydown", function (event) {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
    const key = event.key.toUpperCase();
    if (LETTERS.indexOf(key) >= 0) {
        answer(key);
        return;
    }
    if (event.key === "ArrowRight" && state.index < currentTopic().questions.length - 1) {
        state.index += 1;
        saveState();
        render();
    }
    if (event.key === "ArrowLeft" && state.index > 0) {
        state.index -= 1;
        saveState();
        render();
    }
});

renderCalculator();
render();
