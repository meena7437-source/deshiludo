import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type KycUpsertData = {
  uid: string;
  phone: string;
  aadhaar_path?: string;
  pan_path?: string;
  status: string;
  updated_at: string;
};

type UserUpdateData = {
  aadhaar_path?: string;
  aadhaar_url?: string;
  pan_path?: string;
  pan_url?: string;
  kyc_status: string;
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const uid = String(formData.get("uid") || "");
    const phone = String(formData.get("phone") || "");
    const type = String(formData.get("type") || "");
    const file = formData.get("file") as File | null;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "UID missing" },
        { status: 400 }
      );
    }

    if (type !== "aadhaar" && type !== "pan") {
      return NextResponse.json(
        { success: false, message: "Invalid document type" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File missing" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "Sirf image ya PDF upload karo" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "File 5MB se chhoti honi chahiye" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const filePath = `${uid}/${type}-${Date.now()}.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("kyc-documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, message: uploadError.message },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    const kycData: KycUpsertData = {
      uid,
      phone,
      status: "pending",
      updated_at: now,
    };

    const userUpdate: UserUpdateData = {
      kyc_status: "pending",
    };

    if (type === "aadhaar") {
      kycData.aadhaar_path = filePath;
      userUpdate.aadhaar_path = filePath;
      userUpdate.aadhaar_url = filePath;
    }

    if (type === "pan") {
      kycData.pan_path = filePath;
      userUpdate.pan_path = filePath;
      userUpdate.pan_url = filePath;
    }

    const { error: kycError } = await supabaseAdmin
      .from("kyc")
      .upsert(kycData, { onConflict: "uid" });

    if (kycError) {
      return NextResponse.json(
        { success: false, message: kycError.message },
        { status: 500 }
      );
    }

    const { error: userError } = await supabaseAdmin
      .from("users")
      .update(userUpdate)
      .eq("firebase_uid", uid);

    if (userError) {
      return NextResponse.json(
        { success: false, message: userError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "KYC document uploaded",
      path: filePath,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Upload failed" },
      { status: 500 }
    );
  }
}