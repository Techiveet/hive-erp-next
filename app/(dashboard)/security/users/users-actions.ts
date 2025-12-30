// app/(dashboard)/security/users/users-actions.ts
"use server";

import React from "react";
import crypto from "crypto";
import { hash } from "bcryptjs";
import { headers as nextHeaders } from "next/headers";

import { prisma } from "@/lib/prisma";
import { Prisma, MembershipStatus, RoleScope } from "@prisma/client";

import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/send-email";
import { userSchema } from "@/lib/validations/security";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";

import {
  UserAccountEmail,
  getUserAccountSubject,
  type UserAccountKind,
  type UserStatus,
} from "@/emails/user-account-template";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

export type UsersTabQuery = {
  tenantId?: string | null; // if CENTRAL: optional browse-tenantId
  page?: number;
  pageSize?: number;
  sortCol?: "name" | "email" | "createdAt" | "isActive";
  sortDir?: "asc" | "desc";
  search?: string;
};

export type RoleLite = {
  id: string;
  key: string;
  name: string;
  scope: "CENTRAL" | "TENANT";
};

export type UserForClient = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  isActive: boolean;
  avatarUrl?: string | null;
  userRoles: {
    id: string; // membership id
    roleId: string | null;
    role: { key: string; name: string; scope?: "CENTRAL" | "TENANT" };
    tenantId: string; // ✅ membership tenantId MUST be string
  }[];
};

export type UsersTabPayload = {
  users: UserForClient[];
  totalEntries: number;
  assignableRoles: RoleLite[];
  currentUserId: string;

  contextScope: "CENTRAL" | "TENANT";

  // ✅ CENTRAL => null (UI), TENANT => tenantId
  tenantId: string | null;
  tenantName: string | null;

  companySettings: any | null;
  brandingSettings: any | null;
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

async function getSafeRequestHeaders(): Promise<Headers> {
  const h = await nextHeaders();
  const safe = new Headers();
  h.forEach((value, key) => safe.set(key, value));
  return safe;
}

async function getCentralTenant(): Promise<{ id: string; name: string }> {
  const central = await prisma.tenant.findUnique({
    where: { slug: "central-hive" },
    select: { id: true, name: true },
  });
  if (!central) throw new Error("CENTRAL_TENANT_NOT_FOUND");
  return central;
}

async function getTenantNameById(tenantId: string): Promise<string | null> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return t?.name ?? null;
}

/**
 * ✅ Decide actor context from active membership.role.scope
 * If no membership, default CENTRAL.
 */
async function getActorContext(actorId: string): Promise<{
  scope: RoleScope;
  tenantId: string | null;
}> {
  const m = await prisma.membership.findFirst({
    where: { userId: actorId, status: MembershipStatus.ACTIVE },
    select: { tenantId: true, role: { select: { scope: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    scope: m?.role?.scope ?? RoleScope.CENTRAL,
    tenantId: m?.tenantId ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Authorization */
/* ------------------------------------------------------------------ */

async function authorizeUserAction(
  requiredPermissions: string[]
): Promise<{
  actorId: string;
  centralTenantId: string;
  actorScope: RoleScope;
  actorTenantId: string | null;
  hasCentralOverride: boolean;
}> {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  const central = await getCentralTenant();

  // central override perms
  const centralPerms = await getCurrentUserPermissions(central.id);
  const hasCentralOverride = requiredPermissions.some(
    (k) =>
      centralPerms.includes(k) ||
      centralPerms.includes("manage_users") ||
      centralPerms.includes("manage_security") ||
      centralPerms.includes("manage_roles")
  );

  const ctx = await getActorContext(user.id);

  if (!hasCentralOverride) {
    const permsTenantId = ctx.scope === RoleScope.CENTRAL ? central.id : ctx.tenantId;
    if (!permsTenantId) throw new Error("FORBIDDEN_NO_ACTIVE_TENANT");

    const perms = await getCurrentUserPermissions(permsTenantId);

    const ok = requiredPermissions.some(
      (k) =>
        perms.includes(k) ||
        perms.includes("manage_users") ||
        perms.includes("manage_security") ||
        perms.includes("manage_roles")
    );

    if (!ok) throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  return {
    actorId: user.id,
    centralTenantId: central.id,
    actorScope: ctx.scope,
    actorTenantId: ctx.tenantId,
    hasCentralOverride,
  };
}

/* ------------------------------------------------------------------ */
/* Password Helpers */
/* ------------------------------------------------------------------ */

function generatePasswordSetupToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  return { token, expiresAt };
}

async function issuePasswordSetupToken(userId: string) {
  const { token, expiresAt } = generatePasswordSetupToken();

  await prisma.passwordSetupToken.deleteMany({ where: { userId } });
  await prisma.passwordSetupToken.create({
    data: { userId, token, expiresAt },
  });

  return { token, expiresAt };
}

export async function changeUserPasswordInternal(userId: string, newPassword: string) {
  const hashedPassword = await hash(newPassword, 10);
  const account = await prisma.account.findFirst({ where: { userId } });

  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });
    return;
  }

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      providerId: "credential",
      accountId: userId,
      password: hashedPassword,
      accessToken: crypto.randomBytes(32).toString("hex"),
    },
  });
}

