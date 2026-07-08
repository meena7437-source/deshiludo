import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
    const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
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

    const kycData =
      type === "aadhaar"
        ? {
            uid,
            phone,
            aadhaar_path: filePath,
            status: "pending",
            updated_at: new Date().toISOString(),
          }
        : {
            uid,
            phone,
            pan_path: filePath,
            status: "pending",
            updated_at: new Date().toISOString(),
          };

    const { error: kycError } = await supabaseAdmin
      .from("kyc")
      .upsert(kycData, { onConflict: "uid" });

    if (kycError) {
      return NextResponse.json(
        { success: false, message: kycError.message },
        { status: 500 }
      );
    }

    const userUpdate =
      type === "aadhaar"
        ? {
            aadhaar_path: filePath,
            aadhaar_url: filePath,
            kyc_status: "pending",
          }
        : {
            pan_path: filePath,
            pan_url: filePath,
            kyc_status: "pending",
          };

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