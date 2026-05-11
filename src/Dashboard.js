import React, { useState, useEffect, useCallback } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const RTDB_URL = "https://kqf-lead-generation-default-rtdb.firebaseio.com";
const PLACES_API_KEY = "AIzaSyCBguEuPKEaiKgusoNZ6Lwp7D0Up4hxoP4";
const STATUS_OPTIONS = ["New", "Contacted", "Quoted", "Won", "Lost"];
const STATUS_COLORS = {
  New: "#3b82f6", Contacted: "#f59e0b",
  Quoted: "#8b5cf6", Won: "#10b981", Lost: "#ef4444",
};

const calNavBtn = {
  background:"none", border:"1px solid #ddd", borderRadius:4,
  padding:"2px 6px", cursor:"pointer", fontSize:12
};

// ── Calendar Picker ────────────────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose }) {
  const today = new Date();
  const initial = value ? new Date(value) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthNames = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };
  const prevYear = () => setViewYear(y => y-1);
  const nextYear = () => setViewYear(y => y+1);

  const selectDay = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(d.toISOString().split("T")[0]);
    onClose();
  };

  const selectedStr = value;
  const todayStr = today.toISOString().split("T")[0];
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div onClick={e => e.stopPropagation()} style={{
      background:"#fff", border:"1px solid #ddd", borderRadius:8,
      padding:12, width:280, boxShadow:"0 4px 16px rgba(0,0,0,0.15)", userSelect:"none"
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={prevYear} style={calNavBtn}>{"<<"}</button>
        <button onClick={prevMonth} style={calNavBtn}>{"<"}</button>
        <span style={{fontWeight:600,fontSize:14}}>{monthNames[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={calNavBtn}>{">"}</button>
        <button onClick={nextYear} style={calNavBtn}>{">>"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center"}}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} style={{fontSize:11,fontWeight:600,color:"#888",padding:"2px 0"}}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isSelected = ds === selectedStr;
          const isToday = ds === todayStr;
          return (
            <div key={i} onClick={() => selectDay(day)} style={{
              padding:"4px 0", borderRadius:4, cursor:"pointer", fontSize:13,
              background: isSelected ? "#3b82f6" : isToday ? "#dbeafe" : "transparent",
              color: isSelected ? "#fff" : "#222",
              fontWeight: isToday ? 700 : 400,
            }}>{day}</div>
          );
        })}
      </div>
      <div style={{textAlign:"center",marginTop:8}}>
        <button onClick={onClose} style={{fontSize:12,color:"#888",background:"none",border:"none",cursor:"pointer"}}>
          Close without selecting
        </button>
      </div>
    </div>
  );
}

