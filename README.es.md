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
showsignature map  [OPTION]... [PATH]...
showsignature read [OPTION]... <FILE>
```

Dos comandos:

- `map` — vista estructural: firmas y otras entradas extraídas. Inspecciona operandos [PATH] —archivos o rutas de directorios— usando el directorio actual de forma predeterminada.
- `read` — lectura literal en ventana de exactamente un archivo, enmarcada por un esqueleto de firmas para orientarte.

Ejecutar `showsignature` sin comando imprime la ayuda y sale con código 1.

Opciones de `showsignature map`:

| OPTION                | Descripción                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `--lang <lang>`  | Fuerza el lenguaje; es obligatorio al usar `-` para leer de stdin. |
| `--only <items>` | Elige extractores.                                                 |
| `--include-tests`     | Incluye archivos de prueba en los escaneos de carpetas.            |
| `--max-depth <n>`     | Limita la profundidad del escaneo (los directorios usan `2` por defecto). |
| `--skip <n>`        | Omite las primeras N **entradas** extraídas (por defecto: 0).      |
| `--take <n>`         | Máximo de **entradas** extraídas mostradas.                        |
| `--all`               | Desactiva todos los límites de salida (límite de entradas y el tope de 2000 líneas / 50 KB). |
| `--no-redact`         | Desactiva la redacción de secretos integrada.                      |
| `--no-line-number`    | Oculta los prefijos de número de línea.                            |

Opciones de `showsignature read`:

| OPTION               | Descripción                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `--offset <n>`       | Primera **línea** a mostrar, indexada desde 1 (por defecto: 1).     |
| `--limit <n>`        | Máximo de **líneas** mostradas en la ventana.                       |
| `--all`              | Desactiva el tope de 2000 líneas / 50 KB de la ventana.             |
| `--lang <lang>` | Lenguaje del esqueleto; habilita esqueletos al leer stdin (`-`).    |
| `--outline <items>`| Extractores usados para el esqueleto (por defecto: `signatures`).   |
| `--no-line-number`   | Oculta los números de línea del esqueleto (el contenido nunca los lleva). |
| `--no-redact`        | Desactiva la redacción de secretos para obtener bytes literales.    |

Note: `map` → **ENTRIES** (`--skip`/`--take`); `read` → **LINES** (`--offset`/`--limit`).

La salida está limitada a 2000 líneas / 50 KB por defecto; cuando un límite o la
profundidad de escaneo predeterminada actúan, la salida termina con un único trailer
`note:` (reflejado en stderr) que indica los flags exactos o la llamada siguiente para continuar.

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

`showsignature map [OPTION]... [PATH]...` / `showsignature read [OPTION]... <FILE>`

```sh
showsignature map ./src                                         # Inspeccionar una carpeta
showsignature map src/01-main.ts                                # Inspeccionar un archivo

showsignature map src/main.ts README.md tests/fixtures          # [PATH] puede ser uno o más archivos/directorios
showsignature map --only imports,exports                   # Mostrar solo exports
showsignature map --only signatures,imports,exports ./src  # Mostrar estructura de código e imports
showsignature map --only interfaces,types ./folder         # Mostrar formas de datos
showsignature map --only variables,comments src/main.ts    # Mostrar variables

showsignature map --only md:headings                       # Extraer encabezados de Markdown
showsignature map --only md:tables,md:codeblocks           # Extraer tablas de Markdown
showsignature map --only json:shape config.json            # Extraer forma JSON

# útil al hacer migraciones de un lenguaje a otro
showsignature map --lang py                                # Procesar solo archivos Python
showsignature map --lang go --only imports,exports    # Mostrar imports de Go y declaraciones exportadas
showsignature map --lang py --only types,comments     # Mostrar imports de Python y exports públicos
showsignature map --max-depth 4                                 # Limitar la profundidad del escaneo recursivo

showsignature map --skip 40 --take 40 ./src                  # Paginar un listado grande de entradas
showsignature map --all ./src                                   # Desactivar los límites de salida
```

Lee un archivo literalmente, enmarcado por un esqueleto de firmas:

```sh
showsignature read src/01-main.ts                               # Primeras líneas del archivo (hasta el tope)
showsignature read --offset 200 --limit 100 src/01-main.ts      # Líneas 200-299, esqueletos alrededor de la ventana
showsignature read --no-redact src/config.ts                    # Bytes literales, sin redacción de secretos
cat snippet.py | showsignature read - --lang py            # Stdin; --lang habilita el esqueleto
```

Las líneas del esqueleto llevan números de línea reales, así que puedes saltar a cualquier
punto con `showsignature read --offset <línea> <archivo>`. El contenido entre las etiquetas
`<content>` es crudo —sin prefijos de número de línea—, seguro para herramientas de edición
por coincidencia exacta.

Combina modos con comas:

```bash
showsignature map src --only signatures,imports,comments
```

## Salida

`showsignature` imprime una salida de texto compacta. Usa redirección de shell para guardar la salida en un archivo:

```bash
showsignature map src --only signatures > structure.txt
```

## Uso en pipelines

`showsignature` escribe en stdout de forma predeterminada, así que funciona bien con herramientas como `rg`, `grep`, `fzf`, `less`, `head`, `tee` y redirecciones de shell.

```sh
showsignature map src --only imports | rg "node"                         # Encontrar imports coincidentes
showsignature map src --only signatures | rg "async"                     # Encontrar funciones o métodos async
showsignature map src --only comments,signatures | rg -C 2 "ExtractKind" # Buscar comentarios/firmas con contexto cercano
showsignature map src --only signatures,imports | bat -l js              # Paginar salidas grandes
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
