// DOM Elements
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const loadingScreen = document.getElementById("loading-screen");
const settingsScreen = document.getElementById("settings-screen");
const startButton = document.getElementById("start-btn");
const questionText = document.getElementById("question-text");
const answersContainer = document.getElementById("answers-container");
const currentQuestionSpan = document.getElementById("current-question");
const totalQuestionsSpan = document.getElementById("total-questions");
const scoreSpan = document.getElementById("score");
const finalScoreSpan = document.getElementById("final-score");
const maxScoreSpan = document.getElementById("max-score");
const resultMessage = document.getElementById("result-message");
const restartButton = document.getElementById("restart-btn");
const progressBar = document.getElementById("progress");

// v2: AI mode elements
const aiForm = document.getElementById("ai-form");
const topicInput = document.getElementById("topic-input");
const difficultySelect = document.getElementById("difficulty-select");
const countSelect = document.getElementById("count-select");
const generateButton = document.getElementById("generate-btn");
const loadingText = document.getElementById("loading-text");
const errorBox = document.getElementById("error-box");
const errorText = document.getElementById("error-text");
const fallbackButton = document.getElementById("fallback-btn");
const modeBadge = document.getElementById("mode-badge");
const explanationBox = document.getElementById("explanation");
const nextButton = document.getElementById("next-btn");
const reviewBox = document.getElementById("review");
const reviewList = document.getElementById("review-list");
const newTopicButton = document.getElementById("new-topic-btn");
const settingsButton = document.getElementById("settings-btn");
const keyInput = document.getElementById("key-input");
const modelInput = document.getElementById("model-input");
const saveSettingsButton = document.getElementById("save-settings-btn");
const clearKeyButton = document.getElementById("clear-key-btn");

// QUIZ STATE VARS
let activeQuestions = classicQuestions; // classic or AI-generated, same shape
let isAIQuiz = false;
let currentQuestionIndex = 0;
let score = 0;
let answersDisabled = false;
let missedQuestions = [];

// event listeners
startButton.addEventListener("click", () => startQuiz(classicQuestions, false));
fallbackButton.addEventListener("click", () => startQuiz(classicQuestions, false));
restartButton.addEventListener("click", restartQuiz);
aiForm.addEventListener("submit", handleGenerate);
nextButton.addEventListener("click", goToNextQuestion);
newTopicButton.addEventListener("click", () => showScreen(startScreen));
settingsButton.addEventListener("click", openSettings);
saveSettingsButton.addEventListener("click", saveSettings);
clearKeyButton.addEventListener("click", clearKey);

// only one screen is visible at a time
function showScreen(screen) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  screen.classList.add("active");
}

function startQuiz(questions, fromAI) {
  activeQuestions = questions;
  isAIQuiz = fromAI;

  // reset vars
  currentQuestionIndex = 0;
  score = 0;
  missedQuestions = [];
  scoreSpan.textContent = 0;
  totalQuestionsSpan.textContent = activeQuestions.length;
  maxScoreSpan.textContent = activeQuestions.length;
  modeBadge.textContent = isAIQuiz ? `AI · ${topicInput.value.trim()}` : "Classic";
  errorBox.hidden = true;

  showScreen(quizScreen);

  showQuestion();
}

function showQuestion() {
  // reset state
  answersDisabled = false;
  explanationBox.hidden = true;
  nextButton.hidden = true;

  const currentQuestion = activeQuestions[currentQuestionIndex];

  currentQuestionSpan.textContent = currentQuestionIndex + 1;

  const progressPercent = (currentQuestionIndex / activeQuestions.length) * 100;
  progressBar.style.width = progressPercent + "%";

  questionText.textContent = currentQuestion.question;

  answersContainer.innerHTML = "";

  currentQuestion.answers.forEach((answer) => {
    const button = document.createElement("button");
    // textContent (not innerHTML) so AI text can never inject HTML
    button.textContent = answer.text;
    button.classList.add("answer-btn");

    // what is dataset? it's a property of the button element that allows you to store custom data
    button.dataset.correct = answer.correct;

    button.addEventListener("click", selectAnswer);

    answersContainer.appendChild(button);
  });
}