// ── Lead Modal ─────────────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onSave, onDelete, onPrev, onNext, hasPrev, hasNext }) {
  const [activeTab, setActiveTab] = useState("edit");
  const [form, setForm] = useState({
    owner_name: lead.owner_name || "",
    mailing_address: lead.mailing_address || "",
    owner_city: lead.owner_city || "",
    owner_state: lead.owner_state || "NC",
    owner_zip: lead.owner_zip || "",
    owner_phone: lead.owner_phone || "",
    owner_email: lead.owner_email || "",
    owner_fax: lead.owner_fax || "",
    property_address: lead.property_address || "",
    county: lead.county || "",
    contractor_name: lead.contractor_name || "",
    contractor_address: lead.contractor_address || "",
    contractor_city: lead.contractor_city || "",
    contractor_state: lead.contractor_state || "NC",
    contractor_zip: lead.contractor_zip || "",
    contractor_phone: lead.contractor_phone || lead.phone || "",
    contractor_email: lead.contractor_email || "",
    contractor_fax: lead.contractor_fax || "",
  });
  const [notes, setNotes] = useState(lead.notes || "");
  const [followUps, setFollowUps] = useState(lead.follow_ups || []);
  const [newFU, setNewFU] = useState({ date:"", time:"", type:"Phone Call", status:"Scheduled", notes:"" });
  const [showCal, setShowCal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [notesTimestamped, setNotesTimestamped] = useState(false);

  useEffect(() => {
    setForm({
      owner_name: lead.owner_name || "",
      mailing_address: lead.mailing_address || "",
      owner_city: lead.owner_city || "",
      owner_state: lead.owner_state || "NC",
      owner_zip: lead.owner_zip || "",
      owner_phone: lead.owner_phone || "",
      owner_email: lead.owner_email || "",
      owner_fax: lead.owner_fax || "",
      property_address: lead.property_address || "",
      county: lead.county || "",
      contractor_name: lead.contractor_name || "",
      contractor_address: lead.contractor_address || "",
      contractor_city: lead.contractor_city || "",
      contractor_state: lead.contractor_state || "NC",
      contractor_zip: lead.contractor_zip || "",
      contractor_phone: lead.contractor_phone || lead.phone || "",
      contractor_email: lead.contractor_email || "",
      contractor_fax: lead.contractor_fax || "",
    });
    setNotes(lead.notes || "");
    setFollowUps(lead.follow_ups || []);
    setDeleteConfirm(false);
    setLookupStatus("");
    setNotesTimestamped(false);
  }, [lead]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveAll = async () => {
    setSaving(true);
    const updated = { ...lead, ...form, notes, follow_ups: followUps };
    try {
      await fetch(`${RTDB_URL}/leads/${lead.id}.json`, {
        method: "PUT", body: JSON.stringify(updated),
      });
      onSave(updated);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const findContactInfo = async () => {
    const searchName = form.contractor_name || form.owner_name;
    const searchAddr = form.contractor_address || form.property_address || form.mailing_address;
    if (!searchName) { setLookupStatus("⚠️ No business name found to search."); return; }
    setLookupLoading(true);
    setLookupStatus("🔍 Searching Google Places...");
    try {
      const query = `${searchName} ${searchAddr}`.trim();
      const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,formatted_phone_number,website&key=${PLACES_API_KEY}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const resp = await fetch(proxyUrl);
      const data = await resp.json();
      if (data.candidates && data.candidates.length > 0) {
        const place = data.candidates[0];
        let found = [];
        if (place.formatted_phone_number) { set("contractor_phone", place.formatted_phone_number); found.push("phone ✓"); }
        if (place.website) {
          const domain = new URL(place.website).hostname.replace("www.","");
          setLookupStatus(found.length > 0
            ? `✅ Found: ${found.join(", ")}! Website: ${domain} — check it for email. Click Save Changes to keep.`
            : `⚠️ No phone listed. Website: ${domain} — check manually for contact info.`);
        } else {
          setLookupStatus(found.length > 0
            ? `✅ Found: ${found.join(", ")}! Click Save Changes to keep.`
            : "⚠️ Business found but no phone or website listed in Google.");
        }
      } else {
        setLookupStatus("⚠️ No matching business found. Try editing the name or address.");
      }
    } catch (e) { setLookupStatus("❌ Lookup failed. Check your internet connection."); console.error(e); }
    setLookupLoading(false);
  };

  const addFollowUp = () => {
    if (!newFU.date) return;
    setFollowUps(prev => [...prev, { ...newFU, id: Date.now(), created: new Date().toISOString() }]);
    setNewFU({ date:"", time:"", type:"Phone Call", status:"Scheduled", notes:"" });
  };

  const updateFUStatus = (id, status) => setFollowUps(prev => prev.map(f => f.id === id ? {...f, status} : f));
  const deleteFU = (id) => setFollowUps(prev => prev.filter(f => f.id !== id));

  const formatTimestamp = () => {
    const now = new Date();
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} — ${hours}:${String(now.getMinutes()).padStart(2,"0")} ${ampm}`;
  };

  const addTimestampedNote = () => {
    const ts = formatTimestamp();
    setNotes(prev => prev ? `${ts}\n\n${prev}` : `${ts}\n`);
  };

  const handleNotesFocus = () => {
    if (!notesTimestamped) {
      setNotes(prev => prev ? `${formatTimestamp()}\n\n${prev}` : `${formatTimestamp()}\n`);
      setNotesTimestamped(true);
    }
  };

  const openMap = (addr) => { if (addr) window.open(`https://www.google.com/maps/search/${encodeURIComponent(addr)}`, "_blank"); };

  const handleDelete = async () => {
    try {
      await fetch(`${RTDB_URL}/leads/${lead.id}.json`, { method: "DELETE" });
      onDelete(lead.id);
    } catch (e) { console.error(e); }
  };

  const tabStyle = (t) => ({
    padding:"8px 16px", cursor:"pointer", border:"none", background:"none",
    borderBottom: activeTab === t ? "2px solid #3b82f6" : "2px solid transparent",
    color: activeTab === t ? "#3b82f6" : "#555",
    fontWeight: activeTab === t ? 700 : 400, fontSize:14,
  });

  const inp = {
    width:"100%", padding:"7px 10px", border:"1px solid #ddd",
    borderRadius:5, fontSize:14, boxSizing:"border-box", marginBottom:8,
  };
  const lbl = { fontSize:12, color:"#666", marginBottom:2, display:"block" };

  // Phone/email with call and email buttons
  const phoneRow = (label, key) => (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{display:"flex", gap:8, marginBottom:8}}>
        <input style={{...inp, marginBottom:0, flex:1}} value={form[key]} onChange={e => set(key, e.target.value)} />
        {form[key] && <a href={`tel:${form[key].replace(/\D/g,"")}`} style={{
          display:"inline-flex", alignItems:"center", gap:4, padding:"7px 12px",
          background:"#1A5FA8", color:"#fff", borderRadius:5, fontSize:13,
          fontWeight:700, textDecoration:"none", whiteSpace:"nowrap"
        }}>📞 Call</a>}
      </div>
    </div>
  );

  const emailRow = (label, key) => (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{display:"flex", gap:8, marginBottom:8}}>
        <input style={{...inp, marginBottom:0, flex:1}} value={form[key]} onChange={e => set(key, e.target.value)} />
        {form[key] && <a href={`mailto:${form[key]}`} style={{
          display:"inline-flex", alignItems:"center", gap:4, padding:"7px 12px",
          background:"#27AE60", color:"#fff", borderRadius:5, fontSize:13,
          fontWeight:700, textDecoration:"none", whiteSpace:"nowrap"
        }}>✉ Email</a>}
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:10, width:"90%", maxWidth:720,
        maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 8px 32px rgba(0,0,0,0.2)"
      }}>
        {/* Header */}
        <div style={{padding:"14px 20px", borderBottom:"1px solid #eee",
          display:"flex", justifyContent:"space-between", alignItems:"center", background:"#f8f9fa"}}>
          <h2 style={{margin:0, fontSize:17, color:"#222"}}>
            {form.owner_name || lead.contractor_name || "Lead Detail"}
          </h2>
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)} style={{
                background:"#fee2e2", color:"#dc2626", border:"none",
                borderRadius:5, padding:"5px 12px", cursor:"pointer", fontSize:13
              }}>Delete Lead</button>
            ) : (
              <>
                <span style={{fontSize:13, color:"#dc2626", fontWeight:600}}>Are you sure?</span>
                <button onClick={handleDelete} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:5,padding:"5px 12px",cursor:"pointer",fontSize:13}}>Yes, Delete</button>
                <button onClick={() => setDeleteConfirm(false)} style={{background:"#e5e7eb",color:"#333",border:"none",borderRadius:5,padding:"5px 12px",cursor:"pointer",fontSize:13}}>Cancel</button>
              </>
            )}
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#888",lineHeight:1}}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex", borderBottom:"1px solid #eee", background:"#fff", padding:"0 12px"}}>
          {["edit","notes","followups","map"].map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
              {t === "edit" ? "Edit Info" : t === "notes" ? "Notes" : t === "followups" ? "Follow-Ups" : "Map"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{overflowY:"auto", flex:1, padding:20, background:"#fff"}}>

          {/* EDIT INFO */}
          {activeTab === "edit" && (
            <div>
              <h4 style={{margin:"0 0 12px",color:"#3b82f6",borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>
                Owner / Property Contact
              </h4>
              <label style={lbl}>Owner Name</label>
              <input style={inp} value={form.owner_name} onChange={e => set("owner_name", e.target.value)} />
              <label style={lbl}>Mailing Address</label>
              <input style={inp} value={form.mailing_address} onChange={e => set("mailing_address", e.target.value)} />
              <div style={{display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:8}}>
                <div><label style={lbl}>City</label><input style={inp} value={form.owner_city} onChange={e => set("owner_city", e.target.value)} /></div>
                <div><label style={lbl}>State</label><input style={inp} value={form.owner_state} onChange={e => set("owner_state", e.target.value)} /></div>
                <div><label style={lbl}>Zip</label><input style={inp} value={form.owner_zip} onChange={e => set("owner_zip", e.target.value)} /></div>
              </div>
              {phoneRow("Phone Number", "owner_phone")}
              {emailRow("Email Address", "owner_email")}
              <label style={lbl}>Fax</label>
              <input style={inp} value={form.owner_fax} onChange={e => set("owner_fax", e.target.value)} />
              <label style={lbl}>Property Address</label>
              <input style={inp} value={form.property_address} onChange={e => set("property_address", e.target.value)} />
              <label style={lbl}>County</label>
              <input style={inp} value={form.county} onChange={e => set("county", e.target.value)} />

              <h4 style={{margin:"16px 0 12px",color:"#3b82f6",borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>
                Contractor
              </h4>
              <label style={lbl}>Contractor Name</label>
              <input style={inp} value={form.contractor_name} onChange={e => set("contractor_name", e.target.value)} />
              <label style={lbl}>Business Address</label>
              <input style={inp} value={form.contractor_address} onChange={e => set("contractor_address", e.target.value)} />
              <div style={{display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:8}}>
                <div><label style={lbl}>City</label><input style={inp} value={form.contractor_city} onChange={e => set("contractor_city", e.target.value)} /></div>
                <div><label style={lbl}>State</label><input style={inp} value={form.contractor_state} onChange={e => set("contractor_state", e.target.value)} /></div>
                <div><label style={lbl}>Zip</label><input style={inp} value={form.contractor_zip} onChange={e => set("contractor_zip", e.target.value)} /></div>
              </div>
              {phoneRow("Phone Number", "contractor_phone")}
              {emailRow("Email Address", "contractor_email")}
              <label style={lbl}>Fax</label>
              <input style={inp} value={form.contractor_fax} onChange={e => set("contractor_fax", e.target.value)} />

              {/* Find Phone & Email */}
              <div style={{marginTop:16, padding:14, background:"#f0f9ff", borderRadius:8, border:"1px solid #bae6fd"}}>
                <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
                  <button onClick={findContactInfo} disabled={lookupLoading} style={{
                    background: lookupLoading ? "#94a3b8" : "#0ea5e9",
                    color:"#fff", border:"none", borderRadius:6,
                    padding:"8px 16px", cursor: lookupLoading ? "not-allowed" : "pointer",
                    fontSize:14, fontWeight:600, whiteSpace:"nowrap"
                  }}>{lookupLoading ? "🔍 Searching..." : "🔍 Find Phone & Email"}</button>
                  <span style={{fontSize:12, color:"#0369a1"}}>Searches Google Places using the business name &amp; address above</span>
                </div>
                {lookupStatus && <div style={{marginTop:8, fontSize:13, color:"#0c4a6e", fontWeight:500}}>{lookupStatus}</div>}
              </div>
            </div>
          )}

          {/* NOTES */}
          {activeTab === "notes" && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <h4 style={{margin:0,color:"#3b82f6"}}>Notes</h4>
                <button onClick={addTimestampedNote} style={{
                  background:"#3b82f6",color:"#fff",border:"none",
                  borderRadius:5,padding:"6px 12px",cursor:"pointer",fontSize:13
                }}>+ Add Timestamped Note</button>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                onFocus={handleNotesFocus}
                placeholder="Click here to start a new timestamped note..."
                style={{width:"100%",minHeight:380,padding:12,fontSize:14,
                  border:"1px solid #ddd",borderRadius:6,resize:"vertical",
                  boxSizing:"border-box",lineHeight:1.6,fontFamily:"inherit"}} />
            </div>
          )}

          {/* FOLLOW-UPS */}
          {activeTab === "followups" && (
            <div>
              <h4 style={{margin:"0 0 12px",color:"#3b82f6"}}>Schedule Follow-Up</h4>
              <div style={{background:"#f8f9fa",borderRadius:8,padding:14,marginBottom:20}}>
                <div style={{position:"relative",marginBottom:8}}>
                  <label style={lbl}>Date</label>
                  <input readOnly value={newFU.date} onClick={() => setShowCal(!showCal)}
                    placeholder="Click to select date"
                    style={{...inp, cursor:"pointer", background:"#fff"}} />
                  {showCal && (
                    <div onClick={e => e.stopPropagation()} style={{
                      position:"fixed", top:"50%", left:"50%",
                      transform:"translate(-50%,-50%)", zIndex:2000
                    }}>
                      <CalendarPicker value={newFU.date}
                        onChange={d => setNewFU(f => ({...f, date:d}))}
                        onClose={() => setShowCal(false)} />
                    </div>
                  )}
                </div>
                <label style={lbl}>Time</label>
                <input style={inp} type="time" value={newFU.time} onChange={e => setNewFU(f => ({...f, time:e.target.value}))} />
                <label style={lbl}>Type</label>
                <select style={inp} value={newFU.type} onChange={e => setNewFU(f => ({...f, type:e.target.value}))}>
                  {["Phone Call","Email","In-Person Visit","Text Message","Other"].map(t => <option key={t}>{t}</option>)}
                </select>
                <label style={lbl}>Status</label>
                <select style={inp} value={newFU.status} onChange={e => setNewFU(f => ({...f, status:e.target.value}))}>
                  {["Scheduled","Completed","Cancelled","No Answer"].map(s => <option key={s}>{s}</option>)}
                </select>
                <label style={lbl}>Notes</label>
                <textarea value={newFU.notes} onChange={e => setNewFU(f => ({...f, notes:e.target.value}))}
                  placeholder="Notes for this follow-up..."
                  style={{...inp, minHeight:80, resize:"vertical", fontFamily:"inherit"}} />
                <button onClick={addFollowUp} style={{
                  background:"#10b981",color:"#fff",border:"none",
                  borderRadius:5,padding:"8px 18px",cursor:"pointer",fontSize:14,width:"100%"
                }}>Add Follow-Up</button>
              </div>

              <h4 style={{margin:"0 0 10px",color:"#3b82f6"}}>Follow-Up History</h4>
              {followUps.length === 0 ? (
                <p style={{color:"#888",fontSize:14}}>No follow-ups scheduled yet.</p>
              ) : (
                [...followUps].sort((a,b) => a.date > b.date ? 1 : -1).map(fu => (
                  <div key={fu.id} style={{
                    background:"#f8f9fa", borderRadius:6, padding:12, marginBottom:10,
                    borderLeft:`3px solid ${fu.status==="Completed"?"#10b981":fu.status==="Cancelled"?"#ef4444":"#3b82f6"}`
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <strong style={{fontSize:14}}>{fu.date} {fu.time && `@ ${fu.time}`} — {fu.type}</strong>
                      <span style={{fontSize:12,padding:"2px 8px",borderRadius:10,
                        background:fu.status==="Completed"?"#d1fae5":fu.status==="Cancelled"?"#fee2e2":"#dbeafe",
                        color:fu.status==="Completed"?"#065f46":fu.status==="Cancelled"?"#991b1b":"#1e40af"
                      }}>{fu.status}</span>
                    </div>
                    {fu.notes && <p style={{margin:"6px 0 8px",fontSize:13,color:"#555"}}>{fu.notes}</p>}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {["Completed","Cancelled","No Answer"].map(s => (
                        <button key={s} onClick={() => updateFUStatus(fu.id, s)} style={{
                          fontSize:12,padding:"3px 8px",borderRadius:4,cursor:"pointer",
                          background:fu.status===s?"#3b82f6":"#e5e7eb",
                          color:fu.status===s?"#fff":"#333",border:"none"
                        }}>{s}</button>
                      ))}
                      <button onClick={() => deleteFU(fu.id)} style={{
                        fontSize:12,padding:"3px 8px",borderRadius:4,
                        background:"#fee2e2",color:"#dc2626",border:"none",cursor:"pointer"
                      }}>Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* MAP */}
          {activeTab === "map" && (
            <div>
              <h4 style={{margin:"0 0 16px",color:"#3b82f6"}}>Map Addresses</h4>
              {[
                { label:"Property Address", addr:form.property_address },
                { label:"Owner Mailing Address", addr:[form.mailing_address,form.owner_city,form.owner_state,form.owner_zip].filter(Boolean).join(", ") },
                { label:"Contractor Business Address", addr:[form.contractor_address,form.contractor_city,form.contractor_state,form.contractor_zip].filter(Boolean).join(", ") },
              ].map(({ label, addr }) => (
                <div key={label} style={{background:"#f8f9fa",borderRadius:6,padding:12,marginBottom:10,
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,color:"#888",marginBottom:2}}>{label}</div>
                    <div style={{fontSize:14,color:"#222"}}>{addr || "No address on file"}</div>
                  </div>
                  <button onClick={() => openMap(addr)} disabled={!addr} style={{
                    background:addr?"#3b82f6":"#e5e7eb",
                    color:addr?"#fff":"#aaa",border:"none",borderRadius:5,
                    padding:"6px 14px",cursor:addr?"pointer":"not-allowed",fontSize:13
                  }}>Open Map</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 20px",borderTop:"1px solid #eee",background:"#f8f9fa",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onPrev} disabled={!hasPrev} style={{
              background:hasPrev?"#3b82f6":"#e5e7eb",color:hasPrev?"#fff":"#aaa",
              border:"none",borderRadius:5,padding:"8px 16px",
              cursor:hasPrev?"pointer":"not-allowed",fontSize:14,fontWeight:600
            }}>← Previous</button>
            <button onClick={onNext} disabled={!hasNext} style={{
              background:hasNext?"#3b82f6":"#e5e7eb",color:hasNext?"#fff":"#aaa",
              border:"none",borderRadius:5,padding:"8px 16px",
              cursor:hasNext?"pointer":"not-allowed",fontSize:14,fontWeight:600
            }}>Next →</button>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{background:"#e5e7eb",color:"#333",border:"none",
              borderRadius:5,padding:"8px 20px",cursor:"pointer",fontSize:14}}>Close</button>
            <button onClick={saveAll} disabled={saving} style={{background:"#3b82f6",color:"#fff",
              border:"none",borderRadius:5,padding:"8px 24px",cursor:"pointer",fontSize:14,fontWeight:600}}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Prospect Modal ─────────────────────────────────────────────────────────
function AddProspectModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    owner_name:"", mailing_address:"", owner_city:"", owner_state:"NC",
    owner_zip:"", owner_phone:"", owner_email:"", owner_fax:"",
    property_address:"", county:"",
    contractor_name:"", contractor_address:"", contractor_city:"",
    contractor_state:"NC", contractor_zip:"", contractor_phone:"",
    contractor_email:"", contractor_fax:"", notes:"", status:"New",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const inp = {width:"100%",padding:"7px 10px",border:"1px solid #ddd",borderRadius:5,fontSize:14,boxSizing:"border-box",marginBottom:8};
  const lbl = {fontSize:12,color:"#666",marginBottom:2,display:"block"};

  const save = async () => {
    if (!form.owner_name && !form.contractor_name) return;
    setSaving(true);
    try {
      await fetch(`${RTDB_URL}/leads.json`, {
        method:"POST", body:JSON.stringify({...form, date_added:new Date().toISOString(), lead_source:"Manual Entry"}),
      });
      onSave();
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"#fff",borderRadius:10,width:"90%",maxWidth:680,
        maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",
        boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #eee",
          display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8f9fa"}}>
          <h2 style={{margin:0,fontSize:17}}>Add New Prospect</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#888"}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:20}}>
          <h4 style={{margin:"0 0 12px",color:"#3b82f6",borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>Owner / Property Contact</h4>
          <label style={lbl}>Owner Name</label><input style={inp} value={form.owner_name} onChange={e=>set("owner_name",e.target.value)} />
          <label style={lbl}>Mailing Address</label><input style={inp} value={form.mailing_address} onChange={e=>set("mailing_address",e.target.value)} />
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
            <div><label style={lbl}>City</label><input style={inp} value={form.owner_city} onChange={e=>set("owner_city",e.target.value)} /></div>
            <div><label style={lbl}>State</label><input style={inp} value={form.owner_state} onChange={e=>set("owner_state",e.target.value)} /></div>
            <div><label style={lbl}>Zip</label><input style={inp} value={form.owner_zip} onChange={e=>set("owner_zip",e.target.value)} /></div>
          </div>
          <label style={lbl}>Phone Number</label><input style={inp} value={form.owner_phone} onChange={e=>set("owner_phone",e.target.value)} />
          <label style={lbl}>Email Address</label><input style={inp} value={form.owner_email} onChange={e=>set("owner_email",e.target.value)} />
          <label style={lbl}>Fax</label><input style={inp} value={form.owner_fax} onChange={e=>set("owner_fax",e.target.value)} />
          <label style={lbl}>Property Address</label><input style={inp} value={form.property_address} onChange={e=>set("property_address",e.target.value)} />
          <label style={lbl}>County</label><input style={inp} value={form.county} onChange={e=>set("county",e.target.value)} />
          <h4 style={{margin:"16px 0 12px",color:"#3b82f6",borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>Contractor</h4>
          <label style={lbl}>Contractor Name</label><input style={inp} value={form.contractor_name} onChange={e=>set("contractor_name",e.target.value)} />
          <label style={lbl}>Business Address</label><input style={inp} value={form.contractor_address} onChange={e=>set("contractor_address",e.target.value)} />
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
            <div><label style={lbl}>City</label><input style={inp} value={form.contractor_city} onChange={e=>set("contractor_city",e.target.value)} /></div>
            <div><label style={lbl}>State</label><input style={inp} value={form.contractor_state} onChange={e=>set("contractor_state",e.target.value)} /></div>
            <div><label style={lbl}>Zip</label><input style={inp} value={form.contractor_zip} onChange={e=>set("contractor_zip",e.target.value)} /></div>
          </div>
          <label style={lbl}>Phone Number</label><input style={inp} value={form.contractor_phone} onChange={e=>set("contractor_phone",e.target.value)} />
          <label style={lbl}>Email Address</label><input style={inp} value={form.contractor_email} onChange={e=>set("contractor_email",e.target.value)} />
          <label style={lbl}>Fax</label><input style={inp} value={form.contractor_fax} onChange={e=>set("contractor_fax",e.target.value)} />
          <h4 style={{margin:"16px 0 12px",color:"#3b82f6",borderBottom:"1px solid #e5e7eb",paddingBottom:6}}>Notes</h4>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Initial notes..."
            style={{...inp,minHeight:100,resize:"vertical",fontFamily:"inherit"}} />
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid #eee",background:"#f8f9fa",
          display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{background:"#e5e7eb",color:"#333",border:"none",borderRadius:5,padding:"8px 20px",cursor:"pointer",fontSize:14}}>Cancel</button>
          <button onClick={save} disabled={saving} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:5,padding:"8px 24px",cursor:"pointer",fontSize:14,fontWeight:600}}>
            {saving ? "Saving..." : "Save Prospect"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────────
function printReport(title, leads, followUps) {
  const rows = followUps.map(({lead, fu}) => `
    <tr>
      <td>${fu.date||""} ${fu.time||""}</td><td>${fu.type||""}</td><td>${fu.status||""}</td>
      <td>${lead.owner_name||lead.contractor_name||""}</td>
      <td>${lead.property_address||""}</td>
      <td>${lead.owner_phone||lead.contractor_phone||""}</td>
      <td>${fu.notes||""}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}
  h1{font-size:18px;margin-bottom:4px;}h2{font-size:14px;color:#555;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;}th{background:#3b82f6;color:#fff;padding:6px 8px;text-align:left;}
  td{padding:5px 8px;border-bottom:1px solid #eee;}tr:nth-child(even){background:#f9f9f9;}
  .close-btn{position:fixed;top:16px;right:20px;background:#ef4444;color:#fff;border:none;
    border-radius:6px;padding:8px 18px;font-size:14px;cursor:pointer;font-weight:600;z-index:999;}
  @media print{.close-btn,.print-btn{display:none;}}</style></head><body>
  <button class="close-btn" onclick="window.close()">✕ Close</button>
  <h1>KQF Discount Flooring — ${title}</h1>
  <h2>Generated: ${new Date().toLocaleString()}</h2>
  <button class="print-btn" onclick="window.print()" style="margin-bottom:12px;padding:6px 16px;background:#3b82f6;color:#fff;border:none;border-radius:4px;cursor:pointer;">🖨 Print</button>
  <table><thead><tr><th>Date/Time</th><th>Type</th><th>Status</th><th>Name</th><th>Address</th><th>Phone</th><th>Notes</th></tr></thead>
  <tbody>${rows||"<tr><td colspan='7' style='text-align:center;padding:20px;color:#888;'>No records found</td></tr>"}</tbody></table>
  </body></html>`;
  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({ user }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCounty, setFilterCounty] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [counties, setCounties] = useState([]);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/iP(ad|hone|od)/i.test(ua) && /CriOS/i.test(ua)) {
      window.location.href = "safari://" + window.location.href.replace(/^https?:\/\//, "");
      return;
    }
    fetchLeads();
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${RTDB_URL}/leads.json`);
      const data = await resp.json();
      if (data) {
        const arr = Object.entries(data).map(([id, lead]) => ({ id, ...lead }));
        arr.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
        setLeads(arr);
        setCounties([...new Set(arr.map(l => l.county).filter(Boolean))].sort());
      } else { setLeads([]); }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  const filtered = leads.filter(l => {
    const ms = search.toLowerCase();
    const matchSearch = ms === "" ||
      (l.owner_name && l.owner_name.toLowerCase().includes(ms)) ||
      (l.property_address && l.property_address.toLowerCase().includes(ms)) ||
      (l.county && l.county.toLowerCase().includes(ms)) ||
      (l.contractor_name && l.contractor_name.toLowerCase().includes(ms)) ||
      (l.owner_phone && l.owner_phone.includes(ms)) ||
      (l.contractor_phone && l.contractor_phone.includes(ms));
    const matchCounty = filterCounty === "All" || l.county === filterCounty;
    const matchStatus = filterStatus === "All" || (l.status || "New") === filterStatus;
    return matchSearch && matchCounty && matchStatus;
  });

  const selectedLead = selectedLeadIndex !== null ? filtered[selectedLeadIndex] : null;

  const handleSaveLead = (updated) => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
  const handleDeleteLead = (id) => { setLeads(prev => prev.filter(l => l.id !== id)); setSelectedLeadIndex(null); };
  const handleAddProspect = () => fetchLeads();
  const handlePrev = () => { if (selectedLeadIndex > 0) setSelectedLeadIndex(i => i - 1); };
  const handleNext = () => { if (selectedLeadIndex < filtered.length - 1) setSelectedLeadIndex(i => i + 1); };

  const buildFollowUps = (filter) => {
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7*86400000).toISOString().split("T")[0];
    const monthEnd = new Date(Date.now() + 30*86400000).toISOString().split("T")[0];
    const result = [];
    leads.forEach(lead => {
      (lead.follow_ups || []).forEach(fu => {
        if (filter === "today" && fu.date !== today) return;
        if (filter === "week" && (fu.date < today || fu.date > weekEnd)) return;
        if (filter === "month" && (fu.date < today || fu.date > monthEnd)) return;
        if (filter === "upcoming" && fu.date < today) return;
        result.push({ lead, fu });
      });
    });
    return result.sort((a, b) => a.fu.date > b.fu.date ? 1 : -1);
  };

  const runReport = (type) => {
    setShowReports(false);
    if (["today","week","month","upcoming","all"].includes(type)) {
      const labels = { today:"Today's Follow-Ups", week:"This Week's Follow-Ups",
        month:"This Month's Follow-Ups", upcoming:"All Upcoming Follow-Ups", all:"All Follow-Ups Ever" };
      printReport(labels[type], leads, buildFollowUps(type));
    } else {
      const statusLeads = leads.filter(l => (l.status || "New") === type);
      const fus = [];
      statusLeads.forEach(lead => (lead.follow_ups || []).forEach(fu => fus.push({ lead, fu })));
      printReport(`${type} Leads`, statusLeads, fus);
    }
  };

  const stats = {
    total: leads.length,
    new: leads.filter(l => !l.status || l.status === "New").length,
    contacted: leads.filter(l => l.status === "Contacted").length,
    won: leads.filter(l => l.status === "Won").length,
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
          <button className="logout-btn" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </header>

      <div className="stats-bar">
        <div className="stat-card"><span className="stat-number">{stats.total}</span><span className="stat-label">Total Leads</span></div>
        <div className="stat-card"><span className="stat-number" style={{color:STATUS_COLORS.New}}>{stats.new}</span><span className="stat-label">New</span></div>
        <div className="stat-card"><span className="stat-number" style={{color:STATUS_COLORS.Contacted}}>{stats.contacted}</span><span className="stat-label">Contacted</span></div>
        <div className="stat-card"><span className="stat-number" style={{color:STATUS_COLORS.Won}}>{stats.won}</span><span className="stat-label">Won</span></div>
      </div>

      <div className="filters">
        <input className="search-input" type="text" placeholder="Search by name, address, phone..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterCounty} onChange={e => setFilterCounty(e.target.value)}>
          <option value="All">All Counties</option>
          {counties.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="refresh-btn" onClick={fetchLeads}>Refresh</button>
        <div style={{position:"relative"}}>
          <button onClick={() => setShowReports(r => !r)} style={{
            background:"#8b5cf6",color:"#fff",border:"none",
            borderRadius:5,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:600
          }}>📊 Reports</button>
          {showReports && (
            <div style={{position:"absolute",top:"100%",right:0,background:"#fff",
              border:"1px solid #ddd",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.15)",
              zIndex:200,minWidth:220,overflow:"hidden"}}>
              {[
                {key:"today",label:"Today's Follow-Ups"},{key:"week",label:"This Week's Follow-Ups"},
                {key:"month",label:"This Month's Follow-Ups"},{key:"upcoming",label:"All Upcoming Follow-Ups"},
                {key:"all",label:"All Follow-Ups Ever"},{key:"New",label:"New Leads"},
                {key:"Contacted",label:"Contacted Leads"},{key:"Quoted",label:"Quoted Leads"},
                {key:"Won",label:"Won Leads"},{key:"Lost",label:"Lost Leads"},
              ].map(r => (
                <button key={r.key} onClick={() => runReport(r.key)} style={{
                  display:"block",width:"100%",padding:"10px 16px",background:"none",
                  border:"none",textAlign:"left",cursor:"pointer",fontSize:13,color:"#222",
                  borderBottom:"1px solid #f0f0f0"
                }}
                  onMouseEnter={e => e.target.style.background="#f5f3ff"}
                  onMouseLeave={e => e.target.style.background="none"}
                >{r.label}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowAddProspect(true)} style={{
          background:"#10b981",color:"#fff",border:"none",
          borderRadius:5,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:600
        }}>+ Add Prospect</button>
      </div>

      <div className="content">
        <div className="leads-list">
          <div className="leads-count">{filtered.length} leads</div>
          {filtered.length === 0 ? (
            <div className="empty-state"><p>No leads found.</p></div>
          ) : (
            filtered.map((lead, index) => (
              <div key={lead.id}
                className={`lead-card ${selectedLead?.id === lead.id ? "selected" : ""}`}
                onClick={() => setSelectedLeadIndex(index)}>
                <div className="lead-card-top">
                  <span className="lead-name">{lead.owner_name || lead.contractor_name || "Unknown"}</span>
                  <span className="status-badge" style={{backgroundColor:STATUS_COLORS[lead.status||"New"]}}>
                    {lead.status || "New"}
                  </span>
                </div>
                <div className="lead-address">{lead.property_address || "No address"}</div>
                <div className="lead-meta">
                  <span>{lead.county} County</span>
                  {lead.permit_date && <span>• {lead.permit_date}</span>}
                  {lead.lead_score && <span>• Score: {lead.lead_score}/10</span>}
                </div>
                {(lead.owner_phone || lead.contractor_phone) && (
                  <div style={{marginTop:7}} onClick={e => e.stopPropagation()}>
                    <a href={`tel:${(lead.owner_phone||lead.contractor_phone).replace(/\D/g,"")}`}
                      style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 12px",
                        background:"#1A5FA8",color:"#fff",borderRadius:5,fontSize:13,
                        fontWeight:700,textDecoration:"none"}}>📞 Call</a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedLead && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}
          onClick={() => setSelectedLeadIndex(null)}>
          <div onClick={e => e.stopPropagation()}>
            <LeadModal
              lead={selectedLead}
              onClose={() => setSelectedLeadIndex(null)}
              onSave={handleSaveLead}
              onDelete={handleDeleteLead}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={selectedLeadIndex > 0}
              hasNext={selectedLeadIndex < filtered.length - 1}
            />
          </div>
        </div>
      )}

      {showAddProspect && (
        <AddProspectModal onClose={() => setShowAddProspect(false)} onSave={handleAddProspect} />
      )}

      {showReports && (
        <div style={{position:"fixed",inset:0,zIndex:150}} onClick={() => setShowReports(false)} />
      )}
    </div>
  );
}

export default Dashboard;