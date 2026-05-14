import React from 'react';
import './CategoryBar.css';

const GENRES = [
  'Todo',
  'Acción',
  'Drama',
  'Comedia',
  'Terror',
  'Thriller',
  'Ciencia Ficción',
  'Romance',
  'Animación',
  'Documental',
  'Crimen',
  'Fantasía',
];

const CategoryBar = ({ activeGenre = 'Todo', onGenreChange }) => {
  return (
    <div className="category-bar">
      <div className="category-bar-inner">
        {GENRES.map((genre) => (
          <button
            key={genre}
            className={`category-pill${activeGenre === genre ? ' active' : ''}`}
            onClick={() => onGenreChange?.(genre)}
          >
            {genre}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryBar;
