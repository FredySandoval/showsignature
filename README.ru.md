<p align="center">
  <picture>
    <img  alt="ShowSignature-header-2" src="https://github.com/user-attachments/assets/311e83f7-b2db-4e11-afb7-9d8f6e2e8d25" >
  </picture>
</p>

# showsignature

Языки:
- [English](README.md)
- [简体中文](README.zh-CN.md)
- [日本語](README.ja.md)
- [Español](README.es.md)
- Русский
- [العربية](README.ar.md)

CLI, который извлекает полезную структуру из исходных файлов: signatures, imports, types, variables, comments, разделы Markdown и формы JSON.

Используйте его, чтобы быстро понять кодовую базу, просмотреть файлы или создать компактный контекст для AI-ассистентов.

<p align="center">
  <img width="1723" height="623" alt="example-showsignature-1" src="https://github.com/user-attachments/assets/36b636af-c3b3-485a-852d-fd0f3cce6321" />
</p>

## Установка

### 1. Установите локально или глобально из NPM registry

`showsignature` выполняется как bash-инструмент, поэтому он должен быть доступен локально или глобально.

```bash
#npm|pnpm|yarn
# глобальная установка
npm install -g showsignature

# локальная установка
npm install showsignature
```

## 2. Настройте своего AI Agent

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

(Чтобы установка сработала, нужно отправить два отдельных промпта)

В настольном приложении нет команды /plugin. Вместо этого установите его через UI: Customize, + рядом с personal plugins, Create plugin and add marketplace, Add from repository, затем введите URL репозитория.

</details>

<details id="codex">
<summary>
<h2>Codex</h2>
</summary>

```sh
codex plugin marketplace add FredySandoval/showsignature
codex
```

Откройте /plugins, выберите marketplace `showsignature` и установите `showsignature`. Затем откройте /hooks, проверьте и доверьте его lifecycle hook, и начните новый поток.

Эта же установка также подходит для настольного приложения Codex: перезапустите приложение после установки, и оно подхватит plugin.

</details>

<details id="agent-skill">
<summary>
<h2>Agent Skill</h2>
</summary>
  
```bash
# Все agents
npx skills add https://github.com/FredySandoval/showsignature --skill showsignature
```
</details>

<details id="pi-agent-extension">
<summary>
<h2>Pi agent extension</h2>
</summary>
  
```bash
# вариант 1
pi install npm:showsignature
# вариант 2
pi install git:github.com/FredySandoval/showsignature
# вариант 3
pi install https://github.com/FredySandoval/showsignature
```
</details>

<details id="from-source">
<summary>
<h2>Из исходного кода</h2>
</summary>
  
```bash
git clone https://github.com/FredySandoval/showsignature.git
cd showsignature
pnpm install
pnpm build
pnpm link --global
```
</details>

## Зачем?

Большие файлы шумные. `showsignature` показывает форму проекта до того, как вы начнете читать реализацию:

- Какие функции/классы существуют?
- Что каждый файл import/export?
- Какие types и interfaces определяют данные?
- Какие headings/tables/code blocks есть в Markdown?
- Какую форму имеет JSON-файл?

## Использование

```sh
showsignature map  [OPTION]... [FILE]...
showsignature read [OPTION] <FILE>
```

Две команды:

- `map` — структурный обзор: сигнатуры и другие извлечённые записи. Проверяет операнды [FILE] — файлы или пути к каталогам — по умолчанию используя текущий каталог.
- `read` — оконное дословное чтение ровно одного файла, обрамлённое «скелетом» сигнатур для ориентации.

Запуск `showsignature` без команды печатает справку и завершается с кодом 1.

Опции `showsignature map`:

| OPTION                | Описание                                                         |
| --------------------- | ---------------------------------------------------------------- |
| `--lang-only <lang>`  | Принудительно задает язык; требуется при чтении stdin через `-`. |
| `--show-only <items>` | Выбирает extractors.                                             |
| `--include-tests`     | Включает тестовые файлы при сканировании папок.                  |
| `--max-depth <n>`     | Ограничивает глубину сканирования (для каталогов по умолчанию `2`). |
| `--offset <n>`        | Пропускает первые N извлечённых **записей** (по умолчанию: 0).   |
| `--limit <n>`         | Максимум показанных извлечённых **записей**.                     |
| `--all`               | Отключает все ограничения вывода (лимит записей и порог 2000 строк / 50 КБ). |
| `--no-redact`         | Отключает встроенное скрытие секретов.                           |
| `--no-line-number`    | Скрывает префиксы с номерами строк.                              |

Опции `showsignature read`:

| OPTION               | Описание                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `--offset <n>`       | Первая показанная **строка**, нумерация с 1 (по умолчанию: 1).    |
| `--limit <n>`        | Максимум **строк** в окне.                                        |
| `--all`              | Отключает порог окна 2000 строк / 50 КБ.                          |
| `--lang-only <lang>` | Язык для скелета; включает скелеты при чтении stdin (`-`).        |
| `--show-only <items>`| Extractors для скелета (по умолчанию: `signatures`).              |
| `--no-line-number`   | Скрывает номера строк в скелете (в содержимом их никогда нет).    |
| `--no-redact`        | Отключает скрытие секретов, чтобы получить дословные байты.       |

Примечание: `--offset`/`--limit` означают **записи** в `map`, но **строки** в `read`.

Вывод по умолчанию ограничен 2000 строками / 50 КБ; когда срабатывает ограничение или
глубина сканирования по умолчанию, вывод заканчивается единственным трейлером `note:`
(дублируется в stderr), в котором указаны точные флаги или следующая команда для продолжения.

## Extractors

Файлы кода:

| Mode         | Показывает                                                             |
| ------------ | ---------------------------------------------------------------------- |
| `signatures` | Функции, классы, методы, конструкторы.                                 |
| `imports`    | Операторы/объявления import.                                           |
| `exports`    | JS/TS exports, экспортированные объявления Go и Python public exports. |
| `interfaces` | TypeScript/Go interfaces.                                              |
| `types`      | Псевдонимы/объявления типов.                                           |
| `variables`  | Переменные/константы.                                                  |
| `comments`   | Комментарии кода.                                                      |

Файлы Markdown и JSON:

| Mode            | Показывает              |
| --------------- | ----------------------- |
| `md:headings`   | Заголовки.              |
| `md:tables`     | Таблицы.                |
| `md:codeblocks` | Огражденные блоки кода. |
| `json:shape`    | Форму значения JSON.    |

## Поддерживаемые файлы

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

## Базовые примеры использования

`showsignature map [OPTION]... [FILE]...` / `showsignature read [OPTION] <FILE>`

```sh
showsignature map ./src                                         # Проверить папку
showsignature map src/01-main.ts                                # Проверить один файл

showsignature map src/main.ts README.md tests/fixtures          # [FILE] может быть одним или несколькими файлами/каталогами
showsignature map --show-only imports,exports                   # Показать только exports
showsignature map --show-only signatures,imports,exports ./src  # Показать структуру кода и imports
showsignature map --show-only interfaces,types ./folder         # Показать формы данных
showsignature map --show-only variables,comments src/main.ts    # Показать variables

showsignature map --show-only md:headings                       # Извлечь Markdown headings
showsignature map --show-only md:tables,md:codeblocks           # Извлечь Markdown tables
showsignature map --show-only json:shape config.json            # Извлечь JSON shape

# полезно при миграциях с одного языка на другой
showsignature map --lang-only py                                # Обрабатывать только файлы Python
showsignature map --lang-only go --show-only imports,exports    # Показать Go imports и exported declarations
showsignature map --lang-only py --show-only types,comments     # Показать Python imports и public exports
showsignature map --max-depth 4                                 # Ограничить глубину рекурсивного сканирования

showsignature map --offset 40 --limit 40 ./src                  # Постраничный просмотр большого списка записей
showsignature map --all ./src                                   # Отключить ограничения вывода
```

Прочитать один файл дословно, в обрамлении скелета сигнатур:

```sh
showsignature read src/01-main.ts                               # Первые строки файла (до порога)
showsignature read --offset 200 --limit 100 src/01-main.ts      # Строки 200-299, скелеты вокруг окна
showsignature read --no-redact src/config.ts                    # Дословные байты, без скрытия секретов
cat snippet.py | showsignature read - --lang-only py            # Stdin; --lang-only включает скелет
```

Строки скелета содержат реальные номера строк, поэтому можно перейти в любое место через
`showsignature read --offset <строка> <файл>`. Содержимое между тегами `<content>` — сырое,
без префиксов номеров строк, и его безопасно копировать в инструменты правки по точному совпадению.

Комбинируйте режимы через запятые:

```bash
showsignature map src --show-only signatures,imports,comments
```

## Вывод

`showsignature` печатает компактный текстовый вывод. Используйте перенаправление shell, чтобы сохранить вывод в файл:

```bash
showsignature map src --show-only signatures > structure.txt
```

## Использование в pipeline

`showsignature` по умолчанию пишет в stdout, поэтому хорошо работает с такими инструментами, как `rg`, `grep`, `fzf`, `less`, `head`, `tee`, и перенаправлениями shell.

```sh
showsignature map src --show-only imports | rg "node"                         # Найти совпадающие imports
showsignature map src --show-only signatures | rg "async"                     # Найти async функции или методы
showsignature map src --show-only comments,signatures | rg -C 2 "ExtractKind" # Искать comments/signatures с ближайшим контекстом
showsignature map src --show-only signatures,imports | bat -l js              # Просматривать большой вывод постранично
```

## Разработка

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## Лицензия

ISC. См. [LICENSE](LICENSE).