/* ------------------------------------------------------------------ */
/* CREATE / UPDATE USER */
/* ------------------------------------------------------------------ */

export async function createOrUpdateUserAction(rawData: unknown) {
  const parsed = userSchema.safeParse(rawData);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "INVALID_INPUT");

  const input = parsed.data;

  const authz = await authorizeUserAction(input.id ? ["users.update"] : ["users.create"]);
  const central = await getCentralTenant();

  // ✅ Data partition (memberships always have tenantId)
  const dataTenantId =
    authz.actorScope === RoleScope.CENTRAL ? central.id : (authz.actorTenantId as string);

  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, name: true, key: true, tenantId: true, scope: true },
  });
  if (!role) throw new Error("ROLE_NOT_FOUND");

  // ✅ Validate role assignment
  if (authz.actorScope === RoleScope.CENTRAL) {
    if (role.scope !== RoleScope.CENTRAL) throw new Error("ROLE_SCOPE_MISMATCH");
  } else {
    if (role.scope !== RoleScope.TENANT) throw new Error("ROLE_SCOPE_MISMATCH");
    if (role.tenantId !== dataTenantId) throw new Error("ROLE_TENANT_MISMATCH");
  }

  const plainPassword = (input.password ?? "").trim();
  const normalizedEmail = input.email.toLowerCase().trim();

  let user: { id: string; name: string | null; email: string; isActive: boolean | null } | null = null;

  let changedName = false;
  let changedPassword = false;
  let changedRole = false;
  let passwordSetupUrl: string | undefined;

  const tenantName =
    authz.actorScope === RoleScope.CENTRAL ? central.name : await getTenantNameById(dataTenantId);

  const loginBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (input.id) {
    const existing = await prisma.user.findUnique({
      where: { id: input.id },
      include: { memberships: true },
    });
    if (!existing) throw new Error("USER_NOT_FOUND");

    changedName = (existing.name ?? "") !== (input.name ?? "");

    const existingMembership = existing.memberships.find((m) => m.tenantId === dataTenantId);
    changedRole = existingMembership?.roleId !== input.roleId;

    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        image: input.avatarUrl ?? existing.image ?? null,
      },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (plainPassword) {
      await changeUserPasswordInternal(existing.id, plainPassword);
      changedPassword = true;
    }
  } else {
    if (!plainPassword) throw new Error("PASSWORD_REQUIRED_FOR_NEW_USER");

    const existingEmail = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existingEmail) throw new Error("EMAIL_IN_USE");

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: normalizedEmail,
        password: plainPassword,
        name: input.name,
      },
      asResponse: false,
      headers: await getSafeRequestHeaders(),
    });

    if (!signUpResult?.user) throw new Error("FAILED_TO_CREATE_USER_AUTH");

    user = await prisma.user.update({
      where: { id: signUpResult.user.id },
      data: {
        name: input.name,
        email: normalizedEmail,
        emailVerified: true,
        isActive: true,
        avatarUrl: input.avatarUrl ?? null,
        image: input.avatarUrl ?? null,
      },
      select: { id: true, name: true, email: true, isActive: true },
    });

    changedPassword = true;

    const { token } = await issuePasswordSetupToken(user.id);
    const base = loginBase.replace(/\/+$/, "");
    passwordSetupUrl = `${base}/setup-password?token=${encodeURIComponent(token)}`;
  }

  if (!user) throw new Error("FAILED_TO_SAVE_USER");

  // ✅ Membership tenantId MUST be string
  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: dataTenantId, userId: user.id } },
    update: { roleId: input.roleId, status: MembershipStatus.ACTIVE },
    create: {
      tenantId: dataTenantId,
      userId: user.id,
      roleId: input.roleId,
      status: MembershipStatus.ACTIVE,
    },
  });

  const status: UserStatus = user.isActive ? "ACTIVE" : "INACTIVE";
  const kind: UserAccountKind = input.id ? "updated" : "created";

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind, tenantName ?? undefined),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: user.name || user.email,
      email: user.email,
      status,
      roleName: role.name,
      password: undefined,
      changedName: kind === "updated" ? changedName : undefined,
      changedPassword: kind === "updated" ? changedPassword : undefined,
      changedRole: kind === "updated" ? changedRole : undefined,
      tenantName: tenantName ?? undefined,
      tenantDomain: undefined,
      loginUrl: passwordSetupUrl ?? loginBase,
    }),
  });

  return { ok: true, userId: user.id };
}

