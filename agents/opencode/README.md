# OpenCode config files

Copy these files into your OpenCode config location.

## Project-local setup

Copy into your project root:

- `opencode.json`
- `SYSTEM.md`

Result:
Add the plugin to your opencode.json:
```text
your-project/
├─ opencode.json
└─ SYSTEM.md
```

Then start OpenCode from that project.

## Global setup

Copy into:

```text
~/.config/opencode/
```

Result:

```text
~/.config/opencode/
├─ opencode.json
└─ SYSTEM.md
```
```

## What this does

`opencode.json` tells OpenCode to load `SYSTEM.md` through the `instructions` setting.
