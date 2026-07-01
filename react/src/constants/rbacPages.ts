export const RBAC_PAGES = [
  "Home",
  "Application",
  "Services",
  "Monitoring",
  "Error",
  "Cost Calculator",
  "Templates",
  "Prompt Generator",
  "Snowflake Metrics",

  "Talk to Document",
  "Talk to Data",
  "Regulatory Audit Compliance",
  "Lineage Graph",

  "Data Preparation",
  "Experiment and Deploy",
  "Deployed Applications",
  "Semantic View Creation Agent",
] as const;

export type RbacPageName = (typeof RBAC_PAGES)[number];

export type RbacGroup = {
  title: string;
  parent: string;
  children: string[];
};

export const RBAC_GROUPS: RbacGroup[] = [
  {
    title: "Home",
    parent: "Home",
    children: [
      "Talk to Document",
      "Talk to Data",
      "Regulatory Audit Compliance",
      "Lineage Graph",
    ],
  },
  {
    title: "Application",
    parent: "Application",
    children: [
      "Data Preparation",
      "Experiment and Deploy",
      "Deployed Applications",
      "Semantic View Creation Agent",
    ],
  },
];