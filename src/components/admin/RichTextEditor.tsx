import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Image as ImageIcon, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FONTS = ["Inter", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const SIZES = [
  { label: "Small", v: "2" },
  { label: "Normal", v: "3" },
  { label: "Large", v: "5" },
  { label: "Huge", v: "7" },
];
const COLORS = ["#000000", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"];

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertImage = async (file: File) => {
    setUploading(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("notice-images").upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from("notice-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!data?.signedUrl) throw new Error("Failed to sign URL");
      ref.current?.focus();
      exec("insertHTML", `<img src="${data.signedUrl}" data-path="${path}" style="max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px" />`);
      handleInput();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const insertLink = () => {
    const url = window.prompt("Enter URL");
    if (url) exec("createLink", url);
    handleInput();
  };

  const removeSelectedImage = () => {
    const sel = window.getSelection();
    if (!sel) return;
    const node = sel.anchorNode?.parentElement;
    if (node?.tagName === "IMG") node.remove();
    handleInput();
  };

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
        <select
          className="h-8 rounded border border-border bg-background px-2 text-xs"
          onChange={(e) => { exec("fontName", e.target.value); handleInput(); }}
          defaultValue=""
        >
          <option value="" disabled>Font</option>
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          className="h-8 rounded border border-border bg-background px-2 text-xs"
          onChange={(e) => { exec("fontSize", e.target.value); handleInput(); }}
          defaultValue=""
        >
          <option value="" disabled>Size</option>
          {SIZES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-0.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { exec("foreColor", c); handleInput(); }}
              className="h-5 w-5 rounded-full border border-border"
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => { exec("bold"); handleInput(); }}><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => { exec("italic"); handleInput(); }}><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => { exec("underline"); handleInput(); }}><Underline className="h-3.5 w-3.5" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => { exec("insertUnorderedList"); handleInput(); }}><List className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => { exec("insertOrderedList"); handleInput(); }}><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => { exec("justifyLeft"); handleInput(); }}><AlignLeft className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => { exec("justifyCenter"); handleInput(); }}><AlignCenter className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => { exec("justifyRight"); handleInput(); }}><AlignRight className="h-3.5 w-3.5" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={insertLink}><LinkIcon className="h-3.5 w-3.5" /></Btn>
        <label className="inline-flex h-7 cursor-pointer items-center rounded px-2 text-xs hover:bg-muted">
          <ImageIcon className="h-3.5 w-3.5" />
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImage(f); e.target.value = ""; }} />
        </label>
        <Btn onClick={removeSelectedImage} title="Delete selected image"><Trash2 className="h-3.5 w-3.5" /></Btn>
        {uploading && <span className="ml-2 text-xs text-muted-foreground">Uploading…</span>}
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        className="min-h-[240px] max-h-[500px] overflow-auto p-3 text-sm focus:outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline"
        suppressContentEditableWarning
      />
    </div>
  );
}

function Btn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" {...props}>
      {children}
    </Button>
  );
}
