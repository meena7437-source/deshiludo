import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function checkAdmin() {
  const cookieStore = await cookies();

  return cookieStore.get("deshiludo_admin")?.value === "yes";
}

export async function GET() {
  try {
    const isAdmin = await checkAdmin();

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized admin access",
        },
        {
          status: 401,
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("site_announcements")
      .select("id,message,is_active,updated_at")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      announcement: data || null,
    });
  } catch (error: unknown) {
    console.error("Admin announcement GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Announcement load नहीं हुआ",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const isAdmin = await checkAdmin();

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized admin access",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json();

    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    const isActive = body?.is_active === true;

    if (isActive && !message) {
      return NextResponse.json(
        {
          success: false,
          message: "Active announcement के लिए message जरूरी है",
        },
        {
          status: 400,
        }
      );
    }

    const { data: currentAnnouncement, error: findError } =
      await supabaseAdmin
        .from("site_announcements")
        .select("id")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (findError) {
      throw findError;
    }

    let result;

    if (currentAnnouncement?.id) {
      result = await supabaseAdmin
        .from("site_announcements")
        .update({
          message,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentAnnouncement.id)
        .select("id,message,is_active,updated_at")
        .single();
    } else {
      result = await supabaseAdmin
        .from("site_announcements")
        .insert({
          message,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .select("id,message,is_active,updated_at")
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      success: true,
      message: "Announcement successfully updated",
      announcement: result.data,
    });
  } catch (error: unknown) {
    console.error("Admin announcement PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Announcement update नहीं हुआ",
      },
      {
        status: 500,
      }
    );
  }
}