import React from 'react';
import './FilterBar.css';

const DURATIONS = [
  { label: 'Cualquier duración', value: '' },
  { label: '< 90 min', value: 'short' },
  { label: '90–120 min', value: 'medium' },
  { label: '> 120 min', value: 'long' },
];

const YEARS = ['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2015–2017', '2010–2014', 'Antes de 2010'];

export default function FilterBar({ filterYear, filterDuration, onFilterYear, onFilterDuration, activeSection }) {
  const showDuration = activeSection === 'Películas' || activeSection === 'Inicio';
  return (
    <div className="filter-bar container">
      <select className="filter-select" value={filterYear} onChange={e => onFilterYear(e.target.value)}>
        <option value="">Cualquier año</option>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      {showDuration && (
        <select className="filter-select" value={filterDuration} onChange={e => onFilterDuration(e.target.value)}>
          {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      )}
      {(filterYear || filterDuration) && (
        <button className="filter-clear" onClick={() => { onFilterYear(''); onFilterDuration(''); }}>
          × Limpiar filtros
        </button>
      )}
    </div>
  );
}