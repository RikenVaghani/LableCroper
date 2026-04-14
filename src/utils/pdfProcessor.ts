import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface CropConfig {
    tlx: number;
    tly: number;
    brx: number;
    bry: number;
    label: string;
    logo: string;
    variants?: {
        id: string;
        label: string;
        tlx: number;
        tly: number;
        brx: number;
        bry: number;
    }[];
    options?: {
        id: string;
        label: string;
    }[];
    disableCrop?: boolean;
}

export type AmazonDescriptionMode = 'WITH_SKU' | 'WITH_DESCRIPTION';

export const LABEL_CONFIGS: Record<string, CropConfig> = {
    // Exact values provided by user
    FLIPKART: {
        tlx: 188,
        tly: 28,
        brx: 407,
        bry: 381,
        // tlx: 190, tly: 28, brx: 407, bry: 382,
        label: "Flipkart",
        logo: "./Flipkart.jpg"
    },
    MEESHO: {
        tlx: 0,
        tly: 0,
        brx: 600,
        bry: 660,
        label: "Meesho",
        logo: "./Meesho2.jpg",
        variants: [
            {
                id: 'without_invoice',
                label: 'Without Invoice',
                tlx: 0, // TODO: Update with actual coordinates
                tly: 0,
                brx: 600,
                bry: 358
            },
            {
                id: 'with_invoice',
                label: 'With Invoice',
                tlx: 0, // TODO: Update with actual coordinates
                tly: 0,
                brx: 600,
                bry: 660
            }
        ]
    },
    AMAZON: {
        tlx: 0,
        tly: 0,
        brx: 210,
        bry: 465,
        label: "Amazon",
        logo: "./Amazon2.jpg",
        options: [
            {
                id: 'order_page',
                label: 'Select Only Order Page'
            }
        ],
        disableCrop: true
    }
};

export async function loadPDF(file: File): Promise<PDFDocument> {
    const arrayBuffer = await file.arrayBuffer();
    return await PDFDocument.load(arrayBuffer);
}

type PdfJsRawTextItem = {
    str?: string;
    transform?: number[];
};

type PdfJsTextContent = {
    items: PdfJsRawTextItem[];
};

type PdfJsPageProxy = {
    getTextContent: () => Promise<PdfJsTextContent>;
};

type PdfJsDocumentProxy = {
    getPage: (pageNumber: number) => Promise<PdfJsPageProxy>;
};

async function extractTextFromPage(pdfPage: PdfJsPageProxy): Promise<string> {
    const textContent = await pdfPage.getTextContent();
    return textContent.items.map((item) => item.str ?? "").join(' ');
}

type PositionedTextItem = {
    text: string;
    upper: string;
    x: number;
    y: number;
};

type AmazonInvoiceLineItem = {
    description: string;
    quantity: string | null;
};

type AmazonInvoiceLabelData = {
    lineItems: AmazonInvoiceLineItem[];
};

type AmazonSummaryEntry = {
    sku: string;
    totalQty: number;
};

type MeeshoSummaryEntry = {
    sku: string;
    totalQty: number;
};

const AMAZON_DESCRIPTION_HEADER = "DESCRIPTION";
const AMAZON_TOTAL_MARKER = "TOTAL";
const AMAZON_COLUMN_HEADERS = ["DISCOUNT", "QTY", "QUANTITY", "UNIT", "PRICE", "AMOUNT", "TAX", "RATE", "TYPE"];

const AMAZON_DESCRIPTION_BOX = {
    xRatio: 0.085,
    yRatio: 0.145,
    widthRatio: 0.83,
    heightRatio: 0.085,
    minFontSize: 5.6,
    maxFontSize: 7.4,
    fontStep: 0.2,
    lineHeightRatio: 1.2
};

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function extractTextInsideParentheses(value: string): string {
    const matches = [...value.matchAll(/\(([^)]+)\)/g)]
        .map(match => normalizeWhitespace(match[1] ?? ''))
        .filter(Boolean);

    return normalizeWhitespace(matches.join(' '));
}

function getAmazonLineBaseText(
    description: string,
    mode: AmazonDescriptionMode
): string {
    if (mode === 'WITH_DESCRIPTION') {
        return normalizeWhitespace(description);
    }

    const skuFromParentheses = extractTextInsideParentheses(description);
    return normalizeWhitespace(skuFromParentheses || description);
}

function parseAmazonQty(quantity: string | null): number {
    const parsed = Number(quantity);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return 1;
}

