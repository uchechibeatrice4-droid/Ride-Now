import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RideHistoryComponent } from './ride-history.component';

describe('RideHistoryComponent', () => {
  let component: RideHistoryComponent;
  let fixture: ComponentFixture<RideHistoryComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RideHistoryComponent]
    });
    fixture = TestBed.createComponent(RideHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
