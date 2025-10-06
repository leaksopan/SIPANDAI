import React, { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import "./DocxViewer.css";

/**
 * DocxViewer Component
 * Renders DOCX files using docx-preview library with CORS handling
 */
const DocxViewer = ({ file, onClose }) => {
    const containerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const loadDocx = async () => {
            if (!file || !containerRef.current) return;

            try {
                setLoading(true);
                setError(null);

                // Clear previous content
                containerRef.current.innerHTML = "";

                // Method 1: Direct fetch (works if CORS is properly configured)
                let arrayBuffer;
                try {
                    console.log("🔄 DOCX: Trying direct fetch...");
                    const response = await fetch(file.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    arrayBuffer = await response.arrayBuffer();
                    console.log("✅ DOCX: Direct fetch successful");
                } catch (directError) {
                    console.log("❌ DOCX: Direct fetch failed, trying proxy...");

                    // Method 2: CORS proxy fallback
                    try {
                        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
                            file.url
                        )}`;
                        const response = await fetch(proxyUrl);
                        if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
                        arrayBuffer = await response.arrayBuffer();
                        console.log("✅ DOCX: Proxy fetch successful");
                    } catch (proxyError) {
                        throw new Error(
                            "Tidak dapat memuat file DOCX. Pastikan CORS sudah dikonfigurasi dengan benar."
                        );
                    }
                }

                if (cancelled) return;

                // Render DOCX
                await renderAsync(arrayBuffer, containerRef.current, null, {
                    className: "docx-wrapper",
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    experimental: false,
                    trimXmlDeclaration: true,
                    useBase64URL: false,
                    renderHeaders: true,
                    renderFooters: true,
                    renderFootnotes: true,
                    renderEndnotes: true,
                });

                if (!cancelled) {
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Error loading DOCX:", err);
                    setError(err.message || "Gagal memuat file DOCX");
                    setLoading(false);
                }
            }
        };

        loadDocx();

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

    return (
        <div className="docx-viewer-overlay" onClick={onClose}>
            <div className="docx-viewer-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="docx-viewer-header">
                    <div className="docx-viewer-title">
                        <span className="docx-icon">📝</span>
                        <span className="docx-filename">{file.name}</span>
                    </div>
                    <div className="docx-viewer-actions">
                        <button
                            className="docx-btn docx-btn-download"
                            onClick={handleDownload}
                            title="Download"
                        >
                            ⬇️ Download
                        </button>
                        <button
                            className="docx-btn docx-btn-close"
                            onClick={onClose}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="docx-viewer-content">
                    {loading && (
                        <div className="docx-loading">
                            <div className="docx-spinner"></div>
                            <p>Memuat dokumen...</p>
                        </div>
                    )}

                    {error && (
                        <div className="docx-error">
                            <div className="docx-error-icon">⚠️</div>
                            <h3>Gagal Memuat Dokumen</h3>
                            <p>{error}</p>
                            <div className="docx-error-actions">
                                <button className="docx-btn docx-btn-retry" onClick={handleRetry}>
                                    🔄 Coba Lagi
                                </button>
                                <button className="docx-btn docx-btn-download" onClick={handleDownload}>
                                    ⬇️ Download File
                                </button>
                            </div>
                            <div className="docx-error-help">
                                <p><strong>Tips:</strong></p>
                                <ul>
                                    <li>Pastikan CORS sudah dikonfigurasi di Firebase Storage</li>
                                    <li>Jalankan: <code>gsutil cors set cors.json gs://YOUR-BUCKET</code></li>
                                    <li>Atau download file untuk membuka secara lokal</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <div
                        ref={containerRef}
                        className="docx-content"
                        style={{ display: loading || error ? "none" : "block" }}
                    />
                </div>
            </div>
        </div>
    );
};

export default DocxViewer;