function selectAnswer(event) {
  // optimization check
  if (answersDisabled) return;

  answersDisabled = true;

  const selectedButton = event.target;
  const isCorrect = selectedButton.dataset.correct === "true";

  // Here Array.from() is used to convert the NodeList returned by answersContainer.children into an array, this is because the NodeList is not an array and we need to use the forEach method
  Array.from(answersContainer.children).forEach((button) => {
    if (button.dataset.correct === "true") {
      button.classList.add("correct");
    } else if (button === selectedButton) {
      button.classList.add("incorrect");
    }
  });

  const currentQuestion = activeQuestions[currentQuestionIndex];

  if (isCorrect) {
    score++;
    scoreSpan.textContent = score;
  } else {
    missedQuestions.push({
      question: currentQuestion.question,
      answer: currentQuestion.answers.find((a) => a.correct).text,
    });
  }

  // AI questions come with an explanation, so wait for the player to read it
  if (isAIQuiz && currentQuestion.explanation) {
    explanationBox.textContent = currentQuestion.explanation;
    explanationBox.hidden = false;
    nextButton.hidden = false;
    nextButton.focus();
  } else {
    setTimeout(goToNextQuestion, 1000);
  }
}

function goToNextQuestion() {
  currentQuestionIndex++;

  // check if there are more questions or if the quiz is over
  if (currentQuestionIndex < activeQuestions.length) {
    showQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  showScreen(resultScreen);

  finalScoreSpan.textContent = score;

  const percentage = (score / activeQuestions.length) * 100;

  if (percentage === 100) {
    resultMessage.textContent = "Perfect! You're a genius!";
  } else if (percentage >= 80) {
    resultMessage.textContent = "Great job! You know your stuff!";
  } else if (percentage >= 60) {
    resultMessage.textContent = "Good effort! Keep learning!";
  } else if (percentage >= 40) {
    resultMessage.textContent = "Not bad! Try again to improve!";
  } else {
    resultMessage.textContent = "Keep studying! You'll get better!";
  }

  // list the questions the player got wrong, with the right answer
  reviewList.innerHTML = "";
  missedQuestions.forEach((item) => {
    const li = document.createElement("li");
    const q = document.createElement("strong");
    q.textContent = item.question;
    li.append(q, document.createElement("br"), `Answer: ${item.answer}`);
    reviewList.appendChild(li);
  });
  reviewBox.hidden = missedQuestions.length === 0;
  newTopicButton.textContent = isAIQuiz ? "Try another topic" : "Back to menu";
}

function restartQuiz() {
  startQuiz(activeQuestions, isAIQuiz);
}

// ---------- AI mode ----------

async function handleGenerate(event) {
  event.preventDefault();

  const topic = topicInput.value.trim();
  if (!topic) return;

  const settings = loadSettings();
  if (!settings.apiKey) {
    showError("Add your free Gemini API key in Settings (⚙️) to use AI mode.");
    return;
  }

  generateButton.disabled = true;
  loadingText.textContent = `Generating your quiz on "${topic}"…`;
  showScreen(loadingScreen);

  try {
    const questions = await generateQuiz({
      topic,
      difficulty: difficultySelect.value,
      count: Number(countSelect.value),
      apiKey: settings.apiKey,
      model: settings.model,
    });
    startQuiz(questions, true);
  } catch (err) {
    showScreen(startScreen);
    showError(err instanceof QuizAIError ? err.message : "Something went wrong. Please try again.");
    console.error(err);
  } finally {
    generateButton.disabled = false;
  }
}

function showError(message) {
  errorText.textContent = message;
  errorBox.hidden = false;
}

// ---------- Settings (stored only in this browser) ----------

function loadSettings() {
  try {
    return {
      apiKey: localStorage.getItem("geminiApiKey") || "",
      model: localStorage.getItem("geminiModel") || "",
    };
  } catch (err) {
    return { apiKey: "", model: "" };
  }
}

function openSettings() {
  const settings = loadSettings();
  keyInput.value = settings.apiKey;
  modelInput.value = settings.model;
  showScreen(settingsScreen);
}

function saveSettings() {
  try {
    localStorage.setItem("geminiApiKey", keyInput.value.trim());
    localStorage.setItem("geminiModel", modelInput.value.trim());
  } catch (err) {
    // storage blocked (e.g. private mode): nothing else we can do
  }
  errorBox.hidden = true;
  showScreen(startScreen);
}

function clearKey() {
  keyInput.value = "";
  try {
    localStorage.removeItem("geminiApiKey");
  } catch (err) {}
}
