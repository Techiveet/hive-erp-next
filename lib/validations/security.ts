// lib/validations/security.ts

import { z } from "zod";

/* ------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------- */

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === undefined ? null : v));

const nullableNumber = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

/* ------------------------------------------------------------------
 * USERS
 * ---------------------------------------------------------------- */

export const userSchema = z
  .object({
    id: nullableString.optional(),
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().optional().or(z.literal("")).nullable(),
    roleId: z.coerce.string().min(1, "Role is required"), // Role.id is String (cuid)
    tenantId: nullableString.optional(),
    avatarUrl: z.string().url("Avatar must be a valid URL").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const isCreate = !data.id;
    const pwd = data.password ?? "";

    if (isCreate) {
      if (!pwd || pwd.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Password is required for new users and must be at least 8 characters",
          path: ["password"],
        });
      }
    } else if (pwd && pwd.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password must be at least 8 characters",
        path: ["password"],
      });
    }
  });

/* ------------------------------------------------------------------
 * ROLES
 * ---------------------------------------------------------------- */

export const roleSchema = z.object({
  // FIXED: Changed from nullableNumber to nullableString 
  // because CUIDs (e.g. 'cm5...') are strings, not numbers.
  id: nullableString.optional(), 
  name: z.string().min(2, "Role name must be at least 2 characters"),
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase snake_case"),
  permissionIds: z.array(z.coerce.string().min(1)).default([]),
  tenantId: nullableString.optional(),
});

/* ------------------------------------------------------------------
 * PERMISSIONS
 * ---------------------------------------------------------------- */

// Update permissionSchema too if you use string IDs there
export const permissionSchema = z.object({
  id: nullableString.optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase snake_case"),
  tenantId: nullableString.optional(),
});