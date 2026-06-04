import { Shield, Users, Lock, Clock, Database, Bell } from 'lucide-react';
import { useStore } from '../store';

export default function Settings() {
  const { demoMode, setDemoMode } = useStore();

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Paramètres</h1>
        <p className="text-dark-400 text-sm mt-1.5 font-medium">Configuration de l'application</p>
      </div>


      <div className="bg-white rounded-2xl border border-dark-100/50 p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-dark-900">Mode démo</h3>
            <p className="text-sm text-dark-500 mt-1">Les pages de reporting excluent les écritures marquées comme démo tant que ce mode n’est pas activé explicitement.</p>
          </div>
          <button
            type="button"
            onClick={() => setDemoMode(!demoMode)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${demoMode ? 'bg-gold-500 text-white' : 'bg-dark-100 text-dark-700'}`}
          >
            {demoMode ? 'Démo activée' : 'Démo désactivée'}
          </button>
        </div>
      </div>

      {/* Restaurant Info */}
      <div className="bg-white rounded-2xl border border-dark-100/50 p-6 shadow-soft">
        <h3 className="font-semibold text-dark-900 mb-4">Informations du restaurant</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-dark-500 font-medium">Nom du restaurant</label>
            <input type="text" defaultValue="La Gazelle d'Or" className="w-full mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50" />
          </div>
          <div>
            <label className="text-xs text-dark-500 font-medium">Ville</label>
            <input type="text" defaultValue="Genève" className="w-full mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50" />
          </div>
          <div>
            <label className="text-xs text-dark-500 font-medium">IDE / Numéro TVA</label>
            <input type="text" defaultValue="CHE-123.456.789" className="w-full mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50" />
          </div>
          <div>
            <label className="text-xs text-dark-500 font-medium">Devise par défaut</label>
            <input type="text" defaultValue="CHF" className="w-full mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/50" />
          </div>
        </div>
      </div>

      {/* Bank Connection */}
      <div className="bg-white rounded-2xl border border-dark-100/50 p-6 shadow-soft">
        <h3 className="font-semibold text-dark-900 mb-4">Connexion bancaire</h3>
        <p className="text-sm text-dark-500 mb-4">Connectez votre compte bancaire pour importer automatiquement les transactions.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {['Open Banking (PSD2)', 'Bridge API', 'Salt Edge', 'Plaid'].map((provider) => (
            <button key={provider} className="px-4 py-3 border border-dark-200 rounded-lg text-sm text-dark-700 hover:bg-dark-50 transition-colors text-left">
              {provider}
              <span className="block text-xs text-dark-400 mt-0.5">Non connecté</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-dark-400 mt-4">Alternative : utilisez l'import CSV depuis la page Transactions.</p>
      </div>

      {/* Security */}
      <div className="bg-white rounded-2xl border border-dark-100/50 p-6 shadow-soft">
        <h3 className="font-semibold text-dark-900 mb-4">Sécurité & Accès</h3>
        <div className="space-y-4">
          {[
            { icon: Shield, label: 'Authentification à deux facteurs', status: 'Activé', active: true },
            { icon: Users, label: 'Rôles utilisateurs', status: '1 administrateur', active: true },
            { icon: Lock, label: 'Chiffrement des données', status: 'AES-256', active: true },
            { icon: Clock, label: 'Journal d\'activité', status: 'Actif', active: true },
            { icon: Database, label: 'Sauvegarde automatique', status: 'Quotidienne', active: true },
            { icon: Bell, label: 'Notifications', status: 'Email activé', active: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <item.icon size={18} className="text-dark-400" />
                <span className="text-sm text-dark-900">{item.label}</span>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">{item.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legal */}
      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4 text-sm text-gold-800">
        <p className="font-medium">Mentions légales</p>
        <p className="mt-1">Les données comptables générées par Gazelle Comptabilité sont des estimations. Elles doivent être vérifiées par une personne compétente (fiduciaire, expert-comptable) avant toute déclaration officielle auprès des autorités fiscales.</p>
      </div>
    </div>
  );
}
