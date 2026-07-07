<p align="center">
  <picture>
    <img  alt="ShowSignature-header-2" src="https://github.com/user-attachments/assets/311e83f7-b2db-4e11-afb7-9d8f6e2e8d25" >
  </picture>
</p>

# showsignature

语言：
- [English](README.md)
- 简体中文
- [日本語](README.ja.md)
- [Español](README.es.md)
- [Русский](README.ru.md)
- [العربية](README.ar.md)

一个 CLI，用于从源文件中提取有用的结构：签名、imports、类型、变量、注释、Markdown 章节和 JSON 形状。

用它可以快速理解代码库、审查文件，或为 AI 助手创建紧凑的上下文。

<p align="center">
  <img width="1723" height="623" alt="example-showsignature-1" src="https://github.com/user-attachments/assets/36b636af-c3b3-485a-852d-fd0f3cce6321" />
</p>

## 安装

### 1. 从 NPM registry 本地或全局安装

`showsignature` 作为 bash 工具执行，因此必须在本地或全局可用。

```bash
#npm|pnpm|yarn
# 全局安装
npm install -g showsignature

# 本地安装
npm install showsignature
```

## 2. 设置你的 AI Agent

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

（你必须发送两个单独的提示，安装才能生效）

桌面应用没有 /plugin 命令。请改为从 UI 安装：Customize，personal plugins 旁边的 +，Create plugin and add marketplace，Add from repository，然后输入仓库 URL。

</details>

<details id="codex">
<summary>
<h2>Codex</h2>
</summary>

```sh
codex plugin marketplace add FredySandoval/showsignature
codex
```

打开 /plugins，选择 `showsignature` marketplace，并安装 `showsignature`。然后打开 /hooks，审查并信任它的生命周期 hook，再启动一个新线程。

同一次安装也适用于 Codex 桌面应用：安装后重启应用，它会自动加载该 plugin。

</details>

<details id="agent-skill">
<summary>
<h2>Agent Skill</h2>
</summary>
  
```bash
# 所有 agents
npx skills add https://github.com/FredySandoval/showsignature --skill showsignature
```
</details>

<details id="pi-agent-extension">
<summary>
<h2>Pi agent extension</h2>
</summary>
  
```bash
# 选项 1
pi install npm:showsignature
# 选项 2
pi install git:github.com/FredySandoval/showsignature
# 选项 3
pi install https://github.com/FredySandoval/showsignature
```
</details>

<details id="from-source">
<summary>
<h2>从源代码安装</h2>
</summary>
  
```bash
git clone https://github.com/FredySandoval/showsignature.git
cd showsignature
pnpm install
pnpm build
pnpm link --global
```
</details>

## 为什么？

大型文件往往很嘈杂。`showsignature` 会在你阅读实现之前，为你提供项目的形状：

- 存在哪些函数/类？
- 每个文件 import/export 了什么？
- 哪些类型和接口定义了数据？
- Markdown 中有哪些标题/表格/代码块？
- JSON 文件具有什么形状？

## 用法

```sh
showsignature map  [OPTION]... [FILE]...
showsignature read [OPTION] <FILE>
```

两个命令：

- `map` — 结构概览：签名及其他提取条目。检查 [FILE] 操作数——文件或目录路径——默认使用当前目录。
- `read` — 对且仅对一个文件进行窗口式字面读取，并用签名骨架（skeleton）提供定位。

不带命令运行 `showsignature` 会打印帮助并以退出码 1 结束。

`showsignature map` 的选项：

| OPTION                | 描述                                         |
| --------------------- | -------------------------------------------- |
| `--lang-only <lang>`  | 强制指定语言；使用 `-` 从 stdin 读取时必需。 |
| `--show-only <items>` | 选择 extractors。                            |
| `--include-tests`     | 在文件夹扫描中包含测试文件。                 |
| `--max-depth <n>`     | 限制文件夹扫描深度（目录扫描默认为 `2`）。   |
| `--offset <n>`        | 跳过前 N 个提取的**条目**（默认：0）。       |
| `--limit <n>`         | 显示的提取**条目**上限。                     |
| `--all`               | 关闭所有输出上限（条目上限和 2000 行 / 50 KB 上限）。 |
| `--no-redact`         | 关闭内置的机密信息脱敏。                     |
| `--no-line-number`    | 隐藏源码行号前缀。                           |

`showsignature read` 的选项：

