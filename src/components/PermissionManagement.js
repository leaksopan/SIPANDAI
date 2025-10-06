import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";
import "./PermissionManagement.css";

const PermissionManagement = () => {
    const { user } = useAuth();
    const { isSuperAdmin, loading: roleLoading } = useUserRole();
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const AVAILABLE_PERMISSIONS = [
        { key: "canCreateUsers", label: "Buat User Baru", category: "User Management" },
        { key: "canEditUsers", label: "Edit User", category: "User Management" },
        { key: "canDeleteUsers", label: "Hapus User", category: "User Management" },
        { key: "canManageRoles", label: "Kelola Role", category: "User Management" },
        { key: "canAccessAllFiles", label: "Akses Semua File", category: "File Management" },
        { key: "canUploadFiles", label: "Upload File", category: "File Management" },
        { key: "canDownloadFiles", label: "Download File", category: "File Management" },
        { key: "canCreateFolders", label: "Buat Folder", category: "File Management" },
        { key: "canDeleteFiles", label: "Hapus File", category: "File Management" },
        { key: "canDeleteFolders", label: "Hapus Folder", category: "File Management" },
        { key: "canViewFiles", label: "Lihat File", category: "File Management" },
        { key: "canManageSystem", label: "Kelola Sistem", category: "System" },
    ];

    useEffect(() => {
        if (user && isSuperAdmin) {
            loadRoles();
        }
    }, [user, isSuperAdmin]);

    const loadRoles = async () => {
        setLoading(true);
        try {
            // Load roles from Firestore
            const rolesDoc = await getDoc(doc(db, "system", "roles"));

            if (rolesDoc.exists()) {
                const rolesData = rolesDoc.data().roles || [];
                setRoles(rolesData);
            } else {
                // Initialize default roles
                const defaultRoles = [
                    { id: "super_admin", name: "Super Admin", description: "Full access" },
                    { id: "Irban", name: "Irban", description: "Inspektur" },
                    { id: "Auditor", name: "Auditor", description: "Auditor" },
                    { id: "guest", name: "Guest", description: "Limited access" },
                ];
                await setDoc(doc(db, "system", "roles"), { roles: defaultRoles });
                setRoles(defaultRoles);
            }

            // Load permissions
            const permissionsDoc = await getDoc(doc(db, "system", "permissions"));
            if (permissionsDoc.exists()) {
                setPermissions(permissionsDoc.data());
            }
        } catch (error) {
            console.error("Error loading roles:", error);
            alert("Gagal memuat roles");
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionToggle = (roleId, permissionKey) => {
        setPermissions((prev) => ({
            ...prev,
            [roleId]: {
                ...prev[roleId],
                [permissionKey]: !prev[roleId]?.[permissionKey],
            },
        }));
    };

    const handleSavePermissions = async () => {
        if (!selectedRole) return;

        setSaving(true);
        try {
            await setDoc(doc(db, "system", "permissions"), permissions);
            alert("✅ Permissions berhasil disimpan!");
        } catch (error) {
            console.error("Error saving permissions:", error);
            alert("❌ Gagal menyimpan permissions");
        } finally {
            setSaving(false);
        }
    };

    const handleSelectAll = (roleId) => {
        const allEnabled = {};
        AVAILABLE_PERMISSIONS.forEach((perm) => {
            allEnabled[perm.key] = true;
        });
        setPermissions((prev) => ({
            ...prev,
            [roleId]: allEnabled,
        }));
    };

    const handleClearAll = (roleId) => {
        const allDisabled = {};
        AVAILABLE_PERMISSIONS.forEach((perm) => {
            allDisabled[perm.key] = false;
        });
        setPermissions((prev) => ({
            ...prev,
            [roleId]: allDisabled,
        }));
    };

    // Group permissions by category
    const groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
        if (!acc[perm.category]) {
            acc[perm.category] = [];
        }
        acc[perm.category].push(perm);
        return acc;
    }, {});

    if (roleLoading) {
        return (
            <div className="permission-management">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Memuat...</p>
                </div>
            </div>
        );
    }

    if (!isSuperAdmin) {
        return (
            <div className="permission-management">
                <div className="access-denied">
                    <span className="icon">🔒</span>
                    <h3>Akses Ditolak</h3>
                    <p>Hanya Super Admin yang dapat mengakses halaman ini</p>
                </div>
            </div>
        );
    }

    return (
        <div className="permission-management">
            <div className="pm-header">
                <h2>🔐 Kelola Permissions</h2>
                <p>Atur hak akses untuk setiap role</p>
            </div>

            <div className="pm-content">
                {/* Role List */}
                <div className="role-list">
                    <h3>Roles</h3>
                    {loading ? (
                        <div className="loading-small">Loading...</div>
                    ) : (
                        roles.map((role) => (
                            <div
                                key={role.id}
                                className={`role-item ${selectedRole?.id === role.id ? "active" : ""}`}
                                onClick={() => setSelectedRole(role)}
                            >
                                <div className="role-info">
                                    <div className="role-name">{role.name}</div>
                                    <div className="role-desc">{role.description}</div>
                                </div>
                                {selectedRole?.id === role.id && <span className="check">✓</span>}
                            </div>
                        ))
                    )}
                </div>

                {/* Permissions Editor */}
                <div className="permissions-editor">
                    {selectedRole ? (
                        <>
                            <div className="editor-header">
                                <div>
                                    <h3>Permissions untuk: {selectedRole.name}</h3>
                                    <p>{selectedRole.description}</p>
                                </div>
                                <div className="editor-actions">
                                    <button
                                        className="btn-action btn-select-all"
                                        onClick={() => handleSelectAll(selectedRole.id)}
                                    >
                                        ☑️ Select All
                                    </button>
                                    <button
                                        className="btn-action btn-clear-all"
                                        onClick={() => handleClearAll(selectedRole.id)}
                                    >
                                        ☐ Clear All
                                    </button>
                                </div>
                            </div>

                            <div className="permissions-grid">
                                {Object.entries(groupedPermissions).map(([category, perms]) => (
                                    <div key={category} className="permission-category">
                                        <h4 className="category-title">{category}</h4>
                                        <div className="permission-list">
                                            {perms.map((perm) => (
                                                <label key={perm.key} className="permission-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={permissions[selectedRole.id]?.[perm.key] || false}
                                                        onChange={() => handlePermissionToggle(selectedRole.id, perm.key)}
                                                    />
                                                    <span className="permission-label">{perm.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="editor-footer">
                                <button
                                    className="btn-save"
                                    onClick={handleSavePermissions}
                                    disabled={saving}
                                >
                                    {saving ? "⏳ Menyimpan..." : "💾 Simpan Permissions"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="no-selection">
                            <span className="icon">👈</span>
                            <p>Pilih role untuk edit permissions</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PermissionManagement;
