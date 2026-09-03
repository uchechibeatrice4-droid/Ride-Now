import { Component, AfterViewInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import * as L from 'leaflet';
import { MapService } from '../../core/map.service';

@Component({
  selector: 'app-request-ride',
  templateUrl: './request-ride.component.html',
  styleUrls: ['./request-ride.component.css']
})
export class RequestRideComponent implements AfterViewInit {

  private map!: L.Map;
  private pickupMarker: L.Marker | null = null;
  private destinationMarker: L.Marker | null = null;

  pickupCoordinates: { lat: number; lng: number } | null = null;
  destinationCoordinates: { lat: number; lng: number } | null = null;

  distanceKm: number = 0;
  estimatedFare: number = 0;

  routeLayer: L.GeoJSON | null = null;

  loadingRoute: boolean = false;

  // Modal
  modalVisible: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalType: 'success' | 'error' | 'confirm' = 'success';

  rideForm = this.fb.group({
    pickup: ['', Validators.required],
    destination: ['', Validators.required],
    rideType: ['Standard', Validators.required],
    paymentMethod: ['cash', Validators.required]
  });

  constructor(
    private fb: FormBuilder,
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth,
    private mapService: MapService
  ) {}

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  private initializeMap(): void {

    this.map = L.map('ride-map').setView(
      [6.5244, 3.3792],
      12
    );

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors'
      }
    ).addTo(this.map);
  }

  // =========================
  // MODAL
  // =========================

  openModal(
    title: string,
    message: string,
    type: 'success' | 'error' | 'confirm'
  ): void {

    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.modalVisible = true;
  }

  closeModal(): void {
    this.modalVisible = false;
  }

  confirmAction(): void {
    this.closeModal();
  }

  // =========================
  // CALCULATE ROUTE
  // =========================

  calculateRoute(): void {

    const pickup = this.rideForm.value.pickup?.trim();
    const destination = this.rideForm.value.destination?.trim();

    if (!pickup || !destination) {
      return;
    }

    this.loadingRoute = true;

    this.mapService
      .geocodeAddress(`${pickup}, Lagos, Nigeria`)
      .subscribe({

        next: (pickupResult) => {

          if (!pickupResult.length) {

            this.loadingRoute = false;

            this.openModal(
              'Pickup Not Found',
              'We could not find your pickup location. Please check the address and try again.',
              'error'
            );

            return;
          }

          this.pickupCoordinates = {
            lat: Number(pickupResult[0].lat),
            lng: Number(pickupResult[0].lon)
          };

          this.mapService
            .geocodeAddress(`${destination}, Lagos, Nigeria`)
            .subscribe({

              next: (destinationResult) => {

                if (!destinationResult.length) {

                  this.loadingRoute = false;

                  this.openModal(
                    'Destination Not Found',
                    'We could not find your destination. Please check the address and try again.',
                    'error'
                  );

                  return;
                }

                this.destinationCoordinates = {
                  lat: Number(destinationResult[0].lat),
                  lng: Number(destinationResult[0].lon)
                };

                this.mapService
                  .getRoute(
                    this.pickupCoordinates!.lat,
                    this.pickupCoordinates!.lng,
                    this.destinationCoordinates.lat,
                    this.destinationCoordinates.lng
                  )
                  .subscribe({

                    next: (routeData) => {

                      if (
                        !routeData.routes ||
                        !routeData.routes.length
                      ) {

                        this.loadingRoute = false;

                        this.openModal(
                          'Route Not Found',
                          'We could not find a driving route between these locations.',
                          'error'
                        );

                        return;
                      }

                      const route = routeData.routes[0];

                      // Convert metres to kilometres
                      this.distanceKm = route.distance / 1000;

                      // Calculate fare
                      this.calculateFare();

                      // Draw route on map
                      this.drawRoute(route.geometry);

                      this.loadingRoute = false;

                      this.openModal(
                        'Fare Calculated',
                        `Your estimated fare is ₦${this.estimatedFare.toLocaleString()} for ${this.distanceKm.toFixed(1)} km.`,
                        'success'
                      );
                    },

                    error: (error) => {

                      console.error(
                        'Route error:',
                        error
                      );

                      this.loadingRoute = false;

                      this.openModal(
                        'Route Error',
                        'Something went wrong while calculating your route. Please try again.',
                        'error'
                      );
                    }
                  });
              },

              error: (error) => {

                console.error(
                  'Destination search error:',
                  error
                );

                this.loadingRoute = false;

                this.openModal(
                  'Destination Error',
                  'Something went wrong while searching for your destination.',
                  'error'
                );
              }
            });
        },

        error: (error) => {

          console.error(
            'Pickup search error:',
            error
          );

          this.loadingRoute = false;

          this.openModal(
            'Pickup Error',
            'Something went wrong while searching for your pickup location.',
            'error'
          );
        }
      });
  }

  // =========================
  // FARE CALCULATION
  // =========================

  calculateFare(): void {

    const baseFare =
      this.rideForm.value.rideType === 'Premium'
        ? 1500
        : 1000;

    const pricePerKm =
      this.rideForm.value.rideType === 'Premium'
        ? 250
        : 180;

    this.estimatedFare = Math.round(
      baseFare + (this.distanceKm * pricePerKm)
    );
  }

  // =========================
  // DRAW ROUTE
  // =========================

  drawRoute(geometry: any): void {

    if (this.routeLayer) {
      this.routeLayer.remove();
    }

    this.routeLayer = L.geoJSON(
      geometry
    ).addTo(this.map);

    this.map.fitBounds(
      this.routeLayer.getBounds(),
      {
        padding: [30, 30]
      }
    );
  }

  // =========================
  // REQUEST RIDE
  // =========================

  requestRide(): void {

    if (this.rideForm.invalid) {
      return;
    }

    // Make sure fare has been calculated
    if (
      !this.pickupCoordinates ||
      !this.destinationCoordinates ||
      this.distanceKm <= 0 ||
      this.estimatedFare <= 0
    ) {

      this.openModal(
        'Fare Required',
        'Please calculate your fare before requesting a ride.',
        'error'
      );

      return;
    }

    this.fireAuth.currentUser.then(user => {

      if (!user) {

        this.openModal(
          'Login Required',
          'Please login before requesting a ride.',
          'error'
        );

        return;
      }

      const rideData = {

        riderId: user.uid,

        pickup: this.rideForm.value.pickup,

        destination: this.rideForm.value.destination,

        pickupCoordinates:
          this.pickupCoordinates,

        destinationCoordinates:
          this.destinationCoordinates,

        distanceKm:
          Number(this.distanceKm.toFixed(2)),

        rideType:
          this.rideForm.value.rideType,

        fare:
          this.estimatedFare,

        status:
          'requested',

        paymentMethod:
          this.rideForm.value.paymentMethod,

        paymentStatus:
          'unpaid',

        createdAt:
          new Date()
      };

      this.firestore
        .collection('rides')
        .add(rideData)

        .then(() => {

          this.openModal(
            'Ride Requested',
            'Your ride request has been submitted successfully.',
            'success'
          );

          this.rideForm.reset({
            pickup: '',
            destination: '',
            rideType: 'Standard',
            paymentMethod: 'cash'
          });

          this.pickupCoordinates = null;

          this.destinationCoordinates = null;

          this.distanceKm = 0;

          this.estimatedFare = 0;

          if (this.routeLayer) {

            this.routeLayer.remove();

            this.routeLayer = null;
          }

          this.map.setView(
            [6.5244, 3.3792],
            12
          );
        })

        .catch(error => {

          console.error(
            'Error creating ride:',
            error
          );

          this.openModal(
            'Request Failed',
            'We could not submit your ride request. Please try again.',
            'error'
          );
        });
    });
  }
}