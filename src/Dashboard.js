import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const RTDB_URL = "https://kqf-lead-generation-default-rtdb.firebaseio.com";
const STATUS_OPTIONS = ["New", "Contacted", "Quoted", "Won", "Lost"];
const STATUS_COLORS = {
  New: "#3b82f6", Contacted: "#f59e0b",
  Quoted: "#8b5cf6", Won: "#10b981", Lost: "#ef4444",
};

const S = {
  callBtn: {
    display:"inline-flex",alignItems:"center",gap:"5px",
    padding:"5px 13px",borderRadius:"6px",background:"#1A5FA8",
    color:"#fff",fontWeight:700,fontSize:"0.78rem",
    textDecoration:"none",whiteSpace:"nowrap",flexShrink:0,
  },
  emailBtn: {
    display:"inline-flex",alignItems:"center",gap:"5px",
    padding:"5px 13px",borderRadius:"6px",background:"#27AE60",
    color:"#fff",fontWeight:700,fontSize:"0.78rem",
    textDecoration:"none",whiteSpace:"nowrap",flexShrink:0,
  },
  contactRow: {
    display:"flex",alignItems:"center",gap:"8px",
    flexWrap:"wrap",marginTop:"2px",
  },
  contactVal: { flex:1,minWidth:0,wordBreak:"break-all",fontWeight:600 },
  subLabel: {
    fontSize:"0.65rem",textTransform:"uppercase",letterSpacing:"0.08em",
    color:"#F4A826",fontWeight:700,marginBottom:"8px",display:"block",
  },
  divider: { borderTop:"1px solid #2d3748",margin:"14px 0 10px",paddingTop:"10px" },
};

function PhoneField({ label, value }) {
  if (!value || !String(value).trim())
    return <div className="detail-row"><span>{label}</span><strong style={{color:"#555"}}>—</strong></div>;
  const digits = String(value).replace(/\D/g,"");
  return (
    <div className="detail-row">
      <span>{label}</span>
      <div style={S.contactRow}>
        <span style={S.contactVal}>{value}</span>
        <a href={`tel:${digits}`} style={S.callBtn}>📞 Call</a>
      </div>
    </div>
  );
}

function EmailField({ label, value }) {
  if (!value || !String(value).trim())
    return <div className="detail-row"><span>{label}</span><strong style={{color:"#555"}}>—</strong></div>;
  return (
    <div className="detail-row">
      <span>{label}</span>
      <div style={S.contactRow}>
        <span style={S.contactVal}>{value}</span>
        <a href={`mailto:${value}`} style={S.emailBtn}>✉ Email</a>
      </div>
    </div>
  );
}

function TextField({ label, value }) {
  const empty = !value || !String(value).trim();
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong style={empty ? {color:"#555"} : {}}>{empty ? "—" : String(value)}</strong>
    </div>
  );
}

