import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import { MAX_UPLOAD_BYTES } from "../common/storage.service";

/** Public artwork is decoded/re-encoded, bounded and stripped of embedded metadata. */
export async function websiteImage(file: Express.Multer.File) {
  const b = file.buffer;
  const mime = file.mimetype;
  const valid =
    mime === "image/png"
      ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mime === "image/jpeg"
        ? b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255
        : mime === "image/webp"
          ? b.length >= 12 &&
            b.toString("ascii", 0, 4) === "RIFF" &&
            b.toString("ascii", 8, 12) === "WEBP"
          : false;
  if (!valid || b.length > MAX_UPLOAD_BYTES)
    throw new BadRequestException(
      "Use a valid JPEG, PNG or WebP website image",
    );
  try {
    const buffer = await sharp(b, {
      limitInputPixels: 24000000,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: 2400,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return {
      ...file,
      buffer,
      mimetype: "image/webp",
      originalname: "website-image.webp",
    };
  } catch {
    throw new BadRequestException(
      "Website image could not be safely processed",
    );
  }
}
