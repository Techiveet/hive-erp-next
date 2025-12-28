"use server";

import {
  UserAccountEmail,
  getUserAccountSubject,
} from "@/emails/user-account-template";

import { MembershipStatus } from "@prisma/client";
import React from "react";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { hash } from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/send-email";
import { userSchema } from "@/lib/validations/security";

/* ------------------------------------------------------------------
 * Tenant helpers
 * ------------------------------------------------------------------ */

async function getTenantMeta(tenantId?: string | null) {
  if (!tenantId) {
    return {
      tenantName: undefined as string | undefined,
      tenantDomain: undefined as string | undefined,
      loginUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { domains: true },
  });

  if (!tenant) {
    return {
      tenantName: undefined,
      tenantDomain: undefined,
      loginUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
    };
  }

  const primaryDomain = tenant.domains[0]?.domain;
  const loginUrl = primaryDomain
    ? primaryDomain.startsWith("http")
      ? primaryDomain
      : `https://${primaryDomain}`
    : process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  return {
    tenantName: tenant.name,
    tenantDomain: primaryDomain,
    loginUrl,
  };
}

async function getCentralTenantId(): Promise<string> {
  const central = await prisma.tenant.findUnique({
    where: { slug: "central-hive" },
    select: { id: true },
  });

  if (!central) {
    throw new Error("CENTRAL_TENANT_NOT_FOUND");
  }

  return central.id;
}

/* ------------------------------------------------------------------
 * Auth + permission helper
 * ------------------------------------------------------------------ */

async function authorizeUserAction(
  tenantId: string | null | undefined,
  requiredPermissions: string[]
) {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  if (tenantId) {
    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
    }
  }

  const perms = await getCurrentUserPermissions(tenantId ?? null);

  const hasRequired = requiredPermissions.some(
    (key) =>
      perms.includes(key) ||
      perms.includes("manage_users") ||
      perms.includes("manage_security")
  );

  if (!hasRequired) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  return { actorId: user.id };
}

/* ------------------------------------------------------------------
 * Password-setup token helpers
 * ------------------------------------------------------------------ */

function generatePasswordSetupToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  return { token, expiresAt };
}

async function issuePasswordSetupToken(userId: string) {
  const { token, expiresAt } = generatePasswordSetupToken();

  await prisma.passwordSetupToken.deleteMany({
    where: { userId },
  });

  await prisma.passwordSetupToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/* ------------------------------------------------------------------
 * Shared password-change helper
 * ------------------------------------------------------------------ */

export async function changeUserPasswordInternal(
  userId: string,
  newPassword: string
) {
  const hashedPassword = await hash(newPassword, 10);

  const account = await prisma.account.findFirst({
    where: { userId },
  });

  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });
  } else {
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
}

/* ------------------------------------------------------------------
 * CREATE / UPDATE USER
 * ------------------------------------------------------------------ */

