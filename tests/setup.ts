// tests/setup.ts
import { TextEncoder, TextDecoder } from 'node:util';

// Ensure TextEncoder/TextDecoder exist in the test env
(global as any).TextEncoder = (global as any).TextEncoder || TextEncoder;
(global as any).TextDecoder = (global as any).TextDecoder || TextDecoder;

// Stabilize performance.now() for predictable timings in tests
if (!(global as any).performance || typeof (global as any).performance.now !== 'function') {
  (global as any).performance = { now: () => Date.now() } as any;
}
