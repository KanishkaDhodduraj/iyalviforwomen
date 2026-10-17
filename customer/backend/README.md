# Customer backend

## Demo checkout

`DEMO_PAYMENTS` is optional and defaults to `false`. Set it to `true` only for a
demo environment: order creation then accepts COD, UPI, CARD, or NETBANKING and
returns an order marked `demo: true` with `paymentStatus: "pending"`. When it is
unset or `false`, COD is the only accepted payment method. This workflow does
not contact a payment gateway or collect card details.

## Seed and clear product data

`npm run seed` only creates the default Settings singleton; it does not add
product fixtures.

To permanently delete all customer products and clear product references from
wishlists in a non-production database, run:

```sh
npm run clear:products -- "DELETE PRODUCTS"
```

The command refuses `NODE_ENV=production` and requires that exact confirmation
argument. On success it prints only the number of deleted products and wishlists
that had references cleared.
