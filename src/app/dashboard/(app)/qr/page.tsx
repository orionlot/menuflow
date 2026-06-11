import { requireOwner } from "@/lib/auth";
import QrClient from "./QrClient";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const { restaurant } = await requireOwner();
  return <QrClient slug={restaurant.slug} nome={restaurant.nome} />;
}
