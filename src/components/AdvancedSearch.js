import React, { useState, useEffect } from "react";
import SearchableSelect from "./SearchableSelect";
import "./AdvancedSearch.css";

/**
 * AdvancedSearch Component
 * Advanced search and filter panel for file manager
 */
const AdvancedSearch = ({ onFilterChange, uploaders }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        searchTerm: "",
        fileType: "",
        uploader: "",
        sizeMin: "",
        sizeMax: "",
        dateFrom: "",
        dateTo: "",
    });
    const [savedSearches, setSavedSearches] = useState([]);

    // Load saved searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("savedSearches");
        if (saved) {
            setSavedSearches(JSON.parse(saved));
        }
    }, []);

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const clearFilters = () => {
        const emptyFilters = {
            searchTerm: "",
            fileType: "",
            uploader: "",
            sizeMin: "",
            sizeMax: "",
            dateFrom: "",
            dateTo: "",
        };
        setFilters(emptyFilters);
        onFilterChange(emptyFilters);
    };

    const saveCurrentSearch = () => {
        const searchName = prompt("Nama untuk pencarian ini:");
        if (!searchName) return;

        const newSearch = {
            id: Date.now(),
            name: searchName,
            filters: { ...filters },
        };

        const updated = [...savedSearches, newSearch];
        setSavedSearches(updated);
        localStorage.setItem("savedSearches", JSON.stringify(updated));
        alert(`✅ Pencarian "${searchName}" disimpan!`);
    };

    const loadSavedSearch = (search) => {
        setFilters(search.filters);
        onFilterChange(search.filters);
    };

    const deleteSavedSearch = (id) => {
        const updated = savedSearches.filter((s) => s.id !== id);
        setSavedSearches(updated);
        localStorage.setItem("savedSearches", JSON.stringify(updated));
    };

    const getActiveFiltersCount = () => {
        return Object.values(filters).filter((v) => v !== "").length;
    };

    const fileTypes = [
        { value: "", label: "Semua Tipe" },
        { value: "pdf", label: "📄 PDF" },
        { value: "word", label: "📝 Word (DOCX)" },
        { value: "excel", label: "📊 Excel (XLSX)" },
        { value: "csv", label: "📊 CSV" },
        { value: "image", label: "🖼️ Gambar" },
        { value: "video", label: "🎥 Video" },
        { value: "audio", label: "🎵 Audio" },
    ];

    return (
        <div className="search-panel">
            {/* Compact Search Bar */}
            <div className="search-bar-compact">
                <div className="search-input-wrapper">
                    <span className="search-icon-left">🔍</span>
                    <input
                        type="text"
                        className="search-input-main"
                        placeholder="Cari file atau folder..."
                        value={filters.searchTerm}
                        onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                    />
                    {getActiveFiltersCount() > 0 && (
                        <span className="filter-count-badge">{getActiveFiltersCount()}</span>
                    )}
                </div>
                <button
                    className="toggle-filters-btn-compact"
                    onClick={() => setShowFilters(!showFilters)}
                    title="Filter Lanjutan"
                >
                    <span className="filter-icon">⚙️</span>
                    {showFilters ? "▲" : "▼"}
                </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
                <div className="filters-panel-expanded">
                    <div className="filters-grid">
                        {/* File Type */}
                        <div className="filter-group">
                            <label className="filter-label">Tipe File</label>
                            <SearchableSelect
                                options={fileTypes}
                                value={filters.fileType}
                                onChange={(value) => handleFilterChange("fileType", value)}
                                placeholder="Semua Tipe"
                            />
                        </div>

                        {/* Uploader */}
                        <div className="filter-group">
                            <label className="filter-label">Diupload Oleh</label>
                            <SearchableSelect
                                options={[
                                    { value: "", label: "Semua User" },
                                    ...uploaders.map((u) => ({
                                        value: u.userId,
                                        label: u.displayName,
                                    })),
                                ]}
                                value={filters.uploader}
                                onChange={(value) => handleFilterChange("uploader", value)}
                                placeholder="Semua User"
                            />
                        </div>

                        {/* Date Range */}
                        <div className="filter-group">
                            <label className="filter-label">Dari Tanggal</label>
                            <input
                                type="date"
                                className="filter-input"
                                value={filters.dateFrom}
                                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">Sampai Tanggal</label>
                            <input
                                type="date"
                                className="filter-input"
                                value={filters.dateTo}
                                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                            />
                        </div>

                        {/* Size Range */}
                        <div className="filter-group">
                            <label className="filter-label">Ukuran File (KB)</label>
                            <div className="size-range">
                                <input
                                    type="number"
                                    className="filter-input"
                                    placeholder="Min"
                                    value={filters.sizeMin}
                                    onChange={(e) => handleFilterChange("sizeMin", e.target.value)}
                                />
                                <span className="size-separator">-</span>
                                <input
                                    type="number"
                                    className="filter-input"
                                    placeholder="Max"
                                    value={filters.sizeMax}
                                    onChange={(e) => handleFilterChange("sizeMax", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filter Actions */}
                    <div className="filter-actions">
                        <button className="btn-filter btn-clear" onClick={clearFilters}>
                            ✕ Clear Semua
                        </button>
                        {getActiveFiltersCount() > 0 && (
                            <button className="btn-filter save-search-btn" onClick={saveCurrentSearch}>
                                💾 Simpan Pencarian
                            </button>
                        )}
                    </div>

                    {/* Saved Searches */}
                    {savedSearches.length > 0 && (
                        <div className="saved-searches">
                            <div className="saved-searches-header">
                                <h5>📌 Pencarian Tersimpan</h5>
                            </div>
                            <div className="saved-search-list">
                                {savedSearches.map((search) => (
                                    <div
                                        key={search.id}
                                        className="saved-search-item"
                                        onClick={() => loadSavedSearch(search)}
                                    >
                                        <span>{search.name}</span>
                                        <button
                                            className="delete-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSavedSearch(search.id);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Active Filters Tags */}
            {getActiveFiltersCount() > 0 && (
                <div className="active-filters">
                    {filters.searchTerm && (
                        <div className="filter-tag">
                            🔍 "{filters.searchTerm}"
                            <button onClick={() => handleFilterChange("searchTerm", "")}>✕</button>
                        </div>
                    )}
                    {filters.fileType && (
                        <div className="filter-tag">
                            📁 {fileTypes.find((t) => t.value === filters.fileType)?.label}
                            <button onClick={() => handleFilterChange("fileType", "")}>✕</button>
                        </div>
                    )}
                    {filters.uploader && (
                        <div className="filter-tag">
                            👤 {uploaders.find((u) => u.userId === filters.uploader)?.displayName}
                            <button onClick={() => handleFilterChange("uploader", "")}>✕</button>
                        </div>
                    )}
                    {(filters.sizeMin || filters.sizeMax) && (
                        <div className="filter-tag">
                            📏 {filters.sizeMin || "0"} - {filters.sizeMax || "∞"} KB
                            <button
                                onClick={() => {
                                    handleFilterChange("sizeMin", "");
                                    handleFilterChange("sizeMax", "");
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    {(filters.dateFrom || filters.dateTo) && (
                        <div className="filter-tag">
                            📅 {filters.dateFrom || "..."} - {filters.dateTo || "..."}
                            <button
                                onClick={() => {
                                    handleFilterChange("dateFrom", "");
                                    handleFilterChange("dateTo", "");
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdvancedSearch;
