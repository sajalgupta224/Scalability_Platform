
import { useState } from "react";
import { Tabs, Tab, Box } from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ShieldIcon from "@mui/icons-material/Shield";
import LineageGraphAgent from "./LineageGraphAgent";
import PIIScanner from "../PIIScanner/PIIScanner";

export default function LineageHome() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          px: 3,
          pt: 1,
          borderBottom: "1px solid #e5e7eb",
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            minHeight: 42,
          },
          "& .Mui-selected": { color: "#4f46e5" },
          "& .MuiTabs-indicator": { backgroundColor: "#4f46e5" },
        }}
      >
        <Tab icon={<AccountTreeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Lineage Explorer" />
        <Tab icon={<ShieldIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Data Privacy" />
      </Tabs>

      {activeTab === 0 && <LineageGraphAgent />}
      {activeTab === 1 && <PIIScanner />}
    </Box>
  );
}
