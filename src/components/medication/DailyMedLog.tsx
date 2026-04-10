import { useState, useRef, useEffect } from 'react';
import type { Medication, MedicationLog, TimeOfDay } from '../../types';
import { getMedLogs, getMedLogsForDate, toggleMedLog, skipMedLog, clearMedLog, moveMedLog, saveMedication } from '../../storage';
import { TIMES_OF_DAY } from '../../types';
import MedInfoModal from './MedInfoModal';

interface Props {
  medications: Medication[];
  onMedicationCompleted?: () => void;
}

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

const TIME_ICONS: Record<TimeOfDay, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌇',
  night: '🌙',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function skippedDaysCount(medId: string, allLogs: MedicationLog[]) {
  return new Set(
    allLogs.filter(l => l.medicationId === medId && l.skipped).map(l => l.date),
  ).size;
}

function courseProgress(med: Medication, date: string, allLogs: MedicationLog[]) {
  if (!med.startDate || !med.durationDays) return null;
  const skipped = skippedDaysCount(med.id, allLogs);
  const start = new Date(med.startDate + 'T00:00:00');
  const current = new Date(date + 'T00:00:00');
  const calendarDays = Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1;
  const effectiveDays = Math.max(0, calendarDays - skipped);
  const clamped = Math.min(effectiveDays, med.durationDays);
  const end = new Date(start);
  end.setDate(end.getDate() + med.durationDays - 1 + skipped);
  return { day: clamped, total: med.durationDays };
}

