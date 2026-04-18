import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type { 
    MeeshoSummaryEntry, 
    ProcessorOptions,
    CropConfig 
} from '../types';
import { 
    getPositionedTextItems, 
    wrapTextToWidth,
    groupTextLinesByY 
} from '../commonUtils';

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

export async function processMeesho(
    sourcePdf: PDFDocument,
    targetPdf: PDFDocument,
    config: CropConfig,
    options: ProcessorOptions
): Promise<void> {
    const copiedPages = await targetPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    const meeshoSummaryMap = new Map<string, number>();

    let defaultTlx = config.tlx;
    let defaultTly = config.tly;
    let defaultBrx = config.brx;
    let defaultBry = config.bry;

    if (options.variantId && config.variants) {
        const variant = config.variants.find(v => v.id === options.variantId);
        if (variant) {
            defaultTlx = variant.tlx;
            defaultTly = variant.tly;
            defaultBrx = variant.brx;
            defaultBry = variant.bry;
        }
    }

    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { height: pageHeight } = page.getSize();

        const tlx = defaultTlx;
        const tly = defaultTly;
        const brx = defaultBrx;
        let bry = defaultBry;

        // Dynamic Bry for Meesho
        if (options.originalDocProxy) {
            try {
                const pdfjsPage = await options.originalDocProxy.getPage(i + 1);
                const textContent = await pdfjsPage.getTextContent();

                if (options.variantId === 'without_invoice') {
                    let taxInvoiceY = null;
                    for (const item of textContent.items) {
                        const itemY = Array.isArray(item.transform) ? Number(item.transform[5]) : Number.NaN;
                        if (
                            item.str &&
                            item.str.toUpperCase().includes("TAX INVOICE") &&
                            !Number.isNaN(itemY)
                        ) {
                            taxInvoiceY = itemY;
                            break;
                        }
                    }
                    if (taxInvoiceY !== null) {
                        bry = pageHeight - (taxInvoiceY + 10);
                    }
                } else if (options.variantId === 'with_invoice') {
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
                        bry = pageHeight - Math.max(0, lowestY - 10);
                    }
                }
            } catch (e) {
                console.warn("Failed to dynamically calc Meesho crop for page", i, e);
            }
        }

        const width = brx - tlx;
        const height = bry - tly;
        const x = tlx;
        const y = pageHeight - bry;

        if (!config.disableCrop) {
            page.setCropBox(x, y, Math.max(0, width), Math.max(0, height));
            page.setMediaBox(x, y, Math.max(0, width), Math.max(0, height));
        }

        if ((options.extractSku || options.includeMeeshoOrderSummary) && options.originalDocProxy) {
            try {
                const pdfjsPage = await options.originalDocProxy.getPage(i + 1);
                const textContent = await pdfjsPage.getTextContent();
                const positioned = getPositionedTextItems(textContent.items);
                
                const skuHeader = positioned.find(p => p.upper === 'SKU');
                const sizeHeader = positioned.find(p => p.upper === 'SIZE');
                const qtyHeader = positioned.find(p => p.upper === 'QTY');

                if (skuHeader && sizeHeader && qtyHeader) {
                    const skuMinX = skuHeader.x - 5;
                    const skuMaxX = sizeHeader.x - 5;
                    const qtyMinX = qtyHeader.x - 5;
                    const qtyMaxX = qtyHeader.x + 35;

                    const lines = groupTextLinesByY(positioned, 5);
                    const headerLineIdx = lines.findIndex(l => l.words.some(w => w.upper === 'SKU'));
                    const dataLine = lines[headerLineIdx + 1];

                    if (dataLine) {
                        const skuText = dataLine.words
                            .filter(w => w.x >= skuMinX && w.x <= skuMaxX)
                            .map(w => w.text)
                            .join(' ')
                            .trim();

                        const qtyWord = dataLine.words.find(w => w.x >= qtyMinX && w.x <= qtyMaxX);
                        const qty = qtyWord ? parseInt(qtyWord.text.replace(/\D/g, '')) || 1 : 1;

                        const forbidden = ['SKU', 'SIZE', 'QTY', 'COLOR', 'ORDER NO.', 'FREE SIZE', 'NA'];
                        if (skuText && !forbidden.includes(skuText.toUpperCase())) {
                            if (options.extractSku && options.helveticaFont) {
                                page.drawText(`SKU: ${skuText}`, {
                                    x: x + 10,
                                    y: y + 10,
                                    size: 10,
                                    font: options.helveticaFont,
                                    color: rgb(0, 0, 0),
                                });
                            }
                            
                            if (options.includeMeeshoOrderSummary) {
                                meeshoSummaryMap.set(skuText, (meeshoSummaryMap.get(skuText) ?? 0) + qty);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("Failed to extract Meesho data for page", i, e);
            }
        }

        targetPdf.addPage(page);
    }

    if (options.includeMeeshoOrderSummary && options.helveticaFont && copiedPages.length > 0) {
        const firstPage = copiedPages[0];
        const { width: pageWidth, height: pageHeight } = firstPage.getSize();
        const summaryEntries = [...meeshoSummaryMap.entries()]
            .map(([sku, totalQty]) => ({ sku, totalQty }))
            .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

        appendMeeshoSummaryPages(targetPdf, summaryEntries, options.helveticaFont, pageWidth, pageHeight);
    }
}
