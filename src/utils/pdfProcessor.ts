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

async function extractAmazonDescriptionFromInvoicePage(pdfPage: PdfJsPageProxy): Promise<string> {
    const textContent = await pdfPage.getTextContent();
    const positioned = getPositionedTextItems(textContent.items);
    if (positioned.length === 0) return "";

    const descriptionHeader = positioned
        .filter(item => item.upper.includes(AMAZON_DESCRIPTION_HEADER))
        .sort((a, b) => b.y - a.y)[0];

    if (!descriptionHeader) return "";

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

    const candidates = positioned.filter(item =>
        item.x >= descriptionHeader.x - 2 &&
        item.x < rightBoundary &&
        item.y < descriptionHeader.y - 0.5 &&
        item.y > totalY + 0.5 &&
        !item.upper.includes(AMAZON_DESCRIPTION_HEADER)
    );

    if (candidates.length === 0) return "";

    const sorted = [...candidates].sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 2.5) return yDiff;
        return a.x - b.x;
    });

    const lineTolerance = 2.5;
    const lines: { y: number; words: PositionedTextItem[] }[] = [];

    for (const item of sorted) {
        const existingLine = lines.find(line => Math.abs(line.y - item.y) <= lineTolerance);
        if (existingLine) {
            existingLine.words.push(item);
        } else {
            lines.push({ y: item.y, words: [item] });
        }
    }

    lines.sort((a, b) => b.y - a.y);

    const lineTexts = lines
        .map(line =>
            normalizeWhitespace(
                line.words
                    .sort((a, b) => a.x - b.x)
                    .map(word => word.text)
                    .join(' ')
            )
        )
        .filter(Boolean);

    return normalizeWhitespace(lineTexts.join(' '));
}

function wrapTextToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    if (!text.trim()) return [];

    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
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
        const lines = wrapTextToWidth("==> " + text, font, fontSize, maxTextWidth);
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

    page.drawRectangle({
        x: boxX,
        y: boxY + 15,
        width: boxWidth + 20 ,
        height: boxHeight - 10,
        color: rgb(1, 1, 1)
    });

    const { lines, fontSize } = fitDescriptionInBox(description, font, maxTextWidth, maxTextHeight);
    const lineHeight = fontSize * AMAZON_DESCRIPTION_BOX.lineHeightRatio;
    let textY = boxY + boxHeight - verticalPadding - fontSize;

    for (const line of lines) {
        if (textY < boxY + verticalPadding) break;
        page.drawText(line, {
            x: boxX + horizontalPadding,
            y: textY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0)
        });
        textY -= lineHeight;
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
    amazonDescriptionMode: AmazonDescriptionMode = 'WITH_SKU'
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
        for (let i = 0; i < copiedPages.length; i += 2) {
            const page = copiedPages[i];

            if (i + 1 < copiedPages.length && originalDocProxy && helveticaFont) {
                try {
                    const invoicePage = await originalDocProxy.getPage(i + 2);
                    const description = await extractAmazonDescriptionFromInvoicePage(invoicePage);
                    const amazonDescription = amazonDescriptionMode === 'WITH_SKU'
                        ? extractTextInsideParentheses(description)
                        : description;

                    if (amazonDescription) {
                        drawAmazonDescriptionBoxOnLabelPage(
                            page,
                            amazonDescription,
                            helveticaFont
                        );
                    }
                } catch (e) {
                    console.warn("Failed to process Amazon description pair for page", i, e);
                }
            }

            newPdf.addPage(page);
        }

        return newPdf;
    }

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

        if (extractSku && originalDocProxy && helveticaFont) {
            try {
                const pdfjsPage = await originalDocProxy.getPage(i + 1);
                const text = await extractTextFromPage(pdfjsPage);
                const skuMatch = text.match(/SKU:?\s*([A-Za-z0-9\-_]+)/i);
                const sku = skuMatch ? skuMatch[1] : null;

                if (sku) {
                    // Coordinates for drawText are absolute to the page origin.
                    // Since MediaBox is shifted to (x, y),
                    // drawing at (x+10, y+10) puts it at (10, 10) in cropped view.
                    page.drawText(`SKU: ${sku}`, {
                        x: x + 10,
                        y: y + 10,
                        size: 10,
                        font: helveticaFont,
                        color: rgb(0, 0, 0),
                    });
                }
            } catch (e) {
                console.warn("Failed to extract SKU for page", i, e);
            }
        }

        newPdf.addPage(page);
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
