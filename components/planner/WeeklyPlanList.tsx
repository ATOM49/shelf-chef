"use client";

import { MealCard } from "@/components/planner/MealCard";
import { MealDetailsDrawer } from "@/components/planner/MealDetailsDrawer";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { PlannedMeal } from "@/lib/planner/types";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
type PlannerMealType = (typeof MEAL_TYPES)[number];

type Slot = {
  id: string;
  day: string;
  mealType: PlannerMealType;
  meal?: PlannedMeal;
};

function toSlotId(day: string, mealType: string) {
  return `${day}::${mealType}`;
}

function isPlannerMealType(value: unknown): value is PlannerMealType {
  return value === "breakfast" || value === "lunch" || value === "dinner";
}

function slotForMeal(meals: PlannedMeal[]) {
  return new Map(meals.map((meal) => [toSlotId(meal.day, meal.mealType), meal]));
}

export function WeeklyPlanList({
  meals,
  selectedMealId,
  onSelectMeal,
  onSetMealCooked,
  onMoveMealSlot,
  onDeselectMeal,
}: {
  meals: PlannedMeal[];
  selectedMealId?: string;
  onSelectMeal: (mealId: string) => void;
  onSetMealCooked: (mealId: string, cooked: boolean) => void;
  onMoveMealSlot: (mealId: string, day: string, mealType: PlannedMeal["mealType"]) => void;
  onDeselectMeal: () => void;
}) {
  const [activeMealId, setActiveMealId] = useState<string>();
  const selectedMeal = meals.find((meal) => meal.id === selectedMealId);
  const activeMeal = meals.find((meal) => meal.id === activeMealId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mealsBySlot = useMemo(() => slotForMeal(meals), [meals]);
  const slots = useMemo<Slot[]>(
    () =>
      WEEK_DAYS.flatMap((day) =>
        MEAL_TYPES.map((mealType) => ({
          id: toSlotId(day, mealType),
          day,
          mealType,
          meal: mealsBySlot.get(toSlotId(day, mealType)),
        })),
      ),
    [mealsBySlot],
  );

  function handleDragStart(event: DragStartEvent) {
    const mealId = event.active.data.current?.mealId;
    if (typeof mealId === "string") {
      setActiveMealId(mealId);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveMealId(undefined);
    const activeData = event.active.data.current;
    const overData = event.over?.data.current;

    if (
      activeData?.type !== "meal" ||
      typeof activeData.mealId !== "string" ||
      !isPlannerMealType(activeData.mealType) ||
      overData?.type !== "slot" ||
      !isPlannerMealType(overData.mealType) ||
      typeof overData.day !== "string" ||
      activeData.mealType !== overData.mealType
    ) {
      return;
    }

    onMoveMealSlot(activeData.mealId, overData.day, overData.mealType);
  }

  if (meals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Generate a plan to see meals and inventory validation.
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="mb-2 text-xs text-muted-foreground">Drag meals across days within the same row</div>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max snap-x snap-mandatory divide-x divide-border/50 overflow-hidden rounded-lg border bg-card">
              {WEEK_DAYS.map((day) => {
                const daySlots = slots.filter((slot) => slot.day === day);

                return (
                  <div key={day} className="w-48 shrink-0 snap-start p-3 md:min-w-0 md:flex-1">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {day}
                    </div>
                    <div className="mt-3 divide-y divide-border/40 rounded-md border border-border/40 bg-muted/10">
                      {daySlots.map((slot) => (
                        <MealSlot
                          key={slot.id}
                          slot={slot}
                          selectedMealId={selectedMealId}
                          onSelectMeal={onSelectMeal}
                          onSetMealCooked={onSetMealCooked}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeMeal ? (
            <div className="w-40 md:w-auto md:min-w-[12rem]">
              <MealCard
                meal={activeMeal}
                isSelected={false}
                isDragging
                onSelect={() => {}}
                onSetCooked={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Drawer
        open={Boolean(selectedMealId)}
        onOpenChange={(open) => { if (!open) onDeselectMeal(); }}
      >
        <DrawerContent side="right" showCloseButton>
          <DrawerHeader>
            <DrawerTitle>Recipe details</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <MealDetailsDrawer meal={selectedMeal} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function MealSlot({
  slot,
  selectedMealId,
  onSelectMeal,
  onSetMealCooked,
}: {
  slot: Slot;
  selectedMealId?: string;
  onSelectMeal: (mealId: string) => void;
  onSetMealCooked: (mealId: string, cooked: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { type: "slot", day: slot.day, mealType: slot.mealType },
  });

  return (
    <div
      ref={setNodeRef}
      className={`grid gap-1.5 p-2 transition-colors ${isOver ? "bg-muted/60" : ""}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {slot.mealType}
      </div>
      {slot.meal ? (
        <DraggableMealCard
          meal={slot.meal}
          isSelected={slot.meal.id === selectedMealId}
          onSelectMeal={onSelectMeal}
          onSetMealCooked={onSetMealCooked}
        />
      ) : (
        <div className={`rounded-lg border border-dashed p-3 text-xs text-muted-foreground ${isOver ? "bg-muted" : ""}`}>
          Drop meal here
        </div>
      )}
    </div>
  );
}

function DraggableMealCard({
  meal,
  isSelected,
  onSelectMeal,
  onSetMealCooked,
}: {
  meal: PlannedMeal;
  isSelected: boolean;
  onSelectMeal: (mealId: string) => void;
  onSetMealCooked: (mealId: string, cooked: boolean) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `meal-${meal.id}`,
    data: { type: "meal", mealId: meal.id, mealType: meal.mealType, day: meal.day },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
      }}
    >
      <MealCard
        meal={meal}
        isSelected={isSelected}
        isDragging={isDragging}
        onSelect={() => onSelectMeal(meal.id)}
        onSetCooked={(cooked) => onSetMealCooked(meal.id, cooked)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
