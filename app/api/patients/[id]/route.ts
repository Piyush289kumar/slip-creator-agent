import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Patient from "@/models/Patient";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const patient = await Patient.findById(id).lean();

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: patient });
  } catch (error) {
    console.error("GET /api/patients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patient" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const { name, age, gender, mobile, address, bloodGroup, diagnosis, admissionDate, uhid } = body;

    if (!name || !age || !gender || !mobile) {
      return NextResponse.json(
        { success: false, error: "Name, age, gender, and mobile are required" },
        { status: 400 }
      );
    }

    const patient = await Patient.findByIdAndUpdate(
      id,
      {
        uhid,
        name,
        age: Number(age),
        gender,
        mobile,
        address,
        bloodGroup,
        diagnosis,
        admissionDate: admissionDate ? new Date(admissionDate) : undefined,
      },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: patient });
  } catch (error) {
    console.error("PUT /api/patients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update patient" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const patient = await Patient.findByIdAndDelete(id);

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/patients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete patient" },
      { status: 500 }
    );
  }
}
