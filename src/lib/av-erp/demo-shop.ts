/**
 * Idempotent sample AV shop fixtures for local seed + Overview "Load sample shop".
 * Rows are tagged with external_rms_id / notes prefix hub-demo: so re-runs skip.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_PREFIX = "hub-demo:";

const IDS = {
  customerAcme: "a1111111-1111-4111-8111-111111111101",
  customerCoastal: "a1111111-1111-4111-8111-111111111102",
  venueBallroom: "a2222222-2222-4222-8222-222222222201",
  venueRooftop: "a2222222-2222-4222-8222-222222222202",
  groupAudio: "a3333333-3333-4333-8333-333333333301",
  groupLighting: "a3333333-3333-4333-8333-333333333302",
  productSpeaker: "a4444444-4444-4444-8444-444444444401",
  productMic: "a4444444-4444-4444-8444-444444444402",
  productCable: "a4444444-4444-4444-8444-444444444403",
  productUplight: "a4444444-4444-4444-8444-444444444404",
  serviceTech: "a5555555-5555-4555-8555-555555555501",
  serviceTruck: "a5555555-5555-4555-8555-555555555502",
  supplierLocal: "a6666666-6666-4666-8666-666666666601",
  oppDraft: "a7777777-7777-4777-8777-777777777701",
  oppQuotation: "a7777777-7777-4777-8777-777777777702",
  groupDraft: "a8888888-8888-4888-8888-888888888801",
  groupQuote: "a8888888-8888-4888-8888-888888888802",
  lineSpeaker: "a9999999-9999-4999-8999-999999999901",
  lineMic: "a9999999-9999-4999-8999-999999999902",
  lineTech: "a9999999-9999-4999-8999-999999999903",
  lineText: "a9999999-9999-4999-8999-999999999904",
  lineSpeakerQ: "a9999999-9999-4999-8999-999999999905",
  lineUplightQ: "a9999999-9999-4999-8999-999999999906",
  lineTruckQ: "a9999999-9999-4999-8999-999999999907",
  activity: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaa01",
} as const;

function easternWindow(daysFromNow: number, hourStart: number, hourEnd: number) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysFromNow);
  start.setUTCHours(hourStart + 4, 0, 0, 0); // rough ET→UTC for seed
  const end = new Date(start);
  end.setUTCHours(hourEnd + 4, 0, 0, 0);
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type DemoShopResult =
  | { ok: true; alreadyLoaded: boolean; message: string }
  | { ok: false; error: string };

/** True when the sample quotation (last fixture) already exists. */
export async function demoShopAlreadyLoaded(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data } = await supabase
    .from("av_opportunities")
    .select("id")
    .eq("external_rms_id", `${DEMO_PREFIX}opp-quotation`)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Insert sample catalog, customers, venues, supplier, two quotes (draft +
 * reserved quotation with holds), and one activity. Safe to call repeatedly.
 */
