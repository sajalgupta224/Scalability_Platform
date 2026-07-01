import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerService, uploadOnly } from '../../api/services';
import { ROUTES } from '../../constants';
import NotificationBanner from '../../components/ui/NotificationBanner/NotificationBanner';
import './services.css';

const snowflakeTypes = ['PROCEDURE', 'FUNCTION'] as const;
type ObjectType = (typeof snowflakeTypes)[number];

type FormState = {
  serviceName: string;
  objectName: string;
  description: string;
  objectType: ObjectType | '';
  input_agr?: string;
  output_agr?: string;
};

const MAX_MB = 5;

export default function RegisterService() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    serviceName: '',
    objectName: '',
    description: '',
    objectType: '',
    input_agr: '',
    output_agr: '',
  });

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stagePath, setStagePath] = useState<string | null>(null);

  //  Notification Banner
  const [banner, setBanner] = useState<{
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    visible: boolean;
  } | null>(null);

  function handleInput(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'objectType'
          ? (value as ObjectType | '')
          : name === 'templateId'
            ? Number(value)
            : name === 'userId'
              ? value
                ? Number(value)
                : null
              : value,
    }));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) validateAndSetFile(f);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  }

  function validateAndSetFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.sql')) {
      setBanner({
        type: 'warning',
        message: 'Only .sql files are allowed.',
        visible: true,
      });
      return;
    }

    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_MB) {
      setBanner({
        type: 'warning',
        message: 'File exceeds 5 MB.',
        visible: true,
      });
      return;
    }
    setFile(f);
    setStagePath(null);
  }

  async function handleUploadOnly() {
    if (!file) {
      setBanner({
        type: 'warning',
        message: 'Please select a file first.',
        visible: true,
      });
      return;
    }

    setUploading(true);

    try {
      const result = await uploadOnly(file);
      setStagePath(result.stage_path);

      setBanner({
        type: 'success',
        message: `File uploaded successfully to: ${result.stage_path}`,
        visible: true,
      });
    } catch (error) {
      console.error('Upload failed:', error);

      setBanner({
        type: 'error',
        message: 'Failed to upload file. Please try again.',
        visible: true,
      });
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.serviceName || !form.objectName || !form.description || !form.objectType || !file) {
      setBanner({
        type: 'warning',
        message: 'Please fill all required fields.',
        visible: true,
      });
      return;
    }

    setSubmitting(true);

    try {
      await registerService({
        service_name: form.serviceName,
        object_type: form.objectType,
        object_name: form.objectName,
        description: form.description,
        input_agr: form.input_agr || null,
        output_agr: form.output_agr || null,
        file,
      });

      setBanner({
        type: 'success',
        message: 'Service registered successfully!',
        visible: true,
      });

      setTimeout(() => navigate(ROUTES.SERVICES), 1200);
    } catch (error) {
      console.error('Registration failed:', error);

      setBanner({
        type: 'error',
        message: 'Failed to register service. Please try again.',
        visible: true,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isValid =
    form.serviceName && form.objectName && form.description && form.objectType && file;

  return (
    <div className="svc-container">
      <h2 className="svc-title">Register Service</h2>

      {banner?.visible && (
        <NotificationBanner
          type={banner.type}
          message={banner.message}
          visible={banner.visible}
          onClose={() => setBanner(null)}
        />
      )}

      <form className="svc-form" onSubmit={onSubmit}>
        <div className="svc-grid">
          {/* Service Name */}
          <div className="svc-field">
            <label>Service Name*</label>
            <div className="svc-input-wrap">
              <input
                name="serviceName"
                value={form.serviceName}
                onChange={handleInput}
                placeholder="Service Name"
                required
              />
              <span className="svc-info" aria-label="Service Name info" tabIndex={0}>
                ⓘ<span className="svc-tooltip">Unique name used to register the service.</span>
              </span>
            </div>
          </div>

          {/* Object Type */}
          <div className="svc-field">
            <label>Snowflake Object Type*</label>
            <div className="svc-input-wrap">
              <select name="objectType" value={form.objectType} onChange={handleInput} required>
                <option value="" disabled hidden>
                  Select Object Type
                </option>
                {snowflakeTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="svc-info" aria-label="Object Type info" tabIndex={0}>
                ⓘ
                <span className="svc-tooltip">
                  Choose whether the uploaded object is a PROCEDURE or FUNCTION.
                </span>
              </span>
            </div>
          </div>

          {/* Object Name */}
          <div className="svc-field">
            <label>Object Name*</label>
            <div className="svc-input-wrap">
              <input
                name="objectName"
                value={form.objectName}
                onChange={handleInput}
                placeholder="Object Name"
                required
              />
              <span className="svc-info" aria-label="Object Name info" tabIndex={0}>
                ⓘ
                <span className="svc-tooltip">
                  Identifier used to deploy and reference the service in the environment.
                </span>
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="svc-field">
            <label>Description*</label>
            <div className="svc-input-wrap">
              <input
                name="description"
                value={form.description}
                onChange={handleInput}
                placeholder="Description"
                required
              />
              <span className="svc-info" aria-label="Description info" tabIndex={0}>
                ⓘ<span className="svc-tooltip">Brief explanation of what the service does.</span>
              </span>
            </div>
          </div>

          {/* Input Args */}
          <div className="svc-field">
            <label>Input Arguments</label>
            <div className="svc-input-wrap">
              <input
                name="input_agr"
                value={form.input_agr}
                onChange={handleInput}
                placeholder="Input Arguments"
              />
              <span className="svc-info" aria-label="Input Arguments info" tabIndex={0}>
                ⓘ
                <span className="svc-tooltip">
                  Parameters required by the uploaded procedure or function.
                </span>
              </span>
            </div>
          </div>

          {/* Output Args */}
          <div className="svc-field">
            <label>Output Arguments</label>
            <div className="svc-input-wrap">
              <input
                name="output_agr"
                value={form.output_agr}
                onChange={handleInput}
                placeholder="Output Arguments"
              />
              <span className="svc-info" aria-label="Output Argument info" tabIndex={0}>
                ⓘ
                <span className="svc-tooltip">
                  Result returned by the uploaded procedure or function.
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="svc-upload">
          <div className="svc-upload-header">
            <b>Choose script to upload*</b>
            <span className="svc-muted">.sql files only — max 5 MB</span>
          </div>

          <div
            className={`svc-dropzone ${dragActive ? 'svc-dropzone--active' : ''}`}
            onDragEnter={() => setDragActive(true)}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <div className="svc-dz-left">
              <div className="svc-cloud">☁</div>
              <div>
                <div className="svc-dz-title">Drag & drop file here</div>
                <div className="svc-dz-subtitle">Max size 5 MB</div>
              </div>
            </div>

            <label className="svc-btn svc-btn-secondary svc-dz-right">
              Browse File
              <input type="file" onChange={onFileChange} style={{ display: 'none' }} />
            </label>
          </div>

          {file && (
            <div className="svc-file-pill">
              <span className="svc-file-type">SQL</span>
              <div className="svc-file-info">
                <div className="svc-file-name">{file.name}</div>
                <div className="svc-file-size">
                  {(file.size / 1024).toFixed(0)} KB •{' '}
                  {stagePath ? `Uploaded to ${stagePath}` : 'Ready to upload'}
                </div>
              </div>
              <button
                type="button"
                className="svc-delete"
                onClick={() => {
                  setFile(null);
                  setStagePath(null);
                }}
              >
                🗑
              </button>
            </div>
          )}
        </div>

        <div className="svc-actions">
          <button
            type="button"
            className="svc-btn svc-btn-secondary"
            onClick={() => navigate(ROUTES.SERVICES)}
          >
            ← Back
          </button>

          {file && !stagePath && (
            <button
              type="button"
              className="svc-btn svc-btn-secondary"
              onClick={handleUploadOnly}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          )}

          <button
            type="submit"
            className="svc-btn svc-btn-primary"
            disabled={submitting || !isValid}
          >
            Submit →
          </button>
        </div>
      </form>
    </div>
  );
}
