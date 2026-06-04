import { useState, useCallback } from 'react';
import { useStore } from '../store';
import { Upload, FileText, CheckCircle, AlertCircle, Eye, Zap, Settings2, Image as ImageIcon, Brain } from 'lucide-react';
import { Invoice } from '../types';
import { runOCR, OCRResult, defaultPreprocessingOptions, PreprocessingOptions } from '../utils/ocrEngine';
import { runAIVisionOCR, AIVisionOCRResult, VISION_MODELS, VisionModelId } from '../utils/aiVisionOCR';

type OCRMethod = 'ai-vision' | 'tesseract';

export default function InvoiceScan() {
  const { saveInvoiceAccountingFlow, categories } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [aiResult, setAiResult] = useState<AIVisionOCRResult | null>(null);
  const [scannedData, setScannedData] = useState<Partial<Invoice> | null>(null);
  const [saved, setSaved] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [showPreprocessed, setShowPreprocessed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preprocessOptions, setPreprocessOptions] = useState<PreprocessingOptions>(defaultPreprocessingOptions);
  const [ocrMethod, setOcrMethod] = useState<OCRMethod>('ai-vision');
  const [selectedModel, setSelectedModel] = useState<VisionModelId>('gemini-2.5-flash');
  const [scanError, setScanError] = useState<string | null>(null);

  const handleFileDrop = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setSaved(false);
      setScannedData(null);
      setOcrResult(null);
      setAiResult(null);
      setProgress(0);
      setProgressStatus('');
      setScanError(null);
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        setPreview(url);
      } else {
        setPreview(null);
      }
    }
  }, []);

  const handleScan = useCallback(async () => {
    if (!file) return;
    setScanning(true);
    setSaved(false);
    setProgress(0);
    setScanError(null);

    try {
      if (ocrMethod === 'ai-vision') {
        // AI Vision path
        const result = await runAIVisionOCR(file, (p, status) => {
          setProgress(p);
          setProgressStatus(status);
        }, selectedModel);

        setAiResult(result);
        setOcrResult(null);

        const parsed = result.parsedInvoice;
        setScannedData({
          supplier: parsed.supplier || '',
          invoiceNumber: parsed.invoiceNumber || '',
          date: parsed.date || new Date().toISOString().split('T')[0],
          dueDate: parsed.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amountHT: parsed.amountHT || 0,
          tva: parsed.tva || 0,
          amountTTC: parsed.amountTTC || 0,
          currency: parsed.currency || 'CHF',
          category: parsed.category || 'Autres charges',
          status: 'pending',
          iban: parsed.iban || '',
          paymentTerms: parsed.paymentTerms || '30 jours net',
        });
      } else {
        // Tesseract path
        const result = await runOCR(file, (p, status) => {
          setProgress(p);
          setProgressStatus(status);
        }, preprocessOptions);
        
        setOcrResult(result);
        setAiResult(null);

        const parsed = result.parsedInvoice;
        let amountTTC = parsed.amountTTC;
        if (!amountTTC && parsed.amountHT) {
          amountTTC = parsed.amountHT + parsed.tva;
        }
        let tva = parsed.tva;
        if (!tva && amountTTC && parsed.amountHT) {
          tva = amountTTC - parsed.amountHT;
        }

        setScannedData({
          supplier: parsed.supplier || '',
          invoiceNumber: parsed.invoiceNumber || '',
          date: parsed.date || new Date().toISOString().split('T')[0],
          dueDate: parsed.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amountHT: parsed.amountHT || 0,
          tva: tva || 0,
          amountTTC: amountTTC || 0,
          currency: parsed.currency || 'CHF',
          category: parsed.category || 'Autres charges',
          status: 'pending',
          iban: parsed.iban || '',
          paymentTerms: parsed.paymentTerms || '30 jours net',
        });
      }
    } catch (err) {
      console.error('Scan error:', err);
      setScanError(ocrMethod === 'ai-vision' 
        ? 'Erreur lors de l\'analyse AI Vision. Essayez avec Tesseract OCR en repli.'
        : 'Erreur lors de l\'analyse OCR.');
      setScannedData({
        supplier: '',
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amountHT: 0,
        tva: 0,
        amountTTC: 0,
        currency: 'CHF',
        category: 'Autres charges',
        status: 'pending',
        iban: '',
        paymentTerms: '30 jours net',
      });
    } finally {
      setScanning(false);
    }
  }, [file, preprocessOptions, ocrMethod, selectedModel]);

  const handleSave = useCallback(() => {
    if (!scannedData) return;
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      supplier: scannedData.supplier || 'Inconnu',
      invoiceNumber: scannedData.invoiceNumber || '',
      date: scannedData.date || '',
      dueDate: scannedData.dueDate || '',
      amountHT: typeof scannedData.amountHT === 'string' ? parseFloat(scannedData.amountHT) : (scannedData.amountHT || 0),
      tva: typeof scannedData.tva === 'string' ? parseFloat(scannedData.tva) : (scannedData.tva || 0),
      amountTTC: typeof scannedData.amountTTC === 'string' ? parseFloat(scannedData.amountTTC) : (scannedData.amountTTC || 0),
      currency: scannedData.currency || 'CHF',
      category: scannedData.category || 'Autres charges',
      status: 'pending',
      fileName: file?.name,
      iban: scannedData.iban,
      paymentTerms: scannedData.paymentTerms,
    };
    saveInvoiceAccountingFlow({ invoice, categoryName: invoice.category });
    setScannedData((prev) => prev ? { ...prev, category: invoice.category } : prev);
    setSaved(true);
  }, [scannedData, file, saveInvoiceAccountingFlow]);

  const updateField = (field: keyof Invoice, value: string | number) => {
    setScannedData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const updateOption = <K extends keyof PreprocessingOptions>(key: K, value: PreprocessingOptions[K]) => {
    setPreprocessOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Scan / Import de factures</h1>
        <p className="text-dark-400 text-sm mt-1.5 font-medium">Extraction intelligente par IA Vision ou OCR Tesseract</p>
      </div>

      {/* Method selector */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOcrMethod('ai-vision')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            ocrMethod === 'ai-vision'
              ? 'bg-violet-50 border-violet-300 text-violet-800 shadow-sm'
              : 'bg-white border-dark-200 text-dark-500 hover:border-dark-300'
          }`}
        >
          <Brain size={16} className={ocrMethod === 'ai-vision' ? 'text-violet-600' : 'text-dark-400'} />
          IA Vision
          {ocrMethod === 'ai-vision' && <span className="text-xs bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded-full">Recommandé</span>}
        </button>
        <button
          onClick={() => setOcrMethod('tesseract')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            ocrMethod === 'tesseract'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
              : 'bg-white border-dark-200 text-dark-500 hover:border-dark-300'
          }`}
        >
          <Zap size={16} className={ocrMethod === 'tesseract' ? 'text-emerald-600' : 'text-dark-400'} />
          Tesseract OCR
          <span className="text-xs bg-dark-100 text-dark-500 px-1.5 py-0.5 rounded-full">Hors-ligne</span>
        </button>
      </div>

      {/* AI Vision model selector */}
      {ocrMethod === 'ai-vision' && (
        <div className="bg-white rounded-xl border border-dark-100 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={16} className="text-violet-600" />
            <span className="text-sm text-dark-900 font-semibold">Modèle de vision IA</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {VISION_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`text-left px-3 py-2.5 rounded-lg border transition-all ${
                  selectedModel === model.id
                    ? 'bg-violet-50 border-violet-300 ring-1 ring-violet-200'
                    : 'bg-white border-dark-150 hover:border-dark-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    selectedModel === model.id ? 'text-violet-800' : 'text-dark-800'
                  }`}>{model.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    selectedModel === model.id
                      ? 'bg-violet-200 text-violet-700'
                      : 'bg-dark-100 text-dark-500'
                  }`}>{model.badge}</span>
                </div>
                <p className="text-xs text-dark-400 mt-0.5">{model.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tesseract badges */}
      {ocrMethod === 'tesseract' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
            <Zap size={16} className="text-emerald-600" />
            <span className="text-sm text-emerald-800 font-medium">Tesseract.js v7</span>
            <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">fra + deu + eng</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <ImageIcon size={16} className="text-blue-600" />
            <span className="text-sm text-blue-800 font-medium">Pré-traitement image activé</span>
          </div>
        </div>
      )}

      {/* Preprocessing Settings - only for Tesseract */}
      {ocrMethod === 'tesseract' && (
        <div className="bg-white rounded-xl border border-dark-100 overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-dark-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings2 size={18} className="text-dark-500" />
              <span className="font-medium text-dark-900 text-sm">Paramètres de pré-traitement</span>
            </div>
            <span className="text-xs text-dark-400">{showSettings ? '▲ Masquer' : '▼ Afficher'}</span>
          </button>
          
          {showSettings && (
            <div className="px-6 pb-5 border-t border-dark-100 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preprocessOptions.grayscale}
                    onChange={(e) => updateOption('grayscale', e.target.checked)}
                    className="w-4 h-4 accent-gold-500 rounded"
                  />
                  <div>
                    <p className="text-sm text-dark-900 font-medium">Niveaux de gris</p>
                    <p className="text-xs text-dark-400">Supprime le bruit coloré</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preprocessOptions.binarize}
                    onChange={(e) => updateOption('binarize', e.target.checked)}
                    className="w-4 h-4 accent-gold-500 rounded"
                  />
                  <div>
                    <p className="text-sm text-dark-900 font-medium">Binarisation (Otsu)</p>
                    <p className="text-xs text-dark-400">Noir & blanc adaptatif</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preprocessOptions.denoise}
                    onChange={(e) => updateOption('denoise', e.target.checked)}
                    className="w-4 h-4 accent-gold-500 rounded"
                  />
                  <div>
                    <p className="text-sm text-dark-900 font-medium">Réduction de bruit</p>
                    <p className="text-xs text-dark-400">Filtre médian 3×3</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preprocessOptions.sharpen}
                    onChange={(e) => updateOption('sharpen', e.target.checked)}
                    className="w-4 h-4 accent-gold-500 rounded"
                  />
                  <div>
                    <p className="text-sm text-dark-900 font-medium">Netteté</p>
                    <p className="text-xs text-dark-400">Accentuation des contours</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preprocessOptions.upscale}
                    onChange={(e) => updateOption('upscale', e.target.checked)}
                    className="w-4 h-4 accent-gold-500 rounded"
                  />
                  <div>
                    <p className="text-sm text-dark-900 font-medium">Agrandissement auto</p>
                    <p className="text-xs text-dark-400">Si image &lt; 1500px</p>
                  </div>
                </label>

                <div>
                  <p className="text-sm text-dark-900 font-medium">Contraste : {preprocessOptions.contrast}%</p>
                  <input
                    type="range"
                    min="50"
                    max="250"
                    value={preprocessOptions.contrast}
                    onChange={(e) => updateOption('contrast', parseInt(e.target.value))}
                    className="w-full mt-1 accent-gold-500"
                  />
                  <div className="flex justify-between text-xs text-dark-400">
                    <span>50%</span>
                    <span>250%</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-dark-900 font-medium">Luminosité : {preprocessOptions.brightness > 0 ? '+' : ''}{preprocessOptions.brightness}</p>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={preprocessOptions.brightness}
                    onChange={(e) => updateOption('brightness', parseInt(e.target.value))}
                    className="w-full mt-1 accent-gold-500"
                  />
                  <div className="flex justify-between text-xs text-dark-400">
                    <span>-50</span>
                    <span>+50</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-dark-900 font-medium">Seuil : {preprocessOptions.threshold === 0 ? 'Auto (Otsu)' : preprocessOptions.threshold}</p>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={preprocessOptions.threshold}
                    onChange={(e) => updateOption('threshold', parseInt(e.target.value))}
                    className="w-full mt-1 accent-gold-500"
                  />
                  <div className="flex justify-between text-xs text-dark-400">
                    <span>Auto</span>
                    <span>255</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload area */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-dark-200 p-8 text-center hover:border-gold-400 transition-all duration-300 hover:shadow-card">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gold-50 rounded-full flex items-center justify-center">
            <Upload size={28} className="text-gold-500" />
          </div>
          <div>
            <p className="text-dark-900 font-medium">Glissez une facture ici ou cliquez pour sélectionner</p>
            <p className="text-dark-400 text-sm mt-1">Formats acceptés : JPG, PNG, WebP, BMP, TIFF (max 10 Mo)</p>
          </div>
          <label className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl text-sm font-medium cursor-pointer btn-premium shadow-soft">
            <FileText size={16} />
            Choisir un fichier
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.bmp,.tiff" onChange={handleFileDrop} className="hidden" />
          </label>
        </div>
      </div>

      {/* File selected + Preview */}
      {file && !scannedData && (
        <div className="bg-white rounded-2xl border border-dark-100/50 p-6 space-y-4 shadow-soft">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-gold-500" />
              <div>
                <p className="font-medium text-dark-900">{file.name}</p>
                <p className="text-xs text-dark-400">{(file.size / 1024).toFixed(1)} Ko • {file.type}</p>
              </div>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-5 py-2.5 bg-dark-900 text-white rounded-lg text-sm font-medium hover:bg-dark-800 transition-colors disabled:opacity-50"
            >
              {scanning ? (ocrMethod === 'ai-vision' ? 'Analyse IA...' : 'Analyse OCR...') : (ocrMethod === 'ai-vision' ? 'Extraire avec IA Vision' : 'Lancer l\'extraction OCR')}
            </button>
          </div>

          {/* Image preview */}
          {preview && (
            <div className="border border-dark-100 rounded-lg overflow-hidden bg-dark-50">
              <img src={preview} alt="Aperçu facture" className="max-h-64 mx-auto object-contain" />
            </div>
          )}

          {/* Progress bar */}
          {scanning && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-dark-600">{progressStatus}</span>
                <span className="font-mono text-gold-600 font-medium">{progress}%</span>
              </div>
              <div className="h-3 bg-dark-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }} 
                />
              </div>
              {ocrMethod === 'ai-vision' && (
                <p className="text-xs text-dark-400 mt-2">Le modèle Gemini analyse la structure de la facture...</p>
              )}
              {ocrMethod === 'tesseract' && progress < 10 && (
                <p className="text-xs text-dark-400 mt-2">Pré-traitement : niveaux de gris, contraste, binarisation, débruitage, netteté...</p>
              )}
              {ocrMethod === 'tesseract' && progress >= 10 && (
                <p className="text-xs text-dark-400 mt-2">Reconnaissance de texte français, allemand et anglais...</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {scanError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800">
            <p className="font-medium">{scanError}</p>
            {ocrMethod === 'ai-vision' && (
              <button 
                onClick={() => { setOcrMethod('tesseract'); setScanError(null); }}
                className="mt-2 text-xs underline text-red-700 hover:text-red-900"
              >
                Basculer vers Tesseract OCR →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scanned Data */}
      {scannedData && (
        <div className="bg-white rounded-2xl border border-dark-100/50 p-6 space-y-6 shadow-soft">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-500" />
              <h3 className="font-semibold text-dark-900">Données extraites</h3>
              {aiResult && (
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full ml-1">IA Vision</span>
              )}
              {ocrResult && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-1">Tesseract</span>
              )}
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">Modifiable</span>
            </div>
            {ocrResult && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-dark-500">
                  Confiance : <strong className={ocrResult.confidence > 70 ? 'text-emerald-600' : 'text-orange-600'}>
                    {ocrResult.confidence.toFixed(0)}%
                  </strong>
                </span>
                <button
                  onClick={() => setShowPreprocessed(!showPreprocessed)}
                  className="inline-flex items-center gap-1.5 text-xs text-dark-500 hover:text-dark-800 px-2 py-1 rounded border border-dark-200"
                >
                  <ImageIcon size={12} />
                  {showPreprocessed ? 'Masquer' : 'Image traitée'}
                </button>
                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className="inline-flex items-center gap-1.5 text-xs text-dark-500 hover:text-dark-800 px-2 py-1 rounded border border-dark-200"
                >
                  <Eye size={12} />
                  {showRawText ? 'Masquer' : 'Texte brut'}
                </button>
              </div>
            )}
          </div>

          {/* Preprocessed Image Preview */}
          {showPreprocessed && ocrResult?.preprocessedPreview && (
            <div className="border border-dark-200 rounded-lg overflow-hidden bg-dark-50 p-2">
              <p className="text-xs text-dark-500 font-medium mb-2 px-2">Image après pré-traitement (envoyée à l'OCR) :</p>
              <img src={ocrResult.preprocessedPreview} alt="Image pré-traitée" className="max-h-64 mx-auto object-contain rounded" />
            </div>
          )}

          {/* Raw OCR Text */}
          {showRawText && ocrResult && (
            <div className="bg-dark-50 border border-dark-200 rounded-lg p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-mono text-dark-700 whitespace-pre-wrap">{ocrResult.rawText}</p>
            </div>
          )}

          {/* Parsed fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Fournisseur', field: 'supplier', value: scannedData.supplier },
              { label: 'N° Facture', field: 'invoiceNumber', value: scannedData.invoiceNumber },
              { label: 'Date', field: 'date', value: scannedData.date },
              { label: 'Échéance', field: 'dueDate', value: scannedData.dueDate },
              { label: 'Montant HT', field: 'amountHT', value: scannedData.amountHT?.toString() },
              { label: 'TVA', field: 'tva', value: scannedData.tva?.toString() },
              { label: 'Montant TTC', field: 'amountTTC', value: scannedData.amountTTC?.toString() },
              { label: 'Devise', field: 'currency', value: scannedData.currency },
              { label: 'IBAN', field: 'iban', value: scannedData.iban },
              { label: 'Conditions', field: 'paymentTerms', value: scannedData.paymentTerms },
            ].map((item) => (
              <div key={item.field}>
                <label className="text-xs text-dark-500 font-medium">{item.label}</label>
                <input
                  type="text"
                  value={item.value || ''}
                  onChange={(e) => updateField(item.field as keyof Invoice, e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-dark-500 font-medium">Catégorie (détectée auto)</label>
              <select
                value={scannedData.category || ''}
                onChange={(e) => updateField('category', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              >
                {categories.filter(c => c.type === 'expense').map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saved}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saved ? '✓ Facture enregistrée' : 'Enregistrer la facture'}
            </button>
            {saved && (
              <p className="text-sm text-emerald-600 font-medium">Facture, fournisseur, dette et écriture comptable créés en statut “à valider” pour "{scannedData.category}"</p>
            )}
          </div>
        </div>
      )}

      {/* Pipeline explanation */}
      <div className="bg-white rounded-2xl border border-dark-100/50 p-6 shadow-soft">
        <h3 className="font-semibold text-dark-900 mb-3">
          {ocrMethod === 'ai-vision' ? 'Pipeline IA Vision' : 'Pipeline de traitement OCR'}
        </h3>
        {ocrMethod === 'ai-vision' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { step: '1', title: 'Upload', desc: 'Image originale', color: 'bg-dark-100 text-dark-700' },
              { step: '2', title: 'Encodage', desc: 'Base64 data URL', color: 'bg-violet-100 text-violet-700' },
              { step: '3', title: 'Gemini Vision', desc: 'Analyse structurée', color: 'bg-violet-200 text-violet-800' },
              { step: '4', title: 'Données JSON', desc: 'Extraction typée', color: 'bg-emerald-100 text-emerald-700' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className={`w-8 h-8 ${item.color} rounded-full flex items-center justify-center mx-auto font-bold text-xs`}>{item.step}</div>
                <p className="font-medium text-dark-900 mt-2 text-xs">{item.title}</p>
                <p className="text-[10px] text-dark-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { step: '1', title: 'Upload', desc: 'Image originale', color: 'bg-dark-100 text-dark-700' },
              { step: '2', title: 'Gris + Contraste', desc: 'Nettoyage couleur', color: 'bg-blue-100 text-blue-700' },
              { step: '3', title: 'Débruitage', desc: 'Filtre médian', color: 'bg-purple-100 text-purple-700' },
              { step: '4', title: 'Netteté', desc: 'Unsharp mask', color: 'bg-indigo-100 text-indigo-700' },
              { step: '5', title: 'Binarisation', desc: 'Seuil Otsu', color: 'bg-orange-100 text-orange-700' },
              { step: '6', title: 'OCR', desc: 'Tesseract.js', color: 'bg-emerald-100 text-emerald-700' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className={`w-8 h-8 ${item.color} rounded-full flex items-center justify-center mx-auto font-bold text-xs`}>{item.step}</div>
                <p className="font-medium text-dark-900 mt-2 text-xs">{item.title}</p>
                <p className="text-[10px] text-dark-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info notice */}
      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={16} className="text-gold-600 mt-0.5 shrink-0" />
          <div className="text-sm text-gold-800">
            {ocrMethod === 'ai-vision' ? (
              <>
                <p className="font-medium">IA Vision — Haute précision</p>
                <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
                  <li>Gemini 2.5 Flash analyse directement l'image sans pré-traitement</li>
                  <li>Extrait les montants, dates, IBAN et fournisseur en une seule passe</li>
                  <li>Fonctionne même avec des photos de mauvaise qualité ou en angle</li>
                  <li>Détecte automatiquement la langue et la devise</li>
                  <li>Nécessite une connexion internet</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium">Conseils pour une meilleure précision OCR</p>
                <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
                  <li>Utilisez une image nette avec bonne résolution (300 DPI recommandé)</li>
                  <li>Bonne luminosité, pas d'ombre sur le document</li>
                  <li>Texte imprimé (pas manuscrit) donne les meilleurs résultats</li>
                  <li>Ajustez le contraste et le seuil si le résultat est flou</li>
                  <li>Corrigez manuellement les champs si nécessaire</li>
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
