# ILP BitTorrent Extension

## License Format

``` js
{
  content_hash: "sha256:ac7d...",
  creator_account: "https://red.ilpdemo.org/ledger/accounts/walt",
  creator_public_key: "QwRCBaiU95sIYi19/A4PqSpz93lQpchheiS1BVtlnVM=",
  license: "https://creativecommons.org/licenses/pay/1.0",

  // Added by the licensee
  expires_at: "2015-06-16T00:00:01.000Z",
  licensee_public_key: "4mtU1/MnZnKi9xTHYUDDcJXjZ+ZjnBcEA+vaY/gVE8s="
}
```

And the fields provided by the creator:

## Getting Signed License from the Creator
1. Torrent file includes license type, creator account URI, price per unit of time
2. Downloader sends payment to creator's account including license the memo field. Payment amount depends on the desired license duration x the price per unit of time from the torrent file
3. Creator checks that the incoming payment includes enough money to cover the license duration
4. Creator signs license and submits signature as condition fulfillment for incoming payment
5. Downloader gets creator's signature from ledger notification of executed payment

## Downloading Content From Seeders
1. Downloader includes the license and license signature in bittorrent extended handshake
2. Seeders check license validity against expiration time and creator public key(s) specified in torrent file, choking downloader if license is invalid
3. Seeders include their ILP account address and seeding price in the extended handshake with the downloader
4. Seeders choke downloader until payment is received
5. Downloader pays the seeder, including the downloader's public key hash in the memo and execution condition
6. Seeder waits for incoming payment with the crypto condition id they can generate from the downloader's public key hash, once it receives the payment it unchokes the downloader
7. Seeder charges downloader 1 x `price` for each request, when balance reaches 0, repeat from step 4. 

## Open Questions
* Should we use public key hash instead of public key?
* Should we use ed25519 or RSA?
* Is listing the price per unit of time for the license the best way to do it? Should there be a fixed price, or a price schedule?
* How do we handle different valid licenses?


Should the license, creator account and public key be in the info? Then it would be included in the hash
Then you would just need to send the "exires_at", "licensee_public_key" and signature