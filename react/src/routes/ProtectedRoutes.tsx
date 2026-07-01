import { lazy } from "react";
import { type RouteObject } from "react-router-dom";
import { ROUTES } from "../constants";

import LineageHome from "../pages/LineageGraph/LineageHome";

// ✅ RBAC wrappers
import RequirePermission from "../components/auth/RequirePermission";
import RequireAdmin from "../components/auth/RequireAdmin";

// Lazy-loaded pages
const Home = lazy(() => import("../pages/Home/Home"));
const CostCalculator = lazy(() => import("../pages/CostCalculator/CostCalculator"));
const Experimentation = lazy(() => import("../pages/Experimentation/Experimentation"));
const Application = lazy(() => import("../pages/Application/Application"));
const ExperimentDeploy = lazy(() => import("../pages/ExperimentDeploy/ExperimentDeploy"));
const DataPreparation = lazy(() => import("../pages/DataPreparation/DataPreparation"));
const RACompliance = lazy(() => import("../pages/RACompliance/RACompliance"));
const CreateRACompliance = lazy(() => import("../pages/CreateRACompliance/CreateRACompliance"));
const ViewRACompliance = lazy(() => import("../pages/ViewRACompliance/ViewRACompliance"));
const PolicyScanner = lazy(() => import("../pages/PolicyScanner/PolicyScanner"));
const CreatePipeline = lazy(() => import("../pages/CreatePipeline/CreatePipeline"));
const PipelineConfiguration = lazy(() => import("../pages/PipelineConfiguration/PipelineConfiguration"));
const ServiceMonitoring = lazy(() => import("../pages/ServiceMonitoring/ServiceMonitoring"));
const ErrorMonitoring = lazy(() => import("../pages/ErrorMonitoring/ErrorMonitoring"));
const PromptGenerator = lazy(() => import("../pages/PromptGenerator/PromptGenerator"));
const Templates = lazy(() => import("../pages/Templates/Templates"));
const CreateChatbot = lazy(() => import("../pages/CreateChatbot/CreateChatbot"));
const SearchChatbot = lazy(() => import("../pages/SearchChatbot/SearchChatbot"));
const DeployedApplication = lazy(() => import("../pages/DeployedApplication/DeployedApplication"));
const ReviewPipeline = lazy(() => import("../pages/ReviewPipeline/ReviewPipeline"));
const ServicesList = lazy(() => import("../pages/Services/ServicesList"));
const RegisterService = lazy(() => import("../pages/Services/RegisterService"));
const EditPipeline = lazy(() => import("../pages/EditPipeline/EditPipeline"));

const Settings = lazy(() => import("../pages/Settings/Settings"));

const SemanticViewAgent = lazy(() => import("../pages/SemanticViewAgent/SemanticViewAgent"));
const ViewSemanticScript = lazy(() => import("../pages/SemanticViewAgent/ViewSemanticScript"));
const EditSemanticScript = lazy(() => import("../pages/SemanticViewAgent/EditSemanticScript"));

// ✅ Access Control
const AccessControlPage = lazy(() => import("../pages/AccessControl/AccessControlPage"));

// ✅ Lineage Graph pages
const LineageGraphView = lazy(() => import("../pages/LineageGraph/LineageGraphView"));

// ✅ Snowflake Metrics
const SnowflakeMetrics = lazy(() => import("../pages/SnowflakeMetrics/SnowflakeMetrics"));

