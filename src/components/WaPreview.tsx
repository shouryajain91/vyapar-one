import { Icon } from "@/components/icons";

export interface PreviewButton {
  type: string;
  text: string;
}

/** WhatsApp-style bubble showing what a template will look like. */
export function WaPreview({
  headerText,
  headerMedia,
  body,
  footer,
  buttons = [],
}: {
  headerText?: string | null;
  headerMedia?: string | null; // label such as "image" or a file name
  body: string;
  footer?: string | null;
  buttons?: PreviewButton[];
}) {
  return (
    <div className="rounded-xl bg-[#e9efe6] p-4">
      <div className="max-w-sm rounded-lg rounded-tl-none bg-white p-3 text-sm text-slate-900 shadow-sm">
        {headerMedia && (
          <div className="mb-2 flex h-28 items-center justify-center gap-2 rounded-md bg-slate-100 text-xs text-slate-500">
            <Icon name="image" className="h-5 w-5" />
            <span className="max-w-[10rem] truncate">{headerMedia}</span>
          </div>
        )}
        {headerText && <p className="mb-1 font-semibold">{headerText}</p>}
        <p className="whitespace-pre-wrap break-words">
          {body || <span className="text-slate-400">Your message will appear here</span>}
        </p>
        {footer && <p className="mt-2 text-xs text-slate-500">{footer}</p>}
      </div>
      {buttons.map((b, i) => (
        <div
          key={i}
          className="mt-1 flex max-w-sm items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-sky-600 shadow-sm"
        >
          {b.type === "URL" && <Icon name="link" />}
          {b.type === "PHONE_NUMBER" && <Icon name="phone" />}
          {b.text || "Button"}
        </div>
      ))}
    </div>
  );
}
