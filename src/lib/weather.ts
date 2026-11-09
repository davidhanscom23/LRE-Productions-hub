/** Approximate coords for company HQ weather (Ponte Vedra, FL). */
export const COMPANY_WEATHER = {
  latitude: 30.2397,
  longitude: -81.3856,
  label: "Ponte Vedra",
} as const;

export type HubWeather = {
  tempF: number;
  weatherCode: number;
  label: string;
};

/** WMO weather interpretation codes → short label + emoji (Open-Meteo). */
export function weatherDisplay(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Clear" };
  if (code === 1) return { emoji: "🌤️", label: "Mostly clear" };
  if (code === 2) return { emoji: "⛅", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", label: "Overcast" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 67) return { emoji: "🌧️", label: "Rain" };
  if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "Snow" };
  if (code >= 80 && code <= 82) return { emoji: "🌦️", label: "Showers" };
  if (code >= 95) return { emoji: "⛈️", label: "Thunderstorm" };
  return { emoji: "🌡️", label: "Weather" };
}

export async function fetchCompanyWeather(): Promise<HubWeather | null> {
  const { latitude, longitude, label } = COMPANY_WEATHER;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "America/New_York");

  const res = await fetch(url.toString(), {
    next: { revalidate: 600 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };

  const temp = data.current?.temperature_2m;
  const code = data.current?.weather_code;
  if (typeof temp !== "number" || typeof code !== "number") return null;

  return {
    tempF: Math.round(temp),
    weatherCode: code,
    label,
  };
}
