import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "../../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username aur password required hai" },
        { status: 400 }
      );
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, username, password, role, is_active")
      .eq("username", username)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Invalid username ya password" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, message: "Invalid username ya password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Admin login successful",
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role || "admin",
      },
    });

    response.cookies.set("deshiludo_admin", admin.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    response.cookies.set("deshiludo_admin_role", admin.role || "admin", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
}