import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

async function test() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Test Page', { x: 50, y: 400, size: 24, font, color: rgb(0,0,0) });
  const bytes = await pdfDoc.save();
  fs.writeFileSync('test_in.pdf', bytes);

  const arrayBuffer = fs.readFileSync('test_in.pdf');
  const pdfDoc2 = await PDFDocument.load(arrayBuffer);
  const font2 = await pdfDoc2.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc2.getPages();
  pages.forEach((p, index) => {
    const { x, y, width, height } = p.getCropBox();
    const text = `${index + 1}`;
    const fontSize = 12;
    const textWidth = font2.widthOfTextAtSize(text, fontSize);
    const textHeight = font2.heightAtSize(fontSize);
    const margin = 20;
    let posX = x + width / 2 - textWidth / 2;
    let posY = y + margin;
    p.drawText(text, { x: posX, y: posY, size: fontSize, font: font2, color: rgb(1, 0, 0) }); // use red to be visible
  });
  const bytes2 = await pdfDoc2.save();
  fs.writeFileSync('test_out.pdf', bytes2);
  console.log('done');
}
test().catch(console.error);
