import { Metadata } from "next";
import PromotionsPageUI from "./ui";

export const metadata: Metadata = {
  title: "Promotii - ShopTruck",
  description: "Urmareste ofertele speciale si reducerile la ShopTruck",
};

export default function PromotionsPage() {
  return <PromotionsPageUI />;
}
