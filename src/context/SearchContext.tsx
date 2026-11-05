import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios.js';
import { SEED_PLACES } from '../../server/src/seed/seedData.js';

export interface PlaceItem {
  _id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  area: string;
  city: string;
  location: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  accessibilityFeatures: {
    wheelchairRamp: boolean;
    lift: boolean;
    accessibleToilet: boolean;
    parking: boolean;
    braille: boolean;
    audioAssistance: boolean;
  };
  accessibilityScore: number;
  photos: string[];
  aiAssessment?: {
    hasRamp?: boolean | null;
    rampWidthAdequate?: boolean | null;
    hasSteps?: boolean | null;
    doorWidth?: 'wide' | 'narrow' | 'unknown';
    confidence?: number;
    recommendations?: string[];
    assessedAt?: string;
  };
  averageRating: number;
  reviewCount: number;
  status: string;
  distance?: number;
  createdAt: string;
  isSample?: boolean;
}

export interface FeaturesFilter {
  wheelchairRamp: boolean;
  lift: boolean;
  accessibleToilet: boolean;
  parking: boolean;
  braille: boolean;
  audioAssistance: boolean;
}

interface SearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  category: string;
  setCategory: (cat: string) => void;
  area: string;
  setArea: (area: string) => void;
  features: FeaturesFilter;
  setFeatures: React.Dispatch<React.SetStateAction<FeaturesFilter>>;
  toggleFeature: (key: keyof FeaturesFilter) => void;
  minRating: number;
  setMinRating: (rating: number) => void;
  minScore: number;
  setMinScore: (score: number) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  userLocation: { lat: number; lng: number } | null;
  requestUserLocation: () => void;
  clearUserLocation: () => void;
  places: PlaceItem[];
  loading: boolean;
  isSampleData: boolean;
  fetchPlaces: () => Promise<void>;
  resetFilters: () => void;
}

const samplePlaces: PlaceItem[] = SEED_PLACES.filter((place) => place.status === 'approved').map((place) => ({
  ...place,
  createdAt: '2026-03-01T00:00:00.000Z',
  isSample: true,
}));
const featureKeys: (keyof FeaturesFilter)[] = [
  'wheelchairRamp',
  'lift',
  'accessibleToilet',
  'parking',
  'braille',
  'audioAssistance',
];

const defaultFeatures: FeaturesFilter = {
  wheelchairRamp: false,
  lift: false,
  accessibleToilet: false,
  parking: false,
  braille: false,
  audioAssistance: false,
};

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [area, setArea] = useState('All');
  const [features, setFeatures] = useState<FeaturesFilter>(defaultFeatures);
  const [minRating, setMinRating] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState('score_desc');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSampleData, setIsSampleData] = useState(false);

  const toggleFeature = (key: keyof FeaturesFilter) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Geolocation warning/denied:', error.message);
        // Default to Coimbatore Gandhipuram if permission denied
        setUserLocation({ lat: 11.0168, lng: 76.9558 });
      }
    );
  };

  const clearUserLocation = () => {
    setUserLocation(null);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategory('All');
    setArea('All');
    setFeatures(defaultFeatures);
    setMinRating(0);
    setMinScore(0);
    setSortBy('score_desc');
    setUserLocation(null);
  };

  const fetchPlaces = useCallback(async () => {
    const filterSamplePlaces = () => {
      let matchingPlaces = samplePlaces.filter((place) => {
        const searchText = `${place.name} ${place.category} ${place.description} ${place.address} ${place.area}`.toLowerCase();
        return (
          (!searchTerm.trim() || searchText.includes(searchTerm.trim().toLowerCase())) &&
          (category === 'All' || place.category === category) &&
          (area === 'All' || place.area === area) &&
          place.averageRating >= minRating &&
          place.accessibilityScore >= minScore &&
          featureKeys.every((key) => !features[key] || place.accessibilityFeatures[key])
        );
      });

      if (userLocation) {
        const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
        const withDistance = matchingPlaces.map((place) => {
          const [longitude, latitude] = place.location.coordinates;
          const latitudeDifference = toRadians(latitude - userLocation.lat);
          const longitudeDifference = toRadians(longitude - userLocation.lng);
          const distance =
            6371 *
            2 *
            Math.asin(
              Math.sqrt(
                Math.sin(latitudeDifference / 2) ** 2 +
                  Math.cos(toRadians(userLocation.lat)) *
                    Math.cos(toRadians(latitude)) *
                    Math.sin(longitudeDifference / 2) ** 2
              )
            );
          return { ...place, distance: Number(distance.toFixed(1)) };
        });
        matchingPlaces = withDistance.filter((place) => (place.distance ?? 0) <= 15);
      }

      return matchingPlaces.sort((first, second) => {
        switch (sortBy) {
          case 'rating_desc':
            return second.averageRating - first.averageRating;
          case 'newest':
            return second.createdAt.localeCompare(first.createdAt);
          case 'name_asc':
            return first.name.localeCompare(second.name);
          default:
            return second.accessibilityScore - first.accessibilityScore;
        }
      });
    };

    // On GitHub Pages (static deploy), no backend is available — always use sample data
    const isStaticDeploy = import.meta.env.BASE_URL !== '/' && !import.meta.env.VITE_API_URL;
    if (isStaticDeploy) {
      setPlaces(filterSamplePlaces());
      setIsSampleData(true);
      return;
    }

    setLoading(true);
    try {
      const params: any = {};
      if (searchTerm.trim()) params.q = searchTerm.trim();
      if (category !== 'All') params.category = category;
      if (area !== 'All') params.area = area;
      if (minRating > 0) params.minRating = minRating;
      if (minScore > 0) params.minScore = minScore;
      if (sortBy) params.sort = sortBy;

      if (features.wheelchairRamp) params.wheelchairRamp = 'true';
      if (features.lift) params.lift = 'true';
      if (features.accessibleToilet) params.accessibleToilet = 'true';
      if (features.parking) params.parking = 'true';
      if (features.braille) params.braille = 'true';
      if (features.audioAssistance) params.audioAssistance = 'true';

      if (userLocation) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
        params.radiusKm = 15;
      }

      const res = await api.get('/api/places/search', { params });
      if (res.data.success) {
        setPlaces(res.data.places || []);
        setIsSampleData(false);
      }
    } catch (err) {
      console.warn('Places API unavailable; showing sample listings instead.', err);
      setPlaces(filterSamplePlaces());
      setIsSampleData(true);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, category, area, features, minRating, minScore, sortBy, userLocation]);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  return (
    <SearchContext.Provider
      value={{
        searchTerm,
        setSearchTerm,
        category,
        setCategory,
        area,
        setArea,
        features,
        setFeatures,
        toggleFeature,
        minRating,
        setMinRating,
        minScore,
        setMinScore,
        sortBy,
        setSortBy,
        userLocation,
        requestUserLocation,
        clearUserLocation,
        places,
        loading,
        isSampleData,
        fetchPlaces,
        resetFilters,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
