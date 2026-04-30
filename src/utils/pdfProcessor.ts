import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 1. Core Worker Setup
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// 2. Import modularized parts
import { LABEL_CONFIGS } from './pdf/config';
import { loadPDF } from './pdf/commonUtils';
import { processAmazon } from './pdf/processors/amazonProcessor';
import { processMeesho } from './pdf/processors/meeshoProcessor';
import { processFlipkart } from './pdf/processors/flipkartProcessor';

// 3. New Tool Modules
import { mergePDFs, mergePDFDocuments } from './pdf/tools/merger';
import { splitPDF } from './pdf/tools/splitter';
import { convertPDFToImages, convertImagesToPDF } from './pdf/tools/converter';
import { compressPDF, type CompressionLevel } from './pdf/tools/compressor';
import { cropPDF, cropPDFByBox, type CropBoxNormalized, type CropMarginsPercent } from './pdf/tools/cropper';
import { addPageNumbersToPDF, type PageNumberPosition } from './pdf/tools/numbering';

// 4. Re-exports for external usage
export type * from './pdf/types';
export { 
    LABEL_CONFIGS, 
    loadPDF,
    mergePDFs, 
    mergePDFDocuments,
    splitPDF,
    convertPDFToImages,
    convertImagesToPDF,
    compressPDF,
    cropPDF,
    cropPDFByBox,
    addPageNumbersToPDF,
    type CropBoxNormalized,
    type CropMarginsPercent,
    type CompressionLevel,
    type PageNumberPosition
};

// 5. Types for orchestrator logic
import type { CropConfig, AmazonDescriptionMode, FlipkartDescriptionMode, PdfJsDocumentProxy } from './pdf/types';
export type SupportedPlatform = 'FLIPKART' | 'MEESHO' | 'AMAZON';

type PlatformMarker = {
    pattern: RegExp;
    weight: number;
};

const PLATFORM_MARKERS: Record<SupportedPlatform, PlatformMarker[]> = {
    FLIPKART: [
        { pattern: /\bflipkart\b/i, weight: 4 },
        { pattern: /\be-?kart logistics\b/i, weight: 4 },
        { pattern: /\bawb no\.?\s*fm/i, weight: 2 },
        { pattern: /\bordered through\b/i, weight: 1 },
        { pattern: /\bod\d{10,}\b/i, weight: 1 }
    ],
    MEESHO: [
        { pattern: /\bmeesho\b/i, weight: 4 },
        { pattern: /\bvalmo pickup\b/i, weight: 4 },
        { pattern: /\bprepaid:\s*do not collect cash\b/i, weight: 2 },
        { pattern: /\border no\.?\s*\d{12,}_\d+\b/i, weight: 2 },
        { pattern: /\bproduct details\b/i, weight: 1 }
    ],
    AMAZON: [
        { pattern: /\bamazon\b/i, weight: 4 },
        { pattern: /\bamazon\.in\b/i, weight: 4 },
        { pattern: /\btax invoice\/bill of supply\/cash memo\b/i, weight: 3 },
        { pattern: /\btriplicate for supplier\b/i, weight: 3 },
        { pattern: /\border number:\s*\d{3}-\d{7}-\d{7}\b/i, weight: 4 },
        { pattern: /\beasy ship\b/i, weight: 2 },
        { pattern: /\bfba\b/i, weight: 2 }
    ]
};

function scorePlatform(text: string, platform: SupportedPlatform): number {
    let score = 0;

    for (const marker of PLATFORM_MARKERS[platform]) {
        if (marker.pattern.test(text)) {
            score += marker.weight;
        }
    }

    return score;
}

