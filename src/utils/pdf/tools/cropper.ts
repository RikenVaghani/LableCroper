import { PDFDocument } from 'pdf-lib';
import { loadPDF } from '../commonUtils';

export type CropMarginsPercent = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CropBoxNormalized = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(40, value));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Crops all pages of a PDF by percentage margins from each edge.
 */
export async function cropPDF(file: File, margins: CropMarginsPercent): Promise<Uint8Array> {
  const sourcePdf = await loadPDF(file);
  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

  const topPercent = clampPercent(margins.top);
  const rightPercent = clampPercent(margins.right);
  const bottomPercent = clampPercent(margins.bottom);
  const leftPercent = clampPercent(margins.left);

  copiedPages.forEach(page => {
    const { width, height } = page.getSize();

    const left = (width * leftPercent) / 100;
    const right = width - (width * rightPercent) / 100;
    const bottom = (height * bottomPercent) / 100;
    const top = height - (height * topPercent) / 100;

    const cropWidth = Math.max(1, right - left);
    const cropHeight = Math.max(1, top - bottom);

    // Set both crop and media boxes for better compatibility across PDF viewers.
    page.setCropBox(left, bottom, cropWidth, cropHeight);
    page.setMediaBox(left, bottom, cropWidth, cropHeight);
    outputPdf.addPage(page);
  });

  return await outputPdf.save({ useObjectStreams: false });
}

/**
 * Crops PDF using a normalized "keep area" rectangle from preview coordinates.
 */
export async function cropPDFByBox(
  file: File,
  box: CropBoxNormalized,
  applyToAllPages: boolean,
  currentPageNumber: number
): Promise<Uint8Array> {
  const sourcePdf = await loadPDF(file);
  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

  const keepX = clampUnit(box.x);
  const keepY = clampUnit(box.y);
  const keepWidth = Math.max(0.01, clampUnit(box.width));
  const keepHeight = Math.max(0.01, clampUnit(box.height));

  copiedPages.forEach((page, index) => {
    const shouldCrop = applyToAllPages || index === currentPageNumber - 1;
    if (!shouldCrop) {
      outputPdf.addPage(page);
      return;
    }

    const { width, height } = page.getSize();
    const left = width * keepX;
    const bottom = height * (1 - keepY - keepHeight);
    const cropWidth = width * keepWidth;
    const cropHeight = height * keepHeight;

    page.setCropBox(left, bottom, cropWidth, cropHeight);
    page.setMediaBox(left, bottom, cropWidth, cropHeight);
    outputPdf.addPage(page);
  });

  return await outputPdf.save({ useObjectStreams: false });
}