export async function createOrUpdateUserAction(rawData: unknown) {
  const parsed = userSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "INVALID_INPUT");
  }
  const input = parsed.data;

  await authorizeUserAction(
    input.tenantId ?? null,
    input.id ? ["users.update"] : ["users.create"]
  );

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new Error("ROLE_NOT_FOUND");

  if (input.tenantId && role.tenantId !== input.tenantId) {
    throw new Error("ROLE_TENANT_MISMATCH");
  }
  if (!input.tenantId && role.tenantId !== null) {
    throw new Error("ROLE_SCOPE_MISMATCH");
  }

  if (role.key === "central_superadmin" && role.tenantId === null) {
    const existingHolder = await prisma.membership.findFirst({
      where: {
        roleId: role.id,
        ...(input.id ? { userId: { not: input.id } } : {}),
        status: MembershipStatus.ACTIVE,
      },
    });
    if (existingHolder) {
      throw new Error("CENTRAL_SUPERADMIN_ALREADY_ASSIGNED");
    }
  }

  if (role.key === "tenant_superadmin" && role.tenantId) {
    const existingTenantSuper = await prisma.membership.findFirst({
      where: {
        roleId: role.id,
        tenantId: role.tenantId,
        ...(input.id ? { userId: { not: input.id } } : {}),
        status: MembershipStatus.ACTIVE,
      },
    });
    if (existingTenantSuper) {
      throw new Error("TENANT_SUPERADMIN_ALREADY_ASSIGNED");
    }
  }

  const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(
    input.tenantId
  );

  let user;
  let changedName = false;
  let changedPassword = false;
  let changedRole = false;

  const plainPassword = (input.password ?? "").trim();
  const normalizedEmail = input.email.toLowerCase().trim();

  let passwordSetupUrl: string | undefined;

  if (input.id) {
    const existing = await prisma.user.findUnique({
      where: { id: input.id },
      include: {
        memberships: {
          include: { role: true, tenant: true },
        },
      },
    });
    if (!existing) throw new Error("USER_NOT_FOUND");

    changedName = existing.name !== input.name;

    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        image: input.avatarUrl ?? existing.image ?? null,
      },
    });

    const effectiveTenantId =
      input.tenantId ?? (await getCentralTenantId());

    const existingMembershipForContext = existing.memberships.find(
      (m) => m.tenantId === effectiveTenantId
    );

    changedRole = existingMembershipForContext?.roleId !== input.roleId;

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
      headers: await headers(),
    });

    if (!signUpResult?.user) {
      throw new Error("FAILED_TO_CREATE_USER_AUTH");
    }

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
    });

    changedPassword = true;
    const { token } = await issuePasswordSetupToken(user.id);

    const baseAppUrl =
      loginUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    passwordSetupUrl = `${baseAppUrl.replace(
      /\/+$/,
      ""
    )}/setup-password?token=${encodeURIComponent(token)}`;
  }

  const effectiveTenantId =
    input.tenantId ?? (await getCentralTenantId());

  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: effectiveTenantId, userId: user.id },
    },
    update: {
      roleId: input.roleId,
      status: MembershipStatus.ACTIVE,
    },
    create: {
      tenantId: effectiveTenantId,
      userId: user.id,
      roleId: input.roleId,
      status: MembershipStatus.ACTIVE,
    },
  });

  const status = user.isActive ? "ACTIVE" : "INACTIVE";
  const kind = input.id ? ("updated" as const) : ("created" as const);

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind, tenantName),
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
      tenantName,
      tenantDomain,
      loginUrl: passwordSetupUrl ?? loginUrl,
    }),
  });
}

/* ------------------------------------------------------------------
 * DELETE USER
 * ------------------------------------------------------------------ */

export async function deleteUserAction(input: {
  userId: string;
  tenantId?: string | null;
}) {
  const tenantId = input.tenantId ?? null;
  const { actorId } = await authorizeUserAction(tenantId, ["users.delete"]);

  if (input.userId === actorId) throw new Error("CANNOT_DELETE_SELF");

  const centralTenantId = await getCentralTenantId();

  if (!tenantId) {
    const centralRole = await prisma.role.findFirst({
      where: { key: "central_superadmin", tenantId: null },
    });

    if (centralRole) {
      const isTargetCentralSuper = await prisma.membership.findFirst({
        where: {
          userId: input.userId,
          roleId: centralRole.id,
          tenantId: centralTenantId,
          status: MembershipStatus.ACTIVE,
        },
      });

      if (isTargetCentralSuper) {
        const count = await prisma.membership.count({
          where: {
            roleId: centralRole.id,
            tenantId: centralTenantId,
            status: MembershipStatus.ACTIVE,
          },
        });
        if (count <= 1) throw new Error("CANNOT_DELETE_LAST_USER");
      }
    }

    await prisma.user.delete({ where: { id: input.userId } });
    return;
  }

  const tenantUsersCount = await prisma.membership.count({
    where: { tenantId, status: MembershipStatus.ACTIVE },
  });
  if (tenantUsersCount <= 1) throw new Error("CANNOT_DELETE_LAST_USER");

  await prisma.membership.delete({
    where: { tenantId_userId: { userId: input.userId, tenantId } },
  });

  const remainingMemberships = await prisma.membership.count({
    where: { userId: input.userId, status: MembershipStatus.ACTIVE },
  });

  if (remainingMemberships === 0) {
    await prisma.user.delete({ where: { id: input.userId } });
  }
}

/* ------------------------------------------------------------------
 * TOGGLE ACTIVE
 * ------------------------------------------------------------------ */

