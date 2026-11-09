import { describe, expect, it } from "vitest";
import { haversineMiles } from "../geo-zones";
import type { FieldDef, FormDefinition } from "../types";
import {
  cleanLocationText,
  estimatedRoadMiles,
  formHasLocationField,
  geocodeCacheKey,
  googleConfidence,
  isGeoPoint,
  locationInputFromAnswers,
  needsManualPlace,
  placeConfidence,
  nominatimConfidence,
  roundMiles,
  softenForConfidence,
  stateFromAddress,
} from "./geo-core";

const PONTE_VEDRA = { lat: 30.24, lng: -81.3853 };
const ORLANDO = { lat: 28.5384, lng: -81.3789 };

function defWith(field: FieldDef): FormDefinition {
  return {
    version: 1,
    steps: [
      {
        id: "s1",
        kind: "fields",
        title: "You",
        fields: [
          { id: "f1", key: "email", type: "email", role: "email", label: "Email", required: true, width: "full" },
          field,
        ],
      },
    ],
  };
}

describe("distance", () => {
  it("applies the road factor (clamped 1..3) and rounds to one decimal", () => {
    const straight = haversineMiles(PONTE_VEDRA.lat, PONTE_VEDRA.lng, ORLANDO.lat, ORLANDO.lng);
    expect(estimatedRoadMiles(PONTE_VEDRA, ORLANDO, 1.2)).toBe(roundMiles(straight * 1.2));
    expect(estimatedRoadMiles(PONTE_VEDRA, ORLANDO, 99)).toBe(roundMiles(straight * 3));
    expect(estimatedRoadMiles(PONTE_VEDRA, ORLANDO, 0.2)).toBe(roundMiles(straight));
    expect(estimatedRoadMiles(PONTE_VEDRA, PONTE_VEDRA, 1.2)).toBe(0);
  });

  it("validates points", () => {
    expect(isGeoPoint(PONTE_VEDRA)).toBe(true);
    expect(isGeoPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isGeoPoint({ lat: "30", lng: -81 })).toBe(false);
    expect(isGeoPoint(null)).toBe(false);
  });
});

describe("query text", () => {
  it("cleans and keys queries", () => {
    expect(cleanLocationText("  Casa   Monica,\n St. Augustine ")).toBe("Casa Monica, St. Augustine");
    expect(geocodeCacheKey("Casa Monica, St. Augustine, FL")).toBe(geocodeCacheKey("casa  monica, st. augustine, fl"));
    expect(cleanLocationText("x".repeat(400))).toHaveLength(300);
  });

  it("reads the state of the business address", () => {
    expect(stateFromAddress("101 Marketside Avenue, Ponte Vedra, FL 32081")).toBe("FL");
    expect(stateFromAddress("1 Main St, Savannah, GA")).toBe("GA");
    expect(stateFromAddress("Somewhere")).toBeNull();
    expect(stateFromAddress(null)).toBeNull();
  });
});

describe("confidence", () => {
  it("ranks Nominatim results by place rank", () => {
    expect(nominatimConfidence({ place_rank: 30 })).toBe("high");
    expect(nominatimConfidence({ place_rank: 26 })).toBe("high");
    expect(nominatimConfidence({ place_rank: 19 })).toBe("medium");
    expect(nominatimConfidence({ place_rank: 16 })).toBe("low");
    expect(nominatimConfidence({ importance: 0.8 })).toBe("high");
    expect(nominatimConfidence({})).toBe("low");
  });

  it("ranks Google results by location type and result type", () => {
    expect(googleConfidence({ types: ["street_address"], geometry: { location_type: "ROOFTOP" } })).toBe("high");
    expect(googleConfidence({ types: ["establishment"], geometry: { location_type: "GEOMETRIC_CENTER" } })).toBe(
      "medium",
    );
    expect(googleConfidence({ types: ["route"], geometry: { location_type: "GEOMETRIC_CENTER" } })).toBe("medium");
    expect(googleConfidence({ types: ["locality", "political"], geometry: { location_type: "APPROXIMATE" } })).toBe(
      "low",
    );
  });

  it("never fails a visitor on a fuzzy match", () => {
    expect(softenForConfidence("fail", "low")).toBe("unverified");
    expect(softenForConfidence("fail", "high")).toBe("fail");
    expect(softenForConfidence("risky", "low")).toBe("risky");
  });
});

