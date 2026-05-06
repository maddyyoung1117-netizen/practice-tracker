import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Pencil, Trash2, Mail, Phone,
  Linkedin, MessageSquare, Calendar, MapPin, Building2,
  FileText, Clock, Filter, Package, ShieldCheck,
  AlertCircle, Inbox, ExternalLink, ChevronDown,
  List, Map as MapIcon, UserPlus, Loader2, Tag, Target, Sparkles
} from 'lucide-react';

const STORAGE_KEY = 'crm:practices:v1';

// Storage adapter — uses browser localStorage so data persists between visits.
// Note: data is per-browser. Switching from Chrome to Safari or wiping browser data
// will mean a fresh start. Use the export feature regularly.
const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('localStorage save failed', e);
    }
  },
};

const STATUSES = [
  { id: 'new',            label: 'New',             color: '#3B5F8A', bg: '#E5EDF6' },
  { id: 'researching',    label: 'Researching',     color: '#7C6F5F', bg: '#EFEAE0' },
  { id: 'outreach',       label: 'Outreach Sent',   color: '#A8741A', bg: '#F7EDD6' },
  { id: 'engaged',        label: 'Engaged',         color: '#2D6A4F', bg: '#DCEDE1' },
  { id: 'demo_scheduled', label: 'Demo Scheduled',  color: '#5B3D90', bg: '#EAE0F4' },
  { id: 'demo_done',      label: 'Demo Done',       color: '#0E6B6B', bg: '#D2E7E7' },
  { id: 'customer',       label: 'Customer',        color: '#1F4E3D', bg: '#C8DDD2' },
  { id: 'not_interested', label: 'Not Interested',  color: '#8B4646', bg: '#F0E0E0' },
  { id: 'paused',         label: 'Nurture',         color: '#6B6357', bg: '#E5DED0' },
];

const SPECIALTIES = [
  'Psychiatry',
  'Integrative / Functional',
  'DPC / Concierge',
  'Internal Medicine',
  'Family Medicine',
  'Pain Management',
  'Wellness / Med Spa',
  'Neurology',
  'Government',
  'Other',
];

const ACTIVITY_TYPES = [
  { id: 'email',    label: 'Email',          icon: Mail },
  { id: 'linkedin', label: 'LinkedIn',       icon: Linkedin },
  { id: 'text',     label: 'Text',           icon: MessageSquare },
  { id: 'call',     label: 'Call',           icon: Phone },
  { id: 'demo',     label: 'Demo / Meeting', icon: Calendar },
  { id: 'note',     label: 'Note',           icon: FileText },
];

const ORDER_TYPES = [
  { id: 'in_office',      label: 'In-Office (Practitioner Discount)', short: 'In-office' },
  { id: 'patient_direct', label: 'Patient Direct (SMN)',              short: 'Patient direct' },
  { id: 'refill',         label: 'Refill / Repeat',                   short: 'Refill' },
  { id: 'accessories',    label: 'Accessories / Pads',                short: 'Accessories' },
];

const DEAL_POTENTIAL = [
  { id: '',       label: 'Not sized yet' },
  { id: 'small',  label: 'Small (1–2 units)' },
  { id: 'medium', label: 'Medium (3–10 units)' },
  { id: 'large',  label: 'Large (10+ units)' },
];

const CONTACT_PREFERENCES = [
  { id: '',          label: 'No preference set' },
  { id: 'email',     label: 'Email',           icon: Mail },
  { id: 'text',      label: 'Text',            icon: MessageSquare },
  { id: 'phone',     label: 'Phone',           icon: Phone },
  { id: 'linkedin',  label: 'LinkedIn',        icon: Linkedin },
  { id: 'in_person', label: 'In-person visit', icon: Building2 },
];

const getStatus = (id) => STATUSES.find(s => s.id === id) || STATUSES[0];
const getActivityType = (id) => ACTIVITY_TYPES.find(a => a.id === id) || ACTIVITY_TYPES[5];
const getOrderType = (id) => ORDER_TYPES.find(o => o.id === id) || ORDER_TYPES[0];
const getContactPref = (id) => CONTACT_PREFERENCES.find(c => c.id === id) || CONTACT_PREFERENCES[0];
const getDealPotential = (id) => DEAL_POTENTIAL.find(d => d.id === id) || DEAL_POTENTIAL[0];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function blankProvider() {
  return { id: uid(), name: '', title: '', email: '', phone: '', linkedin: '' };
}

