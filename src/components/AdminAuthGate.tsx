import { useEffect, useMemo, useState } from "react";
import "@aws-amplify/ui-react/styles.css";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import AdminDevScreen from "./AdminDevScreen";
import penGoldLogo from "../assets/PenGoldLogo.png";
import hole7 from "../assets/hole7.png";
import {
  Authenticator,
  ThemeProvider,
  useAuthenticator,
  type Theme,
} from "@aws-amplify/ui-react";

const client = generateClient<Schema>();

type AdminUser = NonNullable<Schema["AdminUser"]["type"]>;

const adminAuthTheme: Theme = {
  name: "peninsula-admin-theme",
  tokens: {
    colors: {
      brand: {
        primary: {
          10: { value: "#eef5f0" },
          20: { value: "#dce8e1" },
          40: { value: "#86a996" },
          60: { value: "#3e7159" },
          80: { value: "#123c2c" },
          90: { value: "#0b2a1f" },
          100: { value: "#061b14" },
        },
      },
      font: {
        primary: { value: "#123c2c" },
        secondary: { value: "#5f6f68" },
        interactive: { value: "#123c2c" },
      },
      background: {
        primary: { value: "#ffffff" },
        secondary: { value: "#f4f8f6" },
      },
      border: {
        primary: { value: "#dce8e1" },
        secondary: { value: "#ccd8d1" },
      },
    },
    components: {
      authenticator: {
        router: {
          backgroundColor: { value: "rgba(255, 255, 255, 0.94)" },
          borderColor: { value: "#dce8e1" },
          borderWidth: { value: "1px" },
          boxShadow: { value: "0 20px 60px rgba(0, 0, 0, 0.18)" },
          //borderRadius: { value: "24px" },
        },
      },
      button: {
        primary: {
          backgroundColor: { value: "#123c2c" },
          color: { value: "#ffffff" },
          borderColor: { value: "#123c2c" },
          _hover: {
            backgroundColor: { value: "#0b2a1f" },
            borderColor: { value: "#0b2a1f" },
          },
          _focus: {
            boxShadow: { value: "0 0 0 3px rgba(18, 60, 44, 0.25)" },
          },
        },
        link: {
          color: { value: "#123c2c" },
          _hover: {
            color: { value: "#0b2a1f" },
          },
        },
      },
      fieldcontrol: {
        borderColor: { value: "#ccd8d1" },
        borderRadius: { value: "12px" },
        color: { value: "#123c2c" },
        _focus: {
          borderColor: { value: "#123c2c" },
          boxShadow: { value: "0 0 0 3px rgba(18, 60, 44, 0.18)" },
        },
      },
      tabs: {
        item: {
          color: { value: "#5f6f68" },
          _active: {
            color: { value: "#123c2c" },
            borderColor: { value: "#123c2c" },
          },
        },
      },
    },
    radii: {
      small: { value: "8px" },
      medium: { value: "12px" },
      large: { value: "18px" },
      xl: { value: "24px" },
    },
  },
};

