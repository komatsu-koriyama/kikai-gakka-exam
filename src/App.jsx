import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

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

  const questions = data.questions ?? [];
  const trueFalseCount = questions.filter((q) => q.type === "true_false").length;
  const multipleChoiceCount = questions.filter(
    (q) => q.type === "multiple_choice"
  ).length;
  const firstQuestion = questions[0];

  return (
    <main className="container">
      <h1>学科試験演習アプリ PoC</h1>

      <section className="card">
        <h2>JSON読込確認</h2>
        <p>schemaVersion：{data.schemaVersion}</p>
        <p>生成日時：{data.generatedAt}</p>
        <p>問題数：{data.questionCount}</p>
        <p>○×問題：{trueFalseCount}問</p>
        <p>択一問題：{multipleChoiceCount}問</p>
      </section>

      {firstQuestion && (
        <section className="card">
          <h2>最初の問題</h2>
          <p>ID：{firstQuestion.id}</p>
          <p>形式：{firstQuestion.type}</p>
          <p>カテゴリ：{firstQuestion.category ?? "未設定"}</p>
          <p>サブカテゴリ：{firstQuestion.subCategory ?? "未設定"}</p>
          <p>問題文：{firstQuestion.question}</p>

          {firstQuestion.choices && (
            <ul>
              {firstQuestion.choices.map((choice) => (
                <li key={choice.id}>
                  {choice.id}. {choice.text}
                  {choice.isCorrect ? "（正解）" : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

export default App;