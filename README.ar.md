<p align="center">
  <picture>
    <img  alt="ShowSignature-header-2" src="https://github.com/user-attachments/assets/311e83f7-b2db-4e11-afb7-9d8f6e2e8d25" >
  </picture>
</p>

# showsignature

اللغات:
- [English](README.md)
- [简体中文](README.zh-CN.md)
- [日本語](README.ja.md)
- [Español](README.es.md)
- [Русский](README.ru.md)
- العربية

واجهة CLI تستخرج البنية المفيدة من ملفات المصدر: signatures و imports و types و variables و comments وأقسام Markdown وأشكال JSON.

استخدمها لفهم قاعدة كود بسرعة، أو مراجعة الملفات، أو إنشاء سياق مضغوط لمساعدي الذكاء الاصطناعي.

<p align="center">
  <img width="1723" height="623" alt="example-showsignature-1" src="https://github.com/user-attachments/assets/36b636af-c3b3-485a-852d-fd0f3cce6321" />
</p>

## التثبيت

### 1. ثبّت محليًا أو عالميًا من NPM registry

يتم تنفيذ `showsignature` كأداة bash، لذلك يجب أن تكون متاحة محليًا أو عالميًا.

```bash
#npm|pnpm|yarn
# تثبيت عالمي
npm install -g showsignature

# تثبيت محلي
npm install showsignature
```

## 2. إعداد AI Agent الخاص بك

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

(يجب إرسال مطالبتين منفصلتين حتى يعمل التثبيت)

لا يحتوي تطبيق سطح المكتب على أمر /plugin. ثبّته من الواجهة بدلًا من ذلك: Customize، ثم + بجانب personal plugins، ثم Create plugin and add marketplace، ثم Add from repository، وبعدها أدخل عنوان URL للمستودع.

</details>

<details id="codex">
<summary>
<h2>Codex</h2>
</summary>

```sh
codex plugin marketplace add FredySandoval/showsignature
codex
```

افتح /plugins، واختر marketplace الخاص بـ `showsignature`، وثبّت `showsignature`. ثم افتح /hooks، وراجع lifecycle hook الخاص به وثق به، وابدأ سلسلة جديدة.

يغطي التثبيت نفسه أيضًا تطبيق Codex لسطح المكتب: أعد تشغيل التطبيق بعد التثبيت وسيلتقط plugin.

</details>

<details id="agent-skill">
<summary>
<h2>Agent Skill</h2>
</summary>
  
```bash
# كل agents
npx skills add https://github.com/FredySandoval/showsignature --skill showsignature
```
</details>

<details id="pi-agent-extension">
<summary>
<h2>Pi agent extension</h2>
</summary>
  
```bash
# الخيار 1
pi install npm:showsignature
# الخيار 2
pi install git:github.com/FredySandoval/showsignature
# الخيار 3
pi install https://github.com/FredySandoval/showsignature
```
</details>

<details id="from-source">
<summary>
<h2>من الكود المصدري</h2>
</summary>
  
```bash
git clone https://github.com/FredySandoval/showsignature.git
cd showsignature
pnpm install
pnpm build
pnpm link --global
```
</details>

## لماذا؟

الملفات الكبيرة مليئة بالضجيج. يمنحك `showsignature` شكل المشروع قبل أن تقرأ التنفيذ:

- ما الوظائف/الأصناف الموجودة؟
- ماذا يستورد/يصدّر كل ملف؟
- ما types و interfaces التي تعرّف البيانات؟
- ما headings/tables/code blocks الموجودة في Markdown؟
- ما شكل ملف JSON؟

## الاستخدام

```sh
showsignature map  [OPTION]... [FILE]...
showsignature read [OPTION] <FILE>
```

يفحص معاملات [FILE] — ملفات أو مسارات أدلة — باستخدام الدليل الحالي افتراضيًا.

| OPTION                | الوصف                                               |
| --------------------- | --------------------------------------------------- |
| `--lang-only <lang>`  | يفرض اللغة؛ مطلوب عند استخدام `-` للقراءة من stdin. |
| `--show-only <items>` | يختار extractors.                                   |
| `--include-tests`     | يضمّن ملفات الاختبار في عمليات فحص المجلدات.        |
| `--max-depth <n>`     | يحد عمق فحص المجلدات.                               |

## Extractors

ملفات الكود:

| Mode         | يعرض                                                          |
| ------------ | ------------------------------------------------------------- |
| `signatures` | الوظائف، الأصناف، الطرق، البُناة.                             |
| `imports`    | عبارات/تصريحات import.                                        |
| `exports`    | JS/TS exports، وتصريحات Go المصدّرة، و Python public exports. |
| `interfaces` | TypeScript/Go interfaces.                                     |
| `types`      | أسماء/تصريحات الأنواع.                                        |
| `variables`  | المتغيرات/الثوابت.                                            |
| `comments`   | تعليقات الكود.                                                |

ملفات Markdown و JSON:

| Mode            | يعرض                |
| --------------- | ------------------- |
| `md:headings`   | العناوين.           |
| `md:tables`     | الجداول.            |
| `md:codeblocks` | كتل الكود المسيّجة. |
| `json:shape`    | شكل قيمة JSON.      |

## الملفات المدعومة

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

## أمثلة استخدام أساسية

`showsignature map [OPTION]... [FILE]...` / `showsignature read [OPTION] <FILE>`

```sh
showsignature map ./src                                         # فحص مجلد
showsignature map src/01-main.ts                                # فحص ملف واحد

showsignature map src/main.ts README.md tests/fixtures          # يمكن أن يكون [FILE] ملفًا/دليلًا واحدًا أو أكثر
showsignature map --show-only imports,exports                   # عرض exports فقط
showsignature map --show-only signatures,imports,exports ./src  # عرض بنية الكود و imports
showsignature map --show-only interfaces,types ./folder         # عرض أشكال البيانات
showsignature map --show-only variables,comments src/main.ts    # عرض variables

showsignature map --show-only md:headings                       # استخراج Markdown headings
showsignature map --show-only md:tables,md:codeblocks           # استخراج Markdown tables
showsignature map --show-only json:shape config.json            # استخراج JSON shape

# مفيد عند إجراء عمليات ترحيل من لغة إلى أخرى
showsignature map --lang-only py                                # معالجة ملفات Python فقط
showsignature map --lang-only go --show-only imports,exports    # عرض Go imports والتصريحات المصدّرة
showsignature map --lang-only py --show-only types,comments     # عرض Python imports و public exports
showsignature map --max-depth 4                                 # حد عمق الفحص التكراري
```

اجمع الأوضاع بفواصل:

```bash
showsignature map src --show-only signatures,imports,comments
```

## الإخراج

يطبع `showsignature` إخراجًا نصيًا مضغوطًا. استخدم إعادة توجيه shell لحفظ الإخراج في ملف:

```bash
showsignature map src --show-only signatures > structure.txt
```

## الاستخدام في pipeline

يكتب `showsignature` إلى stdout افتراضيًا، لذلك يعمل جيدًا مع أدوات مثل `rg` و `grep` و `fzf` و `less` و `head` و `tee` وإعادات توجيه shell.

```sh
showsignature map src --show-only imports | rg "node"                         # العثور على imports مطابقة
showsignature map src --show-only signatures | rg "async"                     # العثور على وظائف أو طرق async
showsignature map src --show-only comments,signatures | rg -C 2 "ExtractKind" # البحث في comments/signatures مع سياق قريب
showsignature map src --show-only signatures,imports | bat -l js              # تصفح إخراج كبير على صفحات
```

## التطوير

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## الترخيص

ISC. راجع [LICENSE](LICENSE).
