
import * as React from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import LineageGraph from "./LineageGraph";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}
function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export default function LineageTabs() {
  const [value, setValue] = React.useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
        <Tab label="Lineage" {...a11yProps(0)} />
      </Tabs>

      <TabPanel value={value} index={0}>
        <LineageGraph
          isPanelOpen={value === 0}
          apiBase="http://localhost:5000"
          db="D_CAPG_CORTEX_AI_DB"
          schema="IDEA_REFACTOR_SOL"
          objectType="VIEW"
          objectName="VW_CUSTOMER_ORDERS"
          direction="BOTH"
          maxDepth={3}
        />
      </TabPanel>
    </Box>
  );
}
