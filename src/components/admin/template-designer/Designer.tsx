import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CanvasDoc, CanvasElement, TplType } from "./types";
import { pageSize, PT_TO_PX } from "./types";
import { CanvasPage, renderElement } from "./CanvasPage";
import { newElement, newId } from "./factory";
import { MERGE_FIELDS, resolveMergeTokens } from "./mergeFields";
import { useHistory } from "./useHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Type, Hash, ImageIcon, Square, Minus, Table, Calculator, CreditCard, Image as LogoIcon,
  Undo2, Redo2, Copy, Trash2, ChevronsUp, ChevronsDown, Grid3x3, Ruler, Eye, Printer, ZoomIn, ZoomOut,
  RotateCcw, Upload, Loader2,
} from "lucide-react";

type Props = {
  value: CanvasDoc;
  type: TplType;
  logoUrl?: string;
  onChange: (doc: CanvasDoc) => void;
  onPreview: () => void;
  onPrint: () => void;
};

const PALETTE: { type: CanvasElement["type"]; label: string; icon: any }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "field", label: "Field", icon: Hash },
  { type: "logo", label: "Logo", icon: LogoIcon },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "line", label: "Line", icon: Minus },
  { type: "rect", label: "Rectangle", icon: Square },
  { type: "table", label: "Table", icon: Table },
  { type: "totals", label: "Totals", icon: Calculator },
  { type: "payment", label: "Payment", icon: CreditCard },
];

