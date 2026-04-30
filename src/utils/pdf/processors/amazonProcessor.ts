import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
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
    extractTextFromPage,
    normalizeWhitespace, 
    getPositionedTextItems, 
    wrapTextToWidth,
    groupTextLinesByY,
    formatProcessTimestamp
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


function isLikelyProcessedAmazonOutput(text: string): boolean {
    const normalized = normalizeWhitespace(text).toUpperCase();
    if (!normalized) return false;

    return (
        normalized.includes("THIS AMAZON LABEL IS CROPPED BY LABELCROPPER") ||
        normalized.includes("AMAZON LABEL SUMMARY") ||
        normalized.includes("AMAZON LABLE PROCESSED AT") ||
        normalized.includes("PROCESS TIME")
    );
}

function isAmazonInvoicePageText(text: string): boolean {
    return !isLikelyProcessedAmazonOutput(text);
}

function drawAmazonSummaryHeader(
    page: PDFPage,
    font: PDFFont,
    pageWidth: number,
    pageHeight: number,
    isContinuation: boolean
): number {
    const tableX = 16;
    const tableWidth = pageWidth - 32;
    const tableTopY = pageHeight - 20;
    const headlineRowHeight = 22;
    const headerRowHeight = 20;
    const ordColWidth = Math.min(48, tableWidth * 0.12);
    const qtyColWidth = Math.min(48, tableWidth * 0.12);
    const skuColWidth = Math.max(120, tableWidth - ordColWidth - qtyColWidth);
    const headlineFontSize = Math.max(8.5, pageWidth * 0.021);
    const headerFontSize = Math.max(8, pageWidth * 0.017);

    const todayText = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(new Date());
    const headlineText = isContinuation
        ? `Amazon label summary (continued) on ${todayText}`
        : `This Amazon label is cropped by LabelCropper on ${todayText}`;

    const headlineBottomY = tableTopY - headlineRowHeight;
    const headerBottomY = headlineBottomY - headerRowHeight;

    page.drawRectangle({
        x: tableX,
        y: headlineBottomY,
        width: tableWidth,
        height: headlineRowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.8
    });

    page.drawText(headlineText, {
        x: tableX + 4,
        y: headlineBottomY + ((headlineRowHeight - headlineFontSize) / 2),
        size: headlineFontSize,
        font,
        color: rgb(0, 0, 0)
    });

    page.drawRectangle({
        x: tableX,
        y: headerBottomY,
        width: ordColWidth,
        height: headerRowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.8
    });
    page.drawRectangle({
        x: tableX + ordColWidth,
        y: headerBottomY,
        width: qtyColWidth,
        height: headerRowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.8
    });
    page.drawRectangle({
        x: tableX + ordColWidth + qtyColWidth,
        y: headerBottomY,
        width: skuColWidth,
        height: headerRowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.8
    });

    page.drawText("ORD", {
        x: tableX + 4,
        y: headerBottomY + ((headerRowHeight - headerFontSize) / 2),
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0)
    });
    page.drawText("QTY", {
        x: tableX + ordColWidth + 4,
        y: headerBottomY + ((headerRowHeight - headerFontSize) / 2),
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0)
    });
    page.drawText("SKU", {
        x: tableX + ordColWidth + qtyColWidth + 4,
        y: headerBottomY + ((headerRowHeight - headerFontSize) / 2),
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0)
    });

    return headerBottomY;
}

