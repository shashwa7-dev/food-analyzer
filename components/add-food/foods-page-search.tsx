"use client";
import { useRouter } from "next/navigation";
import { FoodSearch } from "@/components/add-food/food-search";

export function FoodsPageSearch() {
  const router = useRouter();
  return <FoodSearch onPick={(hit) => router.push(`/foods/${hit.id}`)} />;
}
