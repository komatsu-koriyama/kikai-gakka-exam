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

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function formatTrueFalse(value) {
  return value ? "○" : "×";
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

  const activeQuestions =
    mode === "true_false" ? trueFalseQuestions : multipleChoiceQuestions;

  const currentQuestion = activeQuestions[currentIndex];

  const isFinished =
    mode !== "menu" &&
    activeQuestions.length > 0 &&
    currentIndex >= activeQuestions.length;

  useEffect(() => {
    if (mode !== "multiple_choice" || !currentQuestion?.choices) {
      setDisplayChoices([]);
      return;
    }

    if (currentQuestion.shuffleChoices) {
      setDisplayChoices(shuffleArray(currentQuestion.choices));
    } else {
      setDisplayChoices(currentQuestion.choices);
    }
  }, [mode, currentQuestion]);

  const resetPracticeState = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setSelectedChoiceId(null);
    setIsAnswered(false);
    setResults([]);
    setDisplayChoices([]);
  };

  const startMode = (nextMode) => {
    resetPracticeState();
    setMode(nextMode);
  };

  const backToMenu = () => {
    resetPracticeState();
    setMode("menu");
  };

  const handleTrueFalseAnswer = (answer) => {
    if (isAnswered || !currentQuestion) return;

    const isCorrect = answer === currentQuestion.answer;
    const score = isCorrect
      ? SCORE_RULES.true_false.correct
      : SCORE_RULES.true_false.wrong;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    setResults((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedAnswer: answer,
        correctAnswer: currentQuestion.answer,
        isCorrect,
        score,
      },
    ]);
  };

  const handleMultipleChoiceAnswer = (choice) => {
    if (isAnswered || !currentQuestion) return;

    const isCorrect = choice.isCorrect;
    const score = isCorrect
      ? SCORE_RULES.multiple_choice.correct
      : SCORE_RULES.multiple_choice.wrong;

    setSelectedChoiceId(choice.id);
    setIsAnswered(true);

    setResults((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedChoiceId: choice.id,
        correctChoiceId:
          currentQuestion.choices.find((item) => item.isCorrect)?.id ?? "",
        isCorrect,
        score,
      },
    ]);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setSelectedChoiceId(null);
    setIsAnswered(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleRestart = () => {
    resetPracticeState();
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
    return (
      <main className="container">
        <h1>学科試験演習アプリ PoC</h1>

        <section className="card">
          <h2>演習モード選択</h2>
          <p>現在のPoCでは、○×演習と択一演習を実装しています。</p>
          <p>問題数：{data.questionCount}問</p>
          <p>○×問題：{trueFalseQuestions.length}問</p>
          <p>択一問題：{multipleChoiceQuestions.length}問</p>

          <div className="menu-buttons">
            <button
              type="button"
              className="button primary"
              onClick={() => startMode("true_false")}
              disabled={trueFalseQuestions.length === 0}
            >
              ○×演習を開始
            </button>

            <button
              type="button"
              className="button primary"
              onClick={() => startMode("multiple_choice")}
              disabled={multipleChoiceQuestions.length === 0}
            >
              択一演習を開始
            </button>
          </div>
        </section>

        <section className="card">
          <h2>採点ルール</h2>
          <p>○×問題：正解 +0.2点、不正解 -0.2点</p>
          <p>択一問題：正解 +0.4点、不正解 -0.4点</p>
          <p>合計点がマイナスになった場合も、そのまま表示します。</p>
        </section>
      </main>
    );
  }

  if (activeQuestions.length === 0) {
    return (
      <main className="container">
        <h1>{mode === "true_false" ? "○×演習" : "択一演習"}</h1>
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
    const correctCount = results.filter((result) => result.isCorrect).length;
    const wrongCount = results.filter((result) => !result.isCorrect).length;
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const maxScore =
      activeQuestions.length *
      (mode === "true_false"
        ? SCORE_RULES.true_false.correct
        : SCORE_RULES.multiple_choice.correct);

    return (
      <main className="container">
        <h1>{mode === "true_false" ? "○×演習 結果" : "択一演習 結果"}</h1>

        <section className="card">
          <p>出題数：{activeQuestions.length}問</p>
          <p>正答数：{correctCount}問</p>
          <p>誤答数：{wrongCount}問</p>
          <p>
            得点：{totalScore.toFixed(1)} / {maxScore.toFixed(1)} 点
          </p>
        </section>

        <section className="card">
          <h2>解答一覧</h2>
          <ol>
            {results.map((result, index) => {
              const question = activeQuestions[index];

              if (question.type === "true_false") {
                return (
                  <li key={result.questionId} className="review-item">
                    <p>
                      <strong>{question.id}</strong>：
                      {result.isCorrect ? "正解" : "不正解"}
                    </p>
                    <p>問題文：{question.question}</p>

                    <QuestionImage
                      src={question.image}
                      label={`${question.id}の問題画像`}
                    />

                    <p>
                      あなたの回答：{formatTrueFalse(result.selectedAnswer)} ／
                      正解：{formatTrueFalse(result.correctAnswer)}
                    </p>

                    {question.explanation && (
                      <p>解説：{question.explanation}</p>
                    )}

                    <QuestionImage
                      src={question.explanationImage}
                      label={`${question.id}の解説画像`}
                    />
                  </li>
                );
              }

              const selectedChoice = question.choices.find(
                (choice) => choice.id === result.selectedChoiceId
              );
              const correctChoice = question.choices.find(
                (choice) => choice.isCorrect
              );

              return (
                <li key={result.questionId} className="review-item">
                  <p>
                    <strong>{question.id}</strong>：
                    {result.isCorrect ? "正解" : "不正解"}
                  </p>
                  <p>問題文：{question.question}</p>

                  <QuestionImage
                    src={question.image}
                    label={`${question.id}の問題画像`}
                  />

                  <p>
                    あなたの回答：{result.selectedChoiceId}.{" "}
                    {selectedChoice?.text}
                  </p>
                  <p>
                    正解：{correctChoice?.id}. {correctChoice?.text}
                  </p>

                  {question.explanation && (
                    <p>総合解説：{question.explanation}</p>
                  )}

                  <QuestionImage
                    src={question.explanationImage}
                    label={`${question.id}の解説画像`}
                  />

                  <div className="choice-explanations">
                    <p>選択肢ごとの解説：</p>
                    <ul>
                      {question.choices.map((choice) => (
                        <li key={choice.id}>
                          <strong>
                            {choice.id}. {choice.text}
                          </strong>
                          <br />
                          {choice.explanation || "解説なし"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="action-row">
          <button type="button" className="button" onClick={handleRestart}>
            もう一度実施する
          </button>
          <button type="button" className="button secondary" onClick={backToMenu}>
            トップへ戻る
          </button>
        </div>
      </main>
    );
  }

  if (mode === "true_false") {
    return (
      <main className="container">
        <h1>○×演習</h1>

        <section className="card">
          <p className="progress">
            {currentIndex + 1} / {activeQuestions.length} 問
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
              onClick={() => handleTrueFalseAnswer(true)}
              disabled={isAnswered}
            >
              ○
            </button>
            <button
              type="button"
              className="answer-button"
              onClick={() => handleTrueFalseAnswer(false)}
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

              <button type="button" className="button" onClick={handleNext}>
                {currentIndex + 1 === activeQuestions.length
                  ? "結果を見る"
                  : "次の問題"}
              </button>
            </div>
          )}

          <button type="button" className="text-button" onClick={backToMenu}>
            トップへ戻る
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>択一演習</h1>

      <section className="card">
        <p className="progress">
          {currentIndex + 1} / {activeQuestions.length} 問
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
            }

            return (
              <button
                key={choice.id}
                type="button"
                className={className}
                onClick={() => handleMultipleChoiceAnswer(choice)}
                disabled={isAnswered}
              >
                <span className="display-label">{displayLabel}</span>
                <span>{choice.text}</span>
                <span className="original-id">元ID：{choice.id}</span>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div
            className={
              displayChoices.find((choice) => choice.id === selectedChoiceId)
                ?.isCorrect
                ? "result correct"
                : "result wrong"
            }
          >
            <p>
              {displayChoices.find((choice) => choice.id === selectedChoiceId)
                ?.isCorrect
                ? "正解"
                : "不正解"}
            </p>

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

            <div className="choice-explanations">
              <p>選択肢ごとの解説：</p>
              <ul>
                {currentQuestion.choices.map((choice) => (
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

            <button type="button" className="button" onClick={handleNext}>
              {currentIndex + 1 === activeQuestions.length
                ? "結果を見る"
                : "次の問題"}
            </button>
          </div>
        )}

        <button type="button" className="text-button" onClick={backToMenu}>
          トップへ戻る
        </button>
      </section>
    </main>
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
      <p>カテゴリ：{question.category ?? "未設定"}</p>
      <p>サブカテゴリ：{question.subCategory ?? "未設定"}</p>

      {question.tags?.length > 0 && <p>タグ：{question.tags.join("、")}</p>}
    </div>
  );
}

export default App;