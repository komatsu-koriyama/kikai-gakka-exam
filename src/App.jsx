import { useEffect, useMemo, useState } from "react";
import "./App.css";

const HISTORY_STORAGE_KEY = "kikaiGakkaExamLearningHistory";
const AUTH_STORAGE_KEY = "kikaiGakkaExamAuthenticated";
const AUTH_PASSWORD = "koriyamakikai";
const SHOW_DEBUG_INFO = false;

const TRUE_FALSE_SCORE = 0.2;
const MULTIPLE_CHOICE_SCORE = 0.4;

const LOW_ACCURACY_THRESHOLD = 70;

const APP_VERSION = "0.7.5";
const APP_UPDATED_AT = "2026-07-09";
const APP_SPEC_NOTE = "計算問題は現段階では除外";

const DEFAULT_HISTORY = {
  questionStats: {},
  wrongQuestionIds: [],
  mockExamAttempts: [],
};

const PRACTICE_ORDER_OPTIONS = [
  { value: "random", label: "ランダム" },
  { value: "registered", label: "登録順" },
  { value: "low_accuracy", label: "正答率が低い順" },
  { value: "few_attempts", label: "回答回数が少ない順" },
];

const WRONG_REVIEW_ORDER_OPTIONS = [
  { value: "low_accuracy", label: "正答率が低い順" },
  { value: "last_wrong", label: "最後に間違えた順" },
  { value: "many_wrong", label: "不正解・無回答が多い順" },
  { value: "random", label: "ランダム" },
  { value: "registered", label: "登録順" },
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => loadAuthentication());

  const [questions, setQuestions] = useState([]);
  const [questionDataMeta, setQuestionDataMeta] = useState({
    version: "",
    updatedAt: "",
    source: "",
    declaredQuestionCount: "",
  });

  const [loadState, setLoadState] = useState({
    loading: true,
    error: "",
  });

  const [screen, setScreen] = useState("menu");
  const [mode, setMode] = useState(null);

  const [history, setHistory] = useState(() => loadHistory());

  const [setupType, setSetupType] = useState(null);
  const [setupCategories, setSetupCategories] = useState([]);
  const [setupCount, setSetupCount] = useState(10);
  const [setupOrder, setSetupOrder] = useState("random");
  const [wrongReviewOrder, setWrongReviewOrder] = useState("low_accuracy");

  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [currentAnswered, setCurrentAnswered] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [lastMissedQuestionIds, setLastMissedQuestionIds] = useState([]);

  const [historyFilters, setHistoryFilters] = useState({
    categories: [],
    lowAccuracyOnly: false,
    wrongOnly: false,
    includeUnansweredOnly: false,
  });

  const [questionListFilters, setQuestionListFilters] = useState({
    keyword: "",
    categories: [],
    type: "all",
    hasImage: false,
    hasExplanationImage: false,
    noCategory: false,
  });

  const [expandedQuestionIds, setExpandedQuestionIds] = useState(() => new Set());

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadQuestions() {
      try {
        setLoadState({ loading: true, error: "" });

        const response = await fetch(`${import.meta.env.BASE_URL}data/questions.json`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`questions.json の読み込みに失敗しました。HTTP ${response.status}`);
        }

        const data = await response.json();
        const meta = data?.meta ?? {};
        const loadedQuestions = Array.isArray(data?.questions) ? data.questions : [];

        setQuestions(loadedQuestions.filter((question) => question));

        setQuestionDataMeta({
          version: normalizeText(data?.version) || normalizeText(meta.version),
          updatedAt:
            normalizeText(data?.updatedAt) ||
            normalizeText(data?.generatedAt) ||
            normalizeText(meta.updatedAt) ||
            normalizeText(meta.generatedAt),
          source: normalizeText(data?.source) || normalizeText(meta.source),
          declaredQuestionCount:
            data?.questionCount !== undefined && data?.questionCount !== null ? String(data.questionCount) : "",
        });

        setLoadState({ loading: false, error: "" });
      } catch (error) {
        setLoadState({
          loading: false,
          error: error instanceof Error ? error.message : "questions.json の読み込みに失敗しました。",
        });
      }
    }

    loadQuestions();
  }, [isAuthenticated]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  function handleAuthenticate(password) {
    if (password.trim() !== AUTH_PASSWORD) {
      return false;
    }

    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setIsAuthenticated(true);
    return true;
  }

  const categories = useMemo(() => {
    const values = questions.map((question) => normalizeText(question.category)).filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ja"));
  }, [questions]);

  const currentQuestion = sessionQuestions[currentIndex] ?? null;
  const isMockExam = mode === "mock_exam";
  const totalQuestions = sessionQuestions.length;
  const completedSessionResults = useMemo(() => sessionResults.filter(Boolean), [sessionResults]);
  const answeredCount = completedSessionResults.length;
  const hasCurrentRecordedResult = Boolean(sessionResults[currentIndex]);
  const progressCurrentNumber = totalQuestions === 0 ? 0 : Math.min(currentIndex + 1, totalQuestions);
  const remainingCount = totalQuestions === 0 ? 0 : Math.max(totalQuestions - progressCurrentNumber, 0);
  const progressPercent = totalQuestions === 0 ? 0 : Math.round((currentIndex / totalQuestions) * 100);

  const topSummary = useMemo(() => {
    const stats = Object.values(history.questionStats ?? {});
    const totalAttempts = stats.reduce((sum, stat) => sum + Number(stat.attempts ?? 0), 0);

    return {
      totalAttempts,
      wrongReviewCount: history.wrongQuestionIds?.length ?? 0,
    };
  }, [history]);

  function openSetup(type) {
    setSetupType(type);
    setSetupCategories([]);
    setSetupCount(10);
    setSetupOrder("random");
    setScreen("setup");
  }

  function toggleSetupCategory(category) {
    setSetupCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }

      return [...prev, category];
    });
  }

  function clearSetupCategories() {
    setSetupCategories([]);
  }

  function startPracticeFromSetup() {
    const selectedCategorySet = new Set(setupCategories);

    const pool = questions.filter((question) => {
      if (question.type !== setupType) return false;

      if (selectedCategorySet.size > 0) {
        const category = normalizeText(question.category);
        if (!selectedCategorySet.has(category)) return false;
      }

      return true;
    });

    const count = clampNumber(Number(setupCount), 1, pool.length || 1);
    const ordered = orderQuestions(pool, setupOrder, history);
    const selected = ordered.slice(0, count);

    startSession({
      nextMode: setupType === "true_false" ? "true_false_practice" : "multiple_choice_practice",
      selectedQuestions: selected,
    });
  }

  function startMockExamWithConfirm() {
    const ok = window.confirm("本番模擬を開始します。70問構成です。よろしいですか？");
    if (!ok) return;

    startMockExam();
  }

  function startMockExam() {
    const targetQuestions = questions.filter((question) => !question.isCalculation);
    const trueFalsePool = targetQuestions.filter((question) => question.type === "true_false");
    const multipleChoicePool = targetQuestions.filter((question) => question.type === "multiple_choice");

    const trueFalseSelected =
      trueFalsePool.length >= 60 ? stratifiedSampleByCategory(trueFalsePool, 60) : shuffleArray(trueFalsePool);

    const multipleChoiceSelected =
      multipleChoicePool.length >= 10
        ? stratifiedSampleByCategory(multipleChoicePool, 10)
        : shuffleArray(multipleChoicePool);

    const selected = [...trueFalseSelected, ...multipleChoiceSelected];

    startSession({
      nextMode: "mock_exam",
      selectedQuestions: selected,
    });
  }

  function startWrongReview() {
    const wrongIds = new Set(history.wrongQuestionIds ?? []);
    const pool = questions.filter((question) => wrongIds.has(question.id));
    const selected = orderQuestions(pool, wrongReviewOrder, history);

    startSession({
      nextMode: "wrong_review",
      selectedQuestions: selected,
    });
  }

  function startLastMissedReview() {
    const orderMap = new Map(lastMissedQuestionIds.map((questionId, index) => [questionId, index]));
    const missedIds = new Set(lastMissedQuestionIds);

    const selected = questions
      .filter((question) => missedIds.has(question.id))
      .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    startSession({
      nextMode: "missed_review",
      selectedQuestions: selected,
    });
  }

  function startSession({ nextMode, selectedQuestions }) {
    setMode(nextMode);
    setSessionQuestions(selectedQuestions);
    setCurrentIndex(0);
    setCurrentAnswer(null);
    setCurrentAnswered(false);
    setCurrentResult(null);
    setSessionResults([]);
    setSessionStartedAt(Date.now());
    setScreen("practice");
  }

  function backToMenu() {
    resetSessionState();
    setScreen("menu");
  }

  function backToMenuFromMockExam() {
    const ok = window.confirm("本番模擬を中断してトップへ戻ります。よろしいですか？");
    if (!ok) return;

    backToMenu();
  }

  function resetSessionState() {
    setMode(null);
    setSetupType(null);
    setSessionQuestions([]);
    setCurrentIndex(0);
    setCurrentAnswer(null);
    setCurrentAnswered(false);
    setCurrentResult(null);
    setSessionResults([]);
    setSessionStartedAt(null);
  }

  function replaceSessionResult(results, index, result) {
    const nextResults = [...results];
    nextResults[index] = result;
    return nextResults;
  }

  function applyQuestionState(index, results) {
    const savedResult = results[index] ?? null;

    if (savedResult) {
      setCurrentAnswer(savedResult.userAnswer);
      setCurrentResult(savedResult);

      if (mode === "mock_exam") {
        setCurrentAnswered(false);
      } else {
        setCurrentAnswered(true);
      }

      return;
    }

    setCurrentAnswer(null);
    setCurrentAnswered(false);
    setCurrentResult(null);
  }

  function goPreviousQuestion() {
    if (currentIndex <= 0) return;

    const previousIndex = currentIndex - 1;
    setCurrentIndex(previousIndex);
    applyQuestionState(previousIndex, sessionResults);
  }

  function handleAnswer(answer) {
    if (!currentQuestion) return;
    if (!isMockExam && currentAnswered) return;

    if (isMockExam) {
      submitCurrentAnswer(answer, true);
      return;
    }

    submitCurrentAnswer(answer, false);
  }

  function submitCurrentAnswer(answer, shouldAutoNext = false) {
    if (!currentQuestion) return;
    if (!isMockExam && currentAnswered) return;

    const result = buildAnswerResult(currentQuestion, answer);
    const nextResults = replaceSessionResult(sessionResults, currentIndex, result);

    setCurrentAnswer(answer);
    setCurrentResult(result);
    setCurrentAnswered(!isMockExam);
    setSessionResults(nextResults);

    if (!isMockExam) {
      setHistory((prev) => updateLearningHistory(prev, result));
    }

    if (shouldAutoNext) {
      goNextQuestion(nextResults);
    }
  }

  function handleUnanswered() {
    if (!currentQuestion) return;

    if (isMockExam && hasCurrentRecordedResult) {
      goNextQuestion(sessionResults);
      return;
    }

    if (!isMockExam && currentAnswered) {
      goNextQuestion(sessionResults);
      return;
    }

    const result = buildAnswerResult(currentQuestion, null);
    const nextResults = replaceSessionResult(sessionResults, currentIndex, result);

    setCurrentAnswer(null);
    setCurrentResult(result);
    setCurrentAnswered(!isMockExam);
    setSessionResults(nextResults);

    if (!isMockExam) {
      setHistory((prev) => updateLearningHistory(prev, result));
    }

    if (isMockExam) {
      goNextQuestion(nextResults);
    }
  }

  function goNextQuestion(results) {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= sessionQuestions.length) {
      finishSession(results);
      return;
    }

    setCurrentIndex(nextIndex);
    applyQuestionState(nextIndex, results);
  }

  function finishSession(results) {
    const completedResults = results.filter(Boolean);
    const durationSeconds = sessionStartedAt ? Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000)) : 0;
    const missedIds = completedResults.filter((result) => !result.isCorrect).map((result) => result.question.id);

    setLastMissedQuestionIds(missedIds);

    if (mode === "mock_exam") {
      const summary = summarizeResults(completedResults, durationSeconds);

      setHistory((prev) => {
        const historyWithQuestionStats = completedResults.reduce(
          (nextHistory, result) => updateLearningHistory(nextHistory, result),
          prev
        );

        return {
          ...historyWithQuestionStats,
          mockExamAttempts: [
            ...(historyWithQuestionStats.mockExamAttempts ?? []),
            {
              id: createAttemptId(),
              answeredAt: new Date().toISOString(),
              questionCount: summary.questionCount,
              correct: summary.correct,
              wrong: summary.wrong,
              unanswered: summary.unanswered,
              score: summary.score,
              maxScore: summary.maxScore,
              accuracy: summary.accuracy,
              durationSeconds,
            },
          ],
        };
      });
    }

    setCurrentAnswer(null);
    setCurrentAnswered(false);
    setCurrentResult(null);
    setScreen("result");
  }

  function resetAllLearningHistory() {
    const ok = window.confirm("すべての学習履歴をリセットします。よろしいですか？");
    if (!ok) return;

    setHistory({
      questionStats: {},
      wrongQuestionIds: [],
      mockExamAttempts: [],
    });
    setLastMissedQuestionIds([]);
  }

  function resetMockExamHistory() {
    const ok = window.confirm("本番模擬の履歴だけをリセットします。よろしいですか？");
    if (!ok) return;

    setHistory((prev) => ({
      ...prev,
      mockExamAttempts: [],
    }));
  }

  function clearWrongReviewTargets() {
    const ok = window.confirm("誤答復習対象だけをクリアします。問題別の回答履歴は残ります。よろしいですか？");
    if (!ok) return;

    setHistory((prev) => ({
      ...prev,
      wrongQuestionIds: [],
    }));
  }

  function toggleQuestionDetail(questionId) {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);

      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }

      return next;
    });
  }

  const resultSummary = useMemo(() => {
    const durationSeconds = sessionStartedAt ? Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000)) : 0;
    return summarizeResults(completedSessionResults, durationSeconds);
  }, [completedSessionResults, sessionStartedAt]);

  const categoryResultRows = useMemo(() => {
    const map = new Map();

    completedSessionResults.forEach((result) => {
      const category = normalizeText(result.question.category) || "未設定";
      const current = map.get(category) ?? {
        category,
        total: 0,
        correct: 0,
        wrong: 0,
        unanswered: 0,
      };

      current.total += 1;

      if (result.isUnanswered) current.unanswered += 1;
      else if (result.isCorrect) current.correct += 1;
      else current.wrong += 1;

      map.set(category, current);
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      accuracy: row.total > 0 ? Math.round((row.correct / row.total) * 1000) / 10 : 0,
    }));
  }, [completedSessionResults]);

  const historyRows = useMemo(() => {
    const selectedCategorySet = new Set(historyFilters.categories ?? []);

    return questions
      .map((question) => {
        const stat = history.questionStats?.[question.id];
        const attempts = Number(stat?.attempts ?? 0);
        const correct = Number(stat?.correct ?? 0);
        const wrong = Number(stat?.wrong ?? 0);
        const unanswered = Number(stat?.unanswered ?? 0);
        const accuracy = attempts > 0 ? Math.round((correct / attempts) * 1000) / 10 : null;

        return {
          question,
          attempts,
          correct,
          wrong,
          unanswered,
          accuracy,
          lastResult: stat?.lastResult ?? "",
          lastAnsweredAt: stat?.lastAnsweredAt ?? "",
          isWrongReviewTarget: history.wrongQuestionIds?.includes(question.id) ?? false,
        };
      })
      .filter((row) => {
        if (selectedCategorySet.size > 0) {
          const category = normalizeText(row.question.category);
          if (!selectedCategorySet.has(category)) return false;
        }

        if (historyFilters.lowAccuracyOnly) {
          if (row.accuracy === null || row.accuracy >= LOW_ACCURACY_THRESHOLD) return false;
        }

        if (historyFilters.wrongOnly && !row.isWrongReviewTarget) {
          return false;
        }

        if (historyFilters.includeUnansweredOnly && row.unanswered <= 0) {
          return false;
        }

        return true;
      });
  }, [questions, history, historyFilters]);

  const historySummary = useMemo(() => {
    const stats = Object.values(history.questionStats ?? {});
    const total = stats.reduce((sum, stat) => sum + Number(stat.attempts ?? 0), 0);
    const correct = stats.reduce((sum, stat) => sum + Number(stat.correct ?? 0), 0);
    const wrong = stats.reduce((sum, stat) => sum + Number(stat.wrong ?? 0), 0);
    const unanswered = stats.reduce((sum, stat) => sum + Number(stat.unanswered ?? 0), 0);
    const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

    return {
      total,
      correct,
      wrong,
      unanswered,
      accuracy,
      wrongReviewCount: history.wrongQuestionIds?.length ?? 0,
    };
  }, [history]);

  const filteredQuestionList = useMemo(() => {
    const keyword = questionListFilters.keyword.trim().toLowerCase();
    const selectedCategorySet = new Set(questionListFilters.categories ?? []);

    return questions.filter((question) => {
      const category = normalizeText(question.category);

      if (keyword) {
        const target = [
          question.id,
          question.type,
          question.category,
          question.subCategory,
          question.question,
          question.explanation,
          ...(question.tags ?? []),
          ...(question.choices ?? []).map((choice) => choice.text),
          ...(question.choices ?? []).map((choice) => choice.explanation),
        ]
          .join(" ")
          .toLowerCase();

        if (!target.includes(keyword)) return false;
      }

      if (selectedCategorySet.size > 0 && !selectedCategorySet.has(category)) {
        return false;
      }

      if (questionListFilters.type !== "all" && question.type !== questionListFilters.type) {
        return false;
      }

      if (questionListFilters.hasImage && !question.image) {
        return false;
      }

      if (questionListFilters.hasExplanationImage && !question.explanationImage) {
        return false;
      }

      if (questionListFilters.noCategory && category) {
        return false;
      }

      return true;
    });
  }, [questions, questionListFilters]);

  const setupQuestionCount = useMemo(() => {
    const selectedCategorySet = new Set(setupCategories);

    return questions.filter((question) => {
      if (question.type !== setupType) return false;

      if (selectedCategorySet.size > 0) {
        const category = normalizeText(question.category);
        if (!selectedCategorySet.has(category)) return false;
      }

      return true;
    }).length;
  }, [questions, setupType, setupCategories]);

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticate={handleAuthenticate} />;
  }

  if (loadState.loading) {
    return (
      <div className="app-shell">
        <div className="loading-card">問題データを読み込み中...</div>
      </div>
    );
  }

  if (loadState.error) {
    return (
      <div className="app-shell">
        <div className="error-card">
          <h1>読み込みエラー</h1>
          <p>{loadState.error}</p>
          <p className="muted-text">public/data/questions.json を確認してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-kicker">技能競技大会</p>
          <h1>機械部門 学科試験</h1>
        </div>
        <div className="header-badge">
          <span>問題数</span>
          <strong>{questions.length}</strong>
        </div>
      </header>

      {screen === "menu" && (
        <MenuScreen
          totalQuestions={questions.length}
          topSummary={topSummary}
          dataMeta={questionDataMeta}
          wrongReviewOrder={wrongReviewOrder}
          wrongReviewOrderOptions={WRONG_REVIEW_ORDER_OPTIONS}
          onWrongReviewOrderChange={setWrongReviewOrder}
          onOpenTrueFalse={() => openSetup("true_false")}
          onOpenMultipleChoice={() => openSetup("multiple_choice")}
          onStartMockExam={startMockExamWithConfirm}
          onStartWrongReview={startWrongReview}
          onOpenHistory={() => setScreen("history")}
          onOpenQuestionList={() => setScreen("question_list")}
          canStartWrongReview={(history.wrongQuestionIds?.length ?? 0) > 0}
        />
      )}

      {screen === "setup" && (
        <SetupScreen
          setupType={setupType}
          setupCategories={setupCategories}
          setupCount={setupCount}
          setupOrder={setupOrder}
          orderOptions={PRACTICE_ORDER_OPTIONS}
          categories={categories}
          questionCount={setupQuestionCount}
          onToggleCategory={toggleSetupCategory}
          onClearCategories={clearSetupCategories}
          onCountChange={setSetupCount}
          onOrderChange={setSetupOrder}
          onStart={startPracticeFromSetup}
          onBack={backToMenu}
        />
      )}

      {screen === "practice" && (
        <PracticeScreen
          mode={mode}
          question={currentQuestion}
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          answeredCount={answeredCount}
          progressCurrentNumber={progressCurrentNumber}
          remainingCount={remainingCount}
          progressPercent={progressPercent}
          currentAnswer={currentAnswer}
          currentAnswered={currentAnswered}
          currentResult={currentResult}
          hasRecordedAnswer={hasCurrentRecordedResult}
          canGoPrevious={currentIndex > 0}
          onPrevious={goPreviousQuestion}
          onAnswer={handleAnswer}
          onUnanswered={handleUnanswered}
          onBack={isMockExam ? backToMenuFromMockExam : backToMenu}
        />
      )}

      {screen === "result" && (
        <ResultScreen
          mode={mode}
          summary={resultSummary}
          results={completedSessionResults}
          categoryRows={categoryResultRows}
          onBackToMenu={backToMenu}
          onReviewMissed={startLastMissedReview}
          showMissedReview={lastMissedQuestionIds.length > 0}
        />
      )}

      {screen === "history" && (
        <HistoryScreen
          summary={historySummary}
          mockExamAttempts={history.mockExamAttempts ?? []}
          rows={historyRows}
          categories={categories}
          filters={historyFilters}
          onFilterChange={setHistoryFilters}
          onResetAllHistory={resetAllLearningHistory}
          onResetMockExamHistory={resetMockExamHistory}
          onClearWrongReviewTargets={clearWrongReviewTargets}
          onBack={backToMenu}
        />
      )}

      {screen === "question_list" && (
        <QuestionListScreen
          questions={filteredQuestionList}
          categories={categories}
          filters={questionListFilters}
          expandedQuestionIds={expandedQuestionIds}
          onFilterChange={setQuestionListFilters}
          onToggleDetail={toggleQuestionDetail}
          onBack={backToMenu}
        />
      )}
    </div>
  );
}

