import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.scss";
import { useAppContext } from "../../../context/AppContext";

import Dashboard from "@mui/icons-material/DashboardOutlined";

import HomeIcon from "../../../assets/sidebar/Home.svg";
import home_active from "../../../assets/sidebar/home_active.svg";
import ApplicationIcon from "../../../assets/sidebar/Application.svg";
import Application_active from "../../../assets/sidebar/Application_active.svg";
import ServicesIcon from "../../../assets/sidebar/Services.svg";
import Services_active from "../../../assets/sidebar/Services_active.svg";
import MonitoringIcon from "../../../assets/sidebar/monitoring.svg";
import Monitoring_active from "../../../assets/sidebar/monitoring_active.svg";
import ActivityLogIcon from "../../../assets/sidebar/activity log.svg";
import ActivityLog_active from "../../../assets/sidebar/activity log_active.svg";
import CostIcon from "../../../assets/sidebar/cost.svg";
import Cost_active from "../../../assets/sidebar/cost_active.svg";
import TemplateIcon from "../../../assets/sidebar/template.svg";
import Template_active from "../../../assets/sidebar/template_active.svg";
import PromptIcon from "../../../assets/sidebar/Prompt.svg";
import Prompt_active from "../../../assets/sidebar/prompt_active.svg";

type MenuItem = {
  label: string;
  icon: string;
  activeIcon: string;
  path: string;
  permissionKey: string; // must match PAGE_NAME
};

const Sidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    loadingRole,

    // ✅ Use effective permissions for preview support
    effectivePermissions,
    effectiveRole,
    currentRole,
  } = useAppContext();

  const menuItems: MenuItem[] = [
    { label: "Home", icon: HomeIcon, activeIcon: home_active, path: "/", permissionKey: "Home" },
    { label: "Application", icon: ApplicationIcon, activeIcon: Application_active, path: "/application", permissionKey: "Application" },
    { label: "Services", icon: ServicesIcon, activeIcon: Services_active, path: "/services", permissionKey: "Services" },
    { label: "Monitoring", icon: MonitoringIcon, activeIcon: Monitoring_active, path: "/service-monitoring", permissionKey: "Monitoring" },
    { label: "Error", icon: ActivityLogIcon, activeIcon: ActivityLog_active, path: "/error-monitoring", permissionKey: "Error" },
    { label: "Cost Calculator", icon: CostIcon, activeIcon: Cost_active, path: "/cost-calculator", permissionKey: "Cost Calculator" },
    { label: "Templates", icon: TemplateIcon, activeIcon: Template_active, path: "/templates", permissionKey: "Templates" },
    { label: "Prompt Generator", icon: PromptIcon, activeIcon: Prompt_active, path: "/prompt-generator", permissionKey: "Prompt Generator" },
    { label: "Account Insights", icon: MonitoringIcon, activeIcon: Monitoring_active, path: "/account-insights", permissionKey: "Snowflake Metrics" },
  ];

  const allowedItems = useMemo(() => {
    if (loadingRole) return [];
    return menuItems.filter((m) => Boolean(effectivePermissions[m.permissionKey]));
  }, [loadingRole, effectivePermissions]);

  return (
    <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ""}`}>
      <div className={styles.toggleWrapper}>
        <button
          className={styles.toggleButton}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand" : "Collapse"}
        >
          <Dashboard />
        </button>
      </div>

      {/* ✅ Optional badge to show preview mode */}
      {(effectiveRole && effectiveRole !== currentRole) && (
        <div style={{ padding: "6px 10px", fontSize: 12, opacity: 0.85 }}>
          Preview: <b>{effectiveRole}</b>
        </div>
      )}

      <nav className={styles.nav}>
        <ul>
          {allowedItems.map((item, idx) => (
            <li key={idx}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
              >
                <span className={styles.icon} aria-hidden="true">
                  <img
                    src={item.icon}
                    alt={`${item.label} icon`}
                    className={styles.iconImgDefault}
                  />
                  <img
                    src={item.activeIcon}
                    alt={`${item.label} active icon`}
                    className={styles.iconImgActive}
                  />
                </span>
                <span className={styles.label}>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;