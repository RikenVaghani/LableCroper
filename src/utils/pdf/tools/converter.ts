import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

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
        const viewport = page.getViewport({ scale: 2.0 });

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

async function convertImageFileToPngBytes(file: File): Promise<ArrayBuffer> {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        imageBitmap.close();
        throw new Error('Canvas context unavailable while converting image.');
    }

    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    context.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) {
        throw new Error('Failed to normalize image to PNG.');
    }

    return await pngBlob.arrayBuffer();
}

/**
 * Converts multiple images into a single PDF, keeping selection order.
 */
export async function convertImagesToPDF(files: File[]): Promise<Uint8Array> {
    const outputPdf = await PDFDocument.create();

    for (const file of files) {
        const fileType = file.type.toLowerCase();
        const imageBuffer = await file.arrayBuffer();

        const embeddedImage =
            fileType === 'image/png'
                ? await outputPdf.embedPng(imageBuffer)
                : fileType === 'image/jpeg' || fileType === 'image/jpg'
                    ? await outputPdf.embedJpg(imageBuffer)
                    : await outputPdf.embedPng(await convertImageFileToPngBytes(file));

        const page = outputPdf.addPage([embeddedImage.width, embeddedImage.height]);
        page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height
        });
    }

    return await outputPdf.save({ useObjectStreams: false });
}
