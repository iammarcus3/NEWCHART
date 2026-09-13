import React from 'react';
import { getAllCreditedArtists } from '../utils/artistCrediting';

interface CreditedArtistLinksProps {
  artist: string;
  title?: string;
  onArtistClick?: (artist: string) => void;
  className?: string;
  linkClassName?: string;
  separatorClassName?: string;
}

/**
 * Renders each artist in a multi-artist or featured track individually.
 * E.g., "Tom and Jerry" renders "Tom" and "Jerry" as separate clickable links,
 * allowing each artist to be viewed individually.
 */
export const CreditedArtistLinks: React.FC<CreditedArtistLinksProps> = ({
  artist,
  title,
  onArtistClick,
  className = '',
  linkClassName = 'hover:text-cyan-300 hover:underline cursor-pointer font-medium transition-colors',
  separatorClassName = 'text-zinc-500 font-normal select-none',
}) => {
  if (!artist || artist.trim().length === 0) return null;

  const credited = getAllCreditedArtists(artist, title);

  if (credited.length <= 1) {
    const singleName = credited[0]?.name || artist;
    return (
      <span className={className}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArtistClick?.(singleName);
          }}
          className={linkClassName}
          title={`View ${singleName} Profile`}
        >
          {singleName}
        </button>
      </span>
    );
  }

  const primaryArtists = credited.filter((c) => !c.isFeatured);
  const featuredArtists = credited.filter((c) => c.isFeatured);

  // If all were marked featured for some edge case, treat first as primary
  const actualPrimary = primaryArtists.length > 0 ? primaryArtists : [credited[0]];
  const actualFeatured = primaryArtists.length > 0 ? featuredArtists : credited.slice(1);

  return (
    <span className={`inline-flex items-center flex-wrap gap-x-1 ${className}`}>
      {actualPrimary.map((a, idx) => (
        <React.Fragment key={`prim_${idx}_${a.name}`}>
          {idx > 0 && (
            <span className={separatorClassName}>
              {idx === actualPrimary.length - 1 ? ' & ' : ', '}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArtistClick?.(a.name);
            }}
            className={linkClassName}
            title={`View ${a.name} Profile`}
          >
            {a.name}
          </button>
        </React.Fragment>
      ))}

      {actualFeatured.length > 0 && (
        <>
          <span className={separatorClassName}> feat. </span>
          {actualFeatured.map((a, idx) => (
            <React.Fragment key={`feat_${idx}_${a.name}`}>
              {idx > 0 && (
                <span className={separatorClassName}>
                  {idx === actualFeatured.length - 1 ? ' & ' : ', '}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArtistClick?.(a.name);
                }}
                className={linkClassName}
                title={`View ${a.name} Profile`}
              >
                {a.name}
              </button>
            </React.Fragment>
          ))}
        </>
      )}
    </span>
  );
};
