import { NextResponse } from "next/server";
import { scopesInclude } from "@/lib/av-erp/terminal-token-crypto";
import {
  bearerFromRequest,
  resolveIntegrationToken,
  type AvIntegrationTokenRow,
} from "@/lib/av-erp/terminal-tokens";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ALLOWED = new Set(["opportunities", "customers", "catalog"]);

type AuthOk = {
  ok: true;
  admin: SupabaseClient;
  token: AvIntegrationTokenRow;
};
type AuthFail = { ok: false; response: NextResponse };

async function authorize(
  req: Request,
  scope: "read" | "write",
): Promise<AuthOk | AuthFail> {
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Service role not configured" },
        { status: 503 },
      ),
    };
  }

  const bearer = bearerFromRequest(req);
  if (!bearer) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing Bearer token" },
        { status: 401 },
      ),
    };
  }

  const admin = createServiceClient();
  const token = await resolveIntegrationToken(admin, bearer);
  if (!token || !scopesInclude(token.scopes, scope)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            scope === "write"
              ? "Invalid key or missing write scope"
              : "Invalid or revoked key",
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, admin, token };
}

function resourceOr404(resource: string): NextResponse | null {
  if (!ALLOWED.has(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  }
  return null;
}

async function readJson(req: Request): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "JSON object body required" },
          { status: 400 },
        ),
      };
    }
    return { ok: true, body: body as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asOptionalString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = asString(v);
  return s || null;
}

