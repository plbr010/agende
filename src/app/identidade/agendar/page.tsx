import type { Metadata } from "next";
import { BookingAuthPreview } from "./preview";

export const metadata: Metadata = {
  title: "Prévia da confirmação",
  robots: { index: false, follow: false },
};

export default function BookingAuthPreviewPage() {
  return <BookingAuthPreview />;
}
