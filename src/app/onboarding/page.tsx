import type { Metadata } from "next";
import { appOrigin } from "@/lib/origin";
import OnboardingClient from "./OnboardingClient";

export const metadata: Metadata = {
  title: "MenuFlow — Attiva il tuo menu digitale",
  description: "Crea il menu digitale del tuo locale e ricevi ordini al tavolo in pochi minuti.",
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const origin = await appOrigin();
  return <OnboardingClient origin={origin} />;
}