/* ------------------------------------------------------------------ */
/* DELETE USER */
/* ------------------------------------------------------------------ */

export async function deleteUserAction(input: { userId: string }) {
  const authz = await authorizeUserAction(["users.delete"]);
  const central = await getCentralTenant();

  if (input.userId === authz.actorId) throw new Error("CANNOT_DELETE_SELF");

  if (authz.actorScope === RoleScope.CENTRAL) {
    await prisma.user.delete({ where: { id: input.userId } });
    return { ok: true };
  }

  const dataTenantId = authz.actorTenantId!;
  await prisma.membership.delete({
    where: { tenantId_userId: { userId: input.userId, tenantId: dataTenantId } },
  });

  const remaining = await prisma.membership.count({
    where: { userId: input.userId, status: MembershipStatus.ACTIVE },
  });

  if (remaining === 0) {
    await prisma.user.delete({ where: { id: input.userId } });
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* TOGGLE ACTIVE */
/* ------------------------------------------------------------------ */

export async function toggleUserActiveAction(input: { userId: string; newActive: boolean }) {
  const authz = await authorizeUserAction(["users.update"]);
  if (input.userId === authz.actorId && !input.newActive) {
    throw new Error("CANNOT_DEACTIVATE_SELF");
  }

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: { isActive: input.newActive },
    select: { id: true, name: true, email: true, isActive: true },
  });

  const status: UserStatus = input.newActive ? "ACTIVE" : "INACTIVE";
  const kind: UserAccountKind = input.newActive ? "updated" : "deactivated";

  const central = await getCentralTenant();
  const tenantName =
    authz.actorScope === RoleScope.CENTRAL
      ? central.name
      : (await getTenantNameById(authz.actorTenantId!)) ?? undefined;

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind, tenantName ?? undefined),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: user.name || user.email,
      email: user.email,
      status,
      tenantName: tenantName ?? undefined,
      tenantDomain: undefined,
      loginUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    }),
  });

  return { ok: true, userId: user.id, isActive: user.isActive };
}

/* ------------------------------------------------------------------ */
/* FETCH USERS TAB */
/* ------------------------------------------------------------------ */

