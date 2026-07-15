import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function checkAdmin() {
  const cookieStore = await cookies();

  return cookieStore.get("deshiludo_admin")?.value === "yes";
}

/*
|--------------------------------------------------------------------------
| GET Announcement
|--------------------------------------------------------------------------
| Admin:
| - Active और inactive दोनों announcement देख सकता है।
|
| Normal user:
| - केवल active announcement देख सकता है।
|--------------------------------------------------------------------------
*/

export async function GET() {
  try {
    const isAdmin = await checkAdmin();

    let query = supabaseAdmin
      .from("site_announcements")
      .select("id,message,is_active,updated_at")
      .order("id", { ascending: true })
      .limit(1);

    if (!isAdmin) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        announcement: data || null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Announcement GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Announcement load नहीं हुआ",
        announcement: null,
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| PUT Announcement
|--------------------------------------------------------------------------
| केवल admin announcement save/change कर सकता है।
|--------------------------------------------------------------------------
*/

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

    if (message.length > 300) {
      return NextResponse.json(
        {
          success: false,
          message: "Announcement अधिकतम 300 अक्षर का हो सकता है",
        },
        {
          status: 400,
        }
      );
    }

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

    const announcementData = {
      message,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (currentAnnouncement?.id) {
      result = await supabaseAdmin
        .from("site_announcements")
        .update(announcementData)
        .eq("id", currentAnnouncement.id)
        .select("id,message,is_active,updated_at")
        .single();
    } else {
      result = await supabaseAdmin
        .from("site_announcements")
        .insert(announcementData)
        .select("id,message,is_active,updated_at")
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json(
      {
        success: true,
        message: isActive
          ? "Announcement सभी users के लिए चालू हो गया"
          : "Announcement बंद कर दिया गया",
        announcement: result.data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
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