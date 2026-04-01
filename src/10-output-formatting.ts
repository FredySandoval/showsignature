// ============================================================================
// Output Formatting                    [Step 8 — format + sink]
// ============================================================================
import path from 'node:path';

import type {
    DetectFenceLanguageOptions,
    FileSection,
    FormatFinalOutputOptions,
} from './00-core-types';

export function toDisplayPath(filePath: string): string {
    const normalised = path.isAbsolute(filePath)
        ? path.relative(process.cwd(), filePath)
        : filePath;

    return normalised.split(path.sep).join('/');
}

export function formatPlainOutput(sections: FileSection[]): string {
    const parts: string[] = [];

    for (const section of sections) {
        if (section.entries.length === 0) {
            continue;
        }

        parts.push(`// ${toDisplayPath(section.filePath)}`);

        for (const entry of section.entries) {
            parts.push(entry.lines.join('\n'));
        }

        parts.push('');
    }

    return parts.join('\n').trimEnd();
}

export function detectFenceLanguage(
    options: DetectFenceLanguageOptions,
): string | undefined {
    const { registry, explicitLang, seenLangs } = options;

    if (explicitLang) {
        const adapter = registry.get(explicitLang);
        return adapter ? adapter.fenceLang : explicitLang;
    }

    if (seenLangs.length === 1) {
        const lang = seenLangs[0];
        if (lang) {
            const adapter = registry.get(lang);
            return adapter ? adapter.fenceLang : lang;
        }
    }

    return undefined;
}

export function toMarkdownCodeBlock(
    content: string,
    fenceLanguage: string | undefined,
): string {
    const openFence = fenceLanguage ? `\`\`\`${fenceLanguage}` : '```';
    const body = content.endsWith('\n') ? content : `${content}\n`;
    return `${openFence}\n${body}\`\`\``;
}

export function formatFinalOutput(options: FormatFinalOutputOptions): string {
    const { registry, sections, explicitLang, outputPath, seenLangs } = options;

    const plainOutput = formatPlainOutput(sections);

    if (!outputPath) {
        return plainOutput;
    }

    const fenceLang = detectFenceLanguage({ registry, explicitLang, seenLangs });
    return toMarkdownCodeBlock(plainOutput, fenceLang);
}