function appendAmazonSummaryPages(
    targetPdf: PDFDocument,
    entries: AmazonSummaryEntry[],
    font: PDFFont,
    pageWidth: number,
    pageHeight: number
): void {
    if (entries.length === 0) return;

    const tableX = 16;
    const tableWidth = pageWidth - 32;
    const marginBottom = 18;
    const rowFontSize = Math.max(8, pageWidth * 0.016);
    const rowLineHeight = rowFontSize * 1.2;
    const rowPaddingY = Math.max(2, rowFontSize * 0.24);
    const ordColWidth = Math.min(48, tableWidth * 0.12);
    const qtyColWidth = Math.min(48, tableWidth * 0.12);
    const skuColWidth = Math.max(120, tableWidth - ordColWidth - qtyColWidth);
    const skuTextWidth = Math.max(24, skuColWidth - 8);
    const footerHeight = Math.max(20, rowFontSize * 2);
    const borderWidth = 0.8;

    let page = targetPdf.addPage([pageWidth, pageHeight]);
    let cursorY = drawAmazonSummaryHeader(page, font, pageWidth, pageHeight, false);

    for (const entry of entries) {
        const skuLines = wrapTextToWidth(entry.sku, font, rowFontSize, skuTextWidth);
        const safeLines = skuLines.length > 0 ? skuLines : ['-'];
        const rowHeight = (safeLines.length * rowLineHeight) + (rowPaddingY * 2);

        if (cursorY - rowHeight < marginBottom + footerHeight) {
            page = targetPdf.addPage([pageWidth, pageHeight]);
            cursorY = drawAmazonSummaryHeader(page, font, pageWidth, pageHeight, true);
        }

        const rowBottomY = cursorY - rowHeight;
        page.drawRectangle({
            x: tableX,
            y: rowBottomY,
            width: ordColWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth
        });
        page.drawRectangle({
            x: tableX + ordColWidth,
            y: rowBottomY,
            width: qtyColWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth
        });
        page.drawRectangle({
            x: tableX + ordColWidth + qtyColWidth,
            y: rowBottomY,
            width: skuColWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth
        });

        const ordText = String(entry.orderCount);
        const qtyText = entry.qtyPerSku;
        const ordTextWidth = font.widthOfTextAtSize(ordText, rowFontSize);
        const qtyTextWidth = font.widthOfTextAtSize(qtyText, rowFontSize);
        const ordTextY = rowBottomY + ((rowHeight - rowFontSize) / 2);
        const qtyTextY = ordTextY;

        page.drawText(ordText, {
            x: tableX + Math.max(4, (ordColWidth - ordTextWidth) / 2),
            y: ordTextY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        page.drawText(qtyText, {
            x: tableX + ordColWidth + Math.max(4, (qtyColWidth - qtyTextWidth) / 2),
            y: qtyTextY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });

        const skuStartY = rowBottomY + rowHeight - rowPaddingY - rowFontSize;
        safeLines.forEach((line, index) => {
            page.drawText(line, {
                x: tableX + ordColWidth + qtyColWidth + 4,
                y: skuStartY - (index * rowLineHeight),
                size: rowFontSize,
                font,
                color: rgb(0, 0, 0)
            });
        });

        cursorY = rowBottomY;
    }

    const grandTotal = entries.reduce((sum, entry) => sum + entry.totalQty, 0);
    if (cursorY - footerHeight < marginBottom) {
        page = targetPdf.addPage([pageWidth, pageHeight]);
        cursorY = drawAmazonSummaryHeader(page, font, pageWidth, pageHeight, true);
    }

    const footerBottomY = cursorY - footerHeight;
    page.drawRectangle({
        x: tableX,
        y: footerBottomY,
        width: tableWidth,
        height: footerHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth
    });

    const totalText = `Total package: ${formatAmazonQty(grandTotal)}`;
    page.drawText(totalText, {
        x: tableX + 4,
        y: footerBottomY + ((footerHeight - rowFontSize) / 2),
        size: rowFontSize,
        font,
        color: rgb(0, 0, 0)
    });
}

function getAmazonQtyColumnBounds(
    positioned: PositionedTextItem[],
    descriptionHeader: PositionedTextItem
): { left: number; right: number } | null {
    const headerBandTolerance = 10;
    const qtyCandidates = positioned.filter(
        item => item.upper.includes("QTY") || item.upper.includes("QUANTITY")
    );

    if (qtyCandidates.length === 0) return null;

    const qtyHeader = qtyCandidates
        .map((candidate) => {
            const sameRowHeaders = positioned.filter(item =>
                Math.abs(item.y - candidate.y) <= headerBandTolerance &&
                AMAZON_COLUMN_HEADERS.some(keyword => item.upper.includes(keyword))
            );

            const rowScore = sameRowHeaders.length;
            const distanceFromDescription = Math.abs(candidate.y - descriptionHeader.y);

            return {
                candidate,
                sameRowHeaders: sameRowHeaders.sort((a, b) => a.x - b.x),
                rowScore,
                distanceFromDescription
            };
        })
        .sort((a, b) => {
            if (b.rowScore !== a.rowScore) return b.rowScore - a.rowScore;
            return a.distanceFromDescription - b.distanceFromDescription;
        })[0];

    if (!qtyHeader || qtyHeader.rowScore === 0) return null;

    const nextHeader = qtyHeader.sameRowHeaders.find(
        item => item.x > qtyHeader.candidate.x + 0.5
    );
    return {
        left: qtyHeader.candidate.x - 4,
        right: nextHeader ? nextHeader.x - 1 : qtyHeader.candidate.x + 42
    };
}

function extractNumericQty(value: string): string | null {
    const cleaned = normalizeWhitespace(value);
    if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
    return cleaned.replace(/\.0+$/, "");
}

function extractAmazonQtyFromLine(
    words: PositionedTextItem[],
    qtyBounds: { left: number; right: number } | null
): string | null {
    const fromColumn = qtyBounds
        ? words
            .filter(word => word.x >= qtyBounds.left && word.x < qtyBounds.right)
            .map(word => extractNumericQty(word.text))
            .find(Boolean) ?? null
        : null;

    if (fromColumn) return fromColumn;

    // Some invoices merge table cells into one text token (e.g. "₹253.39 2 ₹506.78 18%").
    // Fallback to parse qty from the unit-price/qty/net-amount pattern.
    const lineText = normalizeWhitespace(words.map(word => word.text).join(' '));
    const inlinePriceQtyMatch = lineText.match(
        /(?:₹|INR|RS\.?)\s*[\d,]+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+(?:₹|INR|RS\.?)\s*[\d,]+(?:\.\d+)?/i
    );

    if (!inlinePriceQtyMatch?.[1]) return null;
    return extractNumericQty(inlinePriceQtyMatch[1]);
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

        const lineQty = extractAmazonQtyFromLine(line.words, qtyBounds);

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
                .map(line => extractAmazonQtyFromLine(line.words, qtyBounds))
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
    const qtyHighlightPattern = /\([^)]*QTY\s*:\s*(\d+(?:\.\d+)?)[^)]*\)/ig;

    let textY = boxY + verticalPadding + (Math.max(0, lines.length - 1) * drawLineHeight);

    for (const line of lines) {
        if (textY > topTextLimit) {
            textY -= drawLineHeight;
            continue;
        }

        let cursorX = boxX + horizontalPadding;
        let lastIndex = 0;
        let match: RegExpExecArray | null = null;

        qtyHighlightPattern.lastIndex = 0;
        while ((match = qtyHighlightPattern.exec(line)) !== null) {
            const fullMatch = match[0];
            const qtyValue = Number(match[1]);
            const matchIndex = match.index;
            const textBefore = line.slice(lastIndex, matchIndex);

            if (textBefore) {
                page.drawText(textBefore, {
                    x: cursorX,
                    y: textY,
                    size: drawFontSize,
                    font,
                    color: rgb(0, 0, 0)
                });
                cursorX += font.widthOfTextAtSize(textBefore, drawFontSize);
            }

            const shouldHighlightQty = Number.isFinite(qtyValue) && qtyValue > 1;
            if (shouldHighlightQty) {
                const badgePaddingX = Math.max(2.2, drawFontSize * 0.15);
                const badgePaddingY = Math.max(1.6, drawFontSize * 0.09);
                const badgeWidth = font.widthOfTextAtSize(fullMatch, drawFontSize) + (badgePaddingX * 2);
                const badgeHeight = drawFontSize + (badgePaddingY * 2);

                page.drawRectangle({
                    x: cursorX,
                    y: textY - badgePaddingY,
                    width: badgeWidth,
                    height: badgeHeight,
                    color: rgb(0, 0, 0)
                });

                page.drawText(fullMatch, {
                    x: cursorX + badgePaddingX,
                    y: textY,
                    size: drawFontSize,
                    font,
                    color: rgb(1, 1, 1)
                });

                cursorX += badgeWidth;
            } else {
                page.drawText(fullMatch, {
                    x: cursorX,
                    y: textY,
                    size: drawFontSize,
                    font,
                    color: rgb(0, 0, 0)
                });
                cursorX += font.widthOfTextAtSize(fullMatch, drawFontSize);
            }

            lastIndex = matchIndex + fullMatch.length;
        }

        const trailingText = line.slice(lastIndex);
        if (trailingText) {
            page.drawText(trailingText, {
                x: cursorX,
                y: textY,
                size: drawFontSize,
                font,
                color: rgb(0, 0, 0)
            });
        }

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
    const amazonSummaryMap = new Map<string, { orderCount: number; totalQty: number; qtyValues: Set<string> }>();
    if (options.helveticaFont) await targetPdf.embedFont(StandardFonts.HelveticaBold);
    const processTimeStamp = formatProcessTimestamp(new Date());

    const labelsToInclude: { page: PDFPage, totalQty: number }[] = [];

    for (let i = 0; i < copiedPages.length; i += 2) {
        const page = copiedPages[i];
        let totalOrderQty = 1;

        if (options.includeDateTimeOnLabel && options.helveticaFont) {
            const { x: cropX, y: cropY } = page.getCropBox();
            const dateTimeText = `- Amazon Lable Processed At - ${processTimeStamp}`;
            page.drawText(dateTimeText, {
                x: cropX + 6,
                y: cropY + 6,
                size: 8.4,
                font: options.helveticaFont,
                color: rgb(0, 0, 0)
            });
        }

        if (i + 1 < copiedPages.length && options.originalDocProxy && options.helveticaFont) {
            try {
                const invoicePage = await options.originalDocProxy.getPage(i + 2);
                const invoiceText = await extractTextFromPage(invoicePage);
                
                if (isAmazonInvoicePageText(invoiceText)) {
                    const { lineItems } = await extractAmazonDescriptionFromInvoicePage(invoicePage);
                    totalOrderQty = lineItems.reduce((sum, item) => sum + parseAmazonQty(item.quantity), 0);

                    if (options.includeAmazonOrderSummary) {
                        for (const lineItem of lineItems) {
                            const sku = getAmazonLineBaseText(lineItem.description, 'WITH_SKU');
                            if (!sku) continue;
                            const qty = parseAmazonQty(lineItem.quantity);

                            const existing = amazonSummaryMap.get(sku) ?? {
                                orderCount: 0,
                                totalQty: 0,
                                qtyValues: new Set<string>()
                            };
                            existing.orderCount += 1;
                            existing.totalQty += qty;
                            existing.qtyValues.add(formatAmazonQty(qty));
                            amazonSummaryMap.set(sku, existing);
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
                }
            } catch (e) {
                console.warn("Failed to process Amazon description pair for page", i, e);
            }
        }

        labelsToInclude.push({ page, totalQty: totalOrderQty });
    }

    // Sorting by QTY if enabled
    if (options.includeMultiQtySummary) {
        labelsToInclude.sort((a, b) => a.totalQty - b.totalQty);
    }

    // Add all processed label pages to the target PDF
    for (const item of labelsToInclude) {
        targetPdf.addPage(item.page);
    }

    // Summary Page (Pick List)
    if (options.includeAmazonOrderSummary && options.helveticaFont && labelsToInclude.length > 0) {
        const orderCount = labelsToInclude.length;
        const threshold = options.summaryThreshold ?? 0;

        if (orderCount >= threshold) {
            const firstPage = labelsToInclude[0].page;
            const { width: pageWidth, height: pageHeight } = firstPage.getSize();
            const summaryEntries = [...amazonSummaryMap.entries()]
                .map(([sku, summary]) => ({
                    sku,
                    orderCount: summary.orderCount,
                    qtyPerSku: summary.qtyValues.size === 1
                        ? [...summary.qtyValues][0]
                        : "Mix",
                    totalQty: summary.totalQty
                }))
                .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

            appendAmazonSummaryPages(targetPdf, summaryEntries, options.helveticaFont, pageWidth, pageHeight);
        }
    }
}
