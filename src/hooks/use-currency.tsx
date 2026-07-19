import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CurrencyInfo = { code: string; symbol: string; decimals: number };

const STORAGE_KEY = "hayy-display-currency";
const DEFAULT: CurrencyInfo = { code: "BHD", symbol: "BHD", decimals: 3 };

export function persistCurrency(currency: CurrencyInfo) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currency));
}

function storedCurrency(): CurrencyInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return value?.code && Number.isInteger(value?.decimals) ? value : null;
  } catch {
    return null;
  }
}

export function useCurrency() {
  const { data } = useQuery({
    queryKey: ["active-currency"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CurrencyInfo> => {
      const saved = storedCurrency();
      const { data: settings, error: settingsError } = await (supabase
        .from("company_settings" as any)
        .select("default_currency")
        .maybeSingle() as any);
      const code = settings?.default_currency ?? saved?.code ?? DEFAULT.code;

      if (settingsError && saved) return saved;

      const { data: currency, error: currencyError } = await (supabase
        .from("currencies" as any)
        .select("code, decimals")
        .eq("code", code)
        .maybeSingle() as any);
      if (currencyError && saved?.code === code) return saved;

      const resolved = {
        code,
        symbol: code,
        decimals: currency?.decimals ?? saved?.decimals ?? (code === "BHD" || code === "KWD" ? 3 : 2),
      };
      persistCurrency(resolved);
      return resolved;
    },
  });
  const c = data ?? DEFAULT;
  const format = (n: number | string | null | undefined) =>
    `${c.symbol} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}`;
  return { ...c, format };
}