function AdminAuthContent() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  const isAuthenticated = authStatus === "authenticated";
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAdminWorking, setIsAdminWorking] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const filteredAdminUsers = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();

    return adminUsers.filter((adminUser) =>
      [adminUser.email, adminUser.status, adminUser.enabled ? "enabled" : "disabled"]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [adminSearch, adminUsers]);

  useEffect(() => {
    if (isAdminSettingsOpen) {
      loadAdminUsers();
    }
  }, [isAdminSettingsOpen]);

  function formatAdminDate(value?: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleDateString();
  }

  async function loadAdminUsers() {
    try {
      setIsAdminWorking(true);
      setAdminMessage("");

      const result = await client.queries.listAdminUsers({
        authMode: "userPool",
      });

      if (result.errors?.length) {
        throw new Error(result.errors.map((error) => error.message).join(", "));
      }

      setAdminUsers((result.data ?? []).filter(Boolean) as AdminUser[]);
    } catch (error) {
      console.error("List admin users error:", error);
      setAdminMessage("Error loading admin users.");
    } finally {
      setIsAdminWorking(false);
    }
  }

  async function addAdminUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = newAdminEmail.trim().toLowerCase();

    if (!email) {
      setAdminMessage("Please enter an admin email.");
      return;
    }

    try {
      setIsAdminWorking(true);
      setAdminMessage("");

      const result = await client.mutations.createAdminUser(
        { email },
        { authMode: "userPool" }
      );

      if (result.errors?.length) {
        throw new Error(result.errors.map((error) => error.message).join(", "));
      }

      setNewAdminEmail("");
      setAdminMessage(`Admin invite sent to ${result.data?.email ?? email}.`);
      await loadAdminUsers();
    } catch (error) {
      console.error("Add admin error:", error);
      setAdminMessage("Error creating admin user. They may already exist.");
    } finally {
      setIsAdminWorking(false);
    }
  }

  async function resetAdminPassword(email: string) {
    const confirmed = window.confirm(`Send a password reset email to ${email}?`);

    if (!confirmed) return;

    try {
      setIsAdminWorking(true);
      setAdminMessage("");

      const result = await client.mutations.resetAdminPassword(
        { email },
        { authMode: "userPool" }
      );

      if (result.errors?.length) {
        throw new Error(result.errors.map((error) => error.message).join(", "));
      }

      setAdminMessage(`Password reset sent to ${email}.`);
      await loadAdminUsers();
    } catch (error) {
      console.error("Reset admin password error:", error);
      setAdminMessage("Error sending password reset.");
    } finally {
      setIsAdminWorking(false);
    }
  }

  const authenticatorComponents = {
  Header() {
    return (
      <div style={styles.authenticatorHeader}>
        <img
          src={penGoldLogo}
          alt="Peninsula Logo"
          style={styles.authenticatorLogo}
        />

        <h1 style={styles.portalTitle}>
          Tournament Admin Portal
        </h1>
      </div>
    );
  },
};

  function renderAdminBar({
    signOut,
    user,
  }: {
    signOut?: () => void;
    user?: { signInDetails?: { loginId?: string } };
  }) {
    return (
      <div style={styles.adminBar}>
        <div>
          <strong>Admin Portal</strong>
          <span style={styles.email}>{user?.signInDetails?.loginId}</span>
        </div>

        <img
          src={penGoldLogo}
          alt="Peninsula Logo"
          style={styles.adminBarLogo}
        />

        <div style={styles.adminBarActions}>
          <button
            type="button"
            onClick={() => setIsAdminSettingsOpen(true)}
            style={styles.settingsButton}
            aria-label="Admin settings"
            title="Admin settings"
          >
            <SettingsIcon />
          </button>

          <button type="button" onClick={signOut} style={styles.signOutButton}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={isAuthenticated ? styles.adminShell : styles.authShell}>
      {!isAuthenticated && (
        <div style={styles.loginContainer}>
          {/* <img
            src={penLogo}
            alt="Peninsula Logo"
            style={styles.logo}
          /> */}


          <Authenticator hideSignUp={true} components={authenticatorComponents}>
            {({ signOut, user }) => (
              <main style={styles.adminPage}>
                {renderAdminBar({ signOut, user })}

                <AdminDevScreen />
              </main>
            )}
          </Authenticator>
        </div>
      )}

      {isAuthenticated && (
        <Authenticator hideSignUp={true} components={authenticatorComponents}>
          {({ signOut, user }) => (
            <main style={styles.adminPage}>
              {renderAdminBar({ signOut, user })}

              <AdminDevScreen />
            </main>
          )}
        </Authenticator>
      )}

      {isAdminSettingsOpen && (
        <div style={styles.modalOverlay}>
          <section style={styles.adminSettingsModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Admin Users</h2>
                <p style={styles.modalSubtitle}>
                  Invite admins and send password reset emails.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAdminSettingsOpen(false)}
                style={styles.modalCloseButton}
                aria-label="Close admin settings"
              >
                <XIcon />
              </button>
            </div>

            {adminMessage && <p style={styles.adminMessage}>{adminMessage}</p>}

            <form onSubmit={addAdminUser} style={styles.addAdminForm}>
              <input
                value={newAdminEmail}
                onChange={(event) => setNewAdminEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                style={styles.adminInput}
                autoComplete="email"
              />

              <button
                type="submit"
                disabled={isAdminWorking}
                style={styles.primaryButton}
              >
                Add Admin
              </button>
            </form>

            <div style={styles.adminSettingsToolbar}>
              <input
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
                placeholder="Search admins..."
                style={styles.adminSearchInput}
              />

              <button
                type="button"
                onClick={loadAdminUsers}
                disabled={isAdminWorking}
                style={styles.secondaryButton}
              >
                Refresh
              </button>
            </div>

            <div style={styles.adminTableWrapper}>
              <table style={styles.adminTable}>
                <thead>
                  <tr>
                    <th style={styles.adminTh}>Email</th>
                    <th style={styles.adminTh}>Status</th>
                    <th style={styles.adminTh}>Enabled</th>
                    <th style={styles.adminTh}>Created</th>
                    <th style={styles.adminTh}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAdminUsers.map((adminUser) => (
                    <tr key={adminUser.id}>
                      <td style={styles.adminTd}>{adminUser.email}</td>
                      <td style={styles.adminTd}>{adminUser.status}</td>
                      <td style={styles.adminTd}>
                        {adminUser.enabled ? "Yes" : "No"}
                      </td>
                      <td style={styles.adminTd}>
                        {formatAdminDate(adminUser.createdAt)}
                      </td>
                      <td style={styles.adminTd}>
                        <button
                          type="button"
                          onClick={() => resetAdminPassword(adminUser.email)}
                          disabled={isAdminWorking}
                          style={styles.secondaryButton}
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredAdminUsers.length === 0 && (
                    <tr>
                      <td style={styles.adminTd} colSpan={5}>
                        No admin users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function AdminAuthGate() {
  return (
    <Authenticator.Provider>
      <ThemeProvider theme={adminAuthTheme}>
        <AdminAuthContent />
      </ThemeProvider>
    </Authenticator.Provider>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={styles.icon}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.17.6.74 1 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={styles.icon}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  authShell: {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundImage: `linear-gradient(rgba(10, 30, 22, 0.45), rgba(10, 30, 22, 0.45)), url(${hole7})`,
  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  padding: "24px",
},
  loginContainer: {
    width: "100%",
    maxWidth: "460px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "22px",
  },
  logo: {
    width: "clamp(120px, 28vw, 240px)",
    height: "auto",
    objectFit: "contain",
  },
  adminShell: {
  minHeight: "100vh",
  width: "100%",
  backgroundImage: `linear-gradient(rgba(10, 30, 22, 0.35), rgba(10, 30, 22, 0.35)), url(${hole7})`,
  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
},
  adminPage: {
    width: "100%",
    minHeight: "100vh",
  },
  adminBar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "14px 24px",
    backgroundColor: "#123c2c",
    color: "#ffffff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  },
  adminBarActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  adminBarLogo: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    height: "70%",
    width: "auto",
    objectFit: "contain",
    display: "block",
  },
  email: {
    display: "block",
    fontSize: "13px",
    opacity: 0.85,
    marginTop: "2px",
  },
  signOutButton: {
    border: "1px solid #cbd5d1",
    borderRadius: "10px",
    height: "38px",
    backgroundColor: "#f7f9f8",
    color: "#37423d",
    padding: "0px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  settingsButton: {
    border: "1px solid #cbd5d1",
    borderRadius: "10px",
    width: "38px",
    height: "38px",
    backgroundColor: "#f7f9f8",
    color: "#37423d",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  icon: {
    width: "18px",
    height: "18px",
    display: "block",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 60, 44, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1000,
  },
  adminSettingsModal: {
    width: "100%",
    maxWidth: "860px",
    maxHeight: "88vh",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 22px 70px rgba(0, 0, 0, 0.22)",
    border: "1px solid #dce8e1",
    padding: "24px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "18px",
  },
  modalTitle: {
    margin: 0,
    color: "#123c2c",
    fontSize: "26px",
  },
  modalSubtitle: {
    margin: "6px 0 0",
    color: "#5f6f68",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  modalCloseButton: {
    border: "1px solid #cbd5d1",
    borderRadius: "999px",
    width: "38px",
    height: "38px",
    backgroundColor: "#f7f9f8",
    color: "#37423d",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  adminMessage: {
    backgroundColor: "#f4f8f6",
    border: "1px solid #dce8e1",
    borderRadius: "12px",
    padding: "12px 14px",
    color: "#123c2c",
    fontWeight: 800,
  },
  addAdminForm: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  adminInput: {
    flex: "1 1 280px",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    color: "#263a32",
  },
  adminSettingsToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  adminSearchInput: {
    width: "280px",
    maxWidth: "100%",
    border: "1px solid #ccd8d1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    color: "#263a32",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    color: "#ffffff",
    backgroundColor: "#123c2c",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5d1",
    borderRadius: "12px",
    padding: "10px 14px",
    color: "#37423d",
    backgroundColor: "#f7f9f8",
    fontWeight: 800,
    cursor: "pointer",
  },
  adminTableWrapper: {
    overflowX: "auto",
  },
  adminTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  adminTh: {
    textAlign: "left",
    borderBottom: "1px solid #dce8e1",
    padding: "10px",
    color: "#5f6f68",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  adminTd: {
    borderBottom: "1px solid #edf3ef",
    padding: "12px 10px",
    color: "#263a32",
    fontSize: "14px",
    verticalAlign: "middle",
  },

    authenticatorHeader: {
  padding: "26px 28px 0",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  backgroundColor: "#ffffff",
  alignItems: "center",
  gap: "12px",
},

authenticatorLogo: {
  width: "clamp(120px, 22vw, 190px)",
  height: "auto",
  objectFit: "contain",
  display: "block",
},

portalTitle: {
  margin: "0 0 24px",
  color: "#123c2c",
  fontSize: "clamp(22px, 4vw, 32px)",
  fontWeight: 900,
  lineHeight: 1.15,
},
};
