import Tesseract from 'tesseract.js';
import { preprocessImage, PreprocessingOptions, defaultPreprocessingOptions } from './imagePreprocess';

export interface OCRResult {
  rawText: string;
  confidence: number;
  parsedInvoice: ParsedInvoiceData;
  preprocessedPreview?: string;
}

export interface ParsedInvoiceData {
  supplier: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amountHT: number;
  tva: number;
  amountTTC: number;
  currency: string;
  iban: string;
  paymentTerms: string;
  category: string;
}

/**
 * Run Tesseract.js OCR on an image file with preprocessing
 */
export async function runOCR(
  file: File,
  onProgress?: (progress: number, status: string) => void,
  preprocessOptions?: PreprocessingOptions
): Promise<OCRResult> {
  const options = preprocessOptions || defaultPreprocessingOptions;
  
  // Step 1: Preprocess the image
  if (onProgress) onProgress(0, 'Pré-traitement de l\'image...');
  
  const { processedBlob, previewUrl } = await preprocessImage(file, options);
  const processedUrl = URL.createObjectURL(processedBlob);

  if (onProgress) onProgress(10, 'Reconnaissance OCR...');

  try {
    const result = await Tesseract.recognize(processedUrl, 'fra+deu+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(10 + Math.round(m.progress * 90), 'Reconnaissance OCR...');
        }
      },
    });

    const rawText = result.data.text;
    const confidence = result.data.confidence;
    const parsedInvoice = parseInvoiceText(rawText);

    return { rawText, confidence, parsedInvoice, preprocessedPreview: previewUrl };
  } finally {
    URL.revokeObjectURL(processedUrl);
  }
}

export { defaultPreprocessingOptions, type PreprocessingOptions } from './imagePreprocess';

// ============================================================
// NOISE FILTERING - Remove phone UI elements, headers, footers
// ============================================================

/** Patterns that indicate phone/device UI noise (status bar, navigation) */
const NOISE_PATTERNS: RegExp[] = [
  /^\d{1,2}:\d{2}\b/,                          // Time display "16:45", "9:41"
  /^[«»<>]\s*(4G|5G|LTE|3G|WiFi)/i,            // Network indicator
  /^\s*(4G|5G|LTE|3G)\s*$/i,                    // Standalone network text
  /^(Fichiers?|Photos?|Albums?|Documents?)\s*$/i, // File browser UI
  /^\s*[◀▶←→⟵⟶<>]\s*(Fichiers?|Back|Retour)/i, // Navigation buttons
  /^Capture d'écran/i,                          // Screenshot filename
  /^\s*\d+\s*\/\s*\d+\s*$/,                     // Page numbers "2 / 14"
  /^(Publish|Share|Edit|Cancel|Done)\s*$/i,     // App buttons
  /^\s*•{2,}\s*$/,                              // Bullet indicators
  /^\s*[☰≡]\s*$/,                               // Hamburger menu
  /^\d{1,2}:\d{2}\s*[«»]\s*(4G|5G)/i,          // Combined time + network "16:45 « 5G"
  /^Make changes/i,                             // App UI text
  /^\s*[×✕✖✗xX]\s*$/,                           // Close button
];

/** Check if a line is phone UI noise */
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length <= 2) return true;
  return NOISE_PATTERNS.some(p => p.test(trimmed));
}

/** Filter noise from OCR lines */
function filterNoiseLines(lines: string[]): string[] {
  return lines.filter(line => !isNoiseLine(line));
}

// ============================================================
// MAIN PARSER
// ============================================================

/**
 * Intelligent parser to extract structured invoice data from raw OCR text
 */
