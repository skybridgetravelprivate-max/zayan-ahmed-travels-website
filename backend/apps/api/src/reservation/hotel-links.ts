import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/** Validate the hotel/room graph, including references supplied outside the UI. */
export async function assertHotelRoomLinks(
  db: Pick<Prisma.TransactionClient, "hotelRoomType" | "hotelRoom">,
  input: { hotelId?: unknown; roomTypeId?: unknown; hotelRoomId?: unknown },
) {
  if (!input.roomTypeId && !input.hotelRoomId) return;
  if (typeof input.hotelId !== "string" || !input.hotelId) throw new BadRequestException("Select a hotel before selecting rooms");
  if (input.roomTypeId) {
    if (typeof input.roomTypeId !== "string") throw new BadRequestException("Invalid room type");
    const type = await db.hotelRoomType.findUnique({ where: { id: input.roomTypeId }, select: { hotelId: true } });
    if (!type || type.hotelId !== input.hotelId) throw new BadRequestException("Room type must belong to the selected hotel");
  }
  if (input.hotelRoomId) {
    if (typeof input.hotelRoomId !== "string") throw new BadRequestException("Invalid physical room");
    const room = await db.hotelRoom.findUnique({ where: { id: input.hotelRoomId }, select: { hotelId: true, roomTypeId: true, deletedAt: true } });
    if (!room || room.deletedAt || room.hotelId !== input.hotelId || (input.roomTypeId && room.roomTypeId !== input.roomTypeId)) throw new BadRequestException("Physical room must match the selected hotel and room type");
  }
}
