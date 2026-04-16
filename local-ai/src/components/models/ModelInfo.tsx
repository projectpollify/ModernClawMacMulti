import type { Model } from '@/services/engine';

interface ModelInfoProps {
  model: Model;
}

export function ModelInfo({ model }: ModelInfoProps) {
  return (
    <div className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
      <div className="grid gap-2 sm:grid-cols-2">
        <InfoRow label="Family" value={model.details.family || 'Unknown'} />
        <InfoRow label="Format" value={model.details.format || 'Unknown'} />
        <InfoRow label="Parameters" value={model.details.parameter_size || 'Unknown'} />
        <InfoRow label="Quantization" value={model.details.quantization_level || 'Unknown'} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}
