import type { Metadata } from "next";
import { AppSidebar } from "@/components/ops/app-sidebar";
import { OpsProvider } from "@/components/ops/ops-provider";
import { SiteHeader } from "@/components/ops/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stashh Ops", template: "%s · Stashh Ops" },
  description: "Stashh sisteminin canlı durumu: kuyruk, süreler, cache, hatalar, DM trafiği.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <OpsProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />
              {/* min-w-0: a wide table scrolls inside its card instead of widening the page. */}
              <SidebarInset className="min-w-0">
                <SiteHeader />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">{children}</main>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </OpsProvider>
      </body>
    </html>
  );
}
