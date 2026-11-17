import React, { memo, useEffect, useState } from "react";
import { Languages, PlusCircle, Sparkles } from "lucide-react";
import type { Contact } from "../lib/mockDB";

type ContactFormValues = {
  name: string;
  phone: string;
  address: string;
  type: "customer" | "supplier";
};

type Props = {
  editingContact: Contact | null;
  onSubmit: (values: ContactFormValues) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: (contact: Contact) => void | Promise<void>;
};

const banglaToEnglishDigits = (value: string) => {
  const digits: Record<string, string> = { "০":"0", "১":"1", "২":"2", "৩":"3", "৪":"4", "৫":"5", "৬":"6", "৭":"7", "৮":"8", "৯":"9" };
  return value.replace(/[০-৯]/g, (digit) => digits[digit] || digit);
};

const hasBengaliCharacters = (value: string) => /[\u0980-\u09FF]/.test(value);

function ContactRegistrationFormComponent({ editingContact, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<"customer" | "supplier">("customer");
  const [isTranslating, setIsTranslating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    setName(editingContact?.name || "");
    setPhone(editingContact?.phone || "");
    setAddress(editingContact?.address || "");
    setType(editingContact?.type || "customer");
  }, [editingContact]);

  const translateFields = async () => {
    setIsTranslating(true);
    try {
      const cleanPhone = banglaToEnglishDigits(phone).replace(/[^0-9]/g, "");
      const response = await fetch("/api/ai/translate-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: cleanPhone, address })
      });
      if (!response.ok) throw new Error("Translation request failed");
      const data = await response.json();
      setName(data?.name || name);
      setPhone(data?.phone || cleanPhone);
      setAddress(data?.address || address);
    } catch (error) {
      console.error("Contact translation failed:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const cleanPhone = banglaToEnglishDigits(phone).replace(/[^0-9]/g, "");

  return (
    <div className="lg:col-span-4 bg-[#1E1E24] border border-[#2D2D35] p-6 rounded-2xl space-y-4 shadow-lg" id="add-contact-panel">
      <div className="border-b border-[#2D2D35] pb-3">
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">
          {editingContact ? "Edit Active Partner" : "Register Partner"}
        </h3>
        <p className="text-[10px] text-[#A0A0A5]">
          {editingContact ? "Modify contact information for this client account" : "Register a customer client or wholesaler to tracking payments"}
        </p>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ name, phone: cleanPhone, address, type }); }} className="space-y-4" id="contacts-form">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Legal Full Name *</label>
          <input type="text" required placeholder="e.g. John Doe, Mohammad Habib" value={name} onChange={(event) => setName(event.target.value)}
            className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-sans focus:ring-1 focus:ring-[#00E676]/30 transition-all" />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center pr-1">
            <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Primary Mobile Number *</label>
            {phone.length > 0 && <span className={`text-[10px] font-mono font-bold ${cleanPhone.length === 11 ? "text-emerald-400" : "text-rose-500 animate-pulse"}`}>{cleanPhone.length}/11 Digits</span>}
          </div>
          <input type="tel" required maxLength={11} placeholder="017xxxxxxxx" value={phone}
            onChange={(event) => setPhone(banglaToEnglishDigits(event.target.value).replace(/[^0-9]/g, ""))}
            className={`w-full px-3 py-2.5 bg-[#121214] border rounded-xl text-white text-xs outline-none focus:ring-1 transition-all font-mono ${cleanPhone.length > 0 && cleanPhone.length !== 11 ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 text-rose-300" : "border-[#2D2D35] focus:border-[#00E676] focus:ring-[#00E676]/30"}`} />
          {phone.length > 0 && cleanPhone.length !== 11 && <p className="text-[10px] text-rose-500 font-bold pl-1 mt-0.5 min-h-[14px]">⚠️ Bangladeshi mobile numbers must be exactly 11 digits! (Current: {cleanPhone.length} digits)</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Address Details (Optional)</label>
          <input type="text" placeholder="e.g. Block C, Gulshan-2, Dhaka" value={address} onChange={(event) => setAddress(event.target.value)}
            className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-sans focus:ring-1 focus:ring-[#00E676]/30 transition-all" />
        </div>

        {(hasBengaliCharacters(name) || hasBengaliCharacters(address)) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-xs text-amber-200">
            <div className="flex items-start gap-2">
              <Languages className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div><p className="font-extrabold text-amber-400 tracking-wide">Bengali Input Detected!</p>
                <p className="text-[10px] text-amber-300/90 leading-relaxed font-sans">Name or Address is written in Bengali. Translate it to English using Gemini AI.</p></div>
            </div>
            <button type="button" onClick={translateFields} disabled={isTranslating}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg cursor-pointer transition-all duration-150 active:scale-95 disabled:opacity-50">
              {isTranslating ? <><span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /><span>Translating...</span></> : <><Sparkles className="w-3 h-3 text-slate-950" /><span>Translate to English</span></>}
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1 block">Profile Relationship Type</label>
          <div className="flex gap-4 pt-1" id="type-radio-group">
            <label className="flex items-center gap-2 text-xs text-slate-300 font-sans cursor-pointer select-none">
              <input type="radio" name="contactType" checked={type === "customer"} onChange={() => setType("customer")} className="accent-[#00E676] scale-110 cursor-pointer" /> Customer Line
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 font-sans cursor-pointer select-none">
              <input type="radio" name="contactType" checked={type === "supplier"} onChange={() => setType("supplier")} className="accent-[#00E676] scale-110 cursor-pointer" /> Supplier Dealer
            </label>
          </div>
        </div>

        <button type="submit" id="save-contact-btn" disabled={cleanPhone.length !== 11 || !name.trim() || isTranslating}
          className={`w-full py-3.5 text-[#121214] font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg ${cleanPhone.length !== 11 || !name.trim() || isTranslating ? "bg-slate-700/50 text-slate-400 cursor-not-allowed border border-slate-700/30 shadow-none hover:scale-100" : "bg-[#00E676] hover:bg-[#00D065] hover:scale-[1.02] active:scale-[0.98] shadow-[#00E676]/10"}`}>
          <PlusCircle className="w-4 h-4" /> {editingContact ? "Save Profile Changes" : "Register Profile"}
        </button>

        {editingContact && onDelete && (
          <div className="space-y-2">
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-rose-500/35">
                Delete Customer Ledger Box
              </button>
            ) : (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 space-y-2">
                <p className="text-[10px] leading-relaxed text-rose-100 font-semibold">Delete {editingContact.name}'s customer profile and all linked ledger invoices? This cannot be undone.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { void onDelete(editingContact); setConfirmDelete(false); }}
                    className="py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] uppercase rounded-lg">Yes, Delete</button>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="py-2 bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase rounded-lg border border-white/10">Keep Ledger</button>
                </div>
              </div>
            )}
          </div>
        )}
        {editingContact && <button type="button" onClick={onCancel} className="w-full py-2 bg-[#2D2D35]/50 hover:bg-[#2D2D35] text-[#A0A0A5] hover:text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-[#2D2D35]">Cancel Editing</button>}
      </form>
    </div>
  );
}

export const ContactRegistrationForm = memo(ContactRegistrationFormComponent);