function AuthScreen({ onAuthenticate }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const authenticated = onAuthenticate(password);

    if (!authenticated) {
      setError("パスワードが違います。");
      setPassword("");
    }
  }

  return (
    <div className="auth-shell">
      <main className="auth-card">
        <div>
          <p className="app-kicker">技能競技大会</p>
          <h1>機械部門 学科試験</h1>
          <p className="auth-description">利用を開始するにはパスワードを入力してください。</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoComplete="current-password"
              autoFocus
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button className="wide-button primary" type="submit">
            開始する
          </button>
        </form>

        <p className="auth-note">
          認証済み状態はこのブラウザに保存されます。新しい端末や別ブラウザでは再入力が必要です。
        </p>
      </main>
    </div>
  );
}

function MenuScreen({
  totalQuestions,
  topSummary,
  dataMeta,
  wrongReviewOrder,
  wrongReviewOrderOptions,
  onWrongReviewOrderChange,
  onOpenTrueFalse,
  onOpenMultipleChoice,
  onStartMockExam,
  onStartWrongReview,
  onOpenHistory,
  onOpenQuestionList,
  canStartWrongReview,
}) {
  return (
    <main className="screen">
      <section className="summary-grid">
        <div className="summary-card">
          <span>登録問題数</span>
          <strong>{totalQuestions}</strong>
        </div>
        <div className="summary-card">
          <span>総回答回数</span>
          <strong>{topSummary.totalAttempts}</strong>
        </div>
        <div className="summary-card">
          <span>誤答復習対象</span>
          <strong>{topSummary.wrongReviewCount}</strong>
        </div>
      </section>

      <VersionInfoPanel totalQuestions={totalQuestions} dataMeta={dataMeta} />

      <section className="menu-section">
        <div className="section-title-row">
          <h2>演習</h2>
        </div>

        <div className="menu-grid">
          <button className="menu-button primary" onClick={onOpenTrueFalse}>
            <span>○×演習</span>
            <small>カテゴリ・出題数・出題順を指定</small>
          </button>

          <button className="menu-button primary" onClick={onOpenMultipleChoice}>
            <span>択一演習</span>
            <small>カテゴリ・出題数・出題順を指定</small>
          </button>

          <button className="menu-button accent" onClick={onStartMockExam}>
            <span>本番模擬</span>
            <small>○×60問＋択一10問</small>
          </button>

          <button className="menu-button review" onClick={onStartWrongReview} disabled={!canStartWrongReview}>
            <span>誤答復習</span>
            <small>指定した順序で復習</small>
          </button>
        </div>

        <div className="wrong-review-toolbar">
          <label className="form-field">
            <span>誤答復習の出題順</span>
            <select value={wrongReviewOrder} onChange={(event) => onWrongReviewOrderChange(event.target.value)}>
              {wrongReviewOrderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="menu-section">
        <div className="section-title-row">
          <h2>確認</h2>
          <p>履歴と問題内容を確認します。</p>
        </div>

        <div className="menu-grid">
          <button className="menu-button history" onClick={onOpenHistory}>
            <span>学習履歴を確認</span>
            <small>点数推移・弱点確認・履歴リセット</small>
          </button>

          <button className="menu-button list" onClick={onOpenQuestionList}>
            <span>問題一覧</span>
            <small>検索・詳細確認</small>
          </button>
        </div>
      </section>
    </main>
  );
}

function VersionInfoPanel({ totalQuestions, dataMeta }) {
  return (
    <section className="version-panel">
      <div className="version-title-row">
        <div>
          <h2>バージョン情報</h2>
          <p className="muted-text">アプリと問題データの現在情報です。</p>
        </div>
      </div>

      <div className="version-grid">
        <div className="version-item">
          <span>アプリ</span>
          <strong>v{APP_VERSION}</strong>
        </div>
        <div className="version-item">
          <span>アプリ更新日</span>
          <strong>{APP_UPDATED_AT}</strong>
        </div>
        <div className="version-item">
          <span>問題データ版</span>
          <strong>{displayMetaValue(dataMeta.version)}</strong>
        </div>
        <div className="version-item">
          <span>問題データ更新日</span>
          <strong>{displayMetaValue(dataMeta.updatedAt)}</strong>
        </div>
        <div className="version-item">
          <span>登録問題数</span>
          <strong>{totalQuestions}</strong>
        </div>
        <div className="version-item">
          <span>仕様メモ</span>
          <strong>{APP_SPEC_NOTE}</strong>
        </div>
      </div>
    </section>
  );
}

function SetupScreen({
  setupType,
  setupCategories,
  setupCount,
  setupOrder,
  orderOptions,
  categories,
  questionCount,
  onToggleCategory,
  onClearCategories,
  onCountChange,
  onOrderChange,
  onStart,
  onBack,
}) {
  const title = setupType === "true_false" ? "○×演習" : "択一演習";
  const isAllSelected = setupCategories.length === 0;

  return (
    <main className="screen">
      <div className="page-title-row">
        <div>
          <p className="app-kicker">演習設定</p>
          <h2>{title}</h2>
        </div>
        <button className="ghost-button" onClick={onBack}>
          トップへ戻る
        </button>
      </div>

      <section className="panel">
        <div className="category-select-panel">
          <div className="category-select-header">
            <div>
              <h3>カテゴリ</h3>
              <p className="muted-text">
                複数選択できます。未選択の場合は、すべてのカテゴリから出題します。
              </p>
            </div>

            <button className="ghost-button small" onClick={onClearCategories} disabled={isAllSelected}>
              すべてに戻す
            </button>
          </div>

          <button
            type="button"
            className={`category-all-button ${isAllSelected ? "active" : ""}`}
            onClick={onClearCategories}
          >
            すべてのカテゴリ
          </button>

          <div className="category-checkbox-grid">
            {categories.map((category) => {
              const checked = setupCategories.includes(category);

              return (
                <label key={category} className={`category-check-button ${checked ? "checked" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => onToggleCategory(category)} />
                  <span>{category}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="form-field">
          <span>出題順</span>
          <select value={setupOrder} onChange={(event) => onOrderChange(event.target.value)}>
            {orderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>出題数</span>
          <input
            type="number"
            min="1"
            max={Math.max(questionCount, 1)}
            value={setupCount}
            onChange={(event) => onCountChange(event.target.value)}
          />
        </label>

        <div className="setup-status">
          対象問題数：<strong>{questionCount}</strong> 問
          {setupCategories.length > 0 && (
            <span className="selected-category-summary">選択中：{setupCategories.length}カテゴリ</span>
          )}
        </div>

        <button className="wide-button primary" onClick={onStart} disabled={questionCount === 0}>
          演習を開始
        </button>
      </section>
    </main>
  );
}

function PracticeScreen({
  mode,
  question,
  currentIndex,
  totalQuestions,
  answeredCount,
  progressCurrentNumber,
  remainingCount,
  progressPercent,
  currentAnswer,
  currentAnswered,
  currentResult,
  hasRecordedAnswer,
  canGoPrevious,
  onPrevious,
  onAnswer,
  onUnanswered,
  onBack,
}) {
  if (!question) {
    return (
      <main className="screen">
        <div className="empty-card">
          <h2>対象問題がありません</h2>
          <p>条件に合う問題がありません。</p>
          <button className="wide-button" onClick={onBack}>
            トップへ戻る
          </button>
        </div>
      </main>
    );
  }

  const isMockExam = mode === "mock_exam";
  const modeTitle = getModeTitle(mode);
  const answerDisabled = !isMockExam && currentAnswered;
  const nextButtonLabel = currentAnswered
    ? "次の問題へ"
    : isMockExam && hasRecordedAnswer
      ? "次の問題へ"
      : isMockExam
        ? "無回答で次へ"
        : "無回答で解説を見る";

  return (
    <main className="screen practice-screen">
      <div className="practice-top-bar">
        <div>
          <p className="app-kicker">{modeTitle}</p>
          <h2>
            {currentIndex + 1} / {totalQuestions} 問
          </h2>
        </div>
        <button className="ghost-button" onClick={onBack}>
          トップへ戻る
        </button>
      </div>

      {isMockExam && (
        <section className="mock-progress-card" aria-label="本番模擬の進捗">
          <div className="mock-progress-header">
            <div>
              <span className="mock-progress-label">本番模擬</span>
              <strong>
                {progressCurrentNumber} / {totalQuestions}問
              </strong>
            </div>
            <div className="mock-progress-remaining">残り {remainingCount}問</div>
          </div>

          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mock-progress-foot">
            <span>回答済み {answeredCount}問</span>
            <span>{progressPercent}%</span>
          </div>
        </section>
      )}

      <section className="question-card">
        <div className="question-meta-row">
          <span className="type-pill">{question.type === "true_false" ? "○×" : "択一"}</span>
          {!isMockExam && <span className="category-pill">{normalizeText(question.category) || "カテゴリ未設定"}</span>}
        </div>

        <p className="question-text">{question.question}</p>

        {renderImage(question.image, "問題画像")}

        {question.type === "true_false" ? (
          <div className="true-false-actions">
            <button
              className={`answer-button tf-button ${currentAnswer === true ? "selected" : ""}`}
              onClick={() => onAnswer(true)}
              disabled={answerDisabled}
            >
              ○
            </button>
            <button
              className={`answer-button tf-button ${currentAnswer === false ? "selected" : ""}`}
              onClick={() => onAnswer(false)}
              disabled={answerDisabled}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="choice-list">
            {getDisplayChoices(question).map((choice) => (
              <button
                key={choice.id}
                className={`answer-button choice-button ${currentAnswer === choice.id ? "selected" : ""}`}
                onClick={() => onAnswer(choice.id)}
                disabled={answerDisabled}
              >
                <span className="choice-id">{choice.id}</span>
                <span>{choice.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="practice-actions">
          <button className="wide-button secondary" onClick={onPrevious} disabled={!canGoPrevious}>
            前の問題へ
          </button>
          <button className="wide-button secondary" onClick={onUnanswered}>
            {nextButtonLabel}
          </button>
        </div>

        {!isMockExam && currentAnswered && currentResult && (
          <AnswerFeedback question={question} result={currentResult} />
        )}
      </section>
    </main>
  );
}

function AnswerFeedback({ question, result }) {
  return (
    <div className={`feedback-card ${result.isCorrect ? "correct" : "wrong"}`}>
      <div className="feedback-title">{result.isUnanswered ? "無回答" : result.isCorrect ? "正解" : "不正解"}</div>

      <div className="feedback-row">
        <span>正解</span>
        <strong>{getCorrectAnswerText(question)}</strong>
      </div>

      <div className="feedback-row">
        <span>問題ID</span>
        <strong>{question.id}</strong>
      </div>

      {question.explanation && (
        <div className="explanation-block">
          <h3>解説</h3>
          <p>{question.explanation}</p>
        </div>
      )}

      {question.type === "multiple_choice" && Array.isArray(question.choices) && (
        <div className="choice-explanations">
          <h3>選択肢ごとの解説</h3>
          {question.choices.map((choice) => (
            <div key={choice.id} className="choice-explanation-item">
              <strong>
                {choice.id}. {choice.text}
                {choice.isCorrect ? "（正解）" : ""}
              </strong>
              {choice.explanation && <p>{choice.explanation}</p>}
            </div>
          ))}
        </div>
      )}

      {renderImage(question.explanationImage, "解説画像")}

      {SHOW_DEBUG_INFO && <pre className="debug-block">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

function ResultScreen({ mode, summary, results, categoryRows, onBackToMenu, onReviewMissed, showMissedReview }) {
  const [showOnlyMissed, setShowOnlyMissed] = useState(false);

  const missedResults = results.filter((result) => !result.isCorrect);
  const displayResults = showOnlyMissed ? missedResults : results;

  return (
    <main className="screen result-screen">
      <div className="page-title-row">
        <div>
          <p className="app-kicker">{getModeTitle(mode)}</p>
          <h2>結果</h2>
        </div>
        <button className="ghost-button" onClick={onBackToMenu}>
          トップへ戻る
        </button>
      </div>

      <section className="summary-grid result-summary-grid">
        <div className="summary-card">
          <span>出題数</span>
          <strong>{summary.questionCount}</strong>
        </div>
        <div className="summary-card success">
          <span>正答数</span>
          <strong>{summary.correct}</strong>
        </div>
        <div className="summary-card danger">
          <span>誤答数</span>
          <strong>{summary.wrong}</strong>
        </div>
        <div className="summary-card warning">
          <span>無回答数</span>
          <strong>{summary.unanswered}</strong>
        </div>
        <div className="summary-card">
          <span>得点</span>
          <strong>{formatScore(summary.score)}</strong>
        </div>
        <div className="summary-card">
          <span>満点</span>
          <strong>{formatScore(summary.maxScore)}</strong>
        </div>
        <div className="summary-card">
          <span>所要時間</span>
          <strong>{formatDuration(summary.durationSeconds)}</strong>
        </div>
        <div className="summary-card">
          <span>正答率</span>
          <strong>{summary.accuracy}%</strong>
        </div>
      </section>

      {showMissedReview && (
        <section className="panel highlight-panel">
          <h3>間違えた問題だけ再演習</h3>
          <p>今回の演習で不正解または無回答だった問題だけを再演習できます。</p>
          <button className="wide-button primary" onClick={onReviewMissed}>
            間違えた問題だけ再演習する
          </button>
        </section>
      )}

      <section className="panel result-category-panel">
        <h3>カテゴリ別正答率</h3>

        {categoryRows.length === 0 ? (
          <p className="muted-text">表示する結果がありません。</p>
        ) : (
          <>
            <div className="table-scroll result-category-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>カテゴリ</th>
                    <th>出題数</th>
                    <th>正答</th>
                    <th>誤答</th>
                    <th>無回答</th>
                    <th>正答率</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>{row.total}</td>
                      <td>{row.correct}</td>
                      <td className={row.wrong > 0 ? "danger-text" : ""}>{row.wrong}</td>
                      <td className={row.unanswered > 0 ? "warning-text" : ""}>{row.unanswered}</td>
                      <td>{row.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="category-result-card-list">
              {categoryRows.map((row) => (
                <article key={row.category} className="category-result-card">
                  <div className="category-result-card-head">
                    <strong>{row.category}</strong>
                    <span>{row.accuracy}%</span>
                  </div>

                  <div className="category-result-card-stats">
                    <div>
                      <span>出題</span>
                      <strong>{row.total}</strong>
                    </div>
                    <div>
                      <span>正答</span>
                      <strong>{row.correct}</strong>
                    </div>
                    <div>
                      <span>誤答</span>
                      <strong className={row.wrong > 0 ? "danger-text" : ""}>{row.wrong}</strong>
                    </div>
                    <div>
                      <span>無回答</span>
                      <strong className={row.unanswered > 0 ? "warning-text" : ""}>{row.unanswered}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel result-answer-panel">
        <div className="result-list-header">
          <div>
            <h3>解答一覧</h3>
            <p className="muted-text">
              表示中：{displayResults.length} / {results.length} 問
            </p>
          </div>

          <label className="result-filter-toggle">
            <input
              type="checkbox"
              checked={showOnlyMissed}
              onChange={(event) => setShowOnlyMissed(event.target.checked)}
              disabled={missedResults.length === 0}
            />
            <span>不正解・無回答のみ表示</span>
          </label>
        </div>

        {showOnlyMissed && missedResults.length === 0 ? (
          <div className="empty-result-filter">
            <strong>不正解・無回答はありません。</strong>
            <p className="muted-text">全問正解です。</p>
          </div>
        ) : displayResults.length === 0 ? (
          <div className="empty-result-filter">
            <strong>表示する解答がありません。</strong>
          </div>
        ) : (
          <div className="result-list">
            {displayResults.map((result) => {
              const originalIndex = results.findIndex(
                (item) => item.question.id === result.question.id && item.answeredAt === result.answeredAt
              );

              return (
                <div
                  key={`${result.question.id}-${result.answeredAt}`}
                  className={`result-item ${result.isCorrect ? "correct" : "wrong"}`}
                >
                  <div className="result-item-head">
                    <strong>
                      {originalIndex + 1}. {result.question.id}
                    </strong>
                    <span>{result.isUnanswered ? "無回答" : result.isCorrect ? "正解" : "不正解"}</span>
                  </div>

                  <p>{result.question.question}</p>

                  <div className="result-answer-row">
                    <span>あなたの回答：{result.userAnswerText}</span>
                    <span>正解：{getCorrectAnswerText(result.question)}</span>
                  </div>

                  {result.question.explanation && <p className="muted-text">{result.question.explanation}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function HistoryScreen({
  summary,
  mockExamAttempts,
  rows,
  categories,
  filters,
  onFilterChange,
  onResetAllHistory,
  onResetMockExamHistory,
  onClearWrongReviewTargets,
  onBack,
}) {
  const selectedCategories = Array.isArray(filters.categories) ? filters.categories : [];
  const isAllSelected = selectedCategories.length === 0;

  function toggleCategory(category) {
    onFilterChange((prev) => {
      const currentCategories = Array.isArray(prev.categories) ? prev.categories : [];

      if (currentCategories.includes(category)) {
        return {
          ...prev,
          categories: currentCategories.filter((item) => item !== category),
        };
      }

      return {
        ...prev,
        categories: [...currentCategories, category],
      };
    });
  }

  function clearCategories() {
    onFilterChange((prev) => ({
      ...prev,
      categories: [],
    }));
  }

  return (
    <main className="screen">
      <div className="page-title-row">
        <div>
          <p className="app-kicker">確認</p>
          <h2>学習履歴</h2>
        </div>
        <button className="ghost-button" onClick={onBack}>
          トップへ戻る
        </button>
      </div>

      <section className="summary-grid">
        <div className="summary-card">
          <span>総回答回数</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-card success">
          <span>正解数</span>
          <strong>{summary.correct}</strong>
        </div>
        <div className="summary-card danger">
          <span>不正解数</span>
          <strong>{summary.wrong}</strong>
        </div>
        <div className="summary-card warning">
          <span>無回答数</span>
          <strong>{summary.unanswered}</strong>
        </div>
        <div className="summary-card">
          <span>全体正答率</span>
          <strong>{summary.accuracy}%</strong>
        </div>
        <div className="summary-card">
          <span>誤答復習対象数</span>
          <strong>{summary.wrongReviewCount}</strong>
        </div>
      </section>

      <section className="panel">
        <h3>本番模擬の点数推移</h3>
        {mockExamAttempts.length === 0 ? (
          <p className="muted-text">本番模擬の記録はまだありません。</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>実施日時</th>
                  <th>得点</th>
                  <th>満点</th>
                  <th>正答</th>
                  <th>誤答</th>
                  <th>無回答</th>
                  <th>正答率</th>
                  <th>所要時間</th>
                </tr>
              </thead>
              <tbody>
                {mockExamAttempts
                  .slice()
                  .reverse()
                  .map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{formatDateTime(attempt.answeredAt)}</td>
                      <td>{formatScore(attempt.score)}</td>
                      <td>{formatScore(attempt.maxScore)}</td>
                      <td>{attempt.correct}</td>
                      <td className={attempt.wrong > 0 ? "danger-text" : ""}>{attempt.wrong}</td>
                      <td className={attempt.unanswered > 0 ? "warning-text" : ""}>{attempt.unanswered}</td>
                      <td>{attempt.accuracy}%</td>
                      <td>{formatDuration(attempt.durationSeconds)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>問題別の弱点確認</h3>

        <div className="history-filter-layout">
          <div className="category-select-panel history-category-filter">
            <div className="category-select-header">
              <div>
                <h3>カテゴリ</h3>
                <p className="muted-text">複数選択できます。未選択の場合は、すべてのカテゴリを表示します。</p>
              </div>

              <button className="ghost-button small" onClick={clearCategories} disabled={isAllSelected}>
                すべてに戻す
              </button>
            </div>

            <button
              type="button"
              className={`category-all-button ${isAllSelected ? "active" : ""}`}
              onClick={clearCategories}
            >
              すべてのカテゴリ
            </button>

            <div className="category-checkbox-grid">
              {categories.map((category) => {
                const checked = selectedCategories.includes(category);

                return (
                  <label key={category} className={`category-check-button ${checked ? "checked" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCategory(category)} />
                    <span>{category}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="history-option-filter-grid">
            <label className="check-field">
              <input
                type="checkbox"
                checked={filters.lowAccuracyOnly}
                onChange={(event) => onFilterChange((prev) => ({ ...prev, lowAccuracyOnly: event.target.checked }))}
              />
              <span>正答率が低い問題</span>
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={filters.wrongOnly}
                onChange={(event) => onFilterChange((prev) => ({ ...prev, wrongOnly: event.target.checked }))}
              />
              <span>誤答復習対象</span>
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={filters.includeUnansweredOnly}
                onChange={(event) =>
                  onFilterChange((prev) => ({ ...prev, includeUnansweredOnly: event.target.checked }))
                }
              />
              <span>未回答を含む問題</span>
            </label>
          </div>
        </div>

        <div className="list-count">
          表示件数：{rows.length} 件
          {selectedCategories.length > 0 && (
            <span className="selected-category-summary">選択中：{selectedCategories.length}カテゴリ</span>
          )}
        </div>

        <div className="table-scroll history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>問題ID</th>
                <th>カテゴリ</th>
                <th>問題文</th>
                <th>回答回数</th>
                <th>正解</th>
                <th>不正解</th>
                <th>無回答</th>
                <th>正答率</th>
                <th>最後の結果</th>
                <th>最終回答日時</th>
                <th>復習対象</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.question.id}>
                  <td>{row.question.id}</td>
                  <td>{normalizeText(row.question.category) || "未設定"}</td>
                  <td className="wide-cell">{row.question.question}</td>
                  <td>{row.attempts}</td>
                  <td>{row.correct}</td>
                  <td className={row.wrong > 0 ? "danger-text" : ""}>{row.wrong}</td>
                  <td className={row.unanswered > 0 ? "warning-text" : ""}>{row.unanswered}</td>
                  <td>{row.accuracy === null ? "-" : `${row.accuracy}%`}</td>
                  <td>{formatResultLabel(row.lastResult)}</td>
                  <td>{formatDateTime(row.lastAnsweredAt)}</td>
                  <td>{row.isWrongReviewTarget ? "対象" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="history-card-list">
          {rows.length === 0 ? (
            <div className="empty-result-filter">
              <strong>表示する問題がありません。</strong>
              <p className="muted-text">絞り込み条件を変更してください。</p>
            </div>
          ) : (
            rows.map((row) => {
              const isLowAccuracy =
                row.accuracy !== null && row.accuracy < LOW_ACCURACY_THRESHOLD && row.attempts > 0;

              return (
                <article
                  key={row.question.id}
                  className={`history-question-card ${row.isWrongReviewTarget ? "review-target" : ""} ${
                    isLowAccuracy ? "low-accuracy" : ""
                  }`}
                >
                  <div className="history-card-head">
                    <div>
                      <strong>{row.question.id}</strong>
                      <span>{normalizeText(row.question.category) || "未設定"}</span>
                    </div>
                    <div className="history-card-badges">
                      {row.isWrongReviewTarget && <span className="status-badge danger">復習対象</span>}
                      {isLowAccuracy && <span className="status-badge warning">低正答率</span>}
                    </div>
                  </div>

                  <p className="history-card-question">{row.question.question}</p>

                  <div className="history-card-score">
                    <span>正答率</span>
                    <strong>{row.accuracy === null ? "-" : `${row.accuracy}%`}</strong>
                  </div>

                  <div className="history-card-stats">
                    <div>
                      <span>回答</span>
                      <strong>{row.attempts}</strong>
                    </div>
                    <div>
                      <span>正解</span>
                      <strong>{row.correct}</strong>
                    </div>
                    <div>
                      <span>不正解</span>
                      <strong className={row.wrong > 0 ? "danger-text" : ""}>{row.wrong}</strong>
                    </div>
                    <div>
                      <span>無回答</span>
                      <strong className={row.unanswered > 0 ? "warning-text" : ""}>{row.unanswered}</strong>
                    </div>
                  </div>

                  <div className="history-card-detail-grid">
                    <div>
                      <span>最後の結果</span>
                      <strong>{formatResultLabel(row.lastResult)}</strong>
                    </div>
                    <div>
                      <span>最終回答日時</span>
                      <strong>{formatDateTime(row.lastAnsweredAt)}</strong>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="panel reset-history-panel">
        <h3>学習履歴のリセット</h3>
        <p className="muted-text">削除する範囲を選択できます。</p>

        <div className="reset-action-grid">
          <button className="ghost-button danger" onClick={onResetAllHistory}>
            全履歴リセット
          </button>
          <button className="ghost-button danger" onClick={onResetMockExamHistory}>
            本番模擬履歴のみリセット
          </button>
          <button className="ghost-button danger" onClick={onClearWrongReviewTargets}>
            誤答復習対象のみクリア
          </button>
        </div>
      </section>
    </main>
  );
}

function QuestionListScreen({
  questions,
  categories,
  filters,
  expandedQuestionIds,
  onFilterChange,
  onToggleDetail,
  onBack,
}) {
  const selectedCategories = Array.isArray(filters.categories) ? filters.categories : [];
  const isAllSelected = selectedCategories.length === 0;

  function toggleCategory(category) {
    onFilterChange((prev) => {
      const currentCategories = Array.isArray(prev.categories) ? prev.categories : [];

      if (currentCategories.includes(category)) {
        return {
          ...prev,
          categories: currentCategories.filter((item) => item !== category),
        };
      }

      return {
        ...prev,
        categories: [...currentCategories, category],
      };
    });
  }

  function clearCategories() {
    onFilterChange((prev) => ({
      ...prev,
      categories: [],
    }));
  }

  return (
    <main className="screen">
      <div className="page-title-row">
        <div>
          <p className="app-kicker">確認</p>
          <h2>問題一覧</h2>
        </div>
        <button className="ghost-button" onClick={onBack}>
          トップへ戻る
        </button>
      </div>

      <section className="panel">
        <div className="filter-grid">
          <label className="form-field">
            <span>キーワード</span>
            <input
              type="text"
              value={filters.keyword}
              onChange={(event) => onFilterChange((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="問題文・解説・IDで検索"
            />
          </label>

          <label className="form-field">
            <span>形式</span>
            <select
              value={filters.type}
              onChange={(event) => onFilterChange((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="all">すべて</option>
              <option value="true_false">○×</option>
              <option value="multiple_choice">択一</option>
            </select>
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={filters.hasImage}
              onChange={(event) => onFilterChange((prev) => ({ ...prev, hasImage: event.target.checked }))}
            />
            <span>問題画像あり</span>
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={filters.hasExplanationImage}
              onChange={(event) => onFilterChange((prev) => ({ ...prev, hasExplanationImage: event.target.checked }))}
            />
            <span>解説画像あり</span>
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={filters.noCategory}
              onChange={(event) => onFilterChange((prev) => ({ ...prev, noCategory: event.target.checked }))}
            />
            <span>カテゴリ未設定</span>
          </label>

          <div className="question-list-category-filter">
            <div className="category-select-panel">
              <div className="category-select-header">
                <div>
                  <h3>カテゴリ</h3>
                  <p className="muted-text">複数選択できます。未選択の場合は、すべてのカテゴリを表示します。</p>
                </div>

                <button className="ghost-button small" onClick={clearCategories} disabled={isAllSelected}>
                  すべてに戻す
                </button>
              </div>

              <button
                type="button"
                className={`category-all-button ${isAllSelected ? "active" : ""}`}
                onClick={clearCategories}
              >
                すべてのカテゴリ
              </button>

              <div className="category-checkbox-grid">
                {categories.map((category) => {
                  const checked = selectedCategories.includes(category);

                  return (
                    <label key={category} className={`category-check-button ${checked ? "checked" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCategory(category)} />
                      <span>{category}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="question-list">
        <div className="list-count">
          表示件数：{questions.length} 件
          {selectedCategories.length > 0 && (
            <span className="selected-category-summary">選択中：{selectedCategories.length}カテゴリ</span>
          )}
        </div>

        {questions.map((question) => {
          const expanded = expandedQuestionIds.has(question.id);

          return (
            <article key={question.id} className="question-list-card">
              <div className="question-list-head">
                <div>
                  <strong>{question.id}</strong>
                  <div className="question-list-meta">
                    <span>{question.type === "true_false" ? "○×" : "択一"}</span>
                    <span>{normalizeText(question.category) || "カテゴリ未設定"}</span>
                    <span>問題画像：{question.image ? "あり" : "なし"}</span>
                    <span>解説画像：{question.explanationImage ? "あり" : "なし"}</span>
                  </div>
                </div>
                <button className="ghost-button small" onClick={() => onToggleDetail(question.id)}>
                  {expanded ? "閉じる" : "詳細表示"}
                </button>
              </div>

              <p className="question-list-text">{question.question}</p>

              {expanded && (
                <div className="question-detail">
                  <div className="detail-card">
                    <h4>基本情報</h4>
                    <DetailRow label="問題ID" value={question.id} />
                    <DetailRow label="形式" value={question.type === "true_false" ? "○×" : "択一"} />
                    <DetailRow label="カテゴリ" value={normalizeText(question.category) || "未設定"} />
                    <DetailRow label="サブカテゴリ" value={normalizeText(question.subCategory) || "-"} />
                    <DetailRow label="タグ" value={(question.tags ?? []).join(", ") || "-"} />
                  </div>

                  <div className="detail-card">
                    <h4>問題文</h4>
                    <p>{question.question}</p>
                    {renderImage(question.image, "問題画像")}
                  </div>

                  <div className="detail-card answer-detail-card">
                    <h4>正解</h4>
                    <p className="correct-answer-text">{getCorrectAnswerText(question)}</p>
                  </div>

                  {question.type === "multiple_choice" && Array.isArray(question.choices) && (
                    <div className="detail-card">
                      <h4>選択肢</h4>
                      {question.choices.map((choice) => (
                        <div key={choice.id} className="choice-explanation-item">
                          <strong>
                            {choice.id}. {choice.text}
                            {choice.isCorrect ? "（正解）" : ""}
                          </strong>
                          {choice.explanation && <p>{choice.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {question.explanation && (
                    <div className="detail-card">
                      <h4>総合解説</h4>
                      <p>{question.explanation}</p>
                      {renderImage(question.explanationImage, "解説画像")}
                    </div>
                  )}

                  {!question.explanation && renderImage(question.explanationImage, "解説画像")}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildAnswerResult(question, answer) {
  const isUnanswered = answer === null || answer === undefined || answer === "";
  const isCorrect = !isUnanswered && isAnswerCorrect(question, answer);
  const scoreUnit = question.type === "true_false" ? TRUE_FALSE_SCORE : MULTIPLE_CHOICE_SCORE;
  const scoreDelta = isUnanswered ? 0 : isCorrect ? scoreUnit : -scoreUnit;

  return {
    question,
    userAnswer: answer,
    userAnswerText: getUserAnswerText(question, answer),
    isCorrect,
    isUnanswered,
    scoreDelta,
    answeredAt: new Date().toISOString(),
  };
}

function isAnswerCorrect(question, answer) {
  if (question.type === "true_false") {
    return Boolean(question.answer) === Boolean(answer);
  }

  if (question.type === "multiple_choice") {
    const selected = (question.choices ?? []).find((choice) => choice.id === answer);
    return Boolean(selected?.isCorrect);
  }

  return false;
}

function getCorrectAnswerText(question) {
  if (question.type === "true_false") {
    return question.answer ? "○" : "×";
  }

  const correctChoices = (question.choices ?? []).filter((choice) => choice.isCorrect);
  if (correctChoices.length === 0) return "-";

  return correctChoices.map((choice) => `${choice.id}. ${choice.text}`).join(" / ");
}

function getUserAnswerText(question, answer) {
  if (answer === null || answer === undefined || answer === "") return "無回答";

  if (question.type === "true_false") {
    return answer ? "○" : "×";
  }

  const selected = (question.choices ?? []).find((choice) => choice.id === answer);
  return selected ? `${selected.id}. ${selected.text}` : String(answer);
}

function getDisplayChoices(question) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  if (!question.shuffleChoices) return choices;

  const cacheKey = `__displayChoices_${question.id}`;
  if (!question[cacheKey]) {
    Object.defineProperty(question, cacheKey, {
      value: shuffleArray(choices),
      enumerable: false,
      configurable: true,
    });
  }

  return question[cacheKey];
}

function updateLearningHistory(history, result) {
  const questionId = result.question.id;
  const previousStat = history.questionStats?.[questionId] ?? {
    attempts: 0,
    correct: 0,
    wrong: 0,
    unanswered: 0,
    lastResult: "",
    consecutiveCorrect: 0,
    lastAnsweredAt: "",
    lastWrongAt: "",
  };

  const lastResult = result.isUnanswered ? "unanswered" : result.isCorrect ? "correct" : "wrong";

  const nextStat = {
    attempts: previousStat.attempts + 1,
    correct: previousStat.correct + (result.isCorrect ? 1 : 0),
    wrong: previousStat.wrong + (!result.isCorrect && !result.isUnanswered ? 1 : 0),
    unanswered: previousStat.unanswered + (result.isUnanswered ? 1 : 0),
    lastResult,
    consecutiveCorrect: result.isCorrect ? previousStat.consecutiveCorrect + 1 : 0,
    lastAnsweredAt: result.answeredAt,
    lastWrongAt: result.isCorrect ? previousStat.lastWrongAt ?? "" : result.answeredAt,
  };

  const wrongSet = new Set(history.wrongQuestionIds ?? []);

  if (result.isCorrect) {
    if (nextStat.consecutiveCorrect >= 2) {
      wrongSet.delete(questionId);
    }
  } else {
    wrongSet.add(questionId);
  }

  return {
    ...history,
    questionStats: {
      ...(history.questionStats ?? {}),
      [questionId]: nextStat,
    },
    wrongQuestionIds: Array.from(wrongSet),
    mockExamAttempts: history.mockExamAttempts ?? [],
  };
}

function summarizeResults(results, durationSeconds) {
  const correct = results.filter((result) => result.isCorrect).length;
  const unanswered = results.filter((result) => result.isUnanswered).length;
  const wrong = results.length - correct - unanswered;
  const score = results.reduce((sum, result) => sum + result.scoreDelta, 0);
  const maxScore = results.reduce((sum, result) => {
    return sum + (result.question.type === "true_false" ? TRUE_FALSE_SCORE : MULTIPLE_CHOICE_SCORE);
  }, 0);
  const accuracy = results.length > 0 ? Math.round((correct / results.length) * 1000) / 10 : 0;

  return {
    questionCount: results.length,
    correct,
    wrong,
    unanswered,
    score: roundScore(score),
    maxScore: roundScore(maxScore),
    accuracy,
    durationSeconds,
  };
}

function orderQuestions(items, order, history) {
  if (order === "random") return shuffleArray(items);

  const rows = items.map((question, index) => {
    const stat = history.questionStats?.[question.id] ?? {};
    const attempts = Number(stat.attempts ?? 0);
    const correct = Number(stat.correct ?? 0);
    const wrong = Number(stat.wrong ?? 0);
    const unanswered = Number(stat.unanswered ?? 0);
    const mistakes = wrong + unanswered;
    const accuracy = attempts > 0 ? correct / attempts : 1.01;
    const lastAnsweredTime = toTime(stat.lastAnsweredAt);
    const lastWrongTime =
      toTime(stat.lastWrongAt) ||
      (stat.lastResult === "wrong" || stat.lastResult === "unanswered" ? lastAnsweredTime : 0);

    return {
      question,
      index,
      attempts,
      mistakes,
      accuracy,
      lastWrongTime,
    };
  });

  rows.sort((a, b) => {
    switch (order) {
      case "registered":
        return a.index - b.index;
      case "low_accuracy":
        return a.accuracy - b.accuracy || b.mistakes - a.mistakes || a.index - b.index;
      case "few_attempts":
        return a.attempts - b.attempts || a.index - b.index;
      case "last_wrong":
        return b.lastWrongTime - a.lastWrongTime || a.index - b.index;
      case "many_wrong":
        return b.mistakes - a.mistakes || a.accuracy - b.accuracy || a.index - b.index;
      default:
        return a.index - b.index;
    }
  });

  return rows.map((row) => row.question);
}

function stratifiedSampleByCategory(items, targetCount) {
  if (items.length <= targetCount) return shuffleArray(items);

  const groups = new Map();

  items.forEach((item) => {
    const category = normalizeText(item.category) || "未設定";
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  });

  const shuffledGroups = Array.from(groups.entries()).map(([category, group]) => ({
    category,
    items: shuffleArray(group),
    quota: Math.max(1, Math.round((group.length / items.length) * targetCount)),
  }));

  let selected = [];

  shuffledGroups.forEach((group) => {
    selected.push(...group.items.slice(0, group.quota));
  });

  if (selected.length > targetCount) {
    selected = shuffleArray(selected).slice(0, targetCount);
  }

  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((item) => item.id));
    const rest = shuffleArray(items.filter((item) => !selectedIds.has(item.id)));
    selected.push(...rest.slice(0, targetCount - selected.length));
  }

  return shuffleArray(selected);
}

function shuffleArray(array) {
  const next = [...array];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

function loadAuthentication() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return DEFAULT_HISTORY;

    const parsed = JSON.parse(raw);

    return {
      questionStats: parsed.questionStats ?? {},
      wrongQuestionIds: Array.isArray(parsed.wrongQuestionIds) ? parsed.wrongQuestionIds : [],
      mockExamAttempts: Array.isArray(parsed.mockExamAttempts) ? parsed.mockExamAttempts : [],
    };
  } catch {
    return DEFAULT_HISTORY;
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function renderImage(src, alt) {
  if (!src) return null;

  const rawSrc = String(src).trim();
  if (!rawSrc) return null;

  const normalizedSrc =
    rawSrc.startsWith("http://") || rawSrc.startsWith("https://") || rawSrc.startsWith("data:")
      ? rawSrc
      : `${import.meta.env.BASE_URL}${rawSrc.replace(/^\/+/, "").replace(/^\.?\//, "")}`;

  return (
    <div className="image-wrap">
      <img src={normalizedSrc} alt={alt} />
    </div>
  );
}

function getModeTitle(mode) {
  switch (mode) {
    case "true_false_practice":
      return "○×演習";
    case "multiple_choice_practice":
      return "択一演習";
    case "mock_exam":
      return "本番模擬";
    case "wrong_review":
      return "誤答復習";
    case "missed_review":
      return "間違えた問題だけ再演習";
    default:
      return "演習";
  }
}

function formatResultLabel(value) {
  switch (value) {
    case "correct":
      return "正解";
    case "wrong":
      return "不正解";
    case "unanswered":
      return "無回答";
    default:
      return "-";
  }
}

function formatScore(value) {
  return roundScore(value).toFixed(1);
}

function roundScore(value) {
  return Math.round(Number(value) * 10) / 10;
}

function formatDuration(seconds) {
  const safeSeconds = Number(seconds) || 0;
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;

  if (minutes <= 0) return `${restSeconds}秒`;
  return `${minutes}分${restSeconds}秒`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function displayMetaValue(value) {
  return normalizeText(value) || "-";
}

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function createAttemptId() {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toTime(value) {
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default App;