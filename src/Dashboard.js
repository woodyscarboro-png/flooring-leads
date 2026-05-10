import React, { useState, useEffect, useCallback } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const RTDB_URL = "https://kqf-lead-generation-default-rtdb.firebaseio.com";
const STATUS_OPTIONS = ["New", "Contacted", "Quoted", "Won", "Lost"];
const STATUS_COLORS = {
  New:"#3b82f6", Contacted:"#f59e0b",
  Quoted:"#8b5cf6", Won:"#10b981", Lost:"#ef4444",
};
const CONTACT_TITLES = [
  "","Owner","Secretary","Assistant","Office Manager",
  "Builder / Contractor","Project Manager","Foreman",
  "Receptionist","Sales Rep","Agent","Other",
];

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  callBtn:{display:"inline-flex",alignItems:"center",gap:"5px",padding:"5px 13px",
    borderRadius:"6px",background:"#1A5FA8",color:"#fff",fontWeight:700,
    fontSize:"0.78rem",textDecoration:"none",whiteSpace:"nowrap",flexShrink:0},
  emailBtn:{display:"inline-flex",alignItems:"center",gap:"5px",padding:"5px 13px",
    borderRadius:"6px",background:"#27AE60",color:"#fff",fontWeight:700,
    fontSize:"0.78rem",textDecoration:"none",whiteSpace:"nowrap",flexShrink:0},
  saveBtn:{padding:"8px 22px",background:"#1A5FA8",color:"#fff",border:"none",
    borderRadius:"6px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",marginTop:"10px"},
  input:{width:"100%",background:"#1a2a3a",border:"1px solid #2d4a6a",borderRadius:"6px",
    color:"#e8edf2",padding:"6px 10px",fontSize:"0.88rem",fontFamily:"inherit",
    boxSizing:"border-box"},
  select:{width:"100%",background:"#1a2a3a",border:"1px solid #2d4a6a",borderRadius:"6px",
    color:"#e8edf2",padding:"6px 10px",fontSize:"0.88rem",fontFamily:"inherit",
    boxSizing:"border-box"},
  subLabel:{fontSize:"0.65rem",textTransform:"uppercase",letterSpacing:"0.08em",
    color:"#F4A826",fontWeight:700,marginBottom:"8px",display:"block"},
  divider:{borderTop:"1px solid #2d3748",margin:"14px 0 10px",paddingTop:"10px"},
};

