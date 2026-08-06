import { rmSync } from "node:fs";

export default function globalTeardown() {
  if (process.env.DATA_DIR) {
    rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  }
}