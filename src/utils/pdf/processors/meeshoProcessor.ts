import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type {
    MeeshoSummaryEntry,
    CourierSummaryEntry,
    ProcessorOptions,
    CropConfig
} from '../types';
import {
    getPositionedTextItems,
    wrapTextToWidth,
    groupTextLinesByY,
    formatProcessTimestamp
} from '../commonUtils';


function drawMeeshoSummaryHeader(
    page: PDFPage,
    font: PDFFont,
    pageWidth: number,
    pageHeight: number,
    isContinuation: boolean,
    numCols: number = 1
): number {
    const tableX = 8;
    const tableWidth = pageWidth - 16;
    const tableTopY = pageHeight - 2;
    const headlineRowHeight = 22;
    const headerRowHeight = 20;

    const colSpacing = 8;
    const colWidth = (tableWidth - (numCols - 1) * colSpacing) / numCols;

    const ordColWidth = Math.min(48, colWidth * 0.12);
    const qtyColWidth = Math.min(48, colWidth * 0.12);
    const sizeColWidth = Math.min(64, colWidth * 0.14);
    const colorColWidth = Math.min(72, colWidth * 0.16);
    const skuColWidth = Math.max(80, colWidth - ordColWidth - qtyColWidth - sizeColWidth - colorColWidth);

    let headlineFontSize = Math.max(8.5, pageWidth * 0.021);
    const headerFontSize = Math.max(9.5, pageWidth * 0.019);

    const todayText = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(new Date());
    const headlineText = isContinuation
        ? `Meesho order summary (continued) on ${todayText}`
        : `This Meesho label is cropped by LabelCropper on ${todayText}`;

    const headlineBottomY = tableTopY - headlineRowHeight;
    const headerBottomY = headlineBottomY - headerRowHeight;

    // Draw Headline Box (Full Width)
    page.drawRectangle({
        x: tableX,
        y: headlineBottomY,
        width: tableWidth,
        height: headlineRowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.8
    });

    const headlineMaxWidth = tableWidth - 8;
    while (headlineFontSize > 7.2 && font.widthOfTextAtSize(headlineText, headlineFontSize) > headlineMaxWidth) {
        headlineFontSize -= 0.4;
    }

    page.drawText(headlineText, {
        x: tableX + 4,
        y: headlineBottomY + ((headlineRowHeight - headlineFontSize) / 2),
        size: headlineFontSize,
        font,
        color: rgb(0, 0, 0)
    });

    // Draw Header Boxes for each column
    for (let c = 0; c < numCols; c++) {
        const colX = tableX + (c * (colWidth + colSpacing));

        page.drawRectangle({
            x: colX,
            y: headerBottomY,
            width: ordColWidth,
            height: headerRowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.8
        });
        page.drawRectangle({
            x: colX + ordColWidth,
            y: headerBottomY,
            width: qtyColWidth,
            height: headerRowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.8
        });
        page.drawRectangle({
            x: colX + ordColWidth + qtyColWidth,
            y: headerBottomY,
            width: sizeColWidth,
            height: headerRowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.8
        });
        page.drawRectangle({
            x: colX + ordColWidth + qtyColWidth + sizeColWidth,
            y: headerBottomY,
            width: colorColWidth,
            height: headerRowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.8
        });
        page.drawRectangle({
            x: colX + ordColWidth + qtyColWidth + sizeColWidth + colorColWidth,
            y: headerBottomY,
            width: skuColWidth,
            height: headerRowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.8
        });

        const headerTextY = headerBottomY + ((headerRowHeight - headerFontSize) / 2);

        page.drawText("ORD", {
            x: colX + 4,
            y: headerTextY,
            size: headerFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        page.drawText("QTY", {
            x: colX + ordColWidth + 4,
            y: headerTextY,
            size: headerFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        page.drawText("Size", {
            x: colX + ordColWidth + qtyColWidth + 4,
            y: headerTextY,
            size: headerFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        page.drawText("Color", {
            x: colX + ordColWidth + qtyColWidth + sizeColWidth + 4,
            y: headerTextY,
            size: headerFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        page.drawText("SKU ID", {
            x: colX + ordColWidth + qtyColWidth + sizeColWidth + colorColWidth + 4,
            y: headerTextY,
            size: headerFontSize,
            font,
            color: rgb(0, 0, 0)
        });
    }

    return headerBottomY;
}

function appendMeeshoSummaryPages(
    targetPdf: PDFDocument,
    entries: MeeshoSummaryEntry[],
    courierEntries: CourierSummaryEntry[],
    font: PDFFont,
    pageWidth: number,
    pageHeight: number
): void {
    if (entries.length === 0) return;

    const tableX = 8;
    const tableWidth = pageWidth - 16;
    const marginBottom = 8;
    const colSpacing = 8;

    const rowFontSize = Math.max(9.5, pageWidth * 0.019);
    const rowLineHeight = rowFontSize * 1.15;
    const rowPaddingY = 2.4;
    const footerHeight = 20;
    const borderWidth = 0.8;

    const availableHeight = (pageHeight - 2 - 22 - 20) - marginBottom - footerHeight;
    const colWidth1 = tableWidth;
    const ordColWidth1 = Math.min(48, colWidth1 * 0.12);
    const qtyColWidth1 = Math.min(48, colWidth1 * 0.12);
    const sizeColWidth1 = Math.min(64, colWidth1 * 0.14);
    const colorColWidth1 = Math.min(72, colWidth1 * 0.16);
    const skuColWidth1 = Math.max(80, colWidth1 - ordColWidth1 - qtyColWidth1 - sizeColWidth1 - colorColWidth1);
    const skuTextWidth1 = Math.max(24, skuColWidth1 - 8);

    let totalHeight1Col = 0;
    for (const entry of entries) {
        const skuLines = wrapTextToWidth(entry.sku, font, rowFontSize, skuTextWidth1);
        const safeLines = skuLines.length > 0 ? skuLines : ['-'];
        totalHeight1Col += (safeLines.length * rowLineHeight) + (rowPaddingY * 2);
    }

    const numCols = totalHeight1Col > availableHeight ? 2 : 1;

    const colWidth = (tableWidth - (numCols - 1) * colSpacing) / numCols;

    const ordColWidth = Math.min(48, colWidth * 0.12);
    const qtyColWidth = Math.min(48, colWidth * 0.12);
    const sizeColWidth = Math.min(64, colWidth * 0.14);
    const colorColWidth = Math.min(72, colWidth * 0.16);
    const skuColWidth = Math.max(80, colWidth - ordColWidth - qtyColWidth - sizeColWidth - colorColWidth);
    const skuTextWidth = Math.max(24, skuColWidth - 8);

    let page = targetPdf.addPage([pageWidth, pageHeight]);
    let startY = drawMeeshoSummaryHeader(page, font, pageWidth, pageHeight, false, numCols);
    let cursorY = startY;
    let currentCol = 0;

    for (const entry of entries) {
        const skuLines = wrapTextToWidth(entry.sku, font, rowFontSize, skuTextWidth);
        const safeLines = skuLines.length > 0 ? skuLines : ['-'];
        const rowHeight = (safeLines.length * rowLineHeight) + (rowPaddingY * 2);

        if (cursorY - rowHeight < marginBottom + footerHeight) {
            if (currentCol < numCols - 1) {
                currentCol++;
                cursorY = startY;
            } else {
                page = targetPdf.addPage([pageWidth, pageHeight]);
                startY = drawMeeshoSummaryHeader(page, font, pageWidth, pageHeight, true, numCols);
                cursorY = startY;
                currentCol = 0;
            }
        }

        const colX = tableX + (currentCol * (colWidth + colSpacing));
        const rowBottomY = cursorY - rowHeight;

        // Draw Row Boxes
        page.drawRectangle({
            x: colX,
            y: rowBottomY,
            width: ordColWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth
        });
        page.drawRectangle({
            x: colX + ordColWidth,
            y: rowBottomY,
            width: qtyColWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth
        });
        page.drawRectangle({
            x: colX + ordColWidth + qtyColWidth,
            y: rowBottomY,
            width: sizeColWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth
        });
        page.drawRectangle({
            x: colX + ordColWidth + qtyColWidth + sizeColWidth,
            y: rowBottomY,
            width: colorColWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth
        });
        page.drawRectangle({
            x: colX + ordColWidth + qtyColWidth + sizeColWidth + colorColWidth,
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
            x: colX + Math.max(4, (ordColWidth - ordTextWidth) / 2),
            y: ordTextY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        page.drawText(qtyText, {
            x: colX + ordColWidth + Math.max(4, (qtyColWidth - qtyTextWidth) / 2),
            y: qtyTextY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        const sizeLines = wrapTextToWidth(entry.size || '-', font, rowFontSize, Math.max(24, sizeColWidth - 8));
        const colorLines = wrapTextToWidth(entry.color || '-', font, rowFontSize, Math.max(24, colorColWidth - 8));

        page.drawText(sizeLines[0] || '-', {
            x: colX + ordColWidth + qtyColWidth + 4,
            y: qtyTextY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });
        page.drawText(colorLines[0] || '-', {
            x: colX + ordColWidth + qtyColWidth + sizeColWidth + 4,
            y: qtyTextY,
            size: rowFontSize,
            font,
            color: rgb(0, 0, 0)
        });

        const skuStartY = rowBottomY + rowHeight - rowPaddingY - rowFontSize;
        safeLines.forEach((line, index) => {
            page.drawText(line, {
                x: colX + ordColWidth + qtyColWidth + sizeColWidth + colorColWidth + 4,
                y: skuStartY - (index * rowLineHeight),
                size: rowFontSize,
                font,
                color: rgb(0, 0, 0)
            });
        });

        cursorY = rowBottomY;
    }

    const totalOrders = entries.reduce((sum, entry) => sum + entry.orderCount, 0);
    if (cursorY - footerHeight < marginBottom) {
        if (currentCol < numCols - 1) {
            currentCol++;
            cursorY = startY;
        } else {
            page = targetPdf.addPage([pageWidth, pageHeight]);
            cursorY = drawMeeshoSummaryHeader(page, font, pageWidth, pageHeight, true, numCols);
            currentCol = 0;
        }
    }

    const finalFooterX = tableX + (currentCol * (colWidth + colSpacing));
    const footerBottomY = cursorY - footerHeight;

    page.drawRectangle({
        x: finalFooterX,
        y: footerBottomY,
        width: colWidth,
        height: footerHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth
    });

    page.drawText(`Total Ord Qty : ${totalOrders}`, {
        x: finalFooterX + 4,
        y: footerBottomY + ((footerHeight - rowFontSize) / 2),
        size: rowFontSize,
        font,
        color: rgb(0, 0, 0)
    });

    if (courierEntries.length === 0) return;

    const courierHeadlineHeight = 22;
    const courierHeaderHeight = 20;
    const courierRowHeight = 20;
    const courierFooterHeight = 20;
    const courierColSpacing = 8;
    const courierAvailableHeight = (pageHeight - 2 - courierHeadlineHeight - courierHeaderHeight) - marginBottom - courierFooterHeight;
    const courierNumCols = (courierEntries.length * courierRowHeight) > courierAvailableHeight ? 2 : 1;
    const courierColWidth = (tableWidth - (courierNumCols - 1) * courierColSpacing) / courierNumCols;
    const packageColWidth = Math.min(120, courierColWidth * 0.3);
    const partnerColWidth = courierColWidth - packageColWidth;

    page = targetPdf.addPage([pageWidth, pageHeight]);
    const headerTopY = pageHeight - 2;
    const headlineBottomY = headerTopY - courierHeadlineHeight;
    const headerBottomY = headlineBottomY - courierHeaderHeight;
    const totalCourierPackages = courierEntries.reduce((sum, item) => sum + item.packageCount, 0);

    page.drawRectangle({ x: tableX, y: headlineBottomY, width: tableWidth, height: courierHeadlineHeight, borderColor: rgb(0, 0, 0), borderWidth });
    page.drawText(`Courier wise total package: ${totalCourierPackages}`, { x: tableX + 4, y: headlineBottomY + ((courierHeadlineHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });

    for (let c = 0; c < courierNumCols; c++) {
        const colX = tableX + (c * (courierColWidth + courierColSpacing));
        page.drawRectangle({ x: colX, y: headerBottomY, width: packageColWidth, height: courierHeaderHeight, borderColor: rgb(0, 0, 0), borderWidth });
        page.drawRectangle({ x: colX + packageColWidth, y: headerBottomY, width: partnerColWidth, height: courierHeaderHeight, borderColor: rgb(0, 0, 0), borderWidth });
        page.drawText('Package', { x: colX + 4, y: headerBottomY + ((courierHeaderHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });
        page.drawText('Courier Partner', { x: colX + packageColWidth + 4, y: headerBottomY + ((courierHeaderHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });
    }

    let courierCursorY = headerBottomY;
    let courierCol = 0;
    for (const item of courierEntries) {
        if (courierCursorY - courierRowHeight < marginBottom + courierFooterHeight) {
            if (courierCol < courierNumCols - 1) {
                courierCol++;
                courierCursorY = headerBottomY;
            } else {
                page = targetPdf.addPage([pageWidth, pageHeight]);
                page.drawRectangle({ x: tableX, y: headlineBottomY, width: tableWidth, height: courierHeadlineHeight, borderColor: rgb(0, 0, 0), borderWidth });
                page.drawText(`Courier wise total package: ${totalCourierPackages}`, { x: tableX + 4, y: headlineBottomY + ((courierHeadlineHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });
                for (let c = 0; c < courierNumCols; c++) {
                    const colX = tableX + (c * (courierColWidth + courierColSpacing));
                    page.drawRectangle({ x: colX, y: headerBottomY, width: packageColWidth, height: courierHeaderHeight, borderColor: rgb(0, 0, 0), borderWidth });
                    page.drawRectangle({ x: colX + packageColWidth, y: headerBottomY, width: partnerColWidth, height: courierHeaderHeight, borderColor: rgb(0, 0, 0), borderWidth });
                    page.drawText('Package', { x: colX + 4, y: headerBottomY + ((courierHeaderHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });
                    page.drawText('Courier Partner', { x: colX + packageColWidth + 4, y: headerBottomY + ((courierHeaderHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });
                }
                courierCursorY = headerBottomY;
                courierCol = 0;
            }
        }
        const colX = tableX + (courierCol * (courierColWidth + courierColSpacing));
        const rowBottomY = courierCursorY - courierRowHeight;
        page.drawRectangle({ x: colX, y: rowBottomY, width: packageColWidth, height: courierRowHeight, borderColor: rgb(0, 0, 0), borderWidth });
        page.drawRectangle({ x: colX + packageColWidth, y: rowBottomY, width: partnerColWidth, height: courierRowHeight, borderColor: rgb(0, 0, 0), borderWidth });
        page.drawText(String(item.packageCount), { x: colX + 4, y: rowBottomY + ((courierRowHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });
        page.drawText(item.courierPartner, { x: colX + packageColWidth + 4, y: rowBottomY + ((courierRowHeight - rowFontSize) / 2), size: rowFontSize, font, color: rgb(0, 0, 0) });
        courierCursorY = rowBottomY;
    }
}

export async function processMeesho(
    sourcePdf: PDFDocument,
    targetPdf: PDFDocument,
    config: CropConfig,
    options: ProcessorOptions
): Promise<void> {
    const copiedPages = await targetPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    const meeshoSummaryMap = new Map<string, { orderCount: number; totalQty: number; qty: number; sku: string; size: string; color: string }>();
    const courierSummaryMap = new Map<string, number>();
    const processTimeStamp = formatProcessTimestamp(new Date());

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

    const labelsToInclude: { page: PDFPage, totalQty: number, deliveryPartnerRank: number }[] = [];
    const deliveryPartnerPriority: RegExp[] = [
        /\bvalmo express\b/i,
        /\bvalmo\b/i,
        /\bdelhivery\b/i,
        /\bxpressbees\b/i,
        /\bshadowfax\b/i
    ];

    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { height: pageHeight } = page.getSize();
        let totalOrderQty = 1;
        let deliveryPartnerRank = Number.MAX_SAFE_INTEGER;
        let courierPartner = '';

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

        const shouldReadMeeshoTextLayer =
            !!options.originalDocProxy &&
            (
                !!options.helveticaFont ||
                !!options.extractSku ||
                !!options.includeMeeshoOrderSummary ||
                !!options.includeDateTimeOnLabel ||
                !!options.includeMultiQtySummary ||
                !!options.orderMeeshoByDeliveryPartner
            );

        if (shouldReadMeeshoTextLayer) {
            try {
                const docProxy = options.originalDocProxy;
                if (!docProxy) {
                    throw new Error("Missing PDF text layer proxy for Meesho processing.");
                }
                const pdfjsPage = await docProxy.getPage(i + 1);
                const textContent = await pdfjsPage.getTextContent();
                const positioned = getPositionedTextItems(textContent.items);
                const pageText = positioned.map(item => item.text).join(' ');
                const foundPartnerIndex = deliveryPartnerPriority.findIndex((pattern) => pattern.test(pageText));
                if (foundPartnerIndex >= 0) {
                    deliveryPartnerRank = foundPartnerIndex;
                }
                const courierMatch = pageText.match(/\b(Xpress\s*Bees|Xpressbees|ValmoPlus|Valmo Express|Valmo|Delhivery|Shadowfax)\b/i);
                if (courierMatch?.[1]) {
                    const raw = courierMatch[1].trim().toLowerCase().replace(/\s+/g, '');
                    if (raw === 'xpressbees') courierPartner = 'Xpress Bees';
                    else if (raw === 'valmoplus') courierPartner = 'ValmoPlus';
                    else if (raw === 'valmoexpress') courierPartner = 'Valmo Express';
                    else if (raw === 'valmo') courierPartner = 'Valmo';
                    else if (raw === 'delhivery') courierPartner = 'Delhivery';
                    else if (raw === 'shadowfax') courierPartner = 'Shadowfax';
                }
                if (options.treatValmoPlusAsValmo && /valmoplus/i.test(courierPartner)) {
                    courierPartner = 'Valmo';
                }
                const productDetailsHeader = positioned.find(p => p.upper.includes('PRODUCT DETAILS'));

                if (options.includeDateTimeOnLabel && productDetailsHeader && options.helveticaFont) {
                    const processText = `:- Lable Processed At - ${processTimeStamp}`;
                    const fontSize = 7;
                    const maxX = page.getWidth() - 10;
                    const rawX = productDetailsHeader.x + 90;
                    const textWidth = options.helveticaFont.widthOfTextAtSize(processText, fontSize);
                    const drawX = Math.max(10, Math.min(rawX, maxX - textWidth));

                    page.drawText(processText, {
                        x: drawX,
                        y: productDetailsHeader.y,
                        size: fontSize,
                        font: options.helveticaFont,
                        color: rgb(0, 0, 0)
                    });
                }

                const skuHeader = positioned.find(p => p.upper === 'SKU');
                const sizeHeader = positioned.find(p => p.upper === 'SIZE');
                const colorHeader = positioned.find(p => p.upper === 'COLOR');
                const qtyHeader = positioned.find(p => p.upper === 'QTY');

                if (skuHeader && sizeHeader && qtyHeader) {
                    const skuMinX = skuHeader.x - 5;
                    const skuMaxX = sizeHeader.x - 5;
                    const sizeMinX = sizeHeader.x - 5;
                    const sizeMaxX = colorHeader ? colorHeader.x - 5 : qtyHeader.x - 5;
                    const colorMinX = colorHeader ? colorHeader.x - 5 : Number.MAX_SAFE_INTEGER;
                    const colorMaxX = colorHeader ? qtyHeader.x - 5 : Number.MAX_SAFE_INTEGER;
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
                        const sizeText = dataLine.words.filter(w => w.x >= sizeMinX && w.x <= sizeMaxX).map(w => w.text).join(' ').trim() || '-';
                        let colorText = '-';
                        if (colorHeader) {
                            colorText = dataLine.words
                                .filter(w => w.x >= colorMinX && w.x <= colorMaxX)
                                .map(w => w.text)
                                .join(' ')
                                .trim() || '-';
                        } else {
                            const qtyIdx = dataLine.words.findIndex(w => w.x >= qtyMinX && w.x <= qtyMaxX);
                            if (qtyIdx > 0) {
                                const prevWord = dataLine.words[qtyIdx - 1]?.text?.trim();
                                if (prevWord) colorText = prevWord;
                            }
                        }

                        const forbidden = ['SKU', 'SIZE', 'QTY', 'COLOR', 'ORDER NO.', 'FREE SIZE', 'NA'];
                        if (skuText && !forbidden.includes(skuText.toUpperCase())) {
                            totalOrderQty = qty;
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
                                const key = `${skuText}::${qty}::${sizeText}::${colorText}`;
                                const existing = meeshoSummaryMap.get(key) ?? { orderCount: 0, totalQty: 0, qty: qty, sku: skuText, size: sizeText, color: colorText };
                                existing.orderCount += 1;
                                existing.totalQty += qty;
                                meeshoSummaryMap.set(key, existing);
                            }


                        }
                    }
                }
            } catch (e) {
                console.warn("Failed to extract Meesho data for page", i, e);
            }
        }
        if (courierPartner) {
            courierSummaryMap.set(courierPartner, (courierSummaryMap.get(courierPartner) ?? 0) + 1);
        }

        labelsToInclude.push({ page, totalQty: totalOrderQty, deliveryPartnerRank });
    }

    if (options.orderMeeshoByDeliveryPartner || options.includeMultiQtySummary) {
        labelsToInclude.sort((a, b) => {
            if (options.includeMultiQtySummary && a.totalQty !== b.totalQty) {
                return a.totalQty - b.totalQty;
            }
            if (options.orderMeeshoByDeliveryPartner && a.deliveryPartnerRank !== b.deliveryPartnerRank) {
                return a.deliveryPartnerRank - b.deliveryPartnerRank;
            }
            return 0;
        });
    }

    // Add all processed label pages to the target PDF
    for (const item of labelsToInclude) {
        targetPdf.addPage(item.page);
    }

    if (options.includeMeeshoOrderSummary && options.helveticaFont && copiedPages.length > 0) {
        const orderCount = copiedPages.length;
        const threshold = options.summaryThreshold ?? 0;

        if (orderCount >= threshold) {
            const firstPage = copiedPages[0];
            const { width: pageWidth, height: pageHeight } = firstPage.getSize();

            const summaryEntries = [...meeshoSummaryMap.values()]
                .map((summary) => ({
                    sku: summary.sku,
                    size: summary.size,
                    color: summary.color,
                    orderCount: summary.orderCount,
                    qtyPerSku: String(summary.qty),
                    totalQty: summary.totalQty
                }))
                .sort((a, b) => {
                    const skuCompare = a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base', numeric: true });
                    if (skuCompare !== 0) return skuCompare;
                    const qtyCompare = Number(a.qtyPerSku) - Number(b.qtyPerSku);
                    if (qtyCompare !== 0) return qtyCompare;
                    const sizeCompare = a.size.localeCompare(b.size, undefined, { sensitivity: 'base', numeric: true });
                    if (sizeCompare !== 0) return sizeCompare;
                    return a.color.localeCompare(b.color, undefined, { sensitivity: 'base', numeric: true });
                });
            const courierEntries = [...courierSummaryMap.entries()]
                .map(([courierPartner, packageCount]) => ({ courierPartner, packageCount }))
                .sort((a, b) => b.packageCount - a.packageCount || a.courierPartner.localeCompare(b.courierPartner));

            appendMeeshoSummaryPages(targetPdf, summaryEntries, courierEntries, options.helveticaFont, pageWidth, pageHeight);
        }
    }
}
