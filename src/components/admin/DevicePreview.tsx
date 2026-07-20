import { useState, type ReactNode } from "react";
import { Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

type Device = "mobile" | "desktop";

export function DevicePreview({
  children,
  initial = "desktop",
  className = "",
}: {
  children: (device: Device) => ReactNode;
  initial?: Device;
  className?: string;
}) {
  const [device, setDevice] = useState<Device>(initial);
  const width = device === "mobile" ? 390 : 900;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-center gap-1 rounded-md border border-border bg-muted/40 p-1 w-fit mx-auto">
        <Button
          size="sm"
          variant={device === "mobile" ? "default" : "ghost"}
          onClick={() => setDevice("mobile")}
          className="h-7 px-2"
        >
          <Smartphone className="mr-1 h-3.5 w-3.5" /> Mobile
        </Button>
        <Button
          size="sm"
          variant={device === "desktop" ? "default" : "ghost"}
          onClick={() => setDevice("desktop")}
          className="h-7 px-2"
        >
          <Monitor className="mr-1 h-3.5 w-3.5" /> Desktop
        </Button>
      </div>
      <div className="flex justify-center">
        <div
          className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden transition-all"
          style={{ width, maxWidth: "100%" }}
        >
          {children(device)}
        </div>
      </div>
    </div>
  );
}
