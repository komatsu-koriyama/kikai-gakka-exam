import { useEffect, useMemo, useState } from "react";
import "./App.css";

const SCORE_RULES = {
  true_false: {
    correct: 0.2,
    wrong: -0.2,
  },
  multiple_choice: {
    correct: 0.4,
    wrong: -0.4,
  },
};

const MOCK_EXAM_RULE = {
  trueFalseCount: 60,
  multipleChoiceCount: 10,
};

const STORAGE_KEY = "kikaiGakkaExamLearningHistory";

const EMPTY_HISTORY = {
  questionStats: {},
  wrongQuestionIds: [],
};

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getCategoryName(question) {
  return question.category || "未設定";
}

function formatTrueFalse(value) {
  if (value === null || value === undefined) return "未回答";
  return value ? "○" : "×";
}

function getQuestionScore(question, isCorrect, isUnanswered) {
  if (isUnanswered) return 0;

  const rule = SCORE_RULES[question.type];

  if (!rule) return 0;

  return isCorrect ? rule.correct : rule.wrong;
}

function getQuestionMaxScore(question) {
  const rule = SCORE_RULES[question.type];

  if (!rule) return 0;

  return rule.correct;
}

function loadLearningHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return EMPTY_HISTORY;
    }

    const parsed = JSON.parse(raw);

    return {
      questionStats: parsed.questionStats ?? {},
      wrongQuestionIds: Array.isArray(parsed.wrongQuestionIds)
        ? parsed.wrongQuestionIds
        : [],
    };
  } catch {
    return EMPTY_HISTORY;
  }
}

function saveLearningHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function formatDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}

function updateHistoryWithResults(currentHistory, results, options = {}) {
  const isReviewMode = options.isReviewMode ?? false;
  const nextHistory = {
    questionStats: { ...currentHistory.questionStats },
    wrongQuestionIds: [...currentHistory.wrongQuestionIds],
  };

  const wrongIdSet = new Set(nextHistory.wrongQuestionIds);

  results.forEach((result) => {
    const questionId = result.questionId;
    const currentStats = nextHistory.questionStats[questionId] ?? {
      attempts: 0,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      lastResult: null,
      consecutiveCorrect: 0,
      lastAnsweredAt: null,
    };

    const lastResult = result.isUnanswered
      ? "unanswered"
      : result.isCorrect
      ? "correct"
      : "wrong";

    const nextStats = {
      ...currentStats,
      attempts: currentStats.attempts + 1,
      correct: currentStats.correct + (result.isCorrect ? 1 : 0),
      wrong:
        currentStats.wrong +
        (!result.isCorrect && !result.isUnanswered ? 1 : 0),
      unanswered: currentStats.unanswered + (result.isUnanswered ? 1 : 0),
      lastResult,
      consecutiveCorrect: result.isCorrect
        ? currentStats.consecutiveCorrect + 1
        : 0,
      lastAnsweredAt: formatDateTime(new Date()),
    };

    nextHistory.questionStats[questionId] = nextStats;

    if (result.isCorrect) {
      if (isReviewMode && nextStats.consecutiveCorrect >= 2) {
        wrongIdSet.delete(questionId);
      }
    } else {
      wrongIdSet.add(questionId);
    }
  });

  nextHistory.wrongQuestionIds = Array.from(wrongIdSet);

  return nextHistory;
}

function buildTrueFalseResult(question, answer) {
  const isCorrect = answer === question.answer;
  const score = getQuestionScore(question, isCorrect, false);

  return {
    questionId: question.id,
    type: question.type,
    selectedAnswer: answer,
    selectedChoiceId: null,
    correctAnswer: question.answer,
    correctChoiceId: null,
    isCorrect,
    isUnanswered: false,
    score,
  };
}

function buildMultipleChoiceResult(question, choiceId) {
  const correctChoice = question.choices.find((choice) => choice.isCorrect);
  const isCorrect = choiceId === correctChoice?.id;
  const score = getQuestionScore(question, isCorrect, false);

  return {
    questionId: question.id,
    type: question.type,
    selectedAnswer: null,
    selectedChoiceId: choiceId,
    correctAnswer: null,
    correctChoiceId: correctChoice?.id ?? "",
    isCorrect,
    isUnanswered: false,
    score,
  };
}

function buildUnansweredResult(question) {
  const correctChoice =
    question.type === "multiple_choice"
      ? question.choices.find((choice) => choice.isCorrect)
      : null;

  return {
    questionId: question.id,
    type: question.type,
    selectedAnswer: null,
    selectedChoiceId: null,
    correctAnswer: question.type === "true_false" ? question.answer : null,
    correctChoiceId: correctChoice?.id ?? null,
    isCorrect: false,
    isUnanswered: true,
    score: 0,
  };
}

function buildMockExamQuestions(trueFalseQuestions, multipleChoiceQuestions) {
  const targetTrueFalseQuestions = trueFalseQuestions.filter(
    (question) => !question.isCalculation
  );
  const targetMultipleChoiceQuestions = multipleChoiceQuestions.filter(
    (question) => !question.isCalculation
  );

  const canBuildFullMockExam =
    targetTrueFalseQuestions.length >= MOCK_EXAM_RULE.trueFalseCount &&
    targetMultipleChoiceQuestions.length >= MOCK_EXAM_RULE.multipleChoiceCount;

  if (canBuildFullMockExam) {
    const selectedTrueFalseQuestions = shuffleArray(
      targetTrueFalseQuestions
    ).slice(0, MOCK_EXAM_RULE.trueFalseCount);

    const selectedMultipleChoiceQuestions = shuffleArray(
      targetMultipleChoiceQuestions
    ).slice(0, MOCK_EXAM_RULE.multipleChoiceCount);

    return {
      questions: shuffleArray([
        ...selectedTrueFalseQuestions,
        ...selectedMultipleChoiceQuestions,
      ]),
      isFullMockExam: true,
    };
  }

  return {
    questions: shuffleArray([
      ...targetTrueFalseQuestions,
      ...targetMultipleChoiceQuestions,
    ]),
    isFullMockExam: false,
  };
}