export function parseInvoiceText(text: string): ParsedInvoiceData {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cleanLines = filterNoiseLines(rawLines);
  const cleanText = cleanLines.join('\n');

  const supplier = extractSupplier(cleanLines, cleanText);
  const invoiceNumber = extractInvoiceNumber(cleanText);
  const date = extractDate(cleanText, 'invoice');
  const dueDate = extractDate(cleanText, 'due');
  let amountHT = extractAmount(cleanText, 'ht');
  let tva = extractAmount(cleanText, 'tva');
  let amountTTC = extractAmount(cleanText, 'ttc');
  const currency = extractCurrency(cleanText);
  const iban = extractIBAN(cleanText);
  const paymentTerms = extractPaymentTerms(cleanText);
  const category = guessCategory(cleanText.toLowerCase());

  // Smart amount reconciliation with sanity checks
  
  // Sanity: If TVA > TTC or TVA > HT, it's clearly wrong → reset TVA
  if (amountTTC > 0 && tva >= amountTTC) {
    tva = 0;
  }
  if (amountHT > 0 && tva > amountHT) {
    tva = 0;
  }
  // Sanity: TVA should not exceed 30% of TTC (no country has > 27% VAT)
  if (amountTTC > 0 && tva > 0 && tva > amountTTC * 0.3) {
    tva = 0;
  }
  // Sanity: If HT > TTC, HT is probably wrong (misread)
  if (amountTTC > 0 && amountHT > amountTTC) {
    amountHT = 0;
  }

  // Special case: Only TVA found, no HT and no TTC
  // This likely means the "TVA" keyword matched the total amount (misread)
  if (amountHT === 0 && amountTTC === 0 && tva > 0) {
    amountTTC = tva;
    tva = 0;
  }

  // Case 1: We have TTC but no HT → HT = TTC - TVA (or HT = TTC if no TVA)
  if (amountTTC > 0 && amountHT === 0) {
    amountHT = tva > 0 ? amountTTC - tva : amountTTC;
  }
  // Case 2: We have HT and TVA but no TTC
  if (amountHT > 0 && amountTTC === 0) {
    amountTTC = amountHT + tva;
  }
  // Case 3: We have only HT, no TVA, no TTC
  if (amountHT > 0 && tva === 0 && amountTTC === 0) {
    amountTTC = amountHT;
  }

  return {
    supplier,
    invoiceNumber,
    date,
    dueDate,
    amountHT,
    tva,
    amountTTC,
    currency,
    iban,
    paymentTerms,
    category,
  };
}

// ============================================================
// SUPPLIER EXTRACTION (improved - handles QR bill noise)
// ============================================================

/** Common Swiss/French company suffixes */
const COMPANY_SUFFIXES = /\b(SA|S\.A\.|Sàrl|SARL|GmbH|AG|S\.A|Inc|Ltd|SRL|Sàrl\.?|& Cie|& Co|et Fils)\b/i;

/** Known Swiss companies for quick matching */
const KNOWN_COMPANIES = [
  'Assura', 'Swisscom', 'Sunrise', 'SIG', 'TPG', 'Migros', 'Coop',
  'Aligro', 'Metro', 'Transgourmet', 'Helvétia', 'Mobilière', 'CSS',
  'Visana', 'Swica', 'Groupe Mutuel', 'Helsana', 'Sanitas', 'Concordia',
  'Generali', 'AXA', 'Zurich', 'Bâloise', 'Vaudoise', 'Swiss Life',
  'Romande Énergie', 'Alpiq', 'BKW', 'Poste', 'CFF', 'Raiffeisen',
  'UBS', 'Credit Suisse', 'BCGE', 'BCV', 'Valais Centrale', 'PostFinance',
  'La Lignière', 'Clinique La Lignière', 'CLINIQUE LA LIGNIERE',
];

/** Clean a supplier name by removing IBAN/account numbers and document type labels */
function cleanSupplierName(raw: string): string {
  let name = raw.trim();
  // Remove IBAN patterns (CH96 3076 7000 H530 8265 7)
  name = name.replace(/[A-Z]{2}\d{2}[\s\d\w]{10,25}/g, '').trim();
  // Remove standalone account numbers like "H530 8265 7" or "3076 7000"
  name = name.replace(/^[\dA-Z]{1,4}[\s][\dA-Z]{2,4}[\s][\dA-Z]{1,4}[\s:]*/g, '').trim();
  // Remove leading "Compte / Payable à" or "Come" (OCR misread of "Compte")
  name = name.replace(/^(?:Compte?\s*[/]?\s*Payable\s*[àa]?\s*[:.]?\s*)/i, '').trim();
  name = name.replace(/^(?:Come\s+)/i, '').trim();
  // Remove document type labels (FACTURE, INVOICE, RECHNUNG, DEVIS, etc.)
  name = name.replace(/\s*(FACTURE|INVOICE|RECHNUNG|DEVIS|QUITTANCE|REÇU|AVOIR|GUTSCHRIFT|OFFERTE)\s*/gi, ' ').trim();
  // Remove pure numeric prefixes and colon separators
  name = name.replace(/^[\d\s]+[:]?\s*/, '').trim();
  // If starts with a colon, remove it
  name = name.replace(/^[:\s]+/, '').trim();
  return name;
}

