import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const body = await req.json();
    const { title, description, assigned_to, status, priority, due_date } = body;

    const supabase = createAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assigned_to) updateData.assigned_to = assigned_to;
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (due_date !== undefined) updateData.due_date = due_date;

    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Team task updated successfully.",
      task: updatedTask,
    });
  } catch (err: any) {
    console.error("[PATCH /api/tasks/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update team task." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Team task deleted successfully.",
    });
  } catch (err: any) {
    console.error("[DELETE /api/tasks/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete team task." },
      { status: 500 }
    );
  }
}
