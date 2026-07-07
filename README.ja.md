<p align="center">
  <picture>
    <img  alt="ShowSignature-header-2" src="https://github.com/user-attachments/assets/311e83f7-b2db-4e11-afb7-9d8f6e2e8d25" >
  </picture>
</p>

# showsignature

言語:
- [English](README.md)
- [简体中文](README.zh-CN.md)
- 日本語
- [Español](README.es.md)
- [Русский](README.ru.md)
- [العربية](README.ar.md)

ソースファイルから有用な構造を抽出する CLI です: signatures、imports、types、variables、comments、Markdown セクション、JSON shapes。

コードベースをすばやく理解したり、ファイルをレビューしたり、AI アシスタント向けのコンパクトなコンテキストを作成したりするために使えます。

<p align="center">
  <img width="1723" height="623" alt="example-showsignature-1" src="https://github.com/user-attachments/assets/36b636af-c3b3-485a-852d-fd0f3cce6321" />
</p>

## インストール

### 1. NPM registry からローカルまたはグローバルにインストール

`showsignature` は bash ツールとして実行されるため、ローカルまたはグローバルで利用可能である必要があります。

```bash
#npm|pnpm|yarn
# グローバルインストール
npm install -g showsignature

# ローカルインストール
npm install showsignature
```

## 2. AI Agent を設定する

<details id="claude-code">
<summary>
<h2>Claude Code</h2>
</summary>
  
```bash
/plugin marketplace add FredySandoval/showsignature
```

```bash
/plugin install showsignature@showsignature
```

（インストールを機能させるには、2 つのプロンプトを別々に送信する必要があります）

デスクトップアプリには /plugin コマンドがありません。代わりに UI からインストールしてください: Customize、personal plugins の横にある +、Create plugin and add marketplace、Add from repository の順に選択し、リポジトリ URL を入力します。

</details>

<details id="codex">
<summary>
<h2>Codex</h2>
</summary>

```sh
codex plugin marketplace add FredySandoval/showsignature
codex
```

/plugins を開き、`showsignature` marketplace を選択して `showsignature` をインストールします。次に /hooks を開き、ライフサイクル hook を確認して信頼し、新しいスレッドを開始します。

この同じインストールは Codex デスクトップアプリにも対応します: インストール後にアプリを再起動すると plugin が読み込まれます。

</details>

<details id="agent-skill">
<summary>
<h2>Agent Skill</h2>
</summary>
  
```bash
# すべての agents
npx skills add https://github.com/FredySandoval/showsignature --skill showsignature
```
</details>

<details id="pi-agent-extension">
<summary>
<h2>Pi agent extension</h2>
</summary>
  
```bash
# オプション 1
pi install npm:showsignature
# オプション 2
pi install git:github.com/FredySandoval/showsignature
# オプション 3
pi install https://github.com/FredySandoval/showsignature
```
</details>

<details id="from-source">
<summary>
<h2>ソースコードから</h2>
</summary>
  
```bash
git clone https://github.com/FredySandoval/showsignature.git
cd showsignature
pnpm install
pnpm build
pnpm link --global
```
</details>

## なぜ？

大きなファイルにはノイズが多く含まれます。`showsignature` は実装を読む前に、プロジェクトの形を示します:

- どの関数/クラスが存在するか？
- 各ファイルは何を import/export しているか？
- データを定義している types と interfaces は何か？
- Markdown にはどの headings/tables/code blocks があるか？
- JSON ファイルはどのような shape か？

## 使い方

```sh
showsignature map  [OPTION]... [FILE]...
showsignature read [OPTION] <FILE>
```

[FILE] オペランド（ファイルまたはディレクトリパス）を検査します。既定では現在のディレクトリを使用します。

| OPTION                | 説明                                                  |
| --------------------- | ----------------------------------------------------- |
| `--lang-only <lang>`  | 言語を強制します。`-` で stdin を読む場合に必須です。 |
| `--show-only <items>` | extractors を選択します。                             |
| `--include-tests`     | フォルダスキャンにテストファイルを含めます。          |
| `--max-depth <n>`     | フォルダスキャンの深さを制限します。                  |

