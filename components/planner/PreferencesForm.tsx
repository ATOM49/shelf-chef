"use client";

type PreferencesFormProps = {
  preferences: string;
  onChange: (preferences: string) => void;
  onGeneratePlan: () => void;
};

export function PreferencesForm({ preferences, onChange, onGeneratePlan }: PreferencesFormProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-800">Preferences</h3>
        <p className="text-xs text-zinc-500">Dinner-only MVP using local recipes and current fridge inventory.</p>
      </div>
      <textarea
        rows={4}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="High protein, Indian dinners, use spinach soon, avoid mushrooms"
        value={preferences}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        onClick={onGeneratePlan}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Generate 7-day dinner plan
      </button>
    </div>
  );
}
