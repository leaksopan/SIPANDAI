import React, { useState, useEffect } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    startAfter,
    deleteDoc,
    doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";
import "./ActivityLogs.css";

const ActivityLogs = () => {
    const { user } = useAuth();
    const { hasPermission, loading: roleLoading } = useUserRole();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterAction, setFilterAction] = useState("ALL");
    const [filterUser, setFilterUser] = useState("");
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [selectedLogs, setSelectedLogs] = useState([]);
    const [deleting, setDeleting] = useState(false);

    const LOGS_PER_PAGE = 50;

    const canViewLogs = hasPermission("canViewLogs");

    useEffect(() => {
        if (user && canViewLogs && !roleLoading) {
            loadLogs();
        }
    }, [user, canViewLogs, roleLoading]);

    useEffect(() => {
        if (user && canViewLogs && !roleLoading) {
            setLastDoc(null);
            loadLogs();
        }
    }, [filterAction, filterUser]);

    const loadLogs = async (loadMore = false) => {
        setLoading(true);
        try {
            // Build query constraints array
            const constraints = [];

            // Apply filters
            if (filterAction !== "ALL") {
                constraints.push(where("action", "==", filterAction));
            }

            if (filterUser) {
                constraints.push(where("userEmail", "==", filterUser));
            }

            // Add ordering
            constraints.push(orderBy("timestamp", "desc"));

            // Pagination
            if (loadMore && lastDoc) {
                constraints.push(startAfter(lastDoc));
            }

            // Add limit
            constraints.push(limit(LOGS_PER_PAGE));

            // Build final query
            const q = query(collection(db, "activityLogs"), ...constraints);

            const snapshot = await getDocs(q);
            const logsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            if (loadMore) {
                setLogs((prev) => [...prev, ...logsData]);
            } else {
                setLogs(logsData);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === LOGS_PER_PAGE);
        } catch (error) {
            console.error("Error loading logs:", error);
            alert("Gagal memuat activity logs: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Toggle select log
    const toggleSelectLog = (logId) => {
        setSelectedLogs((prev) =>
            prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
        );
    };

    // Select all visible logs
    const selectAllLogs = () => {
        if (selectedLogs.length === logs.length) {
            setSelectedLogs([]);
        } else {
            setSelectedLogs(logs.map((log) => log.id));
        }
    };

    // Delete selected logs
    const deleteSelectedLogs = async () => {
        if (selectedLogs.length === 0) {
            alert("Pilih logs yang ingin dihapus");
            return;
        }

        if (!window.confirm(`Hapus ${selectedLogs.length} logs yang dipilih?`)) {
            return;
        }

        setDeleting(true);
        try {
            const deletePromises = selectedLogs.map((logId) =>
                deleteDoc(doc(db, "activityLogs", logId))
            );

            await Promise.all(deletePromises);

            // Remove deleted logs from state
            setLogs((prev) => prev.filter((log) => !selectedLogs.includes(log.id)));
            setSelectedLogs([]);

            alert(`✅ Berhasil menghapus ${deletePromises.length} logs!`);
        } catch (error) {
            console.error("Error deleting logs:", error);
            alert("Gagal menghapus logs");
        } finally {
            setDeleting(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return "-";

        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }

        return new Intl.DateTimeFormat("id-ID", {
            dateStyle: "medium",
            timeStyle: "medium",
        }).format(date);
    };

    const getActionColor = (action) => {
        if (action.includes("DELETE")) return "#ef4444";
        if (action.includes("CREATE") || action.includes("UPLOAD")) return "#10b981";
        if (action.includes("UPDATE") || action.includes("RENAME")) return "#f59e0b";
        if (action.includes("MOVE")) return "#3b82f6";
        return "#6b7280";
    };

    const getActionIcon = (action) => {
        if (action.includes("DELETE")) return "🗑️";
        if (action.includes("CREATE")) return "➕";
        if (action.includes("UPLOAD")) return "⬆️";
        if (action.includes("RENAME")) return "✏️";
        if (action.includes("MOVE")) return "📦";
        if (action.includes("DOWNLOAD")) return "⬇️";
        if (action.includes("LOGIN")) return "🔓";
        if (action.includes("LOGOUT")) return "🔒";
        return "📝";
    };

    if (roleLoading) {
        return (
            <div className="activity-logs">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Memuat...</p>
                </div>
            </div>
        );
    }

    if (!canViewLogs) {
        return (
            <div className="activity-logs">
                <div className="access-denied">
                    <span className="icon">🔒</span>
                    <h3>Akses Ditolak</h3>
                    <p>Anda tidak memiliki izin untuk melihat activity logs</p>
                </div>
            </div>
        );
    }

    return (
        <div className="activity-logs">
            <div className="logs-header">
                <div>
                    <h2>📊 Activity Logs</h2>
                    <p>Riwayat aktivitas sistem</p>
                </div>
                <div className="logs-stats">
                    <div className="stat-item">
                        <span className="stat-value">{logs.length}</span>
                        <span className="stat-label">Showing</span>
                    </div>
                    {selectedLogs.length > 0 && (
                        <div className="stat-item" style={{ backgroundColor: "#fee2e2" }}>
                            <span className="stat-value" style={{ color: "#dc2626" }}>
                                {selectedLogs.length}
                            </span>
                            <span className="stat-label">Selected</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Actions */}
            {selectedLogs.length > 0 && (
                <div className="delete-actions">
                    <button onClick={deleteSelectedLogs} disabled={deleting} className="btn-delete-selected">
                        {deleting ? "⏳ Menghapus..." : `🗑️ Hapus ${selectedLogs.length} Logs`}
                    </button>
                    <button onClick={() => setSelectedLogs([])} className="btn-cancel-select">
                        ✖️ Batal
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="logs-filters">
                <div className="filter-group">
                    <label>Filter Aksi:</label>
                    <select
                        value={filterAction}
                        onChange={(e) => {
                            setFilterAction(e.target.value);
                            setLastDoc(null);
                        }}
                        className="filter-select"
                    >
                        <option value="ALL">Semua Aksi</option>
                        <option value="UPLOAD FILE">Upload File</option>
                        <option value="DELETE FILE">Delete File</option>
                        <option value="RENAME FILE">Rename File</option>
                        <option value="MOVE FILE">Move File</option>
                        <option value="CREATE FOLDER">Create Folder</option>
                        <option value="DELETE FOLDER">Delete Folder</option>
                        <option value="CREATE USER">Create User</option>
                        <option value="UPDATE USER">Update User</option>
                        <option value="CHANGE USER ROLE">Change Role</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Filter User:</label>
                    <input
                        type="text"
                        value={filterUser}
                        onChange={(e) => {
                            setFilterUser(e.target.value);
                            setLastDoc(null);
                        }}
                        placeholder="Email user..."
                        className="filter-input"
                    />
                </div>

                <button
                    onClick={() => {
                        setFilterAction("ALL");
                        setFilterUser("");
                        setLastDoc(null);
                    }}
                    className="btn-clear-filter"
                >
                    🔄 Reset Filter
                </button>
            </div>

            {/* Logs Table */}
            <div className="logs-table-container">
                {loading && logs.length === 0 ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Memuat logs...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="no-logs">
                        <span className="icon">📭</span>
                        <p>Tidak ada activity logs</p>
                    </div>
                ) : (
                    <>
                        <table className="logs-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "40px" }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedLogs.length === logs.length && logs.length > 0}
                                            onChange={selectAllLogs}
                                            style={{ cursor: "pointer" }}
                                        />
                                    </th>
                                    <th>Waktu</th>
                                    <th>User</th>
                                    <th>Email</th>
                                    <th>Aksi</th>
                                    <th>Target</th>
                                    <th>Detail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className={selectedLogs.includes(log.id) ? "selected-row" : ""}
                                    >
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedLogs.includes(log.id)}
                                                onChange={() => toggleSelectLog(log.id)}
                                                style={{ cursor: "pointer" }}
                                            />
                                        </td>
                                        <td className="log-time">
                                            {formatTimestamp(log.timestamp || log.createdAt)}
                                        </td>
                                        <td className="log-user">{log.userName}</td>
                                        <td className="log-email">{log.userEmail}</td>
                                        <td className="log-action">
                                            <span
                                                className="action-badge"
                                                style={{ backgroundColor: getActionColor(log.action) }}
                                            >
                                                {getActionIcon(log.action)} {log.action}
                                            </span>
                                        </td>
                                        <td className="log-target">
                                            <span className="target-type">{log.targetType}</span>
                                            <span className="target-name">{log.targetName}</span>
                                        </td>
                                        <td className="log-details">{log.details || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {hasMore && (
                            <div className="load-more-container">
                                <button
                                    onClick={() => loadLogs(true)}
                                    disabled={loading}
                                    className="btn-load-more"
                                >
                                    {loading ? "⏳ Loading..." : "📥 Load More"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ActivityLogs;
