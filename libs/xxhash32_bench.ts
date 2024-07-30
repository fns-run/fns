import { xxHash32 } from "./xxhash32.ts"; // Adjust the path according to your file structure

// Define the seed value for hashing
const SEED = 0;

// Generate input data of different sizes
const inputData = {
  small: new Uint8Array(1).fill(1),
  medium: new Uint8Array(1000).fill(1),
  large: new Uint8Array(100000).fill(1),
};

// Benchmark xxHash32 with small input
Deno.bench("xxHash32 - small input", () => {
  xxHash32(inputData.small, SEED);
});

// Benchmark xxHash32 with medium input
Deno.bench("xxHash32 - medium input", () => {
  xxHash32(inputData.medium, SEED);
});

// Benchmark xxHash32 with large input
Deno.bench("xxHash32 - large input", () => {
  xxHash32(inputData.large, SEED);
});