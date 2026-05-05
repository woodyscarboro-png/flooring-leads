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
      background:"#ffffff", border:"1px solid #e2e8f0",
      borderRadius:10, padding:12, width:280,
      boxShadow:"0 8px 32px rgba(0,0,0,0.6)"
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={()=>setYr(y=>y-1)} style={nb}>{"<<"}</button>
        <button onClick={prevMonth} style={nb}>{"<"}</button>
        <span style={{color:"#1e3a5f",fontWeight:"bold",fontSize:13}}>
          {MONTHS[mo]} {yr}
        </span>
        <button onClick={nextMonth} style={nb}>{">"}</button>
        <button onClick={()=>setYr(y=>y+1)} style={nb}>{">>"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DOW.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,color:"#64748b",fontWeight:"bold"}}>{d}</div>
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
              background: isSel?"#1e3a5f":isTod?"#2ECC71":"#f1f5f9",
              color: (isSel||isTod)?"#fff":"#1e293b",
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
  background:"#e2e8f0",color:"#475569",border:"none",
  borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:12
};

// ─── Reports Modal ───────────────────────────────────────────────────────────
function ReportsModal({ leads, onClose }) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(false);
  const RTDB = "https://kqf-lead-generation-default-rtdb.firebaseio.com";

  const loadAllFollowups = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${RTDB}/followups.json`);
      const data = await resp.json();
      if (data) {
        const all = [];
        Object.entries(data).forEach(([leadId, fus]) => {
          const lead = leads.find(l => l.id === leadId) || {};
          Object.entries(fus).forEach(([fuId, fu]) => {
            all.push({ id: fuId, leadId, ...fu,
              owner_name: lead.owner_name || lead.contractor_name || "",
              owner_phone: lead.owner_phone || lead.contractor_phone || "",
              owner_email: lead.owner_email || "",
              property_address: lead.property_address || "",
              county: lead.county || "",
              contractor_name: lead.contractor_name || "",
              contractor_phone: lead.contractor_phone || "",
              lead_score: lead.lead_score || "",
              notes: lead.notes || "",
            });
          });
        });
        all.sort((a,b) => a.date > b.date ? 1 : -1);
        setFollowups(all);
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAllFollowups(); }, []);

  const today = new Date().toISOString().split("T")[0];
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split("T")[0]; })();
  const weekEnd = (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().split("T")[0]; })();
  const monthStart = today.slice(0,7) + "-01";
  const monthEnd = today.slice(0,7) + "-31";
  const filterFu = (start, end) => followups.filter(f => f.date >= start && f.date <= end);

  const reportOptions = [
    { id: "today",    label: "Today's Follow-Ups",      data: () => filterFu(today, today) },
    { id: "week",     label: "This Week's Follow-Ups",   data: () => filterFu(weekStart, weekEnd) },
    { id: "month",    label: "This Month's Follow-Ups",  data: () => filterFu(monthStart, monthEnd) },
    { id: "upcoming", label: "All Upcoming Follow-Ups",  data: () => followups.filter(f => f.date >= today) },
    { id: "all_fu",   label: "All Follow-Ups Ever",      data: () => followups },
    { id: "new",      label: "All New Leads",            data: () => leads.filter(l => !l.status || l.status === "New") },
    { id: "contacted",label: "All Contacted Leads",      data: () => leads.filter(l => l.status === "Contacted") },
    { id: "quoted",   label: "All Quoted Leads",         data: () => leads.filter(l => l.status === "Quoted") },
    { id: "won",      label: "All Won Leads",            data: () => leads.filter(l => l.status === "Won") },
    { id: "lost",     label: "All Lost Leads",           data: () => leads.filter(l => l.status === "Lost") },
  ];

  const printReport = (option) => {
    const data = option.data();
    if (!data || data.length === 0) { alert("No records found for this report."); return; }
    const isFollowup = ["today","week","month","upcoming","all_fu"].includes(option.id);
    const now = new Date().toLocaleString("en-US",{month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
    let rows = "";
    if (isFollowup) {
      rows = data.map(f => `
        <div class="card">
          <div class="card-header"><strong>${f.date} at ${f.time || ""}</strong> &nbsp;|&nbsp; ${f.type || ""} &nbsp;|&nbsp; <span class="status">${f.status || ""}</span></div>
          <table>
            <tr><td class="lbl">Owner</td><td>${f.owner_name || "—"}</td><td class="lbl">Phone</td><td>${f.owner_phone || "—"}</td></tr>
            <tr><td class="lbl">Email</td><td>${f.owner_email || "—"}</td><td class="lbl">Property</td><td>${f.property_address || "—"}</td></tr>
            <tr><td class="lbl">Contractor</td><td>${f.contractor_name || "—"}</td><td class="lbl">Contractor Ph</td><td>${f.contractor_phone || "—"}</td></tr>
            <tr><td class="lbl">County</td><td>${f.county || "—"}</td><td class="lbl">Score</td><td>${f.lead_score || "—"}/10</td></tr>
          </table>
          <div class="notes-label">Follow-Up Notes:</div><div class="notes">${f.notes || "(none)"}</div>
          <div class="notes-label">Lead Notes:</div><div class="notes">${f.notes || "(none)"}</div>
        </div>`).join("");
    } else {
      rows = data.map(l => `
        <div class="card">
          <div class="card-header"><strong>${l.owner_name || l.contractor_name || "Unknown"}</strong> &nbsp;|&nbsp; ${l.property_address || "—"} &nbsp;|&nbsp; ${l.county || ""} County &nbsp;|&nbsp; Score: ${l.lead_score || "?"}/10 &nbsp;|&nbsp; <span class="status">${l.status || "New"}</span></div>
          <table>
            <tr><td class="lbl">Owner Phone</td><td>${l.owner_phone || "—"}</td><td class="lbl">Owner Email</td><td>${l.owner_email || "—"}</td></tr>
            <tr><td class="lbl">Contractor</td><td>${l.contractor_name || "—"}</td><td class="lbl">Contractor Ph</td><td>${l.contractor_phone || "—"}</td></tr>
            <tr><td class="lbl">Permit #</td><td>${l.permit_number || "—"}</td><td class="lbl">Permit Date</td><td>${l.permit_date || "—"}</td></tr>
            <tr><td class="lbl">Est. Value</td><td>${l.estimated_value ? "$"+Number(l.estimated_value).toLocaleString() : "—"}</td><td class="lbl">Category</td><td>${(l.lead_category||"").replace(/_/g," ")}</td></tr>
          </table>
          <div class="notes-label">Notes:</div><div class="notes">${l.notes || "(none)"}</div>
        </div>`).join("");
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>KQF Discount Flooring — ${option.label}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111;}h1{font-size:16px;color:#1e3a5f;margin-bottom:4px;}.meta{color:#666;margin-bottom:16px;font-size:10px;}.card{border:1px solid #ccc;border-radius:6px;padding:12px;margin-bottom:14px;page-break-inside:avoid;}.card-header{background:#1e3a5f;color:#f4a826;padding:6px 10px;border-radius:4px;margin-bottom:10px;font-size:12px;}.status{font-weight:bold;color:#2ECC71;}table{width:100%;border-collapse:collapse;margin-bottom:6px;}td{padding:3px 6px;font-size:10px;}.lbl{color:#666;font-weight:bold;width:100px;}.notes-label{font-size:9px;font-weight:bold;color:#666;text-transform:uppercase;margin-top:6px;}.notes{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px;font-size:10px;margin-top:2px;white-space:pre-wrap;}@media print{.card{page-break-inside:avoid;}}</style></head>
<body><h1>KQF Discount Flooring — ${option.label}</h1><div class="meta">Printed: ${now} &nbsp;|&nbsp; ${data.length} record(s)</div>${rows}
<script>window.onload=function(){window.print();}<\/script></body></html>`;
    const blob = new Blob([html], {type:"text/html"});
    window.open(URL.createObjectURL(blob), "_blank");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:500,border:"1px solid #e2e8f0",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{background:"#f1f5f9",padding:"14px 20px",borderRadius:"12px 12px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"#1e3a5f",fontWeight:"bold",fontSize:16}}>Print Reports</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:20}}>
          {loading && <div style={{color:"#64748b",textAlign:"center",padding:20}}>Loading follow-up data...</div>}
          {!loading && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{color:"#64748b",fontSize:12,marginBottom:4,fontWeight:"bold",textTransform:"uppercase",letterSpacing:"0.05em"}}>Follow-Up Reports</div>
              {reportOptions.slice(0,5).map(opt=>(
                <button key={opt.id} onClick={()=>printReport(opt)} style={{background:"#f1f5f9",color:"#1e3a5f",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 16px",cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:"500"}}>{opt.label}</button>
              ))}
              <div style={{color:"#64748b",fontSize:12,marginTop:8,marginBottom:4,fontWeight:"bold",textTransform:"uppercase",letterSpacing:"0.05em"}}>Leads by Status</div>
              {reportOptions.slice(5).map(opt=>(
                <button key={opt.id} onClick={()=>printReport(opt)} style={{background:"#f1f5f9",color:"#1e3a5f",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 16px",cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:"500"}}>{opt.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Prospect Modal ───────────────────────────────────────────────────────
function AddProspectModal({ onClose, onAdd }) {
  const RTDB = "https://kqf-lead-generation-default-rtdb.firebaseio.com";
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({
    owner_name:"", owner_mailing_address:"", city:"", state:"NC", zip:"",
    owner_phone:"", owner_email:"", owner_fax:"",
    contractor_name:"", contractor_address:"", contractor_city:"",
    contractor_state:"NC", contractor_zip:"",
    contractor_phone:"", contractor_email:"", contractor_fax:"",
    property_address:"", county:"",
    notes:"", lead_category:"manual_entry", status:"New", lead_score:5
  });

  const save = async () => {
    if (!fields.owner_name && !fields.contractor_name && !fields.property_address) {
      alert("Please enter at least a name or address.");
      return;
    }
    setSaving(true);
    try {
      const entry = { ...fields, date_added: new Date().toISOString(), source_name: "Manual Entry" };
      const resp = await fetch(`${RTDB}/leads.json`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(entry)
      });
      const data = await resp.json();
      onAdd({ id: data.name, ...entry });
    } catch(e) { console.error(e); alert("Error saving. Please try again."); }
    setSaving(false);
  };

  const inp = {
    width:"100%",padding:"7px 10px",background:"#f8fafc",
    border:"1.5px solid #e2e8f0",borderRadius:6,
    color:"#1e293b",fontSize:13,outline:"none",boxSizing:"border-box"
  };
  const lbl = {
    fontSize:11,color:"#64748b",fontWeight:"bold",
    textTransform:"uppercase",letterSpacing:"0.05em",
    display:"block",marginBottom:3
  };

  return (
    // clicking outside does NOT close — must use Save or Cancel button
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",
      zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16
    }}>
      <div style={{
        background:"#fff",borderRadius:12,width:"100%",maxWidth:700,
        maxHeight:"90vh",display:"flex",flexDirection:"column",
        border:"1px solid #e2e8f0",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"
      }}>
        <div style={{background:"#f1f5f9",padding:"14px 20px",borderRadius:"12px 12px 0 0",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"#1e3a5f",fontWeight:"bold",fontSize:16}}>Add New Prospect</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{color:"#1e3a5f",fontWeight:"bold",fontSize:11,textTransform:"uppercase",marginBottom:12}}>Owner / Property Contact</div>
          <div>
            <div style={{marginBottom:10}}><label style={lbl}>Owner Name</label>
              <input style={inp} value={fields.owner_name} onChange={e=>setFields(f=>({...f,owner_name:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>Mailing Address</label>
              <input style={inp} value={fields.owner_mailing_address} onChange={e=>setFields(f=>({...f,owner_mailing_address:e.target.value}))} /></div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0 12px",marginBottom:10}}>
              <div><label style={lbl}>City</label><input style={inp} value={fields.city} onChange={e=>setFields(f=>({...f,city:e.target.value}))} /></div>
              <div><label style={lbl}>State</label><input style={inp} value={fields.state} onChange={e=>setFields(f=>({...f,state:e.target.value}))} /></div>
              <div><label style={lbl}>Zip</label><input style={inp} value={fields.zip} onChange={e=>setFields(f=>({...f,zip:e.target.value}))} /></div>
            </div>
            <div style={{marginBottom:10}}><label style={lbl}>Phone Number</label>
              <input style={inp} value={fields.owner_phone} onChange={e=>setFields(f=>({...f,owner_phone:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>Email Address</label>
              <input style={inp} value={fields.owner_email} onChange={e=>setFields(f=>({...f,owner_email:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>Fax</label>
              <input style={inp} value={fields.owner_fax} onChange={e=>setFields(f=>({...f,owner_fax:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>Property Address</label>
              <input style={inp} value={fields.property_address} onChange={e=>setFields(f=>({...f,property_address:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>County</label>
              <input style={inp} value={fields.county||""} onChange={e=>setFields(f=>({...f,county:e.target.value}))} /></div>
          </div>
          <div style={{color:"#1e3a5f",fontWeight:"bold",fontSize:11,textTransform:"uppercase",margin:"14px 0 12px"}}>Contractor / Builder</div>
          <div>
            <div style={{marginBottom:10}}><label style={lbl}>Contractor Name</label>
              <input style={inp} value={fields.contractor_name} onChange={e=>setFields(f=>({...f,contractor_name:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>Business Address</label>
              <input style={inp} value={fields.contractor_address} onChange={e=>setFields(f=>({...f,contractor_address:e.target.value}))} /></div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0 12px",marginBottom:10}}>
              <div><label style={lbl}>City</label><input style={inp} value={fields.contractor_city} onChange={e=>setFields(f=>({...f,contractor_city:e.target.value}))} /></div>
              <div><label style={lbl}>State</label><input style={inp} value={fields.contractor_state} onChange={e=>setFields(f=>({...f,contractor_state:e.target.value}))} /></div>
              <div><label style={lbl}>Zip</label><input style={inp} value={fields.contractor_zip} onChange={e=>setFields(f=>({...f,contractor_zip:e.target.value}))} /></div>
            </div>
            <div style={{marginBottom:10}}><label style={lbl}>Phone Number</label>
              <input style={inp} value={fields.contractor_phone} onChange={e=>setFields(f=>({...f,contractor_phone:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>Email Address</label>
              <input style={inp} value={fields.contractor_email} onChange={e=>setFields(f=>({...f,contractor_email:e.target.value}))} /></div>
            <div style={{marginBottom:10}}><label style={lbl}>Fax</label>
              <input style={inp} value={fields.contractor_fax} onChange={e=>setFields(f=>({...f,contractor_fax:e.target.value}))} /></div>
          </div>
          <div style={{color:"#1e3a5f",fontWeight:"bold",fontSize:11,textTransform:"uppercase",margin:"14px 0 12px"}}>Notes</div>
          <textarea value={fields.notes} onChange={e=>setFields(f=>({...f,notes:e.target.value}))}
            placeholder="Any notes about this prospect..."
            style={{...inp,height:100,resize:"vertical",fontFamily:"inherit",width:"100%",boxSizing:"border-box"}} />
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid #e2e8f0",display:"flex",gap:10}}>
          <button onClick={save} disabled={saving} style={{
            background:"#1e3a5f",color:"#fff",border:"none",borderRadius:8,
            padding:"9px 28px",fontWeight:"bold",cursor:"pointer",fontSize:14
          }}>{saving?"Saving...":"Save Prospect"}</button>
          <button onClick={onClose} style={{
            background:"#e2e8f0",color:"#475569",border:"none",
            borderRadius:8,padding:"9px 20px",cursor:"pointer",fontSize:14
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Popup Modal ─────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onSave, onDelete }) {
  const [tab, setTab] = useState("info");
  const [fields, setFields] = useState({
    owner_name:            lead.owner_name || "",
    owner_mailing_address: lead.owner_mailing_address || "",
    city:                  lead.city || "",
    state:                 lead.state || "NC",
    zip:                   lead.zip || "",
    owner_phone:           lead.owner_phone || lead.property_manager_phone || "",
    owner_email:           lead.owner_email || lead.property_manager_email || "",
    owner_fax:             lead.owner_fax || "",
    contractor_name:       lead.contractor_name || "",
    contractor_address:    lead.contractor_address || "",
    contractor_city:       lead.contractor_city || "",
    contractor_state:      lead.contractor_state || "NC",
    contractor_zip:        lead.contractor_zip || "",
    contractor_phone:      lead.contractor_phone || "",
    contractor_email:      lead.contractor_email || "",
    contractor_fax:        lead.contractor_fax || "",
    property_address:      lead.property_address || "",
    county:                lead.county || "",
  });
  const [notes, setNotes] = useState(lead.notes || "");
  const [status, setStatus] = useState(lead.status || "New");
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteLead = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await fetch(`${RTDB_URL}/leads/${lead.id}.json`, { method: "DELETE" });
      onDelete(lead.id);
      onClose();
    } catch(e) { console.error(e); }
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...fields, notes, status})
      });
      onSave({...lead,...fields,notes,status});
      setSavedOk(true);
      setTimeout(()=>setSavedOk(false),2500);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const addTS = () => {
    const ts = new Date().toLocaleString("en-US",{month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
    setNotes(n => n + `\n\n--- ${ts} ---\n`);
  };

  const saveFu = async () => {
    if (!fuDate) { alert("Please select a date."); return; }
    await fetch(`${RTDB_URL}/followups/${lead.id}.json`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({date:fuDate,time:fuTime,type:fuType,status:fuStatus,notes:fuNotes,created:new Date().toISOString()})
    });
    setFuDate(""); setFuNotes(""); setFuStatus("Scheduled");
    loadFu();
  };

  const updateFuStatus = async (fid, s) => {
    await fetch(`${RTDB_URL}/followups/${lead.id}/${fid}/status.json`, {
      method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(s)
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
    width:"100%",padding:"7px 10px",background:"#f8fafc",
    border:"1.5px solid #e2e8f0",borderRadius:6,
    color:"#1e293b",fontSize:13,outline:"none",boxSizing:"border-box"
  };
  const lbl = {
    fontSize:11,color:"#64748b",fontWeight:"bold",
    textTransform:"uppercase",letterSpacing:"0.05em",
    display:"block",marginBottom:3
  };
  const tabBtn = (t,label) => (
    <button key={t} onClick={()=>setTab(t)} style={{
      padding:"8px 18px",cursor:"pointer",border:"none",
      background:tab===t?"#1e3a5f":"#e2e8f0",
      color:tab===t?"#fff":"#475569",
      fontWeight:tab===t?"bold":"normal",
      fontSize:13,borderRadius:"6px 6px 0 0",marginRight:4
    }}>{label}</button>
  );

  const fld = (label, key) => (
    <div style={{marginBottom:10}}>
      <label style={lbl}>{label}</label>
      <input style={inp} value={fields[key]} onChange={e=>setFields(f=>({...f,[key]:e.target.value}))} />
    </div>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
      zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16
    }}>
      <div style={{
        background:"#ffffff",borderRadius:12,width:"100%",maxWidth:800,
        maxHeight:"92vh",display:"flex",flexDirection:"column",
        border:"1px solid #e2e8f0",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"
      }}>
        <div style={{background:"#f1f5f9",padding:"14px 20px",borderRadius:"12px 12px 0 0",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{color:"#1e3a5f",fontWeight:"bold",fontSize:16}}>
              {lead.owner_name || lead.contractor_name || "Unknown"}
            </div>
            <div style={{color:"#64748b",fontSize:12,marginTop:2}}>
              {lead.property_address} &nbsp;|&nbsp; {lead.county} County &nbsp;|&nbsp; Score: {lead.lead_score}/10
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {confirmDelete ? (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:12,color:"#dc2626",fontWeight:"bold"}}>Are you sure? This cannot be undone.</span>
                <button onClick={deleteLead} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontWeight:"bold",fontSize:12}}>Yes, Delete</button>
                <button onClick={()=>setConfirmDelete(false)} style={{background:"#e2e8f0",color:"#475569",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12}}>Cancel</button>
              </div>
            ) : (
              <button onClick={deleteLead} style={{background:"none",border:"1px solid #dc2626",color:"#dc2626",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>Delete Lead</button>
            )}
            <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer",padding:"0 4px"}}>✕</button>
          </div>
        </div>

        <div style={{padding:"10px 16px 0",background:"#f1f5f9",borderBottom:"1px solid #e2e8f0",
          display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
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

        <div style={{flex:1,overflowY:"auto",padding:20,background:"#ffffff"}}>

          {tab==="info" && (
            <div>
              <div style={{color:"#1e3a5f",fontWeight:"bold",fontSize:11,textTransform:"uppercase",marginBottom:12}}>Owner / Property Contact</div>
              {fld("Owner Name","owner_name")}
              {fld("Mailing Address","owner_mailing_address")}
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0 12px",marginBottom:10}}>
                <div><label style={lbl}>City</label><input style={inp} value={fields.city} onChange={e=>setFields(f=>({...f,city:e.target.value}))} /></div>
                <div><label style={lbl}>State</label><input style={inp} value={fields.state} onChange={e=>setFields(f=>({...f,state:e.target.value}))} /></div>
                <div><label style={lbl}>Zip</label><input style={inp} value={fields.zip} onChange={e=>setFields(f=>({...f,zip:e.target.value}))} /></div>
              </div>
              {fld("Phone Number","owner_phone")}
              {fld("Email Address","owner_email")}
              {fld("Fax","owner_fax")}
              {fld("Property Address","property_address")}
              {fld("County","county")}
              <div style={{color:"#1e3a5f",fontWeight:"bold",fontSize:11,textTransform:"uppercase",margin:"14px 0 12px"}}>Contractor / Builder</div>
              {fld("Contractor Name","contractor_name")}
              {fld("Business Address","contractor_address")}
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0 12px",marginBottom:10}}>
                <div><label style={lbl}>City</label><input style={inp} value={fields.contractor_city} onChange={e=>setFields(f=>({...f,contractor_city:e.target.value}))} /></div>
                <div><label style={lbl}>State</label><input style={inp} value={fields.contractor_state} onChange={e=>setFields(f=>({...f,contractor_state:e.target.value}))} /></div>
                <div><label style={lbl}>Zip</label><input style={inp} value={fields.contractor_zip} onChange={e=>setFields(f=>({...f,contractor_zip:e.target.value}))} /></div>
              </div>
              {fld("Phone Number","contractor_phone")}
              {fld("Email Address","contractor_email")}
              {fld("Fax","contractor_fax")}
              <button onClick={saveAll} disabled={saving} style={{
                marginTop:8,background:savedOk?"#2ECC71":"#F4A826",
                color:"#000",border:"none",borderRadius:8,
                padding:"9px 28px",fontWeight:"bold",cursor:"pointer",fontSize:14
              }}>{saving?"Saving...":savedOk?"Saved!":"Save Contact Info"}</button>
            </div>
          )}

          {tab==="notes" && (
            <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{color:"#64748b",fontSize:12}}>Timestamped running notes log</span>
                <button onClick={addTS} style={{background:"#e2e8f0",color:"#475569",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12}}>+ Add Timestamp</button>
              </div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                placeholder="Type notes here. Use Add Timestamp to log dated entries..."
                style={{width:"100%",minHeight:320,background:"#162330",color:"#E8EDF2",border:"1.5px solid #1E3448",borderRadius:8,padding:12,fontSize:13,resize:"vertical",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}} />
              <button onClick={saveAll} disabled={saving} style={{
                marginTop:10,background:savedOk?"#2ECC71":"#F4A826",
                color:"#000",border:"none",borderRadius:8,
                padding:"9px 28px",fontWeight:"bold",cursor:"pointer",fontSize:14,alignSelf:"flex-start"
              }}>{saving?"Saving...":savedOk?"Saved!":"Save Notes"}</button>
            </div>
          )}

          {tab==="followup" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:11,textTransform:"uppercase",marginBottom:12}}>Schedule a Follow-Up</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px",marginBottom:10}}>
                <div style={{position:"relative"}}>
                  <label style={lbl}>Date</label>
                  <div style={{display:"flex",gap:8}}>
                    <input readOnly value={fuDate} placeholder="Click to pick a date"
                      onClick={()=>setShowCal(c=>!c)} style={{...inp,cursor:"pointer",flex:1}} />
                    <button onClick={()=>setShowCal(c=>!c)} style={{background:"#F4A826",color:"#000",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontWeight:"bold",fontSize:12,whiteSpace:"nowrap"}}>Pick Date</button>
                  </div>
                  {showCal && (
                    <>
                      <div onClick={()=>setShowCal(false)} style={{position:"fixed",inset:0,zIndex:9998}}/>
                      <CalendarPicker value={fuDate} onChange={v=>{setFuDate(v);setShowCal(false);}} onClose={()=>setShowCal(false)} />
                    </>
                  )}
                </div>
                <div>
                  <label style={lbl}>Time</label>
                  <select value={fuTime} onChange={e=>setFuTime(e.target.value)} style={{...inp,cursor:"pointer"}}>
                    {["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Type</label>
                  <select value={fuType} onChange={e=>setFuType(e.target.value)} style={{...inp,cursor:"pointer"}}>
                    {["Phone Call","Email","In-Person Visit","Text Message","Left Voicemail"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select value={fuStatus} onChange={e=>setFuStatus(e.target.value)} style={{...inp,cursor:"pointer"}}>
                    {["Scheduled","Completed","Cancelled","No Answer","Left Voicemail"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lbl}>Notes for this Follow-Up</label>
                <textarea value={fuNotes} onChange={e=>setFuNotes(e.target.value)}
                  style={{...inp,height:90,resize:"vertical",fontFamily:"inherit",background:"#f8fafc",color:"#1e293b"}}
                  placeholder="What to discuss, what was said..." />
              </div>
              <button onClick={saveFu} style={{background:"#F4A826",color:"#000",border:"none",borderRadius:8,padding:"9px 28px",fontWeight:"bold",cursor:"pointer",fontSize:14,marginBottom:20}}>Save Follow-Up</button>
              <div style={{color:"#1e3a5f",fontWeight:"bold",fontSize:11,textTransform:"uppercase",marginBottom:10}}>Follow-Up History</div>
              {loadingFu && <div style={{color:"#7A90A4"}}>Loading...</div>}
              {!loadingFu && followups.length===0 && <div style={{color:"#64748b",fontSize:13}}>No follow-ups yet.</div>}
              {followups.map(f=>(
                <div key={f.id} style={{background:"#f8fafc",borderRadius:8,padding:12,marginBottom:8,border:"1px solid #e2e8f0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:6}}>
                    <div>
                      <span style={{color:"#1e3a5f",fontWeight:"bold",fontSize:13}}>{f.date} at {f.time}</span>
                      <span style={{color:"#64748b",fontSize:12,marginLeft:10}}>{f.type}</span>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{background:STATUS_COLORS[f.status]||"#3b82f6",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:"bold"}}>{f.status}</span>
                      {["Completed","Cancelled","No Answer"].map(s=>(
                        <button key={s} onClick={()=>updateFuStatus(f.id,s)} style={{background:"#e2e8f0",color:"#475569",border:"none",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:10}}>{s}</button>
                      ))}
                      <button onClick={()=>deleteFu(f.id)} style={{background:"none",color:"#E74C3C",border:"none",cursor:"pointer",fontSize:16,padding:"0 2px"}}>✕</button>
                    </div>
                  </div>
                  {f.notes && <div style={{color:"#1e293b",fontSize:12,marginTop:4}}>{f.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {tab==="map" && (
            <div>
              <div style={{color:"#F4A826",fontWeight:"bold",fontSize:11,textTransform:"uppercase",marginBottom:16}}>Map Addresses</div>
              {[
                ["Property Address", fields.property_address],
                ["Owner Mailing Address", [fields.owner_mailing_address, fields.city, fields.state, fields.zip].filter(Boolean).join(" ")],
                ["Contractor Business Address", fields.contractor_address],
              ].filter(([,addr])=>addr&&addr.trim()).map(([label,addr])=>(
                <div key={label} style={{background:"#f8fafc",borderRadius:8,padding:14,marginBottom:12,border:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:"#64748b",fontSize:11,marginBottom:4}}>{label}</div>
                    <div style={{color:"#1e293b",fontSize:13}}>{addr}</div>
                  </div>
                  <button onClick={()=>mapIt(addr)} style={{background:"#F4A826",color:"#000",border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontWeight:"bold",fontSize:13,marginLeft:12,whiteSpace:"nowrap"}}>Open in Maps</button>
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
  const [showReports, setShowReports] = useState(false);
  const [showAddProspect, setShowAddProspect] = useState(false);

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
        <button onClick={()=>setShowReports(true)} style={{
          padding:"6px 14px",background:"#1e3a5f",color:"#fff",
          border:"none",borderRadius:8,cursor:"pointer",fontWeight:"bold",fontSize:13
        }}>Reports</button>
        <button onClick={()=>setShowAddProspect(true)} style={{
          padding:"6px 14px",background:"#2ECC71",color:"#000",
          border:"none",borderRadius:8,cursor:"pointer",fontWeight:"bold",fontSize:13
        }}>+ Add Prospect</button>
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
                <span className="status-badge" style={{backgroundColor:STATUS_COLORS[lead.status||"New"]}}>
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
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#7A90A4",fontSize:14}}>
          Click any lead to view details, edit info, schedule follow-ups, and map addresses.
        </div>
      </div>

      {showReports && <ReportsModal leads={leads} onClose={()=>setShowReports(false)} />}

      {showAddProspect && (
        <AddProspectModal
          onClose={()=>setShowAddProspect(false)}
          onAdd={(newLead)=>{
            setLeads(prev=>[newLead,...prev]);
            setShowAddProspect(false);
          }}
        />
      )}

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={()=>setSelectedLead(null)}
          onSave={handleSave}
          onDelete={(id)=>{
            setLeads(prev=>prev.filter(l=>l.id!==id));
            setSelectedLead(null);
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
