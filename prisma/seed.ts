import "dotenv/config";

import { closePrisma, prisma } from "../lib/prisma";

import { auth } from "../lib/auth";
import { hash } from "bcryptjs";
import { syncCentralSuperAdminPermissions } from "../lib/rbac";

// -----------------------------------------------------------------------------
// Pretty console output
// -----------------------------------------------------------------------------
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

function banner(title: string) {
  const line = "─".repeat(title.length + 2);
  console.log(
    `\n${COLORS.cyan}┌${line}┐\n` +
      `│ ${COLORS.bold}${title}${COLORS.reset}${COLORS.cyan} │\n` +
      `└${line}┘${COLORS.reset}\n`
  );
}

function section(title: string) {
  console.log(`\n${COLORS.magenta}${COLORS.bold}› ${title}${COLORS.reset}`);
}

// -----------------------------------------------------------------------------
// Auth user helper (BetterAuth) + ensure bcrypt password for existing accounts
// -----------------------------------------------------------------------------
async function ensureUser(opts: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });

  if (existing) {
    const hashedPassword = await hash(opts.password, 10);

    const account = await prisma.account.findFirst({
      where: { userId: existing.id },
      orderBy: { createdAt: "asc" as any },
    });

    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      });
      console.log(`  ↻ Updated password for existing user: ${opts.email}`);
    } else {
      console.log(`  ! No account row found for user: ${opts.email} (skipped pwd update)`);
    }

    return prisma.user.update({
      where: { id: existing.id },
      data: { emailVerified: true, isActive: true },
    });
  }

  await auth.api.signUpEmail({
    body: { name: opts.name, email: opts.email, password: opts.password },
  });

  const created = await prisma.user.findUnique({ where: { email: opts.email } });
  if (!created) throw new Error(`Failed to create user ${opts.email}`);

  return prisma.user.update({
    where: { id: created.id },
    data: { emailVerified: true, isActive: true },
  });
}

// -----------------------------------------------------------------------------
// Membership upsert (schema: Membership @@unique([tenantId, userId]))
// -----------------------------------------------------------------------------
async function ensureMembership(opts: { userId: string; tenantId: string; roleId?: string | null }) {
  const { userId, tenantId, roleId = null } = opts;

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    update: { roleId },
    create: { tenantId, userId, roleId },
  });
}

