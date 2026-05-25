
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

// Load only one page from Supabase at a time. Do not fetch the whole database into the browser.
const PAGE_SIZE = 1000;

const STATUS_OPTIONS = ["New", "Contacted", "Quoted", "Won", "Lost", "Not Responding"];
const FOLLOW_UP_TYPES = ["Phone Call", "Email", "In-Person Visit", "Text Message", "Other"];
const FOLLOW_UP_STATUSES = ["Scheduled", "Completed", "Cancelled", "No Answer"];

const COMMON_CATEGORIES = [
  "All",
  "apartment_complex",
  "builder",
  "commercial_property",
  "damage_repair",
  "hoa_condo",
  "licensed_contractor",
  "new_home_owner",
  "property_manager",
  "rental_llc",
  "renovation_permit",
  "senior_living",
];

const COMMON_COUNTIES = [
  "All", "Alamance", "Caswell", "Chatham", "Davidson", "Davie", "Durham",
  "Forsyth", "Guilford", "Lee", "Montgomery", "Moore", "Orange",
  "Randolph", "Richmond", "Rockingham", "Rowan", "Stanly", "Yadkin"
];

const STATUS_COLORS = {
  New: "#3b82f6",
  Contacted: "#f59e0b",
  Quoted: "#8b5cf6",
  Won: "#10b981",
  Lost: "#ef4444",
  "Not Responding": "#64748b",
};

const fieldStyle = {
  width: "100%",
  padding: "7px 9px",
  border: "1px solid #d7dee8",
  borderRadius: 5,
  fontSize: 13,
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 12,
  color: "#41546b",
  fontWeight: 700,
  marginBottom: 3,
  display: "block",
};