function extractSupplier(lines: string[], fullText: string): string {
  // Strategy 1: Look for known company names anywhere in the text
  for (const company of KNOWN_COMPANIES) {
    const regex = new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (regex.test(fullText)) {
      // Find the line containing this company name
      const lineWithCompany = lines.find(l => regex.test(l));
      if (lineWithCompany) {
        const cleaned = cleanSupplierName(lineWithCompany);
        if (cleaned.length > 2 && cleaned.length < 60) {
          return cleaned;
        }
      }
      return company;
    }
  }

  // Strategy 2: Look for lines containing company suffixes (SA, Sàrl, AG, etc.)
  // But skip lines in the QR-bill "Compte / Payable à" section
  for (const line of lines) {
    if (COMPANY_SUFFIXES.test(line) && line.length < 80) {
      // Avoid lines that are clearly addresses, payment sections, or mixed with IBAN
      if (/^\d/.test(line) && /[A-Z]{2}\d{2}/.test(line)) continue; // IBAN line
      if (/case postale|route|rue|chemin|avenue|boulevard/i.test(line)) continue;
      if (/^(Compte|Payable|Come)\s/i.test(line)) continue; // QR-bill section
      
      const cleaned = cleanSupplierName(line);
      if (cleaned.length > 2 && COMPANY_SUFFIXES.test(cleaned)) {
        return cleaned;
      }
    }
  }

  // Strategy 3: Look for "Compte / Payable à" section and extract company name after IBAN
  const payableSection = fullText.match(/(?:Compte\s*[/]\s*Payable\s*[àa]|Payable\s*[àa])\s*\n([^\n]*\n){0,2}([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s\-.&]+(?:SA|S\.A\.|Sàrl|AG|GmbH))/im);
  if (payableSection && payableSection[2]) {
    return payableSection[2].trim();
  }

  // Strategy 4: Look for text on a line by itself that looks like a company header (top of document)
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i];
    if (line.length < 4 || line.length > 60) continue;
    if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(line)) continue; // Date
    if (/^\d+$/.test(line)) continue; // Pure number
    if (/^(route|rue|chemin|avenue|blvd|case postale|cp)\b/i.test(line)) continue; // Address
    if (/^\d{4}\s+\w+/i.test(line)) continue; // Postal code + city
    if (/^(payeur|payable|référence|partenaire|monnaie|montant)\b/i.test(line)) continue;
    if (/^(récépissé|section|informations|période|échéance)\b/i.test(line)) continue;
    if (/^www\.|\.(ch|com)$/i.test(line)) continue;
    if (/^\d{4}\s+\d{3}\s+\d{3}$/.test(line)) continue;
    if (/^(Compte|Come|CH\d{2})/i.test(line)) continue; // IBAN/Account
    if (/^(Patient|Adresse|Date de|Motif|Période|Type d|Médecin)/i.test(line)) continue; // Medical form fields

    // Good candidate: starts with uppercase, has multiple letters
    if (/^[A-ZÀ-Ÿ]/.test(line) && /[a-zA-ZÀ-ÿ]{3,}/.test(line)) {
      return cleanSupplierName(line);
    }
  }

  return '';
}

// ============================================================
// INVOICE NUMBER EXTRACTION (improved - excludes GLN, handles Swiss medical)
// ============================================================

