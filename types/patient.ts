export interface Patient {
  _id: string;
  uhid: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  mobile: string;
  address?: string;
  bloodGroup?: string;
  diagnosis?: string;
  admissionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientFormData {
  uhid: string;
  name: string;
  age: string;
  gender: "Male" | "Female" | "Other" | "";
  mobile: string;
  address: string;
  bloodGroup: string;
  diagnosis: string;
  admissionDate: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