function Dashboard({ user }) {
  const [leads,          setLeads]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [filterCounty,   setFilterCounty]   = useState("All");
  const [filterStatus,   setFilterStatus]   = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedLead,   setSelectedLead]   = useState(null);
  const [note,           setNote]           = useState("");
  const [saving,         setSaving]         = useState(false);
  const [counties,       setCounties]       = useState([]);
  const [categories,     setCategories]     = useState([]);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/iP(ad|hone|od)/i.test(ua) && /CriOS/i.test(ua)) {
      window.location.href = "safari://" + window.location.href.replace(/^https?:\/\//, "");
      return;
    }
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${RTDB_URL}/leads.json`);
      const data = await resp.json();
      if (data) {
        const arr = Object.entries(data).map(([id, lead]) => ({ id, ...lead }));
        arr.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
        setLeads(arr);
        setCounties([...new Set(arr.map(l => l.county).filter(Boolean))].sort());
        setCategories([...new Set(arr.map(l => l.lead_category).filter(Boolean))].sort());
      } else { setLeads([]); }
    } catch (err) { console.error("Error fetching leads:", err); }
    setLoading(false);
  };

  const getStatus = l => l.lead_status || l.status || "New";

  const updateStatus = async (leadId, newStatus) => {
    try {
      await fetch(`${RTDB_URL}/leads/${leadId}/lead_status.json`, {
        method:"PUT", body:JSON.stringify(newStatus),
      });
      setLeads(prev => prev.map(l => l.id === leadId ? {...l, lead_status:newStatus} : l));
      if (selectedLead?.id === leadId)
        setSelectedLead(prev => ({...prev, lead_status:newStatus}));
    } catch (err) { console.error("Error updating status:", err); }
  };

  const saveNote = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      await fetch(`${RTDB_URL}/leads/${selectedLead.id}/notes.json`, {
        method:"PUT", body:JSON.stringify(note),
      });
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? {...l, notes:note} : l));
      setSelectedLead(prev => ({...prev, notes:note}));
    } catch (err) { console.error("Error saving note:", err); }
    setSaving(false);
  };

  const openLead = lead => { setSelectedLead(lead); setNote(lead.notes || ""); };

  const fmtCat = c => (c||"").replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase());

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    if (q && ![l.owner_name,l.property_address,l.county,l.contractor_name,
               l.contractor_phone,l.property_manager_phone,l.contractor_email,
               l.property_manager_email,l.lead_name,l.owner_phone2,l.contractor_phone2,
               l.owner_email2,l.contractor_email2].join(" ").toLowerCase().includes(q)) return false;
    if (filterCounty   !== "All" && l.county        !== filterCounty)   return false;
    if (filterStatus   !== "All" && getStatus(l)    !== filterStatus)   return false;
    if (filterCategory !== "All" && l.lead_category !== filterCategory)  return false;
    return true;
  });

  const stats = {
    total:     leads.length,
    new:       leads.filter(l => getStatus(l) === "New").length,
    contacted: leads.filter(l => getStatus(l) === "Contacted").length,
    won:       leads.filter(l => getStatus(l) === "Won").length,
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p>Loading leads…</p>
    </div>
  );

  return (
    <div className="dashboard">

      <header className="header">
        <div className="header-left">
          <h1>KQF Discount Flooring</h1>
          <span className="header-subtitle">Lead Management Dashboard</span>
        </div>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="logout-btn" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </header>

      <div className="stats-bar">
        {[
          ["Total Leads", stats.total, "#fff"],
          ["New",         stats.new,        STATUS_COLORS.New],
          ["Contacted",   stats.contacted,  STATUS_COLORS.Contacted],
          ["Won",         stats.won,        STATUS_COLORS.Won],
        ].map(([lbl,val,col]) => (
          <div className="stat-card" key={lbl}>
            <span className="stat-number" style={{color:col}}>{val.toLocaleString()}</span>
            <span className="stat-label">{lbl}</span>
          </div>
        ))}
      </div>

      <div className="filters">
        <input className="search-input" type="search"
          placeholder="Search name, address, phone, email…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterCounty}   onChange={e => setFilterCounty(e.target.value)}>
          <option value="All">All Counties</option>
          {counties.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus}   onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{fmtCat(c)}</option>)}
        </select>
        <button className="refresh-btn" onClick={fetchLeads}>↺ Refresh</button>
      </div>

      <div className="content">

        <div className="leads-list">
          <div className="leads-count">{filtered.length.toLocaleString()} leads</div>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>No leads match your filters. Run a sync from your desktop app.</p>
            </div>
          ) : filtered.map(lead => {
            const phone  = lead.contractor_phone || lead.property_manager_phone || "";
            const status = getStatus(lead);
            return (
              <div key={lead.id}
                className={`lead-card ${selectedLead?.id === lead.id ? "selected" : ""}`}
                onClick={() => openLead(lead)}>
                <div className="lead-card-top">
                  <span className="lead-name">
                    {lead.lead_name || lead.owner_name || lead.contractor_name || "Unknown"}
                  </span>
                  <span className="status-badge" style={{backgroundColor:STATUS_COLORS[status]}}>
                    {status}
                  </span>
                </div>
                <div className="lead-address">{lead.property_address || "No address"}</div>
                <div className="lead-meta">
                  {lead.county && <span>{lead.county} County</span>}
                  {lead.permit_date   && <span>• {lead.permit_date}</span>}
                  {lead.lead_score    && <span>• Score: {lead.lead_score}/10</span>}
                  {lead.estimated_value && <span>• ${Number(lead.estimated_value).toLocaleString()}</span>}
                </div>
                {phone && (
                  <div style={{marginTop:"7px"}} onClick={e => e.stopPropagation()}>
                    <a href={`tel:${phone.replace(/\D/g,"")}`} style={S.callBtn}>📞 Call</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedLead && (
          <div className="lead-detail">
            <div className="detail-header">
              <h2>{selectedLead.lead_name || selectedLead.owner_name || selectedLead.contractor_name || "Unknown"}</h2>
              <button className="close-btn" onClick={() => setSelectedLead(null)}>✕</button>
            </div>

            {selectedLead.suggested_flooring_pitch && (
              <div style={{background:"rgba(39,174,96,0.12)",borderLeft:"3px solid #27AE60",
                borderRadius:"0 6px 6px 0",padding:"10px 14px",fontSize:"0.83rem",
                color:"#A8E6C0",margin:"0 0 14px",lineHeight:1.5}}>
                💬 <strong>Pitch:</strong> {selectedLead.suggested_flooring_pitch}
              </div>
            )}

            {/* Owner */}
            <div className="detail-section">
              <h3>Owner / Property Contact</h3>
              <TextField  label="Owner Name"      value={selectedLead.owner_name} />
              <TextField  label="Mailing Address" value={selectedLead.owner_mailing_address} />
              <TextField  label="City / State / Zip"
                value={[selectedLead.city,selectedLead.state,selectedLead.zip].filter(Boolean).join(", ")} />
              <PhoneField label="Phone" value={selectedLead.property_manager_phone} />
              <EmailField label="Email" value={selectedLead.property_manager_email} />
              <TextField  label="Property Address" value={selectedLead.property_address} />
              <TextField  label="County"           value={selectedLead.county} />
            </div>

            {/* Owner 2nd contact */}
            {(selectedLead.owner_contact2_name||selectedLead.owner_phone2||selectedLead.owner_email2) && (
              <div className="detail-section">
                <div style={S.divider}>
                  <span style={S.subLabel}>Second Contact — Owner Side</span>
                  <TextField  label="Name"  value={selectedLead.owner_contact2_name} />
                  <TextField  label="Title" value={selectedLead.owner_contact2_title} />
                  <PhoneField label="Phone" value={selectedLead.owner_phone2} />
                  <EmailField label="Email" value={selectedLead.owner_email2} />
                </div>
              </div>
            )}

            {/* Contractor */}
            <div className="detail-section">
              <h3>Contractor / Builder</h3>
              <TextField  label="Name"             value={selectedLead.contractor_name} />
              <TextField  label="Business Address" value={selectedLead.contractor_address} />
              <TextField  label="City / State / Zip"
                value={[selectedLead.contractor_city,selectedLead.contractor_state,selectedLead.contractor_zip].filter(Boolean).join(", ")} />
              <PhoneField label="Phone" value={selectedLead.contractor_phone} />
              <EmailField label="Email" value={selectedLead.contractor_email} />
            </div>

            {/* Contractor 2nd contact */}
            {(selectedLead.contractor_contact2_name||selectedLead.contractor_phone2||selectedLead.contractor_email2) && (
              <div className="detail-section">
                <div style={S.divider}>
                  <span style={S.subLabel}>Second Contact — Contractor Side</span>
                  <TextField  label="Name"  value={selectedLead.contractor_contact2_name} />
                  <TextField  label="Title" value={selectedLead.contractor_contact2_title} />
                  <PhoneField label="Phone" value={selectedLead.contractor_phone2} />
                  <EmailField label="Email" value={selectedLead.contractor_email2} />
                </div>
              </div>
            )}

            {/* Permit */}
            <div className="detail-section">
              <h3>Permit Details</h3>
              <TextField label="Category"    value={fmtCat(selectedLead.lead_category)} />
              <TextField label="Permit #"    value={selectedLead.permit_number} />
              <TextField label="Date"        value={selectedLead.permit_date} />
              <TextField label="Type"        value={selectedLead.permit_type} />
              <TextField label="Est. Value"  value={selectedLead.estimated_value ? "$"+Number(selectedLead.estimated_value).toLocaleString() : ""} />
              <TextField label="Lead Score"  value={selectedLead.lead_score ? selectedLead.lead_score+"/10" : ""} />
              <TextField label="Source"      value={selectedLead.source_name} />
              <TextField label="Opportunity" value={selectedLead.opportunity_reason} />
            </div>

            {/* Status */}
            <div className="detail-section">
              <h3>Status</h3>
              <div className="status-buttons">
                {STATUS_OPTIONS.map(s => {
                  const cur = getStatus(selectedLead);
                  return (
                    <button key={s}
                      className={`status-btn ${cur===s?"active":""}`}
                      style={cur===s ? {backgroundColor:STATUS_COLORS[s],color:"#fff"} : {}}
                      onClick={() => updateStatus(selectedLead.id, s)}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="detail-section">
              <h3>Notes</h3>
              <textarea className="notes-input" value={note} rows={5}
                onChange={e => setNote(e.target.value)}
                placeholder="Add notes about this lead…" />
              <button className="save-btn" onClick={saveNote} disabled={saving}>
                {saving ? "Saving…" : "Save Notes"}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
