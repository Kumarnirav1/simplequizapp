// Quiz logic. Questions come from questions.js (the QUESTION_BANK object).
const $ = (id) => document.getElementById(id);
const screens = { start: $("start"), subjects: $("subjects"), quiz: $("quiz"), result: $("result") };
const state = { subject: null, list: [], index: 0, score: 0, answers: [], locked: false };

// The page each screen goes back to (the start page has no previous page)
const BACK_TARGET = { subjects: "start", quiz: "subjects", result: "quiz" };
let backArmed = false, backTimer = null;

function resetBackArm() {
  backArmed = false;
  clearTimeout(backTimer);
  $("backBtn").textContent = "← Back";
}

function show(name) {
  Object.entries(screens).forEach(([key, el]) => { el.hidden = key !== name; });
  $("backBtn").hidden = !BACK_TARGET[name];
  resetBackArm();
}

function goBack() {
  const current = Object.keys(screens).find((k) => !screens[k].hidden);
  // Leaving a quiz that is part-way through loses progress, so ask for a second click
  const inProgress = current === "quiz" && state.answers.length > 0 && state.answers.length < state.list.length;
  if (inProgress && !backArmed) {
    backArmed = true;
    $("backBtn").textContent = "Progress will be lost. Click again to leave";
    backTimer = setTimeout(resetBackArm, 3000);
    return;
  }
  if (current === "result") { show("quiz"); renderQuestion(); }   // back to the last question
  else if (current === "quiz") showSubjects();
  else if (current === "subjects") show("start");
}

// Best scores are saved per subject in the browser
function getBest(key) {
  try { return Number(localStorage.getItem("brainboost-best-" + key)) || 0; } catch (e) { return 0; }
}
function setBest(key, pct) {
  try { localStorage.setItem("brainboost-best-" + key, String(pct)); } catch (e) { /* storage unavailable */ }
}

// Fisher–Yates shuffle (returns a new array)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Subject selection ---------- */
function showSubjects() {
  $("subjectList").replaceChildren(...Object.entries(QUESTION_BANK).map(([key, s]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "subject";
    const text = document.createElement("span");
    const name = document.createElement("span"); name.className = "name"; name.textContent = s.name;
    const desc = document.createElement("span"); desc.className = "desc";
    desc.textContent = s.description;
    text.append(name, desc);
    btn.append(text);
    const best = getBest(key);
    const b = document.createElement("span"); b.className = "best";
    b.textContent = best ? "Best " + best + "%" : s.questions.length + " questions";
    btn.append(b);
    btn.addEventListener("click", () => startQuiz(key));
    return btn;
  }));
  show("subjects");
}

/* ---------- Quiz ---------- */
function startQuiz(key) {
  state.subject = key;
  state.list = shuffle(QUESTION_BANK[key].questions).map((q) => ({
    ...q,
    choices: shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer }))),
  }));
  state.index = 0;
  state.score = 0;
  state.answers = [];
  show("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.list[state.index];
  state.locked = false;
  $("progressText").textContent = "Question " + (state.index + 1) + " of " + state.list.length;
  $("scoreText").textContent = "Score: " + state.score;
  $("barFill").style.width = (state.index / state.list.length) * 100 + "%";
  $("category").textContent = QUESTION_BANK[state.subject].name;
  $("question").textContent = q.question;
  $("feedback").hidden = true;
  $("nextBtn").hidden = true;

  $("options").replaceChildren(...q.choices.map((choice, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opt";
    btn.textContent = (i + 1) + ". " + choice.text;
    btn.addEventListener("click", () => selectAnswer(choice));
    return btn;
  }));

  // Coming back to an already answered question (from the results page)
  const done = state.answers[state.index];
  if (done) { state.locked = true; showAnswered(q, done.pickedIndex); }
}

function selectAnswer(choice) {
  if (state.locked) return;
  state.locked = true;
  const q = state.list[state.index];
  if (choice.correct) state.score++;
  state.answers.push({
    question: q.question, picked: choice.text, pickedIndex: q.choices.indexOf(choice),
    correctText: q.choices.find((c) => c.correct).text, isCorrect: choice.correct,
  });
  showAnswered(q, q.choices.indexOf(choice));
  $("nextBtn").focus();
}

