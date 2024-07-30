import { assertEquals, assertThrows } from "@std/assert";
import { ms } from "./ms.ts"; // Adjust the import path as necessary

Deno.test("ms() - parse string to milliseconds", () => {
  // Test parsing different units
  assertEquals(ms("1s"), 1000);
  assertEquals(ms("1m"), 60000);
  assertEquals(ms("1h"), 3600000);
  assertEquals(ms("1d"), 86400000);
  assertEquals(ms("1w"), 604800000);
  assertEquals(ms("1y"), 31557600000);

  // Test parsing fractional values
  assertEquals(ms("1.5h"), 5400000);
  assertEquals(ms("1.5d"), 129600000);

  // Test parsing without units defaults to milliseconds
  assertEquals(ms("1500"), 1500);

  // Test different unit pluralizations
  assertEquals(ms("2 seconds"), 2000);
  assertEquals(ms("2 minutes"), 120000);
  assertEquals(ms("2 hours"), 7200000);
  assertEquals(ms("2 days"), 172800000);
  assertEquals(ms("2 weeks"), 1209600000);
  assertEquals(ms("2 years"), 63115200000);
});

Deno.test("ms() - format number to string", () => {
  // Test formatting numbers to short format
  assertEquals(ms(1000), "1s");
  assertEquals(ms(60000), "1m");
  assertEquals(ms(3600000), "1h");
  assertEquals(ms(86400000), "1d");
  assertEquals(ms(604800000), "7d");
  assertEquals(ms(31557600000), "365d");

  // Test formatting numbers to long format
  assertEquals(ms(1000, { long: true }), "1 second");
  assertEquals(ms(60000, { long: true }), "1 minute");
  assertEquals(ms(3600000, { long: true }), "1 hour");
  assertEquals(ms(86400000, { long: true }), "1 day");
  assertEquals(ms(604800000, { long: true }), "7 days");
  assertEquals(ms(31557600000, { long: true }), "365 days");
});

Deno.test("ms() - handle errors and edge cases", () => {
  // Test for empty string
  assertThrows(
    () => ms(""),
    Error,
    'val is not a non-empty string or a valid number. val=""',
  );

  // Test for invalid string
  assertEquals(ms("not a time"), undefined);

  // Test for excessively long strings
  const longString = "1".repeat(101);
  assertEquals(ms(longString), undefined);

  // Test for invalid numbers
  assertThrows(
    () => ms(NaN),
    Error,
    "val is not a non-empty string or a valid number. val=null",
  );

  // Test for zero
  assertEquals(ms(0), "0ms");
  assertEquals(ms(0, { long: true }), "0 ms");

  // Test for negative numbers
  assertEquals(ms(-1000), "-1s");
  assertEquals(ms(-1000, { long: true }), "-1 second");
});
