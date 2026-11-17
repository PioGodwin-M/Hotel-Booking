import mongoose from 'mongoose';

async function inspect() {
  const paymentConn = await mongoose.createConnection('mongodb://localhost:27017/hotel_payment').asPromise();
  const bookingConn = await mongoose.createConnection('mongodb://localhost:27017/hotel_booking').asPromise();

  const payments = await paymentConn.collection('payments').find().sort({ createdAt: -1 }).limit(10).toArray();
  const webhooks = await paymentConn.collection('processedwebhookevents').find().sort({ processedAt: -1 }).limit(10).toArray();
  const paymentOutbox = await paymentConn.collection('outboxevents').find().sort({ createdAt: -1 }).limit(10).toArray();

  const bookings = await bookingConn.collection('bookings').find().sort({ createdAt: -1 }).limit(10).toArray();
  const bookingEvents = await bookingConn.collection('processedevents').find().sort({ processedAt: -1 }).limit(10).toArray();
  const bookingOutbox = await bookingConn.collection('outboxevents').find().sort({ createdAt: -1 }).limit(10).toArray();

  console.log(`\n=== PAYMENTS (${payments.length}) ===`);
  payments.forEach(p => {
    console.log(`PaymentId: ${p.paymentId} | Intent: ${p.stripePaymentIntentId} | Status: ${p.status} | PaidAt: ${p.paidAt} | CreatedAt: ${p.createdAt}`);
  });

  console.log(`\n=== PROCESSED WEBHOOKS (${webhooks.length}) ===`);
  webhooks.forEach(w => {
    console.log(`StripeEventId: ${w.stripeEventId} | EventType: ${w.eventType} | ProcessedAt: ${w.processedAt}`);
  });

  console.log(`\n=== PAYMENT OUTBOX (${paymentOutbox.length}) ===`);
  paymentOutbox.forEach(o => {
    console.log(`EventId: ${o.eventId} | Type: ${o.eventType} | Status: ${o.status} | CreatedAt: ${o.createdAt} | PublishedAt: ${o.publishedAt}`);
  });

  console.log(`\n=== BOOKINGS (${bookings.length}) ===`);
  bookings.forEach(b => {
    console.log(`BookingId: ${b._id} | Status: ${b.status} | PaymentId: ${b.paymentId} | CreatedAt: ${b.createdAt} | UpdatedAt: ${b.updatedAt}`);
  });

  console.log(`\n=== BOOKING PROCESSED EVENTS (${bookingEvents.length}) ===`);
  bookingEvents.forEach(e => {
    console.log(`EventId: ${e.eventId} | EventType: ${e.eventType} | ProcessedAt: ${e.processedAt}`);
  });

  console.log(`\n=== BOOKING OUTBOX (${bookingOutbox.length}) ===`);
  bookingOutbox.forEach(o => {
    console.log(`EventId: ${o.eventId} | Type: ${o.eventType} | Status: ${o.status} | CreatedAt: ${o.createdAt} | PublishedAt: ${o.publishedAt}`);
  });

  await paymentConn.close();
  await bookingConn.close();
}

inspect().catch(console.error);
