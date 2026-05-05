import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const RTDB_URL = "https://kqf-lead-generation-default-rtdb.firebaseio.com";

const STATUS_OPTIONS = ["New", "Contacted", "Quoted", "Won", "Lost"];
const STATUS_COLORS = {
  New: "#3b82f6", Contacted: "#f59e0b", Quoted: "#8b5cf6",
  Won: "#10b981", Lost: "#ef4444",
};

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Calendar Picker ──────────────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose }) {
  const parseDate = (str) => {
    if (str) { const d = new Date(str + "T00:00:00"); if (!isNaN(d)) return d; }
    return new Date();
  };
  const [viewing, setViewing] = useState(() => {
    const d = parseDate(value);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const selected = parseDate(value);
  const today = new Date();
  today.setHours(0,0,0,0);

  const shiftMonth = (delta) => {
    setViewing(v => {
      let m = v.month + delta, y = v.year;
      if (m > 11) { m = 0; y++; }
      if (m < 0)  { m = 11; y--; }
      return { year: y, month: m };
    });
  };
  const shiftYear = (delta) => setViewing(v => ({ ...v, year: v.year + delta }));

  const firstDay = new Date(viewing.year, viewing.month, 1).getDay();
  const daysInMonth = new Date(viewing.year, viewing.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (day) => {
    const d = new Date(viewing.year, viewing.month, day);
    const str = d.toISOString().split("T")[0];
    onChange(str);
    onClose();
  };

  return (
    <div style={{
      position:"absolute", zIndex:1000, background:"#162330",
      border:"1px solid #1E3448", borderRadius:10, padding:12,
      boxShadow:"0 8px 32px rgba(0,0,0,0.5)", width:280, top:"100%", left:0
    }}>
      {/* Nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={()=>shiftYear(-1)} style={navBtn}>{"<<"}</button>
        <button onClick={()=>shiftMonth(-1)} style={navBtn}>{"<"}</button>
        <span style={{color:"#F4A826",fontWeight:"bold",fontSize:14}}>
          {MONTHS[viewing.month]} {viewing.year}
        </span>
        <button onClick={()=>shiftMonth(1)} style={navBtn}>{">"}</button>
        <button onClick={()=>shiftYear(1)} style={navBtn}>{">>"}</button>
      </div>
      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DAYS_OF_WEEK.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,color:"#7A90A4",fontWeight:"bold"}}>{d}</div>
        ))}
      </div>
      {/* Day grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((day,i)=>{
          if (!day) return <div key={i}/>;
          const thisDate = new Date(viewing.year, viewing.month, day);
          thisDate.setHours(0,0,0,0);
          const isSel = selected && thisDate.getTime()===selected.getTime();
          const isToday = thisDate.getTime()===today.getTime();
          return (
            <button key={i} onClick={()=>pick(day)} style={{
              background: isSel?"#F4A826": isToday?"#2ECC71":"#1A3A52",
              color: (isSel||isToday)?"#000":"#E8EDF2",
              border:"none", borderRadius:4, padding:"5px 0",
              cursor:"pointer", fontWeight: isSel?"bold":"normal", fontSize:12
            }}>{day}</button>
          );
        })}
      </div>
      {/* Today button */}
      <div style={{marginTop:8,textAlign:"center"}}>
        <button onClick={()=>{
          const t=new Date(); setViewing({year:t.getFullYear(),month:t.getMonth()});
          pick(t.getDate());
        }} style={{...navBtn,padding:"4px 16px",borderRadius:6}}>Today</button>
      </div>
    </div>
  );
}

const navBtn = {
  background:"#1A3A52", color:"#E8EDF2", border:"none",
  borderRadius:4, padding:"3px 7px", cursor:"pointer", fontSize:12
};

// ── Lead Detail Modal ─────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onUpdate }) {
  const [tab, setTab] = useState("info");
  const [fields, setFields] = useState({
    owner_name:            lead.owner_name || "",
    owner_mailing_address: lead.owner_mailing_address || "",
    city:                  lead.city || "",
    state:                 lead.state || "NC",
    zip:                   lead.zip || "",
    owner_phone:           lead.owner_phone || lead.property_manager_phone || "",
    owner_email:           lead.owner_email || lead.property_manager_email || "",
    contractor_name:       lead.contractor_name || "",
    contractor_phone:      lead.contractor_phone || "",
    contractor_email:      lead.contractor_email || "",
    contractor_address:    lead.contractor_address || "",
    property_address:      lead.property_address || "",
  });
  const [notes, setNotes] = useState(lead.notes || "");
  const [status, setStatus] = useState(lead.status || "New");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Follow-up state
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("9:00 AM");
  const [fuType, setFuType] = useState("Phone Call");
  const [fuNotes, setFuNotes] = useState("");
  const [fuStatus, setFuStatus] = useState("Scheduled");
  const [followups, setFollowups] = useState([]);
  const [showCal, setShowCal] = useState(false);
  const [loadingFu, setLoadingFu] = useState(false);

  useEffect(() => { if (tab === "followup") loadFollowups(); }, [tab]);

  const loadFollowups = async () => {
    setLoadingFu(true);
    try {
      const resp = await fetch(`${RTDB_URL}/followups/${lead.id}.json`);
      const data = await resp.json();
      if (data) {
        const arr = Object.entries(data).map(([id,f])=>({id,...f}));
        arr.sort((a,b)=>a.date>b.date?1:-1);
        setFollowups(arr);
      } else {
        setFollowups([]);
      }
    } catch(e) { setFollowups([]); }
    setLoadingFu(false);
  };

  const saveInfo = async () => {
    setSaving(true);
    try {
      await fetch(`${RTDB_URL}/leads/${lead.id}.json`, {
        method:"PATCH",
        body: JSON.stringify({...fields, notes, status})
      });
      onUpdate({...lead,...fields,notes,status});
      setSavedMsg("Saved!");
      setTimeout(()=>setSavedMsg(""),2000);
    } catch(e) { setSavedMsg("Error saving"); }
    setSaving(false);
  };

  const addTimestamp = () => {
    const ts = new Date().toLocaleString("en-US",{
      month:"long",day:"numeric",year:"numeric",
      hour:"numeric",minute:"2-digit",hour12:true
    });
    setNotes(n => n + `\n\n--- ${ts} ---\n`);
  };

  const saveFollowup = async () => {
    if (!fuDate) { alert("Please select a date."); return; }
    const entry = {
      date: fuDate, time: fuTime, type: fuType,
      status: fuStatus, notes: fuNotes,
      created: new Date().toISOString()
    };
    await fetch(`${RTDB_URL}/followups/${lead.id}.json`, {
      method:"POST", body: JSON.stringify(entry)
    });
    setFuDate(""); setFuNotes("");
    loadFollowups();
  };

  const updateFuStatus = async (fid, newStatus) => {
    await fetch(`${RTDB_URL}/followups/${lead.id}/${fid}/status.json`, {
      method:"PUT", body: JSON.stringify(newStatus)
    });
    loadFollowups();
  };

  const deleteFu = async (fid) => {
    if (!window.confirm("Delete this follow-up?")) return;
    await fetch(`${RTDB_URL}/followups/${lead.id}/${fid}.json`, { method:"DELETE" });
    loadFollowups();
  };

  const mapAddress = (addr) => {
    if (!addr) return;
    window.open("https://www.google.com/maps/search/" + encodeURIComponent(addr), "_blank");
  };

  const tabStyle = (t) => ({
    padding:"8px 16px", cursor:"pointer", border:"none",
    background: tab===t ? "#F4A826" : "#1A3A52",
    color: tab===t ? "#000" : "#E8EDF2",
    fontWeight: tab===t ? "bold" : "normal",
    fontSize:13, borderRadius:"6px 6px 0 0", marginRight:4
  });

  const inputStyle = {
    width:"100%", padding:"6px 10px", background:"#162330",
    border:"1.5px solid #1E3448", borderRadius:6,
    color:"#E8EDF2", fontSize:13, outline:"none",
    boxSizing:"border-box"
  };

  const labelStyle = {
    fontSize:11, color:"#7A90A4", fontWeight:"bold",
    textTransform:"uppercase", letterSpacing:"0.05em",
    display:"block", marginBottom:3
  };

  const fieldRow = (label, key, width="100%") => (
    <div style={{marginBottom:10, width}}>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} value={fields[key]}
        onChange={e=>setFields(f=>({...f,[key]:e.target.value}))} />
    </div>
  );

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
      zIndex:500, display:"flex", alignItems:"center", justifyContent:"center",
      padding:16
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        background:"#0F1923", borderRadius:12, width:"100%", maxWidth:780,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        border:"1px solid #1E3448", boxShadow:"0 20px 60px rgba(0,0,0,0.6)"
      }}>
        {/* Header */}
        <div style={{background:"#0D1820",padding:"14px 20px",borderRadius:"12px 12px 0 0",
                     display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{color:"#F4A826",fontWeight:"bold",fontSize:16}}>
              {lead.owner_name || lead.contractor_name || "Unknown"}
            </div>
            <div style={{color:"#7A90A4",fontSize:12,marginTop:2}}>
              {lead.property_address} &nbsp;|&nbsp; {lead.county} County &nbsp;|&nbsp; Score: {lead.lead_score}/10
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",
            color:"#7A90A4",fontSize:22,cursor:"pointer",padding:"0 4px"}}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{padding:"12px 16px 0",background:"#0D1820",borderBottom:"1px solid #1E3448"}}>
          {[["info","Edit Info"],["notes","Notes"],["followup","Follow-Ups"],["map","Map"]].map(([t,l])=>(
            <button key={t} style={tabStyle(t)} onClick={()=>setTab(t)}>{l}</button>
          ))}
          {/* Status */}
          <div style={{display:"inline-flex",gap:6,marginLeft:12}}>
            {STATUS_OPTIONS.map(s=>(
              <button key={s} onClick={()=>setStatus(s)} style={{
                padding:"4px 10px", borderRadius:20, border:"none", cursor:"pointer",
                fontSize:11, fontWeight:"bold",
                background: status===s ? STATUS_COLORS[s] : "#1A3A52",
                color: status===s ? "#fff" : "#7A90A4"
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>

          {/* INFO TAB */}
          {tab==="info" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:12,
                           textTransform:"uppercase",marginBottom:12}}>
                Owner / Property Contact
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {fieldRow("Owner Name","owner_name")}
                {fieldRow("Phone Number","owner_phone")}
                {fieldRow("Email Address","owner_email")}
                {fieldRow("Mailing Address","owner_mailing_address")}
                {fieldRow("City","city")}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {fieldRow("State","state")}
                  {fieldRow("Zip","zip")}
                </div>
              </div>

              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:12,
                           textTransform:"uppercase",margin:"16px 0 12px"}}>
                Contractor / Builder
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {fieldRow("Contractor Name","contractor_name")}
                {fieldRow("Phone Number","contractor_phone")}
                {fieldRow("Email Address","contractor_email")}
                {fieldRow("Business Address","contractor_address")}
                {fieldRow("Property Address","property_address")}
              </div>

              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button onClick={saveInfo} disabled={saving} style={{
                  background:"#2ECC71",color:"#000",border:"none",
                  borderRadius:8,padding:"9px 24px",fontWeight:"bold",
                  cursor:"pointer",fontSize:14
                }}>{saving?"Saving...":savedMsg||"Save Contact Info"}</button>
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {tab==="notes" && (
            <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
              <div style={{display:"flex",justifyContent:"space-between",
                           alignItems:"center",marginBottom:10}}>
                <span style={{color:"#7A90A4",fontSize:12}}>
                  Running notes log — timestamped entries
                </span>
                <button onClick={addTimestamp} style={{
                  background:"#1A3A52",color:"#E8EDF2",border:"none",
                  borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12
                }}>+ Add Timestamp</button>
              </div>
              <textarea
                value={notes}
                onChange={e=>setNotes(e.target.value)}
                style={{
                  width:"100%", flex:1, minHeight:340,
                  background:"#162330", color:"#E8EDF2",
                  border:"1.5px solid #1E3448", borderRadius:8,
                  padding:"12px", fontSize:13, resize:"vertical",
                  fontFamily:"inherit", lineHeight:1.6,
                  boxSizing:"border-box"
                }}
                placeholder="Type your notes here. Use the timestamp button to add dated entries..."
              />
              <button onClick={saveInfo} disabled={saving} style={{
                background:"#2ECC71",color:"#000",border:"none",
                borderRadius:8,padding:"9px 24px",fontWeight:"bold",
                cursor:"pointer",fontSize:14,marginTop:12,alignSelf:"flex-start"
              }}>{saving?"Saving...":savedMsg||"Save Notes"}</button>
            </div>
          )}

          {/* FOLLOW-UPS TAB */}
          {tab==="followup" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:12,
                           textTransform:"uppercase",marginBottom:12}}>
                Schedule a Follow-Up
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {/* Date picker */}
                <div style={{position:"relative"}}>
                  <label style={labelStyle}>Date</label>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input readOnly value={fuDate} placeholder="Select a date..."
                      style={{...inputStyle,cursor:"pointer",flex:1}}
                      onClick={()=>setShowCal(c=>!c)} />
                    <button onClick={()=>setShowCal(c=>!c)} style={{
                      background:"#F4A826",color:"#000",border:"none",
                      borderRadius:6,padding:"6px 12px",cursor:"pointer",
                      fontWeight:"bold",fontSize:12,whiteSpace:"nowrap"
                    }}>Pick Date</button>
                  </div>
                  {showCal && (
                    <CalendarPicker
                      value={fuDate}
                      onChange={v=>{setFuDate(v);setShowCal(false);}}
                      onClose={()=>setShowCal(false)}
                    />
                  )}
                </div>
                {/* Time */}
                <div>
                  <label style={labelStyle}>Time</label>
                  <select value={fuTime} onChange={e=>setFuTime(e.target.value)}
                    style={{...inputStyle,cursor:"pointer"}}>
                    {["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM",
                      "1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"
                    ].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {/* Type */}
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={fuType} onChange={e=>setFuType(e.target.value)}
                    style={{...inputStyle,cursor:"pointer"}}>
                    {["Phone Call","Email","In-Person Visit","Text Message","Left Voicemail"]
                      .map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {/* Status */}
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={fuStatus} onChange={e=>setFuStatus(e.target.value)}
                    style={{...inputStyle,cursor:"pointer"}}>
                    {["Scheduled","Completed","Cancelled","No Answer","Left Voicemail"]
                      .map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {/* Follow-up notes */}
              <div style={{marginBottom:12}}>
                <label style={labelStyle}>Notes for this Follow-Up</label>
                <textarea value={fuNotes} onChange={e=>setFuNotes(e.target.value)}
                  style={{...inputStyle,height:100,resize:"vertical",fontFamily:"inherit"}}
                  placeholder="What was discussed, next steps..." />
              </div>
              <button onClick={saveFollowup} style={{
                background:"#F4A826",color:"#000",border:"none",
                borderRadius:8,padding:"9px 24px",fontWeight:"bold",
                cursor:"pointer",fontSize:14,marginBottom:24
              }}>Save Follow-Up</button>

              {/* History */}
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:12,
                           textTransform:"uppercase",marginBottom:10}}>
                Follow-Up History
              </div>
              {loadingFu && <div style={{color:"#7A90A4"}}>Loading...</div>}
              {!loadingFu && followups.length===0 && (
                <div style={{color:"#7A90A4",fontSize:13}}>No follow-ups scheduled yet.</div>
              )}
              {followups.map(f=>(
                <div key={f.id} style={{
                  background:"#162330",borderRadius:8,padding:12,
                  marginBottom:10,border:"1px solid #1E3448"
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",
                               alignItems:"center",marginBottom:6}}>
                    <div>
                      <span style={{color:"#F4A826",fontWeight:"bold",fontSize:13}}>
                        {f.date} at {f.time}
                      </span>
                      <span style={{color:"#7A90A4",fontSize:12,marginLeft:10}}>
                        {f.type}
                      </span>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{
                        background: STATUS_COLORS[f.status]||"#3b82f6",
                        color:"#fff",borderRadius:20,padding:"2px 10px",
                        fontSize:11,fontWeight:"bold"
                      }}>{f.status}</span>
                      {["Completed","Cancelled","No Answer"].map(s=>(
                        <button key={s} onClick={()=>updateFuStatus(f.id,s)} style={{
                          background:"#1A3A52",color:"#E8EDF2",border:"none",
                          borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:10
                        }}>{s}</button>
                      ))}
                      <button onClick={()=>deleteFu(f.id)} style={{
                        background:"none",color:"#E74C3C",border:"none",
                        cursor:"pointer",fontSize:14,padding:"0 4px"
                      }}>✕</button>
                    </div>
                  </div>
                  {f.notes && <div style={{color:"#E8EDF2",fontSize:12}}>{f.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* MAP TAB */}
          {tab==="map" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:12,
                           textTransform:"uppercase",marginBottom:16}}>
                Map Addresses
              </div>
              {[
                ["Property Address", fields.property_address],
                ["Owner Mailing Address", fields.owner_mailing_address +
                  (fields.city?" "+fields.city:"") +
                  (fields.state?" "+fields.state:"") +
                  (fields.zip?" "+fields.zip:"")],
                ["Contractor Business Address", fields.contractor_address],
              ].map(([label,addr])=>(
                addr?.trim() ? (
                  <div key={label} style={{
                    background:"#162330",borderRadius:8,padding:14,
                    marginBottom:12,border:"1px solid #1E3448",
                    display:"flex",justifyContent:"space-between",alignItems:"center"
                  }}>
                    <div>
                      <div style={{color:"#7A90A4",fontSize:11,marginBottom:4}}>{label}</div>
                      <div style={{color:"#E8EDF2",fontSize:13}}>{addr}</div>
                    </div>
                    <button onClick={()=>mapAddress(addr)} style={{
                      background:"#F4A826",color:"#000",border:"none",
                      borderRadius:8,padding:"8px 18px",cursor:"pointer",
                      fontWeight:"bold",fontSize:13,whiteSpace:"nowrap",marginLeft:12
                    }}>Open in Maps</button>
                  </div>
                ) : null
              ))}
              {!fields.property_address && !fields.owner_mailing_address && !fields.contractor_address && (
                <div style={{color:"#7A90A4"}}>No addresses available for this lead.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ user }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCounty, setFilterCounty] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedLead, setSelectedLead] = useState(null);
  const [counties, setCounties] = useState([]);

  useEffect(() => { fetchLeads(); }, []);

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
      } else { setLeads([]); }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const handleLeadUpdate = (updated) => {
    setLeads(prev=>prev.map(l=>l.id===updated.id?updated:l));
    setSelectedLead(updated);
  };

  const filtered = leads.filter(l=>{
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (l.owner_name||"").toLowerCase().includes(q) ||
      (l.property_address||"").toLowerCase().includes(q) ||
      (l.county||"").toLowerCase().includes(q) ||
      (l.contractor_name||"").toLowerCase().includes(q);
    const matchCounty = filterCounty==="All" || l.county===filterCounty;
    const matchStatus = filterStatus==="All" || (l.status||"New")===filterStatus;
    return matchSearch && matchCounty && matchStatus;
  });

  const stats = {
    total: leads.length,
    new: leads.filter(l=>!l.status||l.status==="New").length,
    contacted: leads.filter(l=>l.status==="Contacted").length,
    won: leads.filter(l=>l.status==="Won").length,
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p>Loading leads...</p>
    </div>
  );

  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-left">
          <h1>KQF Discount Flooring</h1>
          <span className="header-subtitle">Lead Management</span>
        </div>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="logout-btn" onClick={()=>signOut(auth)}>Sign Out</button>
        </div>
      </header>

      <div className="stats-bar">
        {[["Total Leads",stats.total,"#E8EDF2"],["New",stats.new,STATUS_COLORS.New],
          ["Contacted",stats.contacted,STATUS_COLORS.Contacted],["Won",stats.won,STATUS_COLORS.Won]
        ].map(([label,val,color])=>(
          <div className="stat-card" key={label}>
            <span className="stat-number" style={{color}}>{val}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="filters">
        <input className="search-input" type="text"
          placeholder="Search by name, address, county..."
          value={search} onChange={e=>setSearch(e.target.value)} />
        <select value={filterCounty} onChange={e=>setFilterCounty(e.target.value)}>
          <option value="All">All Counties</option>
          {counties.map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
        </select>
        <button className="refresh-btn" onClick={fetchLeads}>Refresh</button>
      </div>

      <div className="content">
        <div className="leads-list">
          <div className="leads-count">{filtered.length} leads</div>
          {filtered.length===0 ? (
            <div className="empty-state">
              <p>No leads found. Run a search in your PC app to sync leads here.</p>
            </div>
          ) : filtered.map(lead=>(
            <div key={lead.id}
              className="lead-card"
              onClick={()=>setSelectedLead(lead)}
              style={{cursor:"pointer"}}
            >
              <div className="lead-card-top">
                <span className="lead-name">
                  {lead.owner_name||lead.contractor_name||"Unknown"}
                </span>
                <span className="status-badge"
                  style={{background:STATUS_COLORS[lead.status||"New"]}}>
                  {lead.status||"New"}
                </span>
              </div>
              <div className="lead-address">{lead.property_address||"No address"}</div>
              <div className="lead-meta">
                <span>{lead.county} County</span>
                {lead.permit_date&&<span>• {lead.permit_date}</span>}
                {lead.lead_score&&<span>• Score: {lead.lead_score}/10</span>}
                {lead.estimated_value&&<span>• ${Number(lead.estimated_value).toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Placeholder when nothing selected */}
        {!selectedLead && (
          <div style={{flex:1,display:"flex",alignItems:"center",
                       justifyContent:"center",color:"#7A90A4",fontSize:14}}>
            Click any lead to view details, edit info, schedule follow-ups, and map addresses.
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={()=>setSelectedLead(null)}
          onUpdate={handleLeadUpdate}
        />
      )}
    </div>
  );
}

export default Dashboard;

