import { useState, useEffect, useRef } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function todayDate() {
  return fmt(new Date());
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

interface Props {
  date: string;
  onChange: (date: string) => void;
}

export default function DateNav({ date, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowPicker(false);
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

  function shiftDate(days: number) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    onChange(fmt(d));
  }

  const today = todayDate();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const firstDow = new Date(pickerYear, pickerMonth, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="med-date-nav" ref={ref}>
      <button className="med-date-btn" onClick={() => shiftDate(-1)}>‹</button>
      <button className="med-date-label" onClick={openPicker}>{formatDisplayDate(date)}</button>
      <button className="med-date-btn" onClick={() => shiftDate(1)}>›</button>
      {showPicker && (
        <div className="date-picker-dropdown">
          <div className="date-picker-header">
            <button className="date-picker-nav" onClick={() => shiftPickerMonth(-1)}>‹</button>
            <span className="date-picker-month-label">{MONTHS[pickerMonth]} {pickerYear}</span>
            <button className="date-picker-nav" onClick={() => shiftPickerMonth(1)}>›</button>
          </div>
          <div className="date-picker-grid">
            {DAY_LETTERS.map(l => <span key={l} className="date-picker-dow">{l}</span>)}
            {cells.map((day, i) => {
              if (day === null) return <span key={`e${i}`} />;
              const cellDate = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = cellDate === today;
              const isSelected = cellDate === date;
              return (
                <button
                  key={cellDate}
                  className={`date-picker-cell${isSelected ? ' selected' : isToday ? ' today' : ''}`}
                  onClick={() => { onChange(cellDate); setShowPicker(false); }}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button
            className="date-picker-today-btn"
            onClick={() => { onChange(today); setShowPicker(false); }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
