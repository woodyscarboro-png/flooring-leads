import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const RTDB_URL = "https://kqf-lead-generation-default-rtdb.firebaseio.com";

const STATUS_OPTIONS = ["New", "Contacted", "Quoted", "Won", "Lost"];

const STATUS_COLORS = {
  New: "#3b82f6",
  Contacted: "#f59e0b",
  Quoted: "#8b5cf6",
  Won: "#10b981",
  Lost: "#ef4444",
};

function Dashboard({ user }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCounty, setFilterCounty] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedLead, setSelectedLead] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [counties, setCounties] = useState([]);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${RTDB_URL}/leads.json`);
      const data = await resp.json();
      if (data) {
        const leadsArray = Object.entries(data).map(([id, lead]) => ({
          id,
          ...lead,
        }));
        leadsArray.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
        setLeads(leadsArray);
        const uniqueCounties = [...new Set(leadsArray.map((l) => l.county).filter(Boolean))].sort();
        setCounties(uniqueCounties);
      } else {
        setLeads([]);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    }
    setLoading(false);
  };

  const updateStatus = async (leadId, newStatus) => {
    try {
      await fetch(`${RTDB_URL}/leads/${leadId}/status.json`, {
        method: "PUT",
        body: JSON.stringify(newStatus),
      });
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const saveNote = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      await fetch(`${RTDB_URL}/leads/${selectedLead.id}/notes.json`, {
        method: "PUT",
        body: JSON.stringify(note),
      });
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, notes: note } : l))
      );
      setSelectedLead((prev) => ({ ...prev, notes: note }));
    } catch (err) {
      console.error("Error saving note:", err);
    }
    setSaving(false);
  };

  const openLead = (lead) => {
    setSelectedLead(lead);
    setNote(lead.notes || "");
  };

  const filtered = leads.filter((l) => {
    const matchSearch =
      search === "" ||
      (l.owner_name && l.owner_name.toLowerCase().includes(search.toLowerCase())) ||
      (l.property_address && l.property_address.toLowerCase().includes(search.toLowerCase())) ||
      (l.county && l.county.toLowerCase().includes(search.toLowerCase())) ||
      (l.contractor_name && l.contractor_name.toLowerCase().includes(search.toLowerCase()));
    const matchCounty = filterCounty === "All" || l.county === filterCounty;
    const matchStatus = filterStatus === "All" || (l.status || "New") === filterStatus;
    return matchSearch && matchCounty && matchStatus;
  });

  const stats = {
    total: leads.length,
    new: leads.filter((l) => !l.status || l.status === "New").length,
    contacted: leads.filter((l) => l.status === "Contacted").length,
    won: leads.filter((l) => l.status === "Won").length,
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-left">
          <h1>KCM Quality Flooring</h1>
          <span className="header-subtitle">Lead Management</span>
        </div>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="logout-btn" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="stats-bar">
        <div className="stat-card">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Leads</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" style={{ color: STATUS_COLORS.New }}>{stats.new}</span>
          <span className="stat-label">New</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" style={{ color: STATUS_COLORS.Contacted }}>{stats.contacted}</span>
          <span className="stat-label">Contacted</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" style={{ color: STATUS_COLORS.Won }}>{stats.won}</span>
          <span className="stat-label">Won</span>
        </div>
      </div>

      <div className="filters">
        <input
          className="search-input"
          type="text"
          placeholder="Search by name, address, county..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filterCounty} onChange={(e) => setFilterCounty(e.target.value)}>
          <option value="All">All Counties</option>
          {counties.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="refresh-btn" onClick={fetchLeads}>Refresh</button>
      </div>

      <div className="content">
        <div className="leads-list">
          <div className="leads-count">{filtered.length} leads</div>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>No leads found. Run a search in your PC app to sync leads here.</p>
            </div>
          ) : (
            filtered.map((lead) => (
              <div
                key={lead.id}
                className={`lead-card ${selectedLead?.id === lead.id ? "selected" : ""}`}
                onClick={() => openLead(lead)}
              >
                <div className="lead-card-top">
                  <span className="lead-name">{lead.owner_name || lead.contractor_name || "Unknown"}</span>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: STATUS_COLORS[lead.status || "New"] }}
                  >
                    {lead.status || "New"}
                  </span>
                </div>
                <div className="lead-address">{lead.property_address || "No address"}</div>
                <div className="lead-meta">
                  <span>{lead.county} County</span>
                  {lead.permit_date && <span>• {lead.permit_date}</span>}
                  {lead.lead_score && <span>• Score: {lead.lead_score}/10</span>}
                  {lead.estimated_value && <span>• ${Number(lead.estimated_value).toLocaleString()}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {selectedLead && (
          <div className="lead-detail">
            <div className="detail-header">
              <h2>{selectedLead.owner_name || selectedLead.contractor_name || "Unknown"}</h2>
              <button className="close-btn" onClick={() => setSelectedLead(null)}>✕</button>
            </div>

            <div className="detail-section">
              <h3>Property Info</h3>
              <div className="detail-row"><span>Address</span><strong>{selectedLead.property_address || "N/A"}</strong></div>
              <div className="detail-row"><span>County</span><strong>{selectedLead.county || "N/A"}</strong></div>
              <div className="detail-row"><span>Permit Date</span><strong>{selectedLead.permit_date || "N/A"}</strong></div>
              <div className="detail-row"><span>Permit Type</span><strong>{selectedLead.permit_type || "N/A"}</strong></div>
              <div className="detail-row"><span>Permit #</span><strong>{selectedLead.permit_number || "N/A"}</strong></div>
              <div className="detail-row"><span>Est. Value</span><strong>{selectedLead.estimated_value ? "$" + Number(selectedLead.estimated_value).toLocaleString() : "N/A"}</strong></div>
              <div className="detail-row"><span>Lead Score</span><strong>{selectedLead.lead_score || "N/A"}/10</strong></div>
              <div className="detail-row"><span>Contractor</span><strong>{selectedLead.contractor_name || "N/A"}</strong></div>
              <div className="detail-row"><span>Phone</span><strong>{selectedLead.contractor_phone || "N/A"}</strong></div>
              <div className="detail-row"><span>Category</span><strong>{(selectedLead.lead_category || "").replace(/_/g, " ")}</strong></div>
              <div className="detail-row"><span>Pitch</span><strong>{selectedLead.suggested_flooring_pitch || "N/A"}</strong></div>
            </div>

            <div className="detail-section">
              <h3>Status</h3>
              <div className="status-buttons">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    className={`status-btn ${(selectedLead.status || "New") === s ? "active" : ""}`}
                    style={(selectedLead.status || "New") === s ? { backgroundColor: STATUS_COLORS[s], color: "#fff" } : {}}
                    onClick={() => updateStatus(selectedLead.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <h3>Notes</h3>
              <textarea
                className="notes-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add notes about this lead..."
                rows={5}
              />
              <button className="save-btn" onClick={saveNote} disabled={saving}>
                {saving ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