function formatAmazonQty(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function drawAmazonSummaryHeader(
    page: PDFPage,
    font: PDFFont,
    pageWidth: number,
    y: number,
    isContinuation: boolean
): number {
    const titleSize = Math.max(8, pageWidth * 0.02);
    const subTitleSize = Math.max(6.5, pageWidth * 0.015);

    page.drawText(isContinuation ? "Amazon Order Summary (continued)" : "Amazon Order Summary", {
        x: 16,
        y,
        size: titleSize,
        font,
        color: rgb(0, 0, 0)
    });

    const columnY = y - (titleSize + 8);
    page.drawText("SKU", {
        x: 16,
        y: columnY,
        size: subTitleSize,
        font,
        color: rgb(0, 0, 0)
    });
    page.drawText("Total Qty", {
        x: pageWidth - 96,
        y: columnY,
        size: subTitleSize,
        font,
        color: rgb(0, 0, 0)
    });

    // Keep a clear separation between header row and first data row.
    const dataStartGap = Math.max(14, subTitleSize * 2.2);
    return columnY - dataStartGap;
}

function splitWordByWidth(
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

function appendAmazonSummaryPages(
    targetPdf: PDFDocument,
    entries: AmazonSummaryEntry[],
    font: PDFFont,
    pageWidth: number,
    pageHeight: number
): void {
    if (entries.length === 0) return;

    const marginX = 16;
    const marginBottom = 14;
    const rowFontSize = Math.max(5.5, pageWidth * 0.012);
    const rowLineHeight = rowFontSize * 1.25;
    const rowSpacing = Math.max(2, rowFontSize * 0.22);
    const qtyColumnWidth = 80;
    const skuColumnWidth = Math.max(40, pageWidth - (marginX * 2) - qtyColumnWidth - 14);

    let page = targetPdf.addPage([pageWidth, pageHeight]);
    let cursorY = drawAmazonSummaryHeader(page, font, pageWidth, pageHeight - 16, false);

    for (const entry of entries) {
        const skuLines = wrapTextToWidth(entry.sku, font, rowFontSize, skuColumnWidth);
        const safeLines = skuLines.length > 0 ? skuLines : ['-'];
        const rowHeight = (safeLines.length * rowLineHeight) + rowSpacing;

        if (cursorY - rowHeight < marginBottom) {
            page = targetPdf.addPage([pageWidth, pageHeight]);
            cursorY = drawAmazonSummaryHeader(page, font, pageWidth, pageHeight - 16, true);
        }

        safeLines.forEach((line, index) => {
            page.drawText(line, {
                x: marginX,
                y: cursorY - (index * rowLineHeight),
                size: rowFontSize,
                font,
                color: rgb(0, 0, 0)
            });
        });

        const qtyText = formatAmazonQty(entry.totalQty);
        const qtyTextWidth = font.widthOfTextAtSize(qtyText, rowFontSize);
        page.drawText(qtyText, {
            x: pageWidth - marginX - qtyTextWidth,
            y: cursorY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });

        cursorY -= rowHeight;
    }

    const grandTotal = entries.reduce((sum, entry) => sum + entry.totalQty, 0);
    if (cursorY - (rowLineHeight * 2) < marginBottom) {
        page = targetPdf.addPage([pageWidth, pageHeight]);
        cursorY = drawAmazonSummaryHeader(page, font, pageWidth, pageHeight - 16, true);
    }

    const totalTextSize = Math.max(rowFontSize, pageWidth * 0.015);
    page.drawText(`Grand Total Qty: ${formatAmazonQty(grandTotal)}`, {
        x: marginX,
        y: cursorY - rowLineHeight,
        size: totalTextSize,
        font,
        color: rgb(0, 0, 0)
    });
}

function getPositionedTextItems(items: PdfJsRawTextItem[]): PositionedTextItem[] {
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

function getAmazonQtyColumnBounds(
    positioned: PositionedTextItem[],
    descriptionHeader: PositionedTextItem
): { left: number; right: number } | null {
    const headerBandTolerance = 10;

    const headerBandItems = positioned
        .filter(item =>
            Math.abs(item.y - descriptionHeader.y) <= headerBandTolerance &&
            AMAZON_COLUMN_HEADERS.some(keyword => item.upper.includes(keyword))
        )
        .sort((a, b) => a.x - b.x);

    const qtyHeader = headerBandItems.find(
        item => item.upper.includes("QTY") || item.upper.includes("QUANTITY")
    );

    if (!qtyHeader) return null;

    const nextHeader = headerBandItems.find(item => item.x > qtyHeader.x + 0.5);
    return {
        left: qtyHeader.x - 4,
        right: nextHeader ? nextHeader.x - 1 : qtyHeader.x + 42
    };
}

function extractNumericQty(value: string): string | null {
    const cleaned = normalizeWhitespace(value);
    if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
    return cleaned.replace(/\.0+$/, "");
}

function groupTextLinesByY(items: PositionedTextItem[], tolerance: number): { y: number; words: PositionedTextItem[] }[] {
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

async function extractAmazonDescriptionFromInvoicePage(pdfPage: PdfJsPageProxy): Promise<AmazonInvoiceLabelData> {
    const textContent = await pdfPage.getTextContent();
    const positioned = getPositionedTextItems(textContent.items);
    if (positioned.length === 0) return { lineItems: [] };

    const descriptionHeader = positioned
        .filter(item => item.upper.includes(AMAZON_DESCRIPTION_HEADER))
        .sort((a, b) => b.y - a.y)[0];

    if (!descriptionHeader) return { lineItems: [] };

    const headerBandTolerance = 10;
    const headerBandCandidates = positioned.filter(
        item =>
            item.x > descriptionHeader.x + 8 &&
            Math.abs(item.y - descriptionHeader.y) <= headerBandTolerance &&
            AMAZON_COLUMN_HEADERS.some(keyword => item.upper.includes(keyword))
    );

    const rightBoundary = headerBandCandidates.length > 0
        ? Math.min(...headerBandCandidates.map(item => item.x)) - 1
        : descriptionHeader.x + 320;

    const totalMatches = positioned
        .filter(item => item.y < descriptionHeader.y && item.upper.includes(AMAZON_TOTAL_MARKER))
        .sort((a, b) => b.y - a.y);

    const totalY = totalMatches.length > 0
        ? totalMatches[0].y
        : descriptionHeader.y - 130;
    const lineTolerance = 2.5;
    const descriptionLeftBoundary = descriptionHeader.x - 2;
    const qtyBounds = getAmazonQtyColumnBounds(positioned, descriptionHeader);

    const bodyItems = positioned.filter(item =>
        item.y < descriptionHeader.y - 0.5 &&
        item.y > totalY + 0.5 &&
        !item.upper.includes(AMAZON_DESCRIPTION_HEADER) &&
        !item.upper.includes(AMAZON_TOTAL_MARKER)
    );

    const lines = groupTextLinesByY(bodyItems, lineTolerance);
    const lineItems: AmazonInvoiceLineItem[] = [];
    let currentItem: { parts: string[]; quantity: string | null } | null = null;

    for (const line of lines) {
        const hasSerialNumber = line.words.some(
            word => word.x < descriptionLeftBoundary && /^\d+$/.test(normalizeWhitespace(word.text))
        );

        const descriptionText = normalizeWhitespace(
            line.words
                .filter(word => word.x >= descriptionLeftBoundary && word.x < rightBoundary)
                .map(word => word.text)
                .join(' ')
        );

        const lineQty = qtyBounds
            ? line.words
                .filter(word => word.x >= qtyBounds.left && word.x < qtyBounds.right)
                .map(word => extractNumericQty(word.text))
                .find(Boolean) ?? null
            : null;

        if (hasSerialNumber) {
            if (currentItem && currentItem.parts.length > 0) {
                lineItems.push({
                    description: normalizeWhitespace(currentItem.parts.join(' ')),
                    quantity: currentItem.quantity
                });
            }
            currentItem = { parts: [], quantity: null };
        } else if (!currentItem && descriptionText) {
            currentItem = { parts: [], quantity: null };
        }

        if (!currentItem) continue;

        const isHsnLine = /^HSN[:\s]/i.test(descriptionText);
        if (descriptionText && !isHsnLine) {
            currentItem.parts.push(descriptionText);
        }

        if (!currentItem.quantity && lineQty) {
            currentItem.quantity = lineQty;
        }
    }

    if (currentItem && currentItem.parts.length > 0) {
        lineItems.push({
            description: normalizeWhitespace(currentItem.parts.join(' ')),
            quantity: currentItem.quantity
        });
    }

    if (lineItems.length === 0) {
        const fallbackDescription = normalizeWhitespace(
            lines
                .map(line =>
                    normalizeWhitespace(
                        line.words
                            .filter(word => word.x >= descriptionLeftBoundary && word.x < rightBoundary)
                            .map(word => word.text)
                            .join(' ')
                    )
                )
                .filter(Boolean)
                .join(' ')
        );

        if (fallbackDescription) {
            const fallbackQty = lines
                .flatMap(line =>
                    qtyBounds
                        ? line.words
                            .filter(word => word.x >= qtyBounds.left && word.x < qtyBounds.right)
                            .map(word => extractNumericQty(word.text))
                        : []
                )
                .find(Boolean) ?? null;

            lineItems.push({
                description: fallbackDescription,
                quantity: fallbackQty
            });
        }
    }

    return { lineItems };
}

function wrapTextToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
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

function fitDescriptionInBox(
    text: string,
    font: PDFFont,
    maxTextWidth: number,
    maxTextHeight: number
): { fontSize: number; lines: string[]; truncated: boolean } {
    let fallbackLines: string[] = [];
    let fallbackFontSize = AMAZON_DESCRIPTION_BOX.minFontSize;

    for (
        let fontSize = AMAZON_DESCRIPTION_BOX.maxFontSize;
        fontSize >= AMAZON_DESCRIPTION_BOX.minFontSize;
        fontSize = Number((fontSize - AMAZON_DESCRIPTION_BOX.fontStep).toFixed(2))
    ) {
        const lines = wrapTextToWidth(text, font, fontSize, maxTextWidth);
        const lineHeight = fontSize * AMAZON_DESCRIPTION_BOX.lineHeightRatio;
        const maxLines = Math.max(1, Math.floor(maxTextHeight / lineHeight));

        if (lines.length <= maxLines) {
            return { fontSize, lines, truncated: false };
        }

        fallbackFontSize = fontSize;
        fallbackLines = lines.slice(0, maxLines);
    }

    if (fallbackLines.length === 0) {
        return { fontSize: fallbackFontSize, lines: [], truncated: false };
    }

    const ellipsis = "...";
    const lastIndex = fallbackLines.length - 1;
    let lastLine = fallbackLines[lastIndex];

    while (
        lastLine &&
        font.widthOfTextAtSize(`${lastLine}${ellipsis}`, fallbackFontSize) > maxTextWidth
    ) {
        lastLine = lastLine.slice(0, -1).trimEnd();
    }

    fallbackLines[lastIndex] = lastLine ? `${lastLine}${ellipsis}` : ellipsis;
    return { fontSize: fallbackFontSize, lines: fallbackLines, truncated: true };
}

function drawAmazonDescriptionBoxOnLabelPage(
    page: PDFPage,
    description: string,
    font: PDFFont
): void {
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const boxX = pageWidth * AMAZON_DESCRIPTION_BOX.xRatio;
    const boxY = pageHeight * AMAZON_DESCRIPTION_BOX.yRatio;
    const boxWidth = pageWidth * AMAZON_DESCRIPTION_BOX.widthRatio;
    const boxHeight = pageHeight * AMAZON_DESCRIPTION_BOX.heightRatio;

    const horizontalPadding = Math.max(4, pageWidth * 0.006);
    const verticalPadding = Math.max(4, pageHeight * 0.0045);
    const maxTextWidth = Math.max(0, boxWidth - (horizontalPadding * 2) + 20);
    const maxTextHeight = Math.max(0, boxHeight - (verticalPadding * 2) - 10);

    const drawScale = 2;
    const { lines, fontSize } = fitDescriptionInBox(
        description,
        font,
        maxTextWidth / drawScale,
        maxTextHeight / drawScale
    );
    const drawFontSize = fontSize * drawScale;
    const drawLineHeight = drawFontSize * AMAZON_DESCRIPTION_BOX.lineHeightRatio;
    const topTextLimit = boxY + boxHeight - verticalPadding;
    // Anchor text to the bottom so one SKU stays at the same baseline
    // and additional SKUs stack upward.
    let textY = boxY + verticalPadding + (Math.max(0, lines.length - 1) * drawLineHeight);

    for (const line of lines) {
        if (textY > topTextLimit) {
            textY -= drawLineHeight;
            continue;
        }
        page.drawText(line, {
            x: boxX + horizontalPadding,
            y: textY,
            size: drawFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        textY -= drawLineHeight;
    }
}

/**
 * Extracts pages from a source PDF and crops them to a specific label size.
 */
export async function cropLabels(
    sourcePdf: PDFDocument,
    config: CropConfig,
    extractSku: boolean = false,
    variantId: string | null = null,
    selectedOptions: string[] = [],
    amazonDescriptionMode: AmazonDescriptionMode = 'WITH_SKU',
    includeAmazonOrderSummary: boolean = false,
    includeMeeshoOrderSummary: boolean = false
): Promise<PDFDocument> {
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

    let originalDocProxy: PdfJsDocumentProxy | null = null;
    let helveticaFont: PDFFont | null = null;

    if (extractSku || selectedOptions.length > 0 || config.label === "Meesho" || config.label === "Amazon") {
        const pdfBytes = await sourcePdf.save();
        originalDocProxy = await pdfjsLib.getDocument(pdfBytes).promise as PdfJsDocumentProxy;
        helveticaFont = await newPdf.embedFont(StandardFonts.Helvetica);
    }



    let defaultTlx = config.tlx;
    let defaultTly = config.tly;
    let defaultBrx = config.brx;
    let defaultBry = config.bry;

    // Override with variant coordinates if selected
    if (variantId && config.variants) {
        const variant = config.variants.find(v => v.id === variantId);
        if (variant) {
            defaultTlx = variant.tlx;
            defaultTly = variant.tly;
            defaultBrx = variant.brx;
            defaultBry = variant.bry;
        }
    }

    if (config.label === "Amazon") {
        // Amazon labels come as 2-page pairs: odd page = label, even page = invoice.
        // Keep odd pages only, and transfer invoice description into label page.
        const amazonSummaryMap = new Map<string, number>();

        for (let i = 0; i < copiedPages.length; i += 2) {
            const page = copiedPages[i];

            if (i + 1 < copiedPages.length && originalDocProxy && helveticaFont) {
                try {
                    const invoicePage = await originalDocProxy.getPage(i + 2);
                    const { lineItems } = await extractAmazonDescriptionFromInvoicePage(invoicePage);

                    if (includeAmazonOrderSummary) {
                        for (const lineItem of lineItems) {
                            const sku = getAmazonLineBaseText(lineItem.description, 'WITH_SKU');
                            if (!sku) continue;
                            const qty = parseAmazonQty(lineItem.quantity);
                            amazonSummaryMap.set(sku, (amazonSummaryMap.get(sku) ?? 0) + qty);
                        }
                    }

                    const formattedLines = lineItems
                        .map((lineItem) => {
                            const normalizedBase = getAmazonLineBaseText(
                                lineItem.description,
                                amazonDescriptionMode
                            );
                            if (!normalizedBase) return "";

                            const qtySuffix = lineItem.quantity ? `(Qty : ${lineItem.quantity})` : "";
                            return qtySuffix
                                ? `${normalizedBase} ${qtySuffix}`
                                : normalizedBase;
                        })
                        .filter(Boolean);

                    const finalDescription = formattedLines.join('\n');

                    if (finalDescription) {
                        drawAmazonDescriptionBoxOnLabelPage(
                            page,
                            finalDescription,
                            helveticaFont
                        );
                    }
                } catch (e) {
                    console.warn("Failed to process Amazon description pair for page", i, e);
                }
            }

            newPdf.addPage(page);
        }

        if (includeAmazonOrderSummary && helveticaFont && copiedPages.length > 0) {
            const firstPage = copiedPages[0];
            const { width: pageWidth, height: pageHeight } = firstPage.getSize();
            const summaryEntries = [...amazonSummaryMap.entries()]
                .map(([sku, totalQty]) => ({ sku, totalQty }))
                .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

            appendAmazonSummaryPages(newPdf, summaryEntries, helveticaFont, pageWidth, pageHeight);
        }

        return newPdf;
    }

function drawMeeshoSummaryHeader(
    page: PDFPage,
    font: PDFFont,
    pageWidth: number,
    y: number,
    isContinuation: boolean
): number {
    const titleSize = Math.max(8, pageWidth * 0.02);
    const subTitleSize = Math.max(6.5, pageWidth * 0.015);

    page.drawText(isContinuation ? "Meesho Order Summary (continued)" : "Meesho Order Summary", {
        x: 16,
        y,
        size: titleSize,
        font,
        color: rgb(0, 0, 0)
    });

    const columnY = y - (titleSize + 8);
    page.drawText("SKU", {
        x: 16,
        y: columnY,
        size: subTitleSize,
        font,
        color: rgb(0, 0, 0)
    });
    page.drawText("Total Qty", {
        x: pageWidth - 96,
        y: columnY,
        size: subTitleSize,
        font,
        color: rgb(0, 0, 0)
    });

    const dataStartGap = Math.max(14, subTitleSize * 2.2);
    return columnY - dataStartGap;
}

function appendMeeshoSummaryPages(
    targetPdf: PDFDocument,
    entries: MeeshoSummaryEntry[],
    font: PDFFont,
    pageWidth: number,
    pageHeight: number
): void {
    if (entries.length === 0) return;

    const marginX = 16;
    const marginBottom = 14;
    const rowFontSize = Math.max(5.5, pageWidth * 0.012);
    const rowLineHeight = rowFontSize * 1.25;
    const rowSpacing = Math.max(2, rowFontSize * 0.22);
    const qtyColumnWidth = 80;
    const skuColumnWidth = Math.max(40, pageWidth - (marginX * 2) - qtyColumnWidth - 14);

    let page = targetPdf.addPage([pageWidth, pageHeight]);
    let cursorY = drawMeeshoSummaryHeader(page, font, pageWidth, pageHeight - 16, false);

    for (const entry of entries) {
        const skuLines = wrapTextToWidth(entry.sku, font, rowFontSize, skuColumnWidth);
        const safeLines = skuLines.length > 0 ? skuLines : ['-'];
        const rowHeight = (safeLines.length * rowLineHeight) + rowSpacing;

        if (cursorY - rowHeight < marginBottom) {
            page = targetPdf.addPage([pageWidth, pageHeight]);
            cursorY = drawMeeshoSummaryHeader(page, font, pageWidth, pageHeight - 16, true);
        }

        safeLines.forEach((line, index) => {
            page.drawText(line, {
                x: marginX,
                y: cursorY - (index * rowLineHeight),
                size: rowFontSize,
                font,
                color: rgb(0, 0, 0)
            });
        });

        const qtyText = String(entry.totalQty);
        const qtyTextWidth = font.widthOfTextAtSize(qtyText, rowFontSize);
        page.drawText(qtyText, {
            x: pageWidth - marginX - qtyTextWidth,
            y: cursorY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });

        cursorY -= rowHeight;
    }

    const grandTotal = entries.reduce((sum, entry) => sum + entry.totalQty, 0);
    if (cursorY - (rowLineHeight * 2) < marginBottom) {
        page = targetPdf.addPage([pageWidth, pageHeight]);
        cursorY = drawMeeshoSummaryHeader(page, font, pageWidth, pageHeight - 16, true);
    }

    const totalTextSize = Math.max(rowFontSize, pageWidth * 0.015);
    page.drawText(`Grand Total Qty: ${grandTotal}`, {
        x: marginX,
        y: cursorY - rowLineHeight,
        size: totalTextSize,
        font,
        color: rgb(0, 0, 0)
    });
}

    const meeshoSummaryMap = new Map<string, number>();

    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { height: pageHeight } = page.getSize();

        const tlx = defaultTlx;
        const tly = defaultTly;
        const brx = defaultBrx;
        let bry = defaultBry;

        // Dynamic Bry for Meesho
        if (config.label === "Meesho" && originalDocProxy) {
            try {
                const pdfjsPage = await originalDocProxy.getPage(i + 1);
                const textContent = await pdfjsPage.getTextContent();

                if (variantId === 'without_invoice') {
                    // Find "TAX INVOICE" text Y-coordinate
                    let taxInvoiceY = null;
                    for (const item of textContent.items) {
                        const itemY = Array.isArray(item.transform) ? Number(item.transform[5]) : Number.NaN;
                        if (
                            item.str &&
                            item.str.toUpperCase().includes("TAX INVOICE") &&
                            !Number.isNaN(itemY)
                        ) {
                            taxInvoiceY = itemY;
                            break; // Stop at first occurrence
                        }
                    }
                    if (taxInvoiceY !== null) {
                        // taxInvoiceY is from the bottom. Cut just above it (e.g. 10 units)
                        bry = pageHeight - (taxInvoiceY + 10);
                    }
                } else if (variantId === 'with_invoice') {
                    // Find the lowest text on the page to cut exactly after it
                    let lowestY = pageHeight;
                    for (const item of textContent.items) {
                        const itemY = Array.isArray(item.transform) ? Number(item.transform[5]) : Number.NaN;
                        if (
                            item.str &&
                            item.str.trim() !== '' &&
                            !Number.isNaN(itemY) &&
                            itemY < lowestY
                        ) {
                            lowestY = itemY;
                        }
                    }
                    if (lowestY < pageHeight) {
                        // Cut slightly below the lowest text
                        bry = pageHeight - Math.max(0, lowestY - 10);
                    }
                }
            } catch (e) {
                console.warn("Failed to dynamically calc Meesho crop for page", i, e);
            }
        }

        const width = brx - tlx;
        const height = bry - tly;

        // Translate Top-Left origin coordinates to PDF Bottom-Left origin
        const x = tlx;
        const y = pageHeight - bry;

        if (!config.disableCrop) {
            page.setCropBox(x, y, Math.max(0, width), Math.max(0, height));
            page.setMediaBox(x, y, Math.max(0, width), Math.max(0, height));
        }

        if (config.label === "Meesho" && (extractSku || includeMeeshoOrderSummary) && originalDocProxy) {
            try {
                const pdfjsPage = await originalDocProxy.getPage(i + 1);
                const textContent = await pdfjsPage.getTextContent();
                const positioned = getPositionedTextItems(textContent.items);
                
                // 1. Identify Header Positions
                const skuHeader = positioned.find(p => p.upper === 'SKU');
                const sizeHeader = positioned.find(p => p.upper === 'SIZE');
                const qtyHeader = positioned.find(p => p.upper === 'QTY');

                if (skuHeader && sizeHeader && qtyHeader) {
                    // Define column boundaries
                    const skuMinX = skuHeader.x - 5;
                    const skuMaxX = sizeHeader.x - 5;
                    const qtyMinX = qtyHeader.x - 5;
                    const qtyMaxX = qtyHeader.x + 35; // Estimated width for Qty column

                    const lines = groupTextLinesByY(positioned, 5);
                    const headerLineIdx = lines.findIndex(l => l.words.some(w => w.upper === 'SKU'));
                    
                    // The data is usually in the line immediately following the header
                    const dataLine = lines[headerLineIdx + 1];

                    if (dataLine) {
                        // Extract SKU text from its column
                        const skuText = dataLine.words
                            .filter(w => w.x >= skuMinX && w.x <= skuMaxX)
                            .map(w => w.text)
                            .join(' ')
                            .trim();

                        // Extract Qty from its column
                        const qtyWord = dataLine.words.find(w => w.x >= qtyMinX && w.x <= qtyMaxX);
                        const qty = qtyWord ? parseInt(qtyWord.text.replace(/\D/g, '')) || 1 : 1;

                        // Filter out headers or accidental captures
                        const forbidden = ['SKU', 'SIZE', 'QTY', 'COLOR', 'ORDER NO.', 'FREE SIZE', 'NA'];
                        if (skuText && !forbidden.includes(skuText.toUpperCase())) {
                            if (extractSku && helveticaFont) {
                                page.drawText(`SKU: ${skuText}`, {
                                    x: x + 10,
                                    y: y + 10,
                                    size: 10,
                                    font: helveticaFont,
                                    color: rgb(0, 0, 0),
                                });
                            }
                            
                            if (includeMeeshoOrderSummary) {
                                meeshoSummaryMap.set(skuText, (meeshoSummaryMap.get(skuText) ?? 0) + qty);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("Failed to extract Meesho data for page", i, e);
            }
        } else if (extractSku && originalDocProxy && helveticaFont) {
            // Fallback for other platforms (Flipkart, etc.)
            try {
                const pdfjsPage = await originalDocProxy.getPage(i + 1);
                const text = await extractTextFromPage(pdfjsPage);
                const skuMatch = text.match(/SKU:?\s*([A-Za-z0-9\-_]+)/i);
                const sku = skuMatch ? skuMatch[1] : null;

                if (sku) {
                    page.drawText(`SKU: ${sku}`, {
                        x: x + 10,
                        y: y + 10,
                        size: 10,
                        font: helveticaFont,
                        color: rgb(0, 0, 0),
                    });
                }
            } catch (e) {
                console.warn("Failed to extract SKU for generic page", i, e);
            }
        }

        newPdf.addPage(page);
    }

    if (config.label === "Meesho" && includeMeeshoOrderSummary && helveticaFont && copiedPages.length > 0) {
        const firstPage = copiedPages[0];
        const { width: pageWidth, height: pageHeight } = firstPage.getSize();
        const summaryEntries = [...meeshoSummaryMap.entries()]
            .map(([sku, totalQty]) => ({ sku, totalQty }))
            .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

        appendMeeshoSummaryPages(newPdf, summaryEntries, helveticaFont, pageWidth, pageHeight);
    }

    return newPdf;
}

/**
 * Merges multiple PDF documents into a single document.
 */
export async function mergePDFs(files: File[]): Promise<PDFDocument> {
    const mergedPdf = await PDFDocument.create();

    try {
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        // Normalize and validate the merged result before returning.
        const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
        return await PDFDocument.load(mergedBytes, { ignoreEncryption: true });
    } catch (error) {
        console.warn('Standard merge failed, using compatibility fallback merge.', error);
        return await mergePDFsWithImageFallback(files);
    }
}

/**
 * Merges in-memory PDF documents into a single PDF.
 */
export async function mergePDFDocuments(documents: PDFDocument[]): Promise<PDFDocument> {
    const mergedPdf = await PDFDocument.create();

    for (const document of documents) {
        const copiedPages = await mergedPdf.copyPages(document, document.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
    return await PDFDocument.load(mergedBytes, { ignoreEncryption: true });
}

async function mergePDFsWithImageFallback(files: File[]): Promise<PDFDocument> {
    const fallbackPdf = await PDFDocument.create();

    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
            const page = await pdf.getPage(pageIndex);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) continue;

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render({
                canvasContext: context,
                viewport,
                canvas
            }).promise;

            const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
            if (!imageBlob) continue;

            const imageBytes = await imageBlob.arrayBuffer();
            const embeddedImage = await fallbackPdf.embedJpg(imageBytes);
            const outputPage = fallbackPdf.addPage([viewport.width, viewport.height]);

            outputPage.drawImage(embeddedImage, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height
            });
        }
    }

    const bytes = await fallbackPdf.save({ useObjectStreams: false });
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
}

// Placeholder for A4 sheet generation (future feature)
export async function generateA4Sheet(): Promise<void> {
    // Logic to grid 4 labels per page...
}

/**
 * Splits a PDF into multiple documents, one for each page.
 */
export async function splitPDF(file: File): Promise<{ name: string; bytes: Uint8Array }[]> {
    const sourcePdf = await loadPDF(file);
    const pageCount = sourcePdf.getPageCount();
    const results: { name: string; bytes: Uint8Array }[] = [];

    const baseName = file.name.replace(/\.[^/.]+$/, "");

    for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
        newPdf.addPage(copiedPage);
        const bytes = await newPdf.save({ useObjectStreams: false });
        results.push({
            name: `${baseName}-page-${i + 1}.pdf`,
            bytes
        });
    }

    return results;
}

/**
 * Converts each page of a PDF into an image (PNG).
 */
export async function convertPDFToImages(file: File): Promise<{ name: string; blob: Blob }[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const results: { name: string; blob: Blob }[] = [];

    const baseName = file.name.replace(/\.[^/.]+$/, "");

    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High quality

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
        }).promise;

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
            results.push({
                name: `${baseName}-page-${i}.png`,
                blob
            });
        }
    }

    return results;
}

async function convertImageFileToPngBytes(file: File): Promise<ArrayBuffer> {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        imageBitmap.close();
        throw new Error('Canvas context unavailable while converting image.');
    }

    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    context.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) {
        throw new Error('Failed to normalize image to PNG.');
    }

    return await pngBlob.arrayBuffer();
}

