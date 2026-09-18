import { BrandLogo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="agende-bloom flex min-h-full flex-col px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <BrandLogo className="mb-8 block" />
        {children}
      </div>
    </div>
  );
}
