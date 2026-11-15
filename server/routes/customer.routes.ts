import { Router } from "express";
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { bookings, clinics, customerHealthRecords, customerOrders, customerPets, customers, services } from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";
import { ApiError } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/validation.js";

const router = Router();
const uuid = z.string().uuid();
const searchSchema = z.object({ phone: z.string().trim().min(3).max(30), limit: z.coerce.number().int().min(1).max(20).default(10) });
const createCustomerSchema = z.object({ name: z.string().trim().min(2).max(160), phone: z.string().trim().min(7).max(30), email: z.string().trim().email().optional() });
const petSchema = z.object({ name: z.string().trim().min(1).max(120), species: z.enum(["Dog", "Cat"]), breed: z.string().trim().min(1).max(120), size: z.enum(["Small", "Medium", "Large", "Giant"]), coatType: z.enum(["Short", "Long", "Unknown"]), sex: z.enum(["Male", "Female", "Unknown"]).default("Unknown"), reproductiveStatus: z.enum(["Intact", "Spayed / Neutered", "Unknown"]).default("Unknown"), birthDate: z.coerce.date().optional() });

function scopeFor(actor: NonNullable<Express.Request["auth"]>) {
  if (actor.permissions.has("bookings:manage:any") || (!actor.clinicIds.length && actor.permissions.has("bookings:create"))) return undefined;
  return actor.clinicIds.length
    ? inArray(bookings.clinicId, [...actor.clinicIds])
    : eq(bookings.createdBy, actor.userId);
}

router.get("/search", requirePermission("bookings:view"), async (request, response) => {
  const input = parseQuery(request, searchSchema);
  const actor = request.auth!;
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 3) throw new ApiError(400, "PHONE_SEARCH_TOO_SHORT", "Enter at least 3 phone digits.");
  const scope = scopeFor(actor);
  const rows = await db.select({
    id: customers.id, name: customers.name, email: customers.email, phone: customers.phone,
    petName: customers.petName, petSpecies: customers.petSpecies,
  }).from(customers).where(and(ilike(customers.phone, `%${digits}%`), ...(scope ? [inArray(customers.id, db.select({ customerId: bookings.customerId }).from(bookings).where(and(isNull(bookings.deletedAt), scope)))] : []))).orderBy(desc(customers.updatedAt)).limit(input.limit);
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  response.json({ data: unique });
});

router.post("/", requirePermission("bookings:create"), async (request, response) => {
  const input = parseBody(request, createCustomerSchema);
  const [customer] = await db.insert(customers).values({ ...input, email: input.email ?? null }).returning({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone, petName: customers.petName, petSpecies: customers.petSpecies });
  response.status(201).json({ data: customer });
});

router.post("/:id/pets", requirePermission("bookings:create"), async (request, response) => {
  const customerId = uuid.parse(request.params.id);
  const input = parseBody(request, petSchema);
  const [customer] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "The customer was not found.");
  const [pet] = await db.insert(customerPets).values({ ...input, customerId, birthDate: input.birthDate ?? null, size: input.size, coatType: input.coatType, sex: input.sex, reproductiveStatus: input.reproductiveStatus }).returning();
  response.status(201).json({ data: pet });
});

router.get("/:id/profile", requirePermission("bookings:view"), async (request, response) => {
  const customerId = uuid.parse(request.params.id);
  const actor = request.auth!;
  const scope = scopeFor(actor);
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "The customer was not found.");
  const customerRows = await db.select({ booking: bookings, clinic: { id: clinics.id, name: clinics.name }, service: { id: services.id, name: services.name } })
    .from(bookings).innerJoin(clinics, eq(bookings.clinicId, clinics.id)).innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(eq(bookings.customerId, customerId), isNull(bookings.deletedAt), ...(scope ? [scope] : []))).orderBy(desc(bookings.startsAt));
  const [petRows, orderRows] = await Promise.all([
    db.select().from(customerPets).where(eq(customerPets.customerId, customerId)).orderBy(customerPets.createdAt),
    db.select().from(customerOrders).where(eq(customerOrders.customerId, customerId)).orderBy(desc(customerOrders.orderedAt)),
  ]);
  const healthRows = petRows.length
    ? await db.select().from(customerHealthRecords).where(inArray(customerHealthRecords.petId, petRows.map((pet) => pet.id))).orderBy(desc(customerHealthRecords.recordedAt))
    : [];
  const appointments = customerRows.map(({ booking, clinic, service }) => ({ id: booking.id, reference: booking.reference, startsAt: booking.startsAt, endsAt: booking.endsAt, status: booking.status, clinic, service, notes: booking.notes }));
  response.json({ data: {
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, petName: customer.petName, petSpecies: customer.petSpecies },
    pets: petRows.length ? petRows.map((pet) => ({ id: pet.id, name: pet.name, species: pet.species, breed: pet.breed, size: pet.size, coatType: pet.coatType, sex: pet.sex, reproductiveStatus: pet.reproductiveStatus, age: pet.birthDate ? `${Math.max(0, new Date().getFullYear() - pet.birthDate.getFullYear())} years old` : null, status: pet.status, vaccinationStatus: healthRows.some((record) => record.petId === pet.id && record.recordType.toLowerCase() === "vaccination" && record.status === "active") ? "Up to date" : "Not recorded" })) : customer.petName ? [{ id: `${customer.id}-pet`, name: customer.petName, species: customer.petSpecies ?? "Pet", age: null, status: "active", vaccinationStatus: "Not recorded" }] : [],
    orderHistory: orderRows.map((order) => ({ id: order.orderNumber, date: order.orderedAt, title: order.title, amount: order.amount, status: order.status })),
    appointments,
    healthRecords: healthRows.map((record) => ({ id: record.id, type: record.recordType, title: record.title, status: record.status, date: record.recordedAt })),
  } });
});

export { router as customerRouter };