function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function relativeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round((d - now) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return `In ${days}d`;
  if (days >= 7 && days < 30) return `In ${Math.floor(days / 7)}w`;
  if (days < -1 && days > -7) return `${Math.abs(days)}d ago`;
  if (days <= -7 && days > -30) return `${Math.floor(Math.abs(days) / 7)}w ago`;
  return fmtShort(iso);
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function migrate(list) {
  return (list || []).map(p => {
    const next = { ...p };
    if (!Array.isArray(next.providers)) {
      next.providers = [];
      if (next.providerName) {
        next.providers.push({
          id: uid(), name: next.providerName, title: '',
          email: next.email || '', phone: next.phone || '', linkedin: next.linkedin || '',
        });
      }
      delete next.providerName;
    }
    if (!next.address && next.city) next.address = next.city;
    if (!Array.isArray(next.orders)) next.orders = [];
    if (!Array.isArray(next.tags)) next.tags = [];
    if (next.source == null) next.source = '';
    if (next.dealPotential == null) next.dealPotential = '';
    if (next.preferredContact == null) next.preferredContact = '';
    if (next.isIndependent == null) next.isIndependent = false;
    return next;
  });
}

// CSV export utility — backup safety net for localStorage data
function downloadCSV(practices) {
  const headers = [
    'Name', 'Address', 'Specialty', 'Status', 'Independent',
    'Deal Potential', 'Source', 'Preferred Contact', 'Tags',
    'Providers', 'Last Contact', 'Next Follow-up',
    'Total Units', 'Order Count', 'Touch Count', 'Notes',
  ];
  const rows = practices.map(p => {
    const totalUnits = (p.orders || []).reduce((s, o) => s + (Number(o.units) || 0), 0);
    const providers = (p.providers || []).map(pr =>
      [pr.name, pr.title, pr.email, pr.phone].filter(Boolean).join(' / ')
    ).join(' | ');
    return [
      p.name || '',
      p.address || '',
      p.specialty || '',
      getStatus(p.status).label,
      p.isIndependent ? 'Yes' : 'No',
      getDealPotential(p.dealPotential).label,
      p.source || '',
      getContactPref(p.preferredContact).label,
      (p.tags || []).join(', '),
      providers,
      p.lastContact ? new Date(p.lastContact).toLocaleDateString('en-US') : '',
      p.nextFollowUp || '',
      totalUnits,
      (p.orders || []).length,
      (p.activities || []).length,
      p.notes || '',
    ];
  });
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `practice-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Small UI ----------

function StatusBadge({ statusId, size = 'sm' }) {
  const s = getStatus(statusId);
  const sizeCls = size === 'sm' ? 'text-[11px] px-2 py-[3px]' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center rounded-full font-medium tracking-wide ${sizeCls}`}
      style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="px-5 py-4 rounded-lg border" style={{ backgroundColor: '#FBF8F0', borderColor: '#E5DECC' }}>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] mb-2" style={{ color: '#857B6A' }}>
        {label}
      </div>
      <div className="text-3xl font-medium leading-none" style={{ color: accent || '#1F1B16', fontFamily: 'Fraunces, serif' }}>
        {value}
      </div>
    </div>
  );
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const addTag = (val) => {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };
  const removeTag = (t) => onChange(tags.filter(x => x !== t));
  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded border bg-white min-h-[40px]"
      style={{ borderColor: '#D9D1BF' }}>
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          style={{ backgroundColor: '#EFEAE0', color: '#3D3830' }}>
          {t}
          <button onClick={() => removeTag(t)} className="hover:opacity-70" type="button">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) addTag(v.slice(0, -1));
          else setInput(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addTag(input); }
          else if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1));
        }}
        onBlur={() => input && addTag(input)}
        className="flex-1 min-w-[100px] outline-none text-sm bg-transparent"
        style={{ color: '#1F1B16' }}
        placeholder={tags.length === 0 ? 'qEEG, trauma-focused, DEA…' : ''}
      />
    </div>
  );
}

