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
        <span style={{color:"#1e3a5f",fontWeight:"bold",fontSize:1
