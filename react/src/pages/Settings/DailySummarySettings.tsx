import React, { useEffect, useState } from "react";
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Alert,
  FormControlLabel,
  Checkbox,
  Grid,
  Chip,
  Autocomplete,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
 
interface EmailSettings {
  summary: {
    enabled: boolean;
    frequency: string;
    hour: string;
    minute: string;
    ampm: string;
    recipients: string[];
  };
  error: {
    enabled: boolean;
    recipients: string[];
  };
}
 
const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;
 
const RecipientDropdown: React.FC<{
  label: string;
  availableUsers: string[];
  loading: boolean;
  selected: string[];
  onChange: (val: string[]) => void;
}> = ({ label, availableUsers, loading, selected, onChange }) => {
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={availableUsers}
      value={selected}
      loading={loading}
      onChange={(_, newValue) => onChange(newValue)}
      getOptionLabel={(option) => option}
      renderOption={(props, option, { selected: isSelected }) => (
        <li {...props} key={option}>
          <Checkbox
            icon={icon}
            checkedIcon={checkedIcon}
            style={{ marginRight: 8 }}
            checked={isSelected}
          />
          {option}
        </li>
      )}
      limitTags={2}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            {...getTagProps({ index })}
            key={option}
            label={option.split("@")[0]}
            title={option}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ maxWidth: 150, fontSize: "0.7rem", height: 22, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={selected.length === 0 ? "Search users..." : ""}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      ListboxProps={{ style: { maxHeight: 250 } }}
      sx={{ mb: 2 }}
    />
  );
};
 
