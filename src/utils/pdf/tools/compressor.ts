import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { loadPDF } from '../commonUtils';

export type CompressionLevel = 'EXTREME' | 'RECOMMENDED' | 'LESS'

const COMPRESSION_PRESETS: Record<CompressionLevel, { scale: number; jpegQuality: number }> = {
    EXTREME: {
        scale: 1.0,
        jpegQuality: 0.55
    },
    RECOMMENDED: {
        scale: 1.35,
        jpegQuality: 0.75
    },
    LESS: {
        scale: 1.8,
        jpegQuality: 0.9
    }
}

/**
 * Compresses a PDF by rasterizing each page as JPEG and rebuilding the document.
 */
export async function compressPDF(
    file: File,
    level: CompressionLevel = 'RECOMMENDED'
): Promise<Uint8Array> {
    const preset = COMPRESSION_PRESETS[level];
    const sourceBuffer = await file.arrayBuffer();
    const sourcePdfJs = await pdfjsLib.getDocument({ data: sourceBuffer }).promise;
    const compressedPdf = await PDFDocument.create();
    let addedPages = 0;

    for (let i = 1; i <= sourcePdfJs.numPages; i++) {
        const page = await sourcePdfJs.getPage(i);
        const renderViewport = page.getViewport({ scale: preset.scale });
        const baseViewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) continue;

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);

        await page.render({
            canvasContext: context,
            viewport: renderViewport,
            canvas
        }).promise;

        const imageBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', preset.jpegQuality)
        );

        if (!imageBlob) continue;

        const imageBytes = await imageBlob.arrayBuffer();
        const embeddedImage = await compressedPdf.embedJpg(imageBytes);
        const outputPage = compressedPdf.addPage([baseViewport.width, baseViewport.height]);

        outputPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: baseViewport.width,
            height: baseViewport.height
        });

        addedPages += 1;
    }

    if (addedPages === 0) {
        const sourcePdf = await loadPDF(file);
        const copiedPages = await compressedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => compressedPdf.addPage(page));
    }

    return await compressedPdf.save({
        useObjectStreams: true
    });
}
