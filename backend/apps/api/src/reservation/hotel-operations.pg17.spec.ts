import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ReservationService } from "./reservation.service";
import { WebsiteCustomerBookingsService } from "../website/website-customer-bookings.service";
import { ReservationController } from "./reservation.controller";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import type { AuthUser } from "../auth/auth.types";
const url=process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 hotel room operations preserve scope, state, capacity and occupancy",{skip:!url},async t=>{
 const target=new URL(url!);assert.equal(target.hostname,"127.0.0.1");assert.match(target.pathname,/^\/zat_synthetic_[a-z0-9_]+$/);
 const db=new PrismaClient({datasourceUrl:url});
 try{
  const [v]=await db.$queryRaw<{v:number}[]>`SELECT current_setting('server_version_num')::int AS v`;assert.ok(v.v>=170000&&v.v<180000);
  const branch=await db.branch.create({data:{code:randomUUID(),name:"Synthetic hotel operations"}}),staff=await db.user.create({data:{username:randomUUID(),email:`${randomUUID()}@example.test`,fullName:"Synthetic operator",passwordHash:"invalid"}});
  const customer=await db.customer.create({data:{customerNumber:randomUUID(),fullName:"Synthetic hotel customer",branchId:branch.id}}),hotel=await db.hotel.create({data:{hotelNumber:randomUUID(),name:"Synthetic hotel",city:"Makkah",country:"Saudi Arabia"}});
  const guests=await Promise.all([1,2,3].map(i=>db.passenger.create({data:{fullName:`Synthetic guest ${i}`,customerId:customer.id}})));
  const actor={id:staff.id,branchIds:[branch.id],defaultBranchId:branch.id,isSuperAdmin:true,permissions:[]} as unknown as AuthUser;
  const seq=new SequenceService(db as never),audit=new AuditService(db as never),accounting=new AccountingService(db as never,seq,audit),svc=new ReservationService(db as never,seq,audit,accounting),controller=new ReservationController(svc);
  const make=(rooms:Record<string,unknown>[])=>svc.save(actor,{branchId:branch.id,customerId:customer.id,segments:[{hotelId:hotel.id,checkIn:"2044-03-01",checkOut:"2044-03-03",rooms}]} as never);
  const room=(guest:number,extra={})=>({occupancy:1,passengerIds:[guests[guest].id],...extra});
  await t.test("valid checked-in transfer preserves guests and financial values",async()=>{
   const b=await make([room(0)]),a=b.staySegments[0].rooms[0];await svc.checkin(actor,a.id);
   const moved=await svc.transfer(actor,a.id,undefined,"valid-"+randomUUID());
   const next=await db.hotelStayRoom.findUniqueOrThrow({where:{id:moved.toId},include:{pax:true}});
   assert.equal(next.status,"CHECKED_IN");assert.equal(next.pax[0].passengerId,guests[0].id);assert.ok(next.checkinAt);
   const after=await db.hotelBooking.findUniqueOrThrow({where:{id:b.id}});assert.equal(String(after.net),String(b.net));assert.equal(String(after.paid),String(b.paid));
   await svc.checkout(actor,next.id);
   const visible=await new WebsiteCustomerBookingsService(db as never).listForWebsiteCustomer(customer.id);
   assert.equal(visible.bookings.find(row=>row.reference===b.bookingNumber)?.status,"Completed");
   const unrelated=await db.customer.create({data:{customerNumber:randomUUID(),fullName:"Synthetic other customer",branchId:branch.id}});
   assert.equal((await new WebsiteCustomerBookingsService(db as never).listForWebsiteCustomer(unrelated.id)).bookings.length,0);
  });
  await t.test("rejected transfer leaves allocations and history untouched",async()=>{
   const b=await make([room(0),room(1)]),[a,z]=b.staySegments[0].rooms;
   await assert.rejects(svc.transfer(actor,a.id,z.id,undefined));
   assert.equal((await db.hotelStayRoom.findUniqueOrThrow({where:{id:a.id}})).status,"ALLOCATED");
   assert.equal(await db.hotelStayRoomPax.count({where:{stayRoomId:a.id}}),1);
   assert.equal(await db.hotelStayRoomPax.count({where:{stayRoomId:z.id}}),1);
   assert.equal(await db.hotelStayTransfer.count({where:{fromRoomId:a.id}}),0);
  });
  await t.test("multi-room allocation retries are safe and capacity is enforced",async()=>{
   const b=await make([{occupancy:2},{occupancy:1}]),[a,z]=b.staySegments[0].rooms;
   await Promise.all([svc.allocate(actor,b.id,a.id,guests[0].id),svc.allocate(actor,b.id,a.id,guests[0].id)]);
   assert.equal(await db.hotelStayRoomPax.count({where:{stayRoomId:a.id}}),1);
   await assert.rejects(svc.allocate(actor,b.id,z.id,guests[0].id));
   await svc.allocate(actor,b.id,a.id,guests[1].id);
   await assert.rejects(svc.allocate(actor,b.id,a.id,guests[2].id));
   await svc.allocate(actor,b.id,z.id,guests[2].id);
   await svc.checkin(actor,a.id);await assert.rejects(svc.allocate(actor,b.id,a.id,guests[0].id));
  });
  await t.test("allocation preserves branch scope and rolls back on audit failure",async()=>{
   const b=await make([{occupancy:2}]),a=b.staySegments[0].rooms[0];
   const foreign=await db.branch.create({data:{code:randomUUID(),name:"Synthetic other office"}});
   const otherCustomer=await db.customer.create({data:{customerNumber:randomUUID(),fullName:"Synthetic foreign customer",branchId:foreign.id}});
   const otherGuest=await db.passenger.create({data:{fullName:"Synthetic foreign guest",customerId:otherCustomer.id}});
   await assert.rejects(svc.allocate(actor,b.id,a.id,otherGuest.id));
   const denied={...actor,isSuperAdmin:false,branchIds:[foreign.id],defaultBranchId:foreign.id,permissions:["hotel.booking"]};
   await assert.rejects(svc.allocate(denied,b.id,a.id,guests[0].id));
   const failing=new ReservationService(db as never,seq,{log:async()=>{throw new Error("Synthetic audit failure");}} as never,accounting);
   await assert.rejects(failing.allocate(actor,b.id,a.id,guests[0].id),/Synthetic audit failure/);
   assert.equal(await db.hotelStayRoomPax.count({where:{stayRoomId:a.id}}),0);
  });
  await t.test("existing destinations preserve a consistent check-in stage",async()=>{
   const b=await make([room(0),{occupancy:2}]),[a,z]=b.staySegments[0].rooms;await svc.checkin(actor,a.id);
   await svc.transfer(actor,a.id,z.id,undefined);assert.equal((await db.hotelStayRoom.findUniqueOrThrow({where:{id:z.id}})).status,"CHECKED_IN");
   const other=await make([room(1),room(2,{occupancy:2})]),[source,dest]=other.staySegments[0].rooms;await svc.checkin(actor,source.id);
   await assert.rejects(svc.transfer(actor,source.id,dest.id,undefined));
  });
  await t.test("completed room cannot be transferred or resurrected",async()=>{const b=await make([room(0)]),id=b.staySegments[0].rooms[0].id;await svc.checkin(actor,id);await svc.checkout(actor,id);await assert.rejects(svc.transfer(actor,id,undefined,"closed-"+randomUUID()));});
  await t.test("transfer cannot overfill the destination",async()=>{const b=await make([room(0),room(1)]),[a,z]=b.staySegments[0].rooms;await assert.rejects(svc.transfer(actor,a.id,z.id,undefined));});
  await t.test("concurrent retries cannot create duplicate transfer rooms",async()=>{const b=await make([room(0)]),a=b.staySegments[0].rooms[0];const results=await Promise.allSettled([svc.transfer(actor,a.id,undefined,"retry-"+randomUUID()),svc.transfer(actor,a.id,undefined,"retry-"+randomUUID())]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(await db.hotelStayTransfer.count({where:{fromRoomId:a.id}}),1);});
  await t.test("check-in cannot rename a room onto occupied accommodation",async()=>{const name="occupied-"+randomUUID();await make([room(0,{roomNumber:name})]);const b=await make([room(1,{roomNumber:"free-"+randomUUID()})]);await assert.rejects(svc.checkin(actor,b.staySegments[0].rooms[0].id,undefined,name));});
  await t.test("room action must belong to the booking in its URL",async()=>{const a=await make([room(0)]),b=await make([room(1)]);await assert.rejects(controller.checkin(b.id,{roomId:a.staySegments[0].rooms[0].id},{user:actor} as never));});
  await t.test("physical room ID and displayed room number cannot bypass each other",async()=>{const name="physical-"+randomUUID(),physical=await db.hotelRoom.create({data:{hotelId:hotel.id,roomNumber:name}});await make([room(0,{hotelRoomId:physical.id})]);await assert.rejects(make([room(1,{roomNumber:name})]));});
  await t.test("transfer cannot enter a different itinerary stay",async()=>{const b=await svc.save(actor,{branchId:branch.id,customerId:customer.id,segments:[{hotelId:hotel.id,checkIn:"2045-01-01",checkOut:"2045-01-03",rooms:[room(0)]},{hotelId:hotel.id,checkIn:"2045-02-01",checkOut:"2045-02-03",rooms:[room(1,{occupancy:3})]}]});await assert.rejects(svc.transfer(actor,b.staySegments[0].rooms[0].id,b.staySegments[1].rooms[0].id,undefined));});
 }finally{await db.$disconnect();}
});
