import React, { useState, useEffect } from 'react';
import { Music, Disc, User } from 'lucide-react';
import {
  resolvePersistentImage,
  fetchLastfmArtistPhoto,
  fetchLastfmAlbumPhoto,
  fetchLastfmTrackPhoto,
  getPhotoCacheSnapshot,
} from '../utils/lastfmImageFetcher';

interface MusicImageProps {
  type: 'artist' | 'album' | 'track';
  artist: string;
  title?: string;
  album?: string;
  src?: string;
  className?: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
  onClick?: (e: React.MouseEvent) => void;
  titleTooltip?: string;
}

function isInvalidOrPlaceholder(url?: string): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return true;
  if (trimmed.includes('2a96cbd8b46e442fc41c2b86b821562f')) return true;
  if (trimmed.includes('images.unsplash.com')) return true;
  return false;
}

export const MusicImage: React.FC<MusicImageProps> = ({
  type,
  artist,
  title,
  album,
  src,
  className = 'w-10 h-10 rounded-lg object-cover',
  alt = '',
  loading = 'lazy',
  onClick,
  titleTooltip,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(() => {
    if (!isInvalidOrPlaceholder(src)) return src!;
    return resolvePersistentImage(type, artist, title, album, src);
  });
  const [hasFailed, setHasFailed] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  // Synchronize when artist, title, album, or src changes
  useEffect(() => {
    setHasFailed(false);
    if (!isInvalidOrPlaceholder(src)) {
      setCurrentSrc(src!);
      return;
    }
    const resolved = resolvePersistentImage(type, artist, title, album, src);
    setCurrentSrc(resolved);

    // If resolved is placeholder, trigger immediate background fetch
    if (isInvalidOrPlaceholder(resolved)) {
      triggerLastfmFetch();
    }
  }, [artist, title, album, src, type]);

  // Listen for global photo-cache updates from background Last.fm fetches
  useEffect(() => {
    const handleCacheUpdated = () => {
      const snap = getPhotoCacheSnapshot();
      const cleanArtist = (artist || '').trim().toLowerCase();
      const cleanTitle = (title || '').trim().toLowerCase();
      const cleanAlbum = (album || '').trim().toLowerCase();

      if (type === 'artist' && cleanArtist && snap.artists[cleanArtist]) {
        setCurrentSrc(snap.artists[cleanArtist]);
        setHasFailed(false);
      } else if (type === 'album' && cleanAlbum && snap.albums[`${cleanArtist}:::${cleanAlbum}`]) {
        setCurrentSrc(snap.albums[`${cleanArtist}:::${cleanAlbum}`]);
        setHasFailed(false);
      } else if (type === 'track' && cleanTitle && snap.tracks[`${cleanArtist}:::${cleanTitle}`]) {
        setCurrentSrc(snap.tracks[`${cleanArtist}:::${cleanTitle}`]);
        setHasFailed(false);
      }
    };

    window.addEventListener('lastfm-photo-cached', handleCacheUpdated);
    return () => window.removeEventListener('lastfm-photo-cached', handleCacheUpdated);
  }, [type, artist, title, album]);

  const triggerLastfmFetch = async () => {
    if (fetchAttempted || !artist) return;
    setFetchAttempted(true);

    try {
      if (type === 'artist') {
        const photo = await fetchLastfmArtistPhoto(artist);
        if (photo && !isInvalidOrPlaceholder(photo)) {
          setCurrentSrc(photo);
          setHasFailed(false);
        }
      } else if (type === 'album' && album) {
        const photo = await fetchLastfmAlbumPhoto(artist, album);
        if (photo && !isInvalidOrPlaceholder(photo)) {
          setCurrentSrc(photo);
          setHasFailed(false);
        } else {
          // Fallback to artist
          const artPhoto = await fetchLastfmArtistPhoto(artist);
          if (artPhoto && !isInvalidOrPlaceholder(artPhoto)) {
            setCurrentSrc(artPhoto);
            setHasFailed(false);
          }
        }
      } else if (type === 'track') {
        let photo: string | null = null;
        if (title) {
          photo = await fetchLastfmTrackPhoto(artist, title);
        }
        if (!photo && album) {
          photo = await fetchLastfmAlbumPhoto(artist, album);
        }
        if (!photo) {
          photo = await fetchLastfmArtistPhoto(artist);
        }
        if (photo && !isInvalidOrPlaceholder(photo)) {
          setCurrentSrc(photo);
          setHasFailed(false);
        }
      }
    } catch (e) {
      // Ignore network errors
    }
  };

  const handleError = () => {
    // If the image fails to load, try hierarchical fallback
    if (!fetchAttempted) {
      triggerLastfmFetch();
    } else {
      setHasFailed(true);
    }
  };

  // If failed or completely empty after all attempts, display custom aesthetic vinyl/artist badge
  if (hasFailed || (!currentSrc && fetchAttempted)) {
    const initial = (title || album || artist || '?').charAt(0).toUpperCase();
    return (
      <div
        onClick={onClick}
        title={titleTooltip || alt}
        className={`${className} flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/60 text-zinc-300 font-bold flex-shrink-0 select-none shadow-inner`}
      >
        {type === 'artist' ? (
          <User className="w-1/2 h-1/2 text-zinc-400" />
        ) : type === 'album' ? (
          <Disc className="w-1/2 h-1/2 text-amber-400/80" />
        ) : (
          <span className="text-xs font-black text-purple-300 font-mono">{initial}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || title || album || artist || 'Music artwork'}
      className={className}
      loading={loading}
      onError={handleError}
      onClick={onClick}
      title={titleTooltip || alt}
    />
  );
};
