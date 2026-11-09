"use client";

type LibraryItem = {
  id: string;
  file_name: string;
  folder_path: string;
  location_name: string;
  event_date: string;
  dj_name: string;
  client_name: string;
};

type MediaLibraryPanelProps = {
  items: LibraryItem[];
  /** When false, copy reflects “your uploads only”. */
  isAdmin?: boolean;
};

export function MediaLibraryPanel({
  items,
  isAdmin = false,
}: MediaLibraryPanelProps) {
  const byVenue = new Map<string, Map<string, LibraryItem[]>>();

  for (const item of items) {
    const venue =
      item.location_name.trim() ||
      item.folder_path.split("/")[0] ||
      "Unsorted";
    const eventFolder =
      item.folder_path.split("/")[1] ||
      `${venue} - ${item.dj_name || "Staff"} - ${item.event_date}`;
    if (!byVenue.has(venue)) byVenue.set(venue, new Map());
    const events = byVenue.get(venue)!;
    const list = events.get(eventFolder) ?? [];
    list.push(item);
    events.set(eventFolder, list);
  }

  const venues = Array.from(byVenue.keys()).sort((a, b) => a.localeCompare(b));

  if (venues.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
        {isAdmin
          ? "No tagged packet media yet. Complete an Event Packet upload to build the venue → event folder tree."
          : "You haven’t uploaded any tagged packet media yet. Complete an Event Packet upload to build your library."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Media library
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {isAdmin
            ? "All staff uploads — master venue folders, then event folders named Location - Team member - Date."
            : "Your uploads — master venue folders, then event folders named Location - Team member - Date."}
        </p>
      </div>
      {venues.map((venue) => {
        const events = byVenue.get(venue)!;
        const eventNames = Array.from(events.keys()).sort((a, b) =>
          b.localeCompare(a),
        );
        return (
          <section
            key={venue}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h3 className="font-semibold text-[var(--foreground)]">{venue}</h3>
            <div className="mt-3 space-y-3">
              {eventNames.map((eventName) => (
                <div
                  key={eventName}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)]/40 p-3"
                >
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {eventName}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                    {(events.get(eventName) ?? []).map((item) => (
                      <li key={item.id}>
                        {item.file_name}
                        {item.client_name ? ` · ${item.client_name}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
