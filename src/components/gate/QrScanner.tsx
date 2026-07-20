import { useEffect, useRef, useState } from "react";
import QrScannerLib from "qr-scanner";
import { Button } from "@/components/ui/button";
import { t, getLang } from "@/lib/i18n/gate";

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lang = getLang();

  useEffect(() => () => { scannerRef.current?.stop(); scannerRef.current?.destroy(); }, []);

  async function start() {
    setErr(null);
    if (!videoRef.current) return;
    try {
      const s = new QrScannerLib(videoRef.current, (r) => {
        onResult(r.data);
      }, { highlightScanRegion: true, highlightCodeOutline: true });
      scannerRef.current = s;
      await s.start();
      setRunning(true);
    } catch (e: any) { setErr(e.message || "Camera unavailable"); }
  }
  function stop() { scannerRef.current?.stop(); setRunning(false); }

  return (
    <div className="space-y-2">
      <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-xl border border-border bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-center">
        {!running
          ? <Button onClick={start}>{t("start_camera", lang)}</Button>
          : <Button variant="outline" onClick={stop}>{t("stop_camera", lang)}</Button>}
      </div>
    </div>
  );
}
