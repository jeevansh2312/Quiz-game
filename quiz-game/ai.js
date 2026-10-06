// AI quiz generation with the Google Gemini API.
// The key comes from the user (bring your own key) and is only sent to Google.

const GEMINI_DEFAULT_MODEL = "gemini-flash-latest"; // alias that always points to the current Flash model
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

// Gemini fills in this schema, so the answer is JSON in the same shape as classicQuestions
const quizSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      question: { type: "STRING" },
      answers: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            text: { type: "STRING" },
            correct: { type: "BOOLEAN" },
          },
          required: ["text", "correct"],
        },
      },
      explanation: { type: "STRING" },
    },
    required: ["question", "answers", "explanation"],
  },
};

// Custom error so the UI can show a friendly message for each case
class QuizAIError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // "key" | "rate" | "network" | "format" | "api"
  }
}

function buildPrompt(topic, difficulty, count) {
  return `Create a multiple-choice quiz about "${topic}".
Difficulty: ${difficulty}.
Write exactly ${count} questions.
Rules:
- Each question has exactly 4 answers and exactly 1 of them is correct.
- Wrong answers should be believable, not silly.
- Keep each question under 25 words and each answer under 8 words.
- "explanation" is one short sentence saying why the correct answer is right.
- Facts must be accurate. Do not repeat questions.`;
}

async function generateQuiz({ topic, difficulty, count, apiKey, model }) {
  if (!apiKey) {
    throw new QuizAIError("key", "Add your Gemini API key in Settings first.");
  }

  const body = {
    contents: [{ parts: [{ text: buildPrompt(topic, difficulty, count) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: quizSchema,
      temperature: 0.9, // a bit of variety so the same topic gives new questions
    },
  };

  let response;
  try {
    response = await fetch(`${GEMINI_URL}${encodeURIComponent(model || GEMINI_DEFAULT_MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new QuizAIError("network", "Couldn't reach Gemini. Check your internet connection.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const apiMessage = data?.error?.message || `HTTP ${response.status}`;
    if (response.status === 429) {
      throw new QuizAIError("rate", "Free-tier limit reached. Wait a minute and try again.");
    }
    if (response.status === 401 || response.status === 403 || /api key/i.test(apiMessage)) {
      throw new QuizAIError("key", "Your API key was rejected. Check it in Settings.");
    }
    throw new QuizAIError("api", `Gemini error: ${apiMessage}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new QuizAIError("format", "The AI sent back something that wasn't a quiz. Try again.");
  }

  const questions = validateQuestions(parsed);
  // allow a couple of dropped questions, but not a broken quiz
  if (questions.length < Math.min(3, count)) {
    throw new QuizAIError("format", "The AI made too many invalid questions. Try again or change the topic.");
  }
  return questions.slice(0, count);
}

// Never trust model output blindly: keep only well-formed questions
function validateQuestions(list) {
  if (!Array.isArray(list)) return [];

  return list
    .filter((q) => {
      if (!q || typeof q.question !== "string" || !q.question.trim()) return false;
      if (!Array.isArray(q.answers) || q.answers.length !== 4) return false;
      if (!q.answers.every((a) => a && typeof a.text === "string" && a.text.trim())) return false;
      return q.answers.filter((a) => a.correct === true).length === 1;
    })
    .map((q) => ({
      question: q.question.trim(),
      answers: shuffle(q.answers.map((a) => ({ text: a.text.trim(), correct: a.correct === true }))),
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
    }));
}

// Fisher-Yates shuffle, because models often put the right answer in the same spot
function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