export const ProtectedRoutes: RouteObject[] = [
  {
    path: ROUTES.HOME,
    element: (
      <RequirePermission page="Home">
        <Home />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.COST_CALCULATOR,
    element: (
      <RequirePermission page="Cost Calculator">
        <CostCalculator />
      </RequirePermission>
    ),
  },

  { path: ROUTES.EXPERIMENTATION, element: <Experimentation /> },
  { path: ROUTES.EXPERIMENTATION_WITH_ID, element: <Experimentation /> },

  {
    path: ROUTES.APPLICATION,
    element: (
      <RequirePermission page="Application">
        <Application />
      </RequirePermission>
    ),
  },

  { path: ROUTES.EXPERIMENT_DEPLOY, element: <ExperimentDeploy /> },

  {
    path: ROUTES.DATA_PREPARATION,
    element: (
      <RequirePermission page="Data Preparation" parent="Application">
        <DataPreparation />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.RA_COMPLIANCE,
    element: (
      <RequirePermission page="Regulatory Audit Compliance" parent="Home">
        <RACompliance />
      </RequirePermission>
    ),
  },
  {
    path: ROUTES.CREATE_RA_COMPLIANCE,
    element: (
      <RequirePermission page="Regulatory Audit Compliance" parent="Home">
        <CreateRACompliance />
      </RequirePermission>
    ),
  },
  {
    path: ROUTES.SETTINGS,
    element: <Settings />,
  },
  {
    path: `${ROUTES.VIEW_RA_COMPLIANCE}/:id`,
    element: (
      <RequirePermission page="Regulatory Audit Compliance" parent="Home">
        <ViewRACompliance />
      </RequirePermission>
    ),
  },

  { path: ROUTES.POLICY_SCANNER, element: <PolicyScanner /> },
  { path: ROUTES.CREATE_PIPELINE, element: <CreatePipeline /> },
  { path: `${ROUTES.EDIT_PIPELINE}/:id`, element: <EditPipeline /> },
  { path: `${ROUTES.PIPELINE_CONFIGURATION}/:id`, element: <PipelineConfiguration /> },

  {
    path: ROUTES.SERVICE_MONITORING,
    element: (
      <RequirePermission page="Monitoring">
        <ServiceMonitoring />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.ERROR_MONITORING,
    element: (
      <RequirePermission page="Error">
        <ErrorMonitoring />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.PROMPT_GENERATOR,
    element: (
      <RequirePermission page="Prompt Generator">
        <PromptGenerator />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.TEMPLATES,
    element: (
      <RequirePermission page="Templates">
        <Templates />
      </RequirePermission>
    ),
  },

  { path: ROUTES.CREATE_CHATBOT, element: <CreateChatbot /> },

  {
    path: ROUTES.SEARCH_CHATBOT,
    element: (
      <RequirePermission page="Experiment and Deploy" parent="Application">
        <SearchChatbot />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.DEPLOYED_APPLICATION,
    element: (
      <RequirePermission page="Deployed Applications" parent="Application">
        <DeployedApplication />
      </RequirePermission>
    ),
  },

  { path: ROUTES.REVIEW_PIPELINE, element: <ReviewPipeline /> },

  {
    path: ROUTES.SERVICES,
    element: (
      <RequirePermission page="Services">
        <ServicesList />
      </RequirePermission>
    ),
  },
  {
    path: ROUTES.SERVICES_REGISTER,
    element: (
      <RequirePermission page="Services">
        <RegisterService />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.SEMANTIC_VIEW_AGENT,
    element: (
      <RequirePermission page="Semantic View Creation Agent" parent="Application">
        <SemanticViewAgent />
      </RequirePermission>
    ),
  },
  {
    path: `${ROUTES.SEMANTIC_VIEW_AGENT_VIEW}/:queryId`,
    element: (
      <RequirePermission page="Semantic View Creation Agent" parent="Application">
        <ViewSemanticScript />
      </RequirePermission>
    ),
  },
  {
    path: `${ROUTES.SEMANTIC_VIEW_AGENT_EDIT}/:queryId`,
    element: (
      <RequirePermission page="Semantic View Creation Agent" parent="Application">
        <EditSemanticScript />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.ACCESS_CONTROL,
    element: (
      <RequireAdmin>
        <AccessControlPage />
      </RequireAdmin>
    ),
  },

  {
    path: ROUTES.LINEAGE_GRAPH,
    element: (
      <RequirePermission page="Lineage Graph" parent="Home">
        <LineageHome />
      </RequirePermission>
    ),
  },
  {
    path: `${ROUTES.LINEAGE_GRAPH_VIEW}/:graphId`,
    element: (
      <RequirePermission page="Lineage Graph" parent="Home">
        <LineageGraphView />
      </RequirePermission>
    ),
  },

  {
    path: ROUTES.SNOWFLAKE_METRICS,
    element: (
      <RequirePermission page="Snowflake Metrics">
        <SnowflakeMetrics />
      </RequirePermission>
    ),
  },
];