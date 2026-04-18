import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
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
    type CompressionLevel
};

// 5. Types for orchestrator logic
import type { CropConfig, AmazonDescriptionMode, PdfJsDocumentProxy } from './pdf/types';

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
    includeAmazonOrderSummary: boolean = false,
    includeMeeshoOrderSummary: boolean = false,
    includeFlipkartOrderSummary: boolean = false
): Promise<PDFDocument> {
    const newPdf = await PDFDocument.create();
    
    let originalDocProxy: PdfJsDocumentProxy | null = null;
    let helveticaFont: PDFFont | null = null;

    if (extractSku || selectedOptions.length > 0 || config.label === "Meesho" || config.label === "Amazon") {
        const pdfBytes = await sourcePdf.save();
        originalDocProxy = await pdfjsLib.getDocument(pdfBytes).promise as PdfJsDocumentProxy;
        helveticaFont = await newPdf.embedFont(StandardFonts.Helvetica);
    }

    const options = {
        extractSku,
        variantId,
        selectedOptions,
        amazonDescriptionMode,
        includeAmazonOrderSummary,
        includeMeeshoOrderSummary,
        includeFlipkartOrderSummary,
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

    return newPdf;
}
