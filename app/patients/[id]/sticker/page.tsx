"use client";


// Tries progressively smaller font sizes until the text fits within
// maxLines at the given width. Falls back to a hard ellipsis-truncated
// line if even the smallest size won't fit. Pure jsPDF math — no system
// fonts involved, so this behaves identically on every device.
function fitTextLines(
  doc: any,
  text: string,
  maxWidthMm: number,
  maxLines: number,
  maxSize = 6.5,
  minSize = 4.2,
  step = 0.25
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
  while (last.length > 1 && doc.getTextWidth(last + "…") > maxWidthMm) {
    last = last.slice(0, -1);
  }
  lines[lastIdx] = last + "…";
  return { fontSize: minSize, lines };
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
  const [printDate, setPrintDate] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrintDate(
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    );
  }, []);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await fetch(`/api/patients/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setPatient(data.data);
          const qr = await import("qrcode");
          const url = await qr.default.toDataURL(
            JSON.stringify({
              uhid: data.data.uhid,
              name: data.data.name,
              age: data.data.age,
              gender: data.data.gender,
              mobile: data.data.mobile,
            }),
            { width: 120, margin: 1, color: { dark: "#1e3a5f", light: "#ffffff" } }
          );
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
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
      const cols = 4, rows = 8;
      const marginX = 2, marginY = 2;
      const gapX = 2, gapY = 2;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const stickerW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
      const stickerH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows;

      const headerH = 4;
      const footerH = 3;
      const padX = 1.5;
      const qrSize = Math.min(14, stickerH - headerH - footerH - 1);

      const address = patient.address?.trim();
      const fields: { label: string; value: string }[] = [
        { label: "UHID:", value: patient.uhid },
        { label: "Name:", value: patient.name },
        { label: "Age/Sex:", value: `${patient.age} Yrs • ${patient.gender}` },
        { label: "Mobile:", value: patient.mobile },
        ...(address ? [{ label: "Address:", value: address }] : []),
      ];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = marginX + col * (stickerW + gapX);
          const y = marginY + row * (stickerH + gapY);

          // Card border
          doc.setDrawColor(180, 200, 220);
          doc.setLineWidth(0.3);
          doc.roundedRect(x, y, stickerW, stickerH, 1.2, 1.2);

          // Header bar
          doc.setFillColor(30, 58, 95);
          doc.roundedRect(x, y, stickerW, headerH, 1.2, 1.2, "F");
          doc.rect(x, y + headerH / 2, stickerW, headerH / 2, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont(FONT, "bold");
          doc.setFontSize(6);
          doc.text("HOSPITAL MANAGEMENT SYSTEM", x + stickerW / 2, y + headerH / 2 + 1.3, {
            align: "center",
          });

          const bodyTop = y + headerH + 0.8;
          const bodyBottom = y + stickerH - footerH - 0.5;

          // QR
          const qrX = x + stickerW - qrSize - padX;
          const qrY = bodyTop + (bodyBottom - bodyTop - qrSize) / 2;
          doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

          // Info rows
          const infoX = x + padX;
          const labelW = 10;
          const valueX = infoX + labelW;
          const maxValueWidth = qrX - valueX - 1;
          const rowSlot = (bodyBottom - bodyTop) / fields.length;
          const lineH = 2.2;

          fields.forEach((field, i) => {
            const slotTop = bodyTop + i * rowSlot;
            const maxLines = field.label === "Name:" || field.label === "Address:" ? 2 : 1;
            const { fontSize, lines } = fitTextLines(doc, field.value, maxValueWidth, maxLines);
            const centerY = slotTop + rowSlot / 2 + 0.9;

            const startY = centerY - ((lines.length - 1) * lineH) / 2;

            doc.setFont(FONT, "bold");
            doc.setFontSize(5);
            doc.setTextColor(0, 0, 0);
            doc.text(field.label, infoX, startY);

            doc.setFont(FONT, "normal");
            doc.setFontSize(fontSize);
            doc.setTextColor(0, 0, 0);
            lines.forEach((line, li) => doc.text(line, valueX, startY + li * lineH));
          });

          // Footer
          doc.setDrawColor(200, 215, 230);
          doc.setLineWidth(0.2);
          doc.line(x + 1, y + stickerH - footerH + 0.3, x + stickerW - 1, y + stickerH - footerH + 0.3);
          doc.setFont(FONT, "italic");
          doc.setFontSize(4.3);
          doc.setTextColor(0, 0, 0);
          doc.text(`Printed: ${printDate}`, x + padX, y + stickerH - 1.3);
          doc.text("Handle with care", x + stickerW - padX, y + stickerH - 1.3, { align: "right" });
        }
      }

      doc.save(`stickers_${patient.uhid}_${patient.name.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setExporting(false);
    }
  };

  /* ── LOADING ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[14px] font-medium text-gray-700">Loading patient</p>
          <p className="text-[12px] text-gray-400 mt-0.5">Fetching data and generating QR…</p>
        </div>
        {/* Skeleton stickers */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-2 mt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* ── NOT FOUND ── */
  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-gray-700">Patient not found</p>
          <p className="text-[12px] text-gray-400 mt-1 mb-5">The record may have been deleted</p>
          <button
            onClick={() => router.back()}
            className="text-[13px] font-medium text-blue-600 flex items-center gap-1.5 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go back
          </button>
        </div>
      </div>
    );
  }

  const stickers = Array.from({ length: 32 });

  const infoFields = [
    { label: "UHID", value: patient.uhid, mono: true },
    { label: "Name", value: patient.name },
    { label: "Age", value: `${patient.age} yrs` },
    { label: "Gender", value: patient.gender },
    { label: "Mobile", value: patient.mobile, mono: true },
    { label: "Blood", value: patient.bloodGroup || "—" },
  ];

  const avatarColors = [
    "from-blue-600 to-blue-400",
    "from-violet-600 to-violet-400",
    "from-emerald-600 to-emerald-400",
    "from-rose-600 to-rose-400",
  ];
  const avatarColor = avatarColors[patient.name.charCodeAt(0) % avatarColors.length];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-90 transition-all flex-shrink-0"
              aria-label="Go back"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900 leading-tight">Sticker Report</h1>
              <p className="text-[11px] text-gray-400">32 stickers · A4 · PDF export</p>
            </div>
          </div>
          <button
            onClick={exportPDF}
            disabled={exporting || !qrDataUrl}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-95 text-white text-[13px] font-medium px-3.5 py-2 rounded-xl transition-all"
          >
            {exporting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export PDF
              </>
            )}
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-10">

        {/* ── PATIENT SUMMARY CARD ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0`}>
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 truncate">{patient.name}</p>
              <p className="text-[12px] text-gray-400 font-mono mt-0.5">{patient.uhid}</p>
            </div>
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Patient QR code"
                className="w-12 h-12 rounded-lg border border-gray-100 flex-shrink-0"
              />
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-3">
            {infoFields.map((f) => (
              <div key={f.label}>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                  {f.label}
                </p>
                <p className={`text-[13px] font-semibold text-gray-800 truncate ${f.mono ? "font-mono" : ""}`}>
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── STICKER COUNT BADGE ROW ── */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-gray-500">A4 preview — 4 × 8 layout</p>
          <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-full">
            32 stickers
          </span>
        </div>

        {/* ── STICKER GRID PREVIEW ── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Grid header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <p className="text-[13px] font-semibold text-gray-700">Print preview</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Scroll to see all stickers</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="w-2 h-2 rounded-full bg-green-400" />
            </div>
          </div>

          {/* Scrollable A4-proportional sheet */}
          <div className="overflow-x-auto bg-gray-200 p-4">
            <div
              ref={printRef}
              className="bg-white mx-auto shadow-xl"
              style={{
                width: "595px",
                minHeight: "842px",
                padding: "20px 18px",
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "2px",
                }}
              >
                {stickers.map((_, i) => (
                  <StickerPreview
                    key={i}
                    patient={patient}
                    qrDataUrl={qrDataUrl}
                    printDate={printDate}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── EXPORT HINT ── */}
        <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-blue-800">Print tips</p>
            <p className="text-[12px] text-blue-600 mt-0.5 leading-relaxed">
              Export to PDF, then print on A4 adhesive label sheets for best results.
              Disable page scaling in your printer settings.
            </p>
          </div>
        </div>

        {/* ── BOTTOM EXPORT BUTTON ── */}
        <button
          onClick={exportPDF}
          disabled={exporting || !qrDataUrl}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] text-white rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
        >
          {exporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating PDF…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export 32 stickers as PDF
            </>
          )}
        </button>
      </main>
    </div>
  );
}



