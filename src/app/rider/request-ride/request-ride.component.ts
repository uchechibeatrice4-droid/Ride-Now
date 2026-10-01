import { Component, AfterViewInit, OnDestroy } from '@angular/core';
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
export class RequestRideComponent
  implements AfterViewInit, OnDestroy {

  map!: L.Map;

  pickupMarker: L.Marker | null = null;

  destinationMarker: L.Marker | null = null;

  routeLayer: L.GeoJSON | null = null;

  pickupCoordinates: {
    lat: number;
    lng: number;
  } | null = null;

  destinationCoordinates: {
    lat: number;
    lng: number;
  } | null = null;

  pickupSuggestions: any[] = [];

  destinationSuggestions: any[] = [];

  showPickupSuggestions = false;

  showDestinationSuggestions = false;

  pickupSearchTimer: any;

  destinationSearchTimer: any;

  distanceKm = 0;

  estimatedFare = 0;

  loadingRoute = false;

  /*
   * Route is only considered valid after
   * the Calculate Route button succeeds.
   */
  routeCalculated = false;

  // ================================
  // MODAL
  // ================================

  modalVisible = false;

  modalTitle = '';

  modalMessage = '';

  modalType:
    'success' |
    'error' |
    'confirm' = 'success';

  // ================================
  // PAYMENT
  // ================================

  completedUnpaidRide: any = null;

  cardNumber = '';

  cardHolderName = '';

  cardExpiry = '';

  cardCvv = '';

  paymentLoading = false;

  pendingPaymentAction:
    'cash' |
    'card' |
    null = null;

  // ================================
  // RIDE FORM
  // ================================

  rideForm = this.fb.group({

    pickup: [
      '',
      Validators.required
    ],

    destination: [
      '',
      Validators.required
    ],

    rideType: [
      'Standard',
      Validators.required
    ],

    paymentMethod: [
      '',
      Validators.required
    ],

  });

  standardBaseFare = 1000; // Base fare for Standard ride

  standardPerKmRate = 180; // Rate per km for Standard ride

  premiumBaseFare = 1500; // Base fare for Premium ride

  premiumPerKmRate = 250; // Rate per km for Premium ride

  constructor(

    private fb: FormBuilder,

    private firestore: AngularFirestore,

    private afAuth: AngularFireAuth,

    private mapService: MapService

  ) {
    this.loadFees();
  }

  loadFees(): void {

    this.firestore
      .collection('settings')
      .doc('fees')
      .valueChanges()
      .subscribe({

        next: (fees: any) => {

          if (fees) {

            this.standardBaseFare =
              Number(fees.standardBaseFare ?? 1000);

            this.standardPerKmRate =
              Number(fees.standardPerKm ?? 180);

            this.premiumBaseFare =
              Number(fees.premiumBaseFare ?? 1500);

            this.premiumPerKmRate =
              Number(fees.premiumPerKm ?? 250);

          }

        },

        error: error => {
          console.error('Error loading ride fees:', error);
        }

      });

  }

  // ==============================
  // AFTER VIEW INIT
  // ==============================

  ngAfterViewInit(): void {

    setTimeout(() => {

      this.initializeMap();

    }, 100);

    /*
     * Load any completed ride that
     * still needs payment.
     */
    this.loadCompletedUnpaidRide();

  }

  // ==============================
  // INITIALIZE MAP
  // ==============================

  initializeMap(): void {

    this.map = L.map(
      'ride-map',
      {
        center: [
          6.5244,
          3.3792
        ],
        zoom: 12
      }
    );

    L.tileLayer(

      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

      {

        attribution:
          '&copy; OpenStreetMap contributors'

      }

    ).addTo(this.map);

  }

  // ==============================
  // DESTROY
  // ==============================

  ngOnDestroy(): void {

    clearTimeout(
      this.pickupSearchTimer
    );

    clearTimeout(
      this.destinationSearchTimer
    );

    if (this.map) {

      this.map.remove();

    }

  }

  // ==============================
  // MODAL
  // ==============================

  openModal(

    title: string,

    message: string,

    type:
      'success' |
      'error' |
      'confirm'

  ): void {

    this.modalTitle = title;

    this.modalMessage = message;

    this.modalType = type;

    this.modalVisible = true;

  }

  closeModal(): void {

    this.modalVisible = false;

    this.pendingPaymentAction = null;

  }

  confirmAction(): void {

    // ==============================
    // CONFIRM CASH PAYMENT
    // ==============================

    if (

      this.modalType === 'confirm' &&

      this.pendingPaymentAction === 'cash' &&

      this.completedUnpaidRide

    ) {

      const rideId =
        this.completedUnpaidRide.id;

      this.modalVisible = false;

      this.pendingPaymentAction = null;

      this.firestore
        .collection('rides')
        .doc(rideId)
        .update({

          paymentMethod: 'cash',

          paymentStatus: 'paid',

          paidAt: new Date()

        })

        .then(() => {

          this.completedUnpaidRide = null;

          this.openModal(

            'Payment Successful',

            'Your cash payment has been recorded successfully.',

            'success'

          );

        })

        .catch(error => {

          console.error(
            'Cash payment error:',
            error
          );

          this.openModal(

            'Payment Failed',

            'Could not record your cash payment.',

            'error'

          );

        });

      return;

    }

    this.closeModal();

  }

  // ==============================
  // LOAD COMPLETED UNPAID RIDE
  // ==============================

  loadCompletedUnpaidRide(): void {

    this.afAuth.currentUser.then(user => {

      if (!user) {

        return;

      }

      this.firestore
        .collection('rides')
        .ref
        .where(
          'riderId',
          '==',
          user.uid
        )
        .where(
          'status',
          '==',
          'completed'
        )
        .where(
          'paymentStatus',
          '==',
          'unpaid'
        )
        .get()
        .then(snapshot => {

          if (snapshot.empty) {

            this.completedUnpaidRide = null;

            return;

          }

          const rides =
            snapshot.docs.map(doc => {

              const data: any = doc.data();

              return {
                id: doc.id,
                ...data
              };

            });

          /*
           * Sort completed rides locally.
           * This avoids requiring a Firestore
           * composite index.
           */
          rides.sort((a: any, b: any) => {

            const dateA =
              a.completedAt?.toDate
                ? a.completedAt.toDate().getTime()
                : new Date(
                  a.completedAt || 0
                ).getTime();

            const dateB =
              b.completedAt?.toDate
                ? b.completedAt.toDate().getTime()
                : new Date(
                  b.completedAt || 0
                ).getTime();

            return dateB - dateA;

          });

          this.completedUnpaidRide =
            rides[0];

        })
        .catch(error => {

          console.error(
            'Error loading unpaid ride:',
            error
          );

        });

    });

  }

  // ==============================
  // PICKUP SEARCH
  // ==============================

  searchPickupSuggestions(): void {

    const value =
      this.rideForm
        .get('pickup')
        ?.value
        ?.trim() || '';

    /*
     * Pickup changed, so the previous
     * route is no longer valid.
     */
    this.invalidateRoute();

    this.pickupCoordinates = null;

    clearTimeout(
      this.pickupSearchTimer
    );

    if (value.length < 2) {

      this.pickupSuggestions = [];

      this.showPickupSuggestions = false;

      return;

    }

    this.pickupSearchTimer =
      setTimeout(() => {

        this.mapService
          .geocodeAddress(
            value,
            8
          )
          .subscribe({

            next: (results) => {

              if (
                !results ||
                results.length === 0
              ) {

                this.pickupSuggestions = [];

                this.showPickupSuggestions =
                  false;

                return;

              }

              this.pickupSuggestions =

                this.removeDuplicateSuggestions(

                  results

                    .map(result => {

                      const lat =
                        Number(
                          result.lat
                        );

                      const lon =
                        Number(
                          result.lon
                        );

                      return {

                        ...result,

                        lat,

                        lon,

                        cleanName:
                          this.cleanSearchResult(
                            result
                          ),

                        category:
                          this.getResultCategory(
                            result
                          )

                      };

                    })

                    .filter(
                      result =>
                        result.cleanName
                    )

                ).slice(0, 8);

              this.showPickupSuggestions =
                this.pickupSuggestions.length > 0;

            },

            error: () => {

              this.pickupSuggestions = [];

              this.showPickupSuggestions =
                false;

            }

          });

      }, 400);

  }

  // ==============================
  // INVALIDATE ROUTE
  // ==============================

  invalidateRoute(): void {

    this.routeCalculated = false;

    this.distanceKm = 0;

    this.estimatedFare = 0;

    if (
      this.map &&
      this.routeLayer
    ) {

      this.map.removeLayer(
        this.routeLayer
      );

      this.routeLayer = null;

    }

  }

  // ==============================
  // SELECT PICKUP
  // ==============================

  selectPickupSuggestion(
    suggestion: any
  ): void {

    this.rideForm.patchValue({

      pickup:
        suggestion.cleanName

    });

    this.pickupCoordinates = {

      lat:
        Number(
          suggestion.lat
        ),

      lng:
        Number(
          suggestion.lon
        )

    };

    this.showPickupSuggestions =
      false;

    this.pickupSuggestions = [];

    this.addPickupMarker(

      Number(
        suggestion.lat
      ),

      Number(
        suggestion.lon
      )

    );

    /*
     * Do NOT calculate the route here.
     *
     * The user must click
     * "Get Fare Estimate".
     */

  }

  // ==============================
  // CLOSE SUGGESTIONS
  // ==============================

  closeSuggestions(): void {

    this.showPickupSuggestions =
      false;

    this.showDestinationSuggestions =
      false;

  }

  // ==============================
  // PICKUP MARKER
  // ==============================

  addPickupMarker(
    lat: number,
    lng: number
  ): void {

    if (!this.map) {

      return;

    }

    if (this.pickupMarker) {

      this.map.removeLayer(
        this.pickupMarker
      );

    }

    this.pickupMarker =
      L.marker(

        [
          lat,
          lng
        ],

        {

          icon:

            L.divIcon({

              className:
                'custom-map-pin',

              html: `

                <div style="
                  width:28px;
                  height:28px;
                  border-radius:50%;
                  background:#4776e6;
                  border:4px solid white;
                  box-shadow:0 3px 10px rgba(0,0,0,.2);
                "></div>

              `,

              iconSize:
                [28, 28],

              iconAnchor:
                [14, 14]

            })

        }

      ).addTo(this.map);

    this.pickupMarker.bindPopup(

      `<strong>Pickup</strong><br>${this.rideForm.value.pickup}`

    );

  }

  // ==============================
  // DESTINATION SEARCH
  // ==============================

  searchDestinationSuggestions(): void {

    const value =
      this.rideForm
        .get('destination')
        ?.value
        ?.trim() || '';

    /*
     * Destination changed, so the
     * previous route is no longer valid.
     */
    this.invalidateRoute();

    this.destinationCoordinates = null;

    clearTimeout(
      this.destinationSearchTimer
    );

    if (value.length < 2) {

      this.destinationSuggestions = [];

      this.showDestinationSuggestions =
        false;

      return;

    }

    this.destinationSearchTimer =
      setTimeout(() => {

        this.mapService
          .geocodeAddress(
            value,
            8
          )
          .subscribe({

            next: (results) => {

              if (
                !results ||
                results.length === 0
              ) {

                this.destinationSuggestions = [];

                this.showDestinationSuggestions =
                  false;

                return;

              }

              this.destinationSuggestions =

                this.removeDuplicateSuggestions(

                  results

                    .map(result => {

                      const lat =
                        Number(
                          result.lat
                        );

                      const lon =
                        Number(
                          result.lon
                        );

                      return {

                        ...result,

                        lat,

                        lon,

                        cleanName:
                          this.cleanSearchResult(
                            result
                          ),

                        category:
                          this.getResultCategory(
                            result
                          )

                      };

                    })

                    .filter(
                      result =>
                        result.cleanName
                    )

                ).slice(0, 8);

              this.showDestinationSuggestions =
                this.destinationSuggestions.length > 0;

            },

            error: () => {

              this.destinationSuggestions = [];

              this.showDestinationSuggestions =
                false;

            }

          });

      }, 400);

  }

  // ==============================
  // CLEAN SEARCH RESULT
  // ==============================

  cleanSearchResult(
    result: any
  ): string {

    const address =
      result?.address || {};

    const parts = [

      result?.name,

      address?.road,

      address?.neighbourhood,

      address?.suburb,

      address?.city_district,

      address?.city

    ];

    const uniqueParts: string[] = [];

    parts.forEach(part => {

      if (!part) {

        return;

      }

      const cleaned =
        String(part)

          .replace(
            /, Lagos State/gi,
            ''
          )

          .replace(
            /, Lagos/gi,
            ''
          )

          .replace(
            /, Nigeria/gi,
            ''
          )

          .trim();

      if (

        cleaned &&

        !uniqueParts.some(

          item =>
            item.toLowerCase() ===
            cleaned.toLowerCase()

        )

      ) {

        uniqueParts.push(
          cleaned
        );

      }

    });

    return uniqueParts
      .slice(0, 3)
      .join(', ');

  }

  // ==============================
  // RESULT CATEGORY
  // ==============================

  getResultCategory(
    result: any
  ): string {

    const type =
      result?.type ||
      result?.class ||
      '';

    const categoryMap: any = {

      road:
        'Street',

      residential:
        'Residential Area',

      neighbourhood:
        'Neighbourhood',

      suburb:
        'Area',

      city_district:
        'District',

      city:
        'City',

      town:
        'Town',

      village:
        'Village',

      house:
        'House',

      building:
        'Building',

      shop:
        'Shop',

      supermarket:
        'Supermarket',

      mall:
        'Shopping Mall',

      school:
        'School',

      hospital:
        'Hospital',

      restaurant:
        'Restaurant',

      hotel:
        'Hotel',

      pharmacy:
        'Pharmacy',

      bus_stop:
        'Bus Stop',

      station:
        'Station'

    };

    return (

      categoryMap[type] ||

      this.prettyType(type) ||

      'Place'

    );

  }

  // ==============================
  // PRETTY TYPE
  // ==============================

  prettyType(
    value: string
  ): string {

    if (!value) {

      return '';

    }

    return value

      .replace(
        /_/g,
        ' '
      )

      .replace(
        /\b\w/g,
        char =>
          char.toUpperCase()
      );

  }

  // ==============================
  // REMOVE DUPLICATES
  // ==============================

  removeDuplicateSuggestions(
    suggestions: any[]
  ): any[] {

    const seen =
      new Set<string>();

    return suggestions.filter(
      item => {

        const key =
          item.cleanName
            ?.toLowerCase()
            .trim();

        if (
          !key ||
          seen.has(key)
        ) {

          return false;

        }

        seen.add(key);

        return true;

      }
    );

  }

  // ==============================
  // SELECT DESTINATION
  // ==============================

  selectDestinationSuggestion(
    suggestion: any
  ): void {

    this.rideForm.patchValue({

      destination:
        suggestion.cleanName

    });

    this.destinationCoordinates = {

      lat:
        Number(
          suggestion.lat
        ),

      lng:
        Number(
          suggestion.lon
        )

    };

    this.showDestinationSuggestions =
      false;

    this.destinationSuggestions = [];

    this.addDestinationMarker(

      Number(
        suggestion.lat
      ),

      Number(
        suggestion.lon
      )

    );

    /*
     * Do NOT calculate the route here.
     *
     * The user must click
     * "Get Fare Estimate".
     */

  }

  // ==============================
  // DESTINATION MARKER
  // ==============================

  addDestinationMarker(
    lat: number,
    lng: number
  ): void {

    if (!this.map) {

      return;

    }

    if (this.destinationMarker) {

      this.map.removeLayer(
        this.destinationMarker
      );

    }

    this.destinationMarker =
      L.marker(

        [
          lat,
          lng
        ],

        {

          icon:

            L.divIcon({

              className:
                'custom-map-pin',

              html: `

                <div style="
                  width:28px;
                  height:28px;
                  border-radius:50%;
                  background:#e46b9a;
                  border:4px solid white;
                  box-shadow:0 3px 10px rgba(0,0,0,.2);
                "></div>

              `,

              iconSize:
                [28, 28],

              iconAnchor:
                [14, 14]

            })

        }

      ).addTo(this.map);

    this.destinationMarker.bindPopup(

      `<strong>Destination</strong><br>${this.rideForm.value.destination}`

    );

  }

  // ==============================
  // CALCULATE ROUTE
  // ==============================

  calculateRoute(): void {

    const pickup =
      this.rideForm
        .get('pickup')
        ?.value
        ?.trim();

    const destination =
      this.rideForm
        .get('destination')
        ?.value
        ?.trim();

    if (
      !pickup ||
      !destination
    ) {

      this.openModal(

        'Missing Location',

        'Please enter both your pickup location and destination.',

        'error'

      );

      return;

    }

    /*
     * Start a fresh calculation.
     */
    this.routeCalculated = false;

    this.distanceKm = 0;

    this.estimatedFare = 0;

    this.loadingRoute = true;

    /*
     * If suggestions were selected,
     * coordinates are already available.
     */
    if (

      this.pickupCoordinates &&

      this.destinationCoordinates

    ) {

      this.getRouteUsingCoordinates(

        this.pickupCoordinates.lat,

        this.pickupCoordinates.lng,

        this.destinationCoordinates.lat,

        this.destinationCoordinates.lng

      );

      return;

    }

    /*
     * If coordinates are not available,
     * geocode the pickup location.
     */
    this.mapService

      .geocodeAddress(
        pickup,
        1
      )

      .subscribe({

        next:
          (pickupResults) => {

            if (

              !pickupResults ||

              pickupResults.length === 0

            ) {

              this.loadingRoute =
                false;

              this.openModal(

                'Pickup Not Found',

                'We could not find your pickup location. Please choose a suggestion from the list.',

                'error'

              );

              return;

            }

            const pickupResult =
              pickupResults[0];

            this.pickupCoordinates = {

              lat:
                Number(
                  pickupResult.lat
                ),

              lng:
                Number(
                  pickupResult.lon
                )

            };

            /*
             * Now geocode destination.
             */
            this.mapService

              .geocodeAddress(
                destination,
                1
              )

              .subscribe({

                next:
                  (destinationResults) => {

                    if (

                      !destinationResults ||

                      destinationResults.length === 0

                    ) {

                      this.loadingRoute =
                        false;

                      this.openModal(

                        'Destination Not Found',

                        'We could not find your destination. Please choose a suggestion from the list.',

                        'error'

                      );

                      return;

                    }

                    const destinationResult =
                      destinationResults[0];

                    this.destinationCoordinates = {

                      lat:
                        Number(
                          destinationResult.lat
                        ),

                      lng:
                        Number(
                          destinationResult.lon
                        )

                    };

                    this.addPickupMarker(

                      this.pickupCoordinates!.lat,

                      this.pickupCoordinates!.lng

                    );

                    this.addDestinationMarker(

                      this.destinationCoordinates!.lat,

                      this.destinationCoordinates!.lng

                    );

                    this.getRouteUsingCoordinates(

                      this.pickupCoordinates!.lat,

                      this.pickupCoordinates!.lng,

                      this.destinationCoordinates!.lat,

                      this.destinationCoordinates!.lng

                    );

                  },

                error:
                  () => {

                    this.loadingRoute =
                      false;

                    this.routeCalculated =
                      false;

                    this.openModal(

                      'Route Error',

                      'We could not find your destination. Please try again.',

                      'error'

                    );

                  }

              });

          },

        error:
          () => {

            this.loadingRoute =
              false;

            this.routeCalculated =
              false;

            this.openModal(

              'Route Error',

              'We could not find your pickup location. Please try again.',

              'error'

            );

          }

      });

  }

  // ==============================
  // GET ROUTE USING COORDINATES
  // ==============================

  getRouteUsingCoordinates(

    pickupLat: number,

    pickupLng: number,

    destinationLat: number,

    destinationLng: number

  ): void {

    this.mapService

      .getRoute(

        pickupLat,

        pickupLng,

        destinationLat,

        destinationLng

      )

      .subscribe({

        next:
          (response) => {

            this.loadingRoute =
              false;

            if (

              !response ||

              !response.routes ||

              response.routes.length === 0

            ) {

              this.routeCalculated =
                false;

              this.distanceKm = 0;

              this.estimatedFare = 0;

              this.openModal(

                'Route Not Found',

                'We could not calculate a driving route between these locations.',

                'error'

              );

              return;

            }

            const route =
              response.routes[0];

            this.distanceKm =
              Number(

                (

                  route.distance / 1000

                ).toFixed(2)

              );

            this.calculateFare();

            /*
             * Only mark the route as valid
             * when we have a real distance
             * and fare.
             */
            if (

              this.distanceKm <= 0 ||

              this.estimatedFare <= 0

            ) {

              this.routeCalculated = false;

              this.distanceKm = 0;

              this.estimatedFare = 0;

              this.openModal(

                'Route Error',

                'We could not calculate a valid route and fare.',

                'error'

              );

              return;

            }

            this.routeCalculated = true;

            this.drawRoute(
              route.geometry
            );

          },

        error:
          () => {

            this.loadingRoute =
              false;

            this.routeCalculated =
              false;

            this.distanceKm = 0;

            this.estimatedFare = 0;

            this.openModal(

              'Route Error',

              'Unable to calculate the route right now. Please check your connection and try again.',

              'error'

            );

          }

      });

  }

  // ==============================
  // CALCULATE FARE
  // ==============================

  calculateFare(): void {

    if (
      this.distanceKm <= 0
    ) {

      this.estimatedFare = 0;

      return;

    }

    const rideType =
      this.rideForm
        .get('rideType')
        ?.value;

    if (
      rideType === 'Premium'
    ) {

      this.estimatedFare =
        Math.round(

          this.premiumBaseFare +

          (
            this.distanceKm *
            this.premiumPerKmRate
          )

        );

    } else {

      this.estimatedFare =
        Math.round(

          this.standardBaseFare +

          (
            this.distanceKm *
            this.standardPerKmRate
          )

        );

    }

  }

  // ==============================
  // DRAW ROUTE
  // ==============================

  drawRoute(
    geometry: any
  ): void {

    if (

      !this.map ||

      !geometry

    ) {

      return;

    }

    if (this.routeLayer) {

      this.map.removeLayer(
        this.routeLayer
      );

    }

    this.routeLayer =
      L.geoJSON(

        geometry,

        {

          style: {

            color:
              '#4776e6',

            weight: 5,

            opacity: 0.8

          }

        }

      ).addTo(this.map);

    const bounds =
      this.routeLayer.getBounds();

    if (
      bounds.isValid()
    ) {

      this.map.fitBounds(

        bounds,

        {

          padding:
            [35, 35]

        }

      );

    }

  }

  // ==============================
  // REQUEST RIDE
  // ==============================

  requestRide(): void {

    if (
      this.rideForm.invalid
    ) {

      this.rideForm.markAllAsTouched();

      this.openModal(

        'Incomplete Details',

        'Please enter your pickup location and destination.',

        'error'

      );

      return;

    }

    /*
     * The rider must successfully
     * calculate a route first.
     */
    if (
      !this.routeCalculated
    ) {

      this.openModal(

        'Get Fare Estimate',

        'Please calculate your route and fare before requesting the ride.',

        'error'

      );

      return;

    }

    if (

      !this.pickupCoordinates ||

      !this.destinationCoordinates

    ) {

      this.openModal(

        'Choose Your Locations',

        'Please select your pickup and destination from the suggestions before requesting the ride.',

        'error'

      );

      return;

    }

    if (

      this.distanceKm <= 0 ||

      this.estimatedFare <= 0

    ) {

      this.openModal(

        'Get Fare Estimate',

        'Please calculate your route and fare before requesting the ride.',

        'error'

      );

      return;

    }

    this.loadingRoute = true;

    this.afAuth.currentUser

      .then(user => {

        if (!user) {

          this.loadingRoute =
            false;

          this.openModal(

            'Not Logged In',

            'Please log in before requesting a ride.',

            'error'

          );

          return;

        }

        const rideData = {

          riderId:
            user.uid,

          pickup:
            this.rideForm.value.pickup,

          destination:
            this.rideForm.value.destination,

          pickupCoordinates: {

            lat:
              this.pickupCoordinates!.lat,

            lng:
              this.pickupCoordinates!.lng

          },

          destinationCoordinates: {

            lat:
              this.destinationCoordinates!.lat,

            lng:
              this.destinationCoordinates!.lng

          },

          distanceKm:
            this.distanceKm,

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

            this.loadingRoute =
              false;

            this.openModal(

              'Ride Requested',

              'Your ride request has been sent successfully. Please wait for a driver to accept your ride.',

              'success'

            );

            this.resetRideForm();

          })

          .catch(error => {

            console.error(
              'Error requesting ride:',
              error
            );

            this.loadingRoute =
              false;

            this.openModal(

              'Something Went Wrong',

              'Could not request your ride. Please try again.',

              'error'

            );

          });

      })

      .catch(error => {

        console.error(
          'Authentication error:',
          error
        );

        this.loadingRoute =
          false;

        this.openModal(

          'Something Went Wrong',

          'Could not verify your account. Please try again.',

          'error'

        );

      });

  }

  // ==============================
  // RESET RIDE FORM
  // ==============================

  resetRideForm(): void {

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

    this.routeCalculated = false;

    this.loadingRoute = false;

    this.pickupSuggestions = [];

    this.destinationSuggestions = [];

    this.showPickupSuggestions = false;

    this.showDestinationSuggestions = false;

    if (
      this.map &&
      this.pickupMarker
    ) {

      this.map.removeLayer(
        this.pickupMarker
      );

      this.pickupMarker = null;

    }

    if (
      this.map &&
      this.destinationMarker
    ) {

      this.map.removeLayer(
        this.destinationMarker
      );

      this.destinationMarker = null;

    }

    if (
      this.map &&
      this.routeLayer
    ) {

      this.map.removeLayer(
        this.routeLayer
      );

      this.routeLayer = null;

    }

    if (this.map) {

      this.map.setView(

        [
          6.5244,
          3.3792
        ],

        12

      );

    }

  }

  // ==============================
  // PAY WITH CARD
  // ==============================

  payWithCard(): void {

    if (!this.completedUnpaidRide) {
      return;
    }

    // Remove spaces from card number
    const cardNumber = this.cardNumber
      .replace(/\s/g, '');

    // Basic card number validation
    if (!/^\d{16}$/.test(cardNumber)) {

      this.openModal(
        'Invalid Card Number',
        'Please enter a valid 16-digit card number.',
        'error'
      );

      return;
    }

    // Card holder validation
    if (this.cardHolderName.trim().length < 2) {

      this.openModal(
        'Invalid Card Holder',
        'Please enter the card holder name.',
        'error'
      );

      return;
    }

    // Expiry validation: MM/YY
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(this.cardExpiry.trim())) {

      this.openModal(
        'Invalid Expiry Date',
        'Please enter the expiry date in MM/YY format.',
        'error'
      );

      return;
    }

    // CVV validation
    if (!/^\d{3,4}$/.test(this.cardCvv.trim())) {

      this.openModal(
        'Invalid CVV',
        'Please enter a valid 3 or 4 digit CVV.',
        'error'
      );

      return;
    }

    this.paymentLoading = true;

    /*
     * DEMO CARD PAYMENT
     *
     * This simulates a successful
     * card payment for the project.
     */

    setTimeout(() => {

      if (!this.completedUnpaidRide) {

        this.paymentLoading = false;

        return;

      }

      const rideId =
        this.completedUnpaidRide.id;

      this.firestore
        .collection('rides')
        .doc(rideId)
        .update({

          paymentMethod: 'card',

          paymentStatus: 'paid',

          paidAt: new Date()

        })

        .then(() => {

          this.paymentLoading = false;

          this.completedUnpaidRide = null;

          this.cardNumber = '';

          this.cardHolderName = '';

          this.cardExpiry = '';

          this.cardCvv = '';

          this.openModal(

            'Payment Successful',

            'Your card payment was completed successfully.',

            'success'

          );
        })

        .catch(error => {

          console.error(
            'Card payment error:',
            error
          );

          this.paymentLoading = false;

          this.openModal(

            'Payment Failed',

            'We could not complete your card payment. Please try again.',

            'error'

          );

        });

    }, 1500);

  }

  // ==============================
  // CONFIRM CASH PAYMENT
  // ==============================

  confirmCashPayment(): void {

    if (!this.completedUnpaidRide) {

      return;

    }

    this.pendingPaymentAction =
      'cash';

    this.openModal(

      'Confirm Cash Payment',

      `Have you paid ₦${Number(
        this.completedUnpaidRide.fare || 0
      ).toLocaleString()} to the driver?`,

      'confirm'

    );

  }

  // ==============================
  // CHANGE PAYMENT METHOD
  // ==============================

  changePaymentMethod(): void {

    if (!this.completedUnpaidRide) {

      return;

    }

    const newMethod =
      this.completedUnpaidRide.paymentMethod === 'card'
        ? 'cash'
        : 'card';

    this.firestore
      .collection('rides')
      .doc(this.completedUnpaidRide.id)
      .update({

        paymentMethod:
          newMethod

      })

      .then(() => {

        this.completedUnpaidRide.paymentMethod =
          newMethod;

        this.openModal(

          'Payment Method Changed',

          `Your payment method has been changed to ${newMethod === 'card'
            ? 'Card'
            : 'Cash'
          }.`,

          'success'

        );

      })

      .catch(error => {

        console.error(
          'Error changing payment method:',
          error
        );

        this.openModal(

          'Something Went Wrong',

          'Could not change your payment method.',

          'error'

        );

      });

  }

}