/**
 * Converts multiple images into a single PDF, keeping selection order.
 */
export async function convertImagesToPDF(files: File[]): Promise<Uint8Array> {
    const outputPdf = await PDFDocument.create();

    for (const file of files) {
        const fileType = file.type.toLowerCase();
        const imageBuffer = await file.arrayBuffer();

        const embeddedImage =
            fileType === 'image/png'
                ? await outputPdf.embedPng(imageBuffer)
                : fileType === 'image/jpeg' || fileType === 'image/jpg'
                    ? await outputPdf.embedJpg(imageBuffer)
                    : await outputPdf.embedPng(await convertImageFileToPngBytes(file));

        const page = outputPdf.addPage([embeddedImage.width, embeddedImage.height]);
        page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height
        });
    }

    return await outputPdf.save({ useObjectStreams: false });
}

export type CompressionLevel = 'EXTREME' | 'RECOMMENDED' | 'LESS'

const COMPRESSION_PRESETS: Record<CompressionLevel, { scale: number; jpegQuality: number }> = {
    EXTREME: {
        scale: 1.0,
        jpegQuality: 0.55
    },
    RECOMMENDED: {
        scale: 1.35,
        jpegQuality: 0.75
    },
    LESS: {
        scale: 1.8,
        jpegQuality: 0.9
    }
}