function countQuestionsByType(questions) {
  return {
    trueFalse: questions.filter((question) => question.type === "true_false")
      .length,
    multipleChoice: questions.filter(
      (question) => question.type === "multiple_choice"
    ).length,
  };
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("menu");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [displayChoices, setDisplayChoices] = useState([]);

  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [mockQuestions, setMockQuestions] = useState([]);
  const [mockAnswerRecords, setMockAnswerRecords] = useState([]);
  const [isFullMockExam, setIsFullMockExam] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [mockReviewQuestions, setMockReviewQuestions] = useState([]);

  const [setupSelectedCategories, setSetupSelectedCategories] = useState([]);
  const [setupQuestionCount, setSetupQuestionCount] = useState("");

  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [learningHistory, setLearningHistory] = useState(loadLearningHistory);

  useEffect(() => {
    fetch("/data/questions.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("questions.json を読み込めませんでした");
        }
        return response.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  const trueFalseQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter((question) => question.type === "true_false");
  }, [data]);

  const multipleChoiceQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter(
      (question) => question.type === "multiple_choice"
    );
  }, [data]);

  const allQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter(
      (question) =>
        question.type === "true_false" || question.type === "multiple_choice"
    );
  }, [data]);

  const targetMockQuestionCount = useMemo(() => {
    return allQuestions.filter((question) => !question.isCalculation).length;
  }, [allQuestions]);

  const wrongQuestions = useMemo(() => {
    if (!allQuestions.length) return [];

    const wrongIdSet = new Set(learningHistory.wrongQuestionIds);

    return allQuestions.filter((question) => wrongIdSet.has(question.id));
  }, [allQuestions, learningHistory]);

  const activeQuestions =
    mode === "true_false" || mode === "multiple_choice"
      ? practiceQuestions
      : mode === "mock_exam"
      ? mockQuestions
      : mode === "wrong_review"
      ? reviewQuestions
      : mode === "mock_exam_review"
      ? mockReviewQuestions
      : [];

  const currentQuestion = activeQuestions[currentIndex];

  const isFinished =
    mode !== "menu" &&
    mode !== "true_false_setup" &&
    mode !== "multiple_choice_setup" &&
    activeQuestions.length > 0 &&
    currentIndex >= activeQuestions.length;

  useEffect(() => {
    if (
      (mode !== "multiple_choice" &&
        mode !== "mock_exam" &&
        mode !== "wrong_review" &&
        mode !== "mock_exam_review") ||
      currentQuestion?.type !== "multiple_choice" ||
      !currentQuestion?.choices
    ) {
      setDisplayChoices([]);
      return;
    }

    if (currentQuestion.shuffleChoices) {
      setDisplayChoices(shuffleArray(currentQuestion.choices));
    } else {
      setDisplayChoices(currentQuestion.choices);
    }
  }, [mode, currentQuestion]);

  useEffect(() => {
    if (isFinished && !finishedAt) {
      setFinishedAt(new Date());
    }
  }, [isFinished, finishedAt]);

  const persistResults = (newResults, targetMode = mode) => {
    const shouldPersist =
      targetMode === "true_false" ||
      targetMode === "multiple_choice" ||
      targetMode === "mock_exam" ||
      targetMode === "wrong_review" ||
      targetMode === "mock_exam_review";

    if (!shouldPersist || newResults.length === 0) return;

    setLearningHistory((prevHistory) => {
      const nextHistory = updateHistoryWithResults(prevHistory, newResults, {
        isReviewMode:
          targetMode === "wrong_review" || targetMode === "mock_exam_review",
      });

      saveLearningHistory(nextHistory);

      return nextHistory;
    });
  };

  const resetPracticeState = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setSelectedChoiceId(null);
    setIsAnswered(false);
    setResults([]);
    setDisplayChoices([]);
    setStartedAt(null);
    setFinishedAt(null);
  };

  const resetSetupState = () => {
    setSetupSelectedCategories([]);
    setSetupQuestionCount("");
  };

  const openPracticeSetup = (setupMode) => {
    resetPracticeState();
    resetSetupState();
    setPracticeQuestions([]);
    setMockQuestions([]);
    setMockAnswerRecords([]);
    setIsFullMockExam(false);
    setReviewQuestions([]);
    setMockReviewQuestions([]);
    setMode(setupMode);
  };

  const buildConfiguredPracticeQuestions = (sourceQuestions) => {
    const selectedCategorySet = new Set(setupSelectedCategories);

    const filtered =
      setupSelectedCategories.length === 0
        ? sourceQuestions
        : sourceQuestions.filter((question) =>
            selectedCategorySet.has(getCategoryName(question))
          );

    const requestedCount = Number(setupQuestionCount);
    const shuffled = shuffleArray(filtered);

    if (!requestedCount || requestedCount <= 0) {
      return shuffled;
    }

    return shuffled.slice(0, Math.min(requestedCount, shuffled.length));
  };

  const startConfiguredPractice = (practiceMode) => {
    const sourceQuestions =
      practiceMode === "true_false"
        ? trueFalseQuestions
        : multipleChoiceQuestions;

    const configuredQuestions = buildConfiguredPracticeQuestions(sourceQuestions);

    if (configuredQuestions.length === 0) {
      window.alert("条件に一致する問題がありません。");
      return;
    }

    resetPracticeState();
    setPracticeQuestions(configuredQuestions);
    setMockQuestions([]);
    setMockAnswerRecords([]);
    setIsFullMockExam(false);
    setReviewQuestions([]);
    setMockReviewQuestions([]);
    setMode(practiceMode);
    setStartedAt(new Date());
  };

  const startMode = (nextMode) => {
    resetPracticeState();
    resetSetupState();
    setMode(nextMode);
    setStartedAt(new Date());

    if (nextMode === "mock_exam") {
      const mockExam = buildMockExamQuestions(
        trueFalseQuestions,
        multipleChoiceQuestions
      );

      setMockQuestions(mockExam.questions);
      setIsFullMockExam(mockExam.isFullMockExam);
      setMockAnswerRecords([]);
      setPracticeQuestions([]);
      setReviewQuestions([]);
      setMockReviewQuestions([]);
    } else if (nextMode === "wrong_review") {
      setReviewQuestions(shuffleArray(wrongQuestions));
      setPracticeQuestions([]);
      setMockQuestions([]);
      setMockAnswerRecords([]);
      setIsFullMockExam(false);
      setMockReviewQuestions([]);
    } else {
      setPracticeQuestions([]);
      setMockQuestions([]);
      setMockAnswerRecords([]);
      setIsFullMockExam(false);
      setReviewQuestions([]);
      setMockReviewQuestions([]);
    }
  };

  const startMockExamReview = (reviewTargets) => {
    resetPracticeState();
    resetSetupState();
    setMode("mock_exam_review");
    setMockReviewQuestions(shuffleArray(reviewTargets));
    setPracticeQuestions([]);
    setMockQuestions([]);
    setMockAnswerRecords([]);
    setIsFullMockExam(false);
    setReviewQuestions([]);
    setStartedAt(new Date());
  };

  const backToMenu = () => {
    resetPracticeState();
    resetSetupState();
    setPracticeQuestions([]);
    setMockQuestions([]);
    setMockAnswerRecords([]);
    setIsFullMockExam(false);
    setReviewQuestions([]);
    setMockReviewQuestions([]);
    setMode("menu");
  };

  const resetLearningHistory = () => {
    const confirmed = window.confirm(
      "学習履歴と誤答復習リストをすべて削除します。よろしいですか？"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    setLearningHistory(EMPTY_HISTORY);
  };

  const handleTrueFalseAnswer = (answer) => {
    if (isAnswered || !currentQuestion) return;

    const result = buildTrueFalseResult(currentQuestion, answer);

    setSelectedAnswer(answer);
    setIsAnswered(true);
    setResults((prev) => [...prev, result]);
    persistResults([result]);
  };

  const handleMultipleChoiceAnswer = (choice) => {
    if (isAnswered || !currentQuestion) return;

    const result = buildMultipleChoiceResult(currentQuestion, choice.id);

    setSelectedChoiceId(choice.id);
    setIsAnswered(true);
    setResults((prev) => [...prev, result]);
    persistResults([result]);
  };

  const finishMockExam = (answerRecords) => {
    const completedResults = mockQuestions.map((question, index) => {
      return answerRecords[index] ?? buildUnansweredResult(question);
    });

    setResults(completedResults);
    persistResults(completedResults, "mock_exam");
    setSelectedAnswer(null);
    setSelectedChoiceId(null);
    setCurrentIndex(mockQuestions.length);
  };

  const saveMockAnswerAndMoveNext = (result) => {
    const nextRecords = [...mockAnswerRecords];
    nextRecords[currentIndex] = result;

    setMockAnswerRecords(nextRecords);

    if (currentIndex + 1 >= mockQuestions.length) {
      finishMockExam(nextRecords);
      return;
    }

    setSelectedAnswer(null);
    setSelectedChoiceId(null);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleMockSelectTrueFalse = (answer) => {
    if (!currentQuestion || currentQuestion.type !== "true_false") return;

    const result = buildTrueFalseResult(currentQuestion, answer);
    saveMockAnswerAndMoveNext(result);
  };

  const handleMockSelectChoice = (choice) => {
    if (!currentQuestion || currentQuestion.type !== "multiple_choice") return;

    const result = buildMultipleChoiceResult(currentQuestion, choice.id);
    saveMockAnswerAndMoveNext(result);
  };

  const handleMockUnansweredNext = () => {
    if (!currentQuestion) return;

    const result = buildUnansweredResult(currentQuestion);
    saveMockAnswerAndMoveNext(result);
  };

  const handleReviewAnswer = (result, reviewMode) => {
    setResults((prev) => [...prev, result]);
    persistResults([result], reviewMode);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setSelectedChoiceId(null);
    setIsAnswered(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleRestart = () => {
    if (mode === "mock_exam") {
      const mockExam = buildMockExamQuestions(
        trueFalseQuestions,
        multipleChoiceQuestions
      );

      resetPracticeState();
      setMockQuestions(mockExam.questions);
      setIsFullMockExam(mockExam.isFullMockExam);
      setMockAnswerRecords([]);
      setStartedAt(new Date());
      return;
    }

    if (mode === "wrong_review") {
      resetPracticeState();
      setReviewQuestions(shuffleArray(wrongQuestions));
      setStartedAt(new Date());
      return;
    }

    if (mode === "mock_exam_review") {
      resetPracticeState();
      setMockReviewQuestions(shuffleArray(mockReviewQuestions));
      setStartedAt(new Date());
      return;
    }

    if (mode === "true_false" || mode === "multiple_choice") {
      resetPracticeState();
      setPracticeQuestions(shuffleArray(practiceQuestions));
      setStartedAt(new Date());
      return;
    }

    resetPracticeState();
    setStartedAt(new Date());
  };

  if (error) {
    return (
      <main className="container">
        <h1>学科試験演習アプリ PoC</h1>
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container">
        <h1>学科試験演習アプリ PoC</h1>
        <p>読み込み中...</p>
      </main>
    );
  }

  if (mode === "menu") {
    const totalAttempts = Object.values(learningHistory.questionStats).reduce(
      (sum, stat) => sum + stat.attempts,
      0
    );

    return (
      <main className="container">
        <h1>学科試験演習アプリ PoC</h1>

        <section className="card">
          <h2>演習モード選択</h2>
          <p>
            現在のPoCでは、○×演習、択一演習、本番模擬、誤答復習を実装しています。
          </p>
          <p>問題数：{data.questionCount}問</p>
          <p>○×問題：{trueFalseQuestions.length}問</p>
          <p>択一問題：{multipleChoiceQuestions.length}問</p>
          <p>本番模擬対象問題：{targetMockQuestionCount}問</p>
          <p>誤答復習対象：{wrongQuestions.length}問</p>

          <div className="menu-buttons">
            <button
              type="button"
              className="button primary"
              onClick={() => openPracticeSetup("true_false_setup")}
              disabled={trueFalseQuestions.length === 0}
            >
              ○×演習を開始
            </button>

            <button
              type="button"
              className="button primary"
              onClick={() => openPracticeSetup("multiple_choice_setup")}
              disabled={multipleChoiceQuestions.length === 0}
            >
              択一演習を開始
            </button>

            <button
              type="button"
              className="button primary"
              onClick={() => startMode("mock_exam")}
              disabled={targetMockQuestionCount === 0}
            >
              本番模擬を開始
            </button>

            <button
              type="button"
              className="button primary"
              onClick={() => startMode("wrong_review")}
              disabled={wrongQuestions.length === 0}
            >
              誤答復習を開始
            </button>
          </div>
        </section>

        <section className="card">
          <h2>学習履歴</h2>
          <p>総回答回数：{totalAttempts}回</p>
          <p>誤答復習対象：{wrongQuestions.length}問</p>
          <p className="note">
            不正解または無回答の問題は誤答復習対象になります。誤答復習で2回連続正解すると克服扱いになり、復習対象から外れます。
          </p>

          <button
            type="button"
            className="button secondary"
            onClick={resetLearningHistory}
            disabled={totalAttempts === 0 && wrongQuestions.length === 0}
          >
            学習履歴をリセット
          </button>
        </section>

        <section className="card">
          <h2>採点ルール</h2>
          <p>○×問題：正解 +0.2点、不正解 -0.2点、無回答 0点</p>
          <p>択一問題：正解 +0.4点、不正解 -0.4点、無回答 0点</p>
          <p>合計点がマイナスになった場合も、そのまま表示します。</p>
          <p className="note">
            本番模擬は、問題数が十分にある場合は○×60問・択一10問の70問構成で出題します。
            問題数が不足している場合は、計算問題を除いた登録済み対象問題を全問出題します。
          </p>
        </section>
      </main>
    );
  }

  if (mode === "true_false_setup") {
    return (
      <PracticeSetupScreen
        title="○×演習 設定"
        questions={trueFalseQuestions}
        selectedCategories={setupSelectedCategories}
        questionCount={setupQuestionCount}
        onChangeSelectedCategories={setSetupSelectedCategories}
        onChangeQuestionCount={setSetupQuestionCount}
        onStart={() => startConfiguredPractice("true_false")}
        onBackToMenu={backToMenu}
      />
    );
  }

  if (mode === "multiple_choice_setup") {
    return (
      <PracticeSetupScreen
        title="択一演習 設定"
        questions={multipleChoiceQuestions}
        selectedCategories={setupSelectedCategories}
        questionCount={setupQuestionCount}
        onChangeSelectedCategories={setSetupSelectedCategories}
        onChangeQuestionCount={setSetupQuestionCount}
        onStart={() => startConfiguredPractice("multiple_choice")}
        onBackToMenu={backToMenu}
      />
    );
  }

  if (activeQuestions.length === 0) {
    return (
      <main className="container">
        <h1>{getModeTitle(mode)}</h1>
        <section className="card">
          <p>対象の問題がありません。</p>
          <button type="button" className="button" onClick={backToMenu}>
            トップへ戻る
          </button>
        </section>
      </main>
    );
  }

  if (isFinished) {
    return (
      <ResultScreen
        mode={mode}
        questions={activeQuestions}
        results={results}
        startedAt={startedAt}
        finishedAt={finishedAt}
        onRestart={handleRestart}
        onBackToMenu={backToMenu}
        onStartMockExamReview={startMockExamReview}
      />
    );
  }

  if (mode === "true_false") {
    return (
      <TrueFalsePracticeScreen
        currentIndex={currentIndex}
        questions={activeQuestions}
        currentQuestion={currentQuestion}
        selectedAnswer={selectedAnswer}
        isAnswered={isAnswered}
        onAnswer={handleTrueFalseAnswer}
        onNext={handleNext}
        onBackToMenu={backToMenu}
      />
    );
  }

  if (mode === "multiple_choice") {
    return (
      <MultipleChoicePracticeScreen
        currentIndex={currentIndex}
        questions={activeQuestions}
        currentQuestion={currentQuestion}
        displayChoices={displayChoices}
        selectedChoiceId={selectedChoiceId}
        isAnswered={isAnswered}
        onAnswer={handleMultipleChoiceAnswer}
        onNext={handleNext}
        onBackToMenu={backToMenu}
      />
    );
  }

  if (mode === "wrong_review") {
    return (
      <ReviewPracticeScreen
        title="誤答復習"
        note="このモードで2回連続正解した問題は、克服扱いで誤答復習対象から外れます。"
        currentIndex={currentIndex}
        questions={activeQuestions}
        currentQuestion={currentQuestion}
        displayChoices={displayChoices}
        selectedAnswer={selectedAnswer}
        selectedChoiceId={selectedChoiceId}
        isAnswered={isAnswered}
        onSelectTrueFalse={setSelectedAnswer}
        onSelectChoice={setSelectedChoiceId}
        onSetIsAnswered={setIsAnswered}
        onSaveResult={(result) => handleReviewAnswer(result, "wrong_review")}
        onNext={handleNext}
        onBackToMenu={backToMenu}
      />
    );
  }

  if (mode === "mock_exam_review") {
    return (
      <ReviewPracticeScreen
        title="今回間違えた問題の復習"
        note="直前の本番模擬で不正解または無回答だった問題だけを復習します。"
        currentIndex={currentIndex}
        questions={activeQuestions}
        currentQuestion={currentQuestion}
        displayChoices={displayChoices}
        selectedAnswer={selectedAnswer}
        selectedChoiceId={selectedChoiceId}
        isAnswered={isAnswered}
        onSelectTrueFalse={setSelectedAnswer}
        onSelectChoice={setSelectedChoiceId}
        onSetIsAnswered={setIsAnswered}
        onSaveResult={(result) =>
          handleReviewAnswer(result, "mock_exam_review")
        }
        onNext={handleNext}
        onBackToMenu={backToMenu}
      />
    );
  }

  return (
    <MockExamScreen
      currentIndex={currentIndex}
      questions={activeQuestions}
      currentQuestion={currentQuestion}
      displayChoices={displayChoices}
      isFullMockExam={isFullMockExam}
      onSelectTrueFalse={handleMockSelectTrueFalse}
      onSelectChoice={handleMockSelectChoice}
      onUnansweredNext={handleMockUnansweredNext}
      onBackToMenu={backToMenu}
    />
  );
}

function PracticeSetupScreen({
  title,
  questions,
  selectedCategories,
  questionCount,
  onChangeSelectedCategories,
  onChangeQuestionCount,
  onStart,
  onBackToMenu,
}) {
  const categories = buildCategoryOptions(questions);
  const selectedCategorySet = new Set(selectedCategories);

  const targetQuestions =
    selectedCategories.length === 0
      ? questions
      : questions.filter((question) =>
          selectedCategorySet.has(getCategoryName(question))
        );

  const requestedCount = Number(questionCount);
  const actualCount =
    !requestedCount || requestedCount <= 0
      ? targetQuestions.length
      : Math.min(requestedCount, targetQuestions.length);

  const toggleCategory = (category) => {
    if (selectedCategorySet.has(category)) {
      onChangeSelectedCategories(
        selectedCategories.filter((item) => item !== category)
      );
    } else {
      onChangeSelectedCategories([...selectedCategories, category]);
    }
  };

  const selectAllCategories = () => {
    onChangeSelectedCategories(categories.map((item) => item.category));
  };

  const clearCategories = () => {
    onChangeSelectedCategories([]);
  };

  return (
    <main className="container">
      <h1>{title}</h1>

      <section className="card">
        <h2>出題カテゴリ</h2>
        <p className="note">
          複数選択できます。何も選択しない場合は、全カテゴリから出題します。
        </p>

        <div className="setup-actions">
          <button
            type="button"
            className="button secondary"
            onClick={selectAllCategories}
          >
            すべて選択
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={clearCategories}
          >
            選択解除
          </button>
        </div>

        <div className="category-grid">
          {categories.map((item) => (
            <label key={item.category} className="category-option">
              <input
                type="checkbox"
                checked={selectedCategorySet.has(item.category)}
                onChange={() => toggleCategory(item.category)}
              />
              <span>{item.category}</span>
              <span className="category-count">{item.count}問</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>出題数</h2>
        <p className="note">
          空欄または0以下の場合は、対象問題を全問出題します。指定数が対象問題数を超える場合も、対象問題を全問出題します。
        </p>

        <input
          type="number"
          min="0"
          className="question-count-input"
          value={questionCount}
          onChange={(event) => onChangeQuestionCount(event.target.value)}
          placeholder="例：10"
        />

        <div className="setup-summary">
          <p>条件に一致する問題数：{targetQuestions.length}問</p>
          <p>実際の出題予定数：{actualCount}問</p>
        </div>
      </section>

      <div className="action-row">
        <button
          type="button"
          className="button primary"
          onClick={onStart}
          disabled={targetQuestions.length === 0}
        >
          演習開始
        </button>

        <button
          type="button"
          className="button secondary"
          onClick={onBackToMenu}
        >
          トップへ戻る
        </button>
      </div>
    </main>
  );
}

function TrueFalsePracticeScreen({
  currentIndex,
  questions,
  currentQuestion,
  selectedAnswer,
  isAnswered,
  onAnswer,
  onNext,
  onBackToMenu,
}) {
  return (
    <main className="container">
      <h1>○×演習</h1>

      <section className="card">
        <p className="progress">
          {currentIndex + 1} / {questions.length} 問
        </p>

        <QuestionMeta question={currentQuestion} />

        <h2 className="question-text">{currentQuestion.question}</h2>

        <QuestionImage
          src={currentQuestion.image}
          label={`${currentQuestion.id}の問題画像`}
        />

        <div className="answer-buttons">
          <button
            type="button"
            className="answer-button"
            onClick={() => onAnswer(true)}
            disabled={isAnswered}
          >
            ○
          </button>
          <button
            type="button"
            className="answer-button"
            onClick={() => onAnswer(false)}
            disabled={isAnswered}
          >
            ×
          </button>
        </div>

        {isAnswered && (
          <div
            className={
              selectedAnswer === currentQuestion.answer
                ? "result correct"
                : "result wrong"
            }
          >
            <p>
              {selectedAnswer === currentQuestion.answer ? "正解" : "不正解"}
            </p>
            <p>正解：{formatTrueFalse(currentQuestion.answer)}</p>

            {currentQuestion.explanation && (
              <p>解説：{currentQuestion.explanation}</p>
            )}

            <QuestionImage
              src={currentQuestion.explanationImage}
              label={`${currentQuestion.id}の解説画像`}
            />

            <button type="button" className="button" onClick={onNext}>
              {currentIndex + 1 === questions.length ? "結果を見る" : "次の問題"}
            </button>
          </div>
        )}

        <button type="button" className="text-button" onClick={onBackToMenu}>
          トップへ戻る
        </button>
      </section>
    </main>
  );
}

function MultipleChoicePracticeScreen({
  currentIndex,
  questions,
  currentQuestion,
  displayChoices,
  selectedChoiceId,
  isAnswered,
  onAnswer,
  onNext,
  onBackToMenu,
}) {
  const selectedChoice = displayChoices.find(
    (choice) => choice.id === selectedChoiceId
  );

  return (
    <main className="container">
      <h1>択一演習</h1>

      <section className="card">
        <p className="progress">
          {currentIndex + 1} / {questions.length} 問
        </p>

        <QuestionMeta question={currentQuestion} />

        <h2 className="question-text">{currentQuestion.question}</h2>

        <QuestionImage
          src={currentQuestion.image}
          label={`${currentQuestion.id}の問題画像`}
        />

        <div className="shuffle-info">
          選択肢シャッフル：
          {currentQuestion.shuffleChoices ? "有効" : "無効"}
        </div>

        <ChoiceButtons
          displayChoices={displayChoices}
          selectedChoiceId={selectedChoiceId}
          isAnswered={isAnswered}
          onAnswer={onAnswer}
        />

        {isAnswered && (
          <div
            className={
              selectedChoice?.isCorrect ? "result correct" : "result wrong"
            }
          >
            <p>{selectedChoice?.isCorrect ? "正解" : "不正解"}</p>

            <p>
              正解：元ID{" "}
              {currentQuestion.choices.find((choice) => choice.isCorrect)?.id}
            </p>

            {currentQuestion.explanation && (
              <p>総合解説：{currentQuestion.explanation}</p>
            )}

            <QuestionImage
              src={currentQuestion.explanationImage}
              label={`${currentQuestion.id}の解説画像`}
            />

            <ChoiceExplanations choices={currentQuestion.choices} />

            <button type="button" className="button" onClick={onNext}>
              {currentIndex + 1 === questions.length ? "結果を見る" : "次の問題"}
            </button>
          </div>
        )}

        <button type="button" className="text-button" onClick={onBackToMenu}>
          トップへ戻る
        </button>
      </section>
    </main>
  );
}

function ReviewPracticeScreen({
  title,
  note,
  currentIndex,
  questions,
  currentQuestion,
  displayChoices,
  selectedAnswer,
  selectedChoiceId,
  isAnswered,
  onSelectTrueFalse,
  onSelectChoice,
  onSetIsAnswered,
  onSaveResult,
  onNext,
  onBackToMenu,
}) {
  const selectedChoice = displayChoices.find(
    (choice) => choice.id === selectedChoiceId
  );

  const saveTrueFalseAnswer = (answer) => {
    if (isAnswered) return;

    const result = buildTrueFalseResult(currentQuestion, answer);

    onSelectTrueFalse(answer);
    onSetIsAnswered(true);
    onSaveResult(result);
  };

  const saveChoiceAnswer = (choice) => {
    if (isAnswered) return;

    const result = buildMultipleChoiceResult(currentQuestion, choice.id);

    onSelectChoice(choice.id);
    onSetIsAnswered(true);
    onSaveResult(result);
  };

  return (
    <main className="container">
      <h1>{title}</h1>

      <section className="card">
        <p className="progress">
          {currentIndex + 1} / {questions.length} 問
        </p>

        <p className="note">{note}</p>

        <QuestionMeta question={currentQuestion} />

        <h2 className="question-text">{currentQuestion.question}</h2>

        <QuestionImage
          src={currentQuestion.image}
          label={`${currentQuestion.id}の問題画像`}
        />

        {currentQuestion.type === "true_false" && (
          <div className="answer-buttons">
            <button
              type="button"
              className="answer-button"
              onClick={() => saveTrueFalseAnswer(true)}
              disabled={isAnswered}
            >
              ○
            </button>
            <button
              type="button"
              className="answer-button"
              onClick={() => saveTrueFalseAnswer(false)}
              disabled={isAnswered}
            >
              ×
            </button>
          </div>
        )}

        {currentQuestion.type === "multiple_choice" && (
          <>
            <div className="shuffle-info">
              選択肢シャッフル：
              {currentQuestion.shuffleChoices ? "有効" : "無効"}
            </div>

            <ChoiceButtons
              displayChoices={displayChoices}
              selectedChoiceId={selectedChoiceId}
              isAnswered={isAnswered}
              onAnswer={saveChoiceAnswer}
            />
          </>
        )}

        {isAnswered && (
          <div
            className={
              currentQuestion.type === "true_false"
                ? selectedAnswer === currentQuestion.answer
                  ? "result correct"
                  : "result wrong"
                : selectedChoice?.isCorrect
                ? "result correct"
                : "result wrong"
            }
          >
            <p>
              {currentQuestion.type === "true_false"
                ? selectedAnswer === currentQuestion.answer
                  ? "正解"
                  : "不正解"
                : selectedChoice?.isCorrect
                ? "正解"
                : "不正解"}
            </p>

            {currentQuestion.type === "true_false" && (
              <p>正解：{formatTrueFalse(currentQuestion.answer)}</p>
            )}

            {currentQuestion.type === "multiple_choice" && (
              <p>
                正解：元ID{" "}
                {currentQuestion.choices.find((choice) => choice.isCorrect)?.id}
              </p>
            )}

            {currentQuestion.explanation && (
              <p>
                {currentQuestion.type === "multiple_choice"
                  ? "総合解説"
                  : "解説"}
                ：{currentQuestion.explanation}
              </p>
            )}

            <QuestionImage
              src={currentQuestion.explanationImage}
              label={`${currentQuestion.id}の解説画像`}
            />

            {currentQuestion.type === "multiple_choice" && (
              <ChoiceExplanations choices={currentQuestion.choices} />
            )}

            <button type="button" className="button" onClick={onNext}>
              {currentIndex + 1 === questions.length ? "結果を見る" : "次の問題"}
            </button>
          </div>
        )}

        <button type="button" className="text-button" onClick={onBackToMenu}>
          トップへ戻る
        </button>
      </section>
    </main>
  );
}

function MockExamScreen({
  currentIndex,
  questions,
  currentQuestion,
  displayChoices,
  isFullMockExam,
  onSelectTrueFalse,
  onSelectChoice,
  onUnansweredNext,
  onBackToMenu,
}) {
  const typeCounts = countQuestionsByType(questions);

  return (
    <main className="container">
      <h1>本番模擬</h1>

      <section className="card">
        <div className="mock-header">
          <p className="progress">
            {currentIndex + 1} / {questions.length} 問
          </p>
          <p className="note">
            本番模擬では、回答を選択すると自動で次の問題へ進みます。
          </p>
        </div>

        <div className="question-meta">
          <p>
            出題構成：
            {isFullMockExam
              ? "70問構成（○×60問・択一10問）"
              : "問題数不足のため、対象問題を全問出題"}
          </p>
          <p>
            ○×：{typeCounts.trueFalse}問 ／ 択一：
            {typeCounts.multipleChoice}問
          </p>
          <p>計算問題は出題対象外です。</p>
        </div>

        <QuestionMeta question={currentQuestion} />

        <h2 className="question-text">{currentQuestion.question}</h2>

        <QuestionImage
          src={currentQuestion.image}
          label={`${currentQuestion.id}の問題画像`}
        />

        {currentQuestion.type === "true_false" && (
          <div className="answer-buttons">
            <button
              type="button"
              className="answer-button"
              onClick={() => onSelectTrueFalse(true)}
            >
              ○
            </button>
            <button
              type="button"
              className="answer-button"
              onClick={() => onSelectTrueFalse(false)}
            >
              ×
            </button>
          </div>
        )}

        {currentQuestion.type === "multiple_choice" && (
          <>
            <div className="shuffle-info">
              選択肢シャッフル：
              {currentQuestion.shuffleChoices ? "有効" : "無効"}
            </div>

            <ChoiceButtons
              displayChoices={displayChoices}
              selectedChoiceId={null}
              isAnswered={false}
              onAnswer={onSelectChoice}
            />
          </>
        )}

        <div className="action-row">
          <button
            type="button"
            className="button secondary"
            onClick={onUnansweredNext}
          >
            無回答で次へ
          </button>
        </div>

        <button type="button" className="text-button" onClick={onBackToMenu}>
          トップへ戻る
        </button>
      </section>
    </main>
  );
}

function ChoiceButtons({
  displayChoices,
  selectedChoiceId,
  isAnswered,
  onAnswer,
}) {
  return (
    <div className="choice-buttons">
      {displayChoices.map((choice, index) => {
        const displayLabel = String.fromCharCode(65 + index);
        const isSelected = selectedChoiceId === choice.id;
        const isCorrectChoice = choice.isCorrect;

        let className = "choice-button";

        if (isAnswered && isSelected && isCorrectChoice) {
          className += " selected-correct";
        } else if (isAnswered && isSelected && !isCorrectChoice) {
          className += " selected-wrong";
        } else if (isAnswered && isCorrectChoice) {
          className += " correct-choice";
        } else if (!isAnswered && isSelected) {
          className += " mock-selected-choice";
        }

        return (
          <button
            key={choice.id}
            type="button"
            className={className}
            onClick={() => onAnswer(choice)}
            disabled={isAnswered}
          >
            <span className="display-label">{displayLabel}</span>
            <span>{choice.text}</span>
            <span className="original-id">元ID：{choice.id}</span>
          </button>
        );
      })}
    </div>
  );
}

function ResultScreen({
  mode,
  questions,
  results,
  startedAt,
  finishedAt,
  onRestart,
  onBackToMenu,
  onStartMockExamReview,
}) {
  const correctCount = results.filter((result) => result.isCorrect).length;
  const wrongCount = results.filter(
    (result) => !result.isCorrect && !result.isUnanswered
  ).length;
  const unansweredCount = results.filter((result) => result.isUnanswered).length;
  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const maxScore = questions.reduce(
    (sum, question) => sum + getQuestionMaxScore(question),
    0
  );
  const durationText = formatDuration(startedAt, finishedAt);
  const categoryStats = buildCategoryStats(questions, results);
  const mockExamReviewQuestions = buildMockExamReviewQuestions(
    questions,
    results
  );

  return (
    <main className="container">
      <h1>{getModeTitle(mode)} 結果</h1>

      <section className="card">
        <p>出題数：{questions.length}問</p>
        <p>正答数：{correctCount}問</p>
        <p>誤答数：{wrongCount}問</p>
        <p>無回答数：{unansweredCount}問</p>
        <p>
          得点：{totalScore.toFixed(1)} / {maxScore.toFixed(1)} 点
        </p>
        {durationText && <p>所要時間：{durationText}</p>}

        {mode === "wrong_review" && (
          <p className="note">
            2回連続正解した問題は、誤答復習対象から外れます。トップ画面の誤答復習対象数で確認できます。
          </p>
        )}

        {mode === "mock_exam_review" && (
          <p className="note">この復習結果も学習履歴に保存されます。</p>
        )}

        {mode === "mock_exam" && mockExamReviewQuestions.length > 0 && (
          <button
            type="button"
            className="button primary"
            onClick={() => onStartMockExamReview(mockExamReviewQuestions)}
          >
            今回間違えた問題を復習する
          </button>
        )}

        {mode === "mock_exam" && mockExamReviewQuestions.length === 0 && (
          <p className="note">今回の本番模擬で復習対象の問題はありません。</p>
        )}
      </section>

      <section className="card">
        <h2>カテゴリ別正答率</h2>
        {categoryStats.length === 0 ? (
          <p>カテゴリ情報がありません。</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>カテゴリ</th>
                <th>正答</th>
                <th>誤答</th>
                <th>無回答</th>
                <th>正答率</th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.map((stat) => (
                <tr key={stat.category}>
                  <td>{stat.category}</td>
                  <td>{stat.correct}</td>
                  <td>{stat.wrong}</td>
                  <td>{stat.unanswered}</td>
                  <td>{stat.accuracy.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>解答一覧</h2>
        <ol>
          {results.map((result, index) => {
            const question = questions[index];

            return (
              <li key={`${result.questionId}-${index}`} className="review-item">
                <ReviewResult question={question} result={result} />
              </li>
            );
          })}
        </ol>
      </section>

      <div className="action-row">
        <button type="button" className="button" onClick={onRestart}>
          もう一度実施する
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={onBackToMenu}
        >
          トップへ戻る
        </button>
      </div>
    </main>
  );
}

function ReviewResult({ question, result }) {
  const statusText = result.isUnanswered
    ? "無回答"
    : result.isCorrect
    ? "正解"
    : "不正解";

  if (question.type === "true_false") {
    return (
      <>
        <p>
          <strong>{question.id}</strong>：{statusText}
        </p>
        <p>問題文：{question.question}</p>

        <QuestionImage
          src={question.image}
          label={`${question.id}の問題画像`}
        />

        <p>
          あなたの回答：{formatTrueFalse(result.selectedAnswer)} ／ 正解：
          {formatTrueFalse(result.correctAnswer)}
        </p>

        {question.explanation && <p>解説：{question.explanation}</p>}

        <QuestionImage
          src={question.explanationImage}
          label={`${question.id}の解説画像`}
        />
      </>
    );
  }

  const selectedChoice = question.choices.find(
    (choice) => choice.id === result.selectedChoiceId
  );
  const correctChoice = question.choices.find((choice) => choice.isCorrect);

  return (
    <>
      <p>
        <strong>{question.id}</strong>：{statusText}
      </p>
      <p>問題文：{question.question}</p>

      <QuestionImage
        src={question.image}
        label={`${question.id}の問題画像`}
      />

      <p>
        あなたの回答：
        {selectedChoice
          ? `${result.selectedChoiceId}. ${selectedChoice.text}`
          : "未回答"}
      </p>
      <p>
        正解：{correctChoice?.id}. {correctChoice?.text}
      </p>

      {question.explanation && <p>総合解説：{question.explanation}</p>}

      <QuestionImage
        src={question.explanationImage}
        label={`${question.id}の解説画像`}
      />

      <ChoiceExplanations choices={question.choices} />
    </>
  );
}

function ChoiceExplanations({ choices }) {
  return (
    <div className="choice-explanations">
      <p>選択肢ごとの解説：</p>
      <ul>
        {choices.map((choice) => (
          <li key={choice.id}>
            <strong>
              元ID {choice.id}. {choice.text}
            </strong>
            <br />
            {choice.explanation || "解説なし"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestionImage({ src, label }) {
  if (!src) return null;

  return (
    <div className="question-image-wrapper">
      <img src={src} alt={label} className="question-image" />
    </div>
  );
}

function QuestionMeta({ question }) {
  return (
    <div className="question-meta">
      <p>ID：{question.id}</p>
      <p>形式：{question.type === "true_false" ? "○×" : "択一"}</p>
      <p>カテゴリ：{question.category ?? "未設定"}</p>
      <p>サブカテゴリ：{question.subCategory ?? "未設定"}</p>

      {question.tags?.length > 0 && <p>タグ：{question.tags.join("、")}</p>}
    </div>
  );
}

function buildCategoryOptions(questions) {
  const categoryMap = new Map();

  questions.forEach((question) => {
    const category = getCategoryName(question);
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
  });

  return Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category, "ja"));
}

function buildCategoryStats(questions, results) {
  const statsMap = new Map();

  questions.forEach((question, index) => {
    const category = question.category || "未設定";
    const result = results[index];

    if (!statsMap.has(category)) {
      statsMap.set(category, {
        category,
        correct: 0,
        wrong: 0,
        unanswered: 0,
      });
    }

    const stat = statsMap.get(category);

    if (!result) return;

    if (result.isUnanswered) {
      stat.unanswered += 1;
    } else if (result.isCorrect) {
      stat.correct += 1;
    } else {
      stat.wrong += 1;
    }
  });

  return Array.from(statsMap.values()).map((stat) => {
    const answered = stat.correct + stat.wrong;
    const accuracy = answered === 0 ? 0 : (stat.correct / answered) * 100;

    return {
      ...stat,
      accuracy,
    };
  });
}

function buildMockExamReviewQuestions(questions, results) {
  return questions.filter((question, index) => {
    const result = results[index];

    if (!result) return false;

    return result.isUnanswered || !result.isCorrect;
  });
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return "";

  const diffMs = finishedAt.getTime() - startedAt.getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}分${seconds}秒`;
}

function getModeTitle(mode) {
  if (mode === "true_false") return "○×演習";
  if (mode === "multiple_choice") return "択一演習";
  if (mode === "mock_exam") return "本番模擬";
  if (mode === "wrong_review") return "誤答復習";
  if (mode === "mock_exam_review") return "今回間違えた問題の復習";
  return "学科試験演習アプリ";
}

export default App;