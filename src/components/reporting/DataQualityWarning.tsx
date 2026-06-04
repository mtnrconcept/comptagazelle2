import { ReportDataQuality } from '../../types';

interface DataQualityWarningProps {
  quality: ReportDataQuality;
}

export default function DataQualityWarning({ quality }: DataQualityWarningProps) {
  if (quality.complete) return null;

  return (
    <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
      <p className="font-semibold">⚠️ Données comptables incomplètes ou non validées</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {quality.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}