export function Designer({ value, type, logoUrl, onChange, onPreview, onPrint }: Props) {
  const { state: doc, set: setDoc, undo, redo } = useHistory<CanvasDoc>(value);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [snap, setSnap] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { onChange(doc); /* eslint-disable-next-line */ }, [doc]);
  useEffect(() => { setDoc(value, false); /* eslint-disable-next-line */ }, [value]);

  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;
  const { w: pageW, h: pageH } = pageSize(doc);

  const updateElement = useCallback((id: string, patch: Partial<CanvasElement>, record = true) => {
    setDoc((d) => ({ ...d, elements: d.elements.map((el) => (el.id === id ? { ...el, ...patch, style: { ...el.style, ...(patch.style ?? {}) } } : el)) }), record);
  }, [setDoc]);

  const addElement = useCallback((type: CanvasElement["type"]) => {
    const el = newElement(type);
    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }, [setDoc]);

  const deleteElement = useCallback((id: string) => {
    setDoc((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  }, [setDoc]);

  const duplicateElement = useCallback((id: string) => {
    const el = doc.elements.find((e) => e.id === id);
    if (!el) return;
    const clone: CanvasElement = { ...el, id: newId(), x: el.x + 12, y: el.y + 12 };
    setDoc((d) => ({ ...d, elements: [...d.elements, clone] }));
    setSelectedId(clone.id);
  }, [doc.elements, setDoc]);

  const moveLayer = useCallback((id: string, dir: 1 | -1) => {
    setDoc((d) => {
      const idx = d.elements.findIndex((e) => e.id === id);
      if (idx < 0) return d;
      const next = [...d.elements];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return d;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...d, elements: next };
    });
  }, [setDoc]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteElement(selected.id); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateElement(selected.id); return; }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") { e.preventDefault(); updateElement(selected.id, { x: selected.x - step }); }
      if (e.key === "ArrowRight") { e.preventDefault(); updateElement(selected.id, { x: selected.x + step }); }
      if (e.key === "ArrowUp") { e.preventDefault(); updateElement(selected.id, { y: selected.y - step }); }
      if (e.key === "ArrowDown") { e.preventDefault(); updateElement(selected.id, { y: selected.y + step }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, deleteElement, duplicateElement, updateElement]);

  const snapVal = useCallback((v: number) => (snap ? Math.round(v / doc.page.grid) * doc.page.grid : Math.round(v)), [snap, doc.page.grid]);

  // Drag handling
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; mode: "move" | "resize"; handle?: string; origW: number; origH: number } | null>(null);

  const onPointerDownElement = (e: React.PointerEvent, el: CanvasElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.w, origH: el.h, mode: "move" };
  };

  const onPointerDownHandle = (e: React.PointerEvent, el: CanvasElement, handle: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.w, origH: el.h, mode: "resize", handle };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dxPt = (e.clientX - d.startX) / (PT_TO_PX * zoom);
    const dyPt = (e.clientY - d.startY) / (PT_TO_PX * zoom);
    if (d.mode === "move") {
      updateElement(d.id, { x: snapVal(d.origX + dxPt), y: snapVal(d.origY + dyPt) }, false);
    } else {
      const h = d.handle || "";
      let nx = d.origX, ny = d.origY, nw = d.origW, nh = d.origH;
      if (h.includes("e")) nw = Math.max(10, d.origW + dxPt);
      if (h.includes("s")) nh = Math.max(6, d.origH + dyPt);
      if (h.includes("w")) { nx = d.origX + dxPt; nw = Math.max(10, d.origW - dxPt); }
      if (h.includes("n")) { ny = d.origY + dyPt; nh = Math.max(6, d.origH - dyPt); }
      updateElement(d.id, { x: snapVal(nx), y: snapVal(ny), w: snapVal(nw), h: snapVal(nh) }, false);
    }
  };

  const onPointerUp = () => {
    if (dragRef.current) {
      // Commit a history entry now
      const el = doc.elements.find((e) => e.id === dragRef.current!.id);
      if (el) updateElement(el.id, { x: el.x, y: el.y, w: el.w, h: el.h }, true);
    }
    dragRef.current = null;
  };

  // Inline editing
  const [editingText, setEditingText] = useState<string | null>(null);
  const onDoubleClick = (el: CanvasElement) => {
    if (el.type === "text" || el.type === "field" || el.type === "payment") setEditingText(el.id);
  };

  const gridBg = useMemo(() => {
    if (!showGrid) return {};
    const g = doc.page.grid;
    return {
      backgroundImage: `linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.15) 1px, transparent 1px)`,
      backgroundSize: `${g}pt ${g}pt`,
    } as CSSProperties;
  }, [showGrid, doc.page.grid]);

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[600px] border rounded-lg overflow-hidden bg-muted/30">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
        <Button size="sm" variant="ghost" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={redo} title="Redo (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" variant={showGrid ? "secondary" : "ghost"} onClick={() => setShowGrid((v) => !v)}><Grid3x3 className="h-4 w-4 mr-1" />Grid</Button>
        <Button size="sm" variant={showRuler ? "secondary" : "ghost"} onClick={() => setShowRuler((v) => !v)}><Ruler className="h-4 w-4 mr-1" />Ruler</Button>
        <Button size="sm" variant={snap ? "secondary" : "ghost"} onClick={() => setSnap((v) => !v)}>Snap</Button>
        <Separator orientation="vertical" className="h-6" />
        <Select value={doc.page.orientation} onValueChange={(v: any) => setDoc({ ...doc, page: { ...doc.page, orientation: v } })}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="portrait">A4 Portrait</SelectItem>
            <SelectItem value="landscape">A4 Landscape</SelectItem>
          </SelectContent>
        </Select>
        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" variant="ghost" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
        <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" title="Zoom in" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" title="Reset zoom" onClick={() => setZoom(1)}><RotateCcw className="h-4 w-4" /></Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={onPreview}><Eye className="h-4 w-4 mr-1" />Preview</Button>
          <Button size="sm" variant="outline" onClick={onPrint}><Printer className="h-4 w-4 mr-1" />Print / PDF</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <div className="w-48 border-r bg-background p-2 overflow-y-auto space-y-1">
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Add elements</div>
          {PALETTE.map((p) => (
            <button
              key={p.type}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"
              onClick={() => addElement(p.type)}
            >
              <p.icon className="h-4 w-4" /> {p.label}
            </button>
          ))}
          <Separator className="my-2" />
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Merge fields</div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {MERGE_FIELDS[type].map((f) => (
              <button
                key={f.key}
                className="w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-muted"
                title={`{{${f.key}}}`}
                onClick={() => {
                  const el = newElement("field");
                  el.content = `{{${f.key}}}`;
                  setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
                  setSelectedId(el.id);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto p-8" onClick={() => setSelectedId(null)}>
          {showRuler && (
            <div className="mb-1" style={{ width: `${pageW * PT_TO_PX * zoom}px`, height: 16, background: "linear-gradient(to right, #e5e7eb, #f8fafc)", position: "relative", fontSize: 9, color: "#64748b" }}>
              {Array.from({ length: Math.floor(pageW / 50) }).map((_, i) => (
                <span key={i} style={{ position: "absolute", left: `${(i * 50) * PT_TO_PX * zoom}px`, top: 2 }}>{i * 50}</span>
              ))}
            </div>
          )}
          <div
            ref={canvasRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${pageW}pt`, height: `${pageH}pt` }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <div style={{ position: "relative", width: `${pageW}pt`, height: `${pageH}pt`, background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", ...gridBg }}>
              <CanvasPage doc={{ ...doc, elements: [] }} type={type} mode="editor" />
              {/* Interactive layer */}
              {doc.elements.map((el) => {
                const isSelected = el.id === selectedId;
                const isEditing = editingText === el.id;
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => onPointerDownElement(e, el)}
                    onDoubleClick={() => onDoubleClick(el)}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                    style={{
                      position: "absolute",
                      left: `${el.x}pt`, top: `${el.y}pt`, width: `${el.w}pt`, height: `${el.h}pt`,
                      outline: isSelected ? "1.5pt solid #3B82F6" : "0.5pt dashed transparent",
                      cursor: isEditing ? "text" : "move",
                    }}
                  >
                    {isEditing && (el.type === "text" || el.type === "field" || el.type === "payment") ? (
                      <textarea
                        autoFocus
                        defaultValue={el.content ?? ""}
                        onBlur={(e) => { updateElement(el.id, { content: e.target.value }); setEditingText(null); }}
                        style={{
                          position: "absolute", inset: 0, width: "100%", height: "100%",
                          fontFamily: el.style.font, fontSize: `${el.style.size}pt`, fontWeight: el.style.weight,
                          textAlign: el.style.align, color: el.style.color, background: "rgba(255,255,255,0.9)",
                          border: "1px solid #3B82F6", padding: el.style.padding ? `${el.style.padding}pt` : 0, resize: "none",
                        }}
                      />
                    ) : (
                      <div style={{ pointerEvents: "none", width: "100%", height: "100%" }}>
                        <div style={{ position: "absolute", inset: 0 }}>
                          {renderElement({ ...el, x: 0, y: 0 }, type, "editor", logoUrl)}
                        </div>
                      </div>
                    )}
                    {isSelected && !isEditing && (
                      <>
                        {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((h) => {
                          const pos: CSSProperties = { position: "absolute", width: 8, height: 8, background: "#3B82F6", border: "1px solid #fff" };
                          if (h.includes("n")) pos.top = -4; if (h.includes("s")) pos.bottom = -4;
                          if (h.includes("w")) pos.left = -4; if (h.includes("e")) pos.right = -4;
                          if (h === "n" || h === "s") { pos.left = "50%"; pos.marginLeft = -4; }
                          if (h === "e" || h === "w") { pos.top = "50%"; pos.marginTop = -4; }
                          const cursor = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" }[h];
                          return <div key={h} onPointerDown={(e) => onPointerDownHandle(e, el, h)} style={{ ...pos, cursor, zIndex: 10 }} />;
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right inspector */}
        <div className="w-72 border-l bg-background p-3 overflow-y-auto">
          {!selected && (
            <div className="space-y-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Template properties</p>
              <p>Select an element on the page to change its text, position, size, colours, or layout.</p>
              <ul className="space-y-1 text-xs">
                <li>Drag to move an element.</li>
                <li>Double-click text to edit it directly.</li>
                <li>Use arrow keys for precise movement; hold Shift for larger steps.</li>
              </ul>
            </div>
          )}
          {selected && (
            <Inspector
              el={selected}
              type={type}
              onChange={(patch) => updateElement(selected.id, patch)}
              onDelete={() => deleteElement(selected.id)}
              onDuplicate={() => duplicateElement(selected.id)}
              onLayerUp={() => moveLayer(selected.id, 1)}
              onLayerDown={() => moveLayer(selected.id, -1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Inspector({ el, type, onChange, onDelete, onDuplicate, onLayerUp, onLayerDown }: {
  el: CanvasElement; type: TplType;
  onChange: (patch: Partial<CanvasElement>) => void;
  onDelete: () => void; onDuplicate: () => void; onLayerUp: () => void; onLayerDown: () => void;
}) {
  const s = el.style ?? {};
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold capitalize">{el.type}</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onLayerUp} title="Bring forward"><ChevronsUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onLayerDown} title="Send back"><ChevronsDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDuplicate} title="Duplicate"><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete} title="Delete"><Trash2 className="h-4 w-4 text-red-600" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <div><Label className="text-xs">X</Label><Input type="number" className="h-8" value={Math.round(el.x)} onChange={(e) => onChange({ x: Number(e.target.value) })} /></div>
        <div><Label className="text-xs">Y</Label><Input type="number" className="h-8" value={Math.round(el.y)} onChange={(e) => onChange({ y: Number(e.target.value) })} /></div>
        <div><Label className="text-xs">W</Label><Input type="number" className="h-8" value={Math.round(el.w)} onChange={(e) => onChange({ w: Number(e.target.value) })} /></div>
        <div><Label className="text-xs">H</Label><Input type="number" className="h-8" value={Math.round(el.h)} onChange={(e) => onChange({ h: Number(e.target.value) })} /></div>
      </div>

      {(el.type === "text" || el.type === "field" || el.type === "payment") && (
        <div>
          <Label className="text-xs">Content</Label>
          <Textarea rows={3} value={el.content ?? ""} onChange={(e) => onChange({ content: e.target.value })} />
          <Select onValueChange={(v) => onChange({ content: (el.content ?? "") + ` {{${v}}}` })}>
            <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Insert merge field…" /></SelectTrigger>
            <SelectContent>
              {MERGE_FIELDS[type].map((f) => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(el.type === "image" || el.type === "logo") && (
        <div>
          <Label className="text-xs">Image URL</Label>
          <Input value={el.src ?? ""} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://…" />
          <TemplateImageUpload onUploaded={(src) => onChange({ src })} />
        </div>
      )}

      {el.type !== "line" && el.type !== "rect" && el.type !== "image" && el.type !== "logo" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Font size</Label><Input type="number" className="h-8" value={s.size ?? 10} onChange={(e) => onChange({ style: { size: Number(e.target.value) } })} /></div>
            <div>
              <Label className="text-xs">Weight</Label>
              <Select value={s.weight ?? "normal"} onValueChange={(v: any) => onChange({ style: { weight: v } })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Align</Label>
            <Select value={s.align ?? "left"} onValueChange={(v: any) => onChange({ style: { align: v } })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Color</Label><Input type="color" className="h-8" value={s.color ?? "#0f172a"} onChange={(e) => onChange({ style: { color: e.target.value } })} /></div>
        <div><Label className="text-xs">Background</Label><Input type="color" className="h-8" value={s.bg ?? "#ffffff"} onChange={(e) => onChange({ style: { bg: e.target.value } })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Border</Label><Input type="number" className="h-8" value={s.borderWidth ?? 0} onChange={(e) => onChange({ style: { borderWidth: Number(e.target.value) } })} /></div>
        <div><Label className="text-xs">Border color</Label><Input type="color" className="h-8" value={s.borderColor ?? "#000000"} onChange={(e) => onChange({ style: { borderColor: e.target.value } })} /></div>
        <div><Label className="text-xs">Padding</Label><Input type="number" className="h-8" value={s.padding ?? 0} onChange={(e) => onChange({ style: { padding: Number(e.target.value) } })} /></div>
      </div>

      {el.type === "table" && el.table && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Columns</Label>
          {el.table.columns.map((c, i) => (
            <div key={i} className="flex gap-1 items-center">
              <Input className="h-7 flex-1" value={c.label} onChange={(e) => {
                const cols = [...el.table!.columns]; cols[i] = { ...c, label: e.target.value };
                onChange({ table: { ...el.table!, columns: cols } });
              }} />
              <Input className="h-7 w-16" value={c.key} onChange={(e) => {
                const cols = [...el.table!.columns]; cols[i] = { ...c, key: e.target.value };
                onChange({ table: { ...el.table!, columns: cols } });
              }} />
              <Input className="h-7 w-14" type="number" value={c.width} onChange={(e) => {
                const cols = [...el.table!.columns]; cols[i] = { ...c, width: Number(e.target.value) };
                onChange({ table: { ...el.table!, columns: cols } });
              }} />
              <Button size="icon" variant="ghost" onClick={() => {
                const cols = el.table!.columns.filter((_, j) => j !== i);
                onChange({ table: { ...el.table!, columns: cols } });
              }}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => {
            const cols = [...el.table!.columns, { key: "new_col", label: "New", width: 80, align: "left" as const }];
            onChange({ table: { ...el.table!, columns: cols } });
          }}>Add column</Button>
        </div>
      )}

      {el.type === "totals" && el.totals && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Rows</Label>
          {el.totals.rows.map((r, i) => (
            <div key={i} className="flex gap-1 items-center">
              <Input className="h-7 flex-1" value={r.label} onChange={(e) => {
                const rows = [...el.totals!.rows]; rows[i] = { ...r, label: e.target.value };
                onChange({ totals: { rows } });
              }} />
              <Input className="h-7 flex-1" value={r.key} onChange={(e) => {
                const rows = [...el.totals!.rows]; rows[i] = { ...r, key: e.target.value };
                onChange({ totals: { rows } });
              }} />
              <Switch checked={!!r.bold} onCheckedChange={(v) => {
                const rows = [...el.totals!.rows]; rows[i] = { ...r, bold: v };
                onChange({ totals: { rows } });
              }} />
              <Button size="icon" variant="ghost" onClick={() => {
                const rows = el.totals!.rows.filter((_, j) => j !== i);
                onChange({ totals: { rows } });
              }}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => {
            const rows = [...el.totals!.rows, { label: "New", key: "totals.total" }];
            onChange({ totals: { rows } });
          }}>Add row</Button>
        </div>
      )}
    </div>
  );
}

function TemplateImageUpload({ onUploaded }: { onUploaded: (src: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `template-assets/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("notice-images").upload(path, file);
      if (error) throw error;
      const { data, error: signError } = await supabase.storage.from("notice-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signError || !data?.signedUrl) throw signError ?? new Error("Could not prepare the image.");
      onUploaded(data.signedUrl);
      toast.success("Image added to the template.");
    } catch (error: any) {
      toast.error(error.message ?? "Could not upload the image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="mt-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
      />
      <Upload className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-1 text-xs text-muted-foreground">Drag an image here, or choose one from your device.</p>
      <Button type="button" size="sm" variant="outline" className="mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
        {uploading ? "Uploading…" : "Choose image"}
      </Button>
      <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG, WebP, or SVG · maximum 5 MB</p>
    </div>
  );
}
