import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Star,
  Sparkles,
  Navigation,
  Share2,
  Check,
  X,
  AlertCircle,
  Upload,
  Camera,
  ShieldCheck,
  Info,
  Calendar,
} from 'lucide-react';
import api from '../api/axios.js';
import { ScoreBadge } from '../components/ScoreBadge.js';
import { AccessibilityBar } from '../components/AccessibilityBar.js';
import { FeatureChecklist } from '../components/FeatureChecklist.js';
import { ReviewList, ReviewItem } from '../components/ReviewList.js';
import { ReviewForm } from '../components/ReviewForm.js';
import { PlaceItem } from '../context/SearchContext.js';
import { useAuth } from '../context/AuthContext.js';
import { SEED_PLACES } from '../../server/src/seed/seedData.js';
import { SEED_REVIEWS } from '../../server/src/seed/seedReviews.js';

export const PlaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [place, setPlace] = useState<PlaceItem | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // AI Assessment State
  const [assessing, setAssessing] = useState<boolean>(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');

  // Photo upload
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    async function loadPlace() {
      if (!id) return;
      setLoading(true);

      // On GitHub Pages (static deploy), load from seed data
      const isStaticDeploy = import.meta.env.BASE_URL !== '/' && !import.meta.env.VITE_API_URL;
      if (isStaticDeploy) {
        const found = SEED_PLACES.find((p) => p._id === id);
        if (found) {
          setPlace({ ...found, createdAt: '2026-03-01T00:00:00.000Z', isSample: true } as PlaceItem);
          const placeReviews = SEED_REVIEWS.filter((r) => r.place === id) as any[];
          setReviews(placeReviews);
        } else {
          setError('Place not found');
        }
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/api/places/${id}`);
        if (res.data.success) {
          setPlace(res.data.place);
          setReviews(res.data.reviews || []);
          if (res.data.place.aiAssessment) {
            setAssessmentResult(res.data.place.aiAssessment);
          }
        } else {
          setError('Place not found');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading place');
      } finally {
        setLoading(false);
      }
    }
    loadPlace();
  }, [id]);

  const handleReviewAdded = (newReview: ReviewItem, updatedPlaceStats: any) => {
    setReviews((prev) => [newReview, ...prev]);
    if (place) {
      setPlace({
        ...place,
        averageRating: updatedPlaceStats.averageRating,
        reviewCount: updatedPlaceStats.reviewCount,
        accessibilityScore: updatedPlaceStats.accessibilityScore,
      });
    }
  };

  const handleReviewDeleted = (deletedId: string) => {
    setReviews((prev) => prev.filter((r) => r._id !== deletedId));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const runAiAssessment = async (imageUrl?: string) => {
    if (!id) return;
    setAssessing(true);
    try {
      let res;
      if (selectedImageFile) {
        const formData = new FormData();
        formData.append('image', selectedImageFile);
        res = await api.post(`/api/places/${id}/assess`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        const imgToScan = imageUrl || place?.photos?.[0];
        if (!imgToScan) {
          alert('Upload an entrance photo before requesting an AI assessment.');
          return;
        }
        res = await api.post(`/api/places/${id}/assess`, { imageUrl: imgToScan });
      }

      if (res.data.success) {
        setAssessmentResult(res.data.assessment);
        if (place) {
          setPlace({ ...place, aiAssessment: res.data.assessment });
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'AI assessment failed');
    } finally {
      setAssessing(false);
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim() || !id) return;
    setUploadingPhoto(true);
    try {
      const res = await api.post(`/api/places/${id}/photos`, { photoUrl: newPhotoUrl.trim() });
      if (res.data.success && place) {
        setPlace({ ...place, photos: res.data.photos });
        setNewPhotoUrl('');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Could not add photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Loading Coimbatore Landmark...</p>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">{error || 'Place Not Found'}</h2>
        <Link
          to="/search"
          className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
        >
          Back to Coimbatore Places
        </Link>
      </div>
    );
  }

  const [lng, lat] = place.location?.coordinates || [76.9558, 11.0168];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Info Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                {place.category}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Coimbatore Verified
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{place.name}</h1>
            <p className="text-xs sm:text-sm text-slate-500 flex items-center">
              <MapPin className="w-4 h-4 text-red-500 mr-1.5 shrink-0" />
              <span>{place.address}, {place.area}, {place.city}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Navigation className="w-4 h-4" />
              <span>Get Directions</span>
            </a>
          </div>
        </div>

        {/* Large Score Card */}
        <ScoreBadge score={place.accessibilityScore} size="lg" />
      </div>

      {/* Photos Carousel / Gallery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Photos & Entrances</h3>
          <span className="text-xs text-slate-400">Up to 5 photos</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {place.photos && place.photos.length > 0 ? (
            place.photos.map((photo, i) => (
              <div key={i} className="relative h-48 rounded-2xl overflow-hidden border border-slate-200 group">
                <img
                  src={photo}
                  alt={`${place.name} view ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))
          ) : (
            <div className="col-span-3 h-40 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
              No photos uploaded yet.
            </div>
          )}
        </div>

        {/* Add photo input */}
        {isAuthenticated && (place.photos || []).length < 5 && (
          <form onSubmit={handleAddPhoto} className="flex gap-2 max-w-md pt-1">
            <input
              type="url"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              placeholder="Paste public photo URL (e.g. entrance ramp image)..."
              className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
              required
            />
            <button
              type="submit"
              disabled={uploadingPhoto}
              className="px-3.5 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors"
            >
              {uploadingPhoto ? 'Adding...' : 'Add Photo'}
            </button>
          </form>
        )}
      </div>

      {/* Physical Accessibility Features Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Physical Accessibility Infrastructure</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified checklist of standard accessibility accommodations according to Sugamya Bharat Abhiyan guidelines.
          </p>
        </div>

        <FeatureChecklist features={place.accessibilityFeatures} />

        <div className="pt-4 border-t border-slate-100">
          <AccessibilityBar score={place.accessibilityScore} />
        </div>
      </div>

      {/* ADVANCED FEATURE 6A & 6D: AI-BASED ACCESSIBILITY ASSESSMENT */}
      <div id="assess" className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">
                AI Multimodal Accessibility Assessment
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Powered by Google Gemini 3.8 Flash Vision
              </span>
            </div>
          </div>

          <span className="bg-amber-400/20 text-amber-300 text-xs font-semibold px-3 py-1 rounded-full border border-amber-400/30">
            AI-generated · unverified
          </span>
        </div>

        <p className="text-xs text-indigo-100/90 leading-relaxed max-w-3xl">
          Upload or select an entrance photo. Gemini reports visible ramps, steps, and doorway clearance; it cannot verify hidden conditions or exact measurements from a photo alone.
        </p>

        {/* Upload & Trigger Controls */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors">
              <Camera className="w-4 h-4" />
              <span>Upload Entrance Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => runAiAssessment()}
              disabled={assessing}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>{assessing ? 'Gemini Analyzing Image...' : 'Check This Entrance'}</span>
            </button>

            {selectedImageFile && (
              <span className="text-xs text-indigo-200">
                Selected: {selectedImageFile.name}
              </span>
            )}
          </div>

          {imagePreviewUrl && (
            <div className="w-48 h-32 rounded-xl overflow-hidden border border-white/20 mt-2">
              <img src={imagePreviewUrl} alt="Entrance scan preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Assessment Result Checklist */}
        {assessmentResult && (
          <div className="bg-white/95 text-slate-900 rounded-2xl p-5 shadow-lg border border-white/20 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-900 flex items-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
                Gemini Multimodal Inspection Report
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500">Confidence:</span>
                <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {Math.round((assessmentResult.confidence ?? 0) * 100)}%
                </span>
              </div>
            </div>

            {/* Checklist items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                assessmentResult.hasRamp === true
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : assessmentResult.hasRamp === false
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="font-semibold">Wheelchair Ramp</span>
                {assessmentResult.hasRamp === true
                  ? <Check className="w-4 h-4 text-emerald-600" />
                  : assessmentResult.hasRamp === false
                    ? <X className="w-4 h-4 text-red-600" />
                    : <span className="font-semibold">Not clear in photo</span>}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                assessmentResult.rampWidthAdequate === true
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : assessmentResult.rampWidthAdequate === false
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="font-semibold">Ramp Width Adequate</span>
                {assessmentResult.rampWidthAdequate === true
                  ? <Check className="w-4 h-4 text-emerald-600" />
                  : assessmentResult.rampWidthAdequate === false
                    ? <X className="w-4 h-4 text-red-600" />
                    : <span className="font-semibold">Not measurable</span>}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                assessmentResult.hasSteps === true
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : assessmentResult.hasSteps === false
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="font-semibold">Step Barriers</span>
                {assessmentResult.hasSteps === true
                  ? <span className="font-bold text-amber-700">Steps Present</span>
                  : assessmentResult.hasSteps === false
                    ? <span className="font-bold text-emerald-700">No steps visible</span>
                    : <span className="font-semibold">Not clear in photo</span>}
              </div>

              <div className="p-3 rounded-xl border bg-slate-50 border-slate-200 text-slate-800 flex items-center justify-between">
                <span className="font-semibold">Doorway Clearance</span>
                <span className="font-bold capitalize bg-white px-2 py-0.5 rounded border border-slate-200">
                  {assessmentResult.doorWidth || 'unknown'}
                </span>
              </div>
            </div>

            {/* Recommendations */}
            {assessmentResult.recommendations && assessmentResult.recommendations.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-700 block mb-1">
                  AI Actionable Recommendations:
                </span>
                <ul className="space-y-1">
                  {assessmentResult.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start">
                      <span className="text-indigo-500 mr-2 font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Community Reviews Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Verified Citizen Reviews</h3>
            <p className="text-xs text-slate-500">
              Real visitor feedback directly influencing the Coimbatore accessibility score.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="flex items-center text-amber-500 font-black">
              <Star className="w-4 h-4 fill-current mr-1" />
              <span>{place.averageRating > 0 ? place.averageRating.toFixed(1) : 'No reviews'}</span>
            </div>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-600 font-semibold">{place.reviewCount} total</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <ReviewForm placeId={place._id} onReviewAdded={handleReviewAdded} />
          </div>

          <div className="lg:col-span-2">
            <ReviewList reviews={reviews} onReviewDeleted={handleReviewDeleted} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceDetail;
