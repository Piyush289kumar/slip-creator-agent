"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Patient, PaginationMeta } from "@/types/patient";
import PatientModal from "@/components/PatientModal";
import DeleteDialog from "@/components/DeleteDialog";

const CHIPS = [
  { key: "", label: "All" },
  { key: "Male", label: "Male" },
  { key: "Female", label: "Female" },
  { key: "Other", label: "Other" },
];

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1, limit: 10, total: 0, pages: 0,
  });
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; patient: Patient | null }>({
    open: false, patient: null,
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPatients = useCallback(
    async (page = 1, searchTerm = search) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "10",
          search: searchTerm,
          ...(genderFilter && { gender: genderFilter }),
        });
        const res = await fetch(`/api/patients?${params}`);
        const data = await res.json();
        if (data.success) {
          setPatients(data.data);
          setPagination(data.pagination);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [search, genderFilter]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchPatients(1, search), 300);
    return () => clearTimeout(t);
  }, [search, genderFilter, fetchPatients]);

  const handleDelete = async () => {
    if (!deleteDialog.patient) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/patients/${deleteDialog.patient._id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDeleteDialog({ open: false, patient: null });
        fetchPatients(pagination.page);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (p: Patient) => {
    setEditPatient(p);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900 leading-tight">Hospital Admin</h1>
              <p className="text-[11px] text-gray-400">Patient Management</p>
            </div>
          </div>
          <button
            onClick={() => { setEditPatient(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[13px] font-medium px-3.5 py-2 rounded-xl transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, UHID, or mobile…"
              className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-gray-100 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Gender chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => setGenderFilter(c.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                genderFilter === c.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-24">

        {/* ── STATS ROW ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: pagination.total, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "On page", value: patients.length, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pages", value: pagination.pages, color: "text-violet-600", bg: "bg-violet-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3">
              <div className={`text-[22px] font-semibold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-gray-400 font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── PATIENT CARDS ── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-gray-700">No patients found</p>
            <p className="text-[12px] text-gray-400 mt-1">Try a different search or add a patient</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {patients.map((p) => (
              <PatientCard
                key={p._id}
                patient={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleteDialog({ open: true, patient: p })}
                onSticker={() => router.push(`/patients/${p._id}/sticker`)}
              />
            ))}
          </div>
        )}

        {/* ── PAGINATION ── */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-[12px] text-gray-400">
              {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPatients(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95"
                aria-label="Previous page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-[32px] h-8 rounded-xl bg-blue-600 text-white text-[12px] font-semibold flex items-center justify-center px-2">
                {pagination.page}
              </span>
              <button
                onClick={() => fetchPatients(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95"
                aria-label="Next page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── FAB ── */}
      <div className="fixed bottom-6 right-4 z-20">
        <button
          onClick={() => { setEditPatient(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[14px] font-medium px-5 py-3.5 rounded-2xl shadow-lg shadow-blue-500/30 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New patient
        </button>
      </div>

      <PatientModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditPatient(null); }}
        onSave={() => fetchPatients(pagination.page)}
        patient={editPatient}
      />

      <DeleteDialog
        isOpen={deleteDialog.open}
        patientName={deleteDialog.patient?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, patient: null })}
        loading={deleteLoading}
      />
    </div>
  );
}

/* ── PATIENT CARD COMPONENT ── */
function PatientCard({
  patient: p,
  onEdit,
  onDelete,
  onSticker,
}: {
  patient: Patient;
  onEdit: () => void;
  onDelete: () => void;
  onSticker: () => void;
}) {
  const genderColor =
    p.gender === "Male"
      ? "bg-blue-50 text-blue-700"
      : p.gender === "Female"
      ? "bg-pink-50 text-pink-700"
      : "bg-violet-50 text-violet-700";

  const initials = p.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarColors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ];
  const avatarColor = avatarColors[p.name.charCodeAt(0) % avatarColors.length];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Card top */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-semibold flex-shrink-0 ${avatarColor}`}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-gray-900 truncate">{p.name}</span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${genderColor}`}>
              {p.gender}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="font-mono text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">
              {p.uhid}
            </span>
            <span className="text-[12px] text-gray-400">{p.age} yrs</span>
            {p.bloodGroup && (
              <span className="text-[11px] bg-red-50 text-red-600 font-semibold px-1.5 py-0.5 rounded-md">
                {p.bloodGroup}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Divider row */}
      <div className="mx-4 border-t border-gray-100" />

      {/* Bottom row: meta + actions */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Mobile */}
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-[12px] text-gray-500 font-mono">{p.mobile}</span>
          </div>
          {/* Date */}
          {p.admissionDate && (
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] text-gray-400">
                {new Date(p.admissionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSticker}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 active:scale-90 transition-all"
            aria-label="Print sticker"
            title="Print sticker"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <button
            onClick={onEdit}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-blue-600 hover:bg-blue-50 active:scale-90 transition-all"
            aria-label="Edit patient"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 active:scale-90 transition-all"
            aria-label="Delete patient"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}