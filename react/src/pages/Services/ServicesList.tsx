import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listServicesCombined, type ServiceItem, deployService } from '../../api/services';
import { ROUTES } from '../../constants';
import NotificationBanner from '../../components/ui/NotificationBanner/NotificationBanner';
import './services.css';

export default function ServicesList() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [banner, setBanner] = useState<{
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    visible: boolean;
  } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Fetch the list of services on page load
  useEffect(() => {
    setLoading(true);
    listServicesCombined()
      .then((data) => {
        setItems(data);
        const init: Record<number, boolean> = {};
        data.forEach((s: any) => (init[s.SERVICE_ID] = false));
        setSelected(init);
      })
      .catch(() => {
        setBanner({
          type: 'error',
          message: 'Failed to load services.',
          visible: true,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  // Toggle checkbox selection
  function toggleChecked(id: number) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Selected service IDs
  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => Number(k)),
    [selected]
  );

  const hasSelection = selectedIds.length > 0;

  // Show a large centered loader while the services list is loading
  if (loading) {
    return (
      <div className="svc-container">
        <h2 className="svc-title">Registered Services</h2>

        {/* Notification Banner (if any) */}
        {banner?.visible && (
          <NotificationBanner
            type={banner.type}
            message={banner.message}
            visible={banner.visible}
            onClose={() => setBanner(null)}
          />
        )}

        <div className="loader-container">
          <div className="services-loader" role="status" aria-label="Loading" />
        </div>
      </div>
    );
  }

  // Deploy handler
  async function handleDeploy() {
    if (!hasSelection) {
      setBanner({ type: 'info', message: 'No services selected for deployment.', visible: true });
      return;
    }

    setBanner({ type: 'info', message: 'Deploying selected services...', visible: true });
    setDeploying(true);

    try {
      console.log('Deploying IDs:', selectedIds);
      const result = await deployService(selectedIds);
      console.log('Deploy API result:', result);

      const msg = Array.isArray(result.messages)
        ? result.messages.join('\n')
        : JSON.stringify(result);
      setBanner({ type: 'success', message: msg, visible: true });
    } catch (err) {
      console.error('Deploy error:', err);
      const msg =
        err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
      setBanner({ type: 'error', message: `Deploy failed: ${msg}`, visible: true });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="svc-container">
      <h2 className="svc-title">Registered Services</h2>

      {/* Notification Banner */}
      {banner?.visible && (
        <NotificationBanner
          type={banner.type}
          message={banner.message}
          visible={banner.visible}
          onClose={() => setBanner(null)}
        />
      )}

      {/* Service cards */}
      <div className="cards">
        {items.map((svc) => {
          const isChecked = !!selected[svc.SERVICE_ID];

          return (
            <div key={svc.SERVICE_ID} className={`card ${isChecked ? 'card--selected' : ''}`}>
              <div className="card-row-right">
                {/* Left: service details */}
                <div className="card-content">
                  <div className="card-header">
                    <div className="card-title">
                      {svc.SERVICE_NAME}
                      <span className="info-icon" title="Info" aria-hidden="true">
                        ⓘ
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="meta">
                      <div>
                        <b>Object Type:</b> {svc.OBJECT_TYPE}
                      </div>
                      <div>
                        <b>Object Name:</b> {svc.OBJECT_NAME}
                      </div>
                      <div>
                        <b>Description:</b> {svc.DESCRIPTION}
                      </div>
                      <div>
                        <b>Input Arguments:</b> {svc.INPUT_AGR}
                      </div>
                      <div>
                        <b>Output Arguments:</b> {svc.OUTPUT_AGR}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: checkbox */}
                <div className="card-check-right">
                  <input
                    type="checkbox"
                    aria-label={`Select ${svc.SERVICE_NAME}`}
                    className="svc-checkbox"
                    checked={isChecked}
                    onChange={() => toggleChecked(svc.SERVICE_ID)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* action buttons */}
      <div className="actions">
        <button
          className="btn btn-deploy"
          onClick={handleDeploy}
          disabled={!hasSelection || deploying}
          title={hasSelection ? 'Deploy selected services' : 'Select services to deploy'}
        >
          {deploying ? 'Deploying...' : 'Deploy Service'}
        </button>

        <button className="btn btn-primary" onClick={() => navigate(ROUTES.SERVICES_REGISTER)}>
          Register Service
        </button>
      </div>
    </div>
  );
}
