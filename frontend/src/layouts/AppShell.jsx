import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  clearAuthTokens,
  getCreditBalance,
  isAuthenticated,
} from "../api/apiClient";

function getUsername() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return null;
  }

  try {
    return JSON.parse(atob(token.split(".")[1]))?.username || null;
  } catch {
    return null;
  }
}

const NAV_SECTIONS = [
  {
    title: null,
    items: [{ path: "/dashboard", label: "Dashboard" }],
  },
  {
    title: "AI TOOLS",
    items: [
      {
        path: "/new",
        label: "RERA",
        description: "Real estate risk evaluation",
        matchPrefixes: ["/new", "/report"],
      },
      { label: "Future Tool 1", disabled: true },
      { label: "Future Tool 2", disabled: true },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { path: "/reports", label: "Reports" },
      { path: "/billing", label: "Billing" },
      { label: "History", disabled: true },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { path: "/account", label: "Settings" },
      { label: "Help", disabled: true },
    ],
  },
];

function isItemActive(item, pathname) {
  if (!item.path) {
    return false;
  }

  if (pathname === item.path) {
    return true;
  }

  return (item.matchPrefixes || [item.path]).some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function SidebarItem({ item, active, onSelect }) {
  const commonStyle = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: item.description ? "11px 14px" : "9px 14px",
    borderRadius: "10px",
    textDecoration: "none",
    fontSize: "13.5px",
    transition: "background-color 0.12s, color 0.12s, border-color 0.12s",
    boxSizing: "border-box",
  };

  if (item.disabled) {
    return (
      <div
        style={{
          ...commonStyle,
          color: "#9ca3af",
          border: "1px dashed #e5e7eb",
          backgroundColor: "#fafafa",
          cursor: "not-allowed",
        }}
      >
        {item.label}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      onClick={onSelect}
      style={{
        ...commonStyle,
        color: active ? "#0f766e" : "#374151",
        border: active ? "1px solid #99f6e4" : "1px solid transparent",
        backgroundColor: active ? "#ecfdfb" : "transparent",
        fontWeight: active ? 600 : 500,
      }}
    >
      <div>{item.label}</div>
      {item.description && (
        <div
          style={{
            fontSize: "11.5px",
            color: active ? "#0f766e" : "#9ca3af",
            marginTop: "2px",
            fontWeight: 400,
          }}
        >
          {item.description}
        </div>
      )}
    </Link>
  );
}

export default function AppShell({ children, breadcrumb }) {
  const location = useLocation();
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();
  const username = getUsername();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [userMenuPath, setUserMenuPath] = useState(location.pathname);
  const [mobileSidebarPath, setMobileSidebarPath] = useState(location.pathname);
  const [isCompactLayout, setIsCompactLayout] = useState(
    typeof window !== "undefined" ? window.innerWidth < 960 : false
  );
  const [creditBalance, setCreditBalance] = useState(null);

  const userMenuRef = useRef(null);
  const currentPageLabel = breadcrumb?.current || "Workspace";

  function handleLogout() {
    clearAuthTokens();
    navigate("/login");
  }

  function toggleUserMenu() {
    const staleOpen = isUserMenuOpen && userMenuPath !== location.pathname;
    const nextOpen = staleOpen ? true : !isUserMenuOpen;
    setUserMenuPath(location.pathname);
    setIsUserMenuOpen(nextOpen);
  }

  function toggleSidebar() {
    if (!isCompactLayout) {
      return;
    }

    const staleOpen = isMobileSidebarOpen && mobileSidebarPath !== location.pathname;
    const nextOpen = staleOpen ? true : !isMobileSidebarOpen;
    setMobileSidebarPath(location.pathname);
    setIsMobileSidebarOpen(nextOpen);
  }

  function closeSidebar() {
    setIsMobileSidebarOpen(false);
  }

  function handleOpenAccount() {
    setIsUserMenuOpen(false);
    navigate("/account");
  }

  function handleOpenBilling() {
    setIsUserMenuOpen(false);
    navigate("/billing");
  }

  function handleMenuLogout() {
    setIsUserMenuOpen(false);
    handleLogout();
  }

  useEffect(() => {
    function handleResize() {
      const compact = window.innerWidth < 960;
      setIsCompactLayout(compact);

      if (!compact) {
        setIsMobileSidebarOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return undefined;
    }

    function handleDocumentClick(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [isUserMenuOpen]);

  useEffect(() => {
    let ignore = false;

    async function loadCredits() {
      if (!loggedIn) {
        setCreditBalance(null);
        return;
      }

      try {
        const payload = await getCreditBalance();

        if (!ignore) {
          setCreditBalance(payload?.credit_balance ?? 0);
        }
      } catch {
        if (!ignore) {
          setCreditBalance(null);
        }
      }
    }

    loadCredits();

    return () => {
      ignore = true;
    };
  }, [loggedIn]);

  const isUserMenuVisible = isUserMenuOpen && userMenuPath === location.pathname;
  const isMobileSidebarVisible =
    isCompactLayout &&
    isMobileSidebarOpen &&
    mobileSidebarPath === location.pathname;

  const sidebar = (
    <aside
      style={{
        width: "248px",
        minWidth: "248px",
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #eef2f7" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "14px",
            background:
              "linear-gradient(140deg, rgba(43,159,148,0.14) 0%, rgba(16,185,129,0.08) 100%)",
          }}
        >
          <img
            src="/rera-logo.png"
            alt="RERA"
            style={{ height: "32px", width: "auto", display: "block" }}
          />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>RERA</div>
            <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Powered by HeptaGeeks</div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          flex: 1,
        }}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.title || "root"}>
            {section.title && (
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#9ca3af",
                  marginBottom: "8px",
                  paddingLeft: "4px",
                }}
              >
                {section.title}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {section.items.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  active={isItemActive(item, location.pathname)}
                  onSelect={closeSidebar}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f4f6f9" }}>
      <header
        style={{
          height: "68px",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px 0 16px",
          position: "sticky",
          top: 0,
          zIndex: 120,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <button
            type="button"
            onClick={toggleSidebar}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              color: "#374151",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Menu
          </button>

          <div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>HeptaGeek</div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Platform workspace</div>
          </div>
        </div>

        <div style={{ flex: "0 1 360px", padding: "0 18px", minWidth: 0 }}>
          <div
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#f8fafc",
              color: "#94a3b8",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          >
            Search the platform (coming soon)
          </div>
        </div>

        <div
          ref={userMenuRef}
          style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}
        >
          {loggedIn && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "999px",
                border: "1px solid #d1fae5",
                backgroundColor: "#ecfdf5",
                color: "#047857",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.03em",
              }}
            >
              Credits {creditBalance ?? "--"}
            </div>
          )}

          <button
            type="button"
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Alerts
          </button>

          {loggedIn ? (
            <button
              type="button"
              onClick={toggleUserMenu}
              title="Open account menu"
              aria-label="Open account menu"
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "#2b9f94",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {(username || "U").charAt(0).toUpperCase()}
            </button>
          ) : (
            <Link
              to="/login"
              style={{ color: "#2b9f94", fontSize: "13px", fontWeight: 600 }}
            >
              Sign In
            </Link>
          )}

          {loggedIn && isUserMenuVisible && (
            <div
              style={{
                position: "absolute",
                top: "46px",
                right: 0,
                width: "190px",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                boxShadow: "0 16px 34px rgba(15, 23, 42, 0.12)",
                padding: "8px",
                zIndex: 200,
              }}
            >
              <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Signed in as</div>
                <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 700 }}>
                  {username || "User"}
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenAccount}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  backgroundColor: "transparent",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Account
              </button>
              <button
                type="button"
                onClick={handleOpenBilling}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  backgroundColor: "transparent",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Billing
              </button>
              <button
                type="button"
                onClick={handleMenuLogout}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  backgroundColor: "transparent",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#b91c1c",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100vh - 68px)" }}>
        {!isCompactLayout && sidebar}

        {isMobileSidebarVisible && (
          <div
            onClick={closeSidebar}
            style={{
              position: "fixed",
              inset: "68px 0 0 0",
              backgroundColor: "rgba(15, 23, 42, 0.25)",
              zIndex: 90,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "248px",
                height: "100%",
                boxShadow: "12px 0 36px rgba(15, 23, 42, 0.14)",
              }}
            >
              {sidebar}
            </div>
          </div>
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: "calc(100vh - 68px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ padding: "18px 24px 0" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                PRODUCT WORKSPACE
              </div>
              <div style={{ marginTop: "4px" }}>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>RERA</div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>{currentPageLabel}</div>
              </div>
            </div>

            <div style={{ padding: "20px 24px 28px", boxSizing: "border-box" }}>{children}</div>
          </div>

          <div
            style={{
              padding: "12px 24px 14px",
              borderTop: "1px solid #e2e8f0",
              color: "#64748b",
              fontSize: "12px",
              textAlign: "center",
              backgroundColor: "#f8fafc",
            }}
          >
            <div style={{ fontWeight: 700, letterSpacing: "0.04em" }}>Powered by HeptaGeeks</div>
            <div
              style={{
                marginTop: "6px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <Link to="/privacy-policy" style={{ color: "#0f766e", fontWeight: 600 }}>
                Privacy Policy
              </Link>
              <span aria-hidden="true">•</span>
              <Link to="/terms-of-service" style={{ color: "#0f766e", fontWeight: 600 }}>
                Terms of Service
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
