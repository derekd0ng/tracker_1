import { useState } from 'react';
import type { Medication, TimeOfDay } from '../../types';
import { TIMES_OF_DAY } from '../../types';
import { saveMedication } from '../../storage';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Props {
  onSaved: () => void;
  onCancel: () => void;
  initial?: Medication;
}

export default function MedicationForm({ onSaved, onCancel, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dose, setDose] = useState(initial?.dose ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [durationDays, setDurationDays] = useState(initial?.durationDays?.toString() ?? '');
  const [timesOfDay, setTimesOfDay] = useState<TimeOfDay[]>(
    initial?.timesOfDay ?? ['morning'],
  );
  const [purpose, setPurpose] = useState(initial?.purpose ?? '');
  const [prescribingDoctor, setPrescribingDoctor] = useState(
    initial?.prescribingDoctor ?? '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [active, setActive] = useState(initial?.active ?? true);

  function toggleTime(t: TimeOfDay) {
    setTimesOfDay(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const med: Medication = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      dose: dose.trim() || undefined,
      startDate: startDate || undefined,
      durationDays: durationDays ? Number(durationDays) : undefined,
      timesOfDay,
      purpose: purpose.trim() || undefined,
      prescribingDoctor: prescribingDoctor.trim() || undefined,
      notes: notes.trim() || undefined,
      active,
    };

    saveMedication(med);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        {/* Name — required */}
        <div className="form-field">
          <label>Medication name *</label>
          <input
            type="text"
            placeholder="e.g. Aspirin"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        {/* Dose, start date, duration */}
        <div className="form-grid mt-12">
          <div className="form-field">
            <label>Dose</label>
            <input
              type="text"
              placeholder="e.g. 100 mg"
              value={dose}
              onChange={e => setDose(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Duration (days)</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 30"
              value={durationDays}
              onChange={e => setDurationDays(e.target.value)}
            />
          </div>
        </div>

        {/* Times of day */}
        <p className="section-title mt-16">Time of day</p>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {TIMES_OF_DAY.map(t => (
            <button
              key={t}
              type="button"
              className={`symptom-chip${timesOfDay.includes(t) ? ' selected' : ''}`}
              onClick={() => toggleTime(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Purpose & Doctor */}
        <div className="form-grid mt-16">
          <div className="form-field">
            <label>Purpose</label>
            <input
              type="text"
              placeholder="e.g. Blood thinning"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Prescribing doctor</label>
            <input
              type="text"
              placeholder="e.g. Dr. Smith"
              value={prescribingDoctor}
              onChange={e => setPrescribingDoctor(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="form-field mt-12">
          <label>Notes</label>
          <textarea
            placeholder="Additional notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Active status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <input
            type="checkbox"
            id="med-active"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer' }}
          />
          <label
            htmlFor="med-active"
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Currently active (show in daily log)
          </label>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  );
}
