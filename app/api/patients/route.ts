import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Patient from "@/models/Patient";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { uhid: { $regex: search, $options: "i" } },
            { mobile: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [patients, total] = await Promise.all([
      Patient.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Patient.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: patients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/patients error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const { name, age, gender, mobile, address, bloodGroup, diagnosis, admissionDate, uhid } = body;

    if (!name || !age || !gender || !mobile) {
      return NextResponse.json(
        { success: false, error: "Name, age, gender, and mobile are required" },
        { status: 400 }
      );
    }

    const patient = await Patient.create({
      uhid,
      name,
      age: Number(age),
      gender,
      mobile,
      address,
      bloodGroup,
      diagnosis,
      admissionDate: admissionDate ? new Date(admissionDate) : undefined,
    });

    return NextResponse.json({ success: true, data: patient }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/patients error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { success: false, error: "UHID already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create patient" },
      { status: 500 }
    );
  }
}