function extractInvoiceNumber(text: string): string {
  const patterns = [
    // Swiss medical: "Facture - Patient    382780/0 - 1011407"
    /(?:facture\s*[-–]\s*patient)\s*[:.]?\s*([A-Z0-9][\w\-/\s]{2,20})/i,
    // Standard: "Facture N° XXX" or "N° facture: XXX" (includes : for OCR misreads of -)
    /(?:facture|invoice|rechnung)\s*(?:n[°o.]?|#|nr\.?|num[ée]ro)?[\s:.]\s*([A-Z0-9][\w\-/:]{2,20})/i,
    // "N° de facture" pattern
    /(?:n[°o.]\s*(?:de\s+)?(?:facture|fact\.?))\s*[:.]?\s*([A-Z0-9][\w\-/:]{2,20})/i,
    // Reference number (Swiss) - but NOT GLN
    /(?:réf(?:érence)?|ref)\s*(?:n[°o.]?)?\s*[:.]?\s*(\d{5,15})/i,
    // Numéro de police / contrat / dossier
    /(?:police|contrat|dossier)\s*(?:n[°o.]?)?\s*[:.]?\s*([A-Z0-9][\w\-/]{2,20})/i,
    // Nr. / N° patterns - but exclude GLN numbers (760...)
    /(?:n[°o.]|#|nr\.?)\s*[:.]?\s*(\d{4,15})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let val = match[1].trim();
      // Normalize OCR artifacts: colon → hyphen (common misread of dash)
      val = val.replace(/:/g, '-');
      // Validate: at least 3 chars, not a date, not a GLN (starts with 76 and 13 digits)
      if (val.length >= 3 && !/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(val)) {
        // Exclude GLN numbers (EAN-13 starting with 76)
        if (/^76\d{11}$/.test(val.replace(/\s/g, ''))) continue;
        // Exclude very long pure numeric strings that are likely GLN/EAN
        if (/^\d{13,}$/.test(val.replace(/\s/g, ''))) continue;
        return val;
      }
    }
  }

  // Fallback: look for "No Concordat" pattern (Swiss medical)
  const concordat = text.match(/(?:No\s*Concordat)\s*[:\s]*([A-Z0-9][\w\s]{2,15})/i);
  if (concordat && concordat[1]) {
    return concordat[1].trim();
  }

  return '';
}

// ============================================================
// DATE EXTRACTION (improved with Swiss city + date, validation)
// ============================================================

const FRENCH_MONTHS: Record<string, string> = {
  'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
  'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
  'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
  'jan': '01', 'fév': '02', 'fev': '02', 'mar': '03', 'avr': '04',
  'jui': '06', 'jul': '07', 'aoû': '08', 'sep': '09', 'oct': '10',
  'nov': '11', 'déc': '12', 'dec': '12',
};

function parseFrenchTextDate(text: string): string | null {
  // Match "le 4 mars 2025" or "4 mars 2025" or "1er janvier 2024"
  const pattern = /(?:le\s+)?(\d{1,2})(?:er)?\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|jan|fév|fev|mar|avr|jui|jul|aoû|sep|oct|nov|déc|dec)\.?\s+(\d{4})/gi;
  const match = pattern.exec(text);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase().replace('.', '');
    const month = FRENCH_MONTHS[monthKey] || '01';
    const year = match[3];
    const parsed = `${year}-${month}-${day}`;
    if (isValidDate(parsed)) return parsed;
  }
  return null;
}

/** Validate a date string is reasonable (year between 2000 and 2030) */
function isValidDate(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 8) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  if (year < 2000 || year > 2030) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

function parseNumericDate(dateStr: string): string {
  const parts = dateStr.split(/[./\-]/);
  if (parts.length !== 3) return '';
  
  let day = parts[0];
  let month = parts[1];
  let year = parts[2];
  
  // Handle YYYY-MM-DD format
  if (parts[0].length === 4) {
    const result = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return isValidDate(result) ? result : '';
  }
  
  if (year.length === 2) year = '20' + year;
  day = day.padStart(2, '0');
  month = month.padStart(2, '0');
  
  // Swiss/European format is DD.MM.YYYY
  const result = `${year}-${month}-${day}`;
  return isValidDate(result) ? result : '';
}

