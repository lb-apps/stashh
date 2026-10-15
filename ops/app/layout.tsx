import type { Metadata } from "next";
import { AppSidebar } from "@/components/ops/app-sidebar";
import { OpsProvider } from "@/components/ops/ops-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stashh Ops", template: "%s · Stashh Ops" },
  description: "Live state of the Stashh system: queue, durations, cache, failures, DM traffic.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <OpsProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />
              {/* min-w-0: a wide table scrolls inside its card instead of widening the page. */}
              <SidebarInset className="min-w-0">
                <main className="flex flex-1 flex-col gap-5 px-4 pt-5 pb-10 md:px-8 md:pt-7 lg:gap-6">{children}</main>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </OpsProvider>
      </body>
    </html>
  );
}