| OPTION               | 描述                                          |
| -------------------- | --------------------------------------------- |
| `--offset <n>`       | 显示的第一**行**，从 1 开始（默认：1）。      |
| `--limit <n>`        | 窗口中显示的**行**数上限。                    |
| `--all`              | 关闭 2000 行 / 50 KB 的窗口上限。             |
| `--lang-only <lang>` | 骨架使用的语言；读取 stdin（`-`）时启用骨架。 |
| `--show-only <items>`| 骨架使用的 extractors（默认：`signatures`）。 |
| `--no-line-number`   | 隐藏骨架行的行号前缀（内容本身从不带行号）。  |
| `--no-redact`        | 关闭机密脱敏以获得字面字节。                  |

注意：`--offset`/`--limit` 在 `map` 中指**条目**，在 `read` 中指**行**。

输出默认限制为 2000 行 / 50 KB；当上限或默认扫描深度生效时，输出会以单个 `note:`
结尾（同时镜像到 stderr），其中写明继续所需的确切 flag 或后续命令。

## Extractors

代码文件：

| Mode         | 显示                                                        |
| ------------ | ----------------------------------------------------------- |
| `signatures` | 函数、类、方法、构造函数。                                  |
| `imports`    | Import 语句/声明。                                          |
| `exports`    | JS/TS exports、导出的 Go 声明，以及 Python public exports。 |
| `interfaces` | TypeScript/Go interfaces。                                  |
| `types`      | 类型别名/声明。                                             |
| `variables`  | 变量/常量。                                                 |
| `comments`   | 代码注释。                                                  |

Markdown 和 JSON 文件：

| Mode            | 显示          |
| --------------- | ------------- |
| `md:headings`   | 标题。        |
| `md:tables`     | 表格。        |
| `md:codeblocks` | 围栏代码块。  |
| `json:shape`    | JSON 值形状。 |

## 支持的文件

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

## 基本用法示例

`showsignature map [OPTION]... [FILE]...` / `showsignature read [OPTION] <FILE>`

```sh
showsignature map ./src                                         # 检查文件夹
showsignature map src/01-main.ts                                # 检查单个文件

showsignature map src/main.ts README.md tests/fixtures          # [FILE] 可以是一个或多个文件/目录
showsignature map --show-only imports,exports                   # 仅显示 exports
showsignature map --show-only signatures,imports,exports ./src  # 显示代码结构和 imports
showsignature map --show-only interfaces,types ./folder         # 显示数据形状
showsignature map --show-only variables,comments src/main.ts    # 显示变量

showsignature map --show-only md:headings                       # 提取 Markdown 标题
showsignature map --show-only md:tables,md:codeblocks           # 提取 Markdown 表格
showsignature map --show-only json:shape config.json            # 提取 JSON 形状

# 在从一种语言迁移到另一种语言时很有用
showsignature map --lang-only py                                # 仅处理 Python 文件
showsignature map --lang-only go --show-only imports,exports    # 显示 Go imports 和导出声明
showsignature map --lang-only py --show-only types,comments     # 显示 Python imports 和 public exports
showsignature map --max-depth 4                                 # 限制递归扫描深度

showsignature map --offset 40 --limit 40 ./src                  # 分页浏览大量条目
showsignature map --all ./src                                   # 关闭输出上限
```

以字面方式读取一个文件，并由签名骨架框住：

```sh
showsignature read src/01-main.ts                               # 文件开头的行（直到上限）
showsignature read --offset 200 --limit 100 src/01-main.ts      # 第 200-299 行，窗口两侧带骨架
showsignature read --no-redact src/config.ts                    # 字面字节，不做机密脱敏
cat snippet.py | showsignature read - --lang-only py            # stdin；--lang-only 启用骨架
```

骨架行带有真实行号，因此可以用 `showsignature read --offset <行号> <文件>` 直接跳转。
`<content>` 标签之间的内容是原始内容——没有行号前缀——可以安全地复制到精确匹配的编辑工具中。

用逗号组合模式：

```bash
showsignature map src --show-only signatures,imports,comments
```

## 输出

`showsignature` 打印紧凑的文本输出。使用 shell 重定向将输出保存到文件：

```bash
showsignature map src --show-only signatures > structure.txt
```

## Pipeline 用法

`showsignature` 默认写入 stdout，因此可以很好地配合 `rg`、`grep`、`fzf`、`less`、`head`、`tee` 和 shell 重定向使用。

```sh
showsignature map src --show-only imports | rg "node"                         # 查找匹配的 imports
showsignature map src --show-only signatures | rg "async"                     # 查找 async 函数或方法
showsignature map src --show-only comments,signatures | rg -C 2 "ExtractKind" # 搜索注释/签名并显示附近上下文
showsignature map src --show-only signatures,imports | bat -l js              # 分页查看大量输出
```

## 开发

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## 许可证

ISC。参见 [LICENSE](LICENSE)。
