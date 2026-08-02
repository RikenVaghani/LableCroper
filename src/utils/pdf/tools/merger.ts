import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

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

        const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
        return await PDFDocument.load(mergedBytes, { ignoreEncryption: true });
    } catch (error) {
        console.warn('Standard merge failed, using compatibility fallback merge.', error);
        return await mergePDFsWithImageFallback(files);
    }
}

/**
 * Merges in-memory PDF documents into a single PDF.
 */
export async function mergePDFDocuments(documents: PDFDocument[]): Promise<PDFDocument> {
    const mergedPdf = await PDFDocument.create();

    for (const document of documents) {
        const copiedPages = await mergedPdf.copyPages(document, document.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
    return await PDFDocument.load(mergedBytes, { ignoreEncryption: true });
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