export async function loadDemoShop(
  supabase: SupabaseClient,
  createdBy: string | null,
): Promise<DemoShopResult> {
  if (await demoShopAlreadyLoaded(supabase)) {
    return {
      ok: true,
      alreadyLoaded: true,
      message: "Sample shop is already loaded.",
    };
  }

  const { data: defaultRate } = await supabase
    .from("av_rate_definitions")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();
  const rateId = (defaultRate?.id as string | undefined) ?? null;

  const { error: custErr } = await supabase.from("av_customers").upsert(
    [
      {
        id: IDS.customerAcme,
        name: "Acme Productions",
        contact_name: "Jordan Lee",
        email: "jordan@acme-productions.example",
        phone: "401-555-0101",
        address_line1: "",
        address_line2: "",
        city: "Providence",
        region: "RI",
        postal_code: "02903",
        country: "US",
        standing_discount_pct: 0,
        notes: "Sample shop customer (hub-demo).",
        is_quotable: true,
        is_retired: false,
        external_rms_id: `${DEMO_PREFIX}customer-acme`,
        created_by: createdBy,
      },
      {
        id: IDS.customerCoastal,
        name: "Coastal Weddings LLC",
        contact_name: "Sam Rivera",
        email: "sam@coastal-weddings.example",
        phone: "401-555-0144",
        address_line1: "",
        address_line2: "",
        city: "Warwick",
        region: "RI",
        postal_code: "02886",
        country: "US",
        standing_discount_pct: 5,
        notes: "Sample shop customer (hub-demo).",
        is_quotable: true,
        is_retired: false,
        external_rms_id: `${DEMO_PREFIX}customer-coastal`,
        created_by: createdBy,
      },
    ],
    { onConflict: "id" },
  );
  if (custErr) return { ok: false, error: custErr.message };

  const { error: venueErr } = await supabase.from("av_job_venues").upsert(
    [
      {
        id: IDS.venueBallroom,
        name: "Grand Ballroom",
        contact_name: "Front desk",
        email: "events@grandballroom.example",
        phone: "401-555-0200",
        address_line1: "100 Harbor St",
        address_line2: "",
        city: "Providence",
        region: "RI",
        postal_code: "02903",
        country: "US",
        access_notes: "Loading dock on east side.",
        power_notes: "2x 50A shore power.",
        parking_notes: "Vendor lot behind venue.",
        notes: "",
        is_retired: false,
        external_rms_id: `${DEMO_PREFIX}venue-ballroom`,
        created_by: createdBy,
      },
      {
        id: IDS.venueRooftop,
        name: "Rooftop Deck",
        contact_name: "Ops",
        email: "ops@rooftop.example",
        phone: "401-555-0211",
        address_line1: "",
        address_line2: "",
        city: "Providence",
        region: "RI",
        postal_code: "",
        country: "US",
        access_notes: "Freight elevator to roof.",
        power_notes: "Limited circuits — bring distro.",
        parking_notes: "",
        notes: "",
        is_retired: false,
        external_rms_id: `${DEMO_PREFIX}venue-rooftop`,
        created_by: createdBy,
      },
    ],
    { onConflict: "id" },
  );
  if (venueErr) return { ok: false, error: venueErr.message };

  const { error: groupErr } = await supabase.from("av_product_groups").upsert(
    [
      {
        id: IDS.groupAudio,
        name: "Audio (sample)",
        sort_order: 10,
        is_active: true,
      },
      {
        id: IDS.groupLighting,
        name: "Lighting (sample)",
        sort_order: 20,
        is_active: true,
      },
    ],
    { onConflict: "id" },
  );
  if (groupErr) return { ok: false, error: groupErr.message };

  const { error: productErr } = await supabase.from("av_products").upsert(
    [
      {
        id: IDS.productSpeaker,
        group_id: IDS.groupAudio,
        name: "QSC K12.2 Speaker",
        code: "SPK-K12",
        description: "",
        kind: "rental",
        rental_price: 85,
        qty_owned: 8,
        buffer_pct: 10,
        turnaround_hours: 4,
        is_active: true,
        external_rms_id: `${DEMO_PREFIX}product-speaker`,
      },
      {
        id: IDS.productMic,
        group_id: IDS.groupAudio,
        name: "Shure ULXD Handheld",
        code: "MIC-ULXD",
        description: "",
        kind: "rental",
        rental_price: 65,
        qty_owned: 12,
        buffer_pct: 5,
        turnaround_hours: 2,
        is_active: true,
        external_rms_id: `${DEMO_PREFIX}product-mic`,
      },
      {
        id: IDS.productCable,
        group_id: IDS.groupAudio,
        name: "XLR Cable 25ft",
        code: "CAB-XLR25",
        description: "",
        kind: "consumable",
        rental_price: 0,
        sale_price: 18,
        qty_owned: 40,
        buffer_pct: 0,
        turnaround_hours: 0,
        is_active: true,
        external_rms_id: `${DEMO_PREFIX}product-cable`,
      },
      {
        id: IDS.productUplight,
        group_id: IDS.groupLighting,
        name: "Chauvet SlimPAR Pro",
        code: "LT-SLIM",
        description: "",
        kind: "rental",
        rental_price: 25,
        qty_owned: 24,
        buffer_pct: 10,
        turnaround_hours: 2,
        is_active: true,
        external_rms_id: `${DEMO_PREFIX}product-uplight`,
      },
    ],
    { onConflict: "id" },
  );
  if (productErr) return { ok: false, error: productErr.message };

  const { error: serviceErr } = await supabase.from("av_services").upsert(
    [
      {
        id: IDS.serviceTech,
        name: "A1 Tech (day)",
        code: "SVC-A1",
        description: "",
        kind: "crew",
        unit_price: 550,
        is_active: true,
        external_rms_id: `${DEMO_PREFIX}service-tech`,
      },
      {
        id: IDS.serviceTruck,
        name: "Box truck run",
        code: "SVC-TRUCK",
        description: "",
        kind: "transport",
        unit_price: 175,
        is_active: true,
        external_rms_id: `${DEMO_PREFIX}service-truck`,
      },
    ],
    { onConflict: "id" },
  );
  if (serviceErr) return { ok: false, error: serviceErr.message };

  const { error: supplierErr } = await supabase.from("av_suppliers").upsert(
    {
      id: IDS.supplierLocal,
      name: "First Coast Subhire",
      contact_name: "Alex",
      email: "desk@firstcoast-subhire.example",
      phone: "401-555-0300",
      notes: "Sample supplier (hub-demo).",
      is_active: true,
      external_rms_id: `${DEMO_PREFIX}supplier-local`,
      created_by: createdBy,
    },
    { onConflict: "id" },
  );
  if (supplierErr) return { ok: false, error: supplierErr.message };

  const draftWin = easternWindow(10, 8, 22);
  const quoteWin = easternWindow(5, 7, 23);

  const { error: oppErr } = await supabase.from("av_opportunities").upsert(
    [
      {
        id: IDS.oppDraft,
        reference: "",
        subject: "Acme product launch (sample draft)",
        status: "draft",
        customer_id: IDS.customerAcme,
        venue_id: IDS.venueBallroom,
        rate_definition_id: rateId,
        gear_starts_at: draftWin.start,
        gear_ends_at: draftWin.end,
        charge_starts_at: draftWin.start,
        charge_ends_at: draftWin.end,
        bill_whole_event: false,
        surcharge_pct: 0,
        discount_pct: 0,
        venue_markup_enabled: true,
        venue_markup_pct: 15,
        transport_notes: "",
        notes: "Sample draft estimate (hub-demo).",
        is_template: false,
        share_enabled: false,
        external_rms_id: `${DEMO_PREFIX}opp-draft`,
        created_by: createdBy,
      },
      {
        id: IDS.oppQuotation,
        reference: "",
        subject: "Coastal wedding ceremony (sample quotation)",
        status: "quotation",
        customer_id: IDS.customerCoastal,
        venue_id: IDS.venueRooftop,
        rate_definition_id: rateId,
        gear_starts_at: quoteWin.start,
        gear_ends_at: quoteWin.end,
        charge_starts_at: quoteWin.start,
        charge_ends_at: quoteWin.end,
        bill_whole_event: false,
        surcharge_pct: 0,
        discount_pct: 0,
        venue_markup_enabled: false,
        venue_markup_pct: 0,
        transport_notes: "",
        notes: "Sample reserved quotation (hub-demo).",
        is_template: false,
        share_enabled: false,
        external_rms_id: `${DEMO_PREFIX}opp-quotation`,
        created_by: createdBy,
      },
    ],
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (oppErr) return { ok: false, error: oppErr.message };

  const { error: secErr } = await supabase.from("av_opportunity_groups").upsert(
    [
      {
        id: IDS.groupDraft,
        opportunity_id: IDS.oppDraft,
        name: "Main PA",
        sort_order: 0,
      },
      {
        id: IDS.groupQuote,
        opportunity_id: IDS.oppQuotation,
        name: "Ceremony",
        sort_order: 0,
      },
    ],
    { onConflict: "id" },
  );
  if (secErr) return { ok: false, error: secErr.message };

  const { error: lineErr } = await supabase.from("av_opportunity_lines").upsert(
    [
      {
        id: IDS.lineSpeaker,
        opportunity_id: IDS.oppDraft,
        group_id: IDS.groupDraft,
        product_id: IDS.productSpeaker,
        description: "QSC K12.2 Speaker",
        qty: 4,
        unit_price: 85,
        sort_order: 0,
      },
      {
        id: IDS.lineMic,
        opportunity_id: IDS.oppDraft,
        group_id: IDS.groupDraft,
        product_id: IDS.productMic,
        description: "Shure ULXD Handheld",
        qty: 2,
        unit_price: 65,
        sort_order: 1,
      },
      {
        id: IDS.lineTech,
        opportunity_id: IDS.oppDraft,
        group_id: IDS.groupDraft,
        service_id: IDS.serviceTech,
        description: "A1 Tech (day)",
        qty: 1,
        unit_price: 550,
        sort_order: 2,
      },
      {
        id: IDS.lineText,
        opportunity_id: IDS.oppDraft,
        group_id: IDS.groupDraft,
        description: "Custom stage skirt (text rental)",
        qty: 1,
        unit_price: 120,
        text_kind: "rental",
        sort_order: 3,
      },
      {
        id: IDS.lineSpeakerQ,
        opportunity_id: IDS.oppQuotation,
        group_id: IDS.groupQuote,
        product_id: IDS.productSpeaker,
        description: "QSC K12.2 Speaker",
        qty: 2,
        unit_price: 85,
        sort_order: 0,
      },
      {
        id: IDS.lineUplightQ,
        opportunity_id: IDS.oppQuotation,
        group_id: IDS.groupQuote,
        product_id: IDS.productUplight,
        description: "Chauvet SlimPAR Pro",
        qty: 8,
        unit_price: 25,
        sort_order: 1,
      },
      {
        id: IDS.lineTruckQ,
        opportunity_id: IDS.oppQuotation,
        group_id: IDS.groupQuote,
        service_id: IDS.serviceTruck,
        description: "Box truck run",
        qty: 1,
        unit_price: 175,
        sort_order: 2,
      },
    ],
    { onConflict: "id" },
  );
  if (lineErr) return { ok: false, error: lineErr.message };

  // Holds have no natural external key — delete sample-quote holds then reinsert.
  await supabase
    .from("av_holds")
    .delete()
    .eq("opportunity_id", IDS.oppQuotation);
  const { error: holdErr } = await supabase.from("av_holds").insert([
    {
      opportunity_id: IDS.oppQuotation,
      line_id: IDS.lineSpeakerQ,
      product_id: IDS.productSpeaker,
      qty: 2,
      starts_at: quoteWin.start,
      ends_at: quoteWin.end,
      created_by: createdBy,
    },
    {
      opportunity_id: IDS.oppQuotation,
      line_id: IDS.lineUplightQ,
      product_id: IDS.productUplight,
      qty: 8,
      starts_at: quoteWin.start,
      ends_at: quoteWin.end,
      created_by: createdBy,
    },
  ]);
  if (holdErr) return { ok: false, error: holdErr.message };

  const { error: actErr } = await supabase.from("av_activities").upsert(
    {
      id: IDS.activity,
      opportunity_id: IDS.oppQuotation,
      subject: "Confirm power drop with venue (sample)",
      kind: "task",
      due_at: quoteWin.start,
      notes: "Sample activity (hub-demo).",
      created_by: createdBy,
    },
    { onConflict: "id" },
  );
  if (actErr) return { ok: false, error: actErr.message };

  return {
    ok: true,
    alreadyLoaded: false,
    message:
      "Sample shop loaded: 2 customers, 2 venues, catalog gear/services, a draft estimate, and a reserved quotation ready for warehouse checkout.",
  };
}

/**
 * Remove hub-demo sample shop rows (quotes/events, catalog, customers, etc.)
 * and any invoices drafted from those sample quotes. Safe when already empty.
 */
export async function clearDemoShop(
  supabase: SupabaseClient,
): Promise<DemoShopResult> {
  if (!(await demoShopAlreadyLoaded(supabase))) {
    return {
      ok: true,
      alreadyLoaded: false,
      message: "No sample shop to clear.",
    };
  }

  const { data: demoOpps, error: oppListErr } = await supabase
    .from("av_opportunities")
    .select("id")
    .like("external_rms_id", `${DEMO_PREFIX}%`);
  if (oppListErr) return { ok: false, error: oppListErr.message };
  const oppIds = (demoOpps ?? []).map((o) => o.id as string);

  const demoCustomerIds = [IDS.customerAcme, IDS.customerCoastal];

  // Invoices / activities reference opportunities & customers with NO ACTION.
  if (oppIds.length > 0) {
    const { error: invOppErr } = await supabase
      .from("av_invoices")
      .delete()
      .in("opportunity_id", oppIds);
    if (invOppErr) return { ok: false, error: invOppErr.message };

    const { error: actErr } = await supabase
      .from("av_activities")
      .delete()
      .in("opportunity_id", oppIds);
    if (actErr) return { ok: false, error: actErr.message };

    const { error: oppDelErr } = await supabase
      .from("av_opportunities")
      .delete()
      .in("id", oppIds);
    if (oppDelErr) return { ok: false, error: oppDelErr.message };
  }

  const { error: invCustErr } = await supabase
    .from("av_invoices")
    .delete()
    .in("customer_id", demoCustomerIds);
  if (invCustErr) return { ok: false, error: invCustErr.message };

  // Fixed activity id (in case opportunity link was cleared already).
  await supabase.from("av_activities").delete().eq("id", IDS.activity);

  const { error: productErr } = await supabase
    .from("av_products")
    .delete()
    .like("external_rms_id", `${DEMO_PREFIX}%`);
  if (productErr) return { ok: false, error: productErr.message };

  const { error: serviceErr } = await supabase
    .from("av_services")
    .delete()
    .like("external_rms_id", `${DEMO_PREFIX}%`);
  if (serviceErr) return { ok: false, error: serviceErr.message };

  const { error: groupErr } = await supabase
    .from("av_product_groups")
    .delete()
    .in("id", [IDS.groupAudio, IDS.groupLighting]);
  if (groupErr) return { ok: false, error: groupErr.message };

  // Null supplier refs on any leftover costs, then delete sample supplier.
  await supabase
    .from("av_job_costs")
    .update({ supplier_id: null })
    .eq("supplier_id", IDS.supplierLocal);

  const { error: supplierErr } = await supabase
    .from("av_suppliers")
    .delete()
    .like("external_rms_id", `${DEMO_PREFIX}%`);
  if (supplierErr) return { ok: false, error: supplierErr.message };

  const { error: custErr } = await supabase
    .from("av_customers")
    .delete()
    .like("external_rms_id", `${DEMO_PREFIX}%`);
  if (custErr) return { ok: false, error: custErr.message };

  const { error: venueErr } = await supabase
    .from("av_job_venues")
    .delete()
    .like("external_rms_id", `${DEMO_PREFIX}%`);
  if (venueErr) return { ok: false, error: venueErr.message };

  return {
    ok: true,
    alreadyLoaded: false,
    message:
      "Sample shop cleared — demo estimates, catalog, customers, venues, and related invoices removed.",
  };
}