export async function toggleUserActiveAction(input: {
  userId: string;
  newActive: boolean;
  tenantId?: string | null;
}) {
  const tenantId = input.tenantId ?? null;
  const { actorId } = await authorizeUserAction(tenantId, ["users.update"]);

  if (input.userId === actorId && !input.newActive) {
    throw new Error("CANNOT_DEACTIVATE_SELF");
  }

  const centralTenantId = await getCentralTenantId();

  if (!input.newActive) {
    const memberships = await prisma.membership.findMany({
      where: { userId: input.userId },
      include: { role: true },
    });

    for (const m of memberships) {
      // ✅ FIXED: Null check for m.role
      if (m.role?.key === "central_superadmin") {
        const count = await prisma.membership.count({
          where: {
            roleId: m.roleId ?? undefined, // Handle null roleId
            tenantId: centralTenantId,
            status: MembershipStatus.ACTIVE,
          },
        });
        if (count <= 1) throw new Error("CANNOT_DEACTIVATE_LAST_USER");
      }

      // ✅ FIXED: Null check for m.role
      if (m.role?.key === "tenant_superadmin" && m.tenantId) {
        const count = await prisma.membership.count({
          where: {
            roleId: m.roleId ?? undefined, // Handle null roleId
            tenantId: m.tenantId,
            status: MembershipStatus.ACTIVE,
          },
        });
        if (count <= 1) throw new Error("CANNOT_DEACTIVATE_LAST_USER");
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: { isActive: input.newActive },
  });

  const status = input.newActive ? "ACTIVE" : "INACTIVE";
  const kind = input.newActive ? ("updated" as const) : ("deactivated" as const);
  const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(tenantId);

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind, tenantName),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: user.name || user.email,
      email: user.email,
      status,
      tenantName,
      tenantDomain,
      loginUrl,
    }),
  });
}

/* ------------------------------------------------------------------
 * BOOTSTRAP USERS TAB
 * ------------------------------------------------------------------ */

export async function bootstrapUsersTab() {
  const centralTenantId = await getCentralTenantId();

  const { actorId } = await authorizeUserAction(null, [
    "users.view",
    "view_security",
  ]);

  const centralTenant = await prisma.tenant.findUnique({
    where: { id: centralTenantId },
    select: { id: true, name: true },
  });

  const tenantName = centralTenant?.name ?? null;

  const memberships = await prisma.membership.findMany({
    where: {
      tenantId: centralTenantId,
      status: MembershipStatus.ACTIVE,
    },
    include: {
      user: true,
      role: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  type UserForClient = {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
    isActive: boolean;
    avatarUrl?: string | null;
    userRoles: {
      id: string;
      role: { key: string; name: string };
      tenantId: string | null;
    }[];
  };

  const usersMap = new Map<string, UserForClient>();

  for (const m of memberships) {
    const u = m.user;
    if (!usersMap.has(u.id)) {
      usersMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
        isActive: u.isActive ?? true,
        avatarUrl: (u as any).avatarUrl ?? (u as any).image ?? null,
        userRoles: [],
      });
    }

    // ✅ FIXED: Only add roles that actually exist
    if (m.role) {
      const entry = usersMap.get(u.id)!;
      entry.userRoles.push({
        id: m.id,
        role: {
          key: m.role.key,
          name: m.role.name,
        },
        tenantId: m.tenantId,
      });
    }
  }

  const users = Array.from(usersMap.values());

  const assignableRolesRaw = await prisma.role.findMany({
    where: { tenantId: null },
    select: {
      id: true,
      key: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  const assignableRoles = assignableRolesRaw.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
  }));

  const centralRoleMap: Record<string, string> = assignableRoles.reduce(
    (acc, r) => {
      acc[r.id] = r.name;
      return acc;
    },
    {} as Record<string, string>
  );

  const prismaAny = prisma as any;
  const companySettings = prismaAny.companySettings 
    ? await prismaAny.companySettings.findFirst({ where: { tenantId: centralTenantId } }) 
    : null;

  const brandingSettings = prismaAny.brandingSettings 
    ? await prismaAny.brandingSettings.findFirst({ where: { tenantId: centralTenantId } }) 
    : null;

  return {
    users,
    assignableRoles,
    centralRoleMap,
    currentUserId: actorId,
    tenantId: null,
    tenantName,
    companySettings,
    brandingSettings,
  };
}