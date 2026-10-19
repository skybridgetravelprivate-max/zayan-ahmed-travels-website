"use client";

import { useState } from "react";
import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import { departureCities, internationalOrigins, packagePreferences, tripDays, combinationTrips, umrahPlanningContext } from "@/config/umrah-planning";

const field = "mt-2 w-full rounded-xl border border-line bg-white px-3 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";
const chip = "rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-zayan-blue/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue";

export function UmrahPlanner() {
  const [origin, setOrigin] = useState("Islamabad");
  const [days, setDays] = useState("15");
  const [preference, setPreference] = useState("Economy");
  const [extension, setExtension] = useState("");
  return <>
    <section id="plan" className="scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-2xl border border-line bg-surface p-5 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-zayan-blue">Build your inquiry</p>
        <h2 className="mt-2 text-3xl font-bold text-zayan-blue">Plan an Umrah journey around you</h2>
        <p className="mt-3 max-w-3xl text-muted">Choose your preferences, then send them to our travel desk below. These controls prepare an inquiry; they do not search live inventory, reserve seats or confirm a price.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="font-semibold">Departure city / country<select className={field} value={origin} onChange={e => setOrigin(e.target.value)}><optgroup label="Pakistan">{departureCities.map(city => <option key={city}>{city}</option>)}</optgroup><optgroup label="International inquiry">{internationalOrigins.map(country => <option key={country}>{country}</option>)}</optgroup><option>Other origin</option></select></label>
          <label className="font-semibold">Travel duration<select className={field} value={days} onChange={e => setDays(e.target.value)}>{tripDays.map(day => <option key={day} value={day}>{day} days</option>)}</select></label>
          <label className="font-semibold">Package preference<select className={field} value={preference} onChange={e => setPreference(e.target.value)}>{packagePreferences.map(type => <option key={type}>{type}</option>)}</select></label>
          <label className="font-semibold">Optional extension<select className={field} value={extension} onChange={e => setExtension(e.target.value)}><option value="">No extension</option>{combinationTrips.map(place => <option key={place}>{place}</option>)}</select></label>
        </div>
        <a href="#inquiry" className="mt-6 inline-block rounded-xl bg-zayan-blue px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue">Continue to Umrah inquiry</a>
        <h3 className="mt-8 font-bold text-zayan-blue">Departing from Pakistan</h3>
        <div className="mt-3 flex flex-wrap gap-2">{departureCities.map(city => <button key={city} type="button" aria-pressed={origin === city} className={`${chip} ${origin === city ? "bg-zayan-blue/10" : ""}`} onClick={() => setOrigin(city)}>{city}</button>)}</div>
        <h3 className="mt-6 font-bold text-zayan-blue">Choose your pace</h3>
        <div className="mt-3 flex flex-wrap gap-2">{tripDays.map(day => <button key={day} type="button" aria-pressed={days === String(day)} className={`${chip} ${days === String(day) ? "bg-zayan-blue/10" : ""}`} onClick={() => setDays(String(day))}>{day} days</button>)}</div>
      </div>
    </section>
    <section id="inquiry" className="scroll-mt-24 bg-zayan-blue px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div><h2 className="text-3xl font-bold">Request your Umrah quotation</h2><p className="mt-4 leading-7 text-white/85">Share your intended dates, traveller count and room needs. Our desk will review your request before confirming availability and terms.</p><p role="status" className="mt-5 rounded-xl border border-white/30 p-4">{origin} · {days} days · {preference}{extension ? ` · ${extension} extension` : ""}</p><a className="mt-4 inline-block underline" href="#plan">Change planning preferences</a><p className="mt-4 text-sm text-white/80">Do not send passport scans or payment details through this form. Document uploads remain disabled.</p></div>
        <ServiceInquiryForm type="umrah" submitLabel="Send Umrah inquiry" context={umrahPlanningContext(origin, days, preference, extension)} />
      </div>
    </section>
  </>;
}
