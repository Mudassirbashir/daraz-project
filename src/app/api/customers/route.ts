import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const pageInput = parseInt(searchParams.get("page") || "1", 10);
  const limitInput = parseInt(searchParams.get("limit") || "25", 10);
  const page = isNaN(pageInput) || pageInput < 1 ? 1 : pageInput;
  const limit = isNaN(limitInput) || limitInput < 1 ? 25 : Math.min(limitInput, 100);

  const search = searchParams.get("search") || "";
  const filterType = searchParams.get("filter_type") || "all";

  const offset = (page - 1) * limit;

  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query all orders to build aggregated customer profiles
    const { data: allOrders, error } = await supabase
      .from("orders")
      .select("*, daraz_stores(store_name, store_code)");

    if (error) {
      throw new Error(`Database orders query error: ${error.message}`);
    }

    // Customer aggregation map keyed by customer_name + customer_city
    const customerMap: Record<string, any> = {};

    (allOrders || []).forEach((ord) => {
      const name = ord.customer_name || "Customer";
      const key = `${name.toLowerCase()}_${(ord.customer_city || "pk").toLowerCase()}`;

      if (!customerMap[key]) {
        customerMap[key] = {
          id: key,
          name,
          phone: ord.customer_phone || "N/A",
          city: ord.customer_city || "N/A",
          province: "Pakistan",
          ordersCount: 0,
          totalSpendCents: 0,
          deliveredCount: 0,
          canceledCount: 0,
          returnedCount: 0,
          firstOrderDate: ord.order_date,
          lastOrderDate: ord.order_date,
          ordersList: [],
        };
      }

      const c = customerMap[key];
      c.ordersCount += 1;
      c.totalSpendCents += ord.total_amount_cents || 0;
      c.ordersList.push(ord);

      const st = (ord.status || "").toLowerCase();
      if (st === "delivered") c.deliveredCount += 1;
      if (st === "canceled" || st === "failed") c.canceledCount += 1;
      if (st === "returned") c.returnedCount += 1;

      if (new Date(ord.order_date) < new Date(c.firstOrderDate)) {
        c.firstOrderDate = ord.order_date;
      }
      if (new Date(ord.order_date) > new Date(c.lastOrderDate)) {
        c.lastOrderDate = ord.order_date;
      }
    });

    let customerList = Object.values(customerMap).map((c) => ({
      ...c,
      aovCents: Math.round(c.totalSpendCents / Math.max(1, c.ordersCount)),
      isRepeat: c.ordersCount > 1,
      isHighValue: c.totalSpendCents >= 500000, // PKR 5,000+
    }));

    // Filter by type
    if (filterType === "repeat") {
      customerList = customerList.filter((c) => c.isRepeat);
    } else if (filterType === "high_value") {
      customerList = customerList.filter((c) => c.isHighValue);
    } else if (filterType === "returned") {
      customerList = customerList.filter((c) => c.returnedCount > 0);
    } else if (filterType === "canceled") {
      customerList = customerList.filter((c) => c.canceledCount > 0);
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      customerList = customerList.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
      );
    }

    // Calculate Summary Metrics
    const totalCustomers = Object.keys(customerMap).length;
    const repeatCount = Object.values(customerMap).filter((c: any) => c.ordersCount > 1).length;
    const highValueCount = Object.values(customerMap).filter((c: any) => c.totalSpendCents >= 500000).length;

    let totalReturns = 0;
    let totalRefundCents = 0;
    let totalCanceled = 0;

    (allOrders || []).forEach((o: any) => {
      const st = (o.status || "").toLowerCase();
      if (st === "returned") {
        totalReturns += 1;
        totalRefundCents += o.total_amount_cents || 0;
      }
      if (st === "canceled" || st === "failed") {
        totalCanceled += 1;
      }
    });

    const cancellationRate = (allOrders || []).length > 0
      ? ((totalCanceled / (allOrders || []).length) * 100).toFixed(1)
      : "0.0";

    const metrics = {
      totalCustomers,
      newCustomers: totalCustomers - repeatCount,
      returningCustomers: repeatCount,
      highValueCustomers: highValueCount,
      returnsCount: totalReturns,
      refundAmountCents: totalRefundCents,
      cancellationRatePercent: parseFloat(cancellationRate),
    };

    const paginatedList = customerList.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      customers: paginatedList,
      metrics,
      pagination: {
        page,
        limit,
        total: customerList.length,
        totalPages: Math.ceil(customerList.length / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/customers Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch customer records." },
      { status: 500 }
    );
  }
}
