// src/sharedControls.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api, primeCSRF } from "./api";

export function currency(num) {
  if (num == null || Number.isNaN(num)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD" }).format(num);
}

export function TextInput(props) {
  return <input {...props} className={`w-full px-3 py-2 rounded-md border outline-none ${props.className || ""}`} />;
}
export function NumberInput(props) {
  return <input type="number" step="0.01" {...props} className={`w-full px-3 py-2 rounded-md border outline-none ${props.className || ""}`} />;
}
export function Button({ children, ...rest }) {
  return <button {...rest} className={`px-4 py-2 rounded-xl border shadow-sm active:scale-[0.99] ${rest.className || ""}`}>{children}</button>;
}
export function Card({ children }) { return <div className="rounded-2xl bg-white shadow-sm border p-4">{children}</div>; }

// ---- Currency Select with "Recent 5" ----
const DEFAULT_CURRENCIES = ["CAD","USD","THB","JPY","EUR","GBP","AUD","NZD","SGD","PHP","VND","IDR"];

export function CurrencySelect({ value, onChange, all = DEFAULT_CURRENCIES, canWrite = false }) {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/recent-currencies/");
        setRecent(r.data || []);
      } catch {}
    })();
  }, []);

  const ordered = useMemo(() => {
    const dedup = new Set(recent.filter(c => all.includes(c)).concat(all));
    return Array.from(dedup);
  }, [recent, all]);

  const handleChange = async (e) => {
    const code = e.target.value;
    onChange(code);
    if (canWrite) {
      try {
        await primeCSRF();
        await api.post("/recent-currencies/", { code });
      } catch {}
    }
  };

  const recentPinned = recent.filter(c => all.includes(c));

  return (
    <select className="w-full px-3 py-2 rounded-md border" value={value} onChange={handleChange}>
      {recentPinned.length > 0 && (
        <optgroup label="Recent">
          {recentPinned.map(c => <option key={`r-${c}`} value={c}>{c}</option>)}
        </optgroup>
      )}
      <optgroup label="All">
        {ordered.map(c => <option key={c} value={c}>{c}</option>)}
      </optgroup>
    </select>
  );
}

// ---- PaidBy: Party toggle -> Person select ----
export function PaidByPicker({ value, onChange }) {
  const [people, setPeople] = useState([]);
  const [partyFilter, setPartyFilter] = useState("household"); // 'household' | 'bev'

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/people/");
        setPeople(r.data || []);
      } catch {}
    })();
  }, []);

  const filtered = useMemo(() => {
    return people.filter(p => {
      const party = p.party || {};
      if (partyFilter === "household") return !!party.is_household || party.slug === "household";
      return !party.is_household || party.slug === "bev";
    });
  }, [people, partyFilter]);

  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="party" value="household"
                 checked={partyFilter === "household"}
                 onChange={() => setPartyFilter("household")} />
          Household
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="party" value="bev"
                 checked={partyFilter === "bev"}
                 onChange={() => setPartyFilter("bev")} />
          Bev
        </label>
      </div>
      <select className="w-full px-3 py-2 rounded-md border" value={value ?? ""} onChange={e => onChange(Number(e.target.value))}>
        <option value="">Select person…</option>
        {filtered.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
