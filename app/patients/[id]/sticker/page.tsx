"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Patient } from "@/types/patient";

// Dynamically import QR & PDF libraries
let QRCode: typeof import("qrcode") | null = null;
let jsPDF: typeof import("jspdf").jsPDF | null = null;

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
    setPrintDate(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }));
  }, []);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await fetch(`/api/patients/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setPatient(data.data);
          // Generate QR code
          const qr = await import("qrcode");
          QRCode = qr;
          const qrUrl = await qr.default.toDataURL(
            JSON.stringify({
              uhid: data.data.uhid,
              name: data.data.name,
              age: data.data.age,
              gender: data.data.gender,
              mobile: data.data.mobile,
            }),
            { width: 120, margin: 1, color: { dark: "#1e3a5f", light: "#ffffff" } }
          );
          setQrDataUrl(qrUrl);
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
      jsPDF = JsPDF;

      const doc = new JsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // A4 = 210mm x 297mm
      // 4 columns x 6 rows = 24 stickers
      const cols = 4;
      const rows = 6;
      const marginX = 5; // left margin
      const marginY = 8; // top margin
      const gapX = 2;
      const gapY = 2;
      const pageW = 210;
      const pageH = 297;
      const stickerW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols; // ~48mm
      const stickerH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows; // ~45mm

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = marginX + col * (stickerW + gapX);
          const y = marginY + row * (stickerH + gapY);

          // Sticker border
          doc.setDrawColor(180, 200, 220);
          doc.setLineWidth(0.3);
          doc.roundedRect(x, y, stickerW, stickerH, 2, 2);

          // Header bar
          doc.setFillColor(30, 58, 95); // deep navy
          doc.roundedRect(x, y, stickerW, 6, 2, 2);
          doc.rect(x, y + 3, stickerW, 3, "F");

          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.text("HOSPITAL MANAGEMENT SYSTEM", x + stickerW / 2, y + 4, { align: "center" });

          // UHID row
          doc.setFillColor(232, 244, 255);
          doc.rect(x + 1, y + 7, stickerW - 2, 5, "F");
          doc.setTextColor(30, 58, 95);
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "bold");
          doc.text("UHID:", x + 2.5, y + 10.5);
          doc.setTextColor(0, 90, 180);
          doc.setFontSize(7);
          doc.text(patient.uhid, x + 12, y + 10.5);

          // QR code (right side)
          const qrSize = 20;
          const qrX = x + stickerW - qrSize - 2;
          const qrY = y + 13;
          doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

          // Patient info (left side)
          const infoX = x + 2;
          let infoY = y + 15;
          const lineH = 4.5;

          const fields = [
            { label: "Name", value: patient.name },
            { label: "Age", value: `${patient.age} Yrs` },
            { label: "Gender", value: patient.gender },
            { label: "Mobile", value: patient.mobile },
          ];

          fields.forEach(({ label, value }) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(5.5);
            doc.setTextColor(100, 120, 140);
            doc.text(`${label}:`, infoX, infoY);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(20, 30, 50);
            doc.setFontSize(6);
            // Truncate if name too long
            const maxWidth = qrX - infoX - 8;
            const truncated = doc.splitTextToSize(value, maxWidth)[0];
            doc.text(truncated, infoX + 12, infoY);
            infoY += lineH;
          });

          // Footer line
          doc.setDrawColor(200, 215, 230);
          doc.setLineWidth(0.2);
          doc.line(x + 1, y + stickerH - 5, x + stickerW - 1, y + stickerH - 5);

          doc.setFont("helvetica", "italic");
          doc.setFontSize(4.5);
          doc.setTextColor(150, 160, 175);
          const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); // PDF is client-only, fine here
          doc.text(`Printed: ${date}`, x + 2, y + stickerH - 2.5);
          doc.text("★ Handle with care", x + stickerW - 2, y + stickerH - 2.5, { align: "right" });
        }
      }

      doc.save(`stickers_${patient.uhid}_${patient.name.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-lg font-medium">Patient not found</p>
          <button onClick={() => router.back()} className="mt-3 text-blue-500 text-sm hover:underline">← Go Back</button>
        </div>
      </div>
    );
  }

  // 24 sticker preview grid
  const stickers = Array.from({ length: 24 });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-bold text-gray-900">Sticker Report</h1>
              <p className="text-xs text-gray-400">24 stickers · 1 A4 page · PDF export</p>
            </div>
          </div>
          <button
            onClick={exportPDF}
            disabled={exporting || !qrDataUrl}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2 shadow-md shadow-blue-200"
          >
            {exporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export PDF
              </>
            )}
          </button>
        </div>
      </header>

      {/* Patient Summary Card */}
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-400 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "UHID", value: patient.uhid, mono: true },
                { label: "Patient Name", value: patient.name },
                { label: "Age", value: `${patient.age} Years` },
                { label: "Gender", value: patient.gender },
                { label: "Mobile", value: patient.mobile, mono: true },
                { label: "Blood Group", value: patient.bloodGroup || "—" },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{f.label}</p>
                  <p className={`text-sm font-semibold text-gray-800 ${f.mono ? "font-mono" : ""}`}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR" className="w-16 h-16 rounded-lg border border-gray-100 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Sticker Preview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">A4 Preview — 24 Stickers</h2>
              <p className="text-xs text-gray-400 mt-0.5">4 columns × 6 rows layout</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
              {stickers.length} stickers
            </span>
          </div>

          {/* A4 proportional preview */}
          <div className="p-6 flex justify-center bg-gray-100">
            <div
              ref={printRef}
              className="bg-white shadow-2xl"
              style={{
                width: "595px", // A4 at 72dpi approximation for screen
                minHeight: "842px",
                padding: "20px 18px",
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "6px",
                }}
              >
                {stickers.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #b4c8dc",
                      borderRadius: "6px",
                      overflow: "hidden",
                      height: "120px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {/* Sticker Header */}
                    <div
                      style={{
                        background: "#1e3a5f",
                        color: "white",
                        fontSize: "6px",
                        fontWeight: "bold",
                        textAlign: "center",
                        padding: "3px 2px",
                        letterSpacing: "0.3px",
                      }}
                    >
                      HOSPITAL MANAGEMENT SYSTEM
                    </div>

                    {/* UHID Row */}
                    <div
                      style={{
                        background: "#e8f4ff",
                        padding: "2px 5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      <span style={{ fontSize: "6px", fontWeight: "bold", color: "#1e3a5f" }}>UHID:</span>
                      <span style={{ fontSize: "7px", fontWeight: "bold", color: "#005ab4", fontFamily: "monospace" }}>
                        {patient.uhid}
                      </span>
                    </div>

                    {/* Body */}
                    <div style={{ display: "flex", flex: 1, padding: "3px 4px", gap: "4px" }}>
                      {/* Info */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        {[
                          { label: "Name", value: patient.name.length > 14 ? patient.name.slice(0, 14) + "…" : patient.name },
                          { label: "Age", value: `${patient.age} Yrs` },
                          { label: "Gender", value: patient.gender },
                          { label: "Mobile", value: patient.mobile },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
                            <span style={{ fontSize: "5.5px", color: "#7890a0", fontWeight: "bold", minWidth: "28px" }}>
                              {label}:
                            </span>
                            <span style={{ fontSize: "6px", color: "#14203a", fontWeight: "500", fontFamily: label === "Mobile" ? "monospace" : "inherit" }}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* QR Code */}
                      {qrDataUrl && (
                        <div style={{ flexShrink: 0 }}>
                          <img
                            src={qrDataUrl}
                            alt="QR"
                            style={{ width: "50px", height: "50px", display: "block" }}
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
                      }}
                    >
                      <span style={{ fontSize: "4.5px", color: "#9aa8b8", fontStyle: "italic" }}>
                        {printDate}
                      </span>
                      <span style={{ fontSize: "4.5px", color: "#9aa8b8" }}>★ Handle with care</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}