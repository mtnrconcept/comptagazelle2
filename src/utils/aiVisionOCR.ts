import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

/**
 * Configuration du provider AI
 * 
 * En LOCAL : utilise directement l'API OpenAI avec votre clé depuis .env
 * Sur YOUWARE : utilise le proxy Youware (fallback automatique)
 */
function getAIProvider() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (apiKey && apiKey !== 'your-openai-api-key-here') {
    // Mode LOCAL : utilise l'API OpenAI directement
    return createOpenAI({
      apiKey: apiKey,
    });
  }
  
  // Mode YOUWARE (fallback) : utilise le proxy plateforme
  return createOpenAI({
    baseURL: 'https://api.youware.com/public/v1/ai',
    apiKey: 'sk-YOUWARE',
  });
}

// Available vision models for invoice extraction
export const VISION_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Rapide et économique', badge: 'Rapide' },
  { id: 'openai-gpt-4o', label: 'GPT-4o', description: 'Très précis, vision avancée', badge: 'Précis' },
  { id: 'claude-4-sonnet', label: 'Claude 4 Sonnet', description: 'Créatif, bon contexte', badge: 'Fiable' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Expert technique', badge: 'Pro' },
] as const;

// Models compatible with direct OpenAI API (when running locally)
const OPENAI_MODEL_MAP: Record<string, string> = {
  'openai-gpt-4o': 'gpt-4o',
  'gemini-2.5-flash': 'gpt-4o-mini',
  'claude-4-sonnet': 'gpt-4o',
  'gemini-2.5-pro': 'gpt-4o',
};

export type VisionModelId = typeof VISION_MODELS[number]['id'];

// Zod schema for structured invoice extraction
const InvoiceSchema = z.object({
  supplier: z.string().describe('Nom du fournisseur ou de la société émettrice de la facture'),
  invoiceNumber: z.string().describe('Numéro de facture (ex: FA-2024-001, 12345, etc.)'),
  date: z.string().describe('Date de la facture au format YYYY-MM-DD'),
  dueDate: z.string().describe('Date d\'échéance au format YYYY-MM-DD, ou chaîne vide si non trouvée'),
  amountHT: z.number().describe('Montant hors taxes (HT) en nombre décimal'),
  tva: z.number().describe('Montant de la TVA en nombre décimal'),
  amountTTC: z.number().describe('Montant toutes taxes comprises (TTC) en nombre décimal'),
  currency: z.string().describe('Devise : CHF, EUR, USD, GBP, etc.'),
  iban: z.string().describe('IBAN du bénéficiaire avec espaces (ex: CH93 0076 2011 6238 5295 7), ou chaîne vide'),
  paymentTerms: z.string().describe('Conditions de paiement (ex: 30 jours net, payable immédiatement)'),
  category: z.string().describe('Catégorie comptable la plus probable parmi : Matériel, Services, Loyer, Assurance, Télécom, Transport, Restauration, Fournitures, Sous-traitance, Formation, Santé / Médical, Énergie, Nettoyage, Autres charges'),
  tvaRate: z.number().describe('Taux de TVA en pourcentage (ex: 8.1 pour la Suisse, 20 pour la France). 0 si non trouvé.'),
  referenceNumber: z.string().describe('Numéro de référence QR / BVR si présent, sinon chaîne vide'),
});

export type AIInvoiceResult = z.infer<typeof InvoiceSchema>;

export interface AIVisionOCRResult {
  parsedInvoice: AIInvoiceResult;
  method: 'ai-vision';
  model: string;
}

/**
 * Convert a File to a base64 data URL
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Optimized system prompt for Swiss/French invoice extraction
const EXTRACTION_PROMPT = `Tu es un expert en extraction de données de factures suisses et européennes.

Analyse cette image de facture et extrais TOUTES les informations structurées avec une précision maximale.

RÈGLES CRITIQUES:
1. MONTANTS: Toujours des nombres décimaux avec le point (ex: 1350.00). 
   - Convertir les formats suisses: 1'350.00 → 1350.00
   - Convertir les formats européens: 1 350,00 → 1350.00
   - Si le montant TTC n'est pas explicite, calculer: HT + TVA = TTC
   
2. DATES: Toujours au format YYYY-MM-DD.
   - Convertir DD.MM.YYYY (format suisse/français) → YYYY-MM-DD
   - Convertir DD/MM/YYYY → YYYY-MM-DD
   
3. DEVISE: Détecter depuis le contexte:
   - Symbole CHF, Fr., Sfr. → "CHF"
   - Symbole €, EUR → "EUR" 
   - Par défaut pour factures suisses → "CHF"
   
4. IBAN: Inclure avec les espaces standards (groupes de 4 chiffres).
   - Format suisse: CH + 2 chiffres + 4×4 chiffres + 1 chiffre
   - Format français: FR + 2 chiffres + 5×4 chiffres + 3 chiffres
   
5. TVA SUISSE: Taux courants = 8.1% (normal), 2.6% (réduit), 3.8% (hébergement)
   TVA FRANÇAISE: 20% (normal), 10% (intermédiaire), 5.5% (réduit)

6. FOURNISSEUR: Prendre le nom commercial principal (pas l'adresse, pas le IBAN).

7. NUMÉRO QR/BVR: Si un QR-code de paiement suisse est visible, extraire le numéro de référence.

8. Si une information n'est pas trouvée: chaîne vide "" pour texte, 0 pour nombres.`;

/**
 * Determine the model ID to use based on environment
 */
function resolveModelId(modelId: VisionModelId): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  // In local mode with OpenAI API, map model IDs to OpenAI equivalents
  if (apiKey && apiKey !== 'your-openai-api-key-here') {
    return OPENAI_MODEL_MAP[modelId] || 'gpt-4o';
  }
  
  // On Youware platform, use the model ID as-is (proxy handles routing)
  return modelId;
}

/**
 * Extract invoice data from an image using AI Vision
 * Supports multiple vision models for different accuracy/speed tradeoffs
 */
export async function runAIVisionOCR(
  file: File,
  onProgress?: (progress: number, status: string) => void,
  modelId: VisionModelId = 'openai-gpt-4o'
): Promise<AIVisionOCRResult> {
  const modelLabel = VISION_MODELS.find(m => m.id === modelId)?.label || modelId;
  const provider = getAIProvider();
  const resolvedModel = resolveModelId(modelId);
  
  if (onProgress) onProgress(5, 'Préparation de l\'image...');

  // Log the request
  console.log('AI API Request:', {
    model: resolvedModel,
    originalModelId: modelId,
    scene: 'invoice_analyzer',
    input: `Image file: ${file.name} (${(file.size / 1024).toFixed(1)} Ko)`,
    parameters: { temperature: 0.1 }
  });

  const startTime = Date.now();

  // Convert file to base64
  const base64DataUrl = await fileToBase64(file);
  if (onProgress) onProgress(20, `Envoi vers ${modelLabel}...`);

  try {
    const { object } = await generateObject({
      model: provider(resolvedModel),
      schema: InvoiceSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: base64DataUrl,
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    if (onProgress) onProgress(100, 'Extraction terminée !');

    // Log success
    console.log('AI API Response:', {
      model: resolvedModel,
      outputLength: JSON.stringify(object).length,
      processingTime: `${Date.now() - startTime}ms`
    });

    return {
      parsedInvoice: object,
      method: 'ai-vision',
      model: modelId,
    };
  } catch (error: any) {
    console.error('API Error - Invoice extraction failed:', {
      model: resolvedModel,
      error: error.message,
      scene: 'invoice_analyzer'
    });
    throw error;
  }
}