function displayCategory(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function cleanPhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function getLeadName(lead) {
  return lead.lead_name || lead.owner_name || lead.contractor_name || lead.property_address || "Unnamed Lead";
}

function getLeadPhone(lead) {
  return lead.property_manager_phone || lead.owner_phone || lead.contractor_phone || "";
}

function getLeadEmail(lead) {
  return lead.property_manager_email || lead.owner_email || lead.contractor_email || "";
}

function getLeadWebsite(lead) {
  return lead.owner_website || lead.contractor_website || "";
}

function safeExtraContacts(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function leadToForm(lead) {
  return {
    lead_name: lead.lead_name || "",
    lead_category: lead.lead_category || "",
    lead_status: lead.lead_status || lead.status || "New",
    lead_score: lead.lead_score || "",

    owner_name: lead.owner_name || "",
    owner_first_name: lead.owner_first_name || "",
    owner_mi: lead.owner_mi || "",
    owner_last_name: lead.owner_last_name || "",
    owner_mailing_address: lead.owner_mailing_address || lead.mailing_address || "",
    property_manager_phone: lead.property_manager_phone || lead.owner_phone || "",
    property_manager_email: lead.property_manager_email || lead.owner_email || "",
    owner_website: lead.owner_website || "",
    owner_fax: lead.owner_fax || "",

    owner_contact2_first_name: lead.owner_contact2_first_name || "",
    owner_contact2_mi: lead.owner_contact2_mi || "",
    owner_contact2_last_name: lead.owner_contact2_last_name || "",
    owner_contact2_name: lead.owner_contact2_name || "",
    owner_contact2_title: lead.owner_contact2_title || "",
    owner_phone2: lead.owner_phone2 || "",
    owner_email2: lead.owner_email2 || "",

    property_address: lead.property_address || "",
    county: lead.county || "",
    city: lead.city || "",
    state: lead.state || "NC",
    zip: lead.zip || "",

    contractor_name: lead.contractor_name || "",
    contractor_owner_first_name: lead.contractor_owner_first_name || "",
    contractor_owner_mi: lead.contractor_owner_mi || "",
    contractor_owner_last_name: lead.contractor_owner_last_name || "",
    contractor_address: lead.contractor_address || "",
    contractor_city: lead.contractor_city || "",
    contractor_state: lead.contractor_state || "NC",
    contractor_zip: lead.contractor_zip || "",
    contractor_phone: lead.contractor_phone || lead.phone || "",
    contractor_email: lead.contractor_email || "",
    contractor_website: lead.contractor_website || "",
    contractor_fax: lead.contractor_fax || "",

    contractor_contact2_first_name: lead.contractor_contact2_first_name || "",
    contractor_contact2_mi: lead.contractor_contact2_mi || "",
    contractor_contact2_last_name: lead.contractor_contact2_last_name || "",
    contractor_contact2_name: lead.contractor_contact2_name || "",
    contractor_contact2_title: lead.contractor_contact2_title || "",
    contractor_phone2: lead.contractor_phone2 || "",
    contractor_email2: lead.contractor_email2 || "",
    contractor_extra_contacts: safeExtraContacts(lead.contractor_extra_contacts),

    permit_number: lead.permit_number || "",
    permit_date: lead.permit_date || "",
    permit_type: lead.permit_type || "",
    permit_description: lead.permit_description || "",
    permit_status: lead.permit_status || "",
    damage_type: lead.damage_type || "",
    flood_zone: lead.flood_zone || "",
    estimated_value: lead.estimated_value || "",
    total_construction_cost: lead.total_construction_cost || "",
    source_name: lead.source_name || "",
    source_url: lead.source_url || "",
    source_record_date: lead.source_record_date || "",
    source_year: lead.source_year || "",
    source_month: lead.source_month || "",
    notes: lead.notes || "",
  };
}

function formToLeadPayload(form) {
  const ownerContact2Name = form.owner_contact2_name || [form.owner_contact2_first_name, form.owner_contact2_mi, form.owner_contact2_last_name].filter(Boolean).join(" ");
  const contractorContact2Name = form.contractor_contact2_name || [form.contractor_contact2_first_name, form.contractor_contact2_mi, form.contractor_contact2_last_name].filter(Boolean).join(" ");

  const payload = {
    lead_name: form.lead_name || form.owner_name || form.contractor_name || form.property_address || null,
    lead_category: form.lead_category || null,
    lead_status: form.lead_status || "New",
    lead_score: form.lead_score === "" ? null : Number(form.lead_score),

    owner_name: form.owner_name || null,
    owner_first_name: form.owner_first_name || null,
    owner_mi: form.owner_mi || null,
    owner_last_name: form.owner_last_name || null,
    owner_mailing_address: form.owner_mailing_address || null,
    property_manager_phone: form.property_manager_phone || null,
    property_manager_email: form.property_manager_email || null,
    owner_website: form.owner_website || null,
    owner_fax: form.owner_fax || null,

    owner_contact2_first_name: form.owner_contact2_first_name || null,
    owner_contact2_mi: form.owner_contact2_mi || null,
    owner_contact2_last_name: form.owner_contact2_last_name || null,
    owner_contact2_name: ownerContact2Name || null,
    owner_contact2_title: form.owner_contact2_title || null,
    owner_phone2: form.owner_phone2 || null,
    owner_email2: form.owner_email2 || null,

    property_address: form.property_address || null,
    county: form.county || null,
    city: form.city || null,
    state: form.state || null,
    zip: form.zip || null,

    contractor_name: form.contractor_name || null,
    contractor_owner_first_name: form.contractor_owner_first_name || null,
    contractor_owner_mi: form.contractor_owner_mi || null,
    contractor_owner_last_name: form.contractor_owner_last_name || null,
    contractor_address: form.contractor_address || null,
    contractor_city: form.contractor_city || null,
    contractor_state: form.contractor_state || null,
    contractor_zip: form.contractor_zip || null,
    contractor_phone: form.contractor_phone || null,
    contractor_email: form.contractor_email || null,
    contractor_website: form.contractor_website || null,
    contractor_fax: form.contractor_fax || null,

    contractor_contact2_first_name: form.contractor_contact2_first_name || null,
    contractor_contact2_mi: form.contractor_contact2_mi || null,
    contractor_contact2_last_name: form.contractor_contact2_last_name || null,
    contractor_contact2_name: contractorContact2Name || null,
    contractor_contact2_title: form.contractor_contact2_title || null,
    contractor_phone2: form.contractor_phone2 || null,
    contractor_email2: form.contractor_email2 || null,
    contractor_extra_contacts: Array.isArray(form.contractor_extra_contacts) && form.contractor_extra_contacts.length ? form.contractor_extra_contacts : null,

    permit_number: form.permit_number || null,
    permit_date: form.permit_date || null,
    permit_type: form.permit_type || null,
    permit_description: form.permit_description || null,
    permit_status: form.permit_status || null,
    damage_type: form.damage_type || null,
    flood_zone: form.flood_zone || null,
    estimated_value: form.estimated_value === "" ? null : Number(form.estimated_value),
    total_construction_cost: form.total_construction_cost === "" ? null : Number(form.total_construction_cost),
    source_name: form.source_name || null,
    source_url: form.source_url || null,
    source_record_date: form.source_record_date || null,
    source_year: form.source_year === "" ? null : Number(form.source_year),
    source_month: form.source_month === "" ? null : Number(form.source_month),
    notes: form.notes || null,
  };

  Object.keys(payload).forEach((key) => {
    if (Number.isNaN(payload[key])) payload[key] = null;
  });

  return payload;
}

function timestampLine() {
  return new Date().toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function appendNote(existing, entry) {
  const current = String(existing || "").trim();
  return current ? `${entry}\n\n${current}` : entry;
}

async function logMeaningfulActivity({ lead, actionType, actionText, contactLabel, currentNotes, setCurrentNotes, onLeadPatch }) {
  const entry = `${timestampLine()}\n${actionText}${contactLabel ? ` — ${contactLabel}` : ""}`;
  const updatedNotes = appendNote(currentNotes, entry);

  await supabase.from("activity_log").insert({
    lead_id: lead.id,
    action_type: actionType,
    action_text: actionText,
    contact_label: contactLabel || null,
    note_text: entry,
  });

  await supabase.from("leads").update({ notes: updatedNotes }).eq("id", lead.id);

  if (setCurrentNotes) setCurrentNotes(updatedNotes);
  if (onLeadPatch) onLeadPatch({ notes: updatedNotes });

  return updatedNotes;
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, ...props }) {
  return <input style={fieldStyle} value={value || ""} onChange={(e) => onChange(e.target.value)} {...props} />;
}

function SelectInput({ value, onChange, children }) {
  return <select style={fieldStyle} value={value || ""} onChange={(e) => onChange(e.target.value)}>{children}</select>;
}

function ReportModal({ report, onClose }) {
  if (!report) return null;

  const printReport = () => window.print();

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000,
      display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: 18,
    }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 1100, overflow: "hidden" }}>
        <div style={{ background: "#1A5FA8", color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{report.title}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Generated {new Date().toLocaleString()} · {report.rows.length} records</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={printReport} style={{ padding: "8px 14px", border: "none", borderRadius: 6, background: "#27ae60", color: "#fff", fontWeight: 800 }}>Print</button>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "none", borderRadius: 6, background: "#ef4444", color: "#fff", fontWeight: 800 }}>Close</button>
          </div>
        </div>

        {report.rows.length === 0 ? (
          <div style={{ padding: 35, textAlign: "center", color: "#64748b" }}>No records found.</div>
        ) : (
          <div style={{ padding: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {report.columns.map((c) => (
                    <th key={c.key} style={{ textAlign: "left", borderBottom: "2px solid #dbe6f5", padding: 8, color: "#184f89" }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, idx) => (
                  <tr key={row.id || idx} style={{ background: idx % 2 ? "#f8fafc" : "#fff" }}>
                    {report.columns.map((c) => (
                      <td key={c.key} style={{ borderBottom: "1px solid #edf2f7", padding: 8, verticalAlign: "top" }}>{c.render ? c.render(row) : row[c.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadModal({ lead, onClose, onSaved, onDeleted, onPrev, onNext, hasPrev, hasNext }) {
  const [tab, setTab] = useState("edit");
  const [form, setForm] = useState(() => leadToForm(lead));
  const [followUps, setFollowUps] = useState([]);
  const [newFU, setNewFU] = useState({ fu_date: "", fu_time: "", fu_type: "Phone Call", fu_status: "Scheduled", fu_notes: "" });
  const [saving, setSaving] = useState(false);
  const [loadingFU, setLoadingFU] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(leadToForm(lead));
    setMessage("");
  }, [lead]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const patchLeadLocal = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const loadFollowUps = useCallback(async () => {
    if (!lead?.id) return;
    setLoadingFU(true);
    const { data, error } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("lead_id", lead.id)
      .order("fu_date", { ascending: true });

    setLoadingFU(false);
    if (!error) setFollowUps(data || []);
  }, [lead?.id]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  const saveAll = async () => {
    setSaving(true);
    setMessage("");

    const payload = formToLeadPayload(form);
    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", lead.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      return;
    }

    onSaved(data);
    setMessage("Saved.");
  };

  const deleteLead = async () => {
    if (!window.confirm("Delete this lead from Supabase?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      return;
    }
    onDeleted(lead.id);
    onClose();
  };

  const openWebsite = (url) => {
    const clean = String(url || "").trim();
    if (!clean) return;
    window.open(clean.startsWith("http") ? clean : `https://${clean}`, "_blank");
  };

  const handleLookup = (side) => {
    const query =
      side === "owner"
        ? [form.owner_name, form.property_address, form.city, form.state].filter(Boolean).join(" ")
        : [form.contractor_name, form.contractor_address, form.contractor_city, form.contractor_state].filter(Boolean).join(" ");
    if (!query.trim()) {
      setMessage("Nothing to look up yet.");
      return;
    }
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
  };

  const handleCall = async (phone, label) => {
    if (!phone) return;
    await logMeaningfulActivity({
      lead,
      actionType: "phone_call",
      actionText: `Phone call made to ${phone}`,
      contactLabel: label,
      currentNotes: form.notes,
      setCurrentNotes: (notes) => set("notes", notes),
      onLeadPatch: patchLeadLocal,
    });
    window.location.href = `tel:${cleanPhone(phone)}`;
  };

  const handleEmail = async (email, label) => {
    if (!email) return;
    await logMeaningfulActivity({
      lead,
      actionType: "email",
      actionText: `Email prepared/sent to ${email}`,
      contactLabel: label,
      currentNotes: form.notes,
      setCurrentNotes: (notes) => set("notes", notes),
      onLeadPatch: patchLeadLocal,
    });
    window.location.href = `mailto:${email}`;
  };

  const createLetterFor = async ({ name, address, city, state, zip, label }) => {
    const cityLine = [city, state, zip].filter(Boolean).join(", ");
    const firstName = name ? name.split(/\s+/)[0] : "Sir or Madam";
    const dateStr = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Letter</title>
<style>
body{font-family:Cambria,'Times New Roman',serif;font-size:12pt;line-height:1.55;margin:0.75in 1in;color:#000}
button{font-family:Arial,sans-serif;margin-bottom:18px;padding:8px 16px;background:#1A5FA8;color:#fff;border:none;border-radius:5px;font-weight:bold}
@media print{button{display:none}}
</style></head><body>
<button onclick="window.print()">Print Letter</button>
<h2>Woodys Lead Program</h2>
<p><b>Woody Scarboro</b><br>Archdale, NC</p>
<p>${dateStr}</p>
<p>${name || ""}<br>${address || ""}<br>${cityLine}</p>
<p>Dear ${firstName}:</p>
<p style="color:#777;font-style:italic">[Begin your letter here.]</p>
<br><br>
<p>Sincerely,</p>
<br><br>
<p>_____________________________<br><b>Woody Scarboro</b></p>
</body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();

    await logMeaningfulActivity({
      lead,
      actionType: "letter",
      actionText: `Letter created for ${name || "contact"}`,
      contactLabel: label,
      currentNotes: form.notes,
      setCurrentNotes: (notes) => set("notes", notes),
      onLeadPatch: patchLeadLocal,
    });
  };

  const createLetter = (side) => {
    if (side === "owner") {
      return createLetterFor({
        name: form.owner_name,
        address: form.owner_mailing_address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        label: "Owner",
      });
    }
    return createLetterFor({
      name: form.contractor_name,
      address: form.contractor_address,
      city: form.contractor_city,
      state: form.contractor_state,
      zip: form.contractor_zip,
      label: "Contractor",
    });
  };

  const printLabel = async (side) => {
    const isOwner = side === "owner";
    const name = isOwner ? form.owner_name : form.contractor_name;
    const addr = isOwner ? form.owner_mailing_address : form.contractor_address;
    const city = isOwner ? form.city : form.contractor_city;
    const state = isOwner ? form.state : form.contractor_state;
    const zip = isOwner ? form.zip : form.contractor_zip;
    const cityLine = [city, state, zip].filter(Boolean).join(", ");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mailing Label</title>
<style>
body{font-family:Arial,sans-serif;margin:.5in}.label{width:2.625in;height:1in;border:1px dashed #aaa;padding:8px 10px;box-sizing:border-box;display:inline-flex;flex-direction:column;justify-content:center;margin-right:16px}
button{margin-bottom:14px;padding:7px 20px;background:#1A5FA8;color:#fff;border:none;border-radius:5px;font-weight:bold}@media print{button{display:none}}
</style></head><body><button onclick="window.print()">Print Label</button>
<div class="label"><b>Woodys Lead Program</b><br>Archdale, NC</div>
<div class="label"><b>${name || ""}</b><br>${addr || ""}<br>${cityLine}</div>
</body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();

    await logMeaningfulActivity({
      lead,
      actionType: "letter",
      actionText: `Mailing label created for ${name || "contact"}`,
      contactLabel: isOwner ? "Owner" : "Contractor",
      currentNotes: form.notes,
      setCurrentNotes: (notes) => set("notes", notes),
      onLeadPatch: patchLeadLocal,
    });
  };

  const addFollowUp = async () => {
    if (!newFU.fu_date) {
      setMessage("Choose a follow-up date first.");
      return;
    }

    const insertPayload = {
      lead_id: lead.id,
      fu_date: newFU.fu_date,
      fu_time: newFU.fu_time || null,
      fu_type: newFU.fu_type || "Phone Call",
      fu_status: newFU.fu_status || "Scheduled",
      fu_notes: newFU.fu_notes || null,
    };

    const { data, error } = await supabase.from("follow_ups").insert(insertPayload).select().single();
    if (error) {
      setMessage(`Follow-up save failed: ${error.message}`);
      return;
    }

    setFollowUps((prev) => [...prev, data]);
    setNewFU({ fu_date: "", fu_time: "", fu_type: "Phone Call", fu_status: "Scheduled", fu_notes: "" });

    await logMeaningfulActivity({
      lead,
      actionType: "follow_up",
      actionText: `Follow-up scheduled: ${insertPayload.fu_type} on ${insertPayload.fu_date}${insertPayload.fu_time ? ` at ${insertPayload.fu_time}` : ""}`,
      contactLabel: insertPayload.fu_status,
      currentNotes: form.notes,
      setCurrentNotes: (notes) => set("notes", notes),
      onLeadPatch: patchLeadLocal,
    });
  };

  const updateFollowUp = async (fu, patch) => {
    const next = { ...fu, ...patch };
    const { error } = await supabase.from("follow_ups").update(patch).eq("id", fu.id);
    if (!error) {
      setFollowUps((prev) => prev.map((item) => (item.id === fu.id ? next : item)));
      if (patch.fu_status) {
        await logMeaningfulActivity({
          lead,
          actionType: "follow_up",
          actionText: `Follow-up marked ${patch.fu_status}: ${fu.fu_type || ""} ${fu.fu_date || ""}`,
          contactLabel: fu.fu_notes || "",
          currentNotes: form.notes,
          setCurrentNotes: (notes) => set("notes", notes),
          onLeadPatch: patchLeadLocal,
        });
      }
    }
  };

  const deleteFollowUp = async (fu) => {
    if (!window.confirm("Delete this follow-up?")) return;
    const { error } = await supabase.from("follow_ups").delete().eq("id", fu.id);
    if (!error) setFollowUps((prev) => prev.filter((item) => item.id !== fu.id));
  };

  const addContractorContact = () => {
    setForm((f) => ({
      ...f,
      contractor_extra_contacts: [
        ...(Array.isArray(f.contractor_extra_contacts) ? f.contractor_extra_contacts : []),
        { first: "", mi: "", last: "", title: "", phone: "", email: "" },
      ],
    }));
  };

  const updateContractorContact = (index, key, value) => {
    setForm((f) => {
      const contacts = [...(Array.isArray(f.contractor_extra_contacts) ? f.contractor_extra_contacts : [])];
      contacts[index] = { ...(contacts[index] || {}), [key]: value };
      return { ...f, contractor_extra_contacts: contacts };
    });
  };

  const removeContractorContact = (index) => {
    setForm((f) => {
      const contacts = [...(Array.isArray(f.contractor_extra_contacts) ? f.contractor_extra_contacts : [])];
      contacts.splice(index, 1);
      return { ...f, contractor_extra_contacts: contacts };
    });
  };

  const POSITION_OPTIONS = [
    "Owner", "Secretary", "Assistant", "Office Manager", "Builder / Contractor", "Project Manager",
    "Foreman", "Receptionist", "Sales Rep", "Agent", "Property Manager", "Superintendent",
    "Estimator", "Site Manager", "Other"
  ];

  const FieldRow = ({ label, children }) => (
    <div style={{ display: "grid", gridTemplateColumns: "190px minmax(0, 1fr)", gap: 8, alignItems: "center", marginBottom: 7 }}>
      <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
      {children}
    </div>
  );

  const NameRow = ({ label, firstKey, miKey, lastKey }) => (
    <FieldRow label={label}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr", gap: 6 }}>
        <TextInput placeholder="First" value={form[firstKey]} onChange={(v) => set(firstKey, v)} />
        <TextInput placeholder="MI" value={form[miKey]} onChange={(v) => set(miKey, v)} />
        <TextInput placeholder="Last" value={form[lastKey]} onChange={(v) => set(lastKey, v)} />
      </div>
    </FieldRow>
  );

  const CityStateZipRow = ({ cityKey, stateKey, zipKey, lookupSide }) => (
    <FieldRow label="City / State / Zip">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 120px 90px", gap: 6 }}>
        <TextInput placeholder="City" value={form[cityKey]} onChange={(v) => set(cityKey, v)} />
        <TextInput placeholder="State" value={form[stateKey]} onChange={(v) => set(stateKey, v)} />
        <TextInput placeholder="Zip" value={form[zipKey]} onChange={(v) => set(zipKey, v)} />
        <button onClick={() => handleLookup(lookupSide)} style={smallBlue}>Lookup</button>
      </div>
    </FieldRow>
  );

  const ActionRow = ({ label, value, onChange, type, contactLabel }) => (
    <FieldRow label={label}>
      <div style={{ display: "flex", gap: 6 }}>
        <TextInput value={value} onChange={onChange} />
        {type === "phone" && <button onClick={() => handleCall(value, contactLabel)} style={smallBlue}>Call</button>}
        {type === "email" && <button onClick={() => handleEmail(value, contactLabel)} style={smallGreen}>Email</button>}
        {type === "website" && <button onClick={() => openWebsite(value)} style={smallBlue}>Open</button>}
      </div>
    </FieldRow>
  );

  const ContactNameRow = ({ contact, index }) => (
    <FieldRow label="Name">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr", gap: 6 }}>
        <TextInput placeholder="First" value={contact.first || ""} onChange={(v) => updateContractorContact(index, "first", v)} />
        <TextInput placeholder="MI" value={contact.mi || ""} onChange={(v) => updateContractorContact(index, "mi", v)} />
        <TextInput placeholder="Last" value={contact.last || ""} onChange={(v) => updateContractorContact(index, "last", v)} />
      </div>
    </FieldRow>
  );

  const ContactBlock = ({ contact, index }) => {
    const fullName = [contact.first, contact.mi, contact.last].filter(Boolean).join(" ");
    return (
      <div style={{ borderTop: "1px solid #dbe6f5", marginTop: 12, paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#184f89", fontWeight: 800, marginBottom: 6 }}>
          <span>Contact #{index + 2} (Contractor)</span>
          <button onClick={() => removeContractorContact(index)} style={smallRed}>Remove</button>
        </div>
        <ContactNameRow contact={contact} index={index} />
        <FieldRow label="Position">
          <SelectInput value={contact.title || ""} onChange={(v) => updateContractorContact(index, "title", v)}>
            <option value="">Select...</option>
            {POSITION_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </SelectInput>
        </FieldRow>
        <FieldRow label="Phone">
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={contact.phone || ""} onChange={(v) => updateContractorContact(index, "phone", v)} />
            <button onClick={() => handleCall(contact.phone, `Contractor Contact #${index + 2}`)} style={smallBlue}>Call</button>
          </div>
        </FieldRow>
        <FieldRow label="Email">
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={contact.email || ""} onChange={(v) => updateContractorContact(index, "email", v)} />
            <button onClick={() => handleEmail(contact.email, `Contractor Contact #${index + 2}`)} style={smallGreen}>Email</button>
          </div>
        </FieldRow>
        <div style={{ marginLeft: 198, marginTop: 6 }}>
          <button
            onClick={() => createLetterFor({
              name: fullName,
              address: form.contractor_address,
              city: form.contractor_city,
              state: form.contractor_state,
              zip: form.contractor_zip,
              label: `Contractor Contact #${index + 2}`,
            })}
            style={smallGreen}
          >
            Open Letter for Contact #{index + 2}
          </button>
        </div>
      </div>
    );
  };

  const sectionTitle = {
    margin: "16px 0 8px",
    paddingBottom: 4,
    borderBottom: "1px solid #dbe6f5",
    color: "#184f89",
    fontWeight: 900,
    fontSize: 15,
  };
  const td = { borderBottom: "1px solid #edf2f7", padding: 7, verticalAlign: "top" };
  const smallBlue = { padding: "7px 12px", border: "none", borderRadius: 5, background: "#1A5FA8", color: "#fff", fontWeight: 800, cursor: "pointer" };
  const smallGreen = { padding: "7px 12px", border: "none", borderRadius: 5, background: "#27ae60", color: "#fff", fontWeight: 800, cursor: "pointer" };
  const smallRed = { padding: "7px 12px", border: "none", borderRadius: 5, background: "#dc2626", color: "#fff", fontWeight: 800, cursor: "pointer" };
  const smallGray = { padding: "7px 12px", border: "none", borderRadius: 5, background: "#64748b", color: "#fff", fontWeight: 800, cursor: "pointer" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "94vw", maxWidth: 1180, maxHeight: "94vh", background: "#fff", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", background: "#f4f7fb", borderBottom: "1px solid #dbe6f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: "#184f89", fontSize: 18 }}>Lead Detail — {getLeadName({ ...lead, ...form })}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{form.county || "No county"} · {form.property_address || form.contractor_address || "No address"}</div>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <button disabled={!hasPrev} onClick={onPrev} style={smallBlue}>Previous</button>
            <button disabled={!hasNext} onClick={onNext} style={smallBlue}>Next</button>
            <button onClick={saveAll} disabled={saving} style={smallGreen}>{saving ? "Saving..." : "Save All Changes"}</button>
            <button onClick={deleteLead} style={smallRed}>Delete This Lead</button>
            <button onClick={onClose} style={smallGray}>Close</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5edf7" }}>
          {[
            ["edit", "Edit Info"],
            ["schedule", "Schedule Follow-Up"],
            ["history", "Follow-Up History"],
            ["summary", "Lead Summary"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "10px 16px", border: "none", background: tab === key ? "#1A5FA8" : "#fff",
              color: tab === key ? "#fff" : "#184f89", fontWeight: 800, cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>

        {message && <div style={{ padding: "8px 16px", background: "#fff7ed", color: "#9a3412", fontSize: 13 }}>{message}</div>}

        <div style={{ overflowY: "auto", padding: 16, flex: 1 }}>
          {tab === "edit" && (
            <div>
              <div style={sectionTitle}>Lead Category</div>
              <FieldRow label="Lead Category">
                <SelectInput value={form.lead_category} onChange={(v) => set("lead_category", v)}>
                  <option value="">Select...</option>
                  {COMMON_CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{displayCategory(c)}</option>)}
                </SelectInput>
              </FieldRow>

              <div style={sectionTitle}>Lead Status</div>
              <FieldRow label="Lead Status">
                <SelectInput value={form.lead_status} onChange={(v) => set("lead_status", v)}>
                  {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </SelectInput>
              </FieldRow>

              <div style={sectionTitle}>Owner / Property Contact</div>
              <FieldRow label="Owner / Company Name"><TextInput value={form.owner_name} onChange={(v) => set("owner_name", v)} /></FieldRow>
              <NameRow label="Owner Contact Name" firstKey="owner_first_name" miKey="owner_mi" lastKey="owner_last_name" />
              <FieldRow label="Property Address"><TextInput value={form.property_address} onChange={(v) => set("property_address", v)} /></FieldRow>
              <FieldRow label="Mailing Address"><TextInput value={form.owner_mailing_address} onChange={(v) => set("owner_mailing_address", v)} /></FieldRow>
              <CityStateZipRow cityKey="city" stateKey="state" zipKey="zip" lookupSide="owner" />
              <ActionRow label="Phone Number" value={form.property_manager_phone} onChange={(v) => set("property_manager_phone", v)} type="phone" contactLabel="Owner" />
              <ActionRow label="Email Address" value={form.property_manager_email} onChange={(v) => set("property_manager_email", v)} type="email" contactLabel="Owner" />
              <ActionRow label="Website" value={form.owner_website} onChange={(v) => set("owner_website", v)} type="website" contactLabel="Owner" />
              <FieldRow label="Fax"><TextInput value={form.owner_fax} onChange={(v) => set("owner_fax", v)} /></FieldRow>
              <FieldRow label="County"><TextInput value={form.county} onChange={(v) => set("county", v)} /></FieldRow>

              <div style={{ borderTop: "1px solid #dbe6f5", marginTop: 12, paddingTop: 10, color: "#184f89", fontWeight: 800 }}>
                Second Contact (Owner Side)
              </div>
              <NameRow label="Contact Name" firstKey="owner_contact2_first_name" miKey="owner_contact2_mi" lastKey="owner_contact2_last_name" />
              <FieldRow label="Position">
                <SelectInput value={form.owner_contact2_title} onChange={(v) => set("owner_contact2_title", v)}>
                  <option value="">Select...</option>
                  {POSITION_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                </SelectInput>
              </FieldRow>
              <ActionRow label="Phone" value={form.owner_phone2} onChange={(v) => set("owner_phone2", v)} type="phone" contactLabel="Owner Contact 2" />
              <ActionRow label="Email" value={form.owner_email2} onChange={(v) => set("owner_email2", v)} type="email" contactLabel="Owner Contact 2" />
              <div style={{ marginLeft: 198, display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button onClick={() => printLabel("owner")} style={smallGreen}>Print Owner Mailing Label</button>
                <button onClick={() => createLetter("owner")} style={smallGreen}>Open Letter in Word (Owner)</button>
              </div>

              <div style={sectionTitle}>Contractor</div>
              <FieldRow label="Company Name"><TextInput value={form.contractor_name} onChange={(v) => set("contractor_name", v)} /></FieldRow>
              <NameRow label="Company Owner" firstKey="contractor_owner_first_name" miKey="contractor_owner_mi" lastKey="contractor_owner_last_name" />
              <FieldRow label="Business Address"><TextInput value={form.contractor_address} onChange={(v) => set("contractor_address", v)} /></FieldRow>
              <CityStateZipRow cityKey="contractor_city" stateKey="contractor_state" zipKey="contractor_zip" lookupSide="contractor" />
              <ActionRow label="Phone Number" value={form.contractor_phone} onChange={(v) => set("contractor_phone", v)} type="phone" contactLabel="Contractor" />
              <ActionRow label="Email Address" value={form.contractor_email} onChange={(v) => set("contractor_email", v)} type="email" contactLabel="Contractor" />
              <ActionRow label="Website" value={form.contractor_website} onChange={(v) => set("contractor_website", v)} type="website" contactLabel="Contractor" />
              <FieldRow label="Fax"><TextInput value={form.contractor_fax} onChange={(v) => set("contractor_fax", v)} /></FieldRow>
              <div style={{ marginLeft: 198, display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button onClick={() => printLabel("contractor")} style={smallGreen}>Print Mailing Label</button>
                <button onClick={() => createLetter("contractor")} style={smallGreen}>Letter to Company Owner</button>
              </div>

              <div style={{ borderTop: "1px solid #dbe6f5", marginTop: 12, paddingTop: 10, color: "#184f89", fontWeight: 800 }}>
                Contact #1 (Contractor)
              </div>
              <NameRow label="Name" firstKey="contractor_contact2_first_name" miKey="contractor_contact2_mi" lastKey="contractor_contact2_last_name" />
              <FieldRow label="Position">
                <SelectInput value={form.contractor_contact2_title} onChange={(v) => set("contractor_contact2_title", v)}>
                  <option value="">Select...</option>
                  {POSITION_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                </SelectInput>
              </FieldRow>
              <ActionRow label="Phone" value={form.contractor_phone2} onChange={(v) => set("contractor_phone2", v)} type="phone" contactLabel="Contractor Contact #1" />
              <ActionRow label="Email" value={form.contractor_email2} onChange={(v) => set("contractor_email2", v)} type="email" contactLabel="Contractor Contact #1" />
              <div style={{ marginLeft: 198, marginBottom: 12 }}>
                <button
                  onClick={() => createLetterFor({
                    name: [form.contractor_contact2_first_name, form.contractor_contact2_mi, form.contractor_contact2_last_name].filter(Boolean).join(" "),
                    address: form.contractor_address,
                    city: form.contractor_city,
                    state: form.contractor_state,
                    zip: form.contractor_zip,
                    label: "Contractor Contact #1",
                  })}
                  style={smallGreen}
                >
                  Open Letter for Contact #1
                </button>
              </div>

              {(Array.isArray(form.contractor_extra_contacts) ? form.contractor_extra_contacts : []).map((contact, index) => (
                <ContactBlock key={index} contact={contact} index={index} />
              ))}
              <div style={{ marginTop: 12 }}>
                <button onClick={addContractorContact} style={smallBlue}>Add New Contact at Contractor</button>
              </div>

              <div style={sectionTitle}>Permit / Source Details</div>
              <FieldRow label="Permit #"><TextInput value={form.permit_number} onChange={(v) => set("permit_number", v)} /></FieldRow>
              <FieldRow label="Date"><TextInput type="date" value={form.permit_date} onChange={(v) => set("permit_date", v)} /></FieldRow>
              <FieldRow label="Permit Type"><TextInput value={form.permit_type} onChange={(v) => set("permit_type", v)} /></FieldRow>
              <FieldRow label="Permit Status"><TextInput value={form.permit_status} onChange={(v) => set("permit_status", v)} /></FieldRow>
              <FieldRow label="Estimated Value"><TextInput type="number" value={form.estimated_value} onChange={(v) => set("estimated_value", v)} /></FieldRow>
              <FieldRow label="Construction Cost"><TextInput type="number" value={form.total_construction_cost} onChange={(v) => set("total_construction_cost", v)} /></FieldRow>
              <FieldRow label="Description"><textarea style={{ ...fieldStyle, minHeight: 70 }} value={form.permit_description || ""} onChange={(e) => set("permit_description", e.target.value)} /></FieldRow>
              <FieldRow label="Source Name"><TextInput value={form.source_name} onChange={(v) => set("source_name", v)} /></FieldRow>
              <ActionRow label="Source URL" value={form.source_url} onChange={(v) => set("source_url", v)} type="website" contactLabel="Source" />

              <div style={sectionTitle}>Notes</div>
              <textarea
                value={form.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
                style={{ ...fieldStyle, minHeight: 230, lineHeight: 1.55, fontFamily: "inherit" }}
              />
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                New activity notes are limited to calls, emails, letters, mailing labels, and scheduled follow-ups.
              </div>
            </div>
          )}

          {tab === "schedule" && (
            <div>
              <div style={sectionTitle}>Schedule Follow-Up</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <FormField label="Date"><TextInput type="date" value={newFU.fu_date} onChange={(v) => setNewFU((f) => ({ ...f, fu_date: v }))} /></FormField>
                <FormField label="Time"><TextInput type="time" value={newFU.fu_time} onChange={(v) => setNewFU((f) => ({ ...f, fu_time: v }))} /></FormField>
                <FormField label="Type"><SelectInput value={newFU.fu_type} onChange={(v) => setNewFU((f) => ({ ...f, fu_type: v }))}>{FOLLOW_UP_TYPES.map((s) => <option key={s}>{s}</option>)}</SelectInput></FormField>
                <FormField label="Status"><SelectInput value={newFU.fu_status} onChange={(v) => setNewFU((f) => ({ ...f, fu_status: v }))}>{FOLLOW_UP_STATUSES.map((s) => <option key={s}>{s}</option>)}</SelectInput></FormField>
              </div>
              <FormField label="Notes"><textarea style={{ ...fieldStyle, minHeight: 100 }} value={newFU.fu_notes} onChange={(e) => setNewFU((f) => ({ ...f, fu_notes: e.target.value }))} /></FormField>
              <button onClick={addFollowUp} style={smallGreen}>Schedule Follow-Up</button>
            </div>
          )}

          {tab === "history" && (
            <div>
              <div style={sectionTitle}>Follow-Up History</div>
              {loadingFU ? (
                <div style={{ padding: 12 }}>Loading follow-ups...</div>
              ) : followUps.length === 0 ? (
                <div style={{ padding: 12, color: "#64748b" }}>No follow-ups scheduled.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 }}>
                  <thead>
                    <tr>{["Date", "Time", "Type", "Status", "Notes", ""].map((h) => <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #dbe6f5", padding: 7 }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {followUps.map((fu) => (
                      <tr key={fu.id}>
                        <td style={td}>{fu.fu_date}</td>
                        <td style={td}>{fu.fu_time}</td>
                        <td style={td}>{fu.fu_type}</td>
                        <td style={td}>
                          <select value={fu.fu_status || "Scheduled"} onChange={(e) => updateFollowUp(fu, { fu_status: e.target.value })} style={{ ...fieldStyle, padding: 5 }}>
                            {FOLLOW_UP_STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={td}>{fu.fu_notes}</td>
                        <td style={td}><button onClick={() => deleteFollowUp(fu)} style={smallRed}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "summary" && (
            <div>
              <div style={sectionTitle}>Lead Summary</div>
              <p><b>Name:</b> {getLeadName({ ...lead, ...form })}</p>
              <p><b>Category:</b> {displayCategory(form.lead_category)}</p>
              <p><b>Status:</b> {form.lead_status}</p>
              <p><b>Score:</b> {form.lead_score}</p>
              <p><b>County:</b> {form.county}</p>
              <p><b>Owner:</b> {form.owner_name}</p>
              <p><b>Property Address:</b> {form.property_address}</p>
              <p><b>Owner Mailing Address:</b> {form.owner_mailing_address}</p>
              <p><b>Contractor:</b> {form.contractor_name}</p>
              <p><b>Contractor Address:</b> {form.contractor_address}</p>
              <p><b>Phone:</b> {getLeadPhone({ ...lead, ...form })}</p>
              <p><b>Email:</b> {getLeadEmail({ ...lead, ...form })}</p>
              <p><b>Website:</b> {getLeadWebsite({ ...lead, ...form })}</p>
              <p><b>Permit #:</b> {form.permit_number}</p>
              <p><b>Permit Type:</b> {form.permit_type}</p>
              <p><b>Estimated Value:</b> {form.estimated_value}</p>
              <p><b>Source:</b> {form.source_name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddProspectModal({ onClose, onSaved }) {
  const [form, setForm] = useState(() => leadToForm({ lead_status: "New", state: "NC", contractor_state: "NC" }));
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.owner_name && !form.contractor_name && !form.lead_name) return;
    setSaving(true);
    const payload = {
      ...formToLeadPayload(form),
      source_name: "Manual Web Entry",
      source_record_date: todayISO(),
    };

    const { data, error } = await supabase.from("leads").insert(payload).select().single();
    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    onSaved(data);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "90vw", maxWidth: 760, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ padding: 14, background: "#f4f7fb", borderBottom: "1px solid #dbe6f5", display: "flex", justifyContent: "space-between" }}>
          <b style={{ color: "#184f89" }}>Add New Contact / Prospect</b>
          <button onClick={onClose} style={smallGray}>Close</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={grid2}>
            <FormField label="Lead Name"><TextInput value={form.lead_name} onChange={(v) => set("lead_name", v)} /></FormField>
            <FormField label="Lead Category"><TextInput value={form.lead_category} onChange={(v) => set("lead_category", v)} placeholder="builder, new_home_owner, etc." /></FormField>
          </div>
          <div style={sectionTitle}>Owner / Property</div>
          <FormField label="Owner Name"><TextInput value={form.owner_name} onChange={(v) => set("owner_name", v)} /></FormField>
          <FormField label="Property Address"><TextInput value={form.property_address} onChange={(v) => set("property_address", v)} /></FormField>
          <div style={grid4}>
            <FormField label="City"><TextInput value={form.city} onChange={(v) => set("city", v)} /></FormField>
            <FormField label="State"><TextInput value={form.state} onChange={(v) => set("state", v)} /></FormField>
            <FormField label="Zip"><TextInput value={form.zip} onChange={(v) => set("zip", v)} /></FormField>
            <FormField label="County"><TextInput value={form.county} onChange={(v) => set("county", v)} /></FormField>
          </div>
          <FormField label="Owner Phone"><TextInput value={form.property_manager_phone} onChange={(v) => set("property_manager_phone", v)} /></FormField>
          <FormField label="Owner Email"><TextInput value={form.property_manager_email} onChange={(v) => set("property_manager_email", v)} /></FormField>

          <div style={sectionTitle}>Contractor</div>
          <FormField label="Contractor Name"><TextInput value={form.contractor_name} onChange={(v) => set("contractor_name", v)} /></FormField>
          <FormField label="Contractor Address"><TextInput value={form.contractor_address} onChange={(v) => set("contractor_address", v)} /></FormField>
          <div style={grid3}>
            <FormField label="City"><TextInput value={form.contractor_city} onChange={(v) => set("contractor_city", v)} /></FormField>
            <FormField label="State"><TextInput value={form.contractor_state} onChange={(v) => set("contractor_state", v)} /></FormField>
            <FormField label="Zip"><TextInput value={form.contractor_zip} onChange={(v) => set("contractor_zip", v)} /></FormField>
          </div>
          <FormField label="Phone"><TextInput value={form.contractor_phone} onChange={(v) => set("contractor_phone", v)} /></FormField>
          <FormField label="Email"><TextInput value={form.contractor_email} onChange={(v) => set("contractor_email", v)} /></FormField>
          <FormField label="Website"><TextInput value={form.contractor_website} onChange={(v) => set("contractor_website", v)} /></FormField>

          <button onClick={save} disabled={saving} style={smallGreen}>{saving ? "Saving..." : "Save New Contact"}</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterCounty, setFilterCounty] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const buildLeadQuery = useCallback((withCount = true) => {
    let query = supabase.from("leads").select("*", withCount ? { count: "exact" } : undefined);

    if (filterCounty !== "All") query = query.eq("county", filterCounty);
    if (filterCategory !== "All") query = query.eq("lead_category", filterCategory);
    if (filterStatus !== "All") query = query.eq("lead_status", filterStatus);

    const s = search.trim();
    if (s) {
      const pattern = `%${s.replace(/[%_]/g, "")}%`;
      query = query.or([
        `lead_name.ilike.${pattern}`,
        `owner_name.ilike.${pattern}`,
        `contractor_name.ilike.${pattern}`,
        `property_address.ilike.${pattern}`,
        `county.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `zip.ilike.${pattern}`,
        `contractor_phone.ilike.${pattern}`,
        `property_manager_phone.ilike.${pattern}`,
        `contractor_email.ilike.${pattern}`,
        `property_manager_email.ilike.${pattern}`,
        `permit_number.ilike.${pattern}`,
      ].join(","));
    }

    return query;
  }, [filterCounty, filterCategory, filterStatus, search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error: fetchError, count } = await buildLeadQuery(true)
      .order("lead_score", { ascending: false, nullsFirst: false })
      .order("lead_name", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (fetchError) {
      setError(fetchError.message);
      setLeads([]);
      setTotalCount(0);
    } else {
      setLeads(data || []);
      setTotalCount(count || 0);
    }

    setLoading(false);
  }, [buildLeadQuery, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setPage(1);
  }, [search, filterCounty, filterCategory, filterStatus]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedLeadId(null);
  }, [page, search, filterCounty, filterCategory, filterStatus]);

  const selectedLead = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) : null;
  const editingLeadIndex = editingLead ? leads.findIndex((l) => l.id === editingLead.id) : -1;

  const pageNumbers = useMemo(() => {
    if (totalPages <= 20) return Array.from({ length: totalPages }, (_, i) => i + 1);
    return Array.from(new Set([
      1, 2,
      ...Array.from({ length: 15 }, (_, i) => page - 7 + i).filter((p) => p >= 1 && p <= totalPages),
      totalPages - 1, totalPages
    ])).sort((a, b) => a - b);
  }, [page, totalPages]);

  const handleSaved = (updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
    setEditingLead((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    setSelectedLeadId(updated.id);
  };

  const handleDeleted = (id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedLeadId(null);
    setEditingLead(null);
    setTotalCount((c) => Math.max(0, c - 1));
  };

  const handleAdded = (lead) => {
    setLeads((prev) => [lead, ...prev]);
    setTotalCount((c) => c + 1);
  };

  const updateLeadStatus = async (lead, status) => {
    const { data, error: updateError } = await supabase
      .from("leads")
      .update({ lead_status: status })
      .eq("id", lead.id)
      .select()
      .single();

    if (!updateError && data) handleSaved(data);
  };

  const runActivityReport = async (scope) => {
    const now = todayISO();
    let from = now;
    let title = "Today's Activity";

    if (scope === "week") {
      from = dateDaysFromNow(-7);
      title = "Last 7 Days Activity";
    } else if (scope === "month") {
      from = dateDaysFromNow(-30);
      title = "Last 30 Days Activity";
    }

    const { data, error: reportError } = await supabase
      .from("activity_log")
      .select("*, leads(lead_name, owner_name, contractor_name, property_address, county, property_manager_phone, contractor_phone)")
      .gte("created_at", `${from}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (reportError) {
      alert(reportError.message);
      return;
    }

    setReport({
      title,
      rows: data || [],
      columns: [
        { key: "created_at", label: "Date/Time", render: (r) => formatDateTime(r.created_at) },
        { key: "action_type", label: "Type" },
        { key: "name", label: "Lead", render: (r) => getLeadName(r.leads || {}) },
        { key: "phone", label: "Phone", render: (r) => getLeadPhone(r.leads || {}) },
        { key: "action_text", label: "Activity" },
        { key: "note_text", label: "Notes" },
      ],
    });
  };

  const runFollowUpReport = async (scope) => {
    const today = todayISO();
    let to = today;
    let title = "Today's Follow-Ups";

    if (scope === "week") {
      to = dateDaysFromNow(7);
      title = "Next 7 Days Follow-Ups";
    } else if (scope === "month") {
      to = dateDaysFromNow(30);
      title = "Next 30 Days Follow-Ups";
    } else if (scope === "all") {
      to = "2999-12-31";
      title = "All Scheduled Follow-Ups";
    }

    const { data, error: reportError } = await supabase
      .from("follow_ups")
      .select("*, leads(lead_name, owner_name, contractor_name, property_address, county, property_manager_phone, contractor_phone)")
      .gte("fu_date", today)
      .lte("fu_date", to)
      .order("fu_date", { ascending: true })
      .limit(1000);

    if (reportError) {
      alert(reportError.message);
      return;
    }

    setReport({
      title,
      rows: data || [],
      columns: [
        { key: "fu_date", label: "Date" },
        { key: "fu_time", label: "Time" },
        { key: "fu_type", label: "Type" },
        { key: "fu_status", label: "Status" },
        { key: "name", label: "Lead", render: (r) => getLeadName(r.leads || {}) },
        { key: "phone", label: "Phone", render: (r) => getLeadPhone(r.leads || {}) },
        { key: "fu_notes", label: "Notes" },
      ],
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="dashboard">
      <header className="header" style={{ position: "sticky", top: 0, zIndex: 300 }}>
        <div className="header-left">
          <h1>Woodys Lead Program</h1>
          <span className="header-subtitle">Supabase Web Portal</span>
        </div>
        <div className="header-right">
          <span className="user-email">{user?.email}</span>
          <button className="logout-btn" onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <div className="stats-bar" style={{ position: "sticky", top: 62, zIndex: 275 }}>
        <div className="stat-card"><span className="stat-number">{totalCount.toLocaleString()}</span><span className="stat-label">Total Leads</span></div>
        <div className="stat-card"><span className="stat-number">{page}</span><span className="stat-label">Page</span></div>
        <div className="stat-card"><span className="stat-number">{totalPages}</span><span className="stat-label">Pages</span></div>
        <div className="stat-card"><span className="stat-number">{leads.length.toLocaleString()}</span><span className="stat-label">Shown</span></div>
      </div>

      <div className="filters" style={{
        position: "sticky",
        top: 122,
        zIndex: 250,
        background: "#fff",
        boxShadow: "0 3px 10px rgba(0,0,0,.14)",
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
        borderBottom: "1px solid #cfdbea",
      }}>
        <input className="search-input" type="text" placeholder="Search name, address, phone, email, permit..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filterCounty} onChange={(e) => setFilterCounty(e.target.value)}>
          {COMMON_COUNTIES.map((c) => <option key={c} value={c}>{c === "All" ? "All Counties" : c}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          {COMMON_CATEGORIES.map((c) => <option key={c} value={c}>{c === "All" ? "All Categories" : displayCategory(c)}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="refresh-btn" onClick={fetchLeads}>Refresh</button>
        <button onClick={() => setShowAddProspect(true)} style={smallGreen}>+ Add Contact</button>
        <button onClick={() => runActivityReport("today")} style={smallBlue}>Daily Activity</button>
        <button onClick={() => runActivityReport("week")} style={smallBlue}>Weekly Activity</button>
        <button onClick={() => runFollowUpReport("week")} style={smallBlue}>Follow-Ups</button>
      </div>

      {error && <div style={{ margin: 12, padding: 10, background: "#fee2e2", color: "#991b1b", borderRadius: 6 }}>{error}</div>}

      <div className="content" style={{ paddingBottom: 92 }}>
        <div style={{ padding: "10px 14px", color: "#64748b", fontSize: 13 }}>
          Showing {totalCount ? ((page - 1) * PAGE_SIZE + 1).toLocaleString() : 0} - {Math.min(page * PAGE_SIZE, totalCount).toLocaleString()} of {totalCount.toLocaleString()} leads
        </div>

        {loading ? (
          <div className="loading-screen"><div className="loading-spinner"></div><p>Loading leads...</p></div>
        ) : leads.length === 0 ? (
          <div className="empty-state"><p>No leads found.</p></div>
        ) : (
          <div style={{ overflowX: "auto", padding: "0 12px 12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Score", "Status", "Category", "Lead Name", "Property Address", "County", "City", "Zip", "Owner", "Builder / Contractor", "Phone"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 7px", background: "#eaf1fa", color: "#0f4c81", borderBottom: "1px solid #cfdbea", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => (
                  <tr key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    onDoubleClick={() => { setSelectedLeadId(lead.id); setEditingLead(lead); }}
                    style={{ background: selectedLeadId === lead.id ? "#bfdbfe" : index % 2 ? "#f8fafc" : "#fff", cursor: "pointer" }}>
                    <td style={td}>{lead.lead_score ? `${lead.lead_score}/10` : ""}</td>
                    <td style={td}>
                      <select value={lead.lead_status || "New"} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLeadStatus(lead, e.target.value)}
                        style={{ border: "none", borderRadius: 12, color: "#fff", background: STATUS_COLORS[lead.lead_status || "New"] || "#64748b", padding: "3px 7px", fontSize: 12 }}>
                        {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={td}>{displayCategory(lead.lead_category)}</td>
                    <td style={td}>{getLeadName(lead)}</td>
                    <td style={td}>{lead.property_address}</td>
                    <td style={td}>{lead.county}</td>
                    <td style={td}>{lead.city}</td>
                    <td style={td}>{lead.zip}</td>
                    <td style={td}>{lead.owner_name}</td>
                    <td style={td}>{lead.contractor_name}</td>
                    <td style={td}>{getLeadPhone(lead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 900,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 7,
          padding: "10px 12px 14px",
          flexWrap: "wrap",
          background: "#ffffff",
          borderTop: "1px solid #cfdbea",
          boxShadow: "0 -3px 12px rgba(15, 76, 129, 0.12)"
        }}>
          <span style={{ color: "#184f89", fontWeight: 800, fontSize: 13, marginRight: 8 }}>
            Page {page} of {totalPages} | {PAGE_SIZE.toLocaleString()} leads per page | showing {leads.length.toLocaleString()} of {totalCount.toLocaleString()}
          </span>
          <button style={smallBlue} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
          {pageNumbers.map((p, idx) => {
            const prev = pageNumbers[idx - 1];
            return (
              <React.Fragment key={p}>
                {idx > 0 && p > prev + 1 && <span style={{ padding: "0 5px", color: "#64748b" }}>...</span>}
                <button onClick={() => setPage(p)} style={p === page ? smallGreen : smallBlue}>{p}</button>
              </React.Fragment>
            );
          })}
          <button style={smallBlue} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
          <span style={{ marginLeft: 10, fontSize: 13, color: "#334155" }}>Go to:</span>
          <input type="number" min="1" max={totalPages} value={page} onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
            style={{ width: 65, padding: 6, border: "1px solid #cfdbea", borderRadius: 4 }} />
        </div>
      </div>

      {editingLead && (
        <LeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onPrev={() => {
            if (editingLeadIndex > 0) {
              const prevLead = leads[editingLeadIndex - 1];
              setSelectedLeadId(prevLead.id);
              setEditingLead(prevLead);
            }
          }}
          onNext={() => {
            if (editingLeadIndex >= 0 && editingLeadIndex < leads.length - 1) {
              const nextLead = leads[editingLeadIndex + 1];
              setSelectedLeadId(nextLead.id);
              setEditingLead(nextLead);
            }
          }}
          hasPrev={editingLeadIndex > 0}
          hasNext={editingLeadIndex >= 0 && editingLeadIndex < leads.length - 1}
        />
      )}

      {showAddProspect && <AddProspectModal onClose={() => setShowAddProspect(false)} onSaved={handleAdded} />}

      <ReportModal report={report} onClose={() => setReport(null)} />
    </div>
  );
}

const sectionTitle = {
  margin: "10px 0 9px",
  color: "#184f89",
  borderBottom: "1px solid #dbe6f5",
  paddingBottom: 5,
  fontWeight: 900,
};

const grid2 = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 };
const grid3 = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 };
const grid4 = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 };

const td = {
  padding: "7px",
  borderBottom: "1px solid #edf2f7",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 230,
};

const smallBlue = {
  background: "#1A5FA8",
  color: "#fff",
  border: "none",
  borderRadius: 5,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const smallGreen = {
  background: "#27ae60",
  color: "#fff",
  border: "none",
  borderRadius: 5,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const smallRed = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  borderRadius: 5,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const smallGray = {
  background: "#e5e7eb",
  color: "#334155",
  border: "none",
  borderRadius: 5,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

export default Dashboard;
