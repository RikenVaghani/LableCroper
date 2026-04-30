import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type PageNumberPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'top-left'
  | 'top-center'
  | 'top-right';

/**
 * Adds page numbers to each page in the provided PDF file at the specified position.
 */
export async function addPageNumbersToPDF(
  file: File,
  position: PageNumberPosition = 'bottom-center'
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  
  pages.forEach((page, index) => {
    const { x, y, width, height } = page.getCropBox();
    const text = `${index + 1}`;
    const fontSize = 12;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);
    
    const margin = 20;
    let posX = x + width / 2 - textWidth / 2;
    let posY = y + margin;

    switch (position) {
      case 'bottom-left':
        posX = x + margin;
        posY = y + margin;
        break;
      case 'bottom-center':
        posX = x + width / 2 - textWidth / 2;
        posY = y + margin;
        break;
      case 'bottom-right':
        posX = x + width - margin - textWidth;
        posY = y + margin;
        break;
      case 'top-left':
        posX = x + margin;
        posY = y + height - margin - textHeight;
        break;
      case 'top-center':
        posX = x + width / 2 - textWidth / 2;
        posY = y + height - margin - textHeight;
        break;
      case 'top-right':
        posX = x + width - margin - textWidth;
        posY = y + height - margin - textHeight;
        break;
    }

    const padding = 3;
    page.drawRectangle({
      x: posX - padding,
      y: posY - padding,
      width: textWidth + padding * 2,
      height: textHeight + padding * 2,
      color: rgb(1, 1, 1),
      opacity: 0.8
    });

    page.drawText(text, {
      x: posX,
      y: posY,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
  });

  return await pdfDoc.save();
}
