"use client";

import { MealCard } from "@/components/planner/MealCard";
import { MealDetailsDrawer } from "@/components/planner/MealDetailsDrawer";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  PLANNED_MEAL_TYPES,
  PLANNER_WEEK_DAYS,
  type PlannedMeal,
  type PlannedMealType,
  type PlannerWeekDay,
} from "@/lib/planner/types";
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
import { XIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

type Slot = {
  id: string;
  day: PlannerWeekDay;
  mealType: PlannedMealType;
  meal?: PlannedMeal;
};

const GRID_LABEL_COLUMN_WIDTH = "7rem";
const GRID_DAY_COLUMN_WIDTH = "minmax(12rem,1fr)";
const GRID_MIN_WIDTH = "min-w-[calc(7rem+7*12rem)]";

function formatMealLabel(mealType: PlannedMealType) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

function toSlotId(day: string, mealType: string) {
  return `${day}::${mealType}`;
}

function isPlannerMealType(value: unknown): value is PlannedMealType {
  return value === "breakfast" || value === "lunch" || value === "dinner";
}

function slotForMeal(meals: PlannedMeal[]) {
  return new Map(
    meals.map((meal) => [toSlotId(meal.day, meal.mealType), meal]),
  );
}

export function WeeklyPlanList({
  meals,
  visibleMealTypes = PLANNED_MEAL_TYPES,
  selectedMealId,
  onSelectMeal,
  onSetMealCooked,
  onMoveMealSlot,
  onSwapMeal,
  onDeselectMeal,
}: {
  meals: PlannedMeal[];
  visibleMealTypes?: readonly PlannedMealType[];
  selectedMealId?: string;
  onSelectMeal: (mealId: string) => void;
  onSetMealCooked: (mealId: string, cooked: boolean) => void;
  onMoveMealSlot: (
    mealId: string,
    day: string,
    mealType: PlannedMeal["mealType"],
  ) => void;
  onSwapMeal: (mealId: string) => void;
  onDeselectMeal: () => void;
}) {
  const [activeMealId, setActiveMealId] = useState<string>();
  const selectedMeal = meals.find((meal) => meal.id === selectedMealId);
  const activeMeal = meals.find((meal) => meal.id === activeMealId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const mealsBySlot = useMemo(() => slotForMeal(meals), [meals]);
  const slotsByRow = useMemo(
    () =>
      visibleMealTypes.map((mealType) => ({
        mealType,
        slots: PLANNER_WEEK_DAYS.map((day) => ({
          id: toSlotId(day, mealType),
          day,
          mealType,
          meal: mealsBySlot.get(toSlotId(day, mealType)),
        })),
      })),
    [mealsBySlot, visibleMealTypes],
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
      overData?.type !== "slot" ||
      !isPlannerMealType(overData.mealType) ||
      !visibleMealTypes.includes(overData.mealType) ||
      typeof overData.day !== "string"
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
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full w-full min-h-0 flex-col rounded-xl border bg-muted/20 p-3">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card shadow-sm">
            <div
              className={`grid ${GRID_MIN_WIDTH}`}
              style={{
                gridTemplateColumns: `${GRID_LABEL_COLUMN_WIDTH} repeat(${PLANNER_WEEK_DAYS.length}, ${GRID_DAY_COLUMN_WIDTH})`,
              }}
            >
              <div className="sticky top-0 left-0 z-30 border-r border-b bg-card/95 px-3 py-3 backdrop-blur">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Meal
                </span>
              </div>
              {PLANNER_WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="sticky top-0 z-20 border-r border-b bg-card/95 px-3 py-3 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground last:border-r-0 backdrop-blur"
                >
                  {day}
                </div>
              ))}

              {slotsByRow.map(({ mealType, slots }) => (
                <Fragment key={mealType}>
                  <div className="sticky left-0 z-10 flex border-r border-b bg-card/95 px-3 py-4 backdrop-blur last:border-b-0">
                    <span className="text-sm font-semibold text-foreground">
                      {formatMealLabel(mealType)}
                    </span>
                  </div>
                  {slots.map((slot) => (
                    <MealSlot
                      key={slot.id}
                      slot={slot}
                      selectedMealId={selectedMealId}
                      onSelectMeal={onSelectMeal}
                      onSwapMeal={onSwapMeal}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeMeal ? (
            <div className="w-40 md:w-auto md:min-w-48">
              <MealCard
                meal={activeMeal}
                isSelected={false}
                isDragging
                onSelect={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Drawer
        direction="left"
        open={Boolean(selectedMealId)}
        onOpenChange={(open) => {
          if (!open) onDeselectMeal();
        }}
      >
        <DrawerContent>
          <DrawerClose
            aria-label="Close recipe details"
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DrawerClose>
          <DrawerHeader className="pr-12">
            <DrawerTitle>Recipe details</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <MealDetailsDrawer
              meal={selectedMeal}
              onSetCooked={
                selectedMeal
                  ? (cooked) => onSetMealCooked(selectedMeal.id, cooked)
                  : undefined
              }
              onSwap={selectedMeal ? () => onSwapMeal(selectedMeal.id) : undefined}
            />
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
  onSwapMeal,
}: {
  slot: Slot;
  selectedMealId?: string;
  onSelectMeal: (mealId: string) => void;
  onSwapMeal: (mealId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { type: "slot", day: slot.day, mealType: slot.mealType },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-36 border-r border-b p-2 transition-colors last:border-r-0 ${isOver ? "bg-muted/60" : "bg-muted/10"}`}
    >
      {slot.meal ? (
        <DraggableMealCard
          meal={slot.meal}
          isSelected={slot.meal.id === selectedMealId}
          onSelectMeal={onSelectMeal}
          onSwapMeal={onSwapMeal}
        />
      ) : (
        <div
          className={`flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground ${isOver ? "bg-muted" : "bg-background/50"}`}
        >
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
  onSwapMeal,
}: {
  meal: PlannedMeal;
  isSelected: boolean;
  onSelectMeal: (mealId: string) => void;
  onSwapMeal: (mealId: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } =
    useDraggable({
      id: `meal-${meal.id}`,
      data: {
        type: "meal",
        mealId: meal.id,
        mealType: meal.mealType,
        day: meal.day,
      },
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
        onSwap={() => onSwapMeal(meal.id)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
