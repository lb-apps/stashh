export interface MenuPlatform {
  name: string;
  domains: string[];
  pathPattern?: RegExp;
}

export const KNOWN_PLATFORMS: MenuPlatform[] = [
  { name: "menulux", domains: ["menulux.com", "menulux.com.tr"] },
  { name: "qrmenu", domains: ["qrmenu.com", "qrmenu.com.tr"] },
  { name: "menudigital", domains: ["menudigital.com", "menudigital.com.tr"] },
  { name: "imenu", domains: ["imenu.com.tr"] },
  { name: "getir", domains: ["getir.com"], pathPattern: /^\/(restaurant|yemek)\// },
  { name: "yemeksepeti", domains: ["yemeksepeti.com"], pathPattern: /^\/(restaurant|menu)\// },
  { name: "trendyol", domains: ["trendyol.com"], pathPattern: /^\/yemek\// },
  { name: "ikas", domains: ["ikas.com", "myikas.com"] },
  { name: "biqmenu", domains: ["biqmenu.com"] },
  { name: "finedinemenu", domains: ["finedinemenu.com"] },
  { name: "emenu", domains: ["emenu.com.tr"] },
  { name: "paycell", domains: ["qr.paycell.com.tr"] },
  { name: "karekod", domains: ["karekodrestaurantmenu.com"], pathPattern: /^\/menu\// },
];

const MENU_LINK_PATTERNS = [
  /\bmenu\b/i,
  /\bmenü\b/i,
  /\bfiyat\b/i,
  /\bprice/i,
  /\byemek\b/i,
  /\bfood\b/i,
  /\bdrink/i,
  /\bcocktail/i,
  /\bkokteyl/i,
  /\bhizmet/i,
  /\bservice/i,
  /\btarife/i,
];

export function isKnownMenuPlatform(url: string): MenuPlatform | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    for (const platform of KNOWN_PLATFORMS) {
      if (platform.domains.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
        if (platform.pathPattern && !platform.pathPattern.test(parsed.pathname)) continue;
        return platform;
      }
    }
  } catch {
    // invalid URL
  }
  return null;
}

export function isMenuRelatedLink(text: string, href: string): boolean {
  const combined = `${text} ${href}`.toLowerCase();
  return MENU_LINK_PATTERNS.some((p) => p.test(combined));
}

export function isMenuRelatedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return (
      path.includes("menu") ||
      path.includes("menü") ||
      path.includes("fiyat") ||
      path.includes("price") ||
      path.endsWith(".pdf")
    );
  } catch {
    return false;
  }
}
