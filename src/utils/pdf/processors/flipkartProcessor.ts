import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { ProcessorOptions, CropConfig, FlipkartSummaryEntry } from '../types';
import { extractTextFromPage, wrapTextToWidth } from '../commonUtils';

type FlipkartInvoiceLineData = {
    sku: string;
    description: string;
    qty: number;
};

type FlipkartSummaryStats = {
    orderCount: number;
    totalQty: number;
    qtyValues: Set<string>;
};

function normalizeFlipkartSummaryLabel(
    sku: string,
    description: string,
    mode: ProcessorOptions['flipkartDescriptionMode']
): string {
    const normalizedSku = sku.trim();
    const normalizedDescription = description.trim();

    if (mode === 'WITH_DESCRIPTION' && normalizedDescription) {
        return normalizedDescription;
    }

    if (mode === 'WITH_DESCRIPTION') {
        return normalizedSku;
    }

    return normalizedSku;
}

function formatFlipkartQty(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function extractFlipkartInvoiceLineData(text: string): FlipkartInvoiceLineData | null {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    if (!normalizedText) return null;

    const invoiceBlockMatch = normalizedText.match(
        /SKU\s*ID\s*\|\s*Description\s*(.+?)(?=Use Transparent Packaging|Tax Invoice|Printed at|GSTIN:|$)/i
    );
    const invoiceBlock = invoiceBlockMatch?.[1]?.trim();
    if (!invoiceBlock) return null;

    const skuAndDescriptionMatch = invoiceBlock.match(
        /(?:^|\s)(?:\d+\s+)?([A-Za-z0-9][A-Za-z0-9._\-/]*)\s*\|\s*(.+?)(?=\s+(?:FMPC|QTY\b|Use Transparent Packaging|Tax Invoice|Printed at|$))/i
    );

    if (!skuAndDescriptionMatch) {
        return null;
    }

    const sku = skuAndDescriptionMatch[1].trim();
    const description = skuAndDescriptionMatch[2].trim();

    // Parse quantity from the area immediately after SKU/description block to avoid
    // accidentally reading unrelated numeric fields from other sections.
    const qtySearchText = `${invoiceBlock} ${normalizedText}`;
    const qtyHeaderIndex = qtySearchText.toUpperCase().indexOf("QTY");
    let qty = 1;
    if (qtyHeaderIndex >= 0) {
        const qtySlice = qtySearchText.slice(qtyHeaderIndex, qtyHeaderIndex + 120);
        const qtyMatch = qtySlice.match(/QTY\s*:?\s*(\d{1,3})\b/i);
        if (qtyMatch) {
            qty = parseInt(qtyMatch[1], 10);
        }
    }

    return {
        sku,
        description,
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1
    };
}

function drawFlipkartSummaryHeader(
    page: PDFPage,
    font: PDFFont,
    pageWidth: number,
    pageHeight: number,
    isContinuation: boolean,
    columnLabel: string
): number {
    const tableX = 8;
    const tableWidth = pageWidth - 16;
    const tableTopY = pageHeight - 2;
    const headlineRowHeight = 11;
    const headerRowHeight = 10;
    const ordColWidth = Math.min(48, tableWidth * 0.12);
    const qtyColWidth = Math.min(48, tableWidth * 0.12);
    const skuColWidth = Math.max(120, tableWidth - ordColWidth - qtyColWidth);
    const headlineFontSize = Math.max(4.25, pageWidth * 0.0105);
    const headerFontSize = Math.max(4.75, pageWidth * 0.0095);

    const todayText = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(new Date());
    const headlineText = isContinuation
        ? `Flipkart label summary (continued) on ${todayText}`
        : `This Flipkart label is cropped by LabelCropper on ${todayText}`;

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
        x: tableX + 2,
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

    const headerTextY = headerBottomY + Math.max(1, headerRowHeight - headerFontSize - 2);

    page.drawText("ORD", {
        x: tableX + 4,
        y: headerTextY,
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0)
    });
    page.drawText("QTY", {
        x: tableX + ordColWidth + 4,
        y: headerTextY,
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0)
    });
    page.drawText(columnLabel, {
        x: tableX + ordColWidth + qtyColWidth + 4,
        y: headerTextY,
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0)
    });

    return headerBottomY;
}

