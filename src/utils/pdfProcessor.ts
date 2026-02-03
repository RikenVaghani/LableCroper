import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface LabelVariant {
    id: string;
    label: string;
    tlx: number;
    tly: number;
    brx: number;
    bry: number;
}

export interface CropConfig {
    tlx: number;
    tly: number;
    brx: number;
    bry: number;
    label: string;
    logo: string;
    variants?: LabelVariant[];
}

export const LABEL_CONFIGS: Record<string, CropConfig> = {
    // Exact values provided by user
    FLIPKART: {
        tlx: 180,
        tly: 25,
        brx: 417,
        bry: 385,
        label: "Flipkart",
        logo: "https://www.flipkart.com/apple-touch-icon-57x57.png"
    },
    MEESHO: {
        tlx: 10,
        tly: 10,
        brx: 590,
        bry: 355, // Default to Without Invoice
        label: "Meesho",
        logo: "https://supplier.meesho.com/static/favicon.png",
        variants: [
            {
                id: "WITHOUT_INVOICE",
                label: "Without Invoice",
                tlx: 10,
                tly: 10,
                brx: 590,
                bry: 355
            },
            {
                id: "WITH_INVOICE",
                label: "With Invoice",
                tlx: 10,
                tly: 10,
                brx: 590,
                bry: 630
            }
        ]
    },
    AMAZON: {
        tlx: 30,
        tly: 30,
        brx: 320,
        bry: 465,
        label: "Amazon",
        logo: "https://www.amazon.in/favicon.ico",
        variants: [
            {
                id: "REMOVE_EVEN_PAGES",
                label: "Remove Even (Invoice) Pages",
                tlx: 0,
                tly: 0,
                brx: 0,
                bry: 0
            },
            {
                id: "STANDARD_CROP",
                label: "Standard Crop",
                tlx: 30,
                tly: 30,
                brx: 320,
                bry: 465
            }
        ]
    }
};

export async function removeEvenPages(sourcePdf: PDFDocument): Promise<PDFDocument> {
    const newPdf = await PDFDocument.create();
    const pageIndices = sourcePdf.getPageIndices();
    // Keep only odd pages (1, 3, 5, ...) -> Indices 0, 2, 4, ...
    const oddIndices = pageIndices.filter(i => i % 2 === 0);
    const copiedPages = await newPdf.copyPages(sourcePdf, oddIndices);
    copiedPages.forEach(page => newPdf.addPage(page));
    return newPdf;
}

export async function loadPDF(file: File): Promise<PDFDocument> {
    const arrayBuffer = await file.arrayBuffer();
    return await PDFDocument.load(arrayBuffer);
}

async function extractTextFromPage(pdfPage: any): Promise<string> {
    const textContent = await pdfPage.getTextContent();
    return textContent.items.map((item: any) => item.str).join(' ');
}

/**
 * Extracts pages from a source PDF and crops them to a specific label size.
 */
export async function cropLabels(
    sourcePdf: PDFDocument,
    config: CropConfig,
    extractSku: boolean = false
): Promise<PDFDocument> {
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

    let originalDocProxy: any = null;
    let helveticaFont: any = null;

    if (extractSku) {
        const pdfBytes = await sourcePdf.save();
        originalDocProxy = await pdfjsLib.getDocument(pdfBytes).promise;
        helveticaFont = await newPdf.embedFont(StandardFonts.Helvetica);
    }

    const width = config.brx - config.tlx;
    const height = config.bry - config.tly;

    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { height: pageHeight } = page.getSize();

        // Translate Top-Left origin coordinates to PDF Bottom-Left origin
        const x = config.tlx;
        const y = pageHeight - config.bry;

        page.setCropBox(x, y, width, height);
        page.setMediaBox(x, y, width, height);

        if (extractSku && originalDocProxy) {
            try {
                const pdfjsPage = await originalDocProxy.getPage(i + 1);
                const text = await extractTextFromPage(pdfjsPage);
                const skuMatch = text.match(/SKU:?\s*([A-Za-z0-9\-_]+)/i);
                const sku = skuMatch ? skuMatch[1] : null;

                if (sku) {
                    // Coordinates for drawText are absolute to the page origin.
                    // Since MediaBox is shifted to (x, y), drawing at (x+10, y+10) 
                    // will put it at (10, 10) in the cropped view.
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

    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    return mergedPdf;
}

// Placeholder for A4 sheet generation (future feature)
export async function generateA4Sheet(): Promise<void> {
    // Logic to grid 4 labels per page...
}
