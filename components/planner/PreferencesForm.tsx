"use client";

import { Textarea } from "@/components/ui/textarea";

type PreferencesFormProps = {
  preferences: string;
  onChange: (preferences: string) => void;
  disabled?: boolean;
};

export function PreferencesForm({
  preferences,
  onChange,
  disabled = false,
}: PreferencesFormProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
        <p className="text-xs text-muted-foreground">
          Describe your diet, goals, or items to use up. Save these settings, then create or recreate a weekly plan from the planner header.
        </p>
      </div>
      <Textarea
        rows={4}
        disabled={disabled}
        placeholder="High protein, Indian, use spinach soon, avoid mushrooms"
        value={preferences}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
