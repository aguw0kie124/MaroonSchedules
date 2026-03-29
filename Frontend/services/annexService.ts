import { API_URL } from '../config';

async function requestAnnexJson<T>(path: string) {
  const response = await fetch(`${API_URL}${path}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || `Request failed for ${path}`);
  }
  return payload as T;
}

export interface AnnexLibrary {
  id: string;
  name: string;
  search_url: string;
  vendor: string;
  booking_mode: string;
}

export interface AnnexRoomGroup {
  id: string;
  name: string;
}

export interface AnnexEligibility {
  status: 'eligible' | 'requires_login' | 'unauthorized';
  message: string;
}

export interface AnnexLibraryDetail extends AnnexLibrary {
  room_groups: AnnexRoomGroup[];
  booking_rules: string[];
  eligibility: AnnexEligibility;
  supports_direct_submission: boolean;
  availability_mode: string;
  booking_handoff: {
    mode: string;
    message: string;
  };
}

export interface AnnexRentalCategory {
  id: string;
  name: string;
  browse_url: string;
}

export interface AnnexRentalItem {
  id: string;
  name: string;
  model?: string;
  description?: string;
  image_url?: string | null;
  detail_url?: string;
  browse_url: string;
  availability_status: string;
  booking_mode: string;
}

export interface AnnexRentalsOverview {
  vendor: string;
  booking_mode: string;
  categories: AnnexRentalCategory[];
  locations: AnnexRentalCategory[];
}

export interface AnnexRentalDetail extends AnnexRentalCategory {
  vendor: string;
  eligibility: AnnexEligibility;
  supports_direct_submission: boolean;
  availability_mode: string;
  items: AnnexRentalItem[];
  booking_handoff: {
    mode: string;
    message: string;
  };
}

export async function fetchAnnexLibraries() {
  return requestAnnexJson<{ vendor: string; items: AnnexLibrary[] }>('/annex/libraries');
}

export async function fetchAnnexLibraryDetail(libraryId: string, email?: string) {
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  return requestAnnexJson<AnnexLibraryDetail>(`/annex/libraries/${encodeURIComponent(libraryId)}${params}`);
}

export async function fetchAnnexRentals() {
  return requestAnnexJson<AnnexRentalsOverview>('/annex/rentals');
}

export async function fetchAnnexRentalDetail(rentalId: string, email?: string) {
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  return requestAnnexJson<AnnexRentalDetail>(`/annex/rentals/${encodeURIComponent(rentalId)}${params}`);
}
