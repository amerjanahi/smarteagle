import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CurrencyInfo = { code: string; symbol: string; decimals: number };

const DEFAULT: CurrencyInfo = { code: "AED", symbol: "AED", decimals: 2 };

export function useCurrency() {
  const { data } = useQuery({
    queryKey: ["active-currency"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CurrencyInfo> => {
      const { data: cs } = await (supabase.from("company_settings" as any).select("default_currency").maybeSingle() as any);
      const code = cs?.default_currency ?? "AED";
      const { data: cur } = await (supabase.from("currencies" as any).select("code, symbol, decimals").eq("code", code).maybeSingle() as any);
      if (!cur) return { ...DEFAULT, code };
      return { code: cur.code, symbol: cur.symbol ?? cur.code, decimals: cur.decimals ?? 2 };
    },
  });
  const c = data ?? DEFAULT;
  const format = (n: number | string | null | undefined) =>
    `${c.symbol} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}`;
  return { ...c, format };
}
