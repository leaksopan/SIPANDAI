import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useUserRole from "../hooks/useUserRole";

const UserManagement = () => {
  const {
    userRole,
    ROLES,
    ROLE_LABELS,
    updateUserRole,
    hasPermission,
  } = useUserRole();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Load all users
  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort users: letters A-Z first, then numbers largest to smallest
      const sortedUsers = usersList.sort((a, b) => {
        const nameA = (a.displayName || "No Name").toLowerCase();
        const nameB = (b.displayName || "No Name").toLowerCase();

        const isNumberA = /^\d/.test(nameA);
        const isNumberB = /^\d/.test(nameB);

        // If both are letters, sort alphabetically
        if (!isNumberA && !isNumberB) {
          return nameA.localeCompare(nameB);
        }

        // If both are numbers, sort descending (largest first)
        if (isNumberA && isNumberB) {
          const numA = parseInt(nameA.match(/^\d+/)[0]);
          const numB = parseInt(nameB.match(/^\d+/)[0]);
          return numB - numA; // descending order
        }

        // Letters before numbers
        return isNumberA ? 1 : -1;
      });
      setUsers(sortedUsers);
    } catch (err) {
      console.error("Error loading users:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasPermission("canManageRoles")) {
      loadUsers();
    }
  }, [hasPermission]);

  // Check if user has permission to manage users
  if (!hasPermission("canManageRoles")) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#ef4444",
        }}
      >
        <h3>Access Denied</h3>
        <p>Anda tidak memiliki permission untuk mengakses halaman ini.</p>
      </div>
    );
  }

  // Handle role change
  const handleRoleChange = async (userId, newRole) => {
    try {
      const success = await updateUserRole(userId, newRole);
      if (success) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, role: newRole } : user
          )
        );
        setEditingUser(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle user status toggle
  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, {
        isActive: !currentStatus,
        updatedAt: new Date().toISOString(),
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isActive: !currentStatus } : user
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "super_admin":
        return "#dc2626";
      case "Irban":
        return "#2563eb";
      case "Auditor":
        return "#16a34a";
      case "guest":
        return "#9333ea";
      default:
        return "#6b7280";
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "700",
            color: "#1f2937",
            margin: 0,
          }}
        >
          User Management
        </h2>
        <button
          onClick={loadUsers}
          style={{
            padding: "8px 16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "16px",
            color: "#dc2626",
          }}
        >
          Error: {error}
        </div>
      )}

      <div
        style={{
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                User
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Email
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Role
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                style={{
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <td style={{ padding: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontWeight: "500",
                        color: "#1f2937",
                      }}
                    >
                      {user.displayName || "No Name"}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "12px", color: "#6b7280" }}>
                  {user.email}
                </td>
                <td style={{ padding: "12px" }}>
                  {editingUser === user.id ? (
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value)
                      }
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      style={{
                        backgroundColor: getRoleBadgeColor(user.role),
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                      }}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  )}
                </td>
                <td style={{ padding: "12px" }}>
                  <span
                    style={{
                      backgroundColor: user.isActive ? "#10b981" : "#ef4444",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    {editingUser === user.id ? (
                      <button
                        onClick={() => setEditingUser(null)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#6b7280",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingUser(user.id)}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Edit Role
                        </button>
                        <button
                          onClick={() =>
                            handleStatusToggle(user.id, user.isActive)
                          }
                          style={{
                            padding: "4px 8px",
                            backgroundColor: user.isActive
                              ? "#ef4444"
                              : "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#6b7280",
          }}
        >
          <p>No users found.</p>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