export default function DailyMedLog({ medications, onMedicationCompleted }: Props) {
  const [date, setDate] = useState(todayDate());
  const [logs, setLogs] = useState(() => getMedLogsForDate(todayDate()));
  const [allLogs, setAllLogs] = useState(() => getMedLogs());
  const [sectionOverride, setSectionOverride] = useState<Map<TimeOfDay, boolean>>(new Map());
  const [moveMenuOpen, setMoveMenuOpen] = useState<{ medId: string; slot: TimeOfDay } | null>(null);
  const [infoMed, setInfoMed] = useState<{ name: string; dose?: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handleOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showPicker]);

  function openPicker() {
    const d = new Date(date + 'T00:00:00');
    setPickerYear(d.getFullYear());
    setPickerMonth(d.getMonth());
    setShowPicker(true);
  }

  function shiftPickerMonth(delta: number) {
    let m = pickerMonth + delta;
    let y = pickerYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setPickerMonth(m);
    setPickerYear(y);
  }

  function selectPickerDate(day: number) {
    const d = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    changeDate(d);
    setShowPicker(false);
  }

  function refresh() {
    const newAllLogs = getMedLogs();
    setLogs(getMedLogsForDate(date));
    setAllLogs(newAllLogs);
    let anyCompleted = false;
    for (const med of medications) {
      if (med.active && med.durationDays) {
        const takenDays = new Set(
          newAllLogs.filter(l => l.medicationId === med.id && l.taken).map(l => l.date),
        ).size;
        if (takenDays >= med.durationDays) {
          saveMedication({ ...med, active: false });
          anyCompleted = true;
        }
      }
    }
    if (anyCompleted) onMedicationCompleted?.();
  }

  function changeDate(newDate: string) {
    setDate(newDate);
    setLogs(getMedLogsForDate(newDate));
    setSectionOverride(new Map());
  }

  function shiftDate(days: number) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    changeDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  function handleToggle(medicationId: string, timeOfDay: TimeOfDay) {
    toggleMedLog(date, medicationId, timeOfDay);
    refresh();
  }

  function handleSkip(medicationId: string, timeOfDay: TimeOfDay) {
    skipMedLog(date, medicationId, timeOfDay);
    refresh();
  }

  function handleClear(medicationId: string, timeOfDay: TimeOfDay) {
    clearMedLog(date, medicationId, timeOfDay);
    refresh();
  }

  function handleMove(medicationId: string, fromSlot: TimeOfDay, toSlot: TimeOfDay) {
    moveMedLog(date, medicationId, fromSlot, toSlot);
    setMoveMenuOpen(null);
    refresh();
  }

  function isTaken(medicationId: string, timeOfDay: TimeOfDay) {
    return logs.some(l => l.medicationId === medicationId && l.timeOfDay === timeOfDay && l.taken);
  }

  function isSkipped(medicationId: string, timeOfDay: TimeOfDay) {
    return logs.some(l => l.medicationId === medicationId && l.timeOfDay === timeOfDay && l.skipped);
  }

  function isMovedFrom(medicationId: string, timeOfDay: TimeOfDay): boolean {
    return logs.some(l => l.medicationId === medicationId && l.timeOfDay === timeOfDay && l.movedTo != null);
  }

  function getMovedDestination(medicationId: string, timeOfDay: TimeOfDay): TimeOfDay | null {
    return logs.find(l => l.medicationId === medicationId && l.timeOfDay === timeOfDay && l.movedTo != null)?.movedTo ?? null;
  }

  // Meds that have been moved INTO this slot but are not normally scheduled here
  function movedInMeds(timeOfDay: TimeOfDay): Medication[] {
    return activeMeds.filter(m =>
      !m.timesOfDay.includes(timeOfDay) &&
      logs.some(l => l.medicationId === m.id && l.movedTo === timeOfDay)
    );
  }

  function isSectionAllDone(meds: Medication[], timeOfDay: TimeOfDay) {
    return meds.length > 0 && meds.every(m =>
      isTaken(m.id, timeOfDay) || isSkipped(m.id, timeOfDay) || isMovedFrom(m.id, timeOfDay)
    );
  }

  function isSectionExpanded(timeOfDay: TimeOfDay, meds: Medication[]) {
    if (sectionOverride.has(timeOfDay)) return sectionOverride.get(timeOfDay)!;
    return !isSectionAllDone(meds, timeOfDay);
  }

  function toggleSection(timeOfDay: TimeOfDay, meds: Medication[]) {
    const expanded = isSectionExpanded(timeOfDay, meds);
    setSectionOverride(prev => new Map(prev).set(timeOfDay, !expanded));
  }

  function takenDaysCount(medId: string) {
    return new Set(allLogs.filter(l => l.medicationId === medId && l.taken).map(l => l.date)).size;
  }

  function isCompleted(med: Medication) {
    return !!med.durationDays && takenDaysCount(med.id) >= med.durationDays;
  }

  function completionDate(med: Medication): string | null {
    if (!med.durationDays) return null;
    const takenDates = [...new Set(
      allLogs.filter(l => l.medicationId === med.id && l.taken).map(l => l.date)
    )].sort();
    if (takenDates.length < med.durationDays) return null;
    const lastDate = takenDates[med.durationDays - 1];
    return new Date(lastDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function isCompletedByDate(med: Medication, viewDate: string) {
    if (!med.durationDays) return false;
    const takenByDate = new Set(
      allLogs.filter(l => l.medicationId === med.id && l.taken && l.date <= viewDate).map(l => l.date),
    ).size;
    return takenByDate >= med.durationDays;
  }

  const completedMeds = medications.filter(isCompleted);

  const activeMeds = medications.filter(m => {
    if (m.startDate && m.startDate > date) return false;
    if (isCompletedByDate(m, date)) return false;
    if (!m.durationDays && !m.active) return false;
    return true;
  });

  const activeSections = TIMES_OF_DAY.filter(t =>
    activeMeds.some(m => m.timesOfDay.includes(t)) ||
    activeMeds.some(m => logs.some(l => l.medicationId === m.id && l.movedTo === t))
  );

  // Determine active/overdue sections based on current time (today only)
  const SLOT_START_HOUR: Record<TimeOfDay, number> = { morning: 8, afternoon: 13, evening: 17, night: 20 };
  const currentHour = new Date().getHours();
  const isToday = date === todayDate();

  function currentSlotOf(h: number): TimeOfDay {
    if (h >= 8 && h < 13) return 'morning';
    if (h >= 13 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  // Only slots whose start hour has been reached count as started.
  // e.g. at 00:15, night (21:00) hasn't started for today yet → no active/overdue.
  const startedSections = isToday
    ? activeSections.filter(t => currentHour >= SLOT_START_HOUR[t])
    : [];

  const pendingStartedSections = startedSections.filter(t => {
    const normalPending = activeMeds.filter(m => m.timesOfDay.includes(t)).some(m =>
      !isTaken(m.id, t) && !isSkipped(m.id, t) && !isMovedFrom(m.id, t)
    );
    const movedInPending = movedInMeds(t).some(m => !isTaken(m.id, t) && !isSkipped(m.id, t));
    return normalPending || movedInPending;
  });

  const activeSection = (() => {
    if (pendingStartedSections.length === 0) return null;
    const curSlot = currentSlotOf(currentHour);
    // If we're currently in a pending slot, that's the active one
    if (pendingStartedSections.includes(curSlot)) return curSlot;
    // Current slot is all done — fall back to last pending started slot
    return [...TIMES_OF_DAY].reverse().find(t => pendingStartedSections.includes(t)) ?? null;
  })();

  const activeSectionIdx = activeSection ? TIMES_OF_DAY.indexOf(activeSection) : -1;
  const overdueSections = pendingStartedSections.filter(t => TIMES_OF_DAY.indexOf(t) < activeSectionIdx);

  return (
    <div>
      {/* Header: title + date nav */}
      <div className="med-log-header">
        <h2 className="med-log-title">Medication Log</h2>
        <div className="med-date-nav" ref={pickerRef}>
          <button className="med-date-btn" onClick={() => shiftDate(-1)}>‹</button>
          <button className="med-date-label" onClick={openPicker}>
            {formatDisplayDate(date)}
          </button>
          <button className="med-date-btn" onClick={() => shiftDate(1)}>›</button>
          {showPicker && (() => {
            const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
            const firstDow = new Date(pickerYear, pickerMonth, 1).getDay();
            const today = todayDate();
            const cells: (number | null)[] = [];
            for (let i = 0; i < firstDow; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            while (cells.length % 7 !== 0) cells.push(null);
            return (
              <div className="date-picker-dropdown">
                <div className="date-picker-header">
                  <button className="date-picker-nav" onClick={() => shiftPickerMonth(-1)}>‹</button>
                  <span className="date-picker-month-label">{MONTHS[pickerMonth]} {pickerYear}</span>
                  <button className="date-picker-nav" onClick={() => shiftPickerMonth(1)}>›</button>
                </div>
                <div className="date-picker-grid">
                  {DAY_LETTERS.map(l => (
                    <span key={l} className="date-picker-dow">{l}</span>
                  ))}
                  {cells.map((day, i) => {
                    if (day === null) return <span key={`e${i}`} />;
                    const cellDate = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday = cellDate === today;
                    const isSelected = cellDate === date;
                    return (
                      <button
                        key={cellDate}
                        className={`date-picker-cell${isSelected ? ' selected' : isToday ? ' today' : ''}`}
                        onClick={() => selectPickerDate(day)}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="date-picker-today-btn"
                  onClick={() => { changeDate(today); setShowPicker(false); }}
                >
                  Today
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Empty state */}
      {activeMeds.length === 0 && completedMeds.length === 0 && (
        <p className="text-muted" style={{ textAlign: 'center', padding: '40px 0' }}>
          No active medications. Add one using the button on the right.
        </p>
      )}

      {/* Time-of-day sections */}
      {activeSections.length > 0 && (
        <div className="med-sections">
          {activeSections.map(timeOfDay => {
            const normalMeds = activeMeds.filter(m => m.timesOfDay.includes(timeOfDay));
            const sectionMeds = [...normalMeds, ...movedInMeds(timeOfDay)]
              .sort((a, b) => {
                const aPending = !isTaken(a.id, timeOfDay) && !isSkipped(a.id, timeOfDay) && !isMovedFrom(a.id, timeOfDay);
                const bPending = !isTaken(b.id, timeOfDay) && !isSkipped(b.id, timeOfDay) && !isMovedFrom(b.id, timeOfDay);
                if (aPending !== bPending) return bPending ? 1 : -1;
                const aLog = logs.find(l => l.medicationId === a.id && l.timeOfDay === timeOfDay);
                const bLog = logs.find(l => l.medicationId === b.id && l.timeOfDay === timeOfDay);
                return (bLog?.changedAt ?? 0) - (aLog?.changedAt ?? 0);
              });
            const pendingCount = sectionMeds.filter(
              m => !isTaken(m.id, timeOfDay) && !isSkipped(m.id, timeOfDay) && !isMovedFrom(m.id, timeOfDay)
            ).length;
            const skippedCount = sectionMeds.filter(m => isSkipped(m.id, timeOfDay)).length;
            const allDone = isSectionAllDone(sectionMeds, timeOfDay);
            const expanded = isSectionExpanded(timeOfDay, sectionMeds);

            return (
              <section key={timeOfDay} className={`med-section${allDone ? ' done' : ''}${timeOfDay === activeSection ? ' active-slot' : overdueSections.includes(timeOfDay) ? ' overdue-slot' : ''}`}>
                <div
                  className="med-section-header"
                  onClick={() => toggleSection(timeOfDay, sectionMeds)}
                >
                  {timeOfDay === 'morning' ? (
                    <img src="/icon-morning.png" alt="Morning" className="med-section-icon-img" />
                  ) : timeOfDay === 'afternoon' ? (
                    <img src="/icon-afternoon.png" alt="Afternoon" className="med-section-icon-img" />
                  ) : timeOfDay === 'evening' ? (
                    <img src="/icon-evening.png" alt="Evening" className="med-section-icon-img" />
                  ) : (
                    <img src="/icon-night.png" alt="Night" className="med-section-icon-img" />
                  )}
                  <h3 className="med-section-title">{TIME_LABELS[timeOfDay]}</h3>
                  <span className={`med-section-badge${allDone ? ' done' : pendingCount > 0 ? ' pending' : ' upcoming'}`}>
                    {allDone
                      ? skippedCount > 0 ? `Completed · ${skippedCount} skipped` : 'Completed'
                      : pendingCount > 0 ? `${pendingCount} Pending` : 'Upcoming'}
                  </span>
                </div>

                {expanded && (
                  <div className="med-section-items">
                    {sectionMeds.map(med => {
                      const taken = isTaken(med.id, timeOfDay);
                      const skipped = isSkipped(med.id, timeOfDay);
                      const movedFrom = isMovedFrom(med.id, timeOfDay);
                      const movedDest = movedFrom ? getMovedDestination(med.id, timeOfDay) : null;
                      const isOriginalSlot = med.timesOfDay.includes(timeOfDay);
                      const takenAt = logs.find(l => l.medicationId === med.id && l.timeOfDay === timeOfDay && l.taken)?.takenAt;
                      const course = courseProgress(med, date, allLogs);
                      const moveMenuKey = `${med.id}:${timeOfDay}`;
                      const isMoveMenuOpen = moveMenuOpen?.medId === med.id && moveMenuOpen?.slot === timeOfDay;

                      return (
                        <div
                          key={med.id}
                          className={`med-item${taken ? ' taken' : skipped ? ' skipped' : movedFrom ? ' moved' : ''}`}
                        >
                          <div
                            className={`med-item-check${taken ? ' checked' : skipped ? ' skipped-check' : movedFrom ? ' moved-check' : ''}`}
                            onClick={() => {
                              if (movedFrom) return;
                              if (skipped) handleClear(med.id, timeOfDay);
                              else handleToggle(med.id, timeOfDay);
                            }}
                          >
                            {taken ? (
                              <img src="/icon-checked.png" alt="" className="med-item-check-icon" />
                            ) : skipped ? (
                              <img src="/icon-skipped.svg" alt="" className="med-item-check-icon" />
                            ) : movedFrom ? (
                              <span style={{ fontSize: '1rem', opacity: 0.5 }}>→</span>
                            ) : (
                              <img src="/icon-unchecked.png" alt="" className="med-item-check-icon" />
                            )}
                          </div>

                          <div className="med-item-body">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="med-item-name">{med.name}</span>
                              {!isOriginalSlot && (
                                <span style={{ fontSize: '0.7rem', background: 'rgba(34,211,238,0.12)', color: '#22D3EE', borderRadius: 4, padding: '1px 5px' }}>moved</span>
                              )}
                              <button
                                className="med-info-btn"
                                onClick={e => { e.stopPropagation(); setInfoMed({ name: med.name, dose: med.dose }); }}
                              ><img src="/icon-ai.svg" alt="AI info" width="14" height="14" /></button>
                            </div>
                            {(med.dose || med.purpose || course) && (
                              <span className="med-item-sub">
                                {[med.dose, med.purpose, course ? `Day ${course.day}/${course.total}` : null]
                                  .filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </div>

                          <div className="med-item-actions" onClick={e => e.stopPropagation()}>
                            {taken ? (
                              <span className="med-taken-label">
                                Taken{takenAt ? ` · ${takenAt}` : ''}
                              </span>
                            ) : skipped ? (
                              <button className="med-skip-btn undo" onClick={() => handleClear(med.id, timeOfDay)}>Undo</button>
                            ) : movedFrom ? (
                              <>
                                <span className="med-taken-label" style={{ color: 'var(--text-muted)' }}>
                                  → {TIME_LABELS[movedDest!]}
                                </span>
                                <button className="med-skip-btn undo" onClick={() => handleClear(med.id, timeOfDay)}>Undo</button>
                              </>
                            ) : (
                              <>
                                {isOriginalSlot && (
                                  <div style={{ position: 'relative' }}>
                                    <button
                                      className="med-skip-btn"
                                      onClick={() => setMoveMenuOpen(isMoveMenuOpen ? null : { medId: med.id, slot: timeOfDay })}
                                    >
                                      Move ▾
                                    </button>
                                    {isMoveMenuOpen && (
                                      <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, background: 'var(--card, #1a2540)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 4, minWidth: 130, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                                        {TIMES_OF_DAY.filter(t => t !== timeOfDay).map(t => (
                                          <button
                                            key={t}
                                            onClick={() => handleMove(med.id, timeOfDay, t)}
                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, fontSize: '0.85rem', fontFamily: 'inherit' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                          >
                                            {TIME_ICONS[t]} {TIME_LABELS[t]}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <button className="med-skip-btn" onClick={() => handleSkip(med.id, timeOfDay)}>Skip</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Completed courses */}
      {completedMeds.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <section className="med-section done">
            <div className="med-section-header">
              <div className="med-section-icon completed">✓</div>
              <h3 className="med-section-title">Completed Courses</h3>
              <span className="med-section-badge done">{completedMeds.length} completed</span>
            </div>
            <div className="med-section-items">
              {completedMeds.map(med => (
                <div key={med.id} className="med-item taken">
                  <div className="med-item-check checked">✓</div>
                  <div className="med-item-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="med-item-name">{med.name}</span>
                      <button
                        className="med-info-btn"
                        onClick={e => { e.stopPropagation(); setInfoMed({ name: med.name, dose: med.dose }); }}
                      ><img src="/icon-ai.svg" alt="AI info" width="14" height="14" /></button>
                    </div>
                    <span className="med-item-sub">
                      {med.durationDays} day course done
                      {completionDate(med) && <> · Completed {completionDate(med)}</>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {infoMed && (
        <MedInfoModal
          medicationName={infoMed.name}
          dose={infoMed.dose}
          onClose={() => setInfoMed(null)}
        />
      )}
    </div>
  );
}
