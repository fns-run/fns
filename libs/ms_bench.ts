import { ms } from "./ms.ts"; // Adjust the path according to your file structure

// Define various test cases for benchmarking
const testCases = {
  parse: [
    "1s",
    "2 minutes",
    "3 hours",
    "4 days",
    "5 weeks",
    "6 years",
    "100 milliseconds",
    "12345 ms",
  ],
  format: [
    1000, // 1 second
    60000, // 1 minute
    3600000, // 1 hour
    86400000, // 1 day
    604800000, // 1 week
    31536000000, // 1 year
  ],
};

// Benchmark the `ms` function for parsing strings
Deno.bench("ms - parse", () => {
  for (let i = 0; i < testCases.parse.length; i++) {
    const str = testCases.parse[i];
    ms(str);
  }
});

// Benchmark the `ms` function for formatting numbers in short format
Deno.bench("ms - format short", () => {
  for (let i = 0; i < testCases.format.length; i++) {
    const num = testCases.format[i];
    ms(num, { long: false });
  }
});

// Benchmark the `ms` function for formatting numbers in long format
Deno.bench("ms - format long", () => {
  for (let i = 0; i < testCases.format.length; i++) {
    const num = testCases.format[i];
    ms(num, { long: true });
  }
});
