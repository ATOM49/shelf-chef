"use client";

import { ItemCard } from "@/components/entities/ItemCard";
import { formatItemQuantity } from "@/components/entities/item-status";
import type { IngredientMatch, RecipeIngredient } from "@/lib/planner/types";

function buildAvailabilityDetail(match: IngredientMatch) {
  if (match.status === "staple") {
    return "assumed available · kitchen staple";
  }

  const recipeMeasurement = `${match.neededQuantity} ${match.neededUnit}`;
  const resolvedMeasurement = `${match.resolvedNeededQuantity} ${match.resolvedNeededUnit}`;
  const availability = `${match.availableQuantity} ${match.availableUnit}`;

  if (match.measurementSource === "inventory") {
    const approximation = match.usesHeuristic ? " approx." : "";
    if (match.resolvedNeededUnit !== match.neededUnit || match.usesHeuristic) {
      return `available ${availability} · compare ${resolvedMeasurement}${approximation} (recipe ${recipeMeasurement})`;
    }

    return `available ${availability}`;
  }

  if (match.availableUnit === "unknown") {
    return `recipe ${recipeMeasurement}`;
  }

  const approximation = match.usesHeuristic ? " approx." : "";
  return `available ${availability} · canonical ${resolvedMeasurement}${approximation}`;
}

export function RecipeIngredientList({
  ingredients,
  matches,
}: {
  ingredients: RecipeIngredient[];
  matches: IngredientMatch[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {ingredients.map((ingredient) => {
        const match = matches.find(
          (candidate) => candidate.normalizedName === ingredient.normalizedName,
        );

        return (
          <ItemCard
            key={`${ingredient.normalizedName}-${ingredient.unit}`}
            name={ingredient.name}
            emoji={match?.emoji ?? ingredient.emoji}
            quantityLabel={formatItemQuantity(ingredient.quantity, ingredient.unit)}
            optional={ingredient.optional}
            detail={match ? buildAvailabilityDetail(match) : undefined}
            status={match?.status}
          />
        );
      })}
    </div>
  );
}
