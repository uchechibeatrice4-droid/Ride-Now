import { Component, OnInit, OnDestroy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ride-history',
  templateUrl: './ride-history.component.html',
  styleUrls: ['./ride-history.component.css']
})
export class RideHistoryComponent implements OnInit, OnDestroy {

  rides: any[] = [];
  activeRide: any = null;

  selectedRide: any = null;
  rating: number = 0;
  ratingComment: string = '';

  private rideSubscription?: Subscription;

  // Custom modal
  modalVisible: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalType: 'success' | 'error' | 'confirm' = 'success';

  pendingPaymentRide: any = null;
  paymentProcessingRideId: string | null = null;

  cardPaymentRide: any = null;
  cardNumber: string = '';
  cardHolderName: string = '';
  cardExpiry: string = '';
  cardCvv: string = '';
  // paymentLoading: boolean = false;

  constructor(
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth
  ) { }

  ngOnInit(): void {
    this.loadRides();
  }

  ngOnDestroy(): void {
    this.rideSubscription?.unsubscribe();
  }

  loadRides(): void {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        console.log('No logged-in rider found.');
        return;
      }

      console.log('Loading rides for rider:', user.uid);

      this.rideSubscription = this.firestore
        .collection('rides', ref =>
          ref.where('riderId', '==', user.uid)
        )
        .valueChanges({ idField: 'id' })
        .subscribe({
          next: (data: any[]) => {

            console.log('Rides received:', data);

            // Sort newest rides first
            this.rides = data.sort((a, b) => {
              return this.getDateValue(b.createdAt) -
                this.getDateValue(a.createdAt);
            });

            // Find the newest active ride
            const activeRides = this.rides.filter(ride =>
              ride.status === 'requested' ||
              ride.status === 'accepted' ||
              ride.status === 'arriving' ||
              ride.status === 'arrived' ||
              ride.status === 'in_progress'
            );

            this.activeRide = activeRides.length > 0
              ? activeRides[0]
              : null;

            console.log('Active ride:', this.activeRide);
          },

          error: error => {
            console.error('Error loading rides:', error);
          }
        });
    });
  }

  private getDateValue(date: any): number {

    if (!date) {
      return 0;
    }

    if (date.toDate) {
      return date.toDate().getTime();
    }

    return new Date(date).getTime();
  }

  // =========================
  // CUSTOM MODAL
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
    this.pendingPaymentRide = null;
  }

  confirmAction(): void {

    if (
      this.modalType === 'confirm' &&
      this.pendingPaymentRide
    ) {

      const ride = this.pendingPaymentRide;

      this.modalVisible = false;
      this.pendingPaymentRide = null;

      this.performPayment(ride);

    }
  }
  // =========================
  // PAYMENT
  // =========================

  payForRide(ride: any): void {

    if (ride.paymentStatus === 'paid') {
      this.openModal(
        'Already Paid',
        'This ride has already been paid for.',
        'success'
      );
      return;
    }

    // CARD
    if (ride.paymentMethod === 'card') {

      this.cardPaymentRide = ride;

      this.cardNumber = '';
      this.cardHolderName = '';
      this.cardExpiry = '';
      this.cardCvv = '';

      return;
    }

    // CASH
    this.pendingPaymentRide = ride;

    this.openModal(
      'Confirm Cash Payment',
      `Have you given ₦${ride.fare} cash to the driver?`,
      'confirm'
    );
  }

  changePaymentMethod(): void {

    if (!this.cardPaymentRide) {
      return;
    }

    const ride = this.cardPaymentRide;

    const newMethod =
      ride.paymentMethod === 'card'
        ? 'cash'
        : 'card';

    this.firestore
      .collection('rides')
      .doc(ride.id)
      .update({
        paymentMethod: newMethod
      })
      .then(() => {

        ride.paymentMethod = newMethod;

        if (newMethod === 'cash') {

          this.cardPaymentRide = null;

          this.openModal(
            'Payment Method Changed',
            'You can now pay the driver with cash.',
            'success'
          );

        } else {

          this.cardPaymentRide = ride;

          this.openModal(
            'Payment Method Changed',
            'You can now complete your payment with your card.',
            'success'
          );
        }

      })
      .catch(error => {

        console.error(
          'Error changing payment method:',
          error
        );

        this.openModal(
          'Error',
          'Could not change the payment method. Please try again.',
          'error'
        );

      });
  }


  private performPayment(ride: any): void {

    this.paymentProcessingRideId = ride.id;

    setTimeout(() => {

      this.firestore
        .collection('rides')
        .doc(ride.id)
        .update({

          paymentStatus: 'paid',

          paidAt: new Date()

        })

        .then(() => {

          this.paymentProcessingRideId = null;

          this.openModal(
            'Payment Successful 🎉',
            `Your payment of ₦${ride.fare} was successful.`,
            'success'
          );

        })

        .catch(error => {

          console.error(
            'Payment error:',
            error
          );

          this.paymentProcessingRideId = null;

          this.openModal(
            'Payment Failed',
            'Payment failed. Please try again.',
            'error'
          );

        });

    }, 1500);
  }

  payWithCard(): void {

    if (!this.cardPaymentRide) {
      return;
    }

    const cardNumber =
      this.cardNumber.replace(/\s/g, '');

    if (!/^\d{16}$/.test(cardNumber)) {

      this.openModal(
        'Invalid Card Number',
        'Please enter a valid 16-digit card number.',
        'error'
      );

      return;
    }

    if (this.cardHolderName.trim().length < 2) {

      this.openModal(
        'Invalid Card Holder',
        'Please enter the card holder name.',
        'error'
      );

      return;
    }

    if (
      !/^(0[1-9]|1[0-2])\/\d{2}$/.test(
        this.cardExpiry.trim()
      )
    ) {

      this.openModal(
        'Invalid Expiry Date',
        'Please enter the expiry date in MM/YY format.',
        'error'
      );

      return;
    }

    if (!/^\d{3,4}$/.test(this.cardCvv.trim())) {

      this.openModal(
        'Invalid CVV',
        'Please enter a valid 3 or 4 digit CVV.',
        'error'
      );

      return;
    }

    this.paymentProcessingRideId =
      this.cardPaymentRide.id;

    const ride = this.cardPaymentRide;

    setTimeout(() => {

      this.firestore
        .collection('rides')
        .doc(ride.id)
        .update({

          paymentMethod: 'card',

          paymentStatus: 'paid',

          paidAt: new Date()

        })

        .then(() => {

          this.paymentProcessingRideId = null;

          this.cardPaymentRide = null;

          this.cardNumber = '';
          this.cardHolderName = '';
          this.cardExpiry = '';
          this.cardCvv = '';

          this.openModal(
            'Payment Successful 🎉',
            `Your card payment of ₦${ride.fare} was successful.`,
            'success'
          );

        })

        .catch(error => {

          console.error(
            'Card payment error:',
            error
          );

          this.paymentProcessingRideId = null;

          this.openModal(
            'Payment Failed',
            'We could not complete your card payment. Please try again.',
            'error'
          );

        });

    }, 1500);
  }

  switchToCard(ride: any): void {

    if (ride.paymentStatus === 'paid') {
      return;
    }

    this.firestore
      .collection('rides')
      .doc(ride.id)
      .update({
        paymentMethod: 'card'
      })
      .then(() => {

        ride.paymentMethod = 'card';

        this.cardPaymentRide = ride;

        this.cardNumber = '';
        this.cardHolderName = '';
        this.cardExpiry = '';
        this.cardCvv = '';

      })
      .catch(error => {

        console.error(
          'Error switching to card:',
          error
        );

        this.openModal(
          'Error',
          'Could not change to card payment. Please try again.',
          'error'
        );

      });
  }

  switchToCash(ride: any): void {

    if (ride.paymentStatus === 'paid') {
      return;
    }

    this.firestore
      .collection('rides')
      .doc(ride.id)
      .update({
        paymentMethod: 'cash'
      })
      .then(() => {

        ride.paymentMethod = 'cash';

        this.cardPaymentRide = null;

        this.cardNumber = '';
        this.cardHolderName = '';
        this.cardExpiry = '';
        this.cardCvv = '';

      })
      .catch(error => {

        console.error(
          'Error switching to cash:',
          error
        );

        this.openModal(
          'Error',
          'Could not change to cash payment. Please try again.',
          'error'
        );

      });
  }


  // =========================
  // RATING
  // =========================

  selectRideForRating(ride: any): void {

    this.selectedRide = ride;
    this.rating = 0;
    this.ratingComment = '';
  }

  submitRating(): void {

    if (!this.selectedRide) {
      return;
    }

    if (this.rating === 0) {

      this.openModal(
        'Rating Required',
        'Please select a rating before submitting.',
        'error'
      );

      return;
    }

    this.firestore
      .collection('rides')
      .doc(this.selectedRide.id)
      .update({
        rating: this.rating,
        ratingComment: this.ratingComment,
        ratedAt: new Date()
      })
      .then(() => {

        this.selectedRide = null;
        this.rating = 0;
        this.ratingComment = '';

        this.openModal(
          'Thank You! ⭐',
          'Thank you for rating your driver!',
          'success'
        );

      })
      .catch(error => {

        console.error('Error submitting rating:', error);

        this.openModal(
          'Rating Failed',
          'Could not submit your rating. Please try again.',
          'error'
        );
      });
  }
}