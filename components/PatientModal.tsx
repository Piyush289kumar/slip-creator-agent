// /components/PatientModal.tsx

"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Patient, PatientFormData } from "@/types/patient";

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  patient?: Patient | null;
}

type FormErrors = Partial<Record<keyof PatientFormData, string>>;

const emptyForm: PatientFormData = {
  uhid: "",
  name: "",
  age: "",
  gender: "",
  mobile: "",
  address: "",
  bloodGroup: "",
  diagnosis: "",
  admissionDate: "",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Indian 10-digit mobile numbers start with 6-9. Adjust if you need a
// different country format.
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/;
const UHID_REGEX = /^[A-Za-z0-9-]{3,20}$/;

function validateField(field: keyof PatientFormData, value: string): string | undefined {
  const v = value.trim();

  switch (field) {
    case "name":
      if (!v) return "Patient name is required";
      if (v.length < 2) return "Name must be at least 2 characters";
      if (!NAME_REGEX.test(v)) return "Name can only contain letters, spaces, and - ' .";
      return undefined;

    case "age": {
      if (!v) return "Age is required";
      if (!/^\d+$/.test(v)) return "Age must be a whole number";
      const ageNum = Number(v);
      if (ageNum < 0 || ageNum > 150) return "Age must be between 0 and 150";
      return undefined;
    }

    case "gender":
      if (!v) return "Please select a gender";
      return undefined;

    case "mobile":
      if (!v) return "Mobile number is required";
      if (!MOBILE_REGEX.test(v)) return "Enter a valid 10-digit mobile number";
      return undefined;

    case "uhid":
      if (v && !UHID_REGEX.test(v)) return "UHID must be 3-20 letters, numbers, or hyphens";
      return undefined;

    case "admissionDate": {
      if (!v) return undefined;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "Enter a valid date";
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (d > today) return "Admission date cannot be in the future";
      return undefined;
    }

    case "diagnosis":
      if (v.length > 200) return "Diagnosis must be under 200 characters";
      return undefined;

    case "address":
      if (v.length > 300) return "Address must be under 300 characters";
      return undefined;

    default:
      return undefined;
  }
}

function validateForm(form: PatientFormData): FormErrors {
  const errors: FormErrors = {};
  (Object.keys(form) as (keyof PatientFormData)[]).forEach((field) => {
    const message = validateField(field, form[field]);
    if (message) errors[field] = message;
  });
  return errors;
}

export default function PatientModal({ isOpen, onClose, onSave, patient }: PatientModalProps) {
  const [form, setForm] = useState<PatientFormData>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof PatientFormData, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (patient) {
      setForm({
        uhid: patient.uhid || "",
        name: patient.name || "",
        age: String(patient.age) || "",
        gender: patient.gender || "",
        mobile: patient.mobile || "",
        address: patient.address || "",
        bloodGroup: patient.bloodGroup || "",
        diagnosis: patient.diagnosis || "",
        admissionDate: patient.admissionDate ? patient.admissionDate.split("T")[0] : "",
      });
    } else {
      setForm({
        ...emptyForm,
        admissionDate: new Date().toISOString().split("T")[0], // YYYY-MM-DD
      });
      
    }
    setErrors({});
    setTouched({});
    setAttempted(false);
    setServerError("");
  }, [patient, isOpen]);

  // Lock body scroll while the sheet is open, and restore focus to the
  // first field so mobile keyboards open in the right place.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (loading) return;
    onClose();
  }, [loading, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const field = name as keyof PatientFormData;
    setForm((prev) => ({ ...prev, [field]: value }));

    if (touched[field] || attempted) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const field = name as keyof PatientFormData;
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const formErrors = validateForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setAttempted(true);
      setTouched(
        (Object.keys(form) as (keyof PatientFormData)[]).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {} as Record<keyof PatientFormData, boolean>
        )
      );
      panelRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    setLoading(true);
    try {
      const url = patient ? `/api/patients/${patient._id}` : "/api/patients";
      const method = patient ? "PUT" : "POST";

      const payload: PatientFormData = {
        ...form,
        uhid: form.uhid.trim(),
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim(),
        diagnosis: form.diagnosis.trim(),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setServerError(data.error || "Something went wrong. Please try again.");
        return;
      }

      onSave();
      onClose();
    } catch {
      setServerError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const showError = (field: keyof PatientFormData) =>
    (touched[field] || attempted) && Boolean(errors[field]);

  const inputClass = (field: keyof PatientFormData) =>
    `w-full rounded-xl border px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50 transition-colors ${showError(field)
      ? "border-red-300 focus:ring-red-400"
      : "border-gray-200 focus:ring-blue-500"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
      >
        {/* Drag handle - mobile only */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 bg-gradient-to-r from-blue-600 to-cyan-500">
          <div className="h-1.5 w-10 rounded-full bg-white/40" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-cyan-500 px-5 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="patient-modal-title" className="text-white text-lg sm:text-xl font-bold">
              {patient ? "Edit Patient" : "Add New Patient"}
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm">Hospital Patient Management</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-white hover:bg-white/20 active:bg-white/30 rounded-lg p-2.5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0">
          {/* Scrollable body */}
          <div
            className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {serverError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* UHID */}
              <div>
                <label htmlFor="uhid" className="block text-sm font-medium text-gray-700 mb-1">
                  UHID No. <span className="text-gray-400 font-normal">(auto-generated if blank)</span>
                </label>
                <input
                  id="uhid"
                  type="text"
                  name="uhid"
                  value={form.uhid}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={20}
                  placeholder="e.g. UHID000001"
                  aria-invalid={showError("uhid")}
                  aria-describedby={showError("uhid") ? "uhid-error" : undefined}
                  className={inputClass("uhid")}
                />
                {showError("uhid") && (
                  <p id="uhid-error" className="text-red-600 text-xs mt-1">{errors.uhid}</p>
                )}
              </div>

              {/* Patient Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  ref={nameInputRef}
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={100}
                  placeholder="Full name"
                  aria-required="true"
                  aria-invalid={showError("name")}
                  aria-describedby={showError("name") ? "name-error" : undefined}
                  className={inputClass("name")}
                />
                {showError("name") && (
                  <p id="name-error" className="text-red-600 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              {/* Diagnosis */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="diagnosis" className="block text-sm font-medium text-gray-700">
                    Fathers/Husbands Name  <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-400">{form.diagnosis.length}/200</span>
                </div>
                <input
                  id="diagnosis"
                  type="text"
                  name="diagnosis"
                  value={form.diagnosis}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required={true}
                  aria-required="true"
                  maxLength={200}
                  placeholder="Father's/Husbands name"
                  aria-invalid={showError("diagnosis")}
                  aria-describedby={showError("diagnosis") ? "diagnosis-error" : undefined}
                  className={inputClass("diagnosis")}
                />
                {showError("diagnosis") && (
                  <p id="diagnosis-error" className="text-red-600 text-xs mt-1">{errors.diagnosis}</p>
                )}
              </div>

              {/* Age */}
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  name="age"
                  value={form.age}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min={0}
                  max={150}
                  placeholder="Years"
                  aria-required="true"
                  aria-invalid={showError("age")}
                  aria-describedby={showError("age") ? "age-error" : undefined}
                  className={inputClass("age")}
                />
                {showError("age") && (
                  <p id="age-error" className="text-red-600 text-xs mt-1">{errors.age}</p>
                )}
              </div>

              {/* Gender */}
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-required="true"
                  aria-invalid={showError("gender")}
                  aria-describedby={showError("gender") ? "gender-error" : undefined}
                  className={inputClass("gender")}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {showError("gender") && (
                  <p id="gender-error" className="text-red-600 text-xs mt-1">{errors.gender}</p>
                )}
              </div>

              {/* Mobile */}
              <div>
                <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile No. <span className="text-red-500">*</span>
                </label>
                <input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  aria-required="true"
                  aria-invalid={showError("mobile")}
                  aria-describedby={showError("mobile") ? "mobile-error" : undefined}
                  className={inputClass("mobile")}
                />
                {showError("mobile") && (
                  <p id="mobile-error" className="text-red-600 text-xs mt-1">{errors.mobile}</p>
                )}
              </div>

              {/* Blood Group */}
              <div>
                <label htmlFor="bloodGroup" className="block text-sm font-medium text-gray-700 mb-1">
                  Blood Group
                </label>
                <select
                  id="bloodGroup"
                  name="bloodGroup"
                  value={form.bloodGroup}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={inputClass("bloodGroup")}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              {/* Admission Date */}
              <div>
                <label htmlFor="admissionDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Date  <span className="text-red-500">*</span>
                </label>
                <input
                  id="admissionDate"
                  type="date"
                  name="admissionDate"
                  required={true}
                  aria-required="true"
                  value={form.admissionDate}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  max={new Date().toISOString().split("T")[0]}
                  aria-invalid={showError("admissionDate")}
                  aria-describedby={showError("admissionDate") ? "admissionDate-error" : undefined}
                  className={inputClass("admissionDate")}
                />
                {showError("admissionDate") && (
                  <p id="admissionDate-error" className="text-red-600 text-xs mt-1">{errors.admissionDate}</p>
                )}
              </div>

            </div>

            {/* Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <span className="text-xs text-gray-400">{form.address.length}/300</span>
              </div>
              <textarea
                id="address"
                name="address"
                value={form.address}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={3}
                maxLength={300}
                placeholder="Patient address"
                aria-invalid={showError("address")}
                aria-describedby={showError("address") ? "address-error" : undefined}
                className={`${inputClass("address")} resize-none`}
              />
              {showError("address") && (
                <p id="address-error" className="text-red-600 text-xs mt-1">{errors.address}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex-shrink-0 border-t border-gray-100 px-5 sm:px-6 pt-4 flex gap-3"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3.5 text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? "Saving..." : patient ? "Update Patient" : "Add Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}