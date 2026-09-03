import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  constructor(private http: HttpClient) {}

  // Convert an address into coordinates
  geocodeAddress(address: string): Observable<any[]> {

    const url =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

    return this.http.get<any[]>(url);
  }

  // Calculate driving route between two locations
  getRoute(
    pickupLat: number,
    pickupLng: number,
    destinationLat: number,
    destinationLng: number
  ): Observable<any> {

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pickupLng},${pickupLat};${destinationLng},${destinationLat}` +
      `?overview=full&geometries=geojson`;

    return this.http.get<any>(url);
  }
}