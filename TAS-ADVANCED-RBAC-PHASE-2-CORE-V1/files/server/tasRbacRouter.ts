import mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { isAdminRole, normalizeUserRole } from "./roleUtils";
import {
  DEFAULT_TAS_ROLE_MATRIX,
  TAS_DATA_SCOPES,
  TAS_RBAC_ACTIONS,
  TAS_RBAC_MODULES,
  type TasPermissionMatrix,
  type TasRbacAction,
  type TasRbacModule,
} from "./tasRbacPolicy";
import {
  TAS_RBAC_FEATURES,
  getTasRbacFeature,
  isTasRbacFeatureKey,
  type TasRbacFeatureKey,
} from "./tasRbacFeatureCatalog";

let pool: mysql.Pool | null = null;
function getPool() {
  if (!process.env.DATABASE_URL) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DATABASE_URL is not configured" });
  if (!pool) pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isAdminRole(ctx.user?.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin permission required" });
  return next({ ctx });
});

const permissionInput = z.object({
  module: z.enum(TAS_RBAC_MODULES),
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
  export: z.boolean(),
  approve: z.boolean(),
  assign: z.boolean(),
  dataScope: z.enum(TAS_DATA_SCOPES),
});

const featurePermissionInput = z.object({
  featureKey: z.string().min(3).max(191).refine((value) => isTasRbacFeatureKey(value), "Unknown TAS feature key"),
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
  export: z.boolean(),
  approve: z.boolean(),
  assign: z.boolean(),
});

export type TasFeatureGrant = Record<TasRbacAction, boolean>;
export type TasFeaturePermissionMap = Partial<Record<TasRbacFeatureKey, TasFeatureGrant>>;

async function roleIdByKey(roleKey: string): Promise<number | null> {
  const [rows] = await getPool().query<any[]>("SELECT id FROM tas_rbac_roles WHERE role_key=? AND is_active=1 LIMIT 1", [roleKey]);
  return rows[0]?.id ?? null;
}

async function explicitMatrix(roleKey: string): Promise<TasPermissionMatrix | null> {
  const [rows] = await getPool().query<any[]>(
    `SELECT p.module_key, p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_export, p.can_approve, p.can_assign, p.data_scope
     FROM tas_rbac_role_permissions p
     INNER JOIN tas_rbac_roles r ON r.id=p.role_id
     WHERE r.role_key=? AND r.is_active=1`,
    [roleKey],
  );
  if (!rows.length) return null;
  const matrix: TasPermissionMatrix = {};
  for (const row of rows) {
    if (!TAS_RBAC_MODULES.includes(row.module_key)) continue;
    matrix[row.module_key as keyof TasPermissionMatrix] = {
      view: Boolean(row.can_view), create: Boolean(row.can_create), edit: Boolean(row.can_edit),
      delete: Boolean(row.can_delete), export: Boolean(row.can_export), approve: Boolean(row.can_approve),
      assign: Boolean(row.can_assign), dataScope: row.data_scope,
    };
  }
  return matrix;
}

async function rawFeatureOverrides(roleKey: string): Promise<TasFeaturePermissionMap> {
  const [rows] = await getPool().query<any[]>(
    `SELECT p.feature_key, p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_export, p.can_approve, p.can_assign
     FROM tas_rbac_feature_permissions p
     INNER JOIN tas_rbac_roles r ON r.id=p.role_id
     WHERE r.role_key=? AND r.is_active=1`,
    [roleKey],
  );
  const result: TasFeaturePermissionMap = {};
  for (const row of rows) {
    if (!isTasRbacFeatureKey(String(row.feature_key))) continue;
    result[row.feature_key as TasRbacFeatureKey] = {
      view: Boolean(row.can_view),
      create: Boolean(row.can_create),
      edit: Boolean(row.can_edit),
      delete: Boolean(row.can_delete),
      export: Boolean(row.can_export),
      approve: Boolean(row.can_approve),
      assign: Boolean(row.can_assign),
    };
  }
  return result;
}

export async function effectiveTasPermissions(user: { id: number; role?: string | null }): Promise<TasPermissionMatrix> {
  const roleKey = normalizeUserRole(user.role);
  if (roleKey === "Admin") return DEFAULT_TAS_ROLE_MATRIX.Admin;
  return (await explicitMatrix(roleKey)) ?? DEFAULT_TAS_ROLE_MATRIX[roleKey] ?? DEFAULT_TAS_ROLE_MATRIX.SalesAgent;
}

