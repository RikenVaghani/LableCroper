import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type { 
    AmazonDescriptionMode, 
    AmazonInvoiceLabelData, 
    AmazonSummaryEntry, 
    PdfJsPageProxy, 
    PositionedTextItem,
    AmazonInvoiceLineItem,
    ProcessorOptions,
    CropConfig
} from '../types';
import { 
    normalizeWhitespace, 
    getPositionedTextItems, 
    wrapTextToWidth,
    groupTextLinesByY 
} from '../commonUtils';

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

    const dataStartGap = Math.max(14, subTitleSize * 2.2);
    return columnY - dataStartGap;
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

export async function processAmazon(
    sourcePdf: PDFDocument,
    targetPdf: PDFDocument,
    _config: CropConfig,
    options: ProcessorOptions
): Promise<void> {
    const copiedPages = await targetPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    const amazonSummaryMap = new Map<string, number>();

    for (let i = 0; i < copiedPages.length; i += 2) {
        const page = copiedPages[i];

        if (i + 1 < copiedPages.length && options.originalDocProxy && options.helveticaFont) {
            try {
                const invoicePage = await options.originalDocProxy.getPage(i + 2);
                const { lineItems } = await extractAmazonDescriptionFromInvoicePage(invoicePage);

                if (options.includeAmazonOrderSummary) {
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
                            options.amazonDescriptionMode || 'WITH_SKU'
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
                        options.helveticaFont
                    );
                }
            } catch (e) {
                console.warn("Failed to process Amazon description pair for page", i, e);
            }
        }

        targetPdf.addPage(page);
    }

    if (options.includeAmazonOrderSummary && options.helveticaFont && copiedPages.length > 0) {
        const firstPage = copiedPages[0];
        const { width: pageWidth, height: pageHeight } = firstPage.getSize();
        const summaryEntries = [...amazonSummaryMap.entries()]
            .map(([sku, totalQty]) => ({ sku, totalQty }))
            .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

        appendAmazonSummaryPages(targetPdf, summaryEntries, options.helveticaFont, pageWidth, pageHeight);
    }
}
