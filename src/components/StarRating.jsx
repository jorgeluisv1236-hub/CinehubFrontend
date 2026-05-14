import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProfile } from '../contexts/ProfileContext';
import './StarRating.css';

export default function StarRating({ contentId, contentType }) {
  const { activeProfile } = useProfile();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeProfile || !contentId) return;
    supabase.from('ratings')
      .select('rating')
      .eq('profile_id', activeProfile.id)
      .eq('content_id', Number(contentId))
      .maybeSingle()
      .then(({ data }) => { if (data) setRating(data.rating); });
  }, [activeProfile?.id, contentId]);

  const handleRate = async (val) => {
    if (!activeProfile || saving) return;
    setSaving(true);
    setRating(val);
    await supabase.from('ratings').upsert(
      { profile_id: activeProfile.id, content_id: Number(contentId), content_type: contentType, rating: val },
      { onConflict: 'profile_id,content_id' }
    );
    setSaving(false);
  };

  return (
    <div className="star-rating">
      <span className="star-label">Tu calificación:</span>
      <div className="star-row">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            className="star-btn"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => handleRate(n)}
          >
            <Star
              size={18}
              fill={(hover || rating) >= n ? 'var(--gold)' : 'none'}
              color={(hover || rating) >= n ? 'var(--gold)' : 'var(--fg-muted)'}
            />
          </button>
        ))}
      </div>
    </div>
  );
}