function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Terminal Mode read API (KM Developer/API parity).
 * Authorization: Bearer avk_live_…
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const notFound = resourceOr404(resource);
  if (notFound) return notFound;

  const auth = await authorize(req, "read");
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  if (resource === "customers") {
    const { data, error } = await admin
      .from("av_customers")
      .select(
        "id, name, contact_name, email, phone, city, region, is_retired, updated_at",
      )
      .order("name")
      .limit(500);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  if (resource === "catalog") {
    const [products, services] = await Promise.all([
      admin
        .from("av_products")
        .select("id, name, code, kind, rental_price, sale_price, qty_owned, is_active")
        .order("name")
        .limit(1000),
      admin
        .from("av_services")
        .select("id, name, code, kind, unit_price, is_active")
        .order("name")
        .limit(500),
    ]);
    if (products.error) {
      return NextResponse.json({ error: products.error.message }, { status: 500 });
    }
    if (services.error) {
      return NextResponse.json({ error: services.error.message }, { status: 500 });
    }
    return NextResponse.json({
      data: { products: products.data ?? [], services: services.data ?? [] },
    });
  }

  const { data, error } = await admin
    .from("av_opportunities")
    .select(
      "id, reference, subject, status, customer_id, venue_id, gear_starts_at, gear_ends_at, updated_at",
    )
    .order("reference")
    .limit(500);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/**
 * Write API — requires a key with `write` scope.
 * POST /customers — create customer
 * POST /opportunities — create draft quote (optional subject/customer_id)
 * Catalog is read-only.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const notFound = resourceOr404(resource);
  if (notFound) return notFound;
  if (resource === "catalog") {
    return NextResponse.json(
      { error: "Catalog is read-only via Terminal" },
      { status: 405 },
    );
  }

  const auth = await authorize(req, "write");
  if (!auth.ok) return auth.response;
  const { admin, token } = auth;

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  if (resource === "customers") {
    const name = asString(body.name);
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("av_customers")
      .insert({
        name,
        contact_name: asString(body.contact_name),
        email: asString(body.email).toLowerCase(),
        phone: asString(body.phone),
        address_line1: asString(body.address_line1),
        city: asString(body.city),
        region: asString(body.region),
        postal_code: asString(body.postal_code),
        notes: asString(body.notes),
        standing_discount_pct: Math.min(
          100,
          Math.max(0, asNumber(body.standing_discount_pct)),
        ),
        is_quotable: body.is_quotable === false ? false : true,
        created_by: token.created_by ?? null,
      })
      .select(
        "id, name, contact_name, email, phone, city, region, is_retired, updated_at",
      )
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  }

  const subject = asString(body.subject) || "New quote";
  const customerId = asOptionalString(body.customer_id);
  const { data: defaultRate } = await admin
    .from("av_rate_definitions")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();

  const { data, error } = await admin
    .from("av_opportunities")
    .insert({
      subject,
      status: "draft",
      customer_id: customerId,
      venue_id: asOptionalString(body.venue_id),
      rate_definition_id: defaultRate?.id ?? null,
      created_by: token.created_by ?? null,
      reference: "",
      notes: asString(body.notes),
    })
    .select(
      "id, reference, subject, status, customer_id, venue_id, gear_starts_at, gear_ends_at, updated_at",
    )
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * PATCH /customers — body.id + fields
 * PATCH /opportunities — body.id + safe header fields (not status→closed/order)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const notFound = resourceOr404(resource);
  if (notFound) return notFound;
  if (resource === "catalog") {
    return NextResponse.json(
      { error: "Catalog is read-only via Terminal" },
      { status: 405 },
    );
  }

  const auth = await authorize(req, "write");
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const id = asString(body.id);
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (resource === "customers") {
    const patch: Record<string, unknown> = {};
    if ("name" in body) {
      const name = asString(body.name);
      if (!name) {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      }
      patch.name = name;
    }
    for (const key of [
      "contact_name",
      "phone",
      "address_line1",
      "city",
      "region",
      "postal_code",
      "notes",
    ] as const) {
      if (key in body) patch[key] = asString(body[key]);
    }
    if ("email" in body) patch.email = asString(body.email).toLowerCase();
    if ("standing_discount_pct" in body) {
      patch.standing_discount_pct = Math.min(
        100,
        Math.max(0, asNumber(body.standing_discount_pct)),
      );
    }
    if ("is_quotable" in body) patch.is_quotable = Boolean(body.is_quotable);
    if ("is_retired" in body) patch.is_retired = Boolean(body.is_retired);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("av_customers")
      .update(patch)
      .eq("id", id)
      .select(
        "id, name, contact_name, email, phone, city, region, is_retired, updated_at",
      )
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  }

  const patch: Record<string, unknown> = {};
  if ("subject" in body) {
    const subject = asString(body.subject);
    if (!subject) {
      return NextResponse.json({ error: "subject cannot be empty" }, { status: 400 });
    }
    patch.subject = subject;
  }
  if ("customer_id" in body) patch.customer_id = asOptionalString(body.customer_id);
  if ("venue_id" in body) patch.venue_id = asOptionalString(body.venue_id);
  if ("notes" in body) patch.notes = asString(body.notes);
  if ("transport_notes" in body) {
    patch.transport_notes = asString(body.transport_notes);
  }
  if ("status" in body) {
    const status = asString(body.status);
    if (!["draft", "quotation"].includes(status)) {
      return NextResponse.json(
        {
          error:
            "Terminal may only set status to draft or quotation (use Hub for order/closed)",
        },
        { status: 400 },
      );
    }
    patch.status = status;
  }
  if ("gear_starts_at" in body) {
    patch.gear_starts_at = asOptionalString(body.gear_starts_at);
  }
  if ("gear_ends_at" in body) {
    patch.gear_ends_at = asOptionalString(body.gear_ends_at);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("av_opportunities")
    .update(patch)
    .eq("id", id)
    .select(
      "id, reference, subject, status, customer_id, venue_id, gear_starts_at, gear_ends_at, updated_at",
    )
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

/**
 * DELETE /customers — soft-retire (is_retired=true); body.id required
 * Opportunities are not deleted via Terminal (use Hub).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const notFound = resourceOr404(resource);
  if (notFound) return notFound;
  if (resource !== "customers") {
    return NextResponse.json(
      {
        error:
          resource === "catalog"
            ? "Catalog is read-only via Terminal"
            : "Delete opportunities in the Hub UI, not Terminal",
      },
      { status: 405 },
    );
  }

  const auth = await authorize(req, "write");
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;
  const id = asString(parsed.body.id);
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("av_customers")
    .update({ is_retired: true })
    .eq("id", id)
    .select("id, name, is_retired")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}
