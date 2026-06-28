import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPatient extends Document {
  uhid: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  mobile: string;
  address?: string;
  bloodGroup?: string;
  diagnosis?: string;
  admissionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    uhid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 150,
    },
    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female", "Other"],
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""],
    },
    diagnosis: {
      type: String,
      trim: true,
    },
    admissionDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-generate UHID if not provided
// ✅ NEW - remove next from params and remove next() call
PatientSchema.pre("validate", async function () {
  if (!this.uhid) {
    const count = await (this.constructor as Model<IPatient>).countDocuments();
    this.uhid = `UHID${String(count + 1).padStart(6, "0")}`;
  }
});

const Patient: Model<IPatient> =
  mongoose.models.Patient || mongoose.model<IPatient>("Patient", PatientSchema);

export default Patient;
