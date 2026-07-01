
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./PromptGenerator.scss"; // Import SCSS styles

interface SavedPrompt {
  id: number;
  name: string;
  domain: string;
  promptingType: string;
}

type ViewMode = "compose" | "review";

/** Simple, accessible tooltip that toggles on click */
const Tooltip = ({
  open,
  onClose,
  anchorLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorLabel: string;
  children: React.ReactNode;
}) => {
  const tipRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={tipRef}
      role="dialog"
      aria-label={`Help: ${anchorLabel}`}
      className="tooltip"
    >
      <div className="tooltip-content">{children}</div>
      <button
        type="button"
        className="tooltip-close"
        aria-label="Close help"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
};

/** ============================================================
 *  Notification Banner (toast-like)
 *  - Accessible
 *  - Auto hides (pauses on hover)
 *  - Success / Error / Info variants
 * ============================================================ */
type BannerType = "success" | "error" | "info";

const Banner = ({
  open,
  type = "success",
  message,
  actionLabel = "Cancel",
  onAction,
  onClose,
  autoHideMs = 5000,
}: {
  open: boolean;
  type?: BannerType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  autoHideMs?: number;
}) => {
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Start auto-hide timer
  useEffect(() => {
    if (!open) return;
    if (autoHideMs <= 0) return;

    timerRef.current = window.setTimeout(() => {
      onClose();
    }, autoHideMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, autoHideMs, onClose]);

  // Pause on hover, resume on leave
  useEffect(() => {
    const el = containerRef.current;
    if (!open || !el || autoHideMs <= 0) return;

    const onEnter = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const onLeave = () => {
      timerRef.current = window.setTimeout(() => {
        onClose();
      }, 1500);
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [open, onClose, autoHideMs]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`banner ${type}`}
    >
      <span className="banner-icon" aria-hidden="true">
        {type === "success" ? "✔︎" : type === "error" ? "⚠︎" : "ℹ︎"}
      </span>
      <div className="banner-text">{message}</div>
      {onAction && (
        <button className="banner-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button
        className="banner-close"
        aria-label="Dismiss notification"
        onClick={onClose}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

const PromptGenerator = () => {
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [view, setView] = useState<ViewMode>("compose");

  const [domain, setDomain] = useState<string>("");
  const [promptType, setPromptType] = useState<string>("Zero-shot");
  const [description, setDescription] = useState<string>("");

  const [prompts, setPrompts] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [promptNames, setPromptNames] = useState<Record<number, string>>({});

  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Tooltip state
  const [isComposeHelpOpen, setComposeHelpOpen] = useState<boolean>(false);
  const [isContentHelpOpen, setContentHelpOpen] = useState<boolean>(false);
  const [isNameHelpOpen, setNameHelpOpen] = useState<boolean>(false);

  // Banner state
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerType, setBannerType] = useState<BannerType>("success");
  const [bannerMsg, setBannerMsg] = useState("");

  const showBanner = (type: BannerType, message: string) => {
    setBannerType(type);
    setBannerMsg(message);
    setBannerOpen(true);
  };

  // Switch tabs
  const switchTab = (index: number) => {
    setTabIndex(index);
    if (index === 0) setView("compose"); // back to compose if on Generate tab
  };

  const generatePrompts = async () => {
    if (!domain || !description.trim()) {
      showBanner("error", "Please select a domain and enter a description.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/generate-prompts", {
        domain,
        promptType,
        description,
      });

      // Be defensive about API shape
      const list: string[] = Array.isArray(res.data?.prompts)
        ? res.data.prompts
        : res.data?.prompt
        ? [res.data.prompt]
        : [];

      setPrompts(list);
      setPromptNames({});
      if (list.length > 0) {
        setSelectedIndex(0);
        setView("review"); // go to review screen
        showBanner("success", "Prompt generated!");
      } else {
        showBanner("info", "No prompts generated. Try refining the description.");
      }
    } catch (err) {
      console.error(err);
      showBanner("error", "Failed to generate prompts.");
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async (index: number) => {
    const name = promptNames[index];
    if (!name?.trim()) {
      showBanner("error", "Please enter a unique name for the prompt.");
      return;
    }
    const content = prompts[index];
    if (!content?.trim()) {
      showBanner("error", "Prompt content cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await axios.post("http://localhost:5000/api/save-prompt", {
        name: name.trim(),
        description,
        prompt: content,
        domain,
        promptType,
      });
      showBanner("success", "Prompt saved successfully!");
      // Optional: navigate to Saved tab after save
      // setTabIndex(1);
      // fetchSavedPrompts();
    } catch (err) {
      console.error(err);
      showBanner("error", "Failed to save prompt.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedPrompts = async () => {
    setLoading(true);
    try {
      const res = await axios.get<SavedPrompt[]>("http://localhost:5000/api/get_prompts");
      setSavedPrompts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      showBanner("error", "Failed to fetch saved prompts.");
    } finally {
      setLoading(false);
    }
  };

  const deletePrompt = async (id: number) => {
    setLoading(true);
    try {
      await axios.delete(`http://localhost:5000/api/deletePrompt/${id}`);
      showBanner("success", "Prompt deleted successfully!");
      fetchSavedPrompts();
    } catch (err) {
      console.error(err);
      showBanner("error", "Failed to delete prompt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabIndex === 1) fetchSavedPrompts();
  }, [tabIndex]);

  // Close all tooltips when view changes or tab switches
  useEffect(() => {
    setComposeHelpOpen(false);
    setContentHelpOpen(false);
    setNameHelpOpen(false);
  }, [view, tabIndex]);

  return (
    <div className="container">
      {/* Global Notification Banner */}
      <Banner
        open={bannerOpen}
        type={bannerType}
        message={bannerMsg}
        actionLabel="Cancel"
        onAction={() => setBannerOpen(false)}
        onClose={() => setBannerOpen(false)}
        autoHideMs={5000}
      />

      {/* Header */}
      <header className="page-header">
        <h1>Prompt generator</h1>
        <p className="subtitle">Create and manage custom prompts for various use cases</p>
      </header>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="Prompt tabs">
        <button
          role="tab"
          aria-selected={tabIndex === 1}
          className={`tab ${tabIndex === 1 ? "active" : ""}`}
          onClick={() => switchTab(1)}
        >
          View saved prompts
        </button>

        <button
          role="tab"
          aria-selected={tabIndex === 0}
          className={`tab ${tabIndex === 0 ? "active" : ""}`}
          onClick={() => switchTab(0)}
        >
          Generate prompts
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {/* ===== Generate tab ===== */}
      {tabIndex === 0 && (
        <>
          {view === "compose" && (
            <div className="generate-section">
              <div className="form-row">
                <div className="field">
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    aria-label="Choose a domain"
                  >
                    <option value="">Choose a domain*</option>
                    <option value="Banking">Banking</option>
                    <option value="HR">HR</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>

                <div className="field">
                  <select
                    value={promptType}
                    onChange={(e) => setPromptType(e.target.value)}
                    aria-label="Prompt type"
                  >
                    <option value="Zero-shot">Zero-shot</option>
                    <option value="One-shot">One-shot</option>
                  </select>
                </div>

                <button
                  className="icon-button"
                  type="button"
                  aria-label="Help about selecting domain and prompt type"
                  onClick={() => setComposeHelpOpen((o) => !o)}
                >
                  ?
                </button>

                {/* Tooltip for compose help */}
                <Tooltip
                  open={isComposeHelpOpen}
                  onClose={() => setComposeHelpOpen(false)}
                  anchorLabel="Selecting domain and prompt type"
                >
                  <strong>Tip:</strong> Choose the domain closest to your use case
                  (e.g., Banking, HR). <em>Zero-shot</em> generates prompts without
                  examples; <em>One-shot</em> uses a single example for better guidance.
                </Tooltip>
              </div>

              <div className="field stretch">
                <textarea
                  placeholder="Describe the prompt"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="cta-row">
                <button className="btn-primary" onClick={generatePrompts}>
                  Generate prompt →
                </button>
              </div>
            </div>
          )}

          {view === "review" && (
            <div className="review-section">
              <h2 className="section-title">Generated prompts</h2>

              <label className="field-label">
                Prompt content
                <button
                  className="helper-icon"
                  type="button"
                  aria-label="Help about prompt content"
                  onClick={() => setContentHelpOpen((o) => !o)}
                >
                  ?
                </button>
                <Tooltip
                  open={isComposeHelpOpen}
                  onClose={() => setComposeHelpOpen(false)}
                  anchorLabel="Selecting domain and prompt type"
                >
                  <strong>Tip:</strong> Choose the domain closest to your use case
                  (e.g., Banking, HR). <em>Zero-shot</em> generates prompts without
                  examples; <em>One-shot</em> uses a single example for better guidance.
                </Tooltip>
              </label>

              {/* Tooltip for prompt content help */}
              <Tooltip
                open={isContentHelpOpen}
                onClose={() => setContentHelpOpen(false)}
                anchorLabel="Prompt content"
              >
                This is the generated prompt. Review for clarity, remove redundant
                instructions, and ensure it aligns with your domain and policies.
              </Tooltip>

              <textarea value={prompts[selectedIndex] || ""} readOnly />

              <label className="field-label1">
                Enter a unique name for the prompt
                <button
                  className="helper-icon"
                  type="button"
                  aria-label="Help about naming prompts"
                  onClick={() => setNameHelpOpen((o) => !o)}
                >
                  ?
                </button>
              </label>

              {/* Tooltip for naming help */}
              <Tooltip
                open={isNameHelpOpen}
                onClose={() => setNameHelpOpen(false)}
                anchorLabel="Prompt name"
              >
                Use a descriptive name like <code>Banking-ZeroShot-KYC-Assistant</code>
                so it’s easy to find later.
              </Tooltip>

              <input
                type="text"
                placeholder="Enter a unique name for the prompt"
                value={promptNames[selectedIndex] || ""}
                onChange={(e) =>
                  setPromptNames({ ...promptNames, [selectedIndex]: e.target.value })
                }
              />

              {prompts.length > 1 && (
                <div className="pager">
                  <button
                    className="pill"
                    onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                    disabled={selectedIndex === 0}
                  >
                    ‹ Prev
                  </button>
                  <div className="count">
                    {selectedIndex + 1} / {prompts.length}
                  </div>
                  <button
                    className="pill"
                    onClick={() =>
                      setSelectedIndex((i) => Math.min(prompts.length - 1, i + 1))
                    }
                    disabled={selectedIndex === prompts.length - 1}
                  >
                    Next ›
                  </button>
                </div>
              )}

              <div className="action-row">
                <button className="btn-outline" onClick={() => setView("compose")}>
                  ← Back
                </button>
                <button className="btn-primary" onClick={() => savePrompt(selectedIndex)}>
                  Save prompt 💾
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== Saved tab ===== */}
      {tabIndex === 1 && (
        <div className="saved-section">
          <div className="saved-header">
            <h2>Saved Prompts</h2>
          </div>

          {savedPrompts.length === 0 ? (
            <p className="empty-state">No prompts saved yet.</p>
          ) : (
            <div className="table-wrapper">
              <table className="styled-table compact">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>
                      <span>Select</span>
                    </th>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>Prompting type</th>
                    <th style={{ width: 90 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(savedPrompts) ? savedPrompts : []).map((p) => (
                    <tr key={p.id}>
                      <td>
                        {/* row checkbox */}
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.name}`}
                          className="row-checkbox"
                        />
                      </td>
                      <td className="cell-name">{p.name}</td>
                      <td>{p.domain}</td>
                      <td>{p.promptingType}</td>
                      <td>
                        <button
                          className="icon-trash"
                          title="Delete"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => deletePrompt(p.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PromptGenerator;