function ProviderRow({ provider, index, onChange, onRemove, canRemove }) {
  const update = (field, value) => onChange({ ...provider, [field]: value });
  const inputCls = "w-full px-2.5 py-1.5 text-sm rounded border bg-white focus:outline-none";
  const inputStyle = { borderColor: '#D9D1BF', color: '#1F1B16' };
  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: '#E5DECC', backgroundColor: '#FFFFFF' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: '#857B6A' }}>
          Provider {index + 1}
        </span>
        {canRemove && (
          <button onClick={onRemove} className="p-1 rounded hover:bg-black/5" style={{ color: '#857B6A' }} type="button">
            <X size={13} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} style={inputStyle} value={provider.name}
          onChange={(e) => update('name', e.target.value)} placeholder="Name (e.g. Dr. Jane Smith)" />
        <input className={inputCls} style={inputStyle} value={provider.title}
          onChange={(e) => update('title', e.target.value)} placeholder="Title (MD, NP, PA…)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="email" className={inputCls} style={inputStyle} value={provider.email}
          onChange={(e) => update('email', e.target.value)} placeholder="Email" />
        <input className={inputCls} style={inputStyle} value={provider.phone}
          onChange={(e) => update('phone', e.target.value)} placeholder="Phone" />
      </div>
      <input className={inputCls} style={inputStyle} value={provider.linkedin}
        onChange={(e) => update('linkedin', e.target.value)} placeholder="LinkedIn URL or handle" />
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] mb-3 pb-2 border-b"
        style={{ color: '#857B6A', borderColor: '#E5DECC' }}>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PracticeForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: '', address: '', specialty: '', website: '',
    status: 'new', nextFollowUp: '', notes: '',
    source: '', tags: [], dealPotential: '', preferredContact: '', isIndependent: false,
    ...initial,
    providers: (initial?.providers && initial.providers.length > 0)
      ? initial.providers : [blankProvider()],
    tags: initial?.tags || [],
  }));
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const updateProvider = (i, provider) => {
    setForm(prev => ({ ...prev, providers: prev.providers.map((p, idx) => idx === i ? provider : p) }));
  };
  const addProvider = () => setForm(prev => ({ ...prev, providers: [...prev.providers, blankProvider()] }));
  const removeProvider = (i) => setForm(prev => ({ ...prev, providers: prev.providers.filter((_, idx) => idx !== i) }));
  const inputCls = "w-full px-3 py-2 text-sm rounded border bg-white focus:outline-none";
  const inputStyle = { borderColor: '#D9D1BF', color: '#1F1B16' };
  const labelCls = "block text-[11px] font-medium uppercase tracking-[0.1em] mb-1.5";
  const labelStyle = { color: '#857B6A' };
  const canSave = form.name.trim().length > 0;

  const handleSave = () => {
    const out = { ...form };
    if (initial && initial.address && initial.address !== out.address) {
      out.lat = null; out.lng = null; out.geocodeFailed = false;
    }
    out.providers = out.providers.filter(p => p.name.trim() || p.email.trim() || p.phone.trim());
    onSave(out);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(31,27,22,0.4)' }}>
      <div className="w-full max-w-xl rounded-xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#FBF8F0' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E5DECC' }}>
          <h2 className="text-xl font-medium" style={{ fontFamily: 'Fraunces, serif', color: '#1F1B16' }}>
            {initial?.id ? 'Edit practice' : 'New practice'}
          </h2>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-black/5" style={{ color: '#6B6357' }} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          <FormSection title="Practice">
            <div>
              <label className={labelCls} style={labelStyle}>Practice name *</label>
              <input className={inputCls} style={inputStyle} value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Atlanta Integrative Psychiatry" autoFocus />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Address</label>
              <input className={inputCls} style={inputStyle} value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="123 Main St, Alpharetta, GA 30022" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Specialty</label>
                <select className={inputCls} style={inputStyle} value={form.specialty}
                  onChange={(e) => update('specialty', e.target.value)}>
                  <option value="">Choose…</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Website</label>
                <input className={inputCls} style={inputStyle} value={form.website}
                  onChange={(e) => update('website', e.target.value)} placeholder="practice.com" />
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isIndependent}
                onChange={(e) => update('isIndependent', e.target.checked)} className="mt-0.5" />
              <span className="text-sm" style={{ color: '#1F1B16' }}>
                Confirmed independent
                <span className="block text-xs" style={{ color: '#857B6A' }}>
                  Not affiliated with Northside, Emory, Piedmont, Wellstar, LifeStance, or Geode.
                </span>
              </span>
            </label>
          </FormSection>

          <FormSection title="Pipeline">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Status</label>
                <select className={inputCls} style={inputStyle} value={form.status}
                  onChange={(e) => update('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Next follow-up</label>
                <input type="date" className={inputCls} style={inputStyle} value={form.nextFollowUp}
                  onChange={(e) => update('nextFollowUp', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Deal potential</label>
                <select className={inputCls} style={inputStyle} value={form.dealPotential}
                  onChange={(e) => update('dealPotential', e.target.value)}>
                  {DEAL_POTENTIAL.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Source</label>
                <input className={inputCls} style={inputStyle} value={form.source}
                  onChange={(e) => update('source', e.target.value)}
                  placeholder="LinkedIn search, referral, conference…" />
              </div>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Preferred contact method</label>
              <select className={inputCls} style={inputStyle} value={form.preferredContact}
                onChange={(e) => update('preferredContact', e.target.value)}>
                {CONTACT_PREFERENCES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </FormSection>

          <FormSection title="Providers">
            <div className="flex justify-end -mt-2">
              <button onClick={addProvider}
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: '#2D5F4E' }} type="button">
                <UserPlus size={12} />Add another
              </button>
            </div>
            <div className="space-y-2">
              {form.providers.map((p, i) => (
                <ProviderRow key={p.id || i} provider={p} index={i}
                  onChange={(np) => updateProvider(i, np)}
                  onRemove={() => removeProvider(i)}
                  canRemove={form.providers.length > 1} />
              ))}
            </div>
          </FormSection>

          <FormSection title="Notes & tags">
            <div>
              <label className={labelCls} style={labelStyle}>Tags</label>
              <TagInput tags={form.tags} onChange={(tags) => update('tags', tags)} />
              <p className="text-[11px] mt-1" style={{ color: '#A8A092' }}>
                Press Enter or comma to add. Examples: qEEG, trauma-focused, DEA, Amen analog.
              </p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Notes</label>
              <textarea className={inputCls + ' resize-none'} style={inputStyle} rows={4}
                value={form.notes} onChange={(e) => update('notes', e.target.value)}
                placeholder="Personalization angles, training background, patient population…" />
            </div>
          </FormSection>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: '#E5DECC', backgroundColor: '#F5F1E8' }}>
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded font-medium hover:bg-black/5" style={{ color: '#6B6357' }} type="button">Cancel</button>
          <button onClick={() => canSave && handleSave()} disabled={!canSave}
            className="px-4 py-2 text-sm rounded font-medium disabled:opacity-40"
            style={{ backgroundColor: '#2D5F4E', color: '#FBF8F0' }} type="button">
            {initial?.id ? 'Save changes' : 'Add practice'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PracticeCard({ practice, onClick, isSelected }) {
  const overdueFollowUp = practice.nextFollowUp
    && new Date(practice.nextFollowUp) <= new Date()
    && !['customer', 'not_interested', 'paused'].includes(practice.status);
  const primaryProvider = practice.providers?.[0];
  const extraCount = (practice.providers?.length || 0) - 1;
  const totalUnits = (practice.orders || []).reduce((sum, o) => sum + (Number(o.units) || 0), 0);

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-lg border transition-all duration-150 overflow-hidden"
      style={{
        backgroundColor: isSelected ? '#FBF8F0' : '#FFFFFF',
        borderColor: isSelected ? '#2D5F4E' : '#E8E1D2',
        boxShadow: isSelected ? '0 1px 2px rgba(45,95,78,0.08)' : 'none',
      }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-medium truncate" style={{ color: '#1F1B16', fontFamily: 'Fraunces, serif' }}>
                {practice.name || 'Untitled practice'}
              </h3>
              {practice.isIndependent && <ShieldCheck size={13} style={{ color: '#2D6A4F' }} />}
            </div>
            {primaryProvider?.name && (
              <p className="text-sm mt-0.5 truncate" style={{ color: '#6B6357' }}>
                {primaryProvider.name}
                {primaryProvider.title && <span style={{ color: '#A8A092' }}>, {primaryProvider.title}</span>}
                {extraCount > 0 && <span className="ml-1.5" style={{ color: '#A8A092' }}>+{extraCount} more</span>}
              </p>
            )}
          </div>
          <StatusBadge statusId={practice.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: '#857B6A' }}>
          {practice.specialty && (
            <span className="inline-flex items-center gap-1">
              <Building2 size={12} />{practice.specialty}
            </span>
          )}
          {practice.address && (
            <span className="inline-flex items-center gap-1 truncate max-w-[260px]">
              <MapPin size={12} /><span className="truncate">{practice.address}</span>
            </span>
          )}
          {totalUnits > 0 && (
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: '#2D5F4E' }}>
              <Package size={12} />{totalUnits} unit{totalUnits === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {practice.tags && practice.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {practice.tags.slice(0, 4).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[10px]"
                style={{ backgroundColor: '#EFEAE0', color: '#6B6357' }}>{t}</span>
            ))}
            {practice.tags.length > 4 && (
              <span className="text-[10px]" style={{ color: '#A8A092' }}>+{practice.tags.length - 4}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs">
          {practice.lastContact && (
            <div className="inline-flex items-center gap-1.5" style={{ color: '#857B6A' }}>
              <Clock size={11} /><span>Last touch {relativeDate(practice.lastContact)}</span>
            </div>
          )}
          {practice.nextFollowUp && (
            <div className="inline-flex items-center gap-1.5 font-medium"
              style={{ color: overdueFollowUp ? '#A84522' : '#2D5F4E' }}>
              {overdueFollowUp ? <AlertCircle size={11} /> : <Calendar size={11} />}
              <span>Follow up {relativeDate(practice.nextFollowUp)}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function EmbeddedMap({ address }) {
  if (!address) return null;
  const url = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=14&output=embed`;
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#E5DECC' }}>
      <iframe key={address} src={url} title={`Map of ${address}`}
        style={{ width: '100%', height: 200, border: 0, display: 'block' }}
        loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
        target="_blank" rel="noopener noreferrer"
        className="block px-3 py-2 text-xs font-medium hover:underline"
        style={{ backgroundColor: '#FBF8F0', color: '#2D5F4E' }}>
        Open in Google Maps →
      </a>
    </div>
  );
}

function ProviderCard({ provider }) {
  const has = (f) => f && f.toString().trim();
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: '#E5DECC', backgroundColor: '#FFFFFF' }}>
      <div className="flex items-baseline gap-1.5 mb-1.5 flex-wrap">
        <span className="text-sm font-medium" style={{ color: '#1F1B16' }}>{provider.name || 'Unnamed provider'}</span>
        {provider.title && <span className="text-xs" style={{ color: '#857B6A' }}>{provider.title}</span>}
      </div>
      <div className="flex flex-col gap-1 text-xs">
        {has(provider.email) && (
          <a href={`mailto:${provider.email}`} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: '#2D5F4E' }}>
            <Mail size={11} /><span className="truncate">{provider.email}</span>
          </a>
        )}
        {has(provider.phone) && (
          <a href={`tel:${provider.phone}`} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: '#2D5F4E' }}>
            <Phone size={11} />{provider.phone}
          </a>
        )}
        {has(provider.linkedin) && (
          <a href={provider.linkedin.startsWith('http') ? provider.linkedin : `https://${provider.linkedin}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:underline" style={{ color: '#2D5F4E' }}>
            <Linkedin size={11} /><span className="truncate">LinkedIn</span><ExternalLink size={9} />
          </a>
        )}
      </div>
    </div>
  );
}

function ActivityComposer({ onAdd }) {
  const [type, setType] = useState('email');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const submit = () => {
    onAdd({ type, note: note.trim(), date: new Date(date).toISOString() });
    setNote(''); setDate(todayISO());
  };
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: '#E5DECC', backgroundColor: '#FBF8F0' }}>
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {ACTIVITY_TYPES.map(t => {
          const Icon = t.icon;
          const active = type === t.id;
          return (
            <button key={t.id} onClick={() => setType(t.id)} type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition"
              style={{
                backgroundColor: active ? '#2D5F4E' : 'transparent',
                color: active ? '#FBF8F0' : '#6B6357',
              }}>
              <Icon size={12} />{t.label}
            </button>
          );
        })}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={`Log a ${getActivityType(type).label.toLowerCase()}…`} rows={2}
        className="w-full px-3 py-2 text-sm rounded border bg-white focus:outline-none resize-none"
        style={{ borderColor: '#D9D1BF', color: '#1F1B16' }} />
      <div className="flex items-center justify-between mt-2 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1 text-xs rounded border bg-white"
          style={{ borderColor: '#D9D1BF', color: '#6B6357' }} />
        <button onClick={submit} className="px-3 py-1.5 text-xs rounded font-medium"
          style={{ backgroundColor: '#2D5F4E', color: '#FBF8F0' }} type="button">Log activity</button>
      </div>
    </div>
  );
}

function OrderComposer({ onAdd, onCancel }) {
  const [type, setType] = useState('in_office');
  const [units, setUnits] = useState('1');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayISO());
  const submit = () => {
    const u = parseInt(units, 10);
    if (!u || u < 1) return;
    onAdd({ type, units: u, notes: notes.trim(), date: new Date(date).toISOString() });
    setUnits('1'); setNotes(''); setDate(todayISO());
  };
  const inputCls = "w-full px-2.5 py-1.5 text-sm rounded border bg-white focus:outline-none";
  const inputStyle = { borderColor: '#D9D1BF', color: '#1F1B16' };
  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: '#E5DECC', backgroundColor: '#FBF8F0' }}>
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] mb-1" style={{ color: '#857B6A' }}>Order type</label>
        <select className={inputCls} style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
          {ORDER_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] mb-1" style={{ color: '#857B6A' }}>Units</label>
          <input type="number" min="1" className={inputCls} style={inputStyle}
            value={units} onChange={(e) => setUnits(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] mb-1" style={{ color: '#857B6A' }}>Date</label>
          <input type="date" className={inputCls} style={inputStyle}
            value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)" rows={2}
        className={inputCls + ' resize-none'} style={inputStyle} />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button onClick={onCancel} type="button"
            className="px-3 py-1.5 text-xs rounded font-medium hover:bg-black/5" style={{ color: '#6B6357' }}>
            Cancel
          </button>
        )}
        <button onClick={submit} type="button"
          className="px-3 py-1.5 text-xs rounded font-medium"
          style={{ backgroundColor: '#2D5F4E', color: '#FBF8F0' }}>Log order</button>
      </div>
    </div>
  );
}