export async function detectPlatformFromPdf(file: File): Promise<SupportedPlatform | null> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const maxPages = Math.min(pdf.numPages, 4);
        const textParts: string[] = [];

        for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            for (const item of textContent.items) {
                if ('str' in item && typeof item.str === 'string' && item.str) {
                    textParts.push(item.str);
                }
            }
        }

        const text = textParts.join(' ').replace(/\s+/g, ' ').trim();
        if (!text) return null;

        const scores: Record<SupportedPlatform, number> = {
            FLIPKART: scorePlatform(text, 'FLIPKART'),
            MEESHO: scorePlatform(text, 'MEESHO'),
            AMAZON: scorePlatform(text, 'AMAZON')
        };

        const ranked = (Object.entries(scores) as [SupportedPlatform, number][])
            .sort((a, b) => b[1] - a[1]);

        const [topPlatform, topScore] = ranked[0];
        const secondScore = ranked[1]?.[1] ?? 0;

        if (topScore < 2) return null;
        if (topScore === secondScore) return null;

        return topPlatform;
    } catch (error) {
        console.warn('Platform auto-detection failed:', error);
        return null;
    }
}

/**
 * Extracts pages from a source PDF and crops them to a specific label size.
 * This is the main orchestrator for market-specific label cropping.
 */
export async function cropLabels(
    sourcePdf: PDFDocument,
    config: CropConfig,
    extractSku: boolean = false,
    variantId: string | null = null,
    selectedOptions: string[] = [],
    amazonDescriptionMode: AmazonDescriptionMode = 'WITH_SKU',
    flipkartDescriptionMode: FlipkartDescriptionMode = 'WITH_SKU',
    includeAmazonOrderSummary: boolean = false,
    includeMeeshoOrderSummary: boolean = false,
    includeFlipkartOrderSummary: boolean = false,
    includePageNumbers: boolean = false,
    includeDateTimeOnLabel: boolean = false,
    summaryThreshold: number = 0,
    showMultiQtyOnBottom: boolean = false,
    includeMultiQtySummary: boolean = false
): Promise<PDFDocument> {
    const newPdf = await PDFDocument.create();
    
    let originalDocProxy: PdfJsDocumentProxy | null = null;
    let helveticaFont: PDFFont | null = null;

    const needsTextLayerProcessing =
        extractSku ||
        selectedOptions.length > 0 ||
        includeAmazonOrderSummary ||
        includeMeeshoOrderSummary ||
        includeFlipkartOrderSummary ||
        includeDateTimeOnLabel ||
        includeMultiQtySummary ||
        showMultiQtyOnBottom ||
        config.label === "Meesho" ||
        config.label === "Amazon";

    if (needsTextLayerProcessing) {
        const pdfBytes = await sourcePdf.save();
        originalDocProxy = await pdfjsLib.getDocument(pdfBytes).promise as PdfJsDocumentProxy;
        helveticaFont = await newPdf.embedFont(StandardFonts.Helvetica);
    }

    const options = {
        extractSku,
        variantId,
        selectedOptions,
        amazonDescriptionMode,
        flipkartDescriptionMode,
        includeAmazonOrderSummary,
        includeMeeshoOrderSummary,
        includeFlipkartOrderSummary,
        includeDateTimeOnLabel,
        summaryThreshold,
        showMultiQtyOnBottom,
        includeMultiQtySummary,
        helveticaFont,
        originalDocProxy
    };

    if (config.label === "Amazon") {
        await processAmazon(sourcePdf, newPdf, config, options);
    } else if (config.label === "Meesho") {
        await processMeesho(sourcePdf, newPdf, config, options);
    } else {
        await processFlipkart(sourcePdf, newPdf, config, options);
    }

    if (includePageNumbers) {
        const pages = newPdf.getPages();
        const font = await newPdf.embedFont(StandardFonts.Helvetica);
        pages.forEach((page, index) => {
            const { x, y, height } = page.getCropBox();
            const text = `${index + 1}`;
            const fontSize = config.label === "Flipkart" ? 5 : 10;
            const textHeight = font.heightAtSize(fontSize);
            
            // Draw text directly with 3px margin from top-left
            page.drawText(text, {
                x: x + 0.5,
                y: y + height - textHeight - 5,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
        });
    }

    return newPdf;
}