function extractDate(text: string, type: 'invoice' | 'due'): string {
  if (type === 'due') {
    // Look for due date near specific keywords
    const duePatterns = [
      /(?:échéance|echeance|fällig|due\s*date|payable\s*(?:au|avant|jusqu'au|d'ici\s*le)?)\s*[:.]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
      /(?:payable\s*(?:à|dans|in)\s*\d+\s*jours?\s*(?:net)?)/i,
    ];
    
    for (const pattern of duePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const parsed = parseNumericDate(match[1]);
        if (parsed) return parsed;
      }
    }

    // Try French text date after due keyword
    const dueTextMatch = text.match(/(?:échéance|payable|fällig)[^.]*?(?:le\s+)?(\d{1,2})(?:er)?\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);
    if (dueTextMatch) {
      const day = dueTextMatch[1].padStart(2, '0');
      const month = FRENCH_MONTHS[dueTextMatch[2].toLowerCase()] || '01';
      const result = `${dueTextMatch[3]}-${month}-${day}`;
      if (isValidDate(result)) return result;
    }

    // Fallback: use invoice date + 30 days
    const invoiceDate = extractDate(text, 'invoice');
    if (invoiceDate) {
      // Check for "30 jours" pattern
      const daysMatch = text.match(/(\d+)\s*jours?\s*(?:net|fin)/i);
      const days = daysMatch ? parseInt(daysMatch[1]) : 30;
      const d = new Date(invoiceDate);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }

    return '';
  }

  // Invoice date extraction
  
  // Priority 1: Swiss pattern "City, le DD.MM.YYYY" (very common in Swiss invoices)
  const swissCityDate = text.match(/[A-ZÀ-Ÿa-zà-ÿ]+,?\s*(?:le\s+)?(\d{1,2}[./]\d{1,2}[./]\d{4})/);
  if (swissCityDate) {
    const parsed = parseNumericDate(swissCityDate[1]);
    if (parsed) return parsed;
  }

  // Priority 2: "Date" or "Datum" keyword followed by a date
  const dateKeywordPatterns = [
    /(?:date\s*(?:de\s*)?(?:facture|facturation)?|datum|date)\s*[:.]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
    /(?:du|le|vom)\s+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
  ];

  for (const pattern of dateKeywordPatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = parseNumericDate(match[1]);
      if (parsed) return parsed;
    }
  }

  // Priority 3: French text date (e.g., "Pully, le 4 mars 2025")
  const frenchDate = parseFrenchTextDate(text);
  if (frenchDate) return frenchDate;

  // Priority 4: "Facture finale" nearby date
  const factureFinaleDate = text.match(/(?:facture\s*(?:finale|provisoire)?)[^]*?(\d{1,2}[./]\d{1,2}[./]\d{4})/i);
  if (factureFinaleDate) {
    const parsed = parseNumericDate(factureFinaleDate[1]);
    if (parsed) return parsed;
  }

  // Priority 5: First valid date found in document (not from "Période" or "Du...au")
  const allDates = extractAllDates(text);
  if (allDates.length > 0) return allDates[0];

  return '';
}

