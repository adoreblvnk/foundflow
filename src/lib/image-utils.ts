/**
 * Cryptographic/magic number signature validation for JPG, PNG, and WebP images.
 */
export function verifyImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }

  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    );
  }

  if (mimeType === "image/webp") {
    const rif = buffer.toString("binary", 0, 4);
    const webp = buffer.toString("binary", 8, 12);
    return rif === "RIFF" && webp === "WEBP";
  }

  return false;
}
