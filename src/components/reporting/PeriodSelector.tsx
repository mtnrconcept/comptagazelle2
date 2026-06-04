import { Period } from '../../types';
import { formatPeriod, periodFromMonthValue, periodToMonthValue } from '../../utils/accounting';

interface PeriodSelectorProps {
  period: Period;
  onChange: (period: Period) => void;
  label?: string;
}

export default function PeriodSelector({ period, onChange, label = 'Période' }: PeriodSelectorProps) {
  return (
    <label className="inline-flex flex-col gap-1 text-sm text-dark-500">
      <span className="font-semibold">{label}</span>
      <input
        type="month"
        value={periodToMonthValue(period)}
        onChange={(event) => onChange(periodFromMonthValue(event.target.value))}
        className="rounded-xl border border-dark-200 bg-white px-3 py-2 text-dark-900 shadow-soft focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400"
        aria-label={label}
      />
      <span className="text-xs text-dark-400">{formatPeriod(period)}</span>
    </label>
  );
}
