/** Stable Hub catalog IDs seeded in migration 157 (venue quote catalog). */
export const VENUE_CATALOG = {
  groupId: "a1570000-0000-4000-8000-000000000001",
  packages: {
    completeMeeting: "a1570000-0000-4000-8000-000000000101",
    projectorPresentation: "a1570000-0000-4000-8000-000000000102",
    presenterAudio: "a1570000-0000-4000-8000-000000000103",
    generalSession: "a1570000-0000-4000-8000-000000000104",
  },
  addons: {
    wirelessMic: "a1570000-0000-4000-8000-000000000201",
    wirelessLapel: "a1570000-0000-4000-8000-000000000202",
    tabletopMic: "a1570000-0000-4000-8000-000000000203",
    poweredSpeaker: "a1570000-0000-4000-8000-000000000204",
    confidenceMonitor: "a1570000-0000-4000-8000-000000000205",
    laptop: "a1570000-0000-4000-8000-000000000206",
    hdmiSplitter: "a1570000-0000-4000-8000-000000000207",
    slideClicker: "a1570000-0000-4000-8000-000000000208",
    uplight: "a1570000-0000-4000-8000-000000000209",
    tablePower: "a1570000-0000-4000-8000-000000000210",
  },
  services: {
    techHourly: "a1570000-0000-4000-8000-000000000301",
  },
} as const;

/** Starter catalog package name → Hub product id. */
export const STARTER_PACKAGE_PRODUCT_BY_NAME: Record<string, string> = {
  "Complete Meeting": VENUE_CATALOG.packages.completeMeeting,
};

/** Starter catalog addon name → Hub product or service id. */
export const STARTER_ADDON_MAP_BY_NAME: Record<
  string,
  { productId?: string; serviceId?: string }
> = {
  "Wireless microphone": { productId: VENUE_CATALOG.addons.wirelessMic },
  "Confidence monitor": { productId: VENUE_CATALOG.addons.confidenceMonitor },
  "Extra technician hours": { serviceId: VENUE_CATALOG.services.techHourly },
};