// Optional: enforce "single holder" for a role inside a tenant
async function enforceSingleHolder(opts: { tenantId: string; roleId: string; userId: string }) {
  const { tenantId, roleId, userId } = opts;

  await prisma.membership.updateMany({
    where: { tenantId, roleId, userId: { not: userId } },
    data: { roleId: null },
  });

  await ensureMembership({ tenantId, userId, roleId });
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
async function main() {
  banner("ERP Seed (Postgres) – Tenants, Roles, Permissions, Admins");

  // ---------------------------------------------------------------------------
  // 0) CLEAN (FK-safe)
  // ---------------------------------------------------------------------------
  section("Cleaning (FK-safe)");
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  console.log(`${COLORS.green}  ✔ cleaned rolePermission + permissions${COLORS.reset}`);

  // ---------------------------------------------------------------------------
  // 1) PERMISSIONS (GLOBAL)
  // ---------------------------------------------------------------------------
  section("Seeding permissions");

  const permissionsData = [
    { key: "dashboard.view", name: "View Dashboard" },

    { key: "manage_tenants", name: "Manage Tenants" },
    { key: "manage_settings", name: "Manage Settings" },
    { key: "manage_billing", name: "Manage Billing & Subscriptions" },
    { key: "view_audit_logs", name: "View Audit Logs" },

    { key: "view_security", name: "View Security Area" },
    { key: "manage_security", name: "Manage Security (Users/Roles)" },

    { key: "users.view", name: "View Users" },
    { key: "users.create", name: "Create Users" },
    { key: "users.update", name: "Update Users" },
    { key: "users.delete", name: "Delete Users" },

    { key: "roles.view", name: "View Roles" },
    { key: "roles.create", name: "Create Roles" },
    { key: "roles.update", name: "Update Roles" },
    { key: "roles.delete", name: "Delete Roles" },

    { key: "permissions.view", name: "View Permissions" },
    { key: "permissions.create", name: "Create Permissions" },
    { key: "permissions.update", name: "Update Permissions" },
    { key: "permissions.delete", name: "Delete Permissions" },

    { key: "manage_users", name: "Manage Users" },
    { key: "manage_roles", name: "Manage Roles & Permissions" },

    { key: "files.view", name: "View Files" },
    { key: "files.upload", name: "Upload Files" },
    { key: "files.update", name: "Rename / Move Files" },
    { key: "files.delete", name: "Delete Files" },
    { key: "folders.view", name: "View Folders" },
    { key: "folders.create", name: "Create Folders" },
    { key: "folders.update", name: "Rename / Move Folders" },
    { key: "folders.delete", name: "Delete Folders" },
    { key: "manage_files", name: "Manage Files & Folders" },

    { key: "settings.brand.view", name: "View Brand Settings" },
    { key: "settings.brand.update", name: "Update Brand Settings" },

    { key: "departments.view", name: "View Departments" },
    { key: "departments.create", name: "Create Departments" },
    { key: "departments.update", name: "Update Departments" },
    { key: "departments.delete", name: "Delete Departments" },
  ];

  await prisma.permission.createMany({
    data: permissionsData,
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany({});
  console.log(`${COLORS.green}  ✔ ${permissions.length} permissions in DB${COLORS.reset}`);

  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));

  function rolePerms(roleId: string, keys: string[]) {
    return keys
      .map((k) => {
        const pid = permByKey.get(k);
        return pid ? { roleId, permissionId: pid } : null;
      })
      .filter(Boolean) as { roleId: string; permissionId: string }[];
  }

  // ---------------------------------------------------------------------------
  // 2) TENANTS
  // ---------------------------------------------------------------------------
  section("Seeding tenants");

  const tenantsData = [
    { slug: "central-hive", name: "Central Hive" },
    { slug: "acme-corp", name: "Acme Corp" },
    { slug: "beta-labs", name: "Beta Labs" },
  ];

  const tenants = await Promise.all(
    tenantsData.map((t) =>
      prisma.tenant.upsert({
        where: { slug: t.slug },
        update: { name: t.name },
        create: t,
      })
    )
  );

  console.log(`${COLORS.green}  ✔ ${tenants.length} tenants seeded${COLORS.reset}`);

  const centralHiveTenant = tenants.find((t) => t.slug === "central-hive")!;
  const acmeTenant = tenants.find((t) => t.slug === "acme-corp")!;
  const betaTenant = tenants.find((t) => t.slug === "beta-labs")!;

  // ---------------------------------------------------------------------------
  // 3) ROLES - First check the database structure
  // ---------------------------------------------------------------------------
  section("Seeding roles");

  // First, let's create all roles without worrying about upsert logic
  // This avoids the complex findFirst with null tenantId issue
  
  // 1. First delete any existing roles (but keep users/memberships)
  // We'll delete role permissions first, then roles
  await prisma.rolePermission.deleteMany({});
  await prisma.role.deleteMany({});

  // 2. Create central_superadmin role (tenantId: null)
  const centralSuperAdmin = await prisma.role.create({
    data: {
      tenantId: null,
      key: "central_superadmin",
      name: "Central Super Administrator",
    },
  });

  console.log(`${COLORS.green}  ✓ Created central_superadmin role${COLORS.reset}`);

  // 3. Create tenant-specific roles
  const tenantRoles = [];
  for (const tenant of tenants) {
    // Superadmin role for each tenant
    const tenantSuperAdmin = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        key: "tenant_superadmin",
        name: "Tenant Super Administrator",
      },
    });

    // Admin role for each tenant
    const tenantAdmin = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        key: "tenant_admin",
        name: "Tenant Administrator",
      },
    });

    // Member role for each tenant
    const tenantMember = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        key: "tenant_member",
        name: "Tenant Member",
      },
    });

    tenantRoles.push(tenantSuperAdmin, tenantAdmin, tenantMember);
  }

  console.log(`${COLORS.green}  ✔ All roles seeded (${tenantRoles.length + 1} total)${COLORS.reset}`);

  // ---------------------------------------------------------------------------
  // 4) ROLE PERMISSIONS
  // ---------------------------------------------------------------------------
  section("Seeding role permissions");

  // Get all permission keys
  const allPermKeys = permissions.map((p) => p.key);
  // Tenant roles shouldn't have manage_tenants permission
  const tenantPermKeys = allPermKeys.filter((k) => k !== "manage_tenants");

  // Delete existing role permissions (already done above, but just to be safe)
  await prisma.rolePermission.deleteMany({});

  const rolePermissionsData: { roleId: string; permissionId: string }[] = [];

  // 1. Central superadmin gets ALL permissions
  rolePermissionsData.push(...rolePerms(centralSuperAdmin.id, allPermKeys));

  // 2. Get all tenant roles we just created
  const allTenantRoles = await prisma.role.findMany({
    where: { tenantId: { not: null } },
  });

  // 3. Assign permissions to tenant roles
  for (const role of allTenantRoles) {
    if (role.key === "tenant_superadmin" || role.key === "tenant_admin") {
      rolePermissionsData.push(...rolePerms(role.id, tenantPermKeys));
    } else if (role.key === "tenant_member") {
      rolePermissionsData.push(...rolePerms(role.id, ["manage_files", "files.view", "files.upload"]));
    }
  }

  // Create all role permissions
  await prisma.rolePermission.createMany({
    data: rolePermissionsData,
    skipDuplicates: true,
  });

  console.log(`${COLORS.green}  ✔ role permissions seeded (${rolePermissionsData.length} records)${COLORS.reset}`);

  // ---------------------------------------------------------------------------
  // 5) TENANT DOMAINS (upsert by unique domain)
  // ---------------------------------------------------------------------------
  section("Seeding tenant domains");

  const domainData = [
    { slug: "central-hive", domain: "central.localhost" },
    { slug: "acme-corp", domain: "acme.localhost" },
    { slug: "beta-labs", domain: "beta.localhost" },
  ];

  // First delete existing domains to avoid conflicts
  await prisma.tenantDomain.deleteMany({});

  const tenantDomains = await Promise.all(
    domainData.map(async ({ slug, domain }) => {
      const tenant = tenants.find((t) => t.slug === slug);
      if (!tenant) throw new Error(`Tenant not found for slug ${slug}`);

      return prisma.tenantDomain.create({
        data: { tenantId: tenant.id, domain },
      });
    })
  );

  console.log(`${COLORS.green}  ✔ ${tenantDomains.length} tenant domains seeded${COLORS.reset}`);

  // ---------------------------------------------------------------------------
  // 6) USERS
  // ---------------------------------------------------------------------------
  section("Seeding users");

  const DEFAULT_PASSWORD = "Password123!";

  // Create or update users
  const centralUser = await ensureUser({
    name: "Central Superadmin",
    email: "jollyaemero2223@gmail.com",
    password: DEFAULT_PASSWORD,
  });

  const acmeAdmin = await ensureUser({
    name: "Acme Superadmin",
    email: "acme.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  const betaAdmin = await ensureUser({
    name: "Beta Labs Superadmin",
    email: "beta.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  const centralHiveAdmin = await ensureUser({
    name: "Central Hive Superadmin",
    email: "central.hive.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  console.log(`${COLORS.green}  ✔ 4 admin users ensured${COLORS.reset}`);

  // ---------------------------------------------------------------------------
  // 7) MEMBERSHIPS + ROLE ASSIGNMENT (Membership.roleId)
  // ---------------------------------------------------------------------------
  section("Linking memberships + assigning roles");

  // First, delete existing memberships for these users to avoid conflicts
  const userIds = [centralUser.id, acmeAdmin.id, betaAdmin.id, centralHiveAdmin.id];
  await prisma.membership.deleteMany({
    where: { userId: { in: userIds } },
  });

  // Get tenant superadmin roles
  const acmeSuperRole = await prisma.role.findFirstOrThrow({
    where: { key: "tenant_superadmin", tenantId: acmeTenant.id },
  });

  const betaSuperRole = await prisma.role.findFirstOrThrow({
    where: { key: "tenant_superadmin", tenantId: betaTenant.id },
  });

  const centralHiveSuperRole = await prisma.role.findFirstOrThrow({
    where: { key: "tenant_superadmin", tenantId: centralHiveTenant.id },
  });

  // Assign users to tenants with roles
  await ensureMembership({ userId: acmeAdmin.id, tenantId: acmeTenant.id, roleId: acmeSuperRole.id });
  await ensureMembership({ userId: betaAdmin.id, tenantId: betaTenant.id, roleId: betaSuperRole.id });
  await ensureMembership({
    userId: centralHiveAdmin.id,
    tenantId: centralHiveTenant.id,
    roleId: centralHiveSuperRole.id,
  });

  // Central user gets central_superadmin role in central-hive tenant
  await ensureMembership({
    userId: centralUser.id,
    tenantId: centralHiveTenant.id,
    roleId: centralSuperAdmin.id,
  });

  // Optional: Enforce single holder for superadmin roles
  await enforceSingleHolder({ tenantId: centralHiveTenant.id, roleId: centralSuperAdmin.id, userId: centralUser.id });
  await enforceSingleHolder({ tenantId: acmeTenant.id, roleId: acmeSuperRole.id, userId: acmeAdmin.id });
  await enforceSingleHolder({ tenantId: betaTenant.id, roleId: betaSuperRole.id, userId: betaAdmin.id });
  await enforceSingleHolder({
    tenantId: centralHiveTenant.id,
    roleId: centralHiveSuperRole.id,
    userId: centralHiveAdmin.id,
  });

  console.log(`${COLORS.green}  ✔ memberships + roles assigned${COLORS.reset}`);

  // ---------------------------------------------------------------------------
  // 8) SYNC CENTRAL ROLE PERMISSIONS
  // ---------------------------------------------------------------------------
  section("Syncing central_superadmin permissions");
  await syncCentralSuperAdminPermissions();
  console.log(`${COLORS.green}  ✔ central_superadmin permissions synced${COLORS.reset}`);

  // ---------------------------------------------------------------------------
  // 9) SUMMARY
  // ---------------------------------------------------------------------------
  banner("Seed Complete");

  const domainsByTenantId = new Map(tenantDomains.map((td) => [td.tenantId, td.domain]));

  console.log(`${COLORS.bold}${COLORS.yellow}Seeded Admin Users:${COLORS.reset}\n`);

  const rows = [
    {
      label: "Central Superadmin",
      tenant: "central-hive",
      domain: domainsByTenantId.get(centralHiveTenant.id) || "-",
      email: centralUser.email,
      password: DEFAULT_PASSWORD,
    },
    {
      label: "Acme Tenant Superadmin",
      tenant: "acme-corp",
      domain: domainsByTenantId.get(acmeTenant.id) || "-",
      email: acmeAdmin.email,
      password: DEFAULT_PASSWORD,
    },
    {
      label: "Beta Tenant Superadmin",
      tenant: "beta-labs",
      domain: domainsByTenantId.get(betaTenant.id) || "-",
      email: betaAdmin.email,
      password: DEFAULT_PASSWORD,
    },
    {
      label: "Central Hive Tenant Superadmin",
      tenant: "central-hive",
      domain: domainsByTenantId.get(centralHiveTenant.id) || "-",
      email: centralHiveAdmin.email,
      password: DEFAULT_PASSWORD,
    },
  ];

  console.log(`${COLORS.cyan}┌────────────────────────────────────────────────────────────────────────────────────┐${COLORS.reset}`);
  console.log(
    `${COLORS.cyan}│ ${COLORS.bold}ROLE                         TENANT        DOMAIN              EMAIL                       PASSWORD ${COLORS.cyan}│${COLORS.reset}`
  );
  console.log(`${COLORS.cyan}├────────────────────────────────────────────────────────────────────────────────────┤${COLORS.reset}`);

  for (const r of rows) {
    const roleCell = (r.label + " ".repeat(28)).slice(0, 28);
    const tenantCell = (r.tenant + " ".repeat(12)).slice(0, 12);
    const domainCell = (r.domain + " ".repeat(18)).slice(0, 18);
    const emailCell = (r.email + " ".repeat(26)).slice(0, 26);
    console.log(
      `${COLORS.cyan}│ ${COLORS.reset}${roleCell} ${tenantCell} ${domainCell} ${emailCell} ${r.password} ${COLORS.cyan}│${COLORS.reset}`
    );
  }

  console.log(`${COLORS.cyan}└────────────────────────────────────────────────────────────────────────────────────┘${COLORS.reset}\n`);
  console.log(`${COLORS.green}${COLORS.bold}You can now log in with any of the above users.${COLORS.reset}\n`);
  console.log(`${COLORS.yellow}Note: For development, use:${COLORS.reset}`);
  console.log(`  - Central dashboard: ${COLORS.cyan}http://central.localhost:3000${COLORS.reset}`);
  console.log(`  - Acme dashboard:    ${COLORS.cyan}http://acme.localhost:3000${COLORS.reset}`);
  console.log(`  - Beta dashboard:    ${COLORS.cyan}http://beta.localhost:3000${COLORS.reset}`);
}

main()
  .catch((e) => {
    console.error(`${COLORS.red}Seed error${COLORS.reset}`, e);
    process.exit(1);
  })
  .finally(async () => {
    await closePrisma();
  });