/* ── STICKER PREVIEW COMPONENT ── */
function StickerPreview({
  patient,
  qrDataUrl,
  printDate,
}: {
  patient: Patient;
  qrDataUrl: string;
  printDate: string;
}) {
  const address = patient.address?.trim();

  // Long names/addresses wrap onto 2 lines and shrink a step instead of
  // being cut off after a fixed character count.
  const nameFontSize =
    patient.name.length <= 16 ? 6.5 : patient.name.length <= 26 ? 6 : patient.name.length <= 38 ? 5.5 : 5;
  const addressFontSize =
    !address ? 5.5 : address.length <= 24 ? 5.5 : address.length <= 42 ? 5 : 4.5;

  // Clamps text to 2 lines max, with ellipsis only if it still overflows.
  const clampTwoLines: React.CSSProperties = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
    lineHeight: 1.2,
  };

  return (
    <div
      style={{
        border: "1px solid #b4c8dc",
        borderRadius: "6px",
        overflow: "hidden",
        height: "100px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background: "#1e3a5f",
          color: "white",
          fontSize: "6px",
          fontWeight: "bold",
          textAlign: "center",
          padding: "3px 2px",
          letterSpacing: "0.3px",
          flexShrink: 0,
        }}
      >
        HOSPITAL MANAGEMENT SYSTEM
      </div>
      {/* Body — info column stretches to fill the full height, QR kept
          just large enough to scan so text keeps most of the width */}
      <div style={{ display: "flex", flex: 1, padding: "3px 4px", gap: "2px", minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >

          {/* UUID — wraps up to 2 lines, shrinks a step for long names */}

          <div style={{ display: "flex", alignItems: "flex-start", gap: "2px" }}>
            <span style={{ fontSize: "5px", color: "#000", minWidth: "24px", flexShrink: 0 }}>
              UUID:
            </span>
            <span style={{ fontSize: `5px`, color: "#14203a", fontWeight: 500, flex: 1, minWidth: 0, ...clampTwoLines }}>
              {patient.uhid}
            </span>
          </div>


          {/* Name — wraps up to 2 lines, shrinks a step for long names */}

          <div style={{ display: "flex", alignItems: "flex-start", gap: "2px" }}>
            <span style={{ fontSize: "5px", color: "#000", minWidth: "24px", flexShrink: 0 }}>
              Name:
            </span>
            <span style={{ fontSize: `5px`, color: "#14203a", fontWeight: 500, flex: 1, minWidth: 0, ...clampTwoLines }}>
              {patient.name}
            </span>
          </div>

          {/* Age + Gender combined onto one line to free a row for address */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            <span style={{ fontSize: "5px", color: "#000", minWidth: "24px", flexShrink: 0 }}>
              Age/Sex:
            </span>
            <span style={{ fontSize: "5px", color: "#14203a", fontWeight: 500, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {patient.age} Yrs • {patient.gender}
            </span>
          </div>

          {/* Mobile */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            <span style={{ fontSize: "5px", color: "#000", minWidth: "24px", flexShrink: 0 }}>
              Mobile:
            </span>
            <span style={{ fontSize: "5px", color: "#14203a", fontWeight: 500, fontFamily: "monospace", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {patient.mobile}
            </span>
          </div>

          {/* Address — wraps up to 2 lines, shrinks a step for long addresses */}
          {address && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "2px" }}>
              <span style={{ fontSize: "5px", color: "#000", minWidth: "24px", flexShrink: 0 }}>
                Address:
              </span>
              <span style={{ fontSize: `5px`, color: "#14203a", fontWeight: 500, flex: 1, minWidth: 0, ...clampTwoLines }}>
                {address}
              </span>
            </div>
          )}
        </div>

        {/* QR — sized only for a reliable scan, not for visual weight */}
        {qrDataUrl && (
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ width: "35px", height: "35px", display: "block", imageRendering: "pixelated" }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #c8d9e8",
          padding: "2px 4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "4.5px", color: "#000000", fontStyle: "italic" }}>
          Printing on : {printDate}
        </span>
      </div>
    </div>
  );
}