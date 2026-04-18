import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type { ProcessorOptions, CropConfig, FlipkartSummaryEntry } from '../types';
import { extractTextFromPage, wrapTextToWidth } from '../commonUtils';

function drawFlipkartSummaryHeader(
    page: PDFPage,
    font: PDFFont,
    pageWidth: number,
    y: number,
    isContinuation: boolean
): number {
    const titleSize = Math.max(8, pageWidth * 0.02);
    const subTitleSize = Math.max(6.5, pageWidth * 0.015);

    page.drawText(isContinuation ? "Flipkart Order Summary (continued)" : "Flipkart Order Summary", {
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

function appendFlipkartSummaryPages(
    targetPdf: PDFDocument,
    entries: FlipkartSummaryEntry[],
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
    let cursorY = drawFlipkartSummaryHeader(page, font, pageWidth, pageHeight - 16, false);

    for (const entry of entries) {
        const skuLines = wrapTextToWidth(entry.sku, font, rowFontSize, skuColumnWidth);
        const safeLines = skuLines.length > 0 ? skuLines : ['-'];
        const rowHeight = (safeLines.length * rowLineHeight) + rowSpacing;

        if (cursorY - rowHeight < marginBottom) {
            page = targetPdf.addPage([pageWidth, pageHeight]);
            cursorY = drawFlipkartSummaryHeader(page, font, pageWidth, pageHeight - 16, true);
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
        cursorY = drawFlipkartSummaryHeader(page, font, pageWidth, pageHeight - 16, true);
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

export async function processFlipkart(
    sourcePdf: PDFDocument,
    targetPdf: PDFDocument,
    config: CropConfig,
    options: ProcessorOptions
): Promise<void> {
    const copiedPages = await targetPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    const flipkartSummaryMap = new Map<string, number>();

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
        const bry = defaultBry;

        const width = brx - tlx;
        const height = bry - tly;
        const x = tlx;
        const y = pageHeight - bry;

        if (!config.disableCrop) {
            page.setCropBox(x, y, Math.max(0, width), Math.max(0, height));
            page.setMediaBox(x, y, Math.max(0, width), Math.max(0, height));
        }

        if ((options.extractSku || options.includeFlipkartOrderSummary) && options.originalDocProxy) {
            try {
                const pdfjsPage = await options.originalDocProxy.getPage(i + 1);
                const text = await extractTextFromPage(pdfjsPage);
                
                // Logic to extract SKU and Qty from Flipkart labels
                const skuMatch = text.match(/SKU:?\s*([A-Za-z0-9\-_]+)/i);
                const sku = skuMatch ? skuMatch[1] : null;
                
                // Flipkart quantity is often near "Qty" or "Quantity" keywords
                const qtyMatch = text.match(/Qty:?\s*(\d+)/i) || text.match(/Quantity:?\s*(\d+)/i);
                const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

                if (sku) {
                    if (options.extractSku && options.helveticaFont) {
                        page.drawText(`SKU: ${sku}`, {
                            x: x + 10,
                            y: y + 10,
                            size: 10,
                            font: options.helveticaFont,
                            color: rgb(0, 0, 0),
                        });
                    }

                    if (options.includeFlipkartOrderSummary) {
                        flipkartSummaryMap.set(sku, (flipkartSummaryMap.get(sku) ?? 0) + qty);
                    }
                }
            } catch (e) {
                console.warn("Failed to extract data for Flipkart page", i, e);
            }
        }

        targetPdf.addPage(page);
    }

    if (options.includeFlipkartOrderSummary && options.helveticaFont && copiedPages.length > 0) {
        const firstPage = copiedPages[0];
        const { width: pageWidth, height: pageHeight } = firstPage.getSize();
        const summaryEntries = [...flipkartSummaryMap.entries()]
            .map(([sku, totalQty]) => ({ sku, totalQty }))
            .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

        appendFlipkartSummaryPages(targetPdf, summaryEntries, options.helveticaFont, pageWidth, pageHeight);
    }
}
