import { runAIVisionOCR, AIVisionOCRResult, AIInvoiceResult, VisionModelId } from './aiVisionOCR';
import { runOCR, OCRResult, ParsedInvoiceData, parseInvoiceText, PreprocessingOptions } from './ocrEngine';

export type SupportedDocumentMimeType = 'image' | 'pdf' | 'unsupported';

export interface DocumentPageImage {
  pageNumber: number;
  file: File;
  previewUrl: string;
}

export interface PageExtraction<T> {
  pageNumber: number;
  result: T;
  score: number;
}

export interface TesseractDocumentOCRResult {
  method: 'tesseract';
  pages: PageExtraction<OCRResult>[];
  bestPageNumber: number;
  aggregated: OCRResult;
}

export interface AIVisionDocumentOCRResult {
  method: 'ai-vision';
  pages: PageExtraction<AIVisionOCRResult>[];
  bestPageNumber: number;
  aggregated: AIVisionOCRResult;
}

const PDF_RENDER_SCALE = 2;
const PDFJS_CDN_VERSION = '4.10.38';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'];

export function detectDocumentMimeType(file: File): SupportedDocumentMimeType {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'image';
  return 'unsupported';
}

export function unsupportedDocumentMessage(file: File): string {
  const type = file.type || 'type MIME inconnu';
  return `Format non supporté (${type}). Importez une image (JPG, PNG, WebP, BMP, TIFF) ou un PDF.`;
}

export async function prepareDocumentPages(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<DocumentPageImage[]> {
  const documentType = detectDocumentMimeType(file);

  if (documentType === 'unsupported') {
    throw new Error(unsupportedDocumentMessage(file));
  }

  if (documentType === 'image') {
    return [{ pageNumber: 1, file, previewUrl: URL.createObjectURL(file) }];
  }

  return convertPdfToImages(file, onProgress);
}

async function convertPdfToImages(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<DocumentPageImage[]> {
  if (onProgress) onProgress(2, 'Chargement du PDF...');

  try {
    const pdfjs = await import(/* @vite-ignore */ `https://esm.sh/pdfjs-dist@${PDFJS_CDN_VERSION}/build/pdf.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${PDFJS_CDN_VERSION}/build/pdf.worker.mjs`;

    const pdfData = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
    const pages: DocumentPageImage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (onProgress) {
        onProgress(Math.round((pageNumber / pdf.numPages) * 15), `Conversion PDF : page ${pageNumber}/${pdf.numPages}...`);
      }

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Impossible de préparer le rendu canvas du PDF.');

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await canvasToBlob(canvas, 'image/png');
      const pageFile = new File([blob], `${file.name.replace(/\.pdf$/i, '')}-page-${pageNumber}.png`, { type: 'image/png' });
      pages.push({ pageNumber, file: pageFile, previewUrl: URL.createObjectURL(blob) });
    }

    if (pages.length === 0) throw new Error('Le PDF ne contient aucune page exploitable.');
    return pages;
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error('Impossible de convertir ce PDF en images avant OCR. Vérifiez que le fichier PDF est valide et réessayez.');
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Impossible de générer une image depuis la page PDF.'));
    }, type);
  });
}

export async function runDocumentOCR(
  pages: DocumentPageImage[],
  onProgress?: (progress: number, status: string) => void,
  preprocessOptions?: PreprocessingOptions
): Promise<TesseractDocumentOCRResult> {
  const extractedPages: PageExtraction<OCRResult>[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const start = Math.round((index / pages.length) * 100);
    const span = Math.max(1, Math.round(100 / pages.length));

    const result = await runOCR(page.file, (progress, status) => {
      onProgress?.(Math.min(99, start + Math.round((progress / 100) * span)), `Page ${page.pageNumber}/${pages.length} · ${status}`);
    }, preprocessOptions);

    extractedPages.push({ pageNumber: page.pageNumber, result, score: scoreParsedInvoice(result.parsedInvoice, result.confidence) });
  }

  const aggregated = aggregateTesseractResults(extractedPages);
  onProgress?.(100, 'OCR multipage terminé !');

  return {
    method: 'tesseract',
    pages: extractedPages,
    bestPageNumber: pickBestPage(extractedPages)?.pageNumber || 1,
    aggregated,
  };
}

