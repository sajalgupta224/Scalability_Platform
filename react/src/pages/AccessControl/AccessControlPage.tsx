import React, { useEffect, useMemo, useState } from 'react';
import styles from './AccessControlPage.module.scss';

import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { RbacAPI } from '../../api/endpoints/rbac.api';
import type { PermissionRow } from '../../api/endpoints/rbac.api';
import { useAppContext } from '../../context/AppContext';
import { RBAC_PAGES, RBAC_GROUPS } from '../../constants/rbacPages';

const normalize = (v: string | null | undefined) => (v || '').trim().toLowerCase();
const clean = (v: string | null | undefined) => (v || '').trim();

const AccessControlPage: React.FC = () => {
  const { currentRole, refreshPermissions } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  // 🚫 Non-admins cannot access this page
  if (normalize(currentRole) !== 'raise_admin') {
    return (
      <div className={styles.page}>
        <h2 className={styles.title}>Access Denied</h2>
        <p style={{ padding: 20, fontSize: 18 }}>
          ❌ You do NOT have permission to view this page.
        </p>
      </div>
    );
  }

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const permRows = await RbacAPI.getPermissions();
      setPermissions(permRows);

      const roles = Array.from(new Set(permRows.map((p) => p.ROLE_NAME))).sort();
      setSelectedRole(roles[0] || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load RBAC data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const roles = useMemo(() => {
    return Array.from(new Set(permissions.map((p) => p.ROLE_NAME))).sort();
  }, [permissions]);

  // ✅ include all RBAC_PAGES + backend pages
  const allPages = useMemo(() => {
    const backendPages = Array.from(new Set(permissions.map((p) => clean(p.PAGE_NAME))));
    const merged = Array.from(new Set([...RBAC_PAGES, ...backendPages]));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [permissions]);

  // ✅ grouped pages set (avoid TS includes errors)
  const groupedPagesSet = useMemo(() => {
    const set = new Set<string>();
    RBAC_GROUPS.forEach((g) => {
      set.add(g.parent);
      g.children.forEach((c) => set.add(c));
    });
    return set;
  }, []);

  // rows for selected role (explicit)
  const roleRows = useMemo(() => {
    return permissions.filter((r) => normalize(r.ROLE_NAME) === normalize(selectedRole));
  }, [permissions, selectedRole]);

  const explicitSet = useMemo(() => {
    return new Set(roleRows.map((r) => clean(r.PAGE_NAME)));
  }, [roleRows]);

  /**
   * ✅ Baseline that matches runtime inheritance:
   * - Apply explicit rows first
   * - Then if child missing, inherit from parent (Home/Application)
   */
  const baseline = useMemo(() => {
    const base: Record<string, boolean> = {};
    allPages.forEach((p) => (base[p] = false));

    roleRows.forEach((r) => {
      base[clean(r.PAGE_NAME)] = Boolean(r.HAS_ACCESS);
    });

    RBAC_GROUPS.forEach((group) => {
      const parentVal = Boolean(base[group.parent]);
      group.children.forEach((child) => {
        if (!explicitSet.has(child)) base[child] = parentVal; // inherit
      });
    });

    return base;
  }, [allPages, roleRows, explicitSet]);

  useEffect(() => {
    setDraft(baseline);
    setSuccessMsg(null);
  }, [baseline]);

  // parent->child UI behavior
  const toggle = (page: string) => {
    setDraft((prev) => {
      const next = { ...prev, [page]: !prev[page] };

      const group = RBAC_GROUPS.find((g) => g.parent === page);
      if (group && next[page] === false) {
        group.children.forEach((child) => {
          next[child] = false;
        });
      }
      return next;
    });
  };

  const changed = useMemo(() => {
    return Object.entries(draft)
      .filter(([page, val]) => baseline[page] !== val)
      .map(([page, has_access]) => ({ page, has_access }));
  }, [draft, baseline]);

  /**
   * ✅ BIG FIX:
   * Always UPSERT all group children for selectedRole
   * so DB has explicit true/false rows and UI reflects correctly.
   */
  const saveChanges = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      const payloads: Array<{ page: string; has_access: boolean }> = [...changed];

      // ✅ materialize ALL children for enabled parents (and also store false rows)
      RBAC_GROUPS.forEach((group) => {
        const parentOn = Boolean(draft[group.parent]);

        // If parent OFF, store children OFF too (explicitly)
        if (!parentOn) {
          group.children.forEach((child) => {
            payloads.push({ page: child, has_access: false });
          });
          payloads.push({ page: group.parent, has_access: false });
          return;
        }

        // parent ON: upsert parent and all children with their values
        payloads.push({ page: group.parent, has_access: true });
        group.children.forEach((child) => {
          payloads.push({ page: child, has_access: Boolean(draft[child]) });
        });
      });

      // ✅ de-dupe
      const uniq = new Map<string, boolean>();
      payloads.forEach((p) => uniq.set(p.page, p.has_access));
      const finalPayloads = Array.from(uniq.entries()).map(([page, has_access]) => ({
        page,
        has_access,
      }));

      await Promise.all(
        finalPayloads.map((ch) =>
          RbacAPI.updatePermission({
            role_name: selectedRole,
            page_name: ch.page,
            has_access: ch.has_access,
          })
        )
      );

      // refresh current logged-in permissions
      await refreshPermissions();

      // reload table
      const permRows = await RbacAPI.getPermissions();
      setPermissions(permRows);

      setSuccessMsg('Permissions saved successfully ✔');
    } catch (e: any) {
      setError(e?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // Read-only matrix (fixed)
  const matrix = useMemo(() => {
    const map: Record<string, Record<string, boolean>> = {};

    for (const role of roles) {
      map[role] = {};
      for (const page of allPages) map[role][page] = false;
    }

    for (const row of permissions) {
      const roleName = row.ROLE_NAME;
      const pageName = clean(row.PAGE_NAME);
      const roleMap: Record<string, boolean> = map[roleName] ?? (map[roleName] = {});
      roleMap[pageName] = Boolean(row.HAS_ACCESS);
    }

    return map;
  }, [permissions, roles, allPages]);

  if (loading) {
    return (
      <div className={styles.center}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.settingsLabel}>Settings</div>
      <h2 className={styles.title}>Manage Permissions</h2>

      {error && <Alert severity="error">{error}</Alert>}
      {successMsg && <Alert severity="success">{successMsg}</Alert>}

      <Paper className={styles.card} elevation={1}>
        <h3 className={styles.cardTitle}>Role Permissions Management</h3>

        <FormControl fullWidth size="small">
          <InputLabel>Select Role</InputLabel>
          <Select
            value={selectedRole}
            label="Select Role"
            onChange={(e) => setSelectedRole(String(e.target.value))}
          >
            {roles.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <div className={styles.subTitle}>
          Permissions for Role: <b>{selectedRole}</b>
        </div>

        {/* ✅ Preview toggle for admin testing */}

        {/* ✅ Parent + children section */}
        <div className={styles.groupsGrid}>
          {RBAC_GROUPS.map((group) => {
            const parentEnabled = Boolean(draft[group.parent]);
            return (
              <div key={group.title} className={styles.groupCard}>
                <div className={styles.groupTitle}>{group.title}</div>

                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(draft[group.parent])}
                        onChange={() => toggle(group.parent)}
                      />
                    }
                    label={group.parent}
                  />

                  <div className={styles.childrenList}>
                    {group.children.map((child) => (
                      <FormControlLabel
                        key={child}
                        control={
                          <Checkbox
                            checked={Boolean(draft[child])}
                            disabled={!parentEnabled}
                            onChange={() => toggle(child)}
                          />
                        }
                        label={child}
                      />
                    ))}
                  </div>
                </FormGroup>
              </div>
            );
          })}
        </div>

        {/* ✅ Other pages */}
        <Divider sx={{ my: 2 }} />
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Other Pages</div>

        <FormGroup className={styles.checkboxGrid}>
          {allPages
            .filter((p) => !groupedPagesSet.has(p))
            .map((page) => (
              <FormControlLabel
                key={page}
                control={<Checkbox checked={Boolean(draft[page])} onChange={() => toggle(page)} />}
                label={page}
              />
            ))}
        </FormGroup>

        <div className={styles.actions}>
          <Button variant="contained" color="success" disabled={saving} onClick={saveChanges}>
            {saving ? 'Saving...' : 'Save permission'}
          </Button>
          <span className={styles.hint}>
            {changed.length > 0 ? `${changed.length} changes pending` : 'No changes'}
          </span>
        </div>

        <Divider sx={{ my: 3 }} />

        <h4 className={styles.sectionTitle}>All Role Permissions (Read-only view)</h4>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Role</th>
                {allPages.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role}>
                  <td>
                    <b>{role}</b>
                  </td>
                  {allPages.map((page) => {
                    const ok = matrix?.[role]?.[page] ?? false;
                    return (
                      <td key={page} className={ok ? styles.ok : styles.no}>
                        {ok ? '✔️' : '❌'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Paper>
    </div>
  );
};

export default AccessControlPage;
