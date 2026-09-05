import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
GlobalWorkerOptions.workerSrc = path.join(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

const FRET_TO_KEY = {
  1: 'F', 2: 'F#/Gb', 3: 'G', 4: 'Ab/G#', 5: 'A', 6: 'Bb/A#',
  7: 'B', 8: 'C', 9: 'Db/C#', 10: 'D', 11: 'Eb/D#', 12: 'E',
  13: 'F', 14: 'F#/Gb', 15: 'G'
};

async function analyzeBook(path, name) {
  console.log(`\n=== ${name} ===`);
  const doc = await getDocument({ url: path, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items;
    
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    
    // Find heading text (top 15% of page)
    const headingItems = items.filter(item => {
      const y = pageHeight - item.transform[5];
      return y < pageHeight * 0.15 && item.str.trim().length > 2;
    });
    const heading = headingItems.map(i => i.str.trim()).filter(Boolean).join(' ');
    
    const numericItems = items.filter(item => /^\d{1,2}$/.test(item.str.trim()));
    
    const tItems = items.filter(item => {
      const x = item.transform[4];
      const str = item.str.trim();
      return x < viewport.width * 0.12 && /^[tT]$/.test(str);
    });
    
    if (tItems.length === 0) {
      if (pageNum <= 3) {
        console.log(`  Page ${pageNum}: [intro]`);
      }
      continue;
    }
    
    const systemYs = tItems.map(t => pageHeight - t.transform[5]).sort((a,b) => a-b);
    const systemHeight = viewport.height * 0.22;
    
    const keysOnPage = [];
    systemYs.forEach((systemTop, idx) => {
      const systemBottom = systemTop + systemHeight;
      
      const systemNums = numericItems.filter(item => {
        const iy = pageHeight - item.transform[5];
        const ix = item.transform[4];
        return iy >= systemTop - 5 && iy <= systemBottom + 5 && ix < viewport.width * 0.25;
      });
      
      if (systemNums.length === 0) return;
      const maxY = Math.max(...systemNums.map(item => pageHeight - item.transform[5]));
      const lowEItems = systemNums.filter(item => Math.abs((pageHeight - item.transform[5]) - maxY) < 8);
      
      if (lowEItems.length > 0) {
        lowEItems.sort((a, b) => a.transform[4] - b.transform[4]);
        const firstFret = parseInt(lowEItems[0].str.trim());
        const key = FRET_TO_KEY[firstFret] || `fret${firstFret}`;
        keysOnPage.push(key);
      }
    });
    
    console.log(`  Page ${pageNum}: [${heading.slice(0, 40)}] keys: ${keysOnPage.join(', ')}`);
  }
}

const base = 'file:///Users/jonperry/Documents/Coding/DayFret/public/pdfs/';
await analyzeBook(base + 'morning-coffee-complete.pdf', 'Morning Coffee');
await analyzeBook(base + 'cream-sugar-complete.pdf', 'Cream & Sugar');
