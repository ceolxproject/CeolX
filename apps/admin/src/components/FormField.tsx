import { Input } from '@CeolX/ui/components/input';
import { Label } from '@CeolX/ui/components/label';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  id?: string;
}

export function FormField({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  id,
}: FormFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error !== undefined}
        className={error ? 'border-destructive' : undefined}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
