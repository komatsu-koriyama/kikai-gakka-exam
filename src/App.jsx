import { useEffect, useMemo, useState } from "react";
import "./App.css";

const TRUE_FALSE_SCORE = 0.2;

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [results, setResults] = useState([]);

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

  const currentQuestion = trueFalseQuestions[currentIndex];
  const isFinished =
    trueFalseQuestions.length > 0 && currentIndex >= trueFalseQuestions.length;

  const handleAnswer = (answer) => {
    if (isAnswered || !currentQuestion) return;

    const isCorrect = answer === currentQuestion.answer;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    setResults((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedAnswer: answer,
        correctAnswer: currentQuestion.answer,
        isCorrect,
        score: isCorrect ? TRUE_FALSE_SCORE : -TRUE_FALSE_SCORE,
      },
    ]);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setIsAnswered(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setResults([]);
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

  if (trueFalseQuestions.length === 0) {
    return (
      <main className="container">
        <h1>○×演習</h1>
        <section className="card">
          <p>○×問題がありません。</p>
        </section>
      </main>
    );
  }

  if (isFinished) {
    const correctCount = results.filter((result) => result.isCorrect).length;
    const wrongCount = results.filter((result) => !result.isCorrect).length;
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const maxScore = trueFalseQuestions.length * TRUE_FALSE_SCORE;

    return (
      <main className="container">
        <h1>○×演習 結果</h1>

        <section className="card">
          <p>出題数：{trueFalseQuestions.length}問</p>
          <p>正答数：{correctCount}問</p>
          <p>誤答数：{wrongCount}問</p>
          <p>
            得点：{totalScore.toFixed(1)} / {maxScore.toFixed(1)} 点
          </p>
          <p className="note">
            採点：正解 +0.2点、不正解 -0.2点、無回答 0点
          </p>
        </section>

        <section className="card">
          <h2>解答一覧</h2>
          <ol>
            {results.map((result, index) => {
              const question = trueFalseQuestions[index];

              return (
                <li key={result.questionId} className="review-item">
                  <p>
                    <strong>{question.id}</strong>：
                    {result.isCorrect ? "正解" : "不正解"}
                  </p>
                  <p>問題文：{question.question}</p>
                  <p>
                    あなたの回答：{result.selectedAnswer ? "○" : "×"} ／
                    正解：{result.correctAnswer ? "○" : "×"}
                  </p>
                  {question.explanation && (
                    <p>解説：{question.explanation}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <button type="button" className="button" onClick={handleRestart}>
          もう一度実施する
        </button>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>○×演習</h1>

      <section className="card">
        <p className="progress">
          {currentIndex + 1} / {trueFalseQuestions.length} 問
        </p>

        <p>ID：{currentQuestion.id}</p>
        <p>カテゴリ：{currentQuestion.category ?? "未設定"}</p>
        <p>サブカテゴリ：{currentQuestion.subCategory ?? "未設定"}</p>

        {currentQuestion.tags?.length > 0 && (
          <p>タグ：{currentQuestion.tags.join("、")}</p>
        )}

        <h2 className="question-text">{currentQuestion.question}</h2>

        <div className="answer-buttons">
          <button
            type="button"
            className="answer-button"
            onClick={() => handleAnswer(true)}
            disabled={isAnswered}
          >
            ○
          </button>
          <button
            type="button"
            className="answer-button"
            onClick={() => handleAnswer(false)}
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
              {selectedAnswer === currentQuestion.answer
                ? "正解"
                : "不正解"}
            </p>
            <p>正解：{currentQuestion.answer ? "○" : "×"}</p>

            {currentQuestion.explanation && (
              <p>解説：{currentQuestion.explanation}</p>
            )}

            <button type="button" className="button" onClick={handleNext}>
              {currentIndex + 1 === trueFalseQuestions.length
                ? "結果を見る"
                : "次の問題"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;