function MetaPill({ icon: Icon, label, value, valueColor }) {
  return (
    <div className="rounded-md px-2.5 py-1.5 text-xs" style={{ backgroundColor: '#FBF8F0' }}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium" style={{ color: '#857B6A' }}>
        {Icon && <Icon size={10} />}
        {label}
      </div>
      <div className="mt-0.5 font-medium" style={{ color: valueColor || '#1F1B16' }}>{value}</div>
    </div>
  );
}

function PracticeDetail({ practice, onClose, onEdit, onDelete, onUpdateStatus, onUpdateFollowUp,
                         onAddActivity, onDeleteActivity, onAddOrder, onDeleteOrder }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [showOrderComposer, setShowOrderComposer] = useState(false);
  if (!practice) return null;
  const totalUnits = (practice.orders || []).reduce((sum, o) => sum + (Number(o.units) || 0), 0);
  const orderCount = (practice.orders || []).length;
  const touchCount = (practice.activities || []).length;
  const contactPref = getContactPref(practice.preferredContact);
  const dealPotential = getDealPotential(practice.dealPotential);

  return (
    <div className="rounded-lg border overflow-hidden flex flex-col"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E5DECC', maxHeight: 'calc(100vh - 140px)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: '#E5DECC', backgroundColor: '#FBF8F0' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-medium leading-tight" style={{ fontFamily: 'Fraunces, serif', color: '#1F1B16' }}>
                {practice.name}
              </h2>
              {practice.isIndependent && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: '#DCEDE1', color: '#1F4E3D' }}>
                  <ShieldCheck size={10} />Independent
                </span>
              )}
            </div>
            {practice.address && (
              <p className="text-sm mt-1 inline-flex items-center gap-1" style={{ color: '#6B6357' }}>
                <MapPin size={12} />{practice.address}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} title="Edit" className="p-1.5 rounded hover:bg-black/5" style={{ color: '#6B6357' }} type="button">
              <Pencil size={15} />
            </button>
            <button onClick={() => confirmDelete ? onDelete() : setConfirmDelete(true)}
              title={confirmDelete ? 'Click again to confirm' : 'Delete'}
              className="p-1.5 rounded hover:bg-black/5"
              style={{ color: confirmDelete ? '#A84522' : '#6B6357' }} type="button">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} title="Close" className="p-1.5 rounded hover:bg-black/5" style={{ color: '#6B6357' }} type="button">
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <button onClick={() => setStatusOpen(!statusOpen)} className="inline-flex items-center gap-1.5" type="button">
              <StatusBadge statusId={practice.status} size="md" />
              <ChevronDown size={12} style={{ color: '#857B6A' }} />
            </button>
            {statusOpen && (
              <div className="absolute z-10 mt-1 rounded-lg border shadow-lg py-1 min-w-[180px]"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E5DECC' }}>
                {STATUSES.map(s => (
                  <button key={s.id}
                    onClick={() => { onUpdateStatus(s.id); setStatusOpen(false); }} type="button"
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span style={{ color: '#1F1B16' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {practice.specialty && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#6B6357' }}>
              <Building2 size={11} />{practice.specialty}
            </span>
          )}
          {practice.website && (
            <a href={practice.website.startsWith('http') ? practice.website : `https://${practice.website}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: '#2D5F4E' }}>
              Website<ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetaPill icon={Target} label="Potential" value={dealPotential.label} />
          <MetaPill icon={Package} label="Units ordered" value={totalUnits} valueColor={totalUnits > 0 ? '#2D5F4E' : '#1F1B16'} />
          <MetaPill icon={MessageSquare} label="Touches" value={touchCount} />
          <MetaPill icon={Clock} label="Last touch" value={practice.lastContact ? relativeDate(practice.lastContact) : '—'} />
        </div>

        {(practice.source || practice.preferredContact) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {practice.preferredContact && (
              <div className="inline-flex items-center gap-1.5" style={{ color: '#6B6357' }}>
                {contactPref.icon && <contactPref.icon size={11} />}
                <span>Prefers <strong style={{ color: '#1F1B16' }}>{contactPref.label}</strong></span>
              </div>
            )}
            {practice.source && (
              <div className="inline-flex items-center gap-1.5" style={{ color: '#6B6357' }}>
                <Sparkles size={11} />
                <span>Source: <strong style={{ color: '#1F1B16' }}>{practice.source}</strong></span>
              </div>
            )}
          </div>
        )}

        {practice.tags && practice.tags.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2" style={{ color: '#857B6A' }}>Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {practice.tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                  style={{ backgroundColor: '#EFEAE0', color: '#3D3830' }}>
                  <Tag size={10} />{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {practice.address && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2" style={{ color: '#857B6A' }}>Location</div>
            <EmbeddedMap address={practice.address} />
          </div>
        )}

        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2" style={{ color: '#857B6A' }}>
            Providers ({practice.providers?.length || 0})
          </div>
          {practice.providers && practice.providers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {practice.providers.map(p => <ProviderCard key={p.id} provider={p} />)}
            </div>
          ) : (
            <p className="text-sm italic" style={{ color: '#A8A092' }}>No providers added.</p>
          )}
        </div>

        <div className="rounded-lg p-3 border" style={{ borderColor: '#E5DECC', backgroundColor: '#FBF8F0' }}>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2" style={{ color: '#857B6A' }}>Next follow-up</div>
          <div className="flex items-center gap-2">
            <input type="date" value={practice.nextFollowUp || ''}
              onChange={(e) => onUpdateFollowUp(e.target.value)}
              className="px-2 py-1 text-sm rounded border bg-white flex-1"
              style={{ borderColor: '#D9D1BF', color: '#1F1B16' }} />
            {practice.nextFollowUp && (
              <button onClick={() => onUpdateFollowUp('')} className="text-xs hover:underline" style={{ color: '#857B6A' }} type="button">Clear</button>
            )}
          </div>
        </div>

        {practice.notes && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2" style={{ color: '#857B6A' }}>Notes</div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#1F1B16' }}>{practice.notes}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: '#857B6A' }}>
              Order history {orderCount > 0 && <span style={{ color: '#1F1B16' }}>· {totalUnits} unit{totalUnits === 1 ? '' : 's'} across {orderCount} order{orderCount === 1 ? '' : 's'}</span>}
            </div>
            {!showOrderComposer && (
              <button onClick={() => setShowOrderComposer(true)} type="button"
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: '#2D5F4E' }}>
                <Plus size={11} />Log order
              </button>
            )}
          </div>
          {showOrderComposer && (
            <div className="mb-2">
              <OrderComposer onAdd={(o) => { onAddOrder(o); setShowOrderComposer(false); }}
                onCancel={() => setShowOrderComposer(false)} />
            </div>
          )}
          {orderCount === 0 && !showOrderComposer && (
            <p className="text-sm italic" style={{ color: '#A8A092' }}>No orders logged yet.</p>
          )}
          {orderCount > 0 && (
            <div className="space-y-2">
              {practice.orders.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(o => {
                const t = getOrderType(o.type);
                return (
                  <div key={o.id} className="rounded-lg border p-2.5 group"
                    style={{ borderColor: '#E5DECC', backgroundColor: '#FFFFFF' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-sm font-medium" style={{ color: '#1F1B16' }}>
                              {o.units} unit{o.units === 1 ? '' : 's'}
                            </span>
                            <span className="text-xs" style={{ color: '#6B6357' }}>· {t.short}</span>
                          </div>
                          <span className="text-[11px]" style={{ color: '#857B6A' }}>{fmtShort(o.date)}</span>
                        </div>
                        {o.notes && <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: '#3D3830' }}>{o.notes}</p>}
                      </div>
                      <button onClick={() => onDeleteOrder(o.id)} type="button"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 transition"
                        style={{ color: '#857B6A' }}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2" style={{ color: '#857B6A' }}>Log activity</div>
          <ActivityComposer onAdd={onAddActivity} />
        </div>

        {practice.activities && practice.activities.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2" style={{ color: '#857B6A' }}>Timeline</div>
            <div className="space-y-3">
              {practice.activities.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => {
                const t = getActivityType(a.type);
                const Icon = t.icon;
                return (
                  <div key={a.id} className="flex gap-3 group">
                    <div className="flex-none w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#EFEAE0', color: '#6B6357' }}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium" style={{ color: '#1F1B16' }}>{t.label}</span>
                        <span className="text-[11px]" style={{ color: '#857B6A' }}>{fmtShort(a.date)}</span>
                      </div>
                      {a.note && <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: '#3D3830' }}>{a.note}</p>}
                    </div>
                    <button onClick={() => onDeleteActivity(a.id)} type="button"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 transition self-start"
                      style={{ color: '#857B6A' }}>
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MapView({ practices, onSelect, onGeocoded }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [leafletReady, setLeafletReady] = useState(false);
  const queueRunningRef = useRef(false);

  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.leaflet = 'true';
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-leaflet]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.dataset.leaflet = 'true';
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.L) { setLeafletReady(true); clearInterval(check); }
      }, 100);
      return () => clearInterval(check);
    }
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapDivRef.current, { zoomControl: true }).setView([34.0, -84.2], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
  }, [leafletReady]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    const located = practices.filter(p => p.lat && p.lng);
    located.forEach(p => {
      const status = getStatus(p.status);
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 9, fillColor: status.color, color: '#FBF8F0',
        weight: 2.5, opacity: 1, fillOpacity: 0.92,
      }).addTo(map);
      const primary = p.providers?.[0];
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 180px;">
          <div style="font-weight: 600; font-size: 14px; color: #1F1B16; margin-bottom: 2px;">${escapeHtml(p.name)}</div>
          ${primary?.name ? `<div style="font-size: 12px; color: #6B6357; margin-bottom: 4px;">${escapeHtml(primary.name)}${primary.title ? ', ' + escapeHtml(primary.title) : ''}</div>` : ''}
          ${p.specialty ? `<div style="font-size: 11px; color: #857B6A; margin-bottom: 6px;">${escapeHtml(p.specialty)}</div>` : ''}
          <div style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; background: ${status.bg}; color: ${status.color};">${status.label}</div>
          <div style="margin-top: 8px;"><a href="#" data-id="${p.id}" class="practice-popup-link" style="color: #2D5F4E; font-size: 12px; font-weight: 500; text-decoration: none;">View details →</a></div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        setTimeout(() => {
          const link = document.querySelector(`.practice-popup-link[data-id="${p.id}"]`);
          if (link) link.onclick = (e) => { e.preventDefault(); onSelect(p.id); };
        }, 50);
      });
      markersRef.current.push(marker);
    });
    if (located.length > 0) {
      const bounds = L.latLngBounds(located.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [practices, leafletReady, onSelect]);

  useEffect(() => {
    if (queueRunningRef.current) return;
    const queue = practices.filter(p => p.address && p.lat == null && !p.geocodeFailed);
    if (queue.length === 0) return;
    queueRunningRef.current = true;
    let cancelled = false;
    (async () => {
      for (const p of queue) {
        if (cancelled) break;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(p.address)}&limit=1`,
            { headers: { 'Accept': 'application/json' } }
          );
          const data = await res.json();
          if (cancelled) break;
          if (Array.isArray(data) && data[0]) {
            onGeocoded(p.id, parseFloat(data[0].lat), parseFloat(data[0].lon), false);
          } else {
            onGeocoded(p.id, null, null, true);
          }
        } catch (e) { /* soft fail */ }
        await new Promise(r => setTimeout(r, 1100));
      }
      queueRunningRef.current = false;
    })();
    return () => { cancelled = true; queueRunningRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practices.map(p => p.id + ':' + (p.address || '') + ':' + (p.lat == null ? 'n' : 'y') + ':' + (p.geocodeFailed ? 'f' : '')).join('|')]);

  const located = practices.filter(p => p.lat && p.lng).length;
  const failed = practices.filter(p => p.geocodeFailed).length;
  const pending = practices.filter(p => p.address && p.lat == null && !p.geocodeFailed).length;
  const noAddress = practices.filter(p => !p.address).length;

  return (
    <div className="space-y-3">
      <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#E5DECC' }}>
        <div ref={mapDivRef} style={{ height: 540, width: '100%', backgroundColor: '#EFEAE0' }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs px-1" style={{ color: '#6B6357' }}>
        <span><strong style={{ color: '#1F1B16' }}>{located}</strong> on map</span>
        {pending > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" />
            {pending} locating…
          </span>
        )}
        {failed > 0 && <span style={{ color: '#A84522' }}>{failed} couldn't be located — try editing the address</span>}
        {noAddress > 0 && <span>{noAddress} without an address</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
        {STATUSES.map(s => (
          <span key={s.id} className="inline-flex items-center gap-1.5" style={{ color: '#6B6357' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="rounded-lg border p-12 text-center" style={{ borderColor: '#E5DECC', backgroundColor: '#FBF8F0' }}>
      <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ backgroundColor: '#EFEAE0', color: '#6B6357' }}>
        <Inbox size={22} />
      </div>
      <h3 className="text-xl mb-2" style={{ fontFamily: 'Fraunces, serif', color: '#1F1B16' }}>No practices yet</h3>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: '#6B6357' }}>
        Add your first practice to start tracking outreach, conversations, and follow-ups in one place.
      </p>
      <button onClick={onAdd} type="button"
        className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
        style={{ backgroundColor: '#2D5F4E', color: '#FBF8F0' }}>
        <Plus size={14} />Add a practice
      </button>
    </div>
  );
}

export default function App() {
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState('list');

  useEffect(() => {
    (async () => {
      try {
        const result = await storage.get(STORAGE_KEY);
        if (result?.value) {
          const parsed = JSON.parse(result.value);
          const migrated = migrate(parsed);
          setPractices(migrated);
          if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
            storage.set(STORAGE_KEY, JSON.stringify(migrated)).catch(() => {});
          }
        }
      } catch (e) { /* no data yet */ }
      setLoading(false);
    })();
  }, []);

  const persist = async (data) => {
    try { await storage.set(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) { console.error('Save failed', e); }
  };
  const updateAll = (next) => { setPractices(next); persist(next); };

  const handleSave = (data) => {
    if (data.id) {
      updateAll(practices.map(p => p.id === data.id ? { ...p, ...data } : p));
    } else {
      const newP = { ...data, id: uid(), createdAt: new Date().toISOString(), activities: [], orders: [] };
      updateAll([newP, ...practices]);
      setSelectedId(newP.id);
    }
    setShowForm(false); setEditing(null);
  };
  const handleDelete = (id) => {
    updateAll(practices.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const handleUpdateStatus = (id, status) => updateAll(practices.map(p => p.id === id ? { ...p, status } : p));
  const handleUpdateFollowUp = (id, nextFollowUp) => updateAll(practices.map(p => p.id === id ? { ...p, nextFollowUp } : p));
  const handleAddActivity = (id, activity) => {
    const newAct = { ...activity, id: uid() };
    updateAll(practices.map(p => {
      if (p.id !== id) return p;
      const activities = [newAct, ...(p.activities || [])];
      const latest = activities.reduce((m, a) => new Date(a.date) > new Date(m) ? a.date : m, activities[0].date);
      return { ...p, activities, lastContact: latest };
    }));
  };
  const handleDeleteActivity = (practiceId, activityId) => {
    updateAll(practices.map(p => {
      if (p.id !== practiceId) return p;
      const activities = (p.activities || []).filter(a => a.id !== activityId);
      const lastContact = activities.length
        ? activities.reduce((m, a) => new Date(a.date) > new Date(m) ? a.date : m, activities[0].date) : '';
      return { ...p, activities, lastContact };
    }));
  };
  const handleAddOrder = (id, order) => {
    const newOrder = { ...order, id: uid() };
    updateAll(practices.map(p => {
      if (p.id !== id) return p;
      return { ...p, orders: [newOrder, ...(p.orders || [])] };
    }));
  };
  const handleDeleteOrder = (practiceId, orderId) => {
    updateAll(practices.map(p => {
      if (p.id !== practiceId) return p;
      return { ...p, orders: (p.orders || []).filter(o => o.id !== orderId) };
    }));
  };
  const handleGeocoded = (id, lat, lng, failed) => {
    setPractices(prev => {
      const next = prev.map(p => p.id === id
        ? { ...p, lat: failed ? null : lat, lng: failed ? null : lng, geocodeFailed: !!failed }
        : p);
      persist(next);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return practices.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (specialtyFilter !== 'all' && p.specialty !== specialtyFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const fields = [
          p.name, p.address, p.notes, p.specialty, p.source,
          ...(p.tags || []),
          ...(p.providers || []).flatMap(pr => [pr.name, pr.email, pr.title]),
        ];
        if (!fields.some(f => f && f.toLowerCase().includes(q))) return false;
      }
      return true;
    }).sort((a, b) => {
      const aOverdue = a.nextFollowUp && new Date(a.nextFollowUp) <= new Date() ? 1 : 0;
      const bOverdue = b.nextFollowUp && new Date(b.nextFollowUp) <= new Date() ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      const aDate = a.lastContact || a.createdAt || '';
      const bDate = b.lastContact || b.createdAt || '';
      return bDate.localeCompare(aDate);
    });
  }, [practices, search, statusFilter, specialtyFilter]);

  const stats = useMemo(() => {
    const active = practices.filter(p => !['customer', 'not_interested', 'paused'].includes(p.status)).length;
    const followUpsDue = practices.filter(p => {
      if (!p.nextFollowUp) return false;
      if (['customer', 'not_interested', 'paused'].includes(p.status)) return false;
      return new Date(p.nextFollowUp) <= new Date();
    }).length;
    const customers = practices.filter(p => p.status === 'customer').length;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const touchesThisWeek = practices.reduce((sum, p) => {
      const recent = (p.activities || []).filter(a => new Date(a.date) >= weekAgo);
      return sum + recent.length;
    }, 0);
    return { total: practices.length, active, followUpsDue, customers, touchesThisWeek };
  }, [practices]);

  const selected = practices.find(p => p.id === selectedId);
  const hasFilters = statusFilter !== 'all' || specialtyFilter !== 'all' || search.trim();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F1E8', fontFamily: 'Manrope, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Manrope:wght@400;500;600;700&display=swap');
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23857B6A' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        .leaflet-popup-content-wrapper { border-radius: 8px; }
        .leaflet-popup-content { margin: 12px; }
      `}</style>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-7">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] mb-1" style={{ color: '#857B6A' }}>
                Sales workspace
              </div>
              <h1 className="text-4xl font-medium leading-none" style={{ fontFamily: 'Fraunces, serif', color: '#1F1B16' }}>
                Practice <span className="italic" style={{ color: '#2D5F4E' }}>tracker</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => downloadCSV(practices)}
                disabled={practices.length === 0}
                title="Export all practices to CSV"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded border text-sm font-medium disabled:opacity-40"
                style={{ borderColor: '#E5DECC', backgroundColor: '#FFFFFF', color: '#6B6357' }} type="button">
                <FileText size={14} />Export
              </button>
              <button onClick={() => { setEditing(null); setShowForm(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium shadow-sm"
                style={{ backgroundColor: '#2D5F4E', color: '#FBF8F0' }} type="button">
                <Plus size={15} />Add practice
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total practices" value={stats.total} />
            <StatCard label="Active pipeline" value={stats.active} />
            <StatCard label="Follow-ups due" value={stats.followUpsDue} accent={stats.followUpsDue > 0 ? '#A84522' : undefined} />
            <StatCard label="Touches this week" value={stats.touchesThisWeek} />
            <StatCard label="Customers" value={stats.customers} accent="#2D5F4E" />
          </div>
        </header>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#857B6A' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search practices, providers, addresses, tags…"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded border bg-white focus:outline-none"
              style={{ borderColor: '#E5DECC', color: '#1F1B16' }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded border overflow-hidden" style={{ borderColor: '#E5DECC' }}>
              <button onClick={() => setView('list')} type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition"
                style={{ backgroundColor: view === 'list' ? '#2D5F4E' : '#FFFFFF', color: view === 'list' ? '#FBF8F0' : '#6B6357' }}>
                <List size={14} />List
              </button>
              <button onClick={() => setView('map')} type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition"
                style={{ backgroundColor: view === 'map' ? '#2D5F4E' : '#FFFFFF', color: view === 'map' ? '#FBF8F0' : '#6B6357' }}>
                <MapIcon size={14} />Map
              </button>
            </div>
            <button onClick={() => setShowFilters(!showFilters)} type="button"
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded border text-sm font-medium"
              style={{
                borderColor: hasFilters ? '#2D5F4E' : '#E5DECC',
                backgroundColor: hasFilters ? '#FBF8F0' : '#FFFFFF',
                color: hasFilters ? '#2D5F4E' : '#6B6357'
              }}>
              <Filter size={14} />Filter
              {hasFilters && (
                <span className="ml-1 px-1.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: '#2D5F4E', color: '#FBF8F0' }}>
                  {[statusFilter !== 'all', specialtyFilter !== 'all', !!search.trim()].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-lg border p-3 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3"
            style={{ borderColor: '#E5DECC', backgroundColor: '#FBF8F0' }}>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] mb-1.5" style={{ color: '#857B6A' }}>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border bg-white"
                style={{ borderColor: '#D9D1BF', color: '#1F1B16' }}>
                <option value="all">All statuses</option>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.1em] mb-1.5" style={{ color: '#857B6A' }}>Specialty</label>
              <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border bg-white"
                style={{ borderColor: '#D9D1BF', color: '#1F1B16' }}>
                <option value="all">All specialties</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {hasFilters && (
              <button onClick={() => { setStatusFilter('all'); setSpecialtyFilter('all'); setSearch(''); }}
                className="text-xs hover:underline justify-self-start md:col-span-2"
                style={{ color: '#857B6A' }} type="button">Clear all filters</button>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: '#857B6A' }}>Loading…</div>
        ) : practices.length === 0 ? (
          <EmptyState onAdd={() => { setEditing(null); setShowForm(true); }} />
        ) : view === 'map' ? (
          <MapView practices={filtered}
            onSelect={(id) => { setSelectedId(id); setView('list'); }}
            onGeocoded={handleGeocoded} />
        ) : (
          <div className={`grid gap-4 ${selected ? 'lg:grid-cols-[1fr_1.1fr]' : 'grid-cols-1'}`}>
            <div className="space-y-2.5">
              {filtered.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-sm"
                  style={{ borderColor: '#E5DECC', backgroundColor: '#FBF8F0', color: '#857B6A' }}>
                  No practices match your filters.
                </div>
              ) : (
                filtered.map(p => (
                  <PracticeCard key={p.id} practice={p}
                    isSelected={selectedId === p.id}
                    onClick={() => setSelectedId(selectedId === p.id ? null : p.id)} />
                ))
              )}
            </div>
            {selected && (
              <div className="lg:sticky lg:top-6 self-start">
                <PracticeDetail
                  practice={selected}
                  onClose={() => setSelectedId(null)}
                  onEdit={() => { setEditing(selected); setShowForm(true); }}
                  onDelete={() => handleDelete(selected.id)}
                  onUpdateStatus={(s) => handleUpdateStatus(selected.id, s)}
                  onUpdateFollowUp={(d) => handleUpdateFollowUp(selected.id, d)}
                  onAddActivity={(a) => handleAddActivity(selected.id, a)}
                  onDeleteActivity={(aid) => handleDeleteActivity(selected.id, aid)}
                  onAddOrder={(o) => handleAddOrder(selected.id, o)}
                  onDeleteOrder={(oid) => handleDeleteOrder(selected.id, oid)}
                />
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-10 text-xs" style={{ color: '#A8A092' }}>
          Data saves automatically to this browser. Use Export regularly to back up.
        </div>
      </div>

      {showForm && (
        <PracticeForm initial={editing} onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}