/** Extract all valid dates from text in ISO format */
function extractAllDates(text: string): string[] {
  const dates: string[] = [];
  const numericPattern = /(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/g;
  let match;

  while ((match = numericPattern.exec(text)) !== null) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    
    // Validate month and day ranges
    const m = parseInt(month);
    const d = parseInt(day);
    const y = parseInt(year);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2030) {
      dates.push(`${year}-${month}-${day}`);
    }
  }

  // Also find French text dates
  const frenchPattern = /(\d{1,2})(?:er)?\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\.?\s+(\d{4})/gi;
  while ((match = frenchPattern.exec(text)) !== null) {
    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase();
    const month = FRENCH_MONTHS[monthKey] || '01';
    const year = match[3];
    const y = parseInt(year);
    if (y >= 2000 && y <= 2030) {
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

// ============================================================
// AMOUNT EXTRACTION (improved for Swiss medical invoices)
// ============================================================

/** Clean a number string from Swiss/European formats */
function cleanNumber(str: string): number {
  if (!str) return 0;
  // Remove currency symbols and letters
  let cleaned = str.replace(/[A-Za-z€$£]/g, '').trim();
  // Handle Swiss format with apostrophe thousand separator: 1'234.56
  cleaned = cleaned.replace(/['']/g, '');
  // Handle space as thousand separator: 1 234.56
  cleaned = cleaned.replace(/(\d)\s+(\d)/g, '$1$2');
  // Handle European format: 1.234,56 → 1234.56
  if (/\d+\.\d{3},\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Handle comma as decimal: 123,45 → 123.45
  else if (/\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  }
  // Handle dot as thousand separator without decimal: 1.234 (4+ digits total with dot in middle)
  else if (/^\d{1,3}\.\d{3}$/.test(cleaned)) {
    cleaned = cleaned.replace('.', '');
  }
  
  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

function extractAmount(text: string, type: 'ht' | 'tva' | 'ttc'): number {
  if (type === 'ttc') {
    // Total / TTC patterns - prioritize "Total Facture" (Swiss invoices)
    const ttcPatterns = [
      // Swiss medical: "Total Facture CHF 7,920.00" or "Total Facture CHF 7'920.00"
      /(?:total\s*facture)\s*(?:chf|eur|€|fr\.?)\s*([\d''.,\s]+[\d])/i,
      // Generic total patterns with TTC/à payer keywords
      /(?:total\s*(?:ttc|à\s*payer)|montant\s*(?:total|ttc|dû|à\s*payer)|gesamtbetrag|net\s*à\s*payer|à\s*payer|total\s*amount)\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/i,
      // Plain "TOTAL" followed by amount (very common in French invoices)
      /(?:^|\n)\s*TOTAL\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/im,
      // "TOTAL" anywhere, but be careful with "Total HT" (handled by HT pattern)
      /\bTOTAL\b(?!\s*(?:HT|hors))\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/i,
      // "Solde" pattern (remaining balance) - important for partially paid invoices
      /(?:solde)\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/i,
    ];

    for (const pattern of ttcPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = cleanNumber(match[1]);
        if (amount > 0) return amount;
      }
    }

    // Look for currency + amount pattern in the QR-bill "Montant" section
    const qrMontant = text.match(/(?:Monnaie|Devise)\s+(?:Montant)\s*\n?\s*(?:CHF|EUR|Fr\.?)\s+([\d''.,\s]+[\d])/i);
    if (qrMontant) {
      const amount = cleanNumber(qrMontant[1]);
      if (amount > 0) return amount;
    }

    // Fallback: Look for "Montant" keyword standalone
    const montantMatch = text.match(/(?:montant)\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/i);
    if (montantMatch) {
      const amount = cleanNumber(montantMatch[1]);
      if (amount > 0) return amount;
    }

    // Last resort: find all currency amounts and take the largest
    const allAmounts = [...text.matchAll(/(?:chf|eur|€|fr\.?)\s*([\d''.,\s]+[\d])/gi)];
    if (allAmounts.length > 0) {
      const amounts = allAmounts.map(m => cleanNumber(m[1])).filter(a => a > 0 && a < 1000000);
      if (amounts.length > 0) {
        return Math.max(...amounts);
      }
    }
  }

  if (type === 'ht') {
    const htPatterns = [
      /(?:sous[.\s-]?total|subtotal|total\s*ht|hors\s*taxe|montant\s*ht)\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/i,
      /(?:montant\s*hors\s*(?:tva|taxe))\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/i,
      // "Net" or "Netto" with amount (but NOT "net" in payment terms like "30 jours net")
      /(?:^|\n)\s*(?:netto?|net\s*amount)\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/im,
    ];

    for (const pattern of htPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = cleanNumber(match[1]);
        // Sanity check: HT amount must be > 2 (to avoid catching quantities like "1" or "2")
        if (amount > 2) return amount;
      }
    }
  }

  if (type === 'tva') {
    const tvaPatterns = [
      // "TVA 20%: 29,00" or "TVA (20%) 29,00 €"
      /(?:tva|mwst|vat|taxe)\s*(?:\(?(\d+[.,]?\d*)\s*%\)?)?\s*[:.]?\s*(?:chf|eur|€|fr\.?)?\s*([\d''.,\s]+[\d])/i,
      // "29,00 € (TVA)" or "CHF 29.00 TVA"
      /(?:chf|eur|€|fr\.?)\s*([\d''.,\s]+[\d])\s*(?:\(?\s*tva|mwst|vat)/i,
    ];

    for (const pattern of tvaPatterns) {
      const match = text.match(pattern);
      if (match) {
        // The amount could be in group 1 or 2 depending on the pattern
        const amountStr = match[2] || match[1];
        const amount = cleanNumber(amountStr);
        // Sanity check: TVA must be > 0 and < 50000, and also must be reasonable
        // (not a misread of some other number)
        if (amount > 0 && amount < 50000) return amount;
      }
    }

    // Look for "TVA" mentioned as 0% (Swiss medical - often exempt)
    if (/(?:exon[ée]r[ée]|exempt|sans\s*tva|tva\s*0|0\s*%\s*tva)/i.test(text)) {
      return 0;
    }
  }

  return 0;
}

// ============================================================
// CURRENCY DETECTION (improved - context-aware)
// ============================================================

function extractCurrency(text: string): string {
  // Priority 1: Look for currency in "Total Facture" context
  const totalContext = text.match(/(?:total\s*facture)\s*(CHF|EUR|USD|Fr\.?)/i);
  if (totalContext) {
    const curr = totalContext[1].toUpperCase();
    if (curr === 'FR' || curr === 'FR.') return 'CHF';
    return curr;
  }

  // Priority 2: Look for "Monnaie" / "Devise" section (QR bill)
  const monnaieMatch = text.match(/(?:monnaie|devise)\s*\n?\s*(CHF|EUR|USD|Fr\.?)/i);
  if (monnaieMatch) {
    const curr = monnaieMatch[1].toUpperCase();
    if (curr === 'FR' || curr === 'FR.') return 'CHF';
    return curr;
  }

  // Priority 3: Count occurrences with weighted scoring
  const chfCount = (text.match(/\bCHF\b/g) || []).length * 2 + (text.match(/\bfr\.\b/gi) || []).length;
  const eurCount = (text.match(/\bEUR\b/g) || []).length * 2 + (text.match(/€/g) || []).length;
  const usdCount = (text.match(/\bUSD\b/g) || []).length * 2 + (text.match(/\$/g) || []).length;

  if (eurCount > chfCount && eurCount > usdCount) return 'EUR';
  if (usdCount > chfCount && usdCount > eurCount) return 'USD';
  if (chfCount > 0) return 'CHF';
  
  // Priority 4: If the document mentions Swiss locations, default to CHF
  if (/\b(suisse|schweiz|switzerland|genève|zürich|bern|lausanne|gland|vernier|nyon)\b/i.test(text)) {
    return 'CHF';
  }
  
  return 'CHF'; // Default for Swiss restaurant
}

// ============================================================
// IBAN EXTRACTION (improved for Swiss format)
// ============================================================

function extractIBAN(text: string): string {
  // Swiss IBAN: CH followed by 2 check digits then 17 alphanumeric chars = 21 total
  // French IBAN: FR followed by 2 check digits then 23 alphanumeric chars = 27 total
  // German IBAN: DE followed by 2 check digits then 18 digits = 22 total
  const ibanPatterns = [
    /\b(CH\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d)\b/,    // CH IBAN spaced
    /\b(CH\d{19})\b/,                                          // CH IBAN no spaces
    /\b(FR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3})\b/, // FR IBAN spaced
    /\b(FR\d{25})\b/,                                          // FR IBAN no spaces
    /\b(DE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2})\b/, // DE IBAN spaced
    /\b(DE\d{20})\b/,                                          // DE IBAN no spaces
    /\b([A-Z]{2}\d{2}\s?[\d]{4}(?:\s?[\d]{4}){2,6}(?:\s?[\d]{1,4})?)\b/, // Generic IBAN (digits only after country+check)
  ];

  for (const pattern of ibanPatterns) {
    const match = text.match(pattern);
    if (match) {
      let cleaned = match[1].replace(/\s+/g, ' ').trim();
      // Remove trailing SWIFT/BIC code if accidentally captured
      cleaned = cleaned.replace(/\s*(SWIFT|BIC|SWIF)\s*[:.]?\s*[A-Z]{4,}.*$/i, '').trim();
      const noSpaces = cleaned.replace(/\s/g, '');
      // Validate IBAN length (min 15, max 34)
      if (noSpaces.length >= 15 && noSpaces.length <= 34) {
        // Validate: after country code + 2 check digits, rest should be mostly digits
        const body = noSpaces.slice(4);
        const digitRatio = (body.match(/\d/g) || []).length / body.length;
        if (digitRatio >= 0.7) {
          return cleaned;
        }
      }
    }
  }

  // Also look for "Compte / Payable à" or "IBAN" label section
  const ibanLabelMatch = text.match(/(?:IBAN|Compte|Payable\s*à|Konto)\s*[:/]?\s*\n?\s*([A-Z]{2}\d{2}[\s\d]{10,30})/i);
  if (ibanLabelMatch) {
    let cleaned = ibanLabelMatch[1].replace(/\s+/g, ' ').trim();
    // Remove trailing SWIFT/BIC
    cleaned = cleaned.replace(/\s*(SWIFT|BIC)\s*[:.]?\s*[A-Z]{4,}.*$/i, '').trim();
    const noSpaces = cleaned.replace(/\s/g, '');
    if (noSpaces.length >= 15 && noSpaces.length <= 34) {
      return cleaned;
    }
  }

  return '';
}

// ============================================================
// PAYMENT TERMS
// ============================================================

function extractPaymentTerms(text: string): string {
  const patterns = [
    /(\d+)\s*(?:jours?\s*(?:net|fin de mois)?)/i,
    /(?:net|payable)\s*(?:à|dans|in)\s*(\d+)\s*(?:jours?|tage|days)/i,
    /(?:zahlbar|payable|paiement)\s*[:.]?\s*(.{5,30})/i,
    /(?:délai|frist)\s*[:.]?\s*(\d+)\s*(?:jours?|tage|days)/i,
    /(?:payable\s*à)\s*(\d+)\s*(?:jours?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (/^\d+$/.test(match[1])) {
        return `${match[1]} jours net`;
      }
      const term = match[1].trim();
      if (term.length > 3 && term.length < 40) return term;
    }
  }

  // Check for "sans déduction" / "net sans déduction"
  if (/net\s*sans\s*d[ée]duction/i.test(text)) {
    const days = text.match(/(\d+)\s*jours?\s*net\s*sans/i);
    if (days) return `${days[1]} jours net sans déduction`;
    return '30 jours net sans déduction';
  }

  return '30 jours net';
}

// ============================================================
// CATEGORY GUESSING (improved)
// ============================================================

function guessCategory(text: string): string {
  const categories: [string, string[]][] = [
    ['Fournisseurs alimentaires', ['viande', 'légume', 'fruit', 'poisson', 'boucherie', 'primeur', 'alimentaire', 'food', 'lebensmittel', 'épicerie', 'fromage', 'lait', 'boulangerie', 'pain', 'pâtisserie', 'traiteur']],
    ['Boissons', ['vin', 'bière', 'boisson', 'cave', 'spiritueux', 'getränke', 'beverage', 'eau minérale', 'soft', 'alcool', 'sirop', 'jus']],
    ['Électricité / gaz / eau', ['électricité', 'electricité', 'sig ', 'énergie', 'gaz', 'eau', 'strom', 'energie', 'utility', 'kwh', 'compteur']],
    ['Loyer', ['loyer', 'bail', 'miete', 'rent', 'location', 'sous-location']],
    ['Assurances', ['assura', 'assurance', 'versicherung', 'insurance', 'police', 'couverture', 'prime', 'prämie', 'css', 'visana', 'swica', 'helsana', 'sanitas', 'concordia', 'groupe mutuel', 'helvétia', 'mobilière', 'vaudoise', 'bâloise', 'generali', 'axa', 'zurich']],
    ['Charges de personnel', ['salaire', 'avs', 'lpp', 'caisse de pension', 'gehalt', 'lohn', 'employé', 'personnel']],
    ['Entretien', ['nettoyage', 'entretien', 'réparation', 'maintenance', 'reinigung', 'dépannage']],
    ['Marketing', ['publicité', 'marketing', 'web', 'google', 'facebook', 'flyer', 'werbung', 'instagram']],
    ['Matériel', ['équipement', 'matériel', 'machine', 'mobilier', 'vaisselle', 'ustensile', 'four', 'frigo']],
    ['Frais administratifs', ['comptable', 'fiduciaire', 'avocat', 'juridique', 'administration', 'bureau', 'notaire']],
    ['Frais bancaires', ['banque', 'bank', 'commission', 'frais bancaire', 'intérêt', 'postfinance']],
    ['Charges exploitation', ['téléphone', 'internet', 'swisscom', 'sunrise', 'abonnement', 'logiciel', 'salt', 'wingo']],
    ['Santé / Médical', ['maladie', 'lamal', 'lca', 'médecin', 'pharmacie', 'santé', 'clinique', 'hôpital', 'hospitalier', 'patient', 'psychiatr', 'réadaptation', 'cardiovasculaire', 'orthopéd']],
  ];

  for (const [category, keywords] of categories) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) return category;
    }
  }

  return 'Autres charges';
}
