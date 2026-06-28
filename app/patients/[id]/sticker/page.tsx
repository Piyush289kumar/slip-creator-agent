"use client";

function fitTextLines(
  doc: any, text: string, maxWidthMm: number, maxLines: number,
  maxSize = 7.5, minSize = 5.2, step = 0.25
): { fontSize: number; lines: string[] } {
  for (let size = maxSize; size >= minSize; size -= step) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidthMm) as string[];
    if (lines.length <= maxLines) return { fontSize: size, lines };
  }
  doc.setFontSize(minSize);
  const lines = (doc.splitTextToSize(text, maxWidthMm) as string[]).slice(0, maxLines);
  const lastIdx = lines.length - 1;
  let last = lines[lastIdx] ?? "";
  while (last.length > 1 && doc.getTextWidth(last + "…") > maxWidthMm) last = last.slice(0, -1);
  lines[lastIdx] = last + "…";
  return { fontSize: minSize, lines };
}

function shortDate(raw?: string | Date | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

function uhidDate(uhid: string, admissionDate?: string | Date | null): string {
  const date = shortDate(admissionDate);
  return date ? `${uhid}/${date}` : uhid;
}

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Patient } from "@/types/patient";

export default function StickerPage() {
  const params = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await fetch(`/api/patients/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setPatient(data.data);
          const qr = await import("qrcode");
          const url = await qr.default.toDataURL(
            JSON.stringify({ uhid: data.data.uhid, name: data.data.name, age: data.data.age, gender: data.data.gender, mobile: data.data.mobile }),
            { width: 128, margin: 1, color: { dark: "#000000", light: "#ffffff" } }
          );
          setQrDataUrl(url);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchPatient();
  }, [params.id]);

  const exportPDF = async () => {
    if (!patient || !qrDataUrl) return;
    setExporting(true);
    try {
      const { jsPDF: JsPDF } = await import("jspdf");
      const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const FONT = "helvetica";
      const cols = 4, rows = 9;
      const marginX = 2, marginY = 2;
      const gapX = 2, gapY = 2;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const stickerW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
      const stickerH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows;
      const padX = 1.5;
      const qrSize = Math.min(14, stickerH - 2);

      const na = (value: any) =>
        value && String(value).trim() !== "" ? String(value) : "N/A";

      const fields: { text: string; bold?: boolean; wrap?: boolean }[] = [
        { text: uhidDate(patient.uhid, patient.admissionDate), bold: true },
        { text: patient.name, wrap: true },
        { text: na(patient.diagnosis) },
        { text: `${patient.age} Yrs / ${patient.gender}` },
        { text: patient.mobile },
        ...(patient.address?.trim() ? [{ text: patient.address.trim(), wrap: true }] : []),
      ];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = marginX + col * (stickerW + gapX);
          const y = marginY + row * (stickerH + gapY);

          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);
          doc.roundedRect(x, y, stickerW, stickerH, 1.2, 1.2);

          const bodyTop = y + 1;
          const bodyBottom = y + stickerH - 1;
          const qrX = x + stickerW - qrSize - padX;
          const qrY = bodyTop + (bodyBottom - bodyTop - qrSize) / 2;
          doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

          const maxValueWidth = qrX - (x + padX) - 1;
          const rowSlot = (bodyBottom - bodyTop) / fields.length;
          const lineH = 2.2;

          fields.forEach((field, i) => {
            const slotTop = bodyTop + i * rowSlot;
            const maxLines = field.wrap ? 2 : 1;
            const { fontSize, lines } = fitTextLines(doc, field.text, maxValueWidth, maxLines);
            const centerY = slotTop + rowSlot / 2 + 0.9;
            const startY = centerY - ((lines.length - 1) * lineH) / 2;
            doc.setFont(FONT, field.bold ? "bold" : "normal");
            doc.setFontSize(fontSize);
            doc.setTextColor(0, 0, 0);
            lines.forEach((line, li) => doc.text(line, x + padX, startY + li * lineH));
          });
        }
      }

      doc.save(`stickers_${patient.uhid}.pdf`);
    } catch (err) { console.error("PDF export error:", err); }
    finally { setExporting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-6">
        <div className="w-10 h-10 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
        <p className="text-sm font-medium text-gray-500">Loading patient data…</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <p className="text-base font-semibold text-gray-800 mb-1">Patient not found</p>
          <p className="text-sm text-gray-400 mb-5">The record may have been deleted</p>
          <button onClick={() => router.back()} className="text-sm font-semibold text-blue-600">← Go back</button>
        </div>
      </div>
    );
  }

  const uhidDateStr = uhidDate(patient.uhid, patient.admissionDate);
  const stickers = Array.from({ length: 36 });

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 safe-area-inset-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-gray-900 leading-tight">Sticker report</h1>
              <p className="text-[11px] text-gray-400 truncate">36 stickers · 4×9 · A4 PDF</p>
            </div>
          </div>
          <button
            onClick={exportPDF}
            disabled={exporting || !qrDataUrl}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-[13px] font-semibold disabled:opacity-60 active:scale-95 transition-all shrink-0 ml-3"
          >
            {exporting
              ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Generating…</>
              : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4-4-4m4 4V4" /></svg>Export PDF</>
            }
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-10">

        {/* ── PATIENT CARD ── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-6 gap-6">

            {/* Left */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 text-xl lg:text-2xl font-bold shrink-0">
                {patient.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <h2 className="text-lg lg:text-2xl font-bold text-gray-900 truncate">
                  {patient.name}
                </h2>

                <p className="mt-1 text-sm lg:text-base font-mono font-semibold text-blue-600">
                  {uhidDateStr}
                </p>
              </div>
            </div>

            {/* Right */}
            {qrDataUrl && (
              <div className="flex justify-center lg:justify-end shrink-0">
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt="QR code"
                    className="w-36 h-36 lg:w-22 lg:h-22 object-contain"
                  />
                </div>
              </div>
            )}

          </div>

          {/* Detail grid */}
          <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: "Age / Gender", value: `${patient.age} yrs · ${patient.gender}` },
              { label: "Mobile", value: patient.mobile, mono: true },
              { label: "Blood group", value: patient.bloodGroup || "—" },
              { label: "Father's/Husband", value: patient.diagnosis || "—" },
              ...(patient.address ? [{ label: "Address", value: patient.address, full: true }] : []),
            ].map(f => (
              <div key={f.label} className={(f as any).full ? "col-span-2" : ""}>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">{f.label}</p>
                <p className={`text-[13px] font-medium text-gray-800 break-words ${(f as any).mono ? "font-mono" : ""}`}>{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── STICKER PREVIEW ── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-[13px] font-semibold text-gray-800">Print preview</p>
              <p className="text-[11px] text-gray-400 mt-0.5">4 columns × 9 rows</p>
            </div>
            <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">36 stickers</span>
          </div>

          {/* Horizontally scrollable A4 sheet */}
          <div className="overflow-x-auto bg-gray-100 p-3">
            <div
              className="bg-white shadow-lg mx-auto"
              style={{ width: "560px", minHeight: "792px", padding: "6px" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2px" }}>
                {stickers.map((_, i) => (
                  <StickerPreview key={i} patient={patient} qrDataUrl={qrDataUrl} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── TIP BANNER ── */}
        <div className="bg-blue-50 rounded-2xl px-4 py-3 flex gap-3 items-start">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
          <p className="text-[12px] text-blue-700 leading-relaxed">Print on A4 adhesive label sheets. Disable page scaling in printer settings for best fit.</p>
        </div>

        {/* ── BOTTOM EXPORT BUTTON ── */}
        <button
          onClick={exportPDF}
          disabled={exporting || !qrDataUrl}
          className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4-4-4m4 4V4" /></svg>
          {exporting ? "Generating PDF…" : "Export 36 stickers as PDF"}
        </button>
      </main>
    </div>
  );
}

/* ── STICKER PREVIEW TILE ── */
function StickerPreview({ patient, qrDataUrl }: { patient: Patient; qrDataUrl: string }) {
  const clamp2: React.CSSProperties = {
    display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
    overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word", lineHeight: 1.3,
  };

  const date = (() => {
    if (!patient.admissionDate) return "";
    const d = new Date(patient.admissionDate);
    if (isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`;
  })();

  const uhidLine = date ? `${patient.uhid}/${date}` : patient.uhid;

  const fs = "4.8px";
  const base: React.CSSProperties = { fontSize: fs, color: "#000", lineHeight: 1.25, margin: 0 };

  return (
    <div style={{ border: "0.8px solid #555", borderRadius: "3px", height: "80px", display: "flex", padding: "3px 2px 3px 3px", gap: "2px", boxSizing: "border-box", overflow: "hidden" }}>
      {/* Text column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
        {/* UHID/Date — bold, single line */}
        <p style={{ ...base, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{uhidLine}</p>
        {/* Name — up to 2 lines */}
        <p style={{ ...base, ...clamp2 }}>{patient.name}</p>
        {/* Diagnosis / Father — up to 2 lines */}
        <p style={{ ...base, ...clamp2 }}>{patient.diagnosis || "N/A"}</p>
        {/* Age / Gender */}
        <p style={{ ...base, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{patient.age} Yrs / {patient.gender}</p>
        {/* Mobile */}
        <p style={{ ...base, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{patient.mobile}</p>
        {/* Address */}
        {patient.address?.trim() && (
          <p style={{ ...base, ...clamp2 }}>{patient.address.trim()}</p>
        )}
      </div>

      {/* QR code */}
      {qrDataUrl && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          <img src={qrDataUrl} alt="QR" style={{ width: "30px", height: "30px", display: "block", imageRendering: "pixelated" }} />
        </div>
      )}
    </div>
  );
}