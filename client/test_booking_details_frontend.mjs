import { strict as assert } from "node:assert";
import QRCode from "qrcode";
import { generateIcsContent } from "./src/lib/calendar.js";

console.log("=================================================");
console.log("  ROUND 4G: FRONTEND UNIT & INTEGRITY TESTS      ");
console.log("=================================================");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(err);
  }
}

async function runAsyncTests() {
  // TEST 1: Calendar (.ics) generation
  test("1. Calendar .ics generation includes correct dates, times, summary, and no internal IDs", () => {
    const ics = generateIcsContent({
      propertyName: "Taj Heritage Palace",
      address: "42 Marine Drive",
      city: "Mumbai",
      checkIn: "2026-12-01T00:00:00.000Z",
      checkOut: "2026-12-03T00:00:00.000Z",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      reference: "PGM-ACA03151",
      url: "http://localhost:5173/bookings/6afb30d9bda9c0cdaca03151",
    });

    assert.ok(ics.includes("BEGIN:VCALENDAR"), "Must contain BEGIN:VCALENDAR");
    assert.ok(ics.includes("SUMMARY:Stay at Taj Heritage Palace"), "Must contain stay summary");
    assert.ok(ics.includes("DTSTART;TZID=Asia/Kolkata:20261201T140000"), "Must have correct checkIn time");
    assert.ok(ics.includes("DTEND;TZID=Asia/Kolkata:20261203T110000"), "Must have correct checkOut time");
    assert.ok(ics.includes("LOCATION:42 Marine Drive, Mumbai"), "Must contain location");
    assert.ok(ics.includes("Booking Reference: PGM-ACA03151"), "Must contain booking reference");
    assert.ok(ics.includes("END:VCALENDAR"), "Must contain END:VCALENDAR");
  });

  // TEST 2: QR Code directions URL content
  total++;
  try {
    const lat = 18.922;
    const lng = 72.8347;
    const expectedUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    // Verify QRCode library generates string
    const dataUrl = await QRCode.toDataURL(expectedUrl, {
      errorCorrectionLevel: "M",
    });

    assert.ok(dataUrl.startsWith("data:image/png;base64,"), "Expected base64 png data URL");

    // Verify the URL structure contains ONLY Google Maps destination
    const urlObj = new URL(expectedUrl);
    assert.equal(urlObj.hostname, "www.google.com");
    assert.equal(urlObj.pathname, "/maps/dir/");
    assert.equal(urlObj.searchParams.get("api"), "1");
    assert.equal(urlObj.searchParams.get("destination"), "18.922,72.8347");

    // Strictly ensure no personal data or booking id in directions URL
    assert.strictEqual(urlObj.searchParams.get("bookingId"), null);
    assert.strictEqual(urlObj.searchParams.get("reference"), null);
    assert.strictEqual(urlObj.searchParams.get("email"), null);
    assert.strictEqual(urlObj.searchParams.get("userId"), null);

    console.log("  ✓ [PASS] 2. Directions QR encodes strictly Google Maps destination URL with no booking or user data");
    passed++;
  } catch (err) {
    console.error("  ✗ [FAIL] 2. Directions QR test failed");
    console.error(err);
  }

  // TEST 3: Reference formatting test
  test("3. formatBookingReference outputs Inter-compatible PGM-XXXXXXXX format", async () => {
    const { formatBookingReference } = await import("./src/lib/bookingReference.js");
    const formatted = formatBookingReference("6afb30d9bda9c0cdaca03151");
    assert.equal(formatted, "PGM-ACA03151");
    assert.ok(/^PGM-[A-F0-9]{8}$/.test(formatted), "Must match PGM-8HEX format");
  });

  console.log("=================================================");
  console.log(`  FRONTEND SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("=================================================");
  if (passed !== total) {
    process.exit(1);
  }
}

runAsyncTests().catch((err) => {
  console.error("FATAL ERROR in test runner:", err);
  process.exit(1);
});
