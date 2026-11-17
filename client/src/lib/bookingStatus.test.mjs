import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBookingStatusDisplay,
  PAYMENT_ATTEMPT_STATES,
  findMatchingActiveHold,
} from './bookingStatus.js';

describe('Booking Status Display Mapping (Round 4e Requirements)', () => {
  const futureHoldTime = new Date(Date.now() + 600000).toISOString();
  const pastHoldTime = new Date(Date.now() - 60000).toISOString();

  test('1. Awaiting payment: active hold shows countdown and permits payment', () => {
    const booking = {
      _id: 'b1',
      status: 'HELD',
      holdExpiresAt: futureHoldTime,
    };
    const result = getBookingStatusDisplay({
      booking,
      isExpiredCountdown: false,
      countdownText: '9:42',
      attemptState: PAYMENT_ATTEMPT_STATES.NOT_SUBMITTED,
    });

    assert.equal(result.statusType, 'held');
    assert.equal(result.label, 'Payment pending · held for 9:42');
    assert.equal(result.canPay, true);
    assert.equal(result.canCancel, true);
    assert.equal(result.canViewReceipt, false);
  });

  test('2. Confirming state: payment submitted suppresses pay button', () => {
    const booking = {
      _id: 'b2',
      status: 'HELD',
      holdExpiresAt: futureHoldTime,
    };
    const result = getBookingStatusDisplay({
      booking,
      isExpiredCountdown: false,
      countdownText: '9:40',
      attemptState: PAYMENT_ATTEMPT_STATES.PROCESSING,
    });

    assert.equal(result.statusType, 'confirming');
    assert.equal(result.label, 'Confirming your booking…');
    assert.equal(result.canPay, false, 'No pay button while confirming');
    assert.equal(result.canCancel, false);
    assert.equal(result.canViewReceipt, false);
  });

  test('3. Confirmed booking: shows "Confirmed" and NEVER shows "Hold expired"', () => {
    const booking = {
      _id: 'b3',
      status: 'CONFIRMED',
      holdExpiresAt: pastHoldTime, // Notice past hold time should NOT trigger hold expired
    };
    const result = getBookingStatusDisplay({
      booking,
      isExpiredCountdown: true, // Countdown would be expired, but status is CONFIRMED
      countdownText: '0:00',
    });

    assert.equal(result.statusType, 'confirmed');
    assert.equal(result.label, 'Confirmed');
    assert.equal(result.canPay, false);
    assert.equal(result.canViewReceipt, true);
    assert.doesNotMatch(result.label, /expired/i, 'Confirmed bookings must never show hold expired');
  });

  test('4. Cancelled booking: shows "Cancelled" and NEVER shows "Hold expired"', () => {
    const booking = {
      _id: 'b4',
      status: 'CANCELLED',
      holdExpiresAt: pastHoldTime,
    };
    const result = getBookingStatusDisplay({
      booking,
      isExpiredCountdown: true,
    });

    assert.equal(result.statusType, 'cancelled');
    assert.equal(result.label, 'Cancelled');
    assert.equal(result.canPay, false);
    assert.doesNotMatch(result.label, /expired/i);
  });

  test('5. Expired hold: server status EXPIRED shows "Hold expired"', () => {
    const booking = {
      _id: 'b5',
      status: 'EXPIRED',
    };
    const result = getBookingStatusDisplay({ booking });

    assert.equal(result.statusType, 'expired');
    assert.equal(result.label, 'Hold expired');
    assert.equal(result.canPay, false);
  });

  test('6. Expired hold: HELD booking with local expired countdown shows "Hold expired"', () => {
    const booking = {
      _id: 'b6',
      status: 'HELD',
      holdExpiresAt: pastHoldTime,
    };
    const result = getBookingStatusDisplay({
      booking,
      isExpiredCountdown: true,
    });

    assert.equal(result.statusType, 'expired');
    assert.equal(result.label, 'Hold expired');
    assert.equal(result.canPay, false);
  });

  test('7. Completed stay: past checkout date with CONFIRMED status shows "Confirmed"', () => {
    const booking = {
      _id: 'b7',
      status: 'CONFIRMED',
      checkIn: '2025-01-01T00:00:00.000Z',
      checkOut: '2025-01-05T00:00:00.000Z',
    };
    const result = getBookingStatusDisplay({ booking, isExpiredCountdown: true });

    assert.equal(result.statusType, 'confirmed');
    assert.equal(result.label, 'Confirmed');
    assert.equal(result.canViewReceipt, true);
    assert.equal(result.canPay, false);
  });
});

describe('Existing Hold Detection for Room Details', () => {
  const existingBookings = [
    {
      _id: 'active_hold_1',
      hotelId: 'h1',
      roomCategoryId: 'r1',
      checkIn: '2026-11-20T00:00:00.000Z',
      checkOut: '2026-11-22T00:00:00.000Z',
      status: 'HELD',
      holdExpiresAt: new Date(Date.now() + 500000).toISOString(),
    },
    {
      _id: 'expired_hold_2',
      hotelId: 'h1',
      roomCategoryId: 'r1',
      checkIn: '2026-11-20T00:00:00.000Z',
      checkOut: '2026-11-22T00:00:00.000Z',
      status: 'HELD',
      holdExpiresAt: new Date(Date.now() - 50000).toISOString(),
    },
  ];

  test('Matches active unexpired hold for identical hotel, room, and dates', () => {
    const match = findMatchingActiveHold(existingBookings, {
      hotelId: 'h1',
      roomCategoryId: 'r1',
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-22',
    });
    assert.ok(match);
    assert.equal(match._id, 'active_hold_1');
  });

  test('Does not match when dates differ', () => {
    const match = findMatchingActiveHold(existingBookings, {
      hotelId: 'h1',
      roomCategoryId: 'r1',
      checkInDate: '2026-11-25',
      checkOutDate: '2026-11-27',
    });
    assert.equal(match, null);
  });

  test('Does not match expired holds', () => {
    const match = findMatchingActiveHold([existingBookings[1]], {
      hotelId: 'h1',
      roomCategoryId: 'r1',
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-22',
    });
    assert.equal(match, null);
  });
});
