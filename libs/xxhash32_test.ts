import { assertEquals, assertThrows } from "@std/assert";
import { toUtf8, xxHash32 } from "./xxhash32.ts"; // Adjust the import path as necessary

Deno.test("toUtf8() - convert string to UTF-8 encoded Uint8Array", () => {
  // Test conversion of ASCII strings
  assertEquals(toUtf8("hello"), new Uint8Array([104, 101, 108, 108, 111]));

  // Test conversion of multi-byte characters
  assertEquals(toUtf8("你好"), new Uint8Array([228, 189, 160, 229, 165, 189]));

  // Test conversion of emoji
  assertEquals(
    toUtf8("😀"),
    new Uint8Array([240, 159, 152, 128]),
  );

  // Test conversion of characters requiring surrogate pairs
  assertEquals(
    toUtf8("𠜎"),
    new Uint8Array([240, 160, 156, 142]),
  );
});

Deno.test("xxHash32() - compute hash of string inputs", () => {
  // Test hash of empty string
  assertEquals(xxHash32(""), 0x2cc5d05);

  // Test hash of short string
  assertEquals(xxHash32("hello"), 4211111929);

  // Test hash of multi-byte string
  assertEquals(xxHash32("你好"), 1821811294);

  // Test hash with different seeds
  assertEquals(xxHash32("hello", 123), 2147069998);
  assertEquals(xxHash32("你好", 456), 1286987423);

  // Test hash of longer strings
  const longString = "a".repeat(100);
  assertEquals(xxHash32(longString), 400756875);

  const veryLongString = "hello".repeat(1000);
  assertEquals(xxHash32(veryLongString), 341495703);
});

Deno.test("xxHash32() - compute hash of Uint8Array inputs", () => {
  // Test hash of empty buffer
  assertEquals(xxHash32(new Uint8Array()), 0x2cc5d05);

  // Test hash of buffer with content
  const buffer = new Uint8Array([1, 2, 3, 4, 5]);
  assertEquals(xxHash32(buffer), 3743160008);

  // Test hash of longer buffer
  const longBuffer = new Uint8Array(100).fill(0xaa);
  assertEquals(xxHash32(longBuffer), 670070194);

  // Test hash of buffer with a specific seed
  assertEquals(xxHash32(buffer, 789), 3628687660);
});

Deno.test("xxHash32() - error handling", () => {
  // Test invalid input type
  assertThrows(
    () => xxHash32(123 as unknown as string), // Forcing a type error
    Error,
    "buffer must be a string or Uint8Array",
  );

  // Test unsupported input type
  assertThrows(
    () => xxHash32({} as unknown as string), // Forcing a type error
    Error,
    "buffer must be a string or Uint8Array",
  );
});
