"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type PreferencesFormProps = {
  preferences: string;
  onChange: (preferences: string) => void;
  onGeneratePlan: () => void;
};

export function PreferencesForm({ preferences, onChange, onGeneratePlan }: PreferencesFormProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
        <p className="text-xs text-muted-foreground">Describe your diet, goals, or items to use up.</p>
      </div>
      <Textarea
        rows={4}
        placeholder="High protein, Indian, use spinach soon, avoid mushrooms"
        value={preferences}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        type="button"
        onClick={onGeneratePlan}
      >
        Generate 7-day plan
      </Button>
    </div>
  );
}
