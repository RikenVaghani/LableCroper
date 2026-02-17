import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
        logo: "./Meesho.jpg",
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
        logo: "./Amazon.jpg",
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
    extractSku: boolean = false,
    variantId: string | null = null,
    selectedOptions: string[] = []
): Promise<PDFDocument> {
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

    let originalDocProxy: any = null;
    let helveticaFont: any = null;

    if (extractSku || selectedOptions.length > 0) {
        const pdfBytes = await sourcePdf.save();
        originalDocProxy = await pdfjsLib.getDocument(pdfBytes).promise;
        helveticaFont = await newPdf.embedFont(StandardFonts.Helvetica);
    }



    let tlx = config.tlx;
    let tly = config.tly;
    let brx = config.brx;
    let bry = config.bry;

    // Override with variant coordinates if selected
    if (variantId && config.variants) {
        const variant = config.variants.find(v => v.id === variantId);
        if (variant) {
            tlx = variant.tlx;
            tly = variant.tly;
            brx = variant.brx;
            bry = variant.bry;
        }
    }

    const width = brx - tlx;
    const height = bry - tly;

    for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { height: pageHeight } = page.getSize();

        // Translate Top-Left origin coordinates to PDF Bottom-Left origin
        const x = tlx;
        const y = pageHeight - bry;

        if (!config.disableCrop) {
            page.setCropBox(x, y, width, height);
            page.setMediaBox(x, y, width, height);
        }

        // Apply Option Filters
        if (selectedOptions.includes('order_page')) {
            // Amazon "Order Page Only" filter: Keep only odd-numbered pages (1, 3, 5...)
            // Since i is 0-indexed, page 1 is i=0, page 2 is i=1, etc.
            if (i % 2 !== 0) {
                continue; // Skip even-indexed pages (2, 4, 6...)
            }
        }

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
