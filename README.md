# ShowCode CLI
Extract structure from code. Turn source files into clean, readable artifacts.

Features:
  - Class, constructor, method, and function signatures
  - Interface definitions
  - Type alias definitions
  - Variable definitions
  - Comments
  - Import declarations
  - Recursive folder traversal with test-file exclusion by default

Usage:
  showcode [options]
  showcode --file <file>
  showcode --folder <folder>

Input Behavior:
  - If --file is specified, only that file will be processed.
  - If --folder is specified, the folder will be processed recursively.
  - If neither --file nor --folder is specified, ShowCode will
    recursively scan from the current working directory (.)
    and process all supported files.

Options:
    // TODO: ignore dist folder and other
    // maybe adding .gitignore
  --lang <lang> // TODO: Optional, if not provided infers the language from the extension 
      Language to parse.
      If not specified, the language will be inferred from the file extension.
      If inference fails, error `<lang> not supported` will be shown.

  --extract=<options>
      Comma-separated list of extraction types.
      By default, selected outputs are combined in their original source order.
      Example: `--extract=comments,signatures` interleaves comments and
      signatures based on where they appear in the file.

      Supported extract options:

        signatures
          Extract class, constructor, method, and function signatures.

        interfaces
          Extract only interface definitions.

        types
          Extract only type alias definitions.

        variables
          Extract only variable definitions.

        comments
          Extract only comments.

        imports
          Extract only import declarations.

  --file <file>
      Specify a single file to process.

  --folder <folder>
      Specify a folder to process recursively.

  --include-tests
      Include files under `test`, `tests`, and `__tests__` directories,
      plus files matching `*.test.*` and `*.spec.*`, during recursive discovery.
      This only affects folder/current-directory scans. Explicit `--file` inputs
      are still processed directly.

  --output <name>
      Specify a file name to save the output.

## Examples:

# Fixture Folders

If you want to extract from fixture files under `tests/fixtures`, use `--folder`
and opt in to test discovery:

```bash
showcode --folder ./tests/fixtures --include-tests --extract=signatures
```

`--file` expects a single file path. If you pass a directory such as
`--file ./tests/fixtures`, ShowCode will reject it and tell you to use `--folder`.

# Function Signature Extraction

Input:
```ts
function printUserInfo<T extends User>(user: T): void {
  console.log(user);
}
```
Output:

```ts
function printUserInfo<T extends User>(user: T): void;
```
Includes:
* Name
* Generic type parameters
* Parameters
* Return type

Excludes:
* `console.log(user)`

---

# Method Signature Extraction
Input:
```ts
getProfile(): string {
  return "something";
}
```
Output:
```ts
getProfile(): string;
```

---

# Constructor Signature Extraction
Input:
```ts
constructor(public id: number) {}
```
Output:
```ts
constructor(public id: number);
```

---

# Class Signature Extraction

A class itself also has a signature-like structure.

```ts
class UserAccount implements User {
```
The “class signature” includes:

* Class name
* Generic parameters
* `extends`
* `implements`
* Modifiers (export, abstract, etc.)
But not:
* Method bodies
* Field initializers

Example Output:
```ts
class UserAccount implements User {
  constructor(...);
  getProfile(): string;
}
```

---

# Variable Definition Extraction
Input:
```ts
export const API_URL = "https://example.com";
let cache: Map<string, User> = new Map();
const settings = { theme: "dark", compact: true };
```
Output:
```ts
export const API_URL = "https://example.com";
let cache: Map<string, User> = ...;
const settings = {...};
```

---

# Comment Extraction
Input:
```ts
// Env setup
const api = createApi();

/*
  Retry settings
*/
api.connect();
```
Output:
```ts
// Env setup
/*
  Retry settings
*/
```

---

# Import Extraction
Input:
```ts
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import type { User } from "./types";
```
Output:
```ts
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import type { User } from "./types";
```
