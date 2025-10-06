import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./ExcelViewer.css";

/**
 * ExcelViewer Component
 * Renders Excel files (.xlsx, .xls) with proper merged cells support
 */
const ExcelViewer = ({ file, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [activeSheet, setActiveSheet] = useState(0);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const loadExcel = async () => {
            if (!file) return;

            try {
                setLoading(true);
                setError(null);

                let arrayBuffer;

                // Method 1: Direct fetch
                try {
                    const response = await fetch(file.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    arrayBuffer = await response.arrayBuffer();
                } catch (directError) {
                    // Method 2: CORS proxy fallback
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(file.url)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
                    arrayBuffer = await response.arrayBuffer();
                }

                if (cancelled) return;

                // Parse Excel
                const workbook = XLSX.read(arrayBuffer, { type: "array" });

                // Parse all sheets with merged cells support
                const sheetsData = workbook.SheetNames.map((sheetName, index) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
                    const merges = worksheet["!merges"] || [];

                    const mergedCells = new Set();
                    const mergeMap = new Map();

                    // Process merged cells
                    merges.forEach((merge) => {
                        for (let r = merge.s.r; r <= merge.e.r; r++) {
                            for (let c = merge.s.c; c <= merge.e.c; c++) {
                                const cellKey = `${r}-${c}`;
                                if (r === merge.s.r && c === merge.s.c) {
                                    mergeMap.set(cellKey, {
                                        rowspan: merge.e.r - merge.s.r + 1,
                                        colspan: merge.e.c - merge.s.c + 1,
                                    });
                                } else {
                                    mergedCells.add(cellKey);
                                }
                            }
                        }
                    });

                    const jsonData = [];
                    const maxRows = Math.min(range.e.r, range.s.r + 199);

                    for (let rowNum = range.s.r; rowNum <= maxRows; rowNum++) {
                        const row = [];
                        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
                            const cellKey = `${rowNum}-${colNum}`;
                            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
                            const cell = worksheet[cellAddress];
                            const cellValue = cell ? cell.w || cell.v || "" : "";

                            if (mergedCells.has(cellKey)) {
                                row.push({ hidden: true });
                            } else if (mergeMap.has(cellKey)) {
                                const mergeInfo = mergeMap.get(cellKey);
                                row.push({
                                    value: cellValue,
                                    rowspan: mergeInfo.rowspan,
                                    colspan: mergeInfo.colspan,
                                    isMerged: true,
                                });
                            } else {
                                row.push({ value: cellValue });
                            }
                        }
                        jsonData.push(row);
                    }

                    return { name: sheetName, data: jsonData, index };
                });

                if (!cancelled) {
                    setSheets(sheetsData);
                    setActiveSheet(0);
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Error loading Excel:", err);
                    setError(err.message || "Gagal memuat file Excel");
                    setLoading(false);
                }
            }
        };

        loadExcel();

        return () => {
            cancelled = true;
        };
    }, [file, retryCount]);

    const handleRetry = () => {
        setRetryCount((prev) => prev + 1);
    };

    const handleDownload = () => {
        const link = document.createElement("a");
        link.href = file.url;
        link.download = file.name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const currentSheet = sheets[activeSheet];

    return (
        <div className="excel-viewer-overlay" onClick={onClose}>
            <div className="excel-viewer-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="excel-viewer-header">
                    <div className="excel-viewer-title">
                        <span className="excel-icon">📊</span>
                        <span className="excel-filename">{file.name}</span>
                    </div>
                    <div className="excel-viewer-actions">
                        <button className="excel-btn excel-btn-download" onClick={handleDownload}>
                            ⬇️ Download
                        </button>
                        <button className="excel-btn excel-btn-close" onClick={onClose}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="excel-viewer-content">
                    {loading && (
                        <div className="excel-loading">
                            <div className="excel-spinner"></div>
                            <p>Memuat Excel...</p>
                        </div>
                    )}

                    {error && (
                        <div className="excel-error">
                            <div className="excel-error-icon">⚠️</div>
                            <h3>Gagal Memuat Excel</h3>
                            <p>{error}</p>
                            <div className="excel-error-actions">
                                <button className="excel-btn excel-btn-retry" onClick={handleRetry}>
                                    🔄 Coba Lagi
                                </button>
                                <button className="excel-btn excel-btn-download" onClick={handleDownload}>
                                    ⬇️ Download File
                                </button>
                            </div>
                        </div>
                    )}

                    {!loading && !error && sheets.length > 0 && (
                        <>
                            {/* Sheet Tabs */}
                            {sheets.length > 1 && (
                                <div className="excel-sheet-tabs">
                                    {sheets.map((sheet, index) => (
                                        <button
                                            key={index}
                                            className={`excel-sheet-tab ${activeSheet === index ? "active" : ""}`}
                                            onClick={() => setActiveSheet(index)}
                                        >
                                            {sheet.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Table */}
                            <div className="excel-table-container">
                                <table className="excel-table">
                                    <tbody>
                                        {currentSheet?.data.map((row, rowIdx) => (
                                            <tr key={rowIdx}>
                                                {row.map((cell, colIdx) => {
                                                    if (cell?.hidden) return null;

                                                    const cellValue = typeof cell === "object" ? cell.value : cell;
                                                    const cellLength = String(cellValue || "").length;

                                                    return (
                                                        <td
                                                            key={colIdx}
                                                            rowSpan={cell?.rowspan || 1}
                                                            colSpan={cell?.colspan || 1}
                                                            className={`excel-cell ${rowIdx === 0 ? "header" : ""} ${cell?.isMerged ? "merged" : ""}`}
                                                            style={{
                                                                width: `${Math.max(120, Math.min(300, cellLength * 8))}px`,
                                                            }}
                                                        >
                                                            {cellValue || ""}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Info */}
                            <div className="excel-info">
                                📋 Menampilkan {currentSheet?.data.length || 0} baris
                                {sheets.length > 1 && ` • Sheet: ${currentSheet?.name}`}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExcelViewer;
