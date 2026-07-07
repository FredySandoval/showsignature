<p align="center">
  <picture>
    <img  alt="ShowSignature-header-2" src="https://github.com/user-attachments/assets/311e83f7-b2db-4e11-afb7-9d8f6e2e8d25" >
  </picture>
</p>

# showsignature

Idiomas:
- [English](README.md)
- [简体中文](README.zh-CN.md)
- [日本語](README.ja.md)
- Español
- [Русский](README.ru.md)
- [العربية](README.ar.md)

Una Interfaz de Línea de Comandos. que extrae la estructura útil de los archivos fuente: `signatures`, `imports`, `types`, `variables`, `comments`, secciones de Markdown y formas JSON.

Úsala para entender rápidamente una base de código, revisar archivos o crear contexto compacto para asistentes de IA.

<p align="center">
  <img width="1723" height="623" alt="example-showsignature-1" src="https://github.com/user-attachments/assets/36b636af-c3b3-485a-852d-fd0f3cce6321" />
</p>

## Instalación

### 1. Instala local o globalmente desde el registro de NPM

`showsignature` se ejecuta como una herramienta bash, por lo que debe estar disponible local o globalmente.

```bash
#npm|pnpm|yarn
# instalación global
npm install -g showsignature

# instalación local
npm install showsignature
```

## 2. Configura tu agente de IA

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

(Tienes que enviar dos prompts separados para que la instalación funcione)

La aplicación de escritorio no tiene el comando /plugin. Instálalo desde la interfaz en su lugar: Customize, el + junto a personal plugins, Create plugin and add marketplace, Add from repository, y luego introduce la URL del repositorio.

</details>

<details id="codex">
<summary>
<h2>Codex</h2>
</summary>

```sh
codex plugin marketplace add FredySandoval/showsignature
codex
```

Abre /plugins, selecciona el marketplace `showsignature` e instala `showsignature`. Luego abre /hooks, revisa y confía en su hook de ciclo de vida, e inicia un hilo nuevo.

Esta misma instalación también cubre la aplicación de escritorio Codex: reinicia la aplicación después de instalarlo y detectará el plugin.

</details>

<details id="agent-skill">
<summary>
<h2>Skill de Agente</h2>
</summary>
  
```bash
# Todos los agentes
npx skills add https://github.com/FredySandoval/showsignature --skill showsignature
```
</details>

<details id="pi-agent-extension">
<summary>
<h2>Pi Agente- Extensión </h2>
</summary>
  
```bash
# opción 1
pi install npm:showsignature
# opción 2
pi install git:github.com/FredySandoval/showsignature
# opción 3
pi install https://github.com/FredySandoval/showsignature
```
</details>

<details id="from-source">
<summary>
<h2>Desde el código fuente</h2>
</summary>
  
```bash
git clone https://github.com/FredySandoval/showsignature.git
cd showsignature
pnpm install
pnpm build
pnpm link --global
```
</details>

## ¿Por qué?

Los archivos grandes generan ruido. `showsignature` te da la forma de un proyecto antes de leer la implementación:

- ¿Qué funciones/clases existen?
- ¿Qué importa/exporta cada archivo?
- ¿Qué tipos e interfaces definen los datos?
- ¿Qué encabezados/tablas/bloques de código existen en Markdown?
- ¿Qué forma tiene un archivo JSON?

## Uso

```sh
showsignature map  [OPTION]... [FILE]...
showsignature read [OPTION] <FILE>
```

Inspecciona operandos [FILE] —archivos o rutas de directorios— usando el directorio actual de forma predeterminada.

| OPTION                | Descripción                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `--lang-only <lang>`  | Fuerza el lenguaje; es obligatorio al usar `-` para leer de stdin. |
| `--show-only <items>` | Elige extractores.                                                 |
| `--include-tests`     | Incluye archivos de prueba en los escaneos de carpetas.            |
| `--max-depth <n>`     | Limita la profundidad del escaneo de carpetas.                     |

## Extractores

Archivos de código:

| Modo         | Muestra                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `signatures` | Funciones, clases, métodos, constructores.                               |
| `imports`    | Sentencias/declaraciones de importación.                                 |
| `exports`    | Exports JS/TS, declaraciones Go exportadas y exports públicos de Python. |
| `interfaces` | Interfaces TypeScript/Go.                                                |
| `types`      | Alias/declaraciones de tipos.                                            |
| `variables`  | Variables/constantes.                                                    |
| `comments`   | Comentarios de código.                                                   |

Archivos Markdown y JSON:

| Modo            | Muestra                        |
| --------------- | ------------------------------ |
| `md:headings`   | Encabezados.                   |
| `md:tables`     | Tablas.                        |
| `md:codeblocks` | Bloques de código delimitados. |
| `json:shape`    | Forma de valor JSON.           |

## Archivos compatibles

| Lenguaje   | Extensiones           |
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

## Ejemplos básicos de uso

`showsignature map [OPTION]... [FILE]...` / `showsignature read [OPTION] <FILE>`

```sh
showsignature map ./src                                         # Inspeccionar una carpeta
showsignature map src/01-main.ts                                # Inspeccionar un archivo

showsignature map src/main.ts README.md tests/fixtures          # [FILE] puede ser uno o más archivos/directorios
showsignature map --show-only imports,exports                   # Mostrar solo exports
showsignature map --show-only signatures,imports,exports ./src  # Mostrar estructura de código e imports
showsignature map --show-only interfaces,types ./folder         # Mostrar formas de datos
showsignature map --show-only variables,comments src/main.ts    # Mostrar variables

showsignature map --show-only md:headings                       # Extraer encabezados de Markdown
showsignature map --show-only md:tables,md:codeblocks           # Extraer tablas de Markdown
showsignature map --show-only json:shape config.json            # Extraer forma JSON

# útil al hacer migraciones de un lenguaje a otro
showsignature map --lang-only py                                # Procesar solo archivos Python
showsignature map --lang-only go --show-only imports,exports    # Mostrar imports de Go y declaraciones exportadas
showsignature map --lang-only py --show-only types,comments     # Mostrar imports de Python y exports públicos
showsignature map --max-depth 4                                 # Limitar la profundidad del escaneo recursivo
```

Combina modos con comas:

```bash
showsignature map src --show-only signatures,imports,comments
```

## Salida

`showsignature` imprime una salida de texto compacta. Usa redirección de shell para guardar la salida en un archivo:

```bash
showsignature map src --show-only signatures > structure.txt
```

## Uso en pipelines

`showsignature` escribe en stdout de forma predeterminada, así que funciona bien con herramientas como `rg`, `grep`, `fzf`, `less`, `head`, `tee` y redirecciones de shell.

```sh
showsignature map src --show-only imports | rg "node"                         # Encontrar imports coincidentes
showsignature map src --show-only signatures | rg "async"                     # Encontrar funciones o métodos async
showsignature map src --show-only comments,signatures | rg -C 2 "ExtractKind" # Buscar comentarios/firmas con contexto cercano
showsignature map src --show-only signatures,imports | bat -l js              # Paginar salidas grandes
```

## Desarrollo

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format
```

## Licencia

ISC. Consulta [LICENSE](LICENSE).