// Shows the correct/wrong colors, explanation and Next button for an answered question
function showAnswered(q, pickedIndex) {
  const buttons = [...$("options").children];
  q.choices.forEach((c, i) => { if (c.correct) buttons[i].classList.add("correct"); });
  if (!q.choices[pickedIndex].correct) buttons[pickedIndex].classList.add("wrong");
  buttons.forEach((b) => (b.disabled = true));

  $("scoreText").textContent = "Score: " + state.score;
  $("feedback").textContent = (q.choices[pickedIndex].correct ? "Correct. " : "Not quite. ") + q.explanation;
  $("feedback").hidden = false;
  $("nextBtn").textContent = state.index === state.list.length - 1 ? "See results" : "Next question";
  $("nextBtn").hidden = false;
}

function next() {
  if (state.index < state.list.length - 1) {
    state.index++;
    renderQuestion();
  } else {
    showResult();
  }
}

/* ---------- Results ---------- */
function showResult() {
  const total = state.list.length;
  const pct = Math.round((state.score / total) * 100);
  const subject = QUESTION_BANK[state.subject];
  show("result");
  $("barFill").style.width = "100%";
  $("resultTitle").textContent = subject.name + " quiz complete";
  $("ring").style.setProperty("--pct", pct);
  $("pct").textContent = pct + "%";
  $("summary").textContent = "You scored " + state.score + " out of " + total;

  let msg;
  if (pct === 100) msg = "Perfect score. Outstanding.";
  else if (pct >= 80) msg = "Excellent work.";
  else if (pct >= 50) msg = "Good result. A little more practice and you’ll ace it.";
  else msg = "Keep going. Review the answers below and try again.";
  $("message").textContent = msg;

  const best = getBest(state.subject);
  if (pct > best) {
    setBest(state.subject, pct);
    $("bestResult").textContent = "New best score for " + subject.name + ".";
  } else {
    $("bestResult").textContent = "Best score for " + subject.name + ": " + best + "%";
  }

  // Answer review
  $("review").replaceChildren(...state.answers.map((a) => {
    const li = document.createElement("li");
    const q = document.createElement("div"); q.className = "q"; q.textContent = a.question;
    const you = document.createElement("div");
    you.className = a.isCorrect ? "good" : "bad";
    you.textContent = "Your answer: " + a.picked + (a.isCorrect ? " (correct)" : " (incorrect)");
    li.append(q, you);
    if (!a.isCorrect) {
      const right = document.createElement("div");
      right.textContent = "Correct answer: " + a.correctText;
      li.append(right);
    }
    return li;
  }));
  $("review").hidden = true;
  $("reviewBtn").textContent = "Review answers";
}

/* ---------- Events ---------- */
$("startBtn").addEventListener("click", showSubjects);
$("backBtn").addEventListener("click", goBack);
$("nextBtn").addEventListener("click", next);
$("againBtn").addEventListener("click", () => startQuiz(state.subject));
$("changeBtn").addEventListener("click", showSubjects);
$("reviewBtn").addEventListener("click", () => {
  const open = $("review").hidden;
  $("review").hidden = !open;
  $("reviewBtn").textContent = open ? "Hide review" : "Review answers";
});

// Keyboard: 1-4 pick an answer, Enter goes to the next question
document.addEventListener("keydown", (e) => {
  if (screens.quiz.hidden) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 4 && !state.locked) {
    const b = $("options").children[n - 1];
    if (b) b.click();
  } else if (e.key === "Enter" && !$("nextBtn").hidden && document.activeElement !== $("nextBtn")) {
    next();
  }
});


// Sample question on the start page
document.querySelectorAll(".try-opts .opt").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".try-opts .opt").forEach((o) => { o.disabled = true; if (o.dataset.correct) o.classList.add("correct"); });
  if (!b.dataset.correct) b.classList.add("wrong");
  $("tryNote").textContent = (b.dataset.correct ? "Correct. " : "Not quite. ") + "The * operator repeats the string first, then + joins the pieces, so you get abab followed by c.";
}));

show("start");
