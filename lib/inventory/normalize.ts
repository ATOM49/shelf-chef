const INGREDIENT_ALIASES: Record<string, string> = {
  tomatoes: "tomato",
  eggs: "egg",
  curd: "yogurt",
  cilantro: "coriander",
  "coriander leaves": "coriander",
  capsicum: "bell pepper",
  chillies: "chili",
  chilies: "chili",
  chilli: "chili",
};

/**
 * Words that describe the *state* of an ingredient (how it is prepared, cut, or
 * presented) rather than its identity. They are stripped during normalization
 * so preparation-laden names collapse to the same base item and de-duplicate
 * against inventory — e.g. "tomato, chopped", "fresh mint leaves", and
 * "finely diced onion" become "tomato", "mint", and "onion".
 *
 * Variety/quality words that change what the item *is* (e.g. "green", "red",
 * "whole", "wheat") are intentionally NOT included.
 */
const PREP_DESCRIPTORS: ReadonlySet<string> = new Set([
  // freshness / size
  "fresh",
  "freshly",
  "frozen",
  "ripe",
  "raw",
  "large",
  "small",
  "medium",
  // cut / preparation state
  "chopped",
  "diced",
  "sliced",
  "minced",
  "grated",
  "shredded",
  "crushed",
  "ground",
  "mashed",
  "cubed",
  "julienned",
  "slit",
  "halved",
  "quartered",
  "peeled",
  "deseeded",
  "seeded",
  "deveined",
  "trimmed",
  "cooked",
  "boiled",
  "steamed",
  "roasted",
  "toasted",
  "softened",
  "melted",
  "beaten",
  "whisked",
  "drained",
  "rinsed",
  "washed",
  "soaked",
  // manner adverbs
  "finely",
  "roughly",
  "thinly",
  "thickly",
  "coarsely",
  "lightly",
  // herb form
  "leaves",
  "leaf",
]);

const SINGULAR_EXCEPTIONS = new Set(["series", "species"]);

function singularizeWord(word: string) {
  if (SINGULAR_EXCEPTIONS.has(word)) {
    return word;
  }

  if (word.endsWith("ies") && word.length > 3) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith("oes") && word.length > 3) {
    return word.slice(0, -2);
  }

  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 2) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Strip comma clauses and parenthetical notes, leaving only the leading base
 * phrase: "tomato, chopped" -> "tomato", "onion (finely diced)" -> "onion".
 */
function stripPreparationClauses(value: string) {
  return value
    .split(",")[0]
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIngredientName(name: string) {
  const trimmed = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const base = stripPreparationClauses(trimmed);
  if (!base) return "";

  // Full-phrase alias (e.g. "coriander leaves" -> "coriander") before per-word
  // stripping so multi-word aliases keep working.
  const aliasedBase = INGREDIENT_ALIASES[base] ?? base;

  const words = aliasedBase.split(" ").filter(Boolean);
  const kept = words.filter((word) => !PREP_DESCRIPTORS.has(word));
  // If every word was a descriptor (e.g. just "fresh"), keep the original words
  // rather than returning an empty name.
  const meaningful = kept.length > 0 ? kept : words;

  const canonical = meaningful
    .map((word) => {
      const singular = singularizeWord(word);
      return INGREDIENT_ALIASES[singular] ?? singular;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return INGREDIENT_ALIASES[canonical] ?? canonical;
}

/**
 * Clean an ingredient's user-facing display name so it reads as a standard
 * item: drops comma/parenthetical preparation clauses and the same
 * preparation/freshness descriptors as {@link normalizeIngredientName}, while
 * preserving the original casing and word order of the remaining words.
 *
 * "Tomato, chopped" -> "Tomato", "Fresh mint leaves" -> "mint",
 * "Green chilli, slit" -> "Green chilli".
 */
export function cleanIngredientDisplayName(name: string) {
  const collapsed = name.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";

  const base = stripPreparationClauses(collapsed);
  if (!base) return collapsed;

  const words = base.split(" ").filter(Boolean);
  const kept = words.filter((word) => !PREP_DESCRIPTORS.has(word.toLowerCase()));
  const result = (kept.length > 0 ? kept : words).join(" ").trim();

  return result || collapsed;
}