export async function runDocumentAIVisionOCR(
  pages: DocumentPageImage[],
  onProgress?: (progress: number, status: string) => void,
  modelId?: VisionModelId
): Promise<AIVisionDocumentOCRResult> {
  const extractedPages: PageExtraction<AIVisionOCRResult>[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const start = Math.round((index / pages.length) * 100);
    const span = Math.max(1, Math.round(100 / pages.length));

    const result = await runAIVisionOCR(page.file, (progress, status) => {
      onProgress?.(Math.min(99, start + Math.round((progress / 100) * span)), `Page ${page.pageNumber}/${pages.length} · ${status}`);
    }, modelId);

    extractedPages.push({ pageNumber: page.pageNumber, result, score: scoreParsedInvoice(result.parsedInvoice) });
  }

  const aggregated = aggregateAIVisionResults(extractedPages, modelId);
  onProgress?.(100, 'Analyse IA multipage terminée !');

  return {
    method: 'ai-vision',
    pages: extractedPages,
    bestPageNumber: pickBestPage(extractedPages)?.pageNumber || 1,
    aggregated,
  };
}

function aggregateTesseractResults(pages: PageExtraction<OCRResult>[]): OCRResult {
  const best = pickBestPage(pages);
  const mergedText = pages.map((page) => `--- Page ${page.pageNumber} ---\n${page.result.rawText}`).join('\n\n');
  const parsedInvoice = mergeParsedInvoices(pages.map((page) => page.result.parsedInvoice), best?.result.parsedInvoice);
  const reparsedFromMergedText = parseInvoiceText(mergedText);
  const finalParsedInvoice = mergeParsedInvoices([parsedInvoice, reparsedFromMergedText], parsedInvoice);
  const confidence = pages.length
    ? pages.reduce((sum, page) => sum + page.result.confidence, 0) / pages.length
    : 0;

  return {
    rawText: mergedText,
    confidence,
    parsedInvoice: finalParsedInvoice,
    preprocessedPreview: best?.result.preprocessedPreview,
  };
}

function aggregateAIVisionResults(
  pages: PageExtraction<AIVisionOCRResult>[],
  modelId?: VisionModelId
): AIVisionOCRResult {
  const best = pickBestPage(pages);
  const parsedInvoice = mergeParsedInvoices(pages.map((page) => page.result.parsedInvoice), best?.result.parsedInvoice) as AIInvoiceResult;

  return {
    parsedInvoice: {
      ...parsedInvoice,
      tvaRate: parsedInvoice.tvaRate || 0,
      referenceNumber: parsedInvoice.referenceNumber || '',
    },
    method: 'ai-vision',
    model: modelId || best?.result.model || 'openai-gpt-4o',
  };
}

function pickBestPage<T>(pages: PageExtraction<T>[]): PageExtraction<T> | undefined {
  return [...pages].sort((a, b) => b.score - a.score)[0];
}

function mergeParsedInvoices<T extends Partial<ParsedInvoiceData>>(
  invoices: T[],
  preferred?: T
): ParsedInvoiceData & Partial<T> {
  const merged: Partial<ParsedInvoiceData & T> = { ...(preferred || {}) };
  const textFields: Array<keyof ParsedInvoiceData> = ['supplier', 'invoiceNumber', 'date', 'dueDate', 'currency', 'iban', 'paymentTerms', 'category'];
  const amountFields: Array<keyof ParsedInvoiceData> = ['amountHT', 'tva', 'amountTTC'];

  for (const invoice of invoices) {
    for (const field of textFields) {
      const current = merged[field];
      const candidate = invoice[field];
      if ((!current || current === 'Autres charges') && candidate) {
        (merged as any)[field] = candidate;
      }
    }

    for (const field of amountFields) {
      const current = Number(merged[field] || 0);
      const candidate = Number(invoice[field] || 0);
      if (!current && candidate) {
        (merged as any)[field] = candidate;
      }
    }
  }

  if (!merged.amountTTC && merged.amountHT && merged.tva) {
    merged.amountTTC = Number(merged.amountHT) + Number(merged.tva);
  }
  if (!merged.tva && merged.amountTTC && merged.amountHT) {
    merged.tva = Number(merged.amountTTC) - Number(merged.amountHT);
  }

  return {
    supplier: merged.supplier || '',
    invoiceNumber: merged.invoiceNumber || '',
    date: merged.date || '',
    dueDate: merged.dueDate || '',
    amountHT: Number(merged.amountHT || 0),
    tva: Number(merged.tva || 0),
    amountTTC: Number(merged.amountTTC || 0),
    currency: merged.currency || 'CHF',
    iban: merged.iban || '',
    paymentTerms: merged.paymentTerms || '',
    category: merged.category || 'Autres charges',
    ...(merged as Partial<T>),
  };
}

function scoreParsedInvoice(invoice: Partial<ParsedInvoiceData>, confidence = 80): number {
  let score = confidence;
  if (invoice.supplier) score += 20;
  if (invoice.invoiceNumber) score += 15;
  if (invoice.date) score += 10;
  if (invoice.dueDate) score += 5;
  if (invoice.amountHT) score += 15;
  if (invoice.tva) score += 10;
  if (invoice.amountTTC) score += 25;
  if (invoice.iban) score += 10;
  if (invoice.paymentTerms) score += 5;
  return score;
}
