/**
 * Generates and triggers download of an iCalendar (.ics) file for a booking stay.
 * Timezone defaults to Asia/Kolkata.
 */

function formatIcsDateTime(dateStr, timeStr = "14:00") {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const [hours, minutes] = (timeStr || "14:00").split(":").map(Number);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(hours || 0).padStart(2, "0");
  const mm = String(minutes || 0).padStart(2, "0");

  return `${year}${month}${day}T${hh}${mm}00`;
}

export function generateIcsContent({
  propertyName = "Stay",
  address = "",
  city = "",
  checkIn,
  checkOut,
  checkInTime = "14:00",
  checkOutTime = "11:00",
  reference = "",
  url = "",
}) {
  const dtStart = formatIcsDateTime(checkIn, checkInTime);
  const dtEnd = formatIcsDateTime(checkOut, checkOutTime);
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const location = [address, city].filter(Boolean).join(", ");
  const description = [
    `Booking Reference: ${reference}`,
    url ? `View booking: ${url}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PGM Stays//Booking Stay//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${reference || Date.now()}@pgmstays.com`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
    `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
    `SUMMARY:Stay at ${propertyName}`,
    `DESCRIPTION:${description}`,
    location ? `LOCATION:${location}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function downloadIcsFile(params) {
  const ics = generateIcsContent(params);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.setAttribute(
    "download",
    `stay-${(params.propertyName || "booking").toLowerCase().replace(/[^a-z0-9]/g, "-")}.ics`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
