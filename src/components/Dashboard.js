import React, { useState } from "react";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";
import FileManagerTab from "./FileManagerTab";
import UserManagement from "./UserManagement";
import StaffApplicationForm from "./StaffApplicationForm";
import ApplicationManagement from "./ApplicationManagement";
import PermissionManagement from "./PermissionManagement";
import ActivityLogs from "./ActivityLogs";
import StorageUsage from "./StorageUsage";

const Dashboard = () => {
  const { user, handleLogout } = useAuth();
  const {
    userRole,
    getRoleLabel,
    loading: roleLoading,
    isSuperAdmin,
    isIrban,
    isAuditor,
    isGuest,
    hasPermission,
  } = useUserRole();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!user) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "20px",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          padding: "24px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <img
            src={"/68_geografis-dan-iklim.png"}
            alt="Logo Singa Ambara Raja"
            style={{
              width: "64px",
              height: "64px",
              objectFit: "contain",
            }}
          />
          <div>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#1f2937",
                margin: "0 0 8px 0",
              }}
            >
              SMART-ID Dashboard
            </h1>
            <p
              style={{
                color: "#6b7280",
                margin: 0,
                fontSize: "16px",
              }}
            >
              Sistem Manajemen Arsip Terpusat-Irban Dua
            </p>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              src={user.photoURL}
              alt={user.displayName}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontWeight: "600",
                    color: "#1f2937",
                    fontSize: "14px",
                  }}
                >
                  {user.displayName}
                </p>
                {!roleLoading && userRole && (
                  <span
                    style={{
                      backgroundColor:
                        userRole.role === "super_admin"
                          ? "#dc2626"
                          : userRole.role === "Irban"
                          ? "#2563eb"
                          : userRole.role === "Auditor"
                          ? "#16a34a"
                          : userRole.role === "guest"
                          ? "#9333ea"
                          : "#6b7280",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "10px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    {getRoleLabel(userRole.role)}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: "8px 16px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#dc2626";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#ef4444";
              e.target.style.transform = "translateY(0)";
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          marginBottom: "24px",
          padding: "0",
        }}
      >
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <button
            onClick={() => setActiveTab("dashboard")}
            style={{
              padding: "16px 24px",
              backgroundColor:
                activeTab === "dashboard" ? "#3b82f6" : "transparent",
              color: activeTab === "dashboard" ? "white" : "#6b7280",
              border: "none",
              borderRadius: "12px 0 0 0",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              transition: "all 0.2s",
              flex: 1,
            }}
          >
            🏠 Dashboard
          </button>
          {hasPermission("canViewFiles") && (
            <button
              onClick={() => setActiveTab("filemanager")}
              style={{
                padding: "16px 24px",
                backgroundColor:
                  activeTab === "filemanager" ? "#3b82f6" : "transparent",
                color: activeTab === "filemanager" ? "white" : "#6b7280",
                border: "none",
                borderRadius: hasPermission("canManageRoles")
                  ? "0"
                  : "0 12px 0 0",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "all 0.2s",
                flex: 1,
              }}
            >
              📚 Arsip Digital
            </button>
          )}

          {(isSuperAdmin || isIrban) && (
            <button
              onClick={() => setActiveTab("applications")}
              style={{
                padding: "16px 24px",
                backgroundColor:
                  activeTab === "applications" ? "#3b82f6" : "transparent",
                color: activeTab === "applications" ? "white" : "#6b7280",
                border: "none",
                borderRadius: hasPermission("canManageRoles")
                  ? "0"
                  : "0 12px 0 0",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "all 0.2s",
                flex: 1,
              }}
            >
              📋 Aplikasi Staff
            </button>
          )}

          {hasPermission("canManageRoles") && (
            <button
              onClick={() => setActiveTab("usermanagement")}
              style={{
                padding: "16px 24px",
                backgroundColor:
                  activeTab === "usermanagement" ? "#3b82f6" : "transparent",
                color: activeTab === "usermanagement" ? "white" : "#6b7280",
                border: "none",
                borderRadius: isSuperAdmin ? "0" : "0 12px 0 0",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "all 0.2s",
                flex: 1,
              }}
            >
              👥 User Management
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("permissions")}
              style={{
                padding: "16px 24px",
                backgroundColor:
                  activeTab === "permissions" ? "#3b82f6" : "transparent",
                color: activeTab === "permissions" ? "white" : "#6b7280",
                border: "none",
                borderRadius: "0",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "all 0.2s",
                flex: 1,
              }}
            >
              🔐 Permissions
            </button>
          )}

          {hasPermission("canViewLogs") && (
            <button
              onClick={() => setActiveTab("logs")}
              style={{
                padding: "16px 24px",
                backgroundColor:
                  activeTab === "logs" ? "#3b82f6" : "transparent",
                color: activeTab === "logs" ? "white" : "#6b7280",
                border: "none",
                borderRadius: isSuperAdmin ? "0" : "0 12px 0 0",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "all 0.2s",
                flex: 1,
              }}
            >
              📊 Activity Logs
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("storage")}
              style={{
                padding: "16px 24px",
                backgroundColor:
                  activeTab === "storage" ? "#3b82f6" : "transparent",
                color: activeTab === "storage" ? "white" : "#6b7280",
                border: "none",
                borderRadius: "0 12px 0 0",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "all 0.2s",
                flex: 1,
              }}
            >
              💾 Storage Usage
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && (
        <>
          {isGuest ? (
            <StaffApplicationForm />
          ) : (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                padding: "48px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "24px",
                }}
              >
                {/* Welcome Icon */}
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    backgroundColor: "#dbeafe",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "36px",
                  }}
                >
                  👋
                </div>

                {/* Welcome Message */}
                <div>
                  <h2
                    style={{
                      fontSize: "32px",
                      fontWeight: "700",
                      color: "#1f2937",
                      margin: "0 0 12px 0",
                    }}
                  >
                    Halo, {user.displayName?.split(" ")[0] || "User"}!
                  </h2>
                  <p
                    style={{
                      fontSize: "18px",
                      color: "#6b7280",
                      margin: 0,
                      maxWidth: "400px",
                    }}
                  >
                    Selamat datang di SMART-ID. Semoga hari Anda menyenangkan!
                  </p>
                </div>

                {/* Quick Stats atau Info Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "16px",
                    width: "100%",
                    maxWidth: "600px",
                    marginTop: "32px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#f3f4f6",
                      padding: "20px",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "700",
                        color: "#3b82f6",
                        marginBottom: "8px",
                      }}
                    >
                      📊
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "#6b7280",
                      }}
                    >
                      Dashboard Aktif
                    </p>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#f3f4f6",
                      padding: "20px",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "700",
                        color: "#10b981",
                        marginBottom: "8px",
                      }}
                    >
                      ✅
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "#6b7280",
                      }}
                    >
                      Login Berhasil
                    </p>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#f3f4f6",
                      padding: "20px",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "700",
                        color: "#f59e0b",
                        marginBottom: "8px",
                      }}
                    >
                      🚀
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "#6b7280",
                      }}
                    >
                      Siap Digunakan
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* File Manager Tab */}
      {activeTab === "filemanager" && hasPermission("canViewFiles") && (
        <FileManagerTab />
      )}

      {/* Application Management Tab */}
      {activeTab === "applications" && (isSuperAdmin || isIrban) && (
        <ApplicationManagement />
      )}

      {/* User Management Tab */}
      {activeTab === "usermanagement" && hasPermission("canManageRoles") && (
        <UserManagement />
      )}

      {/* Permission Management Tab */}
      {activeTab === "permissions" && isSuperAdmin && <PermissionManagement />}

      {/* Activity Logs Tab */}
      {activeTab === "logs" && hasPermission("canViewLogs") && <ActivityLogs />}

      {/* Storage Usage Tab */}
      {activeTab === "storage" && isSuperAdmin && <StorageUsage />}
    </div>
  );
};

export default Dashboard;