export function effectiveFeatureGrant(
  matrix: TasPermissionMatrix,
  featureKey: TasRbacFeatureKey,
  override?: TasFeatureGrant,
): TasFeatureGrant {
  const feature = getTasRbacFeature(featureKey);
  const moduleGrant = feature ? matrix[feature.module] : undefined;
  const result = {} as TasFeatureGrant;
  for (const action of TAS_RBAC_ACTIONS) {
    const parentAllowed = Boolean(moduleGrant?.[action]);
    result[action] = parentAllowed && (override ? Boolean(override[action]) : true);
  }
  if (!moduleGrant?.view) {
    for (const action of TAS_RBAC_ACTIONS) result[action] = false;
  }
  return result;
}

export async function effectiveTasFeaturePermissions(
  user: { id: number; role?: string | null },
  matrix?: TasPermissionMatrix,
): Promise<TasFeaturePermissionMap> {
  const roleKey = normalizeUserRole(user.role);
  const moduleMatrix = matrix ?? await effectiveTasPermissions(user);
  const overrides = roleKey === "Admin" ? {} : await rawFeatureOverrides(roleKey);
  const result: TasFeaturePermissionMap = {};
  for (const feature of TAS_RBAC_FEATURES) {
    result[feature.key] = effectiveFeatureGrant(moduleMatrix, feature.key, overrides[feature.key]);
  }
  return result;
}

