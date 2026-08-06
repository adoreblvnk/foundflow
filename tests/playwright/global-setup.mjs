import { rmSync } from "node:fs";

export default function globalSetup() {
  if (process.env.DATA_DIR) {
    rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  }
}