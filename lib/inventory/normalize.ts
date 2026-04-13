const INGREDIENT_ALIASES: Record<string, string> = {
  tomatoes: "tomato",
  eggs: "egg",
  curd: "yogurt",
  cilantro: "coriander",
  "coriander leaves": "coriander",
  capsicum: "bell pepper",
  chillies: "chili",
  chilies: "chili",
};

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

export function normalizeIngredientName(name: string) {
  const trimmed = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const aliased = INGREDIENT_ALIASES[trimmed] ?? trimmed;
  const singularized = aliased
    .split(" ")
    .map((part) => singularizeWord(part))
    .join(" ");

  return INGREDIENT_ALIASES[singularized] ?? singularized;
}