describe("locationInputFromAnswers", () => {
  it("uses the typed text of an address field and screens vague answers", () => {
    const def = defWith({
      id: "f2",
      key: "venue",
      type: "address",
      role: "event_location",
      label: "Venue or city",
      required: true,
      width: "half",
    });
    const typed = locationInputFromAnswers(def, { venue: " Casa Monica,  St. Augustine " });
    expect(typed).toEqual({ text: "Casa Monica, St. Augustine", fromOption: false });
    expect(needsManualPlace(typed!)).toBe(false);
    const vague = locationInputFromAnswers(def, { venue: "TBD" });
    expect(needsManualPlace(vague!)).toBe(true);
    expect(locationInputFromAnswers(def, { venue: "" })).toBeNull();
    expect(locationInputFromAnswers(def, {})).toBeNull();
    expect(formHasLocationField(def)).toBe(true);
  });

  it("still looks up a city-only answer (Y1 asks for 'Venue or city'), only at low confidence", () => {
    for (const text of ["St. Augustine", "Orlando, FL", "Amelia Island", "Ponte Vedra", "Tampa", "TPC Sawgrass"]) {
      const input = { text, fromOption: false };
      expect(needsManualPlace(input), text).toBe(false);
      // rough answers never claim more than low confidence, so a far city softens to "unverified"
      expect(placeConfidence(input, "high"), text).toBe("low");
      expect(softenForConfidence("fail", placeConfidence(input, "high")), text).toBe("unverified");
    }
    for (const text of ["TBD", "not sure", "my house", "the venue", "church", "Wendy's", "12345", "?!", "na"]) {
      expect(needsManualPlace({ text, fromOption: false }), text).toBe(true);
    }
    const precise = { text: "Casa Monica, St. Augustine", fromOption: false };
    expect(placeConfidence(precise, "high")).toBe("high");
    expect(placeConfidence({ text: "St. Augustine", fromOption: true }, "medium")).toBe("medium");
  });

  it("geocodes a select option by its label (never screened), and Other by its typed text", () => {
    const def = defWith({
      id: "f2",
      key: "area",
      type: "select",
      role: "event_location",
      label: "Area",
      required: true,
      width: "full",
      choices: [
        { value: "ponte_vedra", label: "Ponte Vedra" },
        { value: "st_augustine", label: "St. Augustine" },
        { value: "somewhere_else", label: "Somewhere else", isOther: true },
      ],
    });
    const option = locationInputFromAnswers(def, { area: "ponte_vedra" });
    expect(option).toEqual({ text: "Ponte Vedra", fromOption: true });
    expect(needsManualPlace(option!)).toBe(false);
    expect(locationInputFromAnswers(def, { area: "somewhere_else", area__other: "Savannah, GA" })).toEqual({
      text: "Savannah, GA",
      fromOption: false,
    });
    expect(locationInputFromAnswers(def, { area: "somewhere_else" })).toBeNull();
    expect(locationInputFromAnswers(def, { area: "not_a_choice" })).toBeNull();
  });

  it("returns null when the form has no location field", () => {
    const def = defWith({
      id: "f2",
      key: "notes",
      type: "textarea",
      role: "notes",
      label: "Notes",
      required: false,
      width: "full",
    });
    expect(locationInputFromAnswers(def, { notes: "hi" })).toBeNull();
    expect(formHasLocationField(def)).toBe(false);
  });
});
