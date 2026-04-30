import { PDFDocument, PDFFont } from 'pdf-lib';
import type { PdfJsPageProxy, PdfJsRawTextItem, PositionedTextItem } from './types';

export async function loadPDF(file: File): Promise<PDFDocument> {
    const arrayBuffer = await file.arrayBuffer();
    return await PDFDocument.load(arrayBuffer);
}

export async function extractTextFromPage(pdfPage: PdfJsPageProxy): Promise<string> {
    const textContent = await pdfPage.getTextContent();
    return textContent.items.map((item) => item.str ?? "").join(' ');
}

export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

export function getPositionedTextItems(items: PdfJsRawTextItem[]): PositionedTextItem[] {
    const positioned: PositionedTextItem[] = [];

    for (const item of items) {
        const text = String(item?.str ?? '').trim();
        const transform = Array.isArray(item?.transform) ? item.transform : [];
        const x = Number(transform[4]);
        const y = Number(transform[5]);

        if (!text || Number.isNaN(x) || Number.isNaN(y)) {
            continue;
        }

        positioned.push({
            text,
            upper: text.toUpperCase(),
            x,
            y
        });
    }

    return positioned;
}

export function groupTextLinesByY(items: PositionedTextItem[], tolerance: number): { y: number; words: PositionedTextItem[] }[] {
    const sorted = [...items].sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > tolerance) return yDiff;
        return a.x - b.x;
    });

    const lines: { y: number; words: PositionedTextItem[] }[] = [];
    for (const item of sorted) {
        const line = lines.find(existing => Math.abs(existing.y - item.y) <= tolerance);
        if (line) {
            line.words.push(item);
        } else {
            lines.push({ y: item.y, words: [item] });
        }
    }

    lines.forEach(line => line.words.sort((a, b) => a.x - b.x));
    lines.sort((a, b) => b.y - a.y);
    return lines;
}

export function splitWordByWidth(
    word: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number
): string[] {
    if (!word) return [];
    if (maxWidth <= 0) return [word];
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) return [word];

    const chunks: string[] = [];
    let current = '';

    for (const char of [...word]) {
        const test = `${current}${char}`;
        if (font.widthOfTextAtSize(test, fontSize) <= maxWidth || current.length === 0) {
            current = test;
        } else {
            chunks.push(current);
            current = char;
        }
    }

    if (current) {
        chunks.push(current);
    }

    return chunks;
}

export function wrapTextToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    if (!text.trim()) return [];
    if (maxWidth <= 0) return [];

    const lines: string[] = [];
    const paragraphs = text
        .split(/\n+/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean);

    for (const paragraph of paragraphs) {
        const words = paragraph.split(/\s+/);
        let currentLine = "";

        for (const word of words) {
            if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = "";
                }

                const chunks = splitWordByWidth(word, font, fontSize, maxWidth);
                chunks.forEach((chunk, chunkIndex) => {
                    if (chunkIndex < chunks.length - 1) {
                        lines.push(chunk);
                    } else {
                        currentLine = chunk;
                    }
                });
                continue;
            }

            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }
    }

    return lines;
}

export function formatProcessTimestamp(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    const hour24 = date.getHours();
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    const hh = String(hour12).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss} ${period}`;
}