const DailySummarySettings: React.FC = () => {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [summaryRecipients, setSummaryRecipients] = useState<string[]>([]);
  const [errorRecipients, setErrorRecipients] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
 
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [addingUser, setAddingUser] = useState(false);
 
  useEffect(() => {
    fetch("/api/email-automation/settings")
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setSummaryRecipients(data.summary?.recipients || []);
        setErrorRecipients(data.error?.recipients || []);
      })
      .catch(() => setError("Failed to load settings"));
  }, []);
 
  const loadUsers = () => {
    setUsersLoading(true);
    fetch("/api/email-automation/users")
      .then(res => res.json())
      .then(data => {
        const emails: string[] = Array.isArray(data)
          ? data.map((u: any) => (typeof u === "string" ? u : u.EMAIL || u.email || "")).filter(Boolean)
          : [];
        setAvailableUsers(emails);
        setUsersLoading(false);
      })
      .catch(() => {
        setError("Failed to load users");
        setUsersLoading(false);
      });
  };
 
  useEffect(() => { loadUsers(); }, []);
 
  const handleSave = async () => {
    if (!settings) return;
 
    if (summaryRecipients.length === 0) {
      setError("No recipients selected for Daily Summary.");
      return;
    }
 
    if (settings.error.enabled && errorRecipients.length === 0) {
      setError("No recipients selected for Error Alerts.");
      return;
    }
 
    setSuccess(null);
    setError(null);
    setSaving(true);
 
    const payload = {
      summary: {
        enabled: settings.summary.enabled,
        frequency: settings.summary.frequency || "daily",
        hour: settings.summary.hour || "09",
        minute: settings.summary.minute || "00",
        ampm: settings.summary.ampm || "AM",
        recipients: summaryRecipients,
      },
      error: {
        enabled: settings.error.enabled,
        recipients: errorRecipients,
      },
    };
 
    try {
      const res = await fetch("/api/email-automation/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
 
      if (res.ok) {
        setSettings(payload);
        setHasUnsavedChanges(false);
        setSuccess("Settings saved successfully");
      } else {
        setError("Failed to save settings");
      }
    } catch {
      setError("Failed to save settings");
    }
    setSaving(false);
  };
 
  const handleSendTest = async (type: "summary" | "error") => {
    if (hasUnsavedChanges) {
      await handleSave();
    }
 
    if (type === "summary" && summaryRecipients.length === 0) {
      setError("No recipients selected. Please save settings first.");
      return;
    }
 
    setSuccess(null);
    setError(null);
 
    try {
      const res = await fetch("/api/email-automation/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
 
      if (res.ok) {
        setSuccess(`Test ${type} email sent successfully`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send test email");
      }
    } catch {
      setError("Failed to send test email");
    }
  };
 
  const handleRemoveUser = async (email: string) => {
    if (!window.confirm(`Remove ${email} from the team?`)) return;
    try {
      const res = await fetch("/api/email-automation/remove-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "User removed");
        loadUsers();
      } else {
        setError(data.error || "Failed to remove user");
      }
    } catch {
      setError("Failed to remove user");
    }
  };
 
  const handleAddUser = async () => {
    if (!newEmail.trim()) return setError("Email is required");
    setAddingUser(true);
    setError(null);
    setSuccess(null);
 
    try {
      const res = await fetch("/api/email-automation/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() }),
      });
 
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "User added successfully");
        setNewEmail("");
        setNewName("");
        loadUsers();
      } else {
        setError(data.error || "Failed to add user");
      }
    } catch {
      setError("Failed to add user");
    }
    setAddingUser(false);
  };
 
  return (
    <Box sx={{ overflowY: "auto", height: "calc(100vh - 100px)", pr: 1, pb: 8 }}>
      {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
 
      <Grid container spacing={3} sx={{ alignItems: "stretch" }}>
        {/* @ts-ignore */}
        <Grid item xs={12} md={6} sx={{ display: "flex" }}>
          <Card sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <CardHeader title="📊 Daily Summary" subheader="Automated daily summary" />
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings?.summary.enabled ?? false}
                    onChange={e =>
                      setSettings(p =>
                        p ? { ...p, summary: { ...p.summary, enabled: e.target.checked } } : p
                      )
                    }
                  />
                }
                label="Enabled"
              />
 
              <Divider sx={{ my: 2 }} />
 
              <TextField
                select
                label="Frequency"
                fullWidth
                value={settings?.summary.frequency || "daily"}
                onChange={e => {
                  setSettings(p =>
                    p ? { ...p, summary: { ...p.summary, frequency: e.target.value } } : p
                  );
                  setHasUnsavedChanges(true);
                }}
                SelectProps={{ native: true }}
                sx={{ mb: 2 }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </TextField>
 
              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <TextField
                  select
                  label="Hour"
                  value={settings?.summary.hour || "09"}
                  onChange={e => {
                    setSettings(p =>
                      p ? { ...p, summary: { ...p.summary, hour: e.target.value } } : p
                    );
                    setHasUnsavedChanges(true);
                  }}
                  SelectProps={{ native: true }}
                  sx={{ flex: 1 }}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i} value={String(i + 1).padStart(2, "0")}>
                      {String(i + 1).padStart(2, "0")}
                    </option>
                  ))}
                </TextField>
 
                <TextField
                  select
                  label="Minute"
                  value={settings?.summary.minute || "00"}
                  onChange={e => {
                    setSettings(p =>
                      p ? { ...p, summary: { ...p.summary, minute: e.target.value } } : p
                    );
                    setHasUnsavedChanges(true);
                  }}
                  SelectProps={{ native: true }}
                  sx={{ flex: 1 }}
                >
                  {[...Array(60)].map((_, i) => (
                    <option key={i} value={String(i).padStart(2, "0")}>
                      {String(i).padStart(2, "0")}
                    </option>
                  ))}
                </TextField>
 
                <TextField
                  select
                  label="AM/PM"
                  value={settings?.summary.ampm || "AM"}
                  onChange={e => {
                    setSettings(p =>
                      p ? { ...p, summary: { ...p.summary, ampm: e.target.value } } : p
                    );
                    setHasUnsavedChanges(true);
                  }}
                  SelectProps={{ native: true }}
                  sx={{ flex: 1 }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </TextField>
              </Box>
 
              <RecipientDropdown
                label="Click to select recipients..."
                availableUsers={availableUsers}
                loading={usersLoading}
                selected={summaryRecipients}
                onChange={(val) => { setSummaryRecipients(val); setHasUnsavedChanges(true); }}
              />
 
              <Box sx={{ mt: "auto", display: "flex", gap: 2 }}>
                <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
                <Button variant="outlined" startIcon={<SendIcon />} onClick={() => handleSendTest("summary")}>
                  {hasUnsavedChanges ? "Save & Send Test" : "Send Test Summary"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
 
        {/* @ts-ignore */}
        <Grid item xs={12} md={6} sx={{ display: "flex" }}>
          <Card sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <CardHeader title="⚠️ Error Alerts" subheader="Real-time error email alert" />
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings?.error.enabled ?? false}
                    onChange={e =>
                      setSettings(p =>
                        p ? { ...p, error: { ...p.error, enabled: e.target.checked } } : p
                      )
                    }
                  />
                }
                label="Enabled"
              />
 
              <Divider sx={{ my: 2 }} />
 
              <RecipientDropdown
                label="Click to select recipients..."
                availableUsers={availableUsers}
                loading={usersLoading}
                selected={errorRecipients}
                onChange={(val) => { setErrorRecipients(val); setHasUnsavedChanges(true); }}
              />
 
              <Alert severity="info" sx={{ mb: 2 }}>
                When enabled, error alerts will be sent automatically to the selected recipients.
              </Alert>
 
              <Box sx={{ mt: "auto" }} />
            </CardContent>
          </Card>
        </Grid>
 
        {/* @ts-ignore */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="👤 Manage Recipients" subheader="Add new team members (admin only)" />
            <CardContent>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
                <TextField
                  size="small"
                  label="Email"
                  placeholder="user@capgemini.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  sx={{ flex: 2 }}
                />
                <TextField
                  size="small"
                  label="Name"
                  placeholder="Full Name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  startIcon={addingUser ? <CircularProgress size={18} color="inherit" /> : <PersonAddIcon />}
                  onClick={handleAddUser}
                  disabled={addingUser}
                >
                  Add User
                </Button>
              </Box>
 
              <Alert severity="info" sx={{ mb: 2 }}>
                Only users with a verified Snowflake email can be added. Unverified users will be rejected automatically.
              </Alert>
 
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>#</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ textAlign: "center", color: "text.secondary" }}>
                          No team members added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      availableUsers.map((email, idx) => (
                        <TableRow key={email}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{email}</TableCell>
                          <TableCell>
                            <Chip label="Active" size="small" color="success" variant="outlined" />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => handleRemoveUser(email)} title="Remove user">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
 
export default DailySummarySettings;