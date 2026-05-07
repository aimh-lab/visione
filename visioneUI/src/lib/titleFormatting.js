function normalizeMode(mode) {
  const raw = String(mode || "raw").trim().toLowerCase();
  if (raw === "formatted" || raw === "both" || raw === "raw") return raw;
  return "raw";
}

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toEpochSeconds(value, unit = "auto") {
  const num = toNumberOrNull(value);
  if (num == null) return null;

  const normalizedUnit = String(unit || "auto").trim().toLowerCase();
  if (normalizedUnit === "seconds") return num;
  if (normalizedUnit === "milliseconds") return num / 1000;

  // auto
  return num > 1e11 ? num / 1000 : num;
}

function getRawAndMetadata(item) {
  const raw = item && typeof item === "object" ? (item.raw && typeof item.raw === "object" ? item.raw : item) : {};
  const metadata = raw && typeof raw.metadata === "object" ? raw.metadata : {};
  return { raw, metadata };
}

function getUtcOffsetHours(item, fieldName = "utc_offset_hours") {
  const { raw, metadata } = getRawAndMetadata(item);
  const field = String(fieldName || "utc_offset_hours").trim();

  const candidates = [
    metadata?.[field],
    raw?.[field],
    item?.[field],
    metadata?.utc_offset_hours,
    raw?.utc_offset_hours,
    item?.utc_offset_hours
  ];

  for (const candidate of candidates) {
    const parsed = toNumberOrNull(candidate);
    if (parsed != null) return parsed;
  }

  return 0;
}

function formatUtcDateTime(ms, includeWeekday = false, hourPrefix = "") {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");

  const datePart = `${dd}/${mm}/${yyyy}`;
  const timePart = hourPrefix ? `${hourPrefix}${hh}` : `${hh}:${min}`;

  if (includeWeekday) {
    return `${weekdays[d.getUTCDay()]} ${datePart} ${timePart}`;
  }

  return `${datePart} ${timePart}`;
}

function parseHourId(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4])
  };
}

function getEpochSecondsFromItem(item, runtimeProfile = {}, cfg = {}) {
  const { raw, metadata } = getRawAndMetadata(item);
  const epochField = String(cfg.epochField || "epoch").trim();
  const epochSource = metadata?.[epochField] ?? raw?.[epochField] ?? item?.[epochField] ?? item?.timestamp;
  const epochUnit = cfg.epochUnit || runtimeProfile?.timeBadge?.epochUnit || "auto";
  return toEpochSeconds(epochSource, epochUnit);
}

export function formatVideoGroupLabel(rawLabel, item, runtimeProfile = {}, showLocalTime = true, modeOverride = null) {
  const label = String(rawLabel || "").trim();
  if (!label) return "";

  const cfg = runtimeProfile?.titleFormatting?.videoGroup;
  if (!cfg || cfg.enabled === false) return label;

  const parsed = parseHourId(label);
  const useLocalTime = !!showLocalTime && cfg.applyUtcOffsetHours !== false;
  const offsetHours = useLocalTime ? getUtcOffsetHours(item, cfg.utcOffsetField || "utc_offset_hours") : 0;

  let formatted = "";
  if (parsed) {
    const baseMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, 0, 0);
    const adjustedMs = baseMs + offsetHours * 3600 * 1000;
    formatted = formatUtcDateTime(adjustedMs, false, String(cfg.hourPrefix || "h"));
  } else {
    const epochSeconds = getEpochSecondsFromItem(item, runtimeProfile, cfg);
    if (epochSeconds != null) {
      const adjustedMs = (epochSeconds + offsetHours * 3600) * 1000;
      formatted = formatUtcDateTime(adjustedMs, false, "");
    }
  }

  const mode = normalizeMode(modeOverride || cfg.mode);
  if (mode === "formatted") return formatted || label;
  if (mode === "both") {
    const sep = String(cfg.separator || " - ");
    return formatted ? `${label}${sep}${formatted}` : label;
  }
  return label;
}

export function formatImageDisplayTitle(item, runtimeProfile = {}, showLocalTime = true) {
  const rawTitle = String(item?.title || item?.imgId || "").trim() || `Image ${Number(item?.index || 0) + 1}`;

  const cfg = runtimeProfile?.titleFormatting?.imageTitle;
  if (!cfg || cfg.enabled === false) return rawTitle;

  const epochSeconds = getEpochSecondsFromItem(item, runtimeProfile, cfg);

  if (epochSeconds == null) return rawTitle;

  const useLocalTime = !!showLocalTime && cfg.applyUtcOffsetHours !== false;
  const offsetHours = useLocalTime ? getUtcOffsetHours(item, cfg.utcOffsetField || "utc_offset_hours") : 0;
  const adjustedMs = (epochSeconds + offsetHours * 3600) * 1000;
  const formatted = formatUtcDateTime(adjustedMs, !!cfg.includeWeekday, "");

  const mode = normalizeMode(cfg.mode);
  if (mode === "formatted") return formatted || rawTitle;
  if (mode === "both") {
    const sep = String(cfg.separator || " - ");
    return `${rawTitle}${sep}${formatted || rawTitle}`;
  }
  return rawTitle;
}