## Extractors

コードファイル:

| Mode         | 表示内容                                                           |
| ------------ | ------------------------------------------------------------------ |
| `signatures` | 関数、クラス、メソッド、コンストラクタ。                           |
| `imports`    | Import 文/宣言。                                                   |
| `exports`    | JS/TS exports、エクスポートされた Go 宣言、Python public exports。 |
| `interfaces` | TypeScript/Go interfaces。                                         |
| `types`      | 型エイリアス/宣言。                                                |
| `variables`  | 変数/定数。                                                        |
| `comments`   | コードコメント。                                                   |

Markdown と JSON ファイル:

| Mode            | 表示内容                     |
| --------------- | ---------------------------- |
| `md:headings`   | 見出し。                     |
| `md:tables`     | 表。                         |
| `md:codeblocks` | フェンス付きコードブロック。 |
| `json:shape`    | JSON 値の shape。            |

## 対応ファイル

| Language   | Extensions            |
| ---------- | --------------------- |
| TypeScript | `.ts`, `.mts`, `.cts` |
| JavaScript | `.js`, `.mjs`, `.cjs` |
| TSX/JSX    | `.tsx`, `.jsx`        |
| Svelte     | `.svelte`             |
| Go         | `.go`                 |
| Python     | `.py`                 |
| Rust       | `.rs`                 |
| Lua        | `.lua`                |
| Markdown   | `.md`                 |
| JSON       | `.json`               |

## 基本的な使用例

`showsignature map [OPTION]... [FILE]...` / `showsignature read [OPTION] <FILE>`

```sh
showsignature map ./src                                         # フォルダを検査
showsignature map src/01-main.ts                                # 1 つのファイルを検査

showsignature map src/main.ts README.md tests/fixtures          # [FILE] は 1 つ以上のファイル/ディレクトリにできます
showsignature map --show-only imports,exports                   # exports のみ表示
showsignature map --show-only signatures,imports,exports ./src  # コード構造と imports を表示
showsignature map --show-only interfaces,types ./folder         # データ shape を表示
showsignature map --show-only variables,comments src/main.ts    # variables を表示

showsignature map --show-only md:headings                       # Markdown headings を抽出
showsignature map --show-only md:tables,md:codeblocks           # Markdown tables を抽出
showsignature map --show-only json:shape config.json            # JSON shape を抽出

# ある言語から別の言語へ移行するときに便利
showsignature map --lang-only py                                # Python ファイルのみ処理
showsignature map --lang-only go --show-only imports,exports    # Go imports と exported declarations を表示
showsignature map --lang-only py --show-only types,comments     # Python imports と public exports を表示
showsignature map --max-depth 4                                 # 再帰スキャンの深さを制限
```

モードはカンマで組み合わせます:

```bash
showsignature map src --show-only signatures,imports,comments
```

## 出力

`showsignature` はコンパクトなテキスト出力を表示します。shell リダイレクトを使って出力をファイルに保存できます:

```bash
showsignature map src --show-only signatures > structure.txt
```

## Pipeline での使用

`showsignature` は既定で stdout に書き込むため、`rg`、`grep`、`fzf`、`less`、`head`、`tee`、shell リダイレクトなどのツールとうまく連携します。

```sh
showsignature map src --show-only imports | rg "node"                         # 一致する imports を探す
showsignature map src --show-only signatures | rg "async"                     # async 関数またはメソッドを探す
showsignature map src --show-only comments,signatures | rg -C 2 "ExtractKind" # 近くのコンテキスト付きで comments/signatures を検索
showsignature map src --show-only signatures,imports | bat -l js              # 大きな出力をページ表示
```

## 開発

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## ライセンス

ISC。[LICENSE](LICENSE) を参照してください。
