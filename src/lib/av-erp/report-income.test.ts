import { describe, expect, it } from "vitest";
import {
  aggregateCustomerIncome,
  aggregateNamedIncome,
  buildContactRows,
  buildTextItemRows,
  filterTextRentals,
  filterTextSales,
  lineAmount,
} from "./report-income";

describe("report income helpers", () => {
  it("computes line amounts with discount", () => {
    expect(lineAmount({ qty: 2, unitPrice: 100, discountPct: 10 })).toBe(180);
  });

  it("rolls customer invoice income", () => {
    const rows = aggregateCustomerIncome([
      { customerId: "a", customerName: "Acme", total: 100 },
      { customerId: "a", customerName: "Acme", total: 50 },
      { customerId: "b", customerName: "Beta", total: 200 },
    ]);
    expect(rows[0]).toMatchObject({
      customerName: "Beta",
      total: 200,
      invoiceCount: 1,
    });
    expect(rows[1]).toMatchObject({
      customerName: "Acme",
      total: 150,
      invoiceCount: 2,
    });
  });

  it("rolls named product/service income", () => {
    const rows = aggregateNamedIncome([
      {
        id: "p1",
        name: "Speaker",
        code: "SP",
        qty: 2,
        unitPrice: 50,
        discountPct: 0,
      },
      {
        id: "p1",
        name: "Speaker",
        code: "SP",
        qty: 1,
        unitPrice: 50,
        discountPct: 0,
      },
    ]);
    expect(rows).toEqual([
      { id: "p1", name: "Speaker", code: "SP", lineCount: 2, total: 150 },
    ]);
  });

  it("builds text item and contact rows", () => {
    const text = buildTextItemRows([
      {
        lineId: "l1",
        opportunityId: "o1",
        opportunityReference: "Q-0001",
        description: "Custom cable",
        qty: 1,
        unitPrice: 25,
        discountPct: 0,
        textKind: "rental",
      },
      {
        lineId: "l2",
        opportunityId: "o1",
        opportunityReference: "Q-0001",
        description: "Sold cable",
        qty: 1,
        unitPrice: 40,
        discountPct: 0,
        textKind: "sale",
      },
      {
        lineId: "l3",
        opportunityId: "o2",
        opportunityReference: "Q-0002",
        description: "Untagged",
        qty: 1,
        unitPrice: 10,
        discountPct: 0,
        textKind: null,
      },
    ]);
    expect(text[0]?.total).toBe(40);
    expect(filterTextSales(text).map((r) => r.lineId)).toEqual(["l2"]);
    expect(filterTextRentals(text).map((r) => r.lineId).sort()).toEqual([
      "l1",
      "l3",
    ]);
    const contacts = buildContactRows(
      [
        {
          id: "c1",
          name: "Acme",
          contact_name: "Pat",
          email: "p@a.com",
          phone: "",
        },
        {
          id: "c2",
          name: "Empty",
          contact_name: "",
          email: "",
          phone: "",
        },
      ],
      [
        {
          id: "v1",
          name: "Hall",
          contact_name: "",
          email: "",
          phone: "555",
        },
      ],
    );
    expect(contacts.map((c) => c.id)).toEqual(["customer:c1", "venue:v1"]);
  });
});
