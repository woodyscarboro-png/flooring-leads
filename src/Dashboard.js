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
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Calendar Picker ──────────────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const parseVal = (v) => {
    if (!v) return new Date();
    const d = new Date(v + "T00:00:00");
    return isNaN(d) ? new Date() : d;
  };

  const [yr, setYr] = useState(() => parseVal(value).getFullYear());
  const [mo, setMo] = useState(() => parseVal(value).getMonth());
  const selected = parseVal(value);
  selected.setHours(0,0,0,0);

  const prevMonth = () => { if (mo === 0) { setMo(11); setYr(y=>y-1); } else setMo(m=>m-1); };
  const nextMonth = () => { if (mo === 11) { setMo(0); setYr(y=>y+1); } else setMo(m=>m+1); };

  const firstDOW = new Date(yr, mo, 1).getDay();
  const daysInMo = new Date(yr, mo+1, 0).getDate();
  const cells = Array(firstDOW).fill(null);
  for (let d=1; d<=daysInMo; d++) cells.push(d);

  const pick = (day) => {
    const d = new Date(yr, mo, day);
    const iso = d.toISOString().split("T")[0];
    onChange(iso);
    onClose();
  };

  const goToday = () => {
    const t = new Date();
    setYr(t.getFullYear());
    setMo(t.getMonth());
    pick(t.getDate());
  };

  return (
    <div style={{
      position:"absolute", zIndex:9999, top:"100%", left:0,
      background:"#162330", border:"1px solid #1E3448",
      borderRadius:10, padding:12, width:280,
      boxShadow:"0 8px 32px rgba(0,0,0,0.6)"
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={()=>setYr(y=>y-1)} style={nb}>{"<<"}</button>
        <button onClick={prevMonth} style={nb}>{"<"}</button>
        <span style={{color:"#F4A826",fontWeight:"bold",fontSize:13}}>
          {MONTHS[mo]} {yr}
        </span>
        <button onClick={nextMonth} style={nb}>{">"}</button>
        <button onClick={()=>setYr(y=>y+1)} style={nb}>{">>"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DOW.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,color:"#7A90A4",fontWeight:"bold"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((day,i) => {
          if (!day) return <div key={i} />;
          const thisD = new Date(yr, mo, day);
          thisD.setHours(0,0,0,0);
          const isSel = thisD.getTime() === selected.getTime();
          const isTod = thisD.getTime() === today.getTime();
          return (
            <button key={i} onClick={()=>pick(day)} style={{
              background: isSel?"#F4A826":isTod?"#2ECC71":"#1A3A52",
              color: (isSel||isTod)?"#000":"#E8EDF2",
              border:"none", borderRadius:4, padding:"5px 0",
              cursor:"pointer", fontSize:12,
              fontWeight: isSel?"bold":"normal"
            }}>{day}</button>
          );
        })}
      </div>
      <div style={{marginTop:8,textAlign:"center"}}>
        <button onClick={goToday} style={{...nb,padding:"4px 16px",borderRadius:6}}>Today</button>
      </div>
    </div>
  );
}

const nb = {
  background:"#1A3A52",color:"#E8EDF2",border:"none",
  borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:12
};

// ─── Lead Popup Modal ─────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onSave }) {
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
  const [savedOk, setSavedOk] = useState(false);

  // Follow-up state
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("9:00 AM");
  const [fuType, setFuType] = useState("Phone Call");
  const [fuStatus, setFuStatus] = useState("Scheduled");
  const [fuNotes, setFuNotes] = useState("");
  const [showCal, setShowCal] = useState(false);
  const [followups, setFollowups] = useState([]);
  const [loadingFu, setLoadingFu] = useState(false);

  useEffect(() => {
    if (tab === "followup") loadFu();
  }, [tab]);

  const loadFu = async () => {
    setLoadingFu(true);
    try {
      const r = await fetch(`${RTDB_URL}/followups/${lead.id}.json`);
      const d = await r.json();
      if (d) {
        const arr = Object.entries(d).map(([id,f])=>({id,...f}));
        arr.sort((a,b)=>a.date>b.date?1:-1);
        setFollowups(arr);
      } else { setFollowups([]); }
    } catch(e) { setFollowups([]); }
    setLoadingFu(false);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await fetch(`${RTDB_URL}/leads/${lead.id}.json`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...fields, notes, status})
      });
      onSave({...lead,...fields,notes,status});
      setSavedOk(true);
      setTimeout(()=>setSavedOk(false),2500);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const addTS = () => {
    const ts = new Date().toLocaleString("en-US",{
      month:"long",day:"numeric",year:"numeric",
      hour:"numeric",minute:"2-digit",hour12:true
    });
    setNotes(n => n + `\n\n--- ${ts} ---\n`);
  };

  const saveFu = async () => {
    if (!fuDate) { alert("Please select a date."); return; }
    await fetch(`${RTDB_URL}/followups/${lead.id}.json`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        date:fuDate,time:fuTime,type:fuType,
        status:fuStatus,notes:fuNotes,
        created:new Date().toISOString()
      })
    });
    setFuDate(""); setFuNotes(""); setFuStatus("Scheduled");
    loadFu();
  };

  const updateFuStatus = async (fid, s) => {
    await fetch(`${RTDB_URL}/followups/${lead.id}/${fid}/status.json`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body:JSON.stringify(s)
    });
    loadFu();
  };

  const deleteFu = async (fid) => {
    if (!window.confirm("Delete this follow-up?")) return;
    await fetch(`${RTDB_URL}/followups/${lead.id}/${fid}.json`,{method:"DELETE"});
    loadFu();
  };

  const mapIt = (addr) => {
    if (addr && addr.trim()) window.open("https://www.google.com/maps/search/"+encodeURIComponent(addr),"_blank");
  };

  const inp = {
    width:"100%",padding:"7px 10px",background:"#162330",
    border:"1.5px solid #1E3448",borderRadius:6,
    color:"#E8EDF2",fontSize:13,outline:"none",boxSizing:"border-box"
  };
  const lbl = {
    fontSize:11,color:"#7A90A4",fontWeight:"bold",
    textTransform:"uppercase",letterSpacing:"0.05em",
    display:"block",marginBottom:3
  };
  const tabBtn = (t,label) => (
    <button key={t} onClick={()=>setTab(t)} style={{
      padding:"8px 18px",cursor:"pointer",border:"none",
      background:tab===t?"#F4A826":"#1A3A52",
      color:tab===t?"#000":"#E8EDF2",
      fontWeight:tab===t?"bold":"normal",
      fontSize:13,borderRadius:"6px 6px 0 0",marginRight:4
    }}>{label}</button>
  );

  const fld = (label, key, opts={}) => (
    <div style={{marginBottom:10,...(opts.style||{})}}>
      <label style={lbl}>{label}</label>
      <input style={inp} value={fields[key]}
        onChange={e=>setFields(f=>({...f,[key]:e.target.value}))} />
    </div>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
      zIndex:1000,display:"flex",alignItems:"center",
      justifyContent:"center",padding:16
    }}>
      <div style={{
        background:"#0F1923",borderRadius:12,width:"100%",maxWidth:800,
        maxHeight:"92vh",display:"flex",flexDirection:"column",
        border:"1px solid #1E3448",boxShadow:"0 20px 60px rgba(0,0,0,0.7)"
      }}>
        {/* Header */}
        <div style={{
          background:"#0D1820",padding:"14px 20px",
          borderRadius:"12px 12px 0 0",
          display:"flex",alignItems:"center",justifyContent:"space-between"
        }}>
          <div>
            <div style={{color:"#F4A826",fontWeight:"bold",fontSize:16}}>
              {lead.owner_name || lead.contractor_name || "Unknown"}
            </div>
            <div style={{color:"#7A90A4",fontSize:12,marginTop:2}}>
              {lead.property_address} &nbsp;|&nbsp; {lead.county} County &nbsp;|&nbsp; Score: {lead.lead_score}/10
            </div>
          </div>
          <button onClick={onClose} style={{
            background:"none",border:"none",color:"#7A90A4",
            fontSize:22,cursor:"pointer",padding:"0 4px"
          }}>✕</button>
        </div>

        {/* Tab bar + status */}
        <div style={{
          padding:"10px 16px 0",background:"#0D1820",
          borderBottom:"1px solid #1E3448",
          display:"flex",alignItems:"center",flexWrap:"wrap",gap:4
        }}>
          {[["info","Edit Info"],["notes","Notes"],["followup","Follow-Ups"],["map","Map"]].map(([t,l])=>tabBtn(t,l))}
          <div style={{marginLeft:"auto",display:"flex",gap:6,paddingBottom:8}}>
            {STATUS_OPTIONS.map(s=>(
              <button key={s} onClick={()=>setStatus(s)} style={{
                padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",
                fontSize:11,fontWeight:"bold",
                background:status===s?STATUS_COLORS[s]:"#1A3A52",
                color:status===s?"#fff":"#7A90A4"
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>

          {/* INFO TAB */}
          {tab==="info" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:11,
                textTransform:"uppercase",marginBottom:12}}>Owner / Property Contact</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
                {fld("Owner Name","owner_name")}
                {fld("Phone Number","owner_phone")}
                {fld("Email Address","owner_email")}
                {fld("Mailing Address","owner_mailing_address")}
                {fld("City","city")}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {fld("State","state")}
                  {fld("Zip","zip")}
                </div>
              </div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:11,
                textTransform:"uppercase",margin:"14px 0 12px"}}>Contractor / Builder</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
                {fld("Contractor Name","contractor_name")}
                {fld("Phone Number","contractor_phone")}
                {fld("Email Address","contractor_email")}
                {fld("Business Address","contractor_address")}
                {fld("Property Address","property_address")}
              </div>
              <button onClick={saveAll} disabled={saving} style={{
                marginTop:8,background:savedOk?"#2ECC71":"#F4A826",
                color:"#000",border:"none",borderRadius:8,
                padding:"9px 28px",fontWeight:"bold",cursor:"pointer",fontSize:14
              }}>{saving?"Saving...":savedOk?"Saved!":"Save Contact Info"}</button>
            </div>
          )}

          {/* NOTES TAB */}
          {tab==="notes" && (
            <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",marginBottom:10}}>
                <span style={{color:"#7A90A4",fontSize:12}}>Timestamped running notes log</span>
                <button onClick={addTS} style={{
                  background:"#1A3A52",color:"#E8EDF2",border:"none",
                  borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12
                }}>+ Add Timestamp</button>
              </div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                placeholder="Type notes here. Use Add Timestamp to log dated entries..."
                style={{
                  width:"100%",minHeight:320,background:"#162330",
                  color:"#E8EDF2",border:"1.5px solid #1E3448",
                  borderRadius:8,padding:12,fontSize:13,resize:"vertical",
                  fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"
                }} />
              <button onClick={saveAll} disabled={saving} style={{
                marginTop:10,background:savedOk?"#2ECC71":"#F4A826",
                color:"#000",border:"none",borderRadius:8,
                padding:"9px 28px",fontWeight:"bold",cursor:"pointer",
                fontSize:14,alignSelf:"flex-start"
              }}>{saving?"Saving...":savedOk?"Saved!":"Save Notes"}</button>
            </div>
          )}

          {/* FOLLOW-UPS TAB */}
          {tab==="followup" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:11,
                textTransform:"uppercase",marginBottom:12}}>Schedule a Follow-Up</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px",marginBottom:10}}>
                {/* Date */}
                <div style={{position:"relative"}}>
                  <label style={lbl}>Date</label>
                  <div style={{display:"flex",gap:8}}>
                    <input readOnly value={fuDate} placeholder="Click to pick a date"
                      onClick={()=>setShowCal(c=>!c)}
                      style={{...inp,cursor:"pointer",flex:1}} />
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
                  <label style={lbl}>Time</label>
                  <select value={fuTime} onChange={e=>setFuTime(e.target.value)} style={{...inp,cursor:"pointer"}}>
                    {["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM",
                      "1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"]
                      .map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {/* Type */}
                <div>
                  <label style={lbl}>Type</label>
                  <select value={fuType} onChange={e=>setFuType(e.target.value)} style={{...inp,cursor:"pointer"}}>
                    {["Phone Call","Email","In-Person Visit","Text Message","Left Voicemail"]
                      .map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {/* Status */}
                <div>
                  <label style={lbl}>Status</label>
                  <select value={fuStatus} onChange={e=>setFuStatus(e.target.value)} style={{...inp,cursor:"pointer"}}>
                    {["Scheduled","Completed","Cancelled","No Answer","Left Voicemail"]
                      .map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lbl}>Notes for this Follow-Up</label>
                <textarea value={fuNotes} onChange={e=>setFuNotes(e.target.value)}
                  style={{...inp,height:90,resize:"vertical",fontFamily:"inherit"}}
                  placeholder="What to discuss, what was said..." />
              </div>
              <button onClick={saveFu} style={{
                background:"#F4A826",color:"#000",border:"none",
                borderRadius:8,padding:"9px 28px",fontWeight:"bold",
                cursor:"pointer",fontSize:14,marginBottom:20
              }}>Save Follow-Up</button>

              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:11,
                textTransform:"uppercase",marginBottom:10}}>Follow-Up History</div>
              {loadingFu && <div style={{color:"#7A90A4"}}>Loading...</div>}
              {!loadingFu && followups.length===0 && (
                <div style={{color:"#7A90A4",fontSize:13}}>No follow-ups yet.</div>
              )}
              {followups.map(f=>(
                <div key={f.id} style={{
                  background:"#162330",borderRadius:8,padding:12,
                  marginBottom:8,border:"1px solid #1E3448"
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:6}}>
                    <div>
                      <span style={{color:"#F4A826",fontWeight:"bold",fontSize:13}}>
                        {f.date} at {f.time}
                      </span>
                      <span style={{color:"#7A90A4",fontSize:12,marginLeft:10}}>{f.type}</span>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{
                        background:STATUS_COLORS[f.status]||"#3b82f6",
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
                        cursor:"pointer",fontSize:16,padding:"0 2px"
                      }}>✕</button>
                    </div>
                  </div>
                  {f.notes && <div style={{color:"#E8EDF2",fontSize:12,marginTop:4}}>{f.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* MAP TAB */}
          {tab==="map" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:11,
                textTransform:"uppercase",marginBottom:16}}>Map Addresses</div>
              {[
                ["Property Address", fields.property_address],
                ["Owner Mailing Address",
                  [fields.owner_mailing_address, fields.city, fields.state, fields.zip]
                    .filter(Boolean).join(" ")],
                ["Contractor Business Address", fields.contractor_address],
              ].filter(([,addr])=>addr&&addr.trim()).map(([label,addr])=>(
                <div key={label} style={{
                  background:"#162330",borderRadius:8,padding:14,
                  marginBottom:12,border:"1px solid #1E3448",
                  display:"flex",justifyContent:"space-between",alignItems:"center"
                }}>
                  <div>
                    <div style={{color:"#7A90A4",fontSize:11,marginBottom:4}}>{label}</div>
                    <div style={{color:"#E8EDF2",fontSize:13}}>{addr}</div>
                  </div>
                  <button onClick={()=>mapIt(addr)} style={{
                    background:"#F4A826",color:"#000",border:"none",
                    borderRadius:8,padding:"8px 18px",cursor:"pointer",
                    fontWeight:"bold",fontSize:13,marginLeft:12,whiteSpace:"nowrap"
                  }}>Open in Maps</button>
                </div>
              ))}
              {!fields.property_address && !fields.owner_mailing_address && !fields.contractor_address && (
                <div style={{color:"#7A90A4"}}>No addresses available.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
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

  const handleSave = (updated) => {
    setLeads(prev=>prev.map(l=>l.id===updated.id?updated:l));
    setSelectedLead(updated);
  };

  const filtered = leads.filter(l=>{
    const q=search.toLowerCase();
    return (!q||
      (l.owner_name||"").toLowerCase().includes(q)||
      (l.property_address||"").toLowerCase().includes(q)||
      (l.county||"").toLowerCase().includes(q)||
      (l.contractor_name||"").toLowerCase().includes(q)) &&
      (filterCounty==="All"||l.county===filterCounty) &&
      (filterStatus==="All"||(l.status||"New")===filterStatus);
  });

  const stats = {
    total:leads.length,
    new:leads.filter(l=>!l.status||l.status==="New").length,
    contacted:leads.filter(l=>l.status==="Contacted").length,
    won:leads.filter(l=>l.status==="Won").length,
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
        <div className="stat-card">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Leads</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" style={{color:STATUS_COLORS.New}}>{stats.new}</span>
          <span className="stat-label">New</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" style={{color:STATUS_COLORS.Contacted}}>{stats.contacted}</span>
          <span className="stat-label">Contacted</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" style={{color:STATUS_COLORS.Won}}>{stats.won}</span>
          <span className="stat-label">Won</span>
        </div>
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
              className={`lead-card${selectedLead&&selectedLead.id===lead.id?" selected":""}`}
              onClick={()=>setSelectedLead(lead)}
              style={{cursor:"pointer"}}
            >
              <div className="lead-card-top">
                <span className="lead-name">{lead.owner_name||lead.contractor_name||"Unknown"}</span>
                <span className="status-badge"
                  style={{backgroundColor:STATUS_COLORS[lead.status||"New"]}}>
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
        <div style={{flex:1,display:"flex",alignItems:"center",
          justifyContent:"center",color:"#7A90A4",fontSize:14}}>
          Click any lead to view details, edit info, schedule follow-ups, and map addresses.
        </div>
      </div>

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={()=>setSelectedLead(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default Dashboard;
