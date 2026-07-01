import api from './index';

export type ServiceItem = {
  SERVICE_ID: number;
  SERVICE_NAME: string;
  OBJECT_TYPE: string;
  OBJECT_NAME: string;
  DESCRIPTION: string;
  INPUT_AGR: string | null;
  OUTPUT_AGR: string | null;
  CREATED_AT: string;
};

// export async function listServices(): Promise<ServiceItem[]> {
//   const response = await api.get<ServiceItem[]>('/services');
//   return response.data;
// }

export async function listServicesCombined() {
  const response = await api.get('/services/combined'); // <-- no /api prefix based on your server.js
  return response.data;
}

export async function deployService(service_ids: number | number[]): Promise<{ messages: string[] }> {
  const payload = Array.isArray(service_ids) ? { service_ids } : { service_ids: [service_ids] };
  const response = await api.post('/api/services/deploy', payload);
  return response.data;
}

export async function registerService(data: {
  service_name: string;
  object_type: string;
  object_name: string;
  description: string;
  input_agr: string | null;
  output_agr: string | null;
  file: File;
}): Promise<{ ok: boolean; service_id: number; message: string; staged_file: string }> {
  const formData = new FormData();
  formData.append('service_name', data.service_name);
  formData.append('object_type', data.object_type);
  formData.append('object_name', data.object_name);
  formData.append('description', data.description);
  formData.append('input_agr', data.input_agr || '');
  formData.append('output_agr', data.output_agr || '');
  formData.append('file', data.file);

  const response = await api.post('/services', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function uploadOnly(file: File): Promise<{ uploaded: boolean; stage_path: string; result: any }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/services/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