/**
 * Compresses a PDF by rasterizing each page as JPEG and rebuilding the document.
 * This allows quality/size tradeoffs based on the selected compression level.
 */
export async function compressPDF(
    file: File,
    level: CompressionLevel = 'RECOMMENDED'
): Promise<Uint8Array> {
    const preset = COMPRESSION_PRESETS[level];
    const sourceBuffer = await file.arrayBuffer();
    const sourcePdfJs = await pdfjsLib.getDocument({ data: sourceBuffer }).promise;
    const compressedPdf = await PDFDocument.create();
    let addedPages = 0;

    for (let i = 1; i <= sourcePdfJs.numPages; i++) {
        const page = await sourcePdfJs.getPage(i);
        const renderViewport = page.getViewport({ scale: preset.scale });
        const baseViewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) continue;

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);

        await page.render({
            canvasContext: context,
            viewport: renderViewport,
            canvas
        }).promise;

        const imageBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', preset.jpegQuality)
        );

        if (!imageBlob) continue;

        const imageBytes = await imageBlob.arrayBuffer();
        const embeddedImage = await compressedPdf.embedJpg(imageBytes);
        const outputPage = compressedPdf.addPage([baseViewport.width, baseViewport.height]);

        outputPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: baseViewport.width,
            height: baseViewport.height
        });

        addedPages += 1;
    }

    if (addedPages === 0) {
        const sourcePdf = await loadPDF(file);
        const copiedPages = await compressedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => compressedPdf.addPage(page));
    }

    return await compressedPdf.save({
        useObjectStreams: true
    });
}
