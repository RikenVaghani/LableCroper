import { PDFDocument } from 'pdf-lib';
import { loadPDF } from '../commonUtils';

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
