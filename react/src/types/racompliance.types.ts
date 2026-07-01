export interface RAComplianceData {
  REGULATION_ID: number;
  REGULATION_NAME: string;
  PIPELINE_ID: string;
  CREATED_BY: string | null;
  CREATED_AT: string;
  REGULATIONTYPE: string;
  INPUTCONTROL: string | null;
}

export interface RAComplianceOption {
  id: string;
  name: string;
  createdAt?: string;
  imageUrl?: string;
}

export interface ComplianceCheckRequest {
  regulationName: string;
  pipelineId: string;
  regulationType?: string;
  controlsInput?: string;
}

export interface ComplianceCheckResponse {
  regulationName: string;
  complianceId: number;

}