export async function requireTasPermission(
  user: { id: number; role?: string | null },
  module: (typeof TAS_RBAC_MODULES)[number],
  action: (typeof TAS_RBAC_ACTIONS)[number],
) {
  const matrix = await effectiveTasPermissions(user);
  if (!matrix[module]?.[action]) throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${module}.${action}` });
  return matrix[module]!.dataScope;
}

export const tasRbacRouter = router({
  catalog: protectedProcedure.query(() => ({
    modules: TAS_RBAC_MODULES,
    actions: TAS_RBAC_ACTIONS,
    dataScopes: TAS_DATA_SCOPES,
    features: TAS_RBAC_FEATURES,
  })),

  me: protectedProcedure.query(async ({ ctx }) => {
    const role = normalizeUserRole(ctx.user.role);
    const permissions = await effectiveTasPermissions(ctx.user);
    return {
      role,
      permissions,
      featurePermissions: await effectiveTasFeaturePermissions(ctx.user, permissions),
    };
  }),

  listUsers: adminProcedure.query(async () => {
    const [rows] = await getPool().query<any[]>("SELECT id, name, email, role FROM users WHERE deletedAt IS NULL ORDER BY name, email");
    return rows;
  }),

  listRoles: adminProcedure.query(async () => {
    const [roles] = await getPool().query<any[]>("SELECT id, role_key roleKey, name_ar nameAr, name_en nameEn, description, is_system isSystem, is_active isActive FROM tas_rbac_roles WHERE is_active=1 ORDER BY is_system DESC, name_en");
    const result = [];
    for (const role of roles) {
      const permissions = role.roleKey === "Admin"
        ? DEFAULT_TAS_ROLE_MATRIX.Admin
        : (await explicitMatrix(role.roleKey)) ?? DEFAULT_TAS_ROLE_MATRIX[role.roleKey] ?? {};
      const featureOverrides = role.roleKey === "Admin" ? {} : await rawFeatureOverrides(role.roleKey);
      const featurePermissions: TasFeaturePermissionMap = {};
      for (const feature of TAS_RBAC_FEATURES) {
        featurePermissions[feature.key] = effectiveFeatureGrant(permissions, feature.key, featureOverrides[feature.key]);
      }
      result.push({ ...role, permissions, featureOverrides, featurePermissions });
    }
    return result;
  }),

  saveRole: adminProcedure
    .input(z.object({
      roleKey: z.string().min(2).max(128),
      nameAr: z.string().max(255).optional(),
      nameEn: z.string().min(2).max(255),
      description: z.string().max(2000).optional(),
      permissions: z.array(permissionInput),
      featurePermissions: z.array(featurePermissionInput).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.roleKey === "Admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin is a protected system role" });
      const conn = await getPool().getConnection();
      try {
        await conn.beginTransaction();
        const [existing] = await conn.query<any[]>("SELECT * FROM tas_rbac_roles WHERE role_key=? LIMIT 1", [input.roleKey]);
        const beforeRole = existing[0] ?? null;
        const beforeFeatures = beforeRole ? await rawFeatureOverrides(input.roleKey) : {};
        await conn.execute(
          `INSERT INTO tas_rbac_roles (role_key,name_ar,name_en,description,is_system,is_active,created_by)
           VALUES (?,?,?,?,0,1,?) ON DUPLICATE KEY UPDATE name_ar=VALUES(name_ar),name_en=VALUES(name_en),description=VALUES(description),is_active=1`,
          [input.roleKey, input.nameAr ?? null, input.nameEn, input.description ?? null, ctx.user.id],
        );
        const [idRows] = await conn.query<any[]>("SELECT id FROM tas_rbac_roles WHERE role_key=? LIMIT 1", [input.roleKey]);
        const roleId = idRows[0].id;
        await conn.execute("DELETE FROM tas_rbac_role_permissions WHERE role_id=?", [roleId]);
        for (const p of input.permissions) {
          await conn.execute(
            `INSERT INTO tas_rbac_role_permissions
             (role_id,module_key,can_view,can_create,can_edit,can_delete,can_export,can_approve,can_assign,data_scope)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [roleId,p.module,+p.view,+p.create,+p.edit,+p.delete,+p.export,+p.approve,+p.assign,p.dataScope],
          );
        }

        if (input.featurePermissions !== undefined) {
          await conn.execute("DELETE FROM tas_rbac_feature_permissions WHERE role_id=?", [roleId]);
          for (const p of input.featurePermissions) {
            await conn.execute(
              `INSERT INTO tas_rbac_feature_permissions
               (role_id,feature_key,can_view,can_create,can_edit,can_delete,can_export,can_approve,can_assign)
               VALUES (?,?,?,?,?,?,?,?,?)`,
              [roleId,p.featureKey,+p.view,+p.create,+p.edit,+p.delete,+p.export,+p.approve,+p.assign],
            );
          }
        }

        await conn.execute(
          "INSERT INTO tas_rbac_audit_log (actor_user_id,action,target_type,target_id,before_json,after_json) VALUES (?,?,?,?,?,?)",
          [ctx.user.id, beforeRole ? "role.update" : "role.create", "role", String(roleId), JSON.stringify({ role: beforeRole, featurePermissions: beforeFeatures }), JSON.stringify(input)],
        );
        await conn.commit();
        return { success: true, roleId };
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally { conn.release(); }
    }),

  resetFeatureOverrides: adminProcedure
    .input(z.object({
      roleKey: z.string().min(2).max(128),
      featureKeys: z.array(z.string().refine((value) => isTasRbacFeatureKey(value), "Unknown TAS feature key")).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.roleKey === "Admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin is a protected system role" });
      const roleId = await roleIdByKey(input.roleKey);
      if (!roleId) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
      const before = await rawFeatureOverrides(input.roleKey);
      if (input.featureKeys?.length) {
        const keys = input.featureKeys.filter(isTasRbacFeatureKey);
        const placeholders = keys.map(() => "?").join(",");
        await getPool().execute(`DELETE FROM tas_rbac_feature_permissions WHERE role_id=? AND feature_key IN (${placeholders})`, [roleId, ...keys]);
      } else {
        await getPool().execute("DELETE FROM tas_rbac_feature_permissions WHERE role_id=?", [roleId]);
      }
      await getPool().execute(
        "INSERT INTO tas_rbac_audit_log (actor_user_id,action,target_type,target_id,before_json,after_json) VALUES (?,?,?,?,?,?)",
        [ctx.user.id,"role.feature_permissions.reset","role",String(roleId),JSON.stringify(before),JSON.stringify({ featureKeys: input.featureKeys ?? "all" })],
      );
      return { success: true };
    }),

  deleteRole: adminProcedure.input(z.object({ roleKey: z.string() })).mutation(async ({ ctx, input }) => {
    if (input.roleKey === "Admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin is a protected system role" });
    const roleId = await roleIdByKey(input.roleKey);
    if (!roleId) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
    await getPool().execute("UPDATE tas_rbac_roles SET is_active=0 WHERE id=? AND is_system=0", [roleId]);
    await getPool().execute("INSERT INTO tas_rbac_audit_log (actor_user_id,action,target_type,target_id) VALUES (?,?,?,?)", [ctx.user.id,"role.delete","role",String(roleId)]);
    return { success: true };
  }),

  assignUserRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), roleKey: z.string() })).mutation(async ({ ctx, input }) => {
    const roleId = await roleIdByKey(input.roleKey);
    if (!roleId) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute("UPDATE tas_rbac_user_roles SET is_primary=0 WHERE user_id=?", [input.userId]);
      await conn.execute(
        `INSERT INTO tas_rbac_user_roles (user_id,role_id,is_primary,assigned_by) VALUES (?,?,1,?)
         ON DUPLICATE KEY UPDATE is_primary=1,assigned_by=VALUES(assigned_by)`,
        [input.userId,roleId,ctx.user.id],
      );
      await conn.execute("UPDATE users SET role=? WHERE id=?", [input.roleKey,input.userId]);
      await conn.execute("INSERT INTO tas_rbac_audit_log (actor_user_id,action,target_type,target_id,after_json) VALUES (?,?,?,?,?)", [ctx.user.id,"user.role.assign","user",String(input.userId),JSON.stringify({ roleKey: input.roleKey })]);
      await conn.commit();
      return { success: true };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally { conn.release(); }
  }),
});
