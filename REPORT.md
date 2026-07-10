# findings

let's take this piece of code:
```ts
import * as ts from "typescript";
import type { Range } from "../../00-core-types.js";
```

running `showsignature map --symbol-summary ./src/example.ts`
produces the following output:
```
imports:src/languages/typescript/02-ast-helpers.ts ts typescript Range core types js
```

question: how the `00-core-type.js` should be interpreted?
as 00 core type js
or as literal 
00-core-types.js 

example: 
```
imports:src/languages/typescript/02-ast-helpers.ts ts typescript Range 00-core-types.js
```

task: check this behavior against ./README.md and ./docs/symbol-summary.md
is this behavior docummented and hence expected
or this behavior is outside of what is docummented.