// ── Editable field with Call/Email button ─────────────────────────────────────
function EditPhone({ label, value, onChange }) {
  const digits = (value||"").replace(/\D/g,"");
  return (
    <div className="detail-row" style={{alignItems:"flex-start",flexDirection:"column",gap:"4px"}}>
      <span style={{fontSize:"0.72rem",color:"#7a90a4",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</span>
      <div style={{display:"flex",gap:"8px",width:"100%",alignItems:"center"}}>
        <input style={S.input} value={value||""} onChange={e=>onChange(e.target.value)}
          placeholder="Phone number" type="tel" />
        {digits && <a href={`tel:${digits}`} style={S.callBtn}>📞 Call</a>}
      </div>
    </div>
  );
}

function EditEmail({ label, value, onChange }) {
  return (
    <div className="detail-row" style={{alignItems:"flex-start",flexDirection:"column",gap:"4px"}}>
      <span style={{fontSize:"0.72rem",color:"#7a90a4",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</span>
      <div style={{display:"flex",gap:"8px",width:"100%",alignItems:"center"}}>
        <input style={S.input} value={value||""} onChange={e=>onChange(e.target.value)}
          placeholder="Email address" type="email" />
        {value && <a href={`mailto:${value}`} style={S.emailBtn}>✉ Email</a>}
      </div>
    </div>
  );
}

function EditText({ label, value, onChange, placeholder }) {
  return (
    <div className="detail-row" style={{alignItems:"flex-start",flexDirection:"column",gap:"4px"}}>
      <span style={{fontSize:"0.72rem",color:"#7a90a4",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</span>
      <input style={S.input} value={value||""} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder||label} />
    </div>
  );
}

function EditSelect({ label, value, onChange, options }) {
  return (
    <div className="detail-row" style={{alignItems:"flex-start",flexDirection:"column",gap:"4px"}}>
      <span style={{fontSize:"0.72rem",color:"#7a90a4",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</span>
      <select style={S.select} value={value||""} onChange={e=>onChange(e.target.value)}>
        {options.map(o=><option key={o} value={o}>{o||"— Select —"}</option>)}
      </select>
    </div>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong style={!value?{color:"#555"}:{}}>{value||"—"}</strong>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function Dashboard({ user }) {
  const [leads,          setLeads]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [filterCounty,   setFilterCounty]   = useState("All");
  const [filterStatus,   setFilterStatus]   = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedLead,   setSelectedLead]   = useState(null);
  const [edits,          setEdits]          = useState({});
  const [saving,         setSaving]         = useState(false);
  const [saveMsg,        setSaveMsg]        = useState("");
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
        const arr = Object.entries(data).map(([id,lead])=>({id,...lead}));
        arr.sort((a,b)=>(b.lead_score||0)-(a.lead_score||0));
        setLeads(arr);
        setCounties([...new Set(arr.map(l=>l.county).filter(Boolean))].sort());
        setCategories([...new Set(arr.map(l=>l.lead_category).filter(Boolean))].sort());
      } else { setLeads([]); }
    } catch(err) { console.error(err); }
    setLoading(false);
  };

  const getStatus = l => l.lead_status || l.status || "New";

  // ── Open lead — copy all fields into edits state ──────────────────
  const openLead = lead => {
    setSelectedLead(lead);
    setEdits({ ...lead }); // all fields are editable
    setSaveMsg("");
  };

  // ── Field change handler ──────────────────────────────────────────
  const set = field => value => setEdits(prev => ({ ...prev, [field]: value }));

  // ── Save all edits to Firebase ────────────────────────────────────
  const saveAll = async () => {
    if (!selectedLead) return;
    setSaving(true);
    setSaveMsg("");
    try {
      // Save each changed field to Firebase
      const updates = {};
      Object.keys(edits).forEach(k => {
        if (k !== "id") updates[k] = edits[k] ?? null;
      });
      await fetch(`${RTDB_URL}/leads/${selectedLead.id}.json`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      // Update local state
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? {...l,...edits} : l));
      setSelectedLead(prev => ({...prev,...edits}));
      setSaveMsg("✅ Saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch(err) {
      setSaveMsg("❌ Save failed");
      console.error(err);
    }
    setSaving(false);
  };

  const fmtCat = c => (c||"").replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    if (q && ![l.owner_name,l.property_address,l.county,l.contractor_name,
               l.contractor_phone,l.property_manager_phone,l.contractor_email,
               l.property_manager_email,l.lead_name,l.owner_phone2,
               l.contractor_phone2].join(" ").toLowerCase().includes(q)) return false;
    if (filterCounty   !== "All" && l.county        !== filterCounty)   return false;
    if (filterStatus   !== "All" && getStatus(l)    !== filterStatus)   return false;
    if (filterCategory !== "All" && l.lead_category !== filterCategory) return false;
    return true;
  });

  const stats = {
    total:     leads.length,
    new:       leads.filter(l=>getStatus(l)==="New").length,
    contacted: leads.filter(l=>getStatus(l)==="Contacted").length,
    won:       leads.filter(l=>getStatus(l)==="Won").length,
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
          <button className="logout-btn" onClick={()=>signOut(auth)}>Sign Out</button>
        </div>
      </header>

      <div className="stats-bar">
        {[["Total Leads",stats.total,"#fff"],["New",stats.new,STATUS_COLORS.New],
          ["Contacted",stats.contacted,STATUS_COLORS.Contacted],["Won",stats.won,STATUS_COLORS.Won]
        ].map(([lbl,val,col])=>(
          <div className="stat-card" key={lbl}>
            <span className="stat-number" style={{color:col}}>{val.toLocaleString()}</span>
            <span className="stat-label">{lbl}</span>
          </div>
        ))}
      </div>

      <div className="filters">
        <input className="search-input" type="search"
          placeholder="Search name, address, phone, email…"
          value={search} onChange={e=>setSearch(e.target.value)} />
        <select value={filterCounty} onChange={e=>setFilterCounty(e.target.value)}>
          <option value="All">All Counties</option>
          {counties.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map(c=><option key={c} value={c}>{fmtCat(c)}</option>)}
        </select>
        <button className="refresh-btn" onClick={fetchLeads}>↺ Refresh</button>
      </div>

      <div className="content">

        {/* ── Lead List ── */}
        <div className="leads-list">
          <div className="leads-count">{filtered.length.toLocaleString()} leads</div>
          {filtered.length === 0 ? (
            <div className="empty-state"><p>No leads match your filters.</p></div>
          ) : filtered.map(lead => {
            const phone  = lead.contractor_phone || lead.property_manager_phone || "";
            const status = getStatus(lead);
            return (
              <div key={lead.id}
                className={`lead-card ${selectedLead?.id===lead.id?"selected":""}`}
                onClick={()=>openLead(lead)}>
                <div className="lead-card-top">
                  <span className="lead-name">
                    {lead.lead_name||lead.owner_name||lead.contractor_name||"Unknown"}
                  </span>
                  <span className="status-badge" style={{backgroundColor:STATUS_COLORS[status]}}>
                    {status}
                  </span>
                </div>
                <div className="lead-address">{lead.property_address||"No address"}</div>
                <div className="lead-meta">
                  {lead.county && <span>{lead.county} County</span>}
                  {lead.permit_date  && <span>• {lead.permit_date}</span>}
                  {lead.lead_score   && <span>• Score: {lead.lead_score}/10</span>}
                  {lead.estimated_value && <span>• ${Number(lead.estimated_value).toLocaleString()}</span>}
                </div>
                {phone && (
                  <div style={{marginTop:"7px"}} onClick={e=>e.stopPropagation()}>
                    <a href={`tel:${phone.replace(/\D/g,"")}`} style={S.callBtn}>📞 Call</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Lead Detail — fully editable ── */}
        {selectedLead && (
          <div className="lead-detail">
            <div className="detail-header">
              <h2>{edits.lead_name||edits.owner_name||edits.contractor_name||"Unknown"}</h2>
              <button className="close-btn" onClick={()=>setSelectedLead(null)}>✕</button>
            </div>

            {/* Save Bar */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px",
              padding:"10px 14px",background:"#1a2a3a",borderRadius:"8px"}}>
              <button style={S.saveBtn} onClick={saveAll} disabled={saving}>
                {saving?"Saving…":"💾 Save All Changes"}
              </button>
              {saveMsg && <span style={{color:saveMsg.startsWith("✅")?"#27AE60":"#ef4444",fontWeight:700}}>{saveMsg}</span>}
            </div>

            {/* Pitch */}
            {selectedLead.suggested_flooring_pitch && (
              <div style={{background:"rgba(39,174,96,0.12)",borderLeft:"3px solid #27AE60",
                borderRadius:"0 6px 6px 0",padding:"10px 14px",fontSize:"0.83rem",
                color:"#A8E6C0",marginBottom:"14px",lineHeight:1.5}}>
                💬 <strong>Pitch:</strong> {selectedLead.suggested_flooring_pitch}
              </div>
            )}

            {/* Status */}
            <div className="detail-section">
              <h3>Status</h3>
              <div className="status-buttons">
                {STATUS_OPTIONS.map(s=>(
                  <button key={s}
                    className={`status-btn ${edits.lead_status===s?"active":""}`}
                    style={edits.lead_status===s?{backgroundColor:STATUS_COLORS[s],color:"#fff"}:{}}
                    onClick={()=>set("lead_status")(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Owner */}
            <div className="detail-section">
              <h3>Owner / Property Contact</h3>
              <EditText  label="Owner Name"      value={edits.owner_name}             onChange={set("owner_name")} />
              <EditText  label="Mailing Address" value={edits.owner_mailing_address}  onChange={set("owner_mailing_address")} />
              <EditText  label="City"            value={edits.city}                   onChange={set("city")} />
              <EditText  label="State"           value={edits.state}                  onChange={set("state")} />
              <EditText  label="Zip"             value={edits.zip}                    onChange={set("zip")} />
              <EditPhone label="Phone"           value={edits.property_manager_phone} onChange={set("property_manager_phone")} />
              <EditEmail label="Email"           value={edits.property_manager_email} onChange={set("property_manager_email")} />
              <EditText  label="Property Address" value={edits.property_address}      onChange={set("property_address")} />
              <EditText  label="County"          value={edits.county}                 onChange={set("county")} />
            </div>

            {/* Owner 2nd contact */}
            <div className="detail-section">
              <div style={S.divider}>
                <span style={S.subLabel}>Second Contact — Owner Side</span>
                <EditText   label="Contact Name"  value={edits.owner_contact2_name}  onChange={set("owner_contact2_name")} />
                <EditSelect label="Contact Title" value={edits.owner_contact2_title} onChange={set("owner_contact2_title")} options={CONTACT_TITLES} />
                <EditPhone  label="Phone"         value={edits.owner_phone2}          onChange={set("owner_phone2")} />
                <EditEmail  label="Email"         value={edits.owner_email2}          onChange={set("owner_email2")} />
              </div>
            </div>

            {/* Contractor */}
            <div className="detail-section">
              <h3>Contractor / Builder</h3>
              <EditText  label="Contractor Name"   value={edits.contractor_name}    onChange={set("contractor_name")} />
              <EditText  label="Business Address"  value={edits.contractor_address} onChange={set("contractor_address")} />
              <EditText  label="City"              value={edits.contractor_city}    onChange={set("contractor_city")} />
              <EditText  label="State"             value={edits.contractor_state}   onChange={set("contractor_state")} />
              <EditText  label="Zip"               value={edits.contractor_zip}     onChange={set("contractor_zip")} />
              <EditPhone label="Phone"             value={edits.contractor_phone}   onChange={set("contractor_phone")} />
              <EditEmail label="Email"             value={edits.contractor_email}   onChange={set("contractor_email")} />
            </div>

            {/* Contractor 2nd contact */}
            <div className="detail-section">
              <div style={S.divider}>
                <span style={S.subLabel}>Second Contact — Contractor Side</span>
                <EditText   label="Contact Name"  value={edits.contractor_contact2_name}  onChange={set("contractor_contact2_name")} />
                <EditSelect label="Contact Title" value={edits.contractor_contact2_title} onChange={set("contractor_contact2_title")} options={CONTACT_TITLES} />
                <EditPhone  label="Phone"         value={edits.contractor_phone2}          onChange={set("contractor_phone2")} />
                <EditEmail  label="Email"         value={edits.contractor_email2}          onChange={set("contractor_email2")} />
              </div>
            </div>

            {/* Permit — read only */}
            <div className="detail-section">
              <h3>Permit Details</h3>
              <ReadOnly label="Category"    value={fmtCat(selectedLead.lead_category)} />
              <ReadOnly label="Permit #"    value={selectedLead.permit_number} />
              <ReadOnly label="Date"        value={selectedLead.permit_date} />
              <ReadOnly label="Type"        value={selectedLead.permit_type} />
              <ReadOnly label="Est. Value"  value={selectedLead.estimated_value?"$"+Number(selectedLead.estimated_value).toLocaleString():""} />
              <ReadOnly label="Lead Score"  value={selectedLead.lead_score?selectedLead.lead_score+"/10":""} />
              <ReadOnly label="Source"      value={selectedLead.source_name} />
              <ReadOnly label="Opportunity" value={selectedLead.opportunity_reason} />
            </div>

            {/* Notes */}
            <div className="detail-section">
              <h3>Notes</h3>
              <textarea className="notes-input" value={edits.notes||""} rows={5}
                onChange={e=>set("notes")(e.target.value)}
                placeholder="Add notes about this lead…" />
            </div>

            {/* Save again at bottom */}
            <div style={{padding:"10px 0 20px",display:"flex",alignItems:"center",gap:"12px"}}>
              <button style={S.saveBtn} onClick={saveAll} disabled={saving}>
                {saving?"Saving…":"💾 Save All Changes"}
              </button>
              {saveMsg && <span style={{color:saveMsg.startsWith("✅")?"#27AE60":"#ef4444",fontWeight:700}}>{saveMsg}</span>}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