export async function fetchUsersTabAction(query: UsersTabQuery = {}): Promise<UsersTabPayload> {
  const session = await auth.api.getSession({
    headers: await getSafeRequestHeaders(),
    asResponse: false,
  });

  const actor = session?.user;
  if (!actor?.id) throw new Error("UNAUTHORIZED");

  const central = await getCentralTenant();
  const authz = await authorizeUserAction(["users.view"]);

  const contextScope: RoleScope = authz.actorScope;

  // ✅ memberships are always queried by a REAL tenantId string (never null)
  const baseTenantId =
    contextScope === RoleScope.CENTRAL ? central.id : (authz.actorTenantId as string);

  // CENTRAL can browse another tenant via query.tenantId
  const browseTenantId =
    contextScope === RoleScope.CENTRAL && query.tenantId ? String(query.tenantId) : null;

  const effectiveMembershipTenantId = browseTenantId ?? baseTenantId;

  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 10)));
  const skip = (page - 1) * pageSize;

  const search = String(query.search ?? "").trim();
  const sortCol = (query.sortCol ?? "createdAt") as UsersTabQuery["sortCol"];
  const sortDir = (query.sortDir ?? "desc") as UsersTabQuery["sortDir"];

  const where: Prisma.MembershipWhereInput = {
    tenantId: effectiveMembershipTenantId, // ✅ always string
    status: MembershipStatus.ACTIVE,
    ...(search
      ? {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const orderByUser =
    sortCol === "name"
      ? [{ user: { name: sortDir } }, { id: "desc" as const }]
      : sortCol === "email"
        ? [{ user: { email: sortDir } }, { id: "desc" as const }]
        : sortCol === "isActive"
          ? [{ user: { isActive: sortDir } }, { id: "desc" as const }]
          : [{ user: { createdAt: sortDir } }, { id: "desc" as const }];

  const [agg, memberships, assignableRoles] = await Promise.all([
    // ✅ safer than count() if client extensions exist
    prisma.membership.aggregate({ where, _count: { _all: true } }),
    prisma.membership.findMany({
      where,
      include: { user: true, role: true },
      skip,
      take: pageSize,
      orderBy: orderByUser as any,
    }),
    prisma.role.findMany({
      where:
        contextScope === RoleScope.CENTRAL
          ? {
              scope: RoleScope.CENTRAL,
              NOT: { key: "central_superadmin" },
            }
          : {
              scope: RoleScope.TENANT,
              tenantId: baseTenantId,
              NOT: { key: "tenant_superadmin" },
            },
      select: { id: true, key: true, name: true, scope: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalEntries = agg._count._all;

  const tenantName =
    contextScope === RoleScope.CENTRAL
      ? (browseTenantId ? await getTenantNameById(browseTenantId) : central.name)
      : await getTenantNameById(effectiveMembershipTenantId);

  return {
    users: memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      isActive: !!m.user.isActive,
      createdAt: m.user.createdAt.toISOString(),
      avatarUrl: m.user.avatarUrl || (m.user as any).image || null,
      userRoles: [
        {
          id: m.id,
          roleId: m.roleId,
          role: {
            key: m.role?.key ?? "unknown",
            name: m.role?.name ?? "Unknown Role",
            scope: m.role?.scope as "CENTRAL" | "TENANT" | undefined,
          },
          tenantId: m.tenantId, // ✅ always string
        },
      ],
    })),
    totalEntries,
    assignableRoles: assignableRoles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      scope: r.scope as "CENTRAL" | "TENANT",
    })),
    currentUserId: actor.id,

    contextScope: contextScope as "CENTRAL" | "TENANT",
    tenantId: contextScope === RoleScope.CENTRAL ? null : effectiveMembershipTenantId,
    tenantName,

    companySettings: null,
    brandingSettings: null,
  };
}

/* ------------------------------------------------------------------ */
/* BOOTSTRAP USERS TAB */
/* ------------------------------------------------------------------ */

export async function bootstrapUsersTab(rawQuery: any): Promise<UsersTabPayload> {
  return fetchUsersTabAction({
    tenantId: rawQuery?.tenantId ?? null,
    page: rawQuery?.page ?? 1,
    pageSize: rawQuery?.pageSize ?? 10,
    sortCol: rawQuery?.sortCol ?? "createdAt",
    sortDir: rawQuery?.sortDir ?? "desc",
    search: rawQuery?.search ?? "",
  });
}
