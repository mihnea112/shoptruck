import { Suspense } from "react";
import CatalogClient from "./CatalogClient";

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Se incarca...</div>}>
      <CatalogClient />
    </Suspense>
  );
}
