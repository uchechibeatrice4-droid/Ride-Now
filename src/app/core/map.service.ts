import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private readonly nominatimUrl =
    'https://nominatim.openstreetmap.org/search';

  private readonly overpassUrl =
    'https://overpass-api.de/api/interpreter';

  constructor(private http: HttpClient) {}

  // Find the searched area first
  geocodeAddress(
    address: string,
    limit: number = 5
  ): Observable<any[]> {

    const params = new HttpParams()
      .set('format', 'json')
      .set('q', `${address}, Lagos, Nigeria`)
      .set('addressdetails', '1')
      .set('countrycodes', 'ng')
      .set('limit', limit.toString())
      .set('viewbox', '2.70,7.00,3.70,6.30')
      .set('bounded', '1');

    return this.http.get<any[]>(this.nominatimUrl, { params });
  }

  // Find places, streets and buildings around an area
  getNearbyPlaces(
    lat: number,
    lng: number,
    radius: number = 3000
  ): Observable<any[]> {

    const query = `
      [out:json][timeout:20];

      (
        node["name"](around:${radius},${lat},${lng});
        way["name"](around:${radius},${lat},${lng});
        relation["name"](around:${radius},${lat},${lng});
      );

      out center tags;
    `;

    const params = new HttpParams()
      .set('data', query);

    return this.http
      .get<any>(this.overpassUrl, { params })
      .pipe(
        map(response => response.elements || [])
      );
  }

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