function appendFlipkartSummaryPages(
    targetPdf: PDFDocument,
    entries: FlipkartSummaryEntry[],
    font: PDFFont,
    pageWidth: number,
    pageHeight: number,
    columnLabel: string
): void {
    if (entries.length === 0) return;

    const tableX = 8;
    const tableWidth = pageWidth - 16;
    const marginBottom = 8;
    const rowFontSize = Math.max(4.75, pageWidth * 0.0095);
    const rowLineHeight = rowFontSize * 1.15;
    const rowPaddingY = 1.2;
    const ordColWidth = Math.min(48, tableWidth * 0.12);
    const qtyColWidth = Math.min(48, tableWidth * 0.12);
    const skuColWidth = Math.max(120, tableWidth - ordColWidth - qtyColWidth);
    const skuTextWidth = Math.max(24, skuColWidth - 8);
    const footerHeight = 10;
    const borderWidth = 0.8;

    let page = targetPdf.addPage([pageWidth, pageHeight]);
    let cursorY = drawFlipkartSummaryHeader(page, font, pageWidth, pageHeight, false, columnLabel);

    for (const entry of entries) {
        const skuLines = wrapTextToWidth(entry.sku, font, rowFontSize, skuTextWidth);
        const safeLines = skuLines.length > 0 ? skuLines : ['-'];
        const rowHeight = (safeLines.length * rowLineHeight) + (rowPaddingY * 2);

        if (cursorY - rowHeight < marginBottom + footerHeight) {
            page = targetPdf.addPage([pageWidth, pageHeight]);
            cursorY = drawFlipkartSummaryHeader(page, font, pageWidth, pageHeight, true, columnLabel);
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
        cursorY = drawFlipkartSummaryHeader(page, font, pageWidth, pageHeight, true, columnLabel);
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

    const totalText = `Total Order : ${formatFlipkartQty(grandTotal)}`;
    page.drawText(totalText, {
        x: tableX + 4,
        y: footerBottomY + ((footerHeight - rowFontSize) / 2),
        size: rowFontSize,
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
    const flipkartSummaryMap = new Map<string, FlipkartSummaryStats>();
    const multiQtyFlipkartSummaryMap = new Map<string, FlipkartSummaryStats>();
    const boldFont = options.helveticaFont ? await targetPdf.embedFont(StandardFonts.HelveticaBold) : null;
    const summaryMode = options.flipkartDescriptionMode || 'WITH_SKU';
    const summaryColumnLabel = summaryMode === 'WITH_DESCRIPTION' ? 'Description' : 'SKU ID';

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

    const labelsToInclude: { page: PDFPage, totalQty: number }[] = [];
    const { height: _commonPageHeight } = copiedPages.length > 0 ? copiedPages[0].getSize() : { height: 0 };

    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { height: pageHeight } = page.getSize();
        let totalOrderQty = 1;

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

        if ((options.extractSku || options.includeFlipkartOrderSummary || options.includeMultiQtySummary || options.showMultiQtyOnBottom) && options.originalDocProxy) {
            try {
                const pdfjsPage = await options.originalDocProxy.getPage(i + 1);
                const text = await extractTextFromPage(pdfjsPage);
                
                const invoiceLineData = extractFlipkartInvoiceLineData(text);
                const skuFallbackMatch = text.match(/SKU:?\s*([A-Za-z0-9\-_]+)/i);
                const fallbackQtyMatch = text.match(/Qty:?\s*(\d+)/i) || text.match(/Quantity:?\s*(\d+)/i);
                const sku = invoiceLineData?.sku ?? (skuFallbackMatch ? skuFallbackMatch[1] : null);
                const qty = invoiceLineData?.qty ?? (fallbackQtyMatch ? parseInt(fallbackQtyMatch[1], 10) : 1);
                totalOrderQty = qty;
                const summaryLabel = sku
                    ? normalizeFlipkartSummaryLabel(sku, invoiceLineData?.description ?? '', summaryMode)
                    : null;

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

                    if (options.includeFlipkartOrderSummary && summaryLabel) {
                        const existing = flipkartSummaryMap.get(summaryLabel) ?? {
                            orderCount: 0,
                            totalQty: 0,
                            qtyValues: new Set<string>()
                        };
                        existing.orderCount += 1;
                        existing.totalQty += qty;
                        existing.qtyValues.add(formatFlipkartQty(qty));
                        flipkartSummaryMap.set(summaryLabel, existing);
                    }

                    if (options.includeMultiQtySummary && qty > 1 && summaryLabel) {
                        const existing = multiQtyFlipkartSummaryMap.get(summaryLabel) ?? {
                            orderCount: 0,
                            totalQty: 0,
                            qtyValues: new Set<string>()
                        };
                        existing.orderCount += 1;
                        existing.totalQty += qty;
                        existing.qtyValues.add(formatFlipkartQty(qty));
                        multiQtyFlipkartSummaryMap.set(summaryLabel, existing);
                    }

                    if (options.showMultiQtyOnBottom && qty > 1 && options.helveticaFont) {
                        const { x: cropX, y: cropY, width: cropWidth } = page.getCropBox();
                        const text = `Qty : ${qty}`;
                        const fontSize = 16;
                        const font = boldFont || options.helveticaFont;
                        const textWidth = font.widthOfTextAtSize(text, fontSize);
                        
                        const rectWidth = textWidth + 20;
                        const rectHeight = fontSize + 10;
                        const rectX = cropX + cropWidth - rectWidth - 5;
                        const rectY = cropY + 5;

                        page.drawRectangle({
                            x: rectX,
                            y: rectY,
                            width: rectWidth,
                            height: rectHeight,
                            color: rgb(0, 0, 0)
                        });
                        
                        page.drawText(text, {
                            x: rectX + 10,
                            y: rectY + 5,
                            size: fontSize,
                            font: font,
                            color: rgb(1, 1, 1)
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to extract data for Flipkart page", i, e);
            }
        }

        // if (options.includeDateTimeOnLabel && options.helveticaFont) {
        //     const { x: cropX, y: cropY } = page.getCropBox();
        //     const dateTimeText = `- Flipkart Lable Processed At - ${processTimeStamp}`;
        //     page.drawText(dateTimeText, {
        //         x: cropX + 10,
        //         y: cropY + 10,
        //         size: 8,
        //         font: options.helveticaFont,
        //         color: rgb(0, 0, 0)
        //     });
        // }

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

    if (options.includeFlipkartOrderSummary && options.helveticaFont && copiedPages.length > 0) {
        const orderCount = copiedPages.length;
        const threshold = options.summaryThreshold ?? 0;

        if (orderCount >= threshold) {
            const firstPage = copiedPages[0];
            const { width: pageWidth, height: pageHeight } = firstPage.getSize();

            const summaryEntries = [...flipkartSummaryMap.entries()]
            .map(([sku, summary]) => ({
                sku,
                orderCount: summary.orderCount,
                qtyPerSku: summary.qtyValues.size === 1 ? [...summary.qtyValues][0] : "Mix",
                totalQty: summary.totalQty
            }))
            .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

        appendFlipkartSummaryPages(targetPdf, summaryEntries, options.helveticaFont, pageWidth, pageHeight, summaryColumnLabel);
        }
    }

    if (options.includeMultiQtySummary && options.helveticaFont && multiQtyFlipkartSummaryMap.size > 0) {
        const firstPage = copiedPages[0];
        const { width: pageWidth, height: pageHeight } = firstPage.getSize();

        const summaryEntries = [...multiQtyFlipkartSummaryMap.entries()]
            .map(([sku, summary]) => ({
                sku,
                orderCount: summary.orderCount,
                qtyPerSku: summary.qtyValues.size === 1 ? [...summary.qtyValues][0] : "Mix",
                totalQty: summary.totalQty
            }))
            .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true }));

        appendFlipkartSummaryPages(targetPdf, summaryEntries, options.helveticaFont, pageWidth, pageHeight, summaryColumnLabel);
    }
}
