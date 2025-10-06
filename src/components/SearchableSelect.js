import React, { useState, useRef, useEffect } from "react";
import "./SearchableSelect.css";

/**
 * SearchableSelect Component
 * Dropdown dengan search functionality
 */
const SearchableSelect = ({ options, value, onChange, placeholder = "Pilih..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const wrapperRef = useRef(null);
    const dropdownRef = useRef(null);

    // Calculate dropdown position
    useEffect(() => {
        if (isOpen && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width,
            });
        }
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
                setSearchTerm("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter options based on search
    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get selected option label
    const selectedOption = options.find((opt) => opt.value === value);
    const displayValue = selectedOption ? selectedOption.label : placeholder;

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className="searchable-select" ref={wrapperRef}>
            {/* Selected Value Display */}
            <div
                className={`select-display ${isOpen ? "open" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={value ? "" : "placeholder"}>{displayValue}</span>
                <span className="arrow">{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="select-dropdown">
                    {/* Search Input */}
                    <div className="search-input-container">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="🔍 Cari..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    </div>

                    {/* Options List */}
                    <div className="options-list">
                        {filteredOptions.length === 0 ? (
                            <div className="no-results">Tidak ada hasil</div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={`option-item ${option.value === value ? "selected" : ""}`}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    {option.label}
                                    {option.value === value && <span className="check-mark">✓</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
