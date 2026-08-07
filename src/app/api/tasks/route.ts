import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const assignee = searchParams.get("assignee") || "all";
  const priority = searchParams.get("priority") || "all";

  const offset = (page - 1) * limit;

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from("tasks")
      .select("*", { count: "exact" });

    if (status !== "all") query = query.eq("status", status);
    if (assignee !== "all") query = query.eq("assigned_to", assignee);
    if (priority !== "all") query = query.eq("priority", priority);

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`title.ilike.${q},description.ilike.${q}`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: tasks, count, error } = await query;

    if (error) {
      throw new Error(`Database tasks query error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      tasks: tasks || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/tasks Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch team tasks." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, assignedTo, status, priority, dueDate } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Task title is required." }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: newTask, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description || null,
        assigned_to: assignedTo || "Mudassir",
        status: status || "todo",
        priority: priority || "medium",
        due_date: dueDate || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Team task created successfully.",
      task: newTask,
    });
  } catch (err: any) {
    console.error("[POST /api/tasks Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create team task." },
      { status: 500 }
    );
  }
}
