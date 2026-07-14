# 機械部門 学科試験

技能競技大会「機械部門 学科試験」向けの演習用Webアプリです。

スマートフォンでの利用を前提に、○×問題、択一問題、本番模擬、誤答復習、学習履歴確認、問題一覧確認を行える構成にしています。

## 公開URL

```text
https://komatsu-koriyama.github.io/kikai-gakka-exam/
````

## 現在のバージョン

```text
アプリバージョン: v0.7.8
更新日: 2026-07-09
```

## 主な機能

### 1. ○×演習

○×形式の問題を対象に演習できます。

主な機能は以下です。

```text
カテゴリ選択
出題数指定
出題順選択
回答後の正誤表示
解答・解説表示
問題画像表示
解説画像表示
前の問題へ戻る
- 更新履歴確認
- 競技実施要領書PDFの確認
```

### 2. 択一演習

択一形式の問題を対象に演習できます。

主な機能は以下です。

```text
カテゴリ選択
出題数指定
出題順選択
回答後の正誤表示
解答・解説表示
選択肢ごとの解説表示
問題画像表示
解説画像表示
前の問題へ戻る
```

### 3. 本番模擬

本番形式に近い構成で模擬演習を行います。

現在の仕様は以下です。

```text
出題数: 70問
構成: ○×60問 + 択一10問
出題順: ○×60問を先に出題し、その後に択一10問を出題
計算問題: 現段階では除外
カテゴリ: 演習中は非表示
回答後: 自動で次の問題へ進む
無回答: 許可
前の問題へ戻る: 可能
回答修正: 可能
```

本番模擬では、前の問題へ戻った場合に回答を修正できます。

### 4. 誤答復習

不正解または無回答だった問題を復習対象として管理します。

主な仕様は以下です。

```text
不正解または無回答の問題を復習対象に追加
同じ問題を連続2回正解すると復習対象から除外
出題順を選択可能
前の問題へ戻ることが可能
戻った問題の回答修正は不可
```

出題順は以下から選択できます。

```text
正答率が低い順
最後に間違えた順
不正解・無回答が多い順
ランダム
登録順
```

### 5. 学習履歴

localStorageに保存された学習履歴を確認できます。

確認できる内容は以下です。

```text
総回答回数
正解数
不正解数
無回答数
全体正答率
誤答復習対象数
本番模擬の点数推移
問題別の回答履歴
問題別の正答率
```

履歴リセットは以下の範囲で実行できます。

```text
全履歴リセット
本番模擬履歴のみリセット
誤答復習対象のみクリア
```

### 6. 問題一覧

登録されている問題を一覧表示できます。

検索・絞り込み条件は以下です。

```text
キーワード検索
カテゴリ絞り込み
問題形式
問題画像あり
解説画像あり
カテゴリ未設定
```

問題ごとに詳細表示を開くことで、問題文、正解、選択肢、解説、画像を確認できます。

## 簡易パスワード認証

このアプリには、誤アクセス防止を目的とした簡易パスワード認証を実装しています。

仕様は以下です。

```text
初回アクセス時にパスワード入力画面を表示
認証成功後、通常のトップ画面を表示
認証済み状態はブラウザの localStorage に保存
同じ端末・同じブラウザでは次回から入力不要
新しい端末、別ブラウザ、シークレットモード、localStorage削除後は再入力が必要
```

注意点として、この認証は本格的なアクセス制限ではありません。

GitHub Pagesは静的サイトのため、JavaScript、questions.json、画像ファイル自体は公開配信されます。したがって、この認証は「関係者以外の誤アクセス防止」を目的とした簡易的な仕組みです。

## 採点仕様

現在の採点仕様は以下です。

```text
○×問題
  正解: +0.2点
  不正解: -0.2点
  無回答: 0点

択一問題
  正解: +0.4点
  不正解: -0.4点
  無回答: 0点
```

合計点がマイナスになった場合でも、アプリ上ではマイナス表示を許可します。0点で丸めません。

## 現在の問題構成

現在のアプリでは、計算問題の導入は保留としています。

```text
対象: ○×問題、択一問題、品質関係問題
保留: 計算問題
```

本番模擬では、計算問題を除外し、70問構成で出題します。

## データ配置

問題データは以下に配置します。

```text
public/data/questions.json
```

問題画像、解説画像は以下に配置します。

```text
public/images/
```

GitHub Pagesで公開するため、画像パスはアプリ側で `import.meta.env.BASE_URL` を考慮して読み込みます。

## questions.json の基本構成

問題データは以下のような構成を想定しています。

```json
{
  "version": "2026",
  "updatedAt": "2026-07-09",
  "questionCount": 766,
  "questions": [
    {
      "id": "TF-001",
      "type": "true_false",
      "category": "機械一般",
      "question": "問題文",
      "answer": true,
      "explanation": "解説文",
      "image": "images/sample.png",
      "explanationImage": "images/sample_explanation.png",
      "isCalculation": false
    }
  ]
}
```

択一問題の場合は、以下のように `choices` を持ちます。

```json
{
  "id": "MC-001",
  "type": "multiple_choice",
  "category": "品質管理",
  "question": "問題文",
  "choices": [
    {
      "id": "A",
      "text": "選択肢A",
      "isCorrect": false,
      "explanation": "選択肢Aの解説"
    },
    {
      "id": "B",
      "text": "選択肢B",
      "isCorrect": true,
      "explanation": "選択肢Bの解説"
    }
  ],
  "explanation": "総合解説",
  "isCalculation": false
}
```

## 開発環境

このアプリは React + Vite で作成しています。

主なファイルは以下です。

```text
src/App.jsx
src/App.css
public/data/questions.json
public/images/
vite.config.js
.github/workflows/deploy.yml
README.md
```

## ローカル確認手順

依存関係をインストールします。

```powershell
npm install
```

開発サーバーを起動します。

```powershell
npm run dev
```

本番ビルドを確認する場合は、以下を実行します。

```powershell
Remove-Item -Recurse -Force dist
npm run build
npm run preview
```

ローカルのプレビューURLは以下です。

```text
http://localhost:4173/kikai-gakka-exam/
```

## GitHub Pages 用設定

`vite.config.js` では、GitHub Pages のリポジトリ名に合わせて `base` を設定します。

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/kikai-gakka-exam/",
  plugins: [react()],
});
```

## デプロイ手順

修正後、ローカルでビルド確認します。

```powershell
Remove-Item -Recurse -Force dist
npm run build
npm run preview
```

問題がなければコミットします。

```powershell
git add src/App.jsx src/App.css README.md
git commit -m "Update README and app documentation"
git push
```

GitHub Actions が成功すると、GitHub Pages に自動反映されます。

確認場所は以下です。

```text
GitHub
→ Actions
→ Deploy to GitHub Pages
```

最新の実行結果が `Success` になっていればデプロイ完了です。

## 公開後の確認項目

公開URLで以下を確認します。

```text
パスワード入力画面が表示される
正しいパスワードでトップ画面が表示される
問題数が表示される
○×演習が開始できる
択一演習が開始できる
本番模擬が開始できる
本番模擬で○×60問の後に択一10問が出題される
本番模擬で前の問題に戻って回答修正できる
誤答復習が開始できる
学習履歴を確認できる
問題一覧を確認できる
問題画像が表示される
解説画像が表示される
```

## localStorage に保存する情報

このアプリでは、ブラウザの localStorage に以下を保存します。

```text
kikaiGakkaExamAuthenticated
  簡易認証済み状態

kikaiGakkaExamLearningHistory
  学習履歴
  問題別回答履歴
  誤答復習対象
  本番模擬履歴
```

localStorageを削除すると、認証状態と学習履歴は削除されます。

## 注意事項

このアプリは学習・演習を目的とした補助ツールです。

実際の学科試験の出題構成、カテゴリ比率、法令問題の扱いなどは、正式な競技実施要領や最新資料を確認してください。

現時点では、計算問題はアプリ対象外として扱っています。

## 更新履歴

### v0.7.4

```text
簡易パスワード認証を追加
認証済み状態をlocalStorageに保存
新しい端末や別ブラウザでは再入力が必要な仕様に変更
```

### v0.7.3

```text
誤答復習、学習履歴、問題一覧のメニューボタンに色を追加
誤答復習: オレンジ系
学習履歴: グリーン系
問題一覧: シアン系
```

### v0.7.2

```text
本番模擬で前の問題へ戻った場合に回答修正できるよう変更
演習・復習では戻った問題の回答修正は不可
演習・復習の解答解説表示位置をボタン下へ変更
```

### v0.7.1

```text
上部タイトルを「機械部門 学科試験」に変更
トップ画面の説明文を削除
演習・本番模擬・復習に前の問題へ戻るボタンを追加
無回答時にも解答解説を表示
本番模擬の出題順を○×60問、択一10問に固定
GitHub Pages用に画像パスを補正
```

### v0.7.0

```text
本番模擬、誤答復習、学習履歴、問題一覧の基本機能を実装
スマートフォン向けUIを整備
```

### v0.7.8

```text
更新履歴ページを追加
競技実施要領書を確認できるページを追加
PDF形式の要領書をアプリ内または別タブで確